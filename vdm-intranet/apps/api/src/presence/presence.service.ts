import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PresenceScheduleService, type ScheduleSource } from './presence.schedule.service'
import { PublicHolidaysService } from '../public-holidays/public-holidays.service'
import { FirstLoginDto } from './dto/first-login.dto'
import { LoginLogDto } from './dto/login-log.dto'
import { EndDayDto } from './dto/end-day.dto'
import { CreateMandateDto } from './dto/create-mandate.dto'
import { BulkCreateMandateDto } from './dto/bulk-create-mandate.dto'
import { CreateScheduleGroupDto } from './dto/create-schedule-group.dto'
import { UpdateScheduleGroupDto } from './dto/update-schedule-group.dto'
import { NotificationType, Role } from '@prisma/client'
import {
  ACCUEIL_ONLY_ROLES,
  CAN_VIEW_PRESENCE_GLOBAL,
  CAN_VIEW_PRESENCE_BU_SCOPE,
} from '../common/permissions'
import { NotificationsService } from '../notifications/notifications.service'
import { LeaveSyncService, type ActiveLeave } from '../leaves/leave-sync.service'
import { matchLeaveToUser, leaveTypeLabel } from '../leaves/leave-match.util'
import { isRecurringWorkDay } from '../common/working-days.util'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

const USER_SUMMARY = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  fullName: true,
  role: true,
  isActive: true,
  businessUnitId: true,
  poleId: true,
  scheduleGroupId: true,
  individualExpectedArrivalTime: true,
  individualExpectedDepartureTime: true,
  workingDays: true,
  businessUnit: { select: { id: true, name: true, code: true } },
  pole: { select: { id: true, name: true, code: true } },
  scheduleGroup: {
    select: {
      id: true,
      name: true,
      expectedArrivalTime: true,
      expectedDepartureTime: true,
      isNightShift: true,
    },
  },
} as const

function getToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function buildMapsUrl(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null
  return `https://maps.google.com/?q=${lat},${lng}`
}

type LeaveInfo = { typeLabel: string; startDate: string; endDate: string } | null

// Statuts calculés à la volée, jamais persistés en DB (même principe que EN_CONGE) :
// REPOS = pas le jour de travail de l'employé (week-end/férié sans mandat, ou aucun planning
// défini) ; EN_ATTENTE = jour de travail mais heure attendue pas encore dépassée.
type SyntheticStatus = 'EN_CONGE' | 'REPOS' | 'EN_ATTENTE' | 'ABSENT'

type GeolocatedPresence = {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  address: string | null
  mapsUrl: string | null
  departureLatitude?: number | null
  departureLongitude?: number | null
  departureAccuracy?: number | null
  departureAddress?: string | null
  departureMapsUrl?: string | null
}

