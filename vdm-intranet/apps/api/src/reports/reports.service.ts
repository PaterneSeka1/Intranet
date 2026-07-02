import { ForbiddenException, Injectable } from '@nestjs/common'
import { LogAction, Role } from '@prisma/client'
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

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAllowed(requester: Requester) {
    if (!ALLOWED_ROLES.includes(requester.role)) {
      throw new ForbiddenException('Accès réservé aux responsables.')
    }
  }

  private buildUserWhere(requester: Requester): object {
    if (GLOBAL_ROLES.includes(requester.role)) return {}
    if (requester.role === Role.RESPONSABLE_BU) return { businessUnitId: requester.businessUnitId }
    if (requester.role === Role.RESPONSABLE_POLE) return { poleId: requester.poleId }
    return {}
  }

  private toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
    const esc = (v: string | number | null | undefined): string => {
      const s = String(v ?? '')
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))]
    return '﻿' + lines.join('\r\n')
  }

  private fmtDate(d: Date | string | null | undefined): string {
    if (!d) return ''
    const dt = new Date(d)
    return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`
  }

  private fmtDateTime(d: Date | string | null | undefined): string {
    if (!d) return ''
    const dt = new Date(d)
    return `${this.fmtDate(dt)} ${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`
  }

  async presenceCsv(requester: Requester, dateFrom?: string, dateTo?: string) {
    this.assertAllowed(requester)
    const userWhere = this.buildUserWhere(requester)

    const since90 = new Date()
    since90.setUTCDate(since90.getUTCDate() - 90)
    since90.setUTCHours(0, 0, 0, 0)

    const dateFilter: Record<string, Date> = {
      gte: dateFrom ? new Date(dateFrom) : since90,
      lte: dateTo ? new Date(dateTo) : getToday(),
    }

    const rows = await this.prisma.presence.findMany({
      where: {
        date: dateFilter,
        user: userWhere,
      },
      include: {
        user: {
          select: {
            username: true, fullName: true, role: true,
            businessUnit: { select: { name: true } },
            pole: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { user: { lastName: 'asc' } }],
      take: 10000,
    })

    await this.logExport(requester.id, LogAction.PRESENCE_REPORT_EXPORTED)

    const STATUS: Record<string, string> = { PRESENT: 'Présent', LATE: 'En retard', ABSENT: 'Absent' }

    return this.toCsv(
      ['Date', 'Utilisateur', 'Nom complet', 'Rôle', 'BU', 'Pôle', 'Statut', 'Heure attendue', 'Arrivée officielle', 'Écart (min)', 'Adresse GPS', 'Source'],
      rows.map(r => [
        this.fmtDate(r.date),
        r.user.username,
        r.user.fullName ?? '',
        r.user.role,
        r.user.businessUnit?.name ?? '',
        r.user.pole?.name ?? '',
        STATUS[r.status] ?? r.status,
        r.expectedArrivalTime,
        this.fmtDateTime(r.officialArrivalTime),
        r.delayMinutes ?? '',
        r.address ?? '',
        r.sourceConnectionLogId ? 'Connexion' : 'Manuel',
      ]),
    )
  }

  async activityCsv(requester: Requester, dateFrom?: string, dateTo?: string) {
    this.assertAllowed(requester)
    const userWhere = this.buildUserWhere(requester)

    const dateFilter: Record<string, Date> = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) dateFilter.lte = new Date(`${dateTo}T23:59:59.999Z`)

    const rows = await this.prisma.activityLog.findMany({
      where: {
        ...(Object.keys(dateFilter).length ? { occurredAt: dateFilter } : {}),
        user: userWhere,
      },
      include: {
        user: {
          select: {
            username: true, fullName: true, role: true,
            businessUnit: { select: { name: true } },
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 5000,
    })

    await this.logExport(requester.id, LogAction.ACTIVITY_REPORT_EXPORTED)

    return this.toCsv(
      ['Date/Heure', 'Utilisateur', 'Nom complet', 'Rôle', 'BU', 'Action', 'Entité', 'ID Entité', 'IP', 'User-Agent'],
      rows.map(r => [
        this.fmtDateTime(r.occurredAt),
        r.user.username,
        r.user.fullName ?? '',
        r.user.role,
        r.user.businessUnit?.name ?? '',
        r.action,
        r.entity ?? '',
        r.entityId ?? '',
        r.ipAddress ?? '',
        r.userAgent ?? '',
      ]),
    )
  }

  async connectionsCsv(requester: Requester, dateFrom?: string, dateTo?: string) {
    this.assertAllowed(requester)
    const userWhere = this.buildUserWhere(requester)

    const since90conn = new Date()
    since90conn.setUTCDate(since90conn.getUTCDate() - 90)
    since90conn.setUTCHours(0, 0, 0, 0)

    const dateFilter: Record<string, Date> = {
      gte: dateFrom ? new Date(dateFrom) : since90conn,
      lte: dateTo ? new Date(dateTo) : getToday(),
    }

    const rows = await this.prisma.connectionLog.findMany({
      where: {
        date: dateFilter,
        user: userWhere,
      },
      include: {
        user: {
          select: {
            username: true, fullName: true, role: true,
            businessUnit: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { connectedAt: 'desc' }],
      take: 5000,
    })

    await this.logExport(requester.id, LogAction.CONNECTION_REPORT_EXPORTED)

    return this.toCsv(
      ['Date', 'Heure connexion', 'Heure déconnexion', 'Utilisateur', 'Nom complet', 'Rôle', 'BU', 'Type', '1ère connexion', 'IP', 'Adresse GPS'],
      rows.map(r => [
        this.fmtDate(r.date),
        this.fmtDateTime(r.connectedAt),
        this.fmtDateTime(r.disconnectedAt),
        r.user.username,
        r.user.fullName ?? '',
        r.user.role,
        r.user.businessUnit?.name ?? '',
        r.type,
        r.isFirstConnectionOfDay ? 'Oui' : 'Non',
        r.ipAddress ?? '',
        r.address ?? '',
      ]),
    )
  }

  async generalCsv(requester: Requester) {
    this.assertAllowed(requester)
    const userWhere = this.buildUserWhere(requester)

    const today = getToday()

    const [users, presences, connections] = await Promise.all([
      this.prisma.user.findMany({
        where: { ...userWhere, isActive: true },
        select: {
          username: true, fullName: true, role: true,
          businessUnit: { select: { name: true } },
          pole: { select: { name: true } },
          scheduleGroup: { select: { name: true, expectedArrivalTime: true } },
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
      this.prisma.connectionLog.count({ where: { date: today, type: 'LOGIN', user: userWhere } }),
    ])

    await this.logExport(requester.id, LogAction.GENERAL_REPORT_EXPORTED)

    const STATUS: Record<string, string> = { PRESENT: 'Présent', LATE: 'En retard', ABSENT: 'Absent' }
    const presMap = new Map(presences.map(p => [p.user.username, p]))

    let csv = this.toCsv(
      ['RAPPORT GÉNÉRAL VDM INTRANET', `Généré le ${this.fmtDate(today)}`],
      [],
    )

    csv += '\r\n\r\n'

    const userRows = users.map(u => {
      const pres = presMap.get(u.username)
      return [
        u.username,
        u.fullName ?? '',
        u.role,
        u.businessUnit?.name ?? '',
        u.pole?.name ?? '',
        u.scheduleGroup?.expectedArrivalTime ?? u.individualExpectedArrivalTime ?? '',
        pres ? STATUS[pres.status] : 'Absent',
        pres ? this.fmtDateTime(pres.officialArrivalTime) : '',
        pres?.delayMinutes ?? '',
        this.fmtDateTime(u.lastLoginAt),
      ]
    })

    csv += this.toCsv(
      ['Utilisateur', 'Nom complet', 'Rôle', 'BU', 'Pôle', 'Heure attendue', 'Présence', 'Arrivée', 'Écart (min)', 'Dernière connexion'],
      userRows,
    )

    csv += `\r\n\r\n"Connexions aujourd'hui";"${connections}"\r\n`

    return csv
  }

  private async logExport(userId: string, action: LogAction) {
    await this.prisma.activityLog.create({
      data: { userId, action, entity: 'Report', details: { exportedAt: new Date().toISOString() } as object },
    })
  }
}
