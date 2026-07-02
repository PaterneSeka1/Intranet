import { ForbiddenException, Injectable } from '@nestjs/common'
import { LogAction, PresenceStatus, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

const ALLOWED_ROLES: Role[] = [
  Role.CTO_ADMIN, Role.PDG, Role.DAF,
  Role.RESPONSABLE_BU, Role.RESPONSABLE_POLE,
]

const GLOBAL_ROLES: Role[] = [Role.CTO_ADMIN, Role.PDG, Role.DAF]

function getToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function getDaysAgo(n: number): Date {
  const d = getToday()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

@Injectable()
export class PilotageService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAllowed(requester: Requester) {
    if (!ALLOWED_ROLES.includes(requester.role)) {
      throw new ForbiddenException('Accès réservé aux responsables.')
    }
  }

  private buildUserWhere(requester: Requester): object {
    const base = { isActive: true }
    if (GLOBAL_ROLES.includes(requester.role)) return base
    if (requester.role === Role.RESPONSABLE_BU) return { ...base, businessUnitId: requester.businessUnitId }
    if (requester.role === Role.RESPONSABLE_POLE) return { ...base, poleId: requester.poleId }
    return base
  }

  async getSummary(requester: Requester) {
    this.assertAllowed(requester)

    const today = getToday()
    const userWhere = this.buildUserWhere(requester)

    const [totalActive, presences, mandates] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.presence.findMany({
        where: {
          date: today,
          user: userWhere,
        },
        select: { status: true },
      }),
      this.prisma.dailyMandate.count({ where: { date: today, user: userWhere } }),
    ])

    const present = presences.filter(p => p.status === PresenceStatus.PRESENT).length
    const late = presences.filter(p => p.status === PresenceStatus.LATE).length
    const absent = totalActive - present - late

    return {
      date: today,
      totalActive,
      present,
      late,
      absent,
      presenceRate: totalActive > 0 ? Math.round(((present + late) / totalActive) * 100) : 0,
      mandatesToday: mandates,
    }
  }

  async getPresenceByBu(requester: Requester) {
    this.assertAllowed(requester)

    const today = getToday()
    const userWhere = this.buildUserWhere(requester)

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true, businessUnitId: true, businessUnit: { select: { id: true, name: true, code: true } } },
    })

    const presences = await this.prisma.presence.findMany({
      where: { date: today, user: userWhere },
      select: { userId: true, status: true },
    })

    const presenceMap = new Map(presences.map(p => [p.userId, p.status]))

    const buMap = new Map<string, { buId: string; buName: string; buCode: string; total: number; present: number; late: number; absent: number }>()

    for (const user of users) {
      if (!user.businessUnitId || !user.businessUnit) continue
      const key = user.businessUnitId
      if (!buMap.has(key)) {
        buMap.set(key, { buId: key, buName: user.businessUnit.name, buCode: user.businessUnit.code, total: 0, present: 0, late: 0, absent: 0 })
      }
      const row = buMap.get(key)!
      row.total++
      const status = presenceMap.get(user.id)
      if (status === PresenceStatus.PRESENT) row.present++
      else if (status === PresenceStatus.LATE) row.late++
      else row.absent++
    }

    return Array.from(buMap.values()).sort((a, b) => a.buName.localeCompare(b.buName))
  }

  async getConnectionsChart(requester: Requester, days = 14) {
    this.assertAllowed(requester)

    const n = Math.min(90, Math.max(7, days))
    const userWhere = this.buildUserWhere(requester)
    const from = getDaysAgo(n - 1)
    const today = getToday()

    const logs = await this.prisma.connectionLog.findMany({
      where: {
        date: { gte: from, lte: today },
        type: 'LOGIN',
        user: userWhere,
      },
      select: { date: true },
    })

    const countByDay = new Map<string, number>()

    for (let i = n - 1; i >= 0; i--) {
      const d = getDaysAgo(i)
      const key = d.toISOString().split('T')[0]
      countByDay.set(key, 0)
    }

    for (const log of logs) {
      const key = new Date(log.date).toISOString().split('T')[0]
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1)
    }

    return Array.from(countByDay.entries()).map(([date, connexions]) => ({ date, connexions }))
  }

  async getActivityChart(requester: Requester, days = 30) {
    this.assertAllowed(requester)

    const n = Math.min(90, Math.max(7, days))
    const userWhere = this.buildUserWhere(requester)
    const from = getDaysAgo(n - 1)

    const logs = await this.prisma.activityLog.findMany({
      where: {
        occurredAt: { gte: from },
        user: userWhere,
        action: { notIn: [LogAction.LOGIN, LogAction.LOGOUT] },
      },
      select: { action: true },
    })

    const countByAction = new Map<string, number>()
    for (const log of logs) {
      countByAction.set(log.action, (countByAction.get(log.action) ?? 0) + 1)
    }

    return Array.from(countByAction.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }

  async getActivityLog(
    requester: Requester,
    page: number,
    limit: number,
    search?: string,
    action?: string,
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
