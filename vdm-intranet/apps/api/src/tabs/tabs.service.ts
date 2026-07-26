import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { LogAction, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTabDto } from './dto/create-tab.dto'
import { UpdateTabDto } from './dto/update-tab.dto'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
}

const TAB_SELECT = {
  id: true,
  name: true,
  url: true,
  description: true,
  icon: true,
  color: true,
  isActive: true,
  businessUnitId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  businessUnit: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, username: true, fullName: true } },
} as const

const FULL_ACCESS: Role[] = [Role.CTO_ADMIN, Role.PDG]
const READ_OWN_BU: Role[] = [
  Role.RESPONSABLE_POLE,
  Role.CONSULTANT,
  Role.STAGIAIRE,
  Role.PRESTATAIRE,
]
const MANAGE_OWN_BU: Role[] = [Role.DAF, Role.RESPONSABLE_BU]

@Injectable()
export class TabsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Business Units ----

  getAllBusinessUnits() {
    return this.prisma.businessUnit.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        _count: { select: { users: true, poles: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async createBusinessUnit(data: { name: string; code: string; description?: string }) {
    return this.prisma.businessUnit.create({
      data: { name: data.name, code: data.code.toUpperCase(), description: data.description },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        _count: { select: { users: true, poles: true } },
      },
    })
  }

  async updateBusinessUnit(
    id: string,
    data: { name?: string; code?: string; description?: string; isActive?: boolean }
  ) {
    const bu = await this.prisma.businessUnit.findUnique({ where: { id } })
    if (!bu) throw new NotFoundException('Business Unit introuvable.')
    try {
      return await this.prisma.businessUnit.update({
        where: { id },
        data: { ...data, code: data.code ? data.code.toUpperCase() : undefined },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          isActive: true,
          _count: { select: { users: true, poles: true } },
        },
      })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Business Unit introuvable.')
      throw err
    }
  }

  async deleteBusinessUnit(id: string) {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id },
      select: { id: true, _count: { select: { users: true, poles: true } } },
    })
    if (!bu) throw new NotFoundException('Business Unit introuvable.')
    if (bu._count.users > 0)
      throw new BadRequestException(
        `Impossible de supprimer : ${bu._count.users} utilisateur(s) assigné(s) à cette BU.`
      )
    if (bu._count.poles > 0)
      throw new BadRequestException(
        `Impossible de supprimer : ${bu._count.poles} pôle(s) rattaché(s) à cette BU. Supprimez-les d'abord.`
      )
    try {
      await this.prisma.businessUnit.delete({ where: { id } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Business Unit introuvable.')
      throw err
    }
    return { deleted: true }
  }

  // ---- Pôles ----

  getAllPoles() {
    return this.prisma.pole.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        businessUnitId: true,
        isActive: true,
        businessUnit: { select: { id: true, name: true, code: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async createPole(data: { name: string; code: string; businessUnitId: string }) {
    return this.prisma.pole.create({
      data: { name: data.name, code: data.code.toUpperCase(), businessUnitId: data.businessUnitId },
      select: {
        id: true,
        name: true,
        code: true,
        businessUnitId: true,
        isActive: true,
        businessUnit: { select: { id: true, name: true, code: true } },
        _count: { select: { users: true } },
      },
    })
  }

  async updatePole(
    id: string,
    data: { name?: string; code?: string; businessUnitId?: string; isActive?: boolean }
  ) {
    const pole = await this.prisma.pole.findUnique({ where: { id } })
    if (!pole) throw new NotFoundException('Pôle introuvable.')
    try {
      return await this.prisma.pole.update({
        where: { id },
        data: { ...data, code: data.code ? data.code.toUpperCase() : undefined },
        select: {
          id: true,
          name: true,
          code: true,
          businessUnitId: true,
          isActive: true,
          businessUnit: { select: { id: true, name: true, code: true } },
          _count: { select: { users: true } },
        },
      })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Pôle introuvable.')
      throw err
    }
  }

  async deletePole(id: string) {
    const pole = await this.prisma.pole.findUnique({
      where: { id },
      select: { id: true, _count: { select: { users: true } } },
    })
    if (!pole) throw new NotFoundException('Pôle introuvable.')
    if (pole._count.users > 0)
      throw new BadRequestException('Impossible de supprimer un pôle ayant des utilisateurs.')
    try {
      await this.prisma.pole.delete({ where: { id } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Pôle introuvable.')
      throw err
    }
    return { deleted: true }
  }

  async findAll(requester: Requester, buId?: string) {
    if (FULL_ACCESS.includes(requester.role)) {
      // Global tabs always included; optionally narrow by BU
      const where = buId ? { OR: [{ businessUnitId: buId }, { businessUnitId: null }] } : {}
      return this.prisma.portalTab.findMany({
        where,
        select: TAB_SELECT,
        orderBy: [{ businessUnit: { name: 'asc' } }, { name: 'asc' }],
        take: 200,
      })
    }

    if (MANAGE_OWN_BU.includes(requester.role) || READ_OWN_BU.includes(requester.role)) {
      const orConditions = requester.businessUnitId
        ? [{ businessUnitId: requester.businessUnitId }, { businessUnitId: null }]
        : [{ businessUnitId: null }]
      const where: Record<string, unknown> = { OR: orConditions }
      if (READ_OWN_BU.includes(requester.role)) where.isActive = true
      return this.prisma.portalTab.findMany({
        where,
        select: TAB_SELECT,
        orderBy: [{ businessUnit: { name: 'asc' } }, { name: 'asc' }],
        take: 200,
      })
    }

    return []
  }

  async create(requester: Requester, dto: CreateTabDto) {
    if (!FULL_ACCESS.includes(requester.role) && !MANAGE_OWN_BU.includes(requester.role)) {
      throw new ForbiddenException('Vous ne pouvez pas créer un onglet.')
    }

    let targetBuId: string | null
    if (FULL_ACCESS.includes(requester.role)) {
      // No businessUnitId = global tab (visible to all users)
      targetBuId = dto.businessUnitId ?? null
    } else {
      if (!requester.businessUnitId) throw new ForbiddenException('Aucune BU assignée.')
      targetBuId = requester.businessUnitId
    }

    // Uniqueness check: Prisma @@unique ignores NULL rows, so check manually for global tabs
    if (targetBuId === null) {
      const existing = await this.prisma.portalTab.findFirst({
        where: { businessUnitId: null, url: dto.url },
      })
      if (existing) throw new BadRequestException('Cet URL existe déjà dans les onglets globaux.')
    } else {
      const existing = await this.prisma.portalTab.findUnique({
        where: { businessUnitId_url: { businessUnitId: targetBuId, url: dto.url } },
      })
      if (existing) throw new BadRequestException('Cet URL existe déjà pour cette BU.')
    }

    const tab = await this.prisma.portalTab.create({
      data: {
        name: dto.name,
        url: dto.url,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        businessUnitId: targetBuId,
        createdById: requester.id,
      },
      select: TAB_SELECT,
    })

    await this.log(requester.id, LogAction.TAB_CREATED, tab.id, { name: tab.name, url: tab.url })

    return tab
  }

  async update(requester: Requester, id: string, dto: UpdateTabDto) {
    const tab = await this.findTabOrFail(id)
    this.assertCanManage(requester, tab.businessUnitId)

    const action =
      dto.isActive === true
        ? LogAction.TAB_ENABLED
        : dto.isActive === false
          ? LogAction.TAB_DISABLED
          : LogAction.TAB_UPDATED

    try {
      const updated = await this.prisma.portalTab.update({
        where: { id },
        data: dto,
        select: TAB_SELECT,
      })
      await this.log(requester.id, action, id, dto as object)
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Onglet introuvable.')
      throw err
    }
  }

  async remove(requester: Requester, id: string) {
    const tab = await this.findTabOrFail(id)
    this.assertCanManage(requester, tab.businessUnitId)

    try {
      await this.prisma.portalTab.delete({ where: { id } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Onglet introuvable.')
      throw err
    }
    await this.log(requester.id, LogAction.TAB_DELETED, id, { name: tab.name })

    return { deleted: true }
  }

  private async findTabOrFail(id: string) {
    const tab = await this.prisma.portalTab.findUnique({
      where: { id },
      select: { id: true, name: true, url: true, businessUnitId: true },
    })
    if (!tab) throw new NotFoundException('Onglet introuvable.')
    return tab
  }

  private assertCanManage(requester: Requester, tabBuId: string | null) {
    if (FULL_ACCESS.includes(requester.role)) return
    if (tabBuId === null)
      throw new ForbiddenException('Seuls les administrateurs peuvent gérer les onglets globaux.')
    if (MANAGE_OWN_BU.includes(requester.role) && requester.businessUnitId === tabBuId) return
    throw new ForbiddenException('Accès refusé à cet onglet.')
  }

  private async log(userId: string, action: LogAction, entityId: string, details: object) {
    await this.prisma.activityLog.create({
      data: { userId, action, entity: 'PortalTab', entityId, details },
    })
  }
}
