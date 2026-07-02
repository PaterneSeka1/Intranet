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
import { CreateMandateDto } from './dto/create-mandate.dto'
import { CreateScheduleGroupDto } from './dto/create-schedule-group.dto'
import { UpdateScheduleGroupDto } from './dto/update-schedule-group.dto'

type Requester = {
  id: string
  role: string
  businessUnitId?: string | null
  poleId?: string | null
}

const USER_SUMMARY = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  fullName: true,
  role: true,
  isActive: true,
  businessUnitId: true,
  poleId: true,
  scheduleGroupId: true,
  individualExpectedArrivalTime: true,
  businessUnit: { select: { id: true, name: true, code: true } },
  pole: { select: { id: true, name: true, code: true } },
  scheduleGroup: { select: { id: true, name: true, expectedArrivalTime: true, isNightShift: true } },
} as const

function getToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function buildMapsUrl(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null
  return `https://maps.google.com/?q=${lat},${lng}`
}

@Injectable()
export class PresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: PresenceScheduleService,
  ) {}

  // ----------------------------------------------------------------
  // Présence du jour — utilisateur courant
  // ----------------------------------------------------------------

  async getTodayPresence(userId: string) {
    const today = getToday()
    const presence = await this.prisma.presence.findUnique({
      where: { userId_date: { userId, date: today } },
    })
    const scheduleSource = await this.schedule.getScheduleSource(userId, today)

    return { presence, scheduleSource, date: today }
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

    const [users, presences, mandates] = await Promise.all([
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
    ])

    const presenceMap = new Map(presences.map((p) => [p.userId, p]))
    const mandateMap = new Map(mandates.map((m) => [m.userId, m]))

    return users.map((user) => {
      const presence = presenceMap.get(user.id) ?? null
      const mandate = mandateMap.get(user.id) ?? null

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
        status: presence?.status ?? 'ABSENT',
        expectedArrivalTime: presence?.expectedArrivalTime ?? expectedArrivalTime,
        scheduleSource,
      }
    })
  }

  // ----------------------------------------------------------------
  // Première connexion du jour (géolocalisation obligatoire)
  // ----------------------------------------------------------------

  async processFirstLogin(userId: string, dto: FirstLoginDto, ipAddress: string) {
    if (dto.latitude == null || dto.longitude == null) {
      throw new BadRequestException('latitude et longitude sont obligatoires')
    }

    const today = getToday()
    const now = new Date()

    // Si une présence existe déjà → retourner sans la modifier
    const existing = await this.prisma.presence.findUnique({
      where: { userId_date: { userId, date: today } },
    })
    if (existing) {
      await this.createConnectionLog(userId, 'LOGIN', today, now, dto, ipAddress, false)
      return existing
    }

    const { time: expectedTime, isNightShift } = await this.schedule.getScheduleSource(userId, today)
    const { status, delayMinutes } = expectedTime
      ? this.schedule.calculatePresenceStatus(expectedTime, now, isNightShift)
      : { status: 'PRESENT' as const, delayMinutes: null }

    const mapsUrl = dto.mapsUrl ?? buildMapsUrl(dto.latitude, dto.longitude)

    // Créer le ConnectionLog en premier pour avoir l'ID source
    const logEntry = await this.createConnectionLog(userId, 'LOGIN', today, now, dto, ipAddress, true)

    const presence = await this.prisma.presence.create({
      data: {
        userId,
        date: today,
        status,
        expectedArrivalTime: expectedTime ?? '--:--',
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

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'GEOLOCATION',
        entity: 'Presence',
        entityId: presence.id,
        ipAddress,
        details: { status, expectedArrivalTime: expectedTime, delayMinutes, source: 'first-login' },
      },
    })

    return presence
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

    return log
  }

  // ----------------------------------------------------------------
  // Déconnexion
  // ----------------------------------------------------------------

  async recordLogoutLog(userId: string, dto: LoginLogDto, ipAddress: string) {
    const today = getToday()
    const now = new Date()
    const mapsUrl = dto.mapsUrl ?? buildMapsUrl(dto.latitude, dto.longitude)

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

    return log
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
    return this.prisma.scheduleGroup.create({
      data: dto,
    }).then(async (group) => {
      await this.prisma.activityLog.create({
        data: { userId: createdById, action: 'CREATE', entity: 'ScheduleGroup', entityId: group.id, details: dto as object },
      })
      return group
    })
  }

  async updateScheduleGroup(id: string, dto: UpdateScheduleGroupDto, updatedById: string) {
    const group = await this.prisma.scheduleGroup.findUnique({ where: { id } })
    if (!group) throw new NotFoundException('Groupe horaire introuvable')

    const updated = await this.prisma.scheduleGroup.update({ where: { id }, data: dto })

    await this.prisma.activityLog.create({
      data: { userId: updatedById, action: 'UPDATE', entity: 'ScheduleGroup', entityId: id, details: dto as object },
    })

    return updated
  }

  async deleteScheduleGroup(id: string, deletedById: string) {
    const group = await this.prisma.scheduleGroup.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })
    if (!group) throw new NotFoundException('Groupe horaire introuvable')
    if (group._count.users > 0) {
      throw new BadRequestException(`Impossible de supprimer : ${group._count.users} utilisateur(s) assigné(s).`)
    }

    await this.prisma.scheduleGroup.delete({ where: { id } })
    await this.prisma.activityLog.create({
      data: { userId: deletedById, action: 'DELETE', entity: 'ScheduleGroup', entityId: id, details: { name: group.name } as object },
    })
    return { deleted: true }
  }

  // ----------------------------------------------------------------
  // Historique de connexions — utilisateur courant
  // ----------------------------------------------------------------

  getMyConnections(userId: string, limit = 50) {
    return this.prisma.connectionLog.findMany({
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
        isFirstConnectionOfDay: true,
      },
    })
  }

  // ----------------------------------------------------------------
  // Mandats
  // ----------------------------------------------------------------

  async getMandates(requester: Requester) {
    const scope = this.buildUserScope(requester)
    return this.prisma.dailyMandate.findMany({
      where: { user: { isActive: true, ...scope } },
      include: {
        user: { select: { id: true, username: true, fullName: true, role: true, businessUnit: { select: { name: true } } } },
        createdBy: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async createMandate(dto: CreateMandateDto, requester: Requester) {
    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, businessUnitId: true, poleId: true, isActive: true },
    })
    if (!target || !target.isActive) throw new NotFoundException('Utilisateur introuvable ou inactif')

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

    return mandate
  }

  async deleteMandate(id: string, requester: Requester) {
    const mandate = await this.prisma.dailyMandate.findUnique({
      where: { id },
      select: { id: true, userId: true, createdById: true, user: { select: { businessUnitId: true, poleId: true } } },
    })
    if (!mandate) throw new NotFoundException('Mandat introuvable')

    const canDelete =
      requester.role === 'CTO_ADMIN' ||
      mandate.createdById === requester.id ||
      (requester.role === 'RESPONSABLE_BU' && mandate.user.businessUnitId === requester.businessUnitId) ||
      (requester.role === 'RESPONSABLE_POLE' && mandate.user.poleId === requester.poleId)

    if (!canDelete) throw new ForbiddenException('Vous ne pouvez pas supprimer ce mandat')

    await this.prisma.dailyMandate.delete({ where: { id } })
    await this.prisma.activityLog.create({
      data: { userId: requester.id, action: 'DELETE', entity: 'DailyMandate', entityId: id, details: {} },
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
    dto: Pick<LoginLogDto, 'latitude' | 'longitude' | 'accuracy' | 'address' | 'mapsUrl' | 'userAgent'>,
    ipAddress: string,
    isFirstConnectionOfDay: boolean,
  ) {
    const mapsUrl = dto.mapsUrl ?? buildMapsUrl(dto.latitude, dto.longitude)
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
    if (['CTO_ADMIN', 'PDG', 'DAF'].includes(requester.role)) return {}
    if (requester.role === 'RESPONSABLE_BU' && requester.businessUnitId) {
      return { businessUnitId: requester.businessUnitId }
    }
    if (requester.role === 'RESPONSABLE_POLE' && requester.poleId) {
      return { poleId: requester.poleId }
    }
    return { id: requester.id }
  }

  private canMandateUser(
    requester: Requester,
    target: { businessUnitId?: string | null; poleId?: string | null },
  ): boolean {
    if (requester.role === 'CTO_ADMIN') return true
    if (requester.role === 'RESPONSABLE_BU' && requester.businessUnitId) {
      return target.businessUnitId === requester.businessUnitId
    }
    if (requester.role === 'RESPONSABLE_POLE' && requester.poleId) {
      return target.poleId === requester.poleId
    }
    return false
  }

  async hasPresenceToday(userId: string): Promise<boolean> {
    const today = getToday()
    const p = await this.prisma.presence.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { id: true },
    })
    return p !== null
  }
}