@Injectable()
export class PresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: PresenceScheduleService,
    private readonly notifications: NotificationsService,
    private readonly leaveSync: LeaveSyncService,
    private readonly publicHolidays: PublicHolidaysService
  ) {}

  // ----------------------------------------------------------------
  // Présence du jour — utilisateur courant
  // ----------------------------------------------------------------

  async getTodayPresence(userId: string, role?: Role) {
    const today = getToday()
    const now = new Date()
    const presence = await this.prisma.presence.findUnique({
      where: { userId_date: { userId, date: today } },
    })
    const scheduleSource = await this.schedule.getScheduleSource(userId, today)

    if (presence && !presence.expectedDepartureTime) {
      const departureSource = await this.schedule.getDepartureScheduleSource(userId, today)
      presence.expectedDepartureTime = departureSource?.time ?? null
    }

    if (presence) this.redactPresenceForRole(presence, role)

    let onLeave: LeaveInfo = null
    let computedStatus: SyntheticStatus | null = null
    if (!presence) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, email: true, workingDays: true },
      })
      if (user) {
        const activeLeaves = await this.leaveSync.getActiveLeaves(today)
        const leave = activeLeaves.find((l) => matchLeaveToUser(l, user))
        onLeave = this.toLeaveInfo(leave)
      }
      const isNonWorkingDefault = await this.isNonWorkingDay(today, user?.workingDays)
      computedStatus = this.computeAbsenceStatus({
        scheduleSource,
        isNonWorkingDefault,
        onLeave: !!onLeave,
        now,
      })
    }

    return {
      presence,
      scheduleSource,
      date: today,
      onLeave,
      status: presence?.status ?? computedStatus,
    }
  }

  // ----------------------------------------------------------------
  // Présences du jour — périmètre selon rôle
  // ----------------------------------------------------------------

  async getTodayAllPresences(requester: Requester, dateStr?: string) {
    let today: Date
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number)
      const parsed = new Date(Date.UTC(y, m - 1, d))
      today = isNaN(parsed.getTime()) ? getToday() : parsed
    } else {
      today = getToday()
    }
    const scope = this.buildUserScope(requester)
    const realToday = getToday()
    const now = new Date()
    // La date consultée peut être passée/future (navigation par date sur /presences) : le calcul
    // "pas encore arrivé" ne vaut que pour aujourd'hui, cf. computeAbsenceStatus/overdueOverride.
    const isPastDate = today.getTime() < realToday.getTime()
    const isFutureDate = today.getTime() > realToday.getTime()

    const [users, presences, mandates, holiday, activeLeaves] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true, ...scope },
        select: USER_SUMMARY,
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      }),
      this.prisma.presence.findMany({
        where: { date: today, user: { isActive: true, ...scope } },
      }),
      this.prisma.dailyMandate.findMany({
        where: { date: today, user: { isActive: true, ...scope } },
      }),
      this.publicHolidays.isHoliday(today),
      this.leaveSync.getActiveLeaves(today),
    ])

    for (const presence of presences) this.redactPresenceForRole(presence, requester.role)

    const presenceMap = new Map(presences.map((p) => [p.userId, p]))
    const mandateMap = new Map(mandates.map((m) => [m.userId, m]))

    return users.map((user) => {
      const presence = presenceMap.get(user.id) ?? null
      const mandate = mandateMap.get(user.id) ?? null
      const leave = presence ? undefined : activeLeaves.find((l) => matchLeaveToUser(l, user))
      const isNonWorkingDefault = !isRecurringWorkDay(user.workingDays, today) || holiday.isHoliday

      // Heure attendue : mandat > groupe > individuel
      let expectedArrivalTime: string | null = null
      let scheduleSource: ScheduleSource['source'] = 'none'
      let isNightShift = false
      if (mandate) {
        expectedArrivalTime = mandate.expectedArrivalTime
        scheduleSource = 'mandate'
        isNightShift = mandate.isNightShift ?? user.scheduleGroup?.isNightShift ?? false
      } else if (user.scheduleGroup) {
        expectedArrivalTime = user.scheduleGroup.expectedArrivalTime
        scheduleSource = 'group'
        isNightShift = user.scheduleGroup.isNightShift
      } else if (user.individualExpectedArrivalTime) {
        expectedArrivalTime = user.individualExpectedArrivalTime
        scheduleSource = 'individual'
      }

      const status =
        presence?.status ??
        this.computeAbsenceStatus({
          scheduleSource: { source: scheduleSource, time: expectedArrivalTime, isNightShift },
          isNonWorkingDefault,
          onLeave: !!leave,
          now,
          overdueOverride: isPastDate ? true : isFutureDate ? false : undefined,
        })

      return {
        user,
        presence,
        status,
        leave: this.toLeaveInfo(leave),
        expectedArrivalTime: presence?.expectedArrivalTime ?? expectedArrivalTime,
        scheduleSource,
      }
    })
  }

  // ----------------------------------------------------------------
  // Première connexion du jour (géolocalisation obligatoire)
  // ----------------------------------------------------------------

  async processFirstLogin(userId: string, dto: FirstLoginDto, ipAddress: string, role?: Role) {
    if (dto.latitude == null || dto.longitude == null) {
      throw new BadRequestException('latitude et longitude sont obligatoires')
    }

    const today = getToday()
    const now = new Date()

    // Calculer le groupe horaire hors transaction (lecture seule, non critique)
    const { time: expectedTime, isNightShift } = await this.schedule.getScheduleSource(
      userId,
      today
    )
    const { time: expectedDepartureTime } = await this.schedule.getDepartureScheduleSource(
      userId,
      today
    )

    // mapsUrl toujours construit côté serveur — jamais depuis le client
    const mapsUrl = buildMapsUrl(dto.latitude, dto.longitude)

    const connectionLogData = {
      userId,
      type: 'LOGIN' as const,
      date: today,
      connectedAt: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
      address: dto.address,
      mapsUrl,
      userAgent: dto.userAgent,
      ipAddress,
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.presence.findUnique({
          where: { userId_date: { userId, date: today } },
        })

        if (existing) {
          await tx.connectionLog.create({
            data: { ...connectionLogData, isFirstConnectionOfDay: false },
          })
          return this.redactPresenceForRole(existing, role)
        }

        const { status, delayMinutes } = expectedTime
          ? this.schedule.calculatePresenceStatus(expectedTime, now, isNightShift)
          : { status: 'PRESENT' as const, delayMinutes: null }

        const logEntry = await tx.connectionLog.create({
          data: { ...connectionLogData, isFirstConnectionOfDay: true },
        })

        const presence = await tx.presence.create({
          data: {
            userId,
            date: today,
            status,
            expectedArrivalTime: expectedTime ?? '--:--',
            expectedDepartureTime: expectedDepartureTime,
            officialArrivalTime: now,
            delayMinutes,
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracy: dto.accuracy,
            address: dto.address,
            mapsUrl,
            sourceConnectionLogId: logEntry.id,
          },
        })

        this.redactPresenceForRole(presence, role)

        await tx.activityLog.create({
          data: {
            userId,
            action: 'GEOLOCATION',
            entity: 'Presence',
            entityId: presence.id,
            ipAddress,
            details: { source: 'first-login' },
          },
        })

        return presence
      })
    } catch (err: unknown) {
      if (!isPrismaCode(err, 'P2002')) throw err

      const existing = await this.prisma.presence.findUnique({
        where: { userId_date: { userId, date: today } },
      })
      if (!existing) throw err

      await this.prisma.connectionLog.create({
        data: { ...connectionLogData, isFirstConnectionOfDay: false },
      })

      return this.redactPresenceForRole(existing, role)
    }
  }

  // ----------------------------------------------------------------
  // Connexion suivante (géolocalisation optionnelle)
  // ----------------------------------------------------------------

  async recordLoginLog(userId: string, dto: LoginLogDto, ipAddress: string) {
    const today = getToday()
    const now = new Date()

    const isFirst = !(await this.prisma.connectionLog.findFirst({
      where: { userId, date: today, type: 'LOGIN' },
    }))

    const log = await this.createConnectionLog(userId, 'LOGIN', today, now, dto, ipAddress, isFirst)

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'LOGIN',
        entity: 'ConnectionLog',
        entityId: log.id,
        ipAddress,
        details: { isFirst },
      },
    })

    return { id: log.id }
  }

  // ----------------------------------------------------------------
  // Déconnexion
  // ----------------------------------------------------------------

  async recordLogoutLog(userId: string, dto: LoginLogDto, ipAddress: string) {
    const today = getToday()
    const now = new Date()
    // mapsUrl toujours construit côté serveur — jamais depuis le client
    const mapsUrl = buildMapsUrl(dto.latitude, dto.longitude)

    const log = await this.prisma.connectionLog.create({
      data: {
        userId,
        type: 'LOGOUT',
        date: today,
        connectedAt: now,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        address: dto.address,
        mapsUrl,
        userAgent: dto.userAgent,
        ipAddress,
        isFirstConnectionOfDay: false,
      },
    })

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        entity: 'ConnectionLog',
        entityId: log.id,
        ipAddress,
      },
    })

    return { id: log.id }
  }

  // ----------------------------------------------------------------
  // Fin de journée — utilisateur courant
  // ----------------------------------------------------------------

  async processEndDay(userId: string, dto: EndDayDto, ipAddress: string, role?: Role) {
    const today = getToday()
    const now = new Date()

    const presence = await this.prisma.presence.findUnique({
      where: { userId_date: { userId, date: today } },
    })
    if (!presence) {
      throw new BadRequestException(
        "Aucune arrivée enregistrée aujourd'hui — impossible de marquer un départ."
      )
    }
    if (presence.officialDepartureTime) {
      throw new BadRequestException("Départ déjà enregistré pour aujourd'hui.")
    }

    const { time: expectedTime, isNightShift } = await this.schedule.getDepartureScheduleSource(
      userId,
      today
    )
    const departureDelayMinutes = expectedTime
      ? this.schedule.calculateDepartureDelayMinutes(expectedTime, now, isNightShift)
      : null

    // mapsUrl toujours construit côté serveur — jamais depuis le client
    const mapsUrl = buildMapsUrl(dto.latitude, dto.longitude)

    return this.prisma.$transaction(async (tx) => {
      const logEntry = await tx.connectionLog.create({
        data: {
          userId,
          type: 'LOGOUT',
          date: today,
          connectedAt: now,
          disconnectedAt: now,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracy: dto.accuracy,
          address: dto.address,
          mapsUrl,
          userAgent: dto.userAgent,
          ipAddress,
          isFirstConnectionOfDay: false,
        },
      })

      const result = await tx.presence.updateMany({
        where: { id: presence.id, officialDepartureTime: null },
        data: {
          expectedDepartureTime: expectedTime,
          officialDepartureTime: now,
          departureDelayMinutes,
          departureLatitude: dto.latitude,
          departureLongitude: dto.longitude,
          departureAccuracy: dto.accuracy,
          departureAddress: dto.address,
          departureMapsUrl: mapsUrl,
        },
      })

      if (result.count === 0) {
        throw new BadRequestException("Départ déjà enregistré pour aujourd'hui.")
      }

      const updated = await tx.presence.findUniqueOrThrow({ where: { id: presence.id } })
      this.redactPresenceForRole(updated, role)

      await tx.activityLog.create({
        data: {
          userId,
          action: 'DAY_ENDED',
          entity: 'Presence',
          entityId: updated.id,
          ipAddress,
          details: { sourceConnectionLogId: logEntry.id },
        },
      })

      return updated
    })
  }

  // ----------------------------------------------------------------
  // Groupes horaires
  // ----------------------------------------------------------------

  getScheduleGroups() {
    return this.prisma.scheduleGroup.findMany({
      include: {
        businessUnit: { select: { id: true, name: true, code: true } },
        pole: { select: { id: true, name: true, code: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  createScheduleGroup(dto: CreateScheduleGroupDto, createdById: string) {
    return this.prisma.scheduleGroup
      .create({
        data: dto,
      })
      .then(async (group) => {
        await this.prisma.activityLog.create({
          data: {
            userId: createdById,
            action: 'SCHEDULE_GROUP_CREATED',
            entity: 'ScheduleGroup',
            entityId: group.id,
            details: dto as object,
          },
        })
        return group
      })
  }

  async updateScheduleGroup(id: string, dto: UpdateScheduleGroupDto, updatedById: string) {
    const group = await this.prisma.scheduleGroup.findUnique({ where: { id } })
    if (!group) throw new NotFoundException('Groupe horaire introuvable')

    try {
      const updated = await this.prisma.scheduleGroup.update({ where: { id }, data: dto })
      await this.prisma.activityLog.create({
        data: {
          userId: updatedById,
          action: 'SCHEDULE_GROUP_UPDATED',
          entity: 'ScheduleGroup',
          entityId: id,
          details: dto as object,
        },
      })
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Groupe horaire introuvable')
      throw err
    }
  }

  async deleteScheduleGroup(id: string, deletedById: string) {
    const group = await this.prisma.scheduleGroup.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!group) throw new NotFoundException('Groupe horaire introuvable')
    if (group._count.users > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : ${group._count.users} utilisateur(s) assigné(s).`
      )
    }

    try {
      await this.prisma.scheduleGroup.delete({ where: { id } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Groupe horaire introuvable')
      throw err
    }
    await this.prisma.activityLog.create({
      data: {
        userId: deletedById,
        action: 'SCHEDULE_GROUP_DELETED',
        entity: 'ScheduleGroup',
        entityId: id,
        details: { name: group.name } as object,
      },
    })
    return { deleted: true }
  }

  // ----------------------------------------------------------------
  // Historique de connexions — utilisateur courant
  // ----------------------------------------------------------------

  async getMyConnections(userId: string, limit = 50, role?: Role) {
    const logs = await this.prisma.connectionLog.findMany({
      where: { userId },
      orderBy: { connectedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        date: true,
        connectedAt: true,
        disconnectedAt: true,
        address: true,
        mapsUrl: true,
        ipAddress: true,
        userAgent: true,
        isFirstConnectionOfDay: true,
      },
    })

    if (role && ACCUEIL_ONLY_ROLES.includes(role)) {
      for (const log of logs) {
        log.address = null
        log.mapsUrl = null
        log.ipAddress = null
      }
    }

    return logs
  }

  // ----------------------------------------------------------------
  // Mandats
  // ----------------------------------------------------------------

  async getMandates(
    requester: Requester,
    params: { date?: string; from?: string; to?: string; userId?: string } = {}
  ) {
    const { date: dateStr, from, to, userId } = params
    const scope = this.buildUserScope(requester)
    // Le filtre userId s'applique en AND du scope (jamais en remplacement) : un responsable ne
    // doit jamais pouvoir élargir son périmètre de lecture en passant l'id d'un tiers en query.
    const userWhere: Record<string, unknown> = userId
      ? { isActive: true, AND: [scope, { id: userId }] }
      : { isActive: true, ...scope }

    const include = {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          businessUnit: { select: { name: true } },
        },
      },
      createdBy: { select: { id: true, username: true, fullName: true } },
    } as const

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number)
      const exactDate = new Date(Date.UTC(y, m - 1, d))
      return this.prisma.dailyMandate.findMany({
        where: { user: userWhere, date: exactDate },
        include,
        orderBy: [{ createdAt: 'desc' }],
      })
    }

    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const [fy, fm, fd] = from.split('-').map(Number)
      const [ty, tm, td] = to.split('-').map(Number)
      return this.prisma.dailyMandate.findMany({
        where: {
          user: userWhere,
          date: {
            gte: new Date(Date.UTC(fy, fm - 1, fd)),
            lte: new Date(Date.UTC(ty, tm - 1, td)),
          },
        },
        include,
        orderBy: [{ date: 'asc' }],
      })
    }

    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 30)
    since.setUTCHours(0, 0, 0, 0)
    return this.prisma.dailyMandate.findMany({
      where: { user: userWhere, date: { gte: since } },
      include,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    })
  }

  async createMandate(dto: CreateMandateDto, requester: Requester) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, role: true, businessUnitId: true, poleId: true, isActive: true },
    })
    if (!target || !target.isActive)
      throw new NotFoundException('Utilisateur introuvable ou inactif')

    if (!this.canMandateUser(requester, target)) {
      throw new ForbiddenException('Vous ne pouvez pas mandater cet utilisateur')
    }

    const date = new Date(dto.date + 'T00:00:00.000Z')

    const mandate = await this.prisma.dailyMandate.upsert({
      where: { userId_date: { userId: dto.userId, date } },
      update: {
        expectedArrivalTime: dto.expectedArrivalTime,
        expectedDepartureTime: dto.expectedDepartureTime,
        isNightShift: dto.isNightShift,
        reason: dto.reason,
      },
      create: {
        userId: dto.userId,
        date,
        expectedArrivalTime: dto.expectedArrivalTime,
        expectedDepartureTime: dto.expectedDepartureTime,
        isNightShift: dto.isNightShift,
        reason: dto.reason,
        createdById: requester.id,
      },
    })

    await this.prisma.activityLog.create({
      data: {
        userId: requester.id,
        action: 'CREATE',
        entity: 'DailyMandate',
        entityId: mandate.id,
        details: dto as object,
      },
    })

    await this.notifications.notifyUser(target.id, {
      type: NotificationType.MANDATE_ASSIGNED,
      title: 'Nouveau mandat de présence',
      body: `Heure d'arrivée attendue le ${dto.date} : ${dto.expectedArrivalTime}`,
      link: '/presences',
    })

    return mandate
  }

  /**
   * Crée/met à jour en masse les mandats d'UN employé sur plusieurs dates (ex: peindre un mois
   * entier de rotation jour/nuit/week-end depuis le calendrier de planification). Chaque jour est
   * upserté sur [userId, date] : rejouer ce payload sur un mois déjà partiellement rempli remplace
   * les mandats existants aux dates concernées, sans erreur de contrainte unique. Le tout est posé
   * dans une seule transaction SQL : soit tous les jours sont enregistrés, soit aucun.
   */
  async bulkCreateMandates(dto: BulkCreateMandateDto, requester: Requester) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, role: true, businessUnitId: true, poleId: true, isActive: true },
    })
    if (!target || !target.isActive)
      throw new NotFoundException('Utilisateur introuvable ou inactif')

    if (!this.canMandateUser(requester, target)) {
      throw new ForbiddenException('Vous ne pouvez pas mandater cet utilisateur')
    }

    const dates = dto.days.map((d) => d.date)
    if (new Set(dates).size !== dates.length) {
      throw new BadRequestException('Le payload contient des dates en double.')
    }

    const mandates = await this.prisma.$transaction(
      dto.days.map((day) => {
        const date = new Date(day.date + 'T00:00:00.000Z')
        return this.prisma.dailyMandate.upsert({
          where: { userId_date: { userId: dto.userId, date } },
          update: {
            expectedArrivalTime: day.expectedArrivalTime,
            expectedDepartureTime: day.expectedDepartureTime,
            isNightShift: day.isNightShift,
            reason: day.reason,
          },
          create: {
            userId: dto.userId,
            date,
            expectedArrivalTime: day.expectedArrivalTime,
            expectedDepartureTime: day.expectedDepartureTime,
            isNightShift: day.isNightShift,
            reason: day.reason,
            createdById: requester.id,
          },
        })
      })
    )

    await this.prisma.activityLog.create({
      data: {
        userId: requester.id,
        action: 'CREATE',
        entity: 'DailyMandate',
        entityId: target.id,
        details: { bulk: true, count: mandates.length, dates } as object,
      },
    })

    await this.notifications.notifyUser(target.id, {
      type: NotificationType.MANDATE_ASSIGNED,
      title: 'Planning mensuel mis à jour',
      body: `${mandates.length} jour(s) planifié(s) ou modifié(s).`,
      link: '/presences',
    })

    return mandates
  }

  async deleteMandate(id: string, requester: Requester) {
    const mandate = await this.prisma.dailyMandate.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        createdById: true,
        user: { select: { role: true, businessUnitId: true, poleId: true } },
      },
    })
    if (!mandate) throw new NotFoundException('Mandat introuvable')

    // Le repli « créateur du mandat » ne doit jamais permettre de contourner la règle d'auto-mandat
    // (ex. mandat créé avant l'introduction de cette règle) : elle est donc appliquée en tête,
    // avant même de considérer `createdById`.
    const canDelete =
      !(requester.id === mandate.userId && requester.role !== Role.PDG) &&
      (this.canMandateUser(requester, { ...mandate.user, id: mandate.userId }) ||
        mandate.createdById === requester.id)

    if (!canDelete) throw new ForbiddenException('Vous ne pouvez pas supprimer ce mandat')

    try {
      await this.prisma.dailyMandate.delete({ where: { id } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Mandat introuvable')
      throw err
    }
    await this.prisma.activityLog.create({
      data: {
        userId: requester.id,
        action: 'DELETE',
        entity: 'DailyMandate',
        entityId: id,
        details: {},
      },
    })
    return { deleted: true }
  }

  // ----------------------------------------------------------------
  // Helpers privés
  // ----------------------------------------------------------------

  private async createConnectionLog(
    userId: string,
    type: 'LOGIN' | 'LOGOUT',
    date: Date,
    connectedAt: Date,
    dto: Pick<LoginLogDto, 'latitude' | 'longitude' | 'accuracy' | 'address' | 'userAgent'>,
    ipAddress: string,
    isFirstConnectionOfDay: boolean
  ) {
    // mapsUrl toujours construit côté serveur — jamais depuis le client
    const mapsUrl = buildMapsUrl(dto.latitude, dto.longitude)
    return this.prisma.connectionLog.create({
      data: {
        userId,
        type,
        date,
        connectedAt,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
        address: dto.address,
        mapsUrl,
        userAgent: dto.userAgent,
        ipAddress,
        isFirstConnectionOfDay,
      },
    })
  }

  private buildUserScope(requester: Requester): Record<string, unknown> {
    if (CAN_VIEW_PRESENCE_GLOBAL.includes(requester.role)) return {}
    // La DAF voit les présences de tous les employés sans exception, quelle que soit leur BU
    // (cohérent avec le même carve-out déjà appliqué aux exports de présence, cf. reports.service.ts).
    if (requester.role === Role.DAF) return {}
    if (CAN_VIEW_PRESENCE_BU_SCOPE.includes(requester.role) && requester.businessUnitId) {
      return { businessUnitId: requester.businessUnitId }
    }
    if (requester.role === Role.RESPONSABLE_POLE && requester.poleId) {
      return { poleId: requester.poleId }
    }
    return { id: requester.id }
  }

  private canMandateUser(
    requester: Requester,
    target: { id: string; role: Role; businessUnitId?: string | null; poleId?: string | null }
  ): boolean {
    // Le CTO_ADMIN a une portée globale (CAN_VIEW_PRESENCE_GLOBAL) et peut donc gérer l'emploi du
    // temps de tout employé, y compris celui du PDG.
    //
    // Un responsable (CTO_ADMIN, DAF, RESPONSABLE_BU, RESPONSABLE_POLE) ne doit jamais définir
    // lui-même son propre planning — seul le PDG, au sommet de la hiérarchie et sans supérieur
    // pour le mandater, peut se mandater lui-même. Vérifiée avant les règles de portée pour ne
    // jamais être contournée.
    if (requester.id === target.id && requester.role !== Role.PDG) return false

    if (CAN_VIEW_PRESENCE_GLOBAL.includes(requester.role)) return true
    if (CAN_VIEW_PRESENCE_BU_SCOPE.includes(requester.role) && requester.businessUnitId) {
      return target.businessUnitId === requester.businessUnitId
    }
    if (requester.role === Role.RESPONSABLE_POLE && requester.poleId) {
      return target.poleId === requester.poleId
    }
    return false
  }

  /**
   * Statut "aujourd'hui" quand aucune Presence n'a été enregistrée. Un employé n'est jamais
   * ABSENT tant que (1) c'est réellement son jour de travail ET (2) son heure d'arrivée attendue
   * (+ tolérance) est dépassée. `overdueOverride` permet à l'appelant de trancher (1) directement
   * pour une date passée (journée forcément terminée → true) ou future (jamais encore due → false)
   * sans reproduire le calcul horaire, qui n'a de sens que pour la date du jour réel.
   */
  private computeAbsenceStatus(params: {
    scheduleSource: Pick<ScheduleSource, 'source' | 'time' | 'isNightShift'>
    isNonWorkingDefault: boolean
    onLeave: boolean
    now: Date
    overdueOverride?: boolean
  }): SyntheticStatus {
    const { scheduleSource, isNonWorkingDefault, onLeave, now, overdueOverride } = params
    if (onLeave) return 'EN_CONGE'

    // Un mandat est une affectation explicite : il prime toujours sur le week-end/férié par défaut.
    const isWorkDay =
      scheduleSource.source === 'mandate' ||
      (scheduleSource.source !== 'none' && !isNonWorkingDefault)
    if (!isWorkDay) return 'REPOS'

    const overdue =
      overdueOverride !== undefined
        ? overdueOverride
        : scheduleSource.time
          ? this.schedule.isArrivalOverdue(scheduleSource.time, now, scheduleSource.isNightShift)
          : true

    return overdue ? 'ABSENT' : 'EN_ATTENTE'
  }

  private async isNonWorkingDay(date: Date, workingDays?: number[] | null): Promise<boolean> {
    if (!isRecurringWorkDay(workingDays, date)) return true
    const { isHoliday } = await this.publicHolidays.isHoliday(date)
    return isHoliday
  }

  private toLeaveInfo(leave?: ActiveLeave): LeaveInfo {
    if (!leave) return null
    return {
      typeLabel: leaveTypeLabel(leave.type),
      startDate: leave.startDate,
      endDate: leave.endDate,
    }
  }

  private redactPresenceForRole<T extends GeolocatedPresence>(presence: T, role?: Role): T {
    if (!role || !ACCUEIL_ONLY_ROLES.includes(role)) return presence

    presence.latitude = null
    presence.longitude = null
    presence.accuracy = null
    presence.address = null
    presence.mapsUrl = null
    presence.departureLatitude = null
    presence.departureLongitude = null
    presence.departureAccuracy = null
    presence.departureAddress = null
    presence.departureMapsUrl = null

    return presence
  }
}

function isPrismaCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === code
  )
}
