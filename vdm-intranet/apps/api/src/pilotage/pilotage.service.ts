import { ForbiddenException, Injectable } from '@nestjs/common'
import { LogAction, PresenceStatus, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PublicHolidaysService } from '../public-holidays/public-holidays.service'
import {
  CAN_VIEW_PILOTAGE,
  CAN_VIEW_PILOTAGE_GLOBAL,
  CAN_VIEW_PILOTAGE_BU_SCOPE,
} from '../common/permissions'

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

function isWeekendDate(d: Date): boolean {
  const day = d.getUTCDay()
  return day === 0 || day === 6
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
    private readonly publicHolidays: PublicHolidaysService
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
    const userWhere = this.buildUserWhere(requester)

    const [totalActive, presences, mandates, holiday] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.presence.findMany({
        where: {
          date: today,
          user: userWhere,
        },
        select: { status: true },
      }),
      this.prisma.dailyMandate.count({ where: { date: today, user: userWhere } }),
      this.publicHolidays.isHoliday(today),
    ])

    const present = presences.filter((p) => p.status === PresenceStatus.PRESENT).length
    const late = presences.filter((p) => p.status === PresenceStatus.LATE).length
    const absent = totalActive - present - late

    return {
      date: today,
      totalActive,
      present,
      late,
      absent,
      presenceRate: totalActive > 0 ? Math.round(((present + late) / totalActive) * 100) : 0,
      mandatesToday: mandates,
      isPublicHoliday: holiday.isHoliday,
      publicHolidayLabel: holiday.label,
    }
  }

  async getPresenceByBu(requester: Requester) {
    this.assertAllowed(requester)

    const today = getToday()
    const userWhere = this.buildUserWhere(requester)

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        businessUnitId: true,
        businessUnit: { select: { id: true, name: true, code: true } },
      },
    })

    const presences = await this.prisma.presence.findMany({
      where: { date: today, user: userWhere },
      select: { userId: true, status: true },
    })

    const presenceMap = new Map(presences.map((p) => [p.userId, p.status]))

    const buMap = new Map<
      string,
      {
        buId: string
        buName: string
        buCode: string
        total: number
        present: number
        late: number
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
          absent: 0,
        })
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
        businessUnitId: true,
        businessUnit: { select: { id: true, name: true, code: true } },
      },
    })

    if (effectiveEnd < start) {
      return { period, from: toIso(start), to: toIso(end), byBu: [], trend: [] }
    }

    const presences = await this.prisma.presence.findMany({
      where: { date: { gte: start, lte: effectiveEnd }, user: userWhere },
      select: { userId: true, date: true, status: true },
    })

    const presenceIndex = new Map<string, PresenceStatus>()
    for (const p of presences) presenceIndex.set(`${p.userId}|${toIso(p.date)}`, p.status)

    const workingDays: Date[] = []
    for (let d = new Date(start); d <= effectiveEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      if (!isWeekendDate(d)) workingDays.push(new Date(d))
    }

    type BuAgg = {
      buId: string
      buName: string
      buCode: string
      workingDays: number
      totalUserDays: number
      present: number
      late: number
      absent: number
    }
    const buAggMap = new Map<string, BuAgg>()
    const trendMap = new Map<string, Map<string, { present: number; total: number }>>()

    for (const day of workingDays) {
      const dayIso = toIso(day)
      const dayTrend = new Map<string, { present: number; total: number }>()
      trendMap.set(dayIso, dayTrend)

      for (const user of users) {
        if (!user.businessUnitId || !user.businessUnit) continue
        const buId = user.businessUnitId

        if (!buAggMap.has(buId)) {
          buAggMap.set(buId, {
            buId,
            buName: user.businessUnit.name,
            buCode: user.businessUnit.code,
            workingDays: workingDays.length,
            totalUserDays: 0,
            present: 0,
            late: 0,
            absent: 0,
          })
        }
        const agg = buAggMap.get(buId)!
        agg.totalUserDays++

        const status = presenceIndex.get(`${user.id}|${dayIso}`)
        if (status === PresenceStatus.PRESENT) agg.present++
        else if (status === PresenceStatus.LATE) agg.late++
        else agg.absent++

        if (!dayTrend.has(user.businessUnit.code)) {
          dayTrend.set(user.businessUnit.code, { present: 0, total: 0 })
        }
        const t = dayTrend.get(user.businessUnit.code)!
        t.total++
        if (status === PresenceStatus.PRESENT || status === PresenceStatus.LATE) t.present++
      }
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
