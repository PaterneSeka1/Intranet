import { Injectable } from '@nestjs/common'
import { Prisma, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  CAN_VIEW_USERS,
  CAN_MANAGE_USERS,
  CAN_MANAGE_USERS_BU_SCOPE,
  CAN_MANAGE_TABS_GLOBAL,
  CAN_MANAGE_TABS_BU_SCOPE,
  CAN_VIEW_TABS_OWN_BU,
  CAN_MANAGE_ANNOUNCEMENTS,
} from '../common/permissions'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

export type SearchResult = {
  type: 'user' | 'tab' | 'announcement'
  id: string
  label: string
  sublabel: string | null
  href: string
  external: boolean
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(requester: Requester, rawQuery?: string): Promise<SearchResult[]> {
    const q = (rawQuery ?? '').trim().slice(0, 100)
    if (q.length < 2) return []

    const [users, tabs, announcements] = await Promise.all([
      this.searchUsers(requester, q),
      this.searchTabs(requester, q),
      this.searchAnnouncements(requester, q),
    ])

    return [...users, ...tabs, ...announcements]
  }

  private async searchUsers(requester: Requester, q: string): Promise<SearchResult[]> {
    if (!CAN_VIEW_USERS.includes(requester.role)) return []

    const scope: Prisma.UserWhereInput = { isActive: true }
    if (CAN_MANAGE_USERS.includes(requester.role)) {
      // aucun filtre supplémentaire — accès global
    } else if (CAN_MANAGE_USERS_BU_SCOPE.includes(requester.role) && requester.businessUnitId) {
      scope.businessUnitId = requester.businessUnitId
    } else if (requester.role === Role.RESPONSABLE_POLE && requester.poleId) {
      scope.poleId = requester.poleId
    } else {
      scope.id = requester.id
    }

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          scope,
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, username: true, fullName: true, role: true },
      take: 10,
    })

    return users.map((u) => ({
      type: 'user',
      id: u.id,
      label: u.fullName ?? u.username,
      sublabel: u.username,
      href: '/utilisateurs',
      external: false,
    }))
  }

  private async searchTabs(requester: Requester, q: string): Promise<SearchResult[]> {
    let scope: Prisma.PortalTabWhereInput

    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
      scope = { isActive: true }
    } else if (
      CAN_MANAGE_TABS_BU_SCOPE.includes(requester.role) ||
      CAN_VIEW_TABS_OWN_BU.includes(requester.role)
    ) {
      scope = {
        isActive: true,
        OR: requester.businessUnitId
          ? [{ businessUnitId: requester.businessUnitId }, { businessUnitId: null }]
          : [{ businessUnitId: null }],
      }
    } else {
      return []
    }

    const tabs = await this.prisma.portalTab.findMany({
      where: {
        AND: [
          scope,
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, description: true, url: true },
      take: 10,
    })

    return tabs.map((t) => ({
      type: 'tab',
      id: t.id,
      label: t.name,
      sublabel: t.description ?? t.url,
      href: t.url,
      external: true,
    }))
  }

  private async searchAnnouncements(requester: Requester, q: string): Promise<SearchResult[]> {
    const canSeeAll = CAN_MANAGE_ANNOUNCEMENTS.includes(requester.role)
    const now = new Date()

    const whereParts: Prisma.AnnouncementWhereInput[] = [
      {
        isActive: true,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { body: { contains: q, mode: 'insensitive' } },
        ],
      },
    ]
    if (!canSeeAll) {
      whereParts.push({
        OR: requester.businessUnitId
          ? [{ businessUnitId: null }, { businessUnitId: requester.businessUnitId }]
          : [{ businessUnitId: null }],
      })
    }

    const announcements = await this.prisma.announcement.findMany({
      where: { AND: whereParts },
      select: { id: true, title: true, body: true },
      take: 10,
    })

    return announcements.map((a) => ({
      type: 'announcement',
      id: a.id,
      label: a.title,
      sublabel: a.body.slice(0, 80),
      href: '/annonces',
      external: false,
    }))
  }
}
