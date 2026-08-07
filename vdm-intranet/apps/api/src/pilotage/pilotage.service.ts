import { ForbiddenException, Injectable } from '@nestjs/common'
import { LogAction, PresenceStatus, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PublicHolidaysService } from '../public-holidays/public-holidays.service'
import { PresenceScheduleService } from '../presence/presence.schedule.service'
import { LeaveSyncService } from '../leaves/leave-sync.service'
import { matchLeaveToUser, isLeaveActiveOnDay } from '../leaves/leave-match.util'
import {
  CAN_VIEW_PILOTAGE,
  CAN_VIEW_PILOTAGE_GLOBAL,
  CAN_VIEW_PILOTAGE_BU_SCOPE,
} from '../common/permissions'
import { isRecurringWorkDay } from '../common/working-days.util'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

function getToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function getDaysAgo(n: number): Date {
  const d = getToday()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

function toIso(d: Date): string {
  return d.toISOString().split('T')[0]
}

function parseIsoOrToday(dateStr?: string): Date {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const parsed = new Date(Date.UTC(y, m - 1, d))
    if (!isNaN(parsed.getTime())) return parsed
  }
  return getToday()
}

function getIsoWeekRange(d: Date): { start: Date; end: Date } {
  const day = d.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setUTCDate(d.getUTCDate() + diffToMonday)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return { start, end }
}

function getMonthRange(d: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return { start, end }
}

