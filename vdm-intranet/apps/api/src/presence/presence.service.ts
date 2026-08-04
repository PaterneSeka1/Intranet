import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PresenceScheduleService } from './presence.schedule.service'
import { FirstLoginDto } from './dto/first-login.dto'
import { LoginLogDto } from './dto/login-log.dto'
import { EndDayDto } from './dto/end-day.dto'
import { CreateMandateDto } from './dto/create-mandate.dto'
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
    private readonly leaveSync: LeaveSyncService
  ) {}

  // ----------------------------------------------------------------
  // Présence du jour — utilisateur courant
  // ----------------------------------------------------------------

  async getTodayPresence(userId: string, role?: Role) {
    const today = getToday()
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
    if (!presence) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, email: true },
      })
      if (user) {
        const activeLeaves = await this.leaveSync.getActiveLeaves(today)
        const leave = activeLeaves.find((l) => matchLeaveToUser(l, user))
        onLeave = this.toLeaveInfo(leave)
      }
    }

    return { presence, scheduleSource, date: today, onLeave }
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

    const [users, presences, mandates, activeLeaves] = await Promise.all([
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
      this.leaveSync.getActiveLeaves(today),
    ])

    for (const presence of presences) this.redactPresenceForRole(presence, requester.role)

    const presenceMap = new Map(presences.map((p) => [p.userId, p]))
    const mandateMap = new Map(mandates.map((m) => [m.userId, m]))

    return users.map((user) => {
      const presence = presenceMap.get(user.id) ?? null
      const mandate = mandateMap.get(user.id) ?? null
      const leave = presence ? undefined : activeLeaves.find((l) => matchLeaveToUser(l, user))

      // Heure attendue : mandat > groupe > individuel
      let expectedArrivalTime: string | null = null
      let scheduleSource = 'none'
      if (mandate) {
        expectedArrivalTime = mandate.expectedArrivalTime
        scheduleSource = 'mandate'
      } else if (user.scheduleGroup) {
        expectedArrivalTime = user.scheduleGroup.expectedArrivalTime
        scheduleSource = 'group'
      } else if (user.individualExpectedArrivalTime) {
        expectedArrivalTime = user.individualExpectedArrivalTime
        scheduleSource = 'individual'
      }

      return {
        user,
        presence,
        status: presence?.status ?? (leave ? 'EN_CONGE' : 'ABSENT'),
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

  async getMandates(requester: Requester, dateStr?: string) {
    const scope = this.buildUserScope(requester)
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
        where: { user: { isActive: true, ...scope }, date: exactDate },
        include,
        orderBy: [{ createdAt: 'desc' }],
      })
    }

    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 30)
    since.setUTCHours(0, 0, 0, 0)
    return this.prisma.dailyMandate.findMany({
      where: { user: { isActive: true, ...scope }, date: { gte: since } },
      include,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    })
  }

  async createMandate(dto: CreateMandateDto, requester: Requester) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, businessUnitId: true, poleId: true, isActive: true },
    })
    if (!target || !target.isActive)
      throw new NotFoundException('Utilisateur introuvable ou inactif')

    if (!this.canMandateUser(requester, target)) {
      throw new ForbiddenException('Vous ne pouvez pas mandater cet utilisateur')
    }

    const date = new Date(dto.date + 'T00:00:00.000Z')

    const mandate = await this.prisma.dailyMandate.upsert({
      where: { userId_date: { userId: dto.userId, date } },
      update: { expectedArrivalTime: dto.expectedArrivalTime, reason: dto.reason },
      create: {
        userId: dto.userId,
        date,
        expectedArrivalTime: dto.expectedArrivalTime,
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

  async deleteMandate(id: string, requester: Requester) {
    const mandate = await this.prisma.dailyMandate.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        createdById: true,
        user: { select: { businessUnitId: true, poleId: true } },
      },
    })
    if (!mandate) throw new NotFoundException('Mandat introuvable')

    const canDelete =
      CAN_VIEW_PRESENCE_GLOBAL.includes(requester.role) ||
      mandate.createdById === requester.id ||
      (CAN_VIEW_PRESENCE_BU_SCOPE.includes(requester.role) &&
        mandate.user.businessUnitId === requester.businessUnitId) ||
      (requester.role === Role.RESPONSABLE_POLE && mandate.user.poleId === requester.poleId)

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
    target: { businessUnitId?: string | null; poleId?: string | null }
  ): boolean {
    if (CAN_VIEW_PRESENCE_GLOBAL.includes(requester.role)) return true
    if (CAN_VIEW_PRESENCE_BU_SCOPE.includes(requester.role) && requester.businessUnitId) {
      return target.businessUnitId === requester.businessUnitId
    }
    if (requester.role === Role.RESPONSABLE_POLE && requester.poleId) {
      return target.poleId === requester.poleId
    }
    return false
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
