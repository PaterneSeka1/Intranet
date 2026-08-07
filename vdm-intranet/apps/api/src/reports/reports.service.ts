import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { LogAction, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PresenceScheduleService } from '../presence/presence.schedule.service'
import { PublicHolidaysService } from '../public-holidays/public-holidays.service'
import { LeaveSyncService } from '../leaves/leave-sync.service'
import { matchLeaveToUser, isLeaveActiveOnDay } from '../leaves/leave-match.util'
import { isRecurringWorkDay } from '../common/working-days.util'
import {
  CAN_VIEW_REPORTS,
  CAN_EXPORT_EXTENDED_REPORTS,
  CAN_VIEW_REPORTS_GLOBAL,
  CAN_VIEW_REPORTS_BU_SCOPE,
} from '../common/permissions'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

type ReportAccess = 'presence' | 'extended'

export type ExportFormat = 'excel' | 'pdf'

// Forme minimale requise pour recalculer une synthèse d'assiduité sur une plage — cf.
// `computeAttendanceSummaries`. `getPresenceSummaryRows` et `getGeneralData` sélectionnent chacun
// un sur-ensemble de ces champs, TypeScript accepte la forme plus large de façon structurelle.
type AttendanceUser = {
  id: string
  username: string
  email?: string | null
  workingDays: number[]
  scheduleGroup: { expectedArrivalTime: string; isNightShift: boolean } | null
  individualExpectedArrivalTime: string | null
}

type AttendanceSummary = { absences: number; lateDays: number; lateMinutesTotal: number }

export const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Présent',
  LATE: 'En retard',
  ABSENT: 'Absent',
  // Statuts calculés à la volée (jamais persistés en DB), mêmes libellés que /pilotage et
  // /presences — cf. presence.service.ts::SyntheticStatus.
  EN_CONGE: 'En congé',
  REPOS: 'Repos',
  EN_ATTENTE: 'En attente',
}

function getToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function toIso(d: Date): string {
  return d.toISOString().split('T')[0]
}

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: PresenceScheduleService,
    private readonly publicHolidays: PublicHolidaysService,
    private readonly leaveSync: LeaveSyncService
  ) {}

  assertAllowed(requester: Requester, access: ReportAccess = 'extended') {
    if (!CAN_VIEW_REPORTS.includes(requester.role)) {
      throw new ForbiddenException('Accès réservé aux responsables.')
    }
    if (access === 'extended' && !CAN_EXPORT_EXTENDED_REPORTS.includes(requester.role)) {
      throw new ForbiddenException('La DAF est limitée aux rapports de présence et absence.')
    }
  }

  buildUserWhere(requester: Requester, access: ReportAccess = 'extended'): object {
    if (CAN_VIEW_REPORTS_GLOBAL.includes(requester.role)) return {}
    if (access === 'presence' && requester.role === Role.DAF) return {}
    if (CAN_VIEW_REPORTS_BU_SCOPE.includes(requester.role) && requester.businessUnitId) {
      return { businessUnitId: requester.businessUnitId }
    }
    if (requester.role === Role.RESPONSABLE_POLE && requester.poleId) {
      return { poleId: requester.poleId }
    }
    return { id: requester.id }
  }

  fmtDate(d: Date | string | null | undefined): string {
    if (!d) return ''
    const dt = new Date(d)
    return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
  }

  fmtDateTime(d: Date | string | null | undefined): string {
    if (!d) return ''
    const dt = new Date(d)
    return `${this.fmtDate(dt)} ${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`
  }

  /** Libellé de période pour l'en-tête des exports : plage explicite, ou "Situation du …" si un seul jour. */
  fmtPeriodLabel(from: Date, to: Date): string {
    return toIso(from) === toIso(to)
      ? `Situation du ${this.fmtDate(from)}`
      : `Période du ${this.fmtDate(from)} au ${this.fmtDate(to)}`
  }

  /**
   * Libellé de période à partir des paramètres de requête bruts (`from`/`to`), pour l'en-tête des
   * fichiers exportés (Excel, PDF) — utilisable même quand le service de données appliquera lui
   * -même un repli par défaut (ex: 90 derniers jours) plutôt que la plage réellement résolue.
   */
  periodLabel(dateFrom?: string, dateTo?: string, fallbackNote?: string): string {
    if (!dateFrom && !dateTo) {
      const generated = `Généré le ${this.fmtDate(new Date())}`
      return fallbackNote ? `${generated} · ${fallbackNote}` : generated
    }
    const from = this.parseReportDate(dateFrom, 'Date de début')
    const to = this.parseReportDate(dateTo, 'Date de fin')
    if (from && to) return this.fmtPeriodLabel(from, to)
    if (from) return `Depuis le ${this.fmtDate(from)}`
    if (to) return `Jusqu'au ${this.fmtDate(to)}`
    return `Généré le ${this.fmtDate(new Date())}`
  }

  parseReportDate(value: string | undefined, label: string, endOfDay = false): Date | undefined {
    if (!value) return undefined
    const timestamp = Date.parse(value)
    if (Number.isNaN(timestamp)) {
      throw new BadRequestException(`${label} invalide.`)
    }
    const date = new Date(timestamp)
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(23, 59, 59, 999)
    }
    return date
  }

  assertDateRange(dateFrom?: Date, dateTo?: Date) {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException(
        'La date de début doit être antérieure ou égale à la date de fin.'
      )
    }
  }

  async getPresenceRows(requester: Requester, dateFrom?: string, dateTo?: string) {
    this.assertAllowed(requester, 'presence')
    const userWhere = this.buildUserWhere(requester, 'presence')

    const since90 = new Date()
    since90.setUTCDate(since90.getUTCDate() - 90)
    since90.setUTCHours(0, 0, 0, 0)

    const parsedFrom = this.parseReportDate(dateFrom, 'Date de début')
    const parsedTo = this.parseReportDate(dateTo, 'Date de fin')
    this.assertDateRange(parsedFrom, parsedTo)

    const dateFilter: Record<string, Date> = {
      gte: parsedFrom ?? since90,
      lte: parsedTo ?? getToday(),
    }

    return this.prisma.presence.findMany({
      where: {
        date: dateFilter,
        user: userWhere,
      },
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            role: true,
            businessUnit: { select: { name: true } },
            pole: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { user: { lastName: 'asc' } }],
      take: 10000,
    })
  }

  /**
   * Calcule, pour chaque utilisateur de `users`, sa synthèse d'assiduité sur `[start, end]` :
   * nombre d'absences, jours de retard et minutes de retard cumulées. L'absence n'est jamais
   * persistée en DB — elle est recalculée jour par jour, même règle que `getSummary`/
   * `getPeriodReport` (motif `workingDays` propre à l'utilisateur, mandat explicite prioritaire,
   * jour férié, congé actif exclu du décompte, "pas encore arrivé" non compté absent pour le jour
   * courant). Partagé par `getPresenceSummaryRows` (rapport de présences) et `getGeneralData`
   * (rapport général) pour éviter de dupliquer cette règle à deux endroits.
   */
  private async computeAttendanceSummaries(
    users: AttendanceUser[],
    userWhere: object,
    start: Date,
    end: Date
  ): Promise<Map<string, AttendanceSummary>> {
    const summaries = new Map<string, AttendanceSummary>(
      users.map((u) => [u.id, { absences: 0, lateDays: 0, lateMinutesTotal: 0 }])
    )

    if (end < start || users.length === 0) return summaries

    const today = getToday()
    const now = new Date()

    const [presences, mandates, holidays, activeLeaves] = await Promise.all([
      this.prisma.presence.findMany({
        where: { date: { gte: start, lte: end }, user: userWhere },
        select: { userId: true, date: true, status: true, delayMinutes: true },
      }),
      this.prisma.dailyMandate.findMany({
        where: { date: { gte: start, lte: end }, user: userWhere },
        select: { userId: true, date: true, expectedArrivalTime: true, isNightShift: true },
      }),
      this.publicHolidays.getHolidaysInRange(start, end),
      this.leaveSync.getActiveLeavesInRange(start, end),
    ])

    const presenceIndex = new Map(presences.map((p) => [`${p.userId}|${toIso(p.date)}`, p]))
    const mandateIndex = new Map(mandates.map((m) => [`${m.userId}|${toIso(m.date)}`, m]))
    const userLeaves = new Map(
      users.map((u) => [u.id, activeLeaves.filter((l) => matchLeaveToUser(l, u))])
    )

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = new Date(d)
      const dayIso = toIso(day)
      const isHolidayDay = holidays.has(dayIso)
      const isToday = day.getTime() === today.getTime()

      for (const user of users) {
        const summary = summaries.get(user.id)!
        const presence = presenceIndex.get(`${user.id}|${dayIso}`)
        if (presence) {
          if (presence.status === 'LATE') {
            summary.lateDays++
            summary.lateMinutesTotal += presence.delayMinutes ?? 0
          }
          continue // PRESENT ou LATE : jamais compté absent
        }

        const leavesForUser = userLeaves.get(user.id)
        if (leavesForUser?.some((l) => isLeaveActiveOnDay(l, day))) continue // congé, pas absent

        const mandate = mandateIndex.get(`${user.id}|${dayIso}`)
        const isNonWorkingDefault = !isRecurringWorkDay(user.workingDays, day) || isHolidayDay
        const hasScheduleSource = !!user.scheduleGroup || !!user.individualExpectedArrivalTime
        const isWorkDay = !!mandate || (!isNonWorkingDefault && hasScheduleSource)
        if (!isWorkDay) continue // repos, pas absent

        const expectedTime =
          mandate?.expectedArrivalTime ??
          user.scheduleGroup?.expectedArrivalTime ??
          user.individualExpectedArrivalTime ??
          null
        const isNightShift = mandate?.isNightShift ?? user.scheduleGroup?.isNightShift ?? false
        // Jour du passé dans la plage : forcément dépassé. Jour courant : seulement si l'heure
        // attendue (+ tolérance) est déjà dépassée — jamais "absent" avant, même règle que
        // getSummary/getPeriodReport.
        const overdue = isToday
          ? expectedTime
            ? this.schedule.isArrivalOverdue(expectedTime, now, isNightShift)
            : true
          : true
        if (overdue) summary.absences++
      }
    }

    return summaries
  }

  async getPresenceSummaryRows(requester: Requester, dateFrom?: string, dateTo?: string) {
    this.assertAllowed(requester, 'presence')
    const userWhere = this.buildUserWhere(requester, 'presence')

    const since90 = new Date()
    since90.setUTCDate(since90.getUTCDate() - 90)
    since90.setUTCHours(0, 0, 0, 0)

    const parsedFrom = this.parseReportDate(dateFrom, 'Date de début')
    const parsedTo = this.parseReportDate(dateTo, 'Date de fin')
    this.assertDateRange(parsedFrom, parsedTo)

    const today = getToday()
    const rawStart = parsedFrom ?? since90
    const rawEnd = parsedTo ?? today
    const start = dateOnly(rawStart)
    const rawEndDay = dateOnly(rawEnd)
    const end = rawEndDay > today ? today : rawEndDay

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        businessUnit: { select: { name: true } },
        pole: { select: { name: true } },
        workingDays: true,
        scheduleGroup: { select: { expectedArrivalTime: true, isNightShift: true } },
        individualExpectedArrivalTime: true,
      },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      take: 5000,
    })

    const summaries = await this.computeAttendanceSummaries(users, userWhere, start, end)

    return users.map((u) => ({
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      businessUnitName: u.businessUnit?.name ?? '',
      poleName: u.pole?.name ?? '',
      ...summaries.get(u.id)!,
    }))
  }

  async getActivityRows(requester: Requester, dateFrom?: string, dateTo?: string) {
    this.assertAllowed(requester)
    const userWhere = this.buildUserWhere(requester)

    const parsedFrom = this.parseReportDate(dateFrom, 'Date de début')
    const parsedTo = this.parseReportDate(dateTo, 'Date de fin', true)
    this.assertDateRange(parsedFrom, parsedTo)

    const dateFilter: Record<string, Date> = {}
    if (parsedFrom) dateFilter.gte = parsedFrom
    if (parsedTo) dateFilter.lte = parsedTo

    return this.prisma.activityLog.findMany({
      where: {
        ...(Object.keys(dateFilter).length ? { occurredAt: dateFilter } : {}),
        user: userWhere,
      },
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            role: true,
            businessUnit: { select: { name: true } },
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 5000,
    })
  }

  async getConnectionRows(requester: Requester, dateFrom?: string, dateTo?: string) {
    this.assertAllowed(requester)
    const userWhere = this.buildUserWhere(requester)

    const since90conn = new Date()
    since90conn.setUTCDate(since90conn.getUTCDate() - 90)
    since90conn.setUTCHours(0, 0, 0, 0)

    const parsedFrom = this.parseReportDate(dateFrom, 'Date de début')
    const parsedTo = this.parseReportDate(dateTo, 'Date de fin')
    this.assertDateRange(parsedFrom, parsedTo)

    const dateFilter: Record<string, Date> = {
      gte: parsedFrom ?? since90conn,
      lte: parsedTo ?? getToday(),
    }

    return this.prisma.connectionLog.findMany({
      where: {
        date: dateFilter,
        user: userWhere,
      },
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
            role: true,
            businessUnit: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { connectedAt: 'desc' }],
      take: 5000,
    })
  }

  /**
   * Vue consolidée : statut "en direct" de chaque utilisateur (aujourd'hui) + synthèse
   * d'assiduité sur la période demandée (`dateFrom`/`dateTo`, par défaut aujourd'hui seul, pour
   * rester compatible avec l'ancien rapport "instantané du jour"). Les connexions sont comptées
   * sur cette même période plutôt que sur le seul jour courant.
   */
  async getGeneralData(requester: Requester, dateFrom?: string, dateTo?: string) {
    this.assertAllowed(requester)
    const userWhere = this.buildUserWhere(requester)

    const today = getToday()
    const now = new Date()

    const parsedFrom = this.parseReportDate(dateFrom, 'Date de début')
    const parsedTo = this.parseReportDate(dateTo, 'Date de fin')
    this.assertDateRange(parsedFrom, parsedTo)

    const periodFrom = parsedFrom ? dateOnly(parsedFrom) : today
    const periodToRaw = parsedTo ? dateOnly(parsedTo) : today
    const periodTo = periodToRaw > today ? today : periodToRaw

    const [users, presences, connectionsCount, mandates, holiday, activeLeaves] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { ...userWhere, isActive: true },
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            role: true,
            businessUnit: { select: { name: true } },
            pole: { select: { name: true } },
            workingDays: true,
            scheduleGroup: {
              select: { name: true, expectedArrivalTime: true, isNightShift: true },
            },
            individualExpectedArrivalTime: true,
            lastLoginAt: true,
          },
          orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
          take: 5000,
        }),
        this.prisma.presence.findMany({
          where: { date: today, user: userWhere },
          include: { user: { select: { username: true } } },
        }),
        this.prisma.connectionLog.count({
          where: { date: { gte: periodFrom, lte: periodTo }, type: 'LOGIN', user: userWhere },
        }),
        this.prisma.dailyMandate.findMany({
          where: { date: today, user: userWhere },
          select: { userId: true, expectedArrivalTime: true, isNightShift: true },
        }),
        this.publicHolidays.isHoliday(today),
        this.leaveSync.getActiveLeaves(today),
      ])

    const presenceByUserId = new Map(presences.map((p) => [p.userId, p]))
    const mandateMap = new Map(mandates.map((m) => [m.userId, m]))

    // Statut "aujourd'hui" par utilisateur, même règle que /pilotage (getSummary) : présence
    // enregistrée > congé > mandat/motif de travail propre à l'utilisateur > heure attendue
    // dépassée. Un utilisateur en repos ou pas encore en retard n'est jamais affiché "Absent".
    const usersWithStatus = users.map((u) => {
      const presence = presenceByUserId.get(u.id)
      if (presence) return { ...u, statusLabel: STATUS_LABELS[presence.status] ?? presence.status }

      if (activeLeaves.some((l) => matchLeaveToUser(l, u))) {
        return { ...u, statusLabel: STATUS_LABELS.EN_CONGE }
      }

      const mandate = mandateMap.get(u.id)
      const isNonWorkingDefault = !isRecurringWorkDay(u.workingDays, today) || holiday.isHoliday
      const hasScheduleSource = !!u.scheduleGroup || !!u.individualExpectedArrivalTime
      const isWorkDay = !!mandate || (!isNonWorkingDefault && hasScheduleSource)
      if (!isWorkDay) return { ...u, statusLabel: STATUS_LABELS.REPOS }

      const expectedTime =
        mandate?.expectedArrivalTime ??
        u.scheduleGroup?.expectedArrivalTime ??
        u.individualExpectedArrivalTime ??
        null
      const isNightShift = mandate?.isNightShift ?? u.scheduleGroup?.isNightShift ?? false
      const overdue = expectedTime
        ? this.schedule.isArrivalOverdue(expectedTime, now, isNightShift)
        : true
      return { ...u, statusLabel: overdue ? STATUS_LABELS.ABSENT : STATUS_LABELS.EN_ATTENTE }
    })

    const periodSummaries = await this.computeAttendanceSummaries(
      users,
      userWhere,
      periodFrom,
      periodTo
    )

    const usersWithStatusAndPeriod = usersWithStatus.map((u) => ({
      ...u,
      ...periodSummaries.get(u.id)!,
    }))

    return {
      users: usersWithStatusAndPeriod,
      presences,
      connectionsCount,
      today,
      periodFrom,
      periodTo,
    }
  }

  async logExport(userId: string, action: LogAction, format: ExportFormat = 'excel') {
    await this.prisma.activityLog.create({
      data: {
        userId,
        action,
        entity: 'Report',
        details: { exportedAt: new Date().toISOString(), format } as object,
      },
    })
  }
}