@Injectable()
export class PilotageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicHolidays: PublicHolidaysService,
    private readonly leaveSync: LeaveSyncService,
    private readonly schedule: PresenceScheduleService
  ) {}

  private assertAllowed(requester: Requester) {
    if (!CAN_VIEW_PILOTAGE.includes(requester.role)) {
      throw new ForbiddenException('Accès réservé aux responsables.')
    }
  }

  private buildUserWhere(requester: Requester): object {
    const base = { isActive: true }
    if (CAN_VIEW_PILOTAGE_GLOBAL.includes(requester.role)) return base
    if (CAN_VIEW_PILOTAGE_BU_SCOPE.includes(requester.role) && requester.businessUnitId)
      return { ...base, businessUnitId: requester.businessUnitId }
    if (requester.role === Role.RESPONSABLE_POLE && requester.poleId) {
      return { ...base, poleId: requester.poleId }
    }
    return { ...base, id: requester.id }
  }

  async getSummary(requester: Requester) {
    this.assertAllowed(requester)

    const today = getToday()
    const now = new Date()
    const userWhere = this.buildUserWhere(requester)

    const [users, presences, mandates, holiday, activeLeaves] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          username: true,
          email: true,
          individualExpectedArrivalTime: true,
          workingDays: true,
          scheduleGroup: { select: { expectedArrivalTime: true, isNightShift: true } },
        },
      }),
      this.prisma.presence.findMany({
        where: {
          date: today,
          user: userWhere,
        },
        select: { userId: true, status: true },
      }),
      this.prisma.dailyMandate.findMany({
        where: { date: today, user: userWhere },
        select: { userId: true, expectedArrivalTime: true, isNightShift: true },
      }),
      this.publicHolidays.isHoliday(today),
      this.leaveSync.getActiveLeaves(today),
    ])

    const totalActive = users.length
    const presenceMap = new Map(presences.map((p) => [p.userId, p.status]))
    const mandateMap = new Map(mandates.map((m) => [m.userId, m]))

    let present = 0
    let late = 0
    let onLeave = 0
    let dayOff = 0
    let pending = 0
    let absent = 0

    for (const user of users) {
      const status = presenceMap.get(user.id)
      if (status === PresenceStatus.PRESENT) {
        present++
        continue
      }
      if (status === PresenceStatus.LATE) {
        late++
        continue
      }
      if (status) continue // statut persisté imprévu — ne pas retomber dans les compteurs ci-dessous

      if (activeLeaves.some((l) => matchLeaveToUser(l, user))) {
        onLeave++
        continue
      }

      const mandate = mandateMap.get(user.id)
      const isNonWorkingDefault = !isRecurringWorkDay(user.workingDays, today) || holiday.isHoliday
      // Un mandat est une affectation explicite : il prime toujours sur le motif récurrent/férié par défaut.
      const isWorkDay =
        !!mandate ||
        (!isNonWorkingDefault && (!!user.scheduleGroup || !!user.individualExpectedArrivalTime))
      if (!isWorkDay) {
        dayOff++
        continue
      }

      const expectedTime =
        mandate?.expectedArrivalTime ??
        user.scheduleGroup?.expectedArrivalTime ??
        user.individualExpectedArrivalTime ??
        null
      const isNightShift = mandate?.isNightShift ?? user.scheduleGroup?.isNightShift ?? false
      const overdue = expectedTime
        ? this.schedule.isArrivalOverdue(expectedTime, now, isNightShift)
        : true
      if (overdue) absent++
      else pending++
    }

    return {
      date: today,
      totalActive,
      present,
      late,
      onLeave,
      dayOff,
      pending,
      absent,
      presenceRate: totalActive > 0 ? Math.round(((present + late) / totalActive) * 100) : 0,
      mandatesToday: mandates.length,
      isPublicHoliday: holiday.isHoliday,
      publicHolidayLabel: holiday.label,
    }
  }

  async getPresenceByBu(requester: Requester) {
    this.assertAllowed(requester)

    const today = getToday()
    const now = new Date()
    const userWhere = this.buildUserWhere(requester)

    const [users, presences, mandates, holiday, activeLeaves] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          username: true,
          email: true,
          businessUnitId: true,
          businessUnit: { select: { id: true, name: true, code: true } },
          individualExpectedArrivalTime: true,
          workingDays: true,
          scheduleGroup: { select: { expectedArrivalTime: true, isNightShift: true } },
        },
      }),
      this.prisma.presence.findMany({
        where: { date: today, user: userWhere },
        select: { userId: true, status: true },
      }),
      this.prisma.dailyMandate.findMany({
        where: { date: today, user: userWhere },
        select: { userId: true, expectedArrivalTime: true, isNightShift: true },
      }),
      this.publicHolidays.isHoliday(today),
      this.leaveSync.getActiveLeaves(today),
    ])

    const presenceMap = new Map(presences.map((p) => [p.userId, p.status]))
    const mandateMap = new Map(mandates.map((m) => [m.userId, m]))

    const buMap = new Map<
      string,
      {
        buId: string
        buName: string
        buCode: string
        total: number
        present: number
        late: number
        onLeave: number
        // Non comptés dans "absent" : pas le jour de travail (dayOff) ou heure pas encore dépassée
        // (pending). Non affichés dans le graphique par BU, exposés pour cohérence avec `total`.
        dayOff: number
        pending: number
        absent: number
      }
    >()

    for (const user of users) {
      if (!user.businessUnitId || !user.businessUnit) continue
      const key = user.businessUnitId
      if (!buMap.has(key)) {
        buMap.set(key, {
          buId: key,
          buName: user.businessUnit.name,
          buCode: user.businessUnit.code,
          total: 0,
          present: 0,
          late: 0,
          onLeave: 0,
          dayOff: 0,
          pending: 0,
          absent: 0,
        })
      }
      const row = buMap.get(key)!
      row.total++
      const status = presenceMap.get(user.id)
      if (status === PresenceStatus.PRESENT) {
        row.present++
        continue
      }
      if (status === PresenceStatus.LATE) {
        row.late++
        continue
      }
      if (status) continue

      if (activeLeaves.some((l) => matchLeaveToUser(l, user))) {
        row.onLeave++
        continue
      }

      const mandate = mandateMap.get(user.id)
      const isNonWorkingDefault = !isRecurringWorkDay(user.workingDays, today) || holiday.isHoliday
      const isWorkDay =
        !!mandate ||
        (!isNonWorkingDefault && (!!user.scheduleGroup || !!user.individualExpectedArrivalTime))
      if (!isWorkDay) {
        row.dayOff++
        continue
      }

      const expectedTime =
        mandate?.expectedArrivalTime ??
        user.scheduleGroup?.expectedArrivalTime ??
        user.individualExpectedArrivalTime ??
        null
      const isNightShift = mandate?.isNightShift ?? user.scheduleGroup?.isNightShift ?? false
      const overdue = expectedTime
        ? this.schedule.isArrivalOverdue(expectedTime, now, isNightShift)
        : true
      if (overdue) row.absent++
      else row.pending++
    }

    return Array.from(buMap.values()).sort((a, b) => a.buName.localeCompare(b.buName))
  }

  async getPeriodReport(requester: Requester, period: 'week' | 'month', dateStr?: string) {
    this.assertAllowed(requester)

    const userWhere = this.buildUserWhere(requester)
    const refDate = parseIsoOrToday(dateStr)
    const { start, end } = period === 'month' ? getMonthRange(refDate) : getIsoWeekRange(refDate)
    const today = getToday()
    const effectiveEnd = end > today ? today : end

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        username: true,
        email: true,
        businessUnitId: true,
        businessUnit: { select: { id: true, name: true, code: true } },
        workingDays: true,
        scheduleGroupId: true,
        individualExpectedArrivalTime: true,
      },
    })

    if (effectiveEnd < start) {
      return { period, from: toIso(start), to: toIso(end), byBu: [], trend: [] }
    }

    const [presences, activeLeaves, mandates, holidays] = await Promise.all([
      this.prisma.presence.findMany({
        where: { date: { gte: start, lte: effectiveEnd }, user: userWhere },
        select: { userId: true, date: true, status: true },
      }),
      this.leaveSync.getActiveLeavesInRange(start, effectiveEnd),
      this.prisma.dailyMandate.findMany({
        where: { date: { gte: start, lte: effectiveEnd }, user: userWhere },
        select: { userId: true, date: true },
      }),
      this.publicHolidays.getHolidaysInRange(start, effectiveEnd),
    ])

    const presenceIndex = new Map<string, PresenceStatus>()
    for (const p of presences) presenceIndex.set(`${p.userId}|${toIso(p.date)}`, p.status)

    const mandateSet = new Set(mandates.map((m) => `${m.userId}|${toIso(m.date)}`))

    const userLeaves = new Map(
      users.map((u) => [u.id, activeLeaves.filter((l) => matchLeaveToUser(l, u))])
    )

    type BuAgg = {
      buId: string
      buName: string
      buCode: string
      workingDays: number
      totalUserDays: number
      present: number
      late: number
      onLeave: number
      absent: number
    }
    const buAggMap = new Map<string, BuAgg>()
    const buWorkingDaySets = new Map<string, Set<string>>()
    const trendMap = new Map<string, Map<string, { present: number; total: number }>>()

    // Un jour ne compte pour un utilisateur que s'il fait partie de son propre motif hebdomadaire
    // récurrent (`workingDays`) — ou qu'un mandat explicite l'affecte ce jour-là, même hors motif ou
    // jour férié (le mandat prime toujours). Un jour hors périmètre de l'utilisateur (repos) n'est
    // ni compté en "absent" ni inclus dans son taux, même principe que les KPI "aujourd'hui"
    // (getSummary/getPresenceByBu, statuts REPOS/dayOff) — mais appliqué jour par jour sur la plage.
    for (let d = new Date(start); d <= effectiveEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = new Date(d)
      const dayIso = toIso(day)
      const isHolidayDay = holidays.has(dayIso)

      for (const user of users) {
        if (!user.businessUnitId || !user.businessUnit) continue

        const hasMandate = mandateSet.has(`${user.id}|${dayIso}`)
        const isNonWorkingDefault = !isRecurringWorkDay(user.workingDays, day) || isHolidayDay
        const hasScheduleSource = !!user.scheduleGroupId || !!user.individualExpectedArrivalTime
        const isWorkDay = hasMandate || (!isNonWorkingDefault && hasScheduleSource)
        if (!isWorkDay) continue

        const buId = user.businessUnitId
        if (!buAggMap.has(buId)) {
          buAggMap.set(buId, {
            buId,
            buName: user.businessUnit.name,
            buCode: user.businessUnit.code,
            workingDays: 0,
            totalUserDays: 0,
            present: 0,
            late: 0,
            onLeave: 0,
            absent: 0,
          })
          buWorkingDaySets.set(buId, new Set())
        }
        const agg = buAggMap.get(buId)!
        buWorkingDaySets.get(buId)!.add(dayIso)
        agg.totalUserDays++

        const status = presenceIndex.get(`${user.id}|${dayIso}`)
        const leavesForUser = userLeaves.get(user.id)
        if (status === PresenceStatus.PRESENT) agg.present++
        else if (status === PresenceStatus.LATE) agg.late++
        else if (leavesForUser?.some((l) => isLeaveActiveOnDay(l, day))) agg.onLeave++
        else agg.absent++

        if (!trendMap.has(dayIso)) trendMap.set(dayIso, new Map())
        const dayTrend = trendMap.get(dayIso)!
        if (!dayTrend.has(user.businessUnit.code)) {
          dayTrend.set(user.businessUnit.code, { present: 0, total: 0 })
        }
        const t = dayTrend.get(user.businessUnit.code)!
        t.total++
        if (status === PresenceStatus.PRESENT || status === PresenceStatus.LATE) t.present++
      }
    }

    // `workingDays` par BU redevient un décompte per-BU (nombre de jours distincts où au moins un
    // utilisateur de cette BU avait ce jour en motif de travail), plutôt qu'un compte global unique
    // désormais dénué de sens puisque chaque utilisateur peut avoir un motif différent.
    for (const [buId, agg] of buAggMap) {
      agg.workingDays = buWorkingDaySets.get(buId)?.size ?? 0
    }

    const byBu = Array.from(buAggMap.values())
      .map((agg) => ({
        ...agg,
        presenceRate:
          agg.totalUserDays > 0
            ? Math.round(((agg.present + agg.late) / agg.totalUserDays) * 100)
            : 0,
      }))
      .sort((a, b) => a.buName.localeCompare(b.buName))

    const trend = Array.from(trendMap.entries()).map(([date, buMap]) => {
      const row: Record<string, string | number> = { date }
      let overallPresent = 0
      let overallTotal = 0
      for (const [buCode, v] of buMap.entries()) {
        row[buCode] = v.total > 0 ? Math.round((v.present / v.total) * 100) : 0
        overallPresent += v.present
        overallTotal += v.total
      }
      row.overall = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0
      return row
    })

    return { period, from: toIso(start), to: toIso(end), byBu, trend }
  }

  async getConnectionsChart(requester: Requester, days = 14) {
    this.assertAllowed(requester)

    const n = Math.min(90, Math.max(7, days))
    const userWhere = this.buildUserWhere(requester)
    const from = getDaysAgo(n - 1)
    const today = getToday()

    const grouped = await this.prisma.connectionLog.groupBy({
      by: ['date'],
      where: {
        date: { gte: from, lte: today },
        type: 'LOGIN',
        user: userWhere,
      },
      _count: { id: true },
      orderBy: { date: 'asc' },
    })

    const countByDay = new Map<string, number>()
    for (let i = n - 1; i >= 0; i--) {
      const key = getDaysAgo(i).toISOString().split('T')[0]
      countByDay.set(key, 0)
    }
    for (const row of grouped) {
      const key = new Date(row.date).toISOString().split('T')[0]
      countByDay.set(key, row._count.id)
    }

    return Array.from(countByDay.entries()).map(([date, connexions]) => ({ date, connexions }))
  }

  async getActivityChart(requester: Requester, days = 30) {
    this.assertAllowed(requester)

    const n = Math.min(90, Math.max(7, days))
    const userWhere = this.buildUserWhere(requester)
    const from = getDaysAgo(n - 1)

    const grouped = await this.prisma.activityLog.groupBy({
      by: ['action'],
      where: {
        occurredAt: { gte: from },
        user: userWhere,
        action: { notIn: [LogAction.LOGIN, LogAction.LOGOUT] },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    })

    return grouped.map((row) => ({ action: row.action, count: row._count.id }))
  }

  async getActivityLog(
    requester: Requester,
    page: number,
    limit: number,
    search?: string,
    action?: string
  ) {
    this.assertAllowed(requester)

    const userWhere = this.buildUserWhere(requester)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { user: userWhere }
    if (action) where.action = action
    if (search) {
      where.user = {
        ...userWhere,
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const [total, logs] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          details: true,
          ipAddress: true,
          userAgent: true,
          occurredAt: true,
          user: { select: { id: true, username: true, fullName: true, role: true } },
        },
      }),
    ])

    return { total, page, limit, pages: Math.ceil(total / limit), logs }
  }
}
