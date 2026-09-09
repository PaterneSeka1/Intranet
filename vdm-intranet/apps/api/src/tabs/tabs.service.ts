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
import { CreateTabFolderDto } from './dto/create-tab-folder.dto'
import { UpdateTabFolderDto } from './dto/update-tab-folder.dto'
import { ReorderTabsDto } from './dto/reorder-tabs.dto'
import { ReorderTabFoldersDto } from './dto/reorder-tab-folders.dto'
import {
  CAN_MANAGE_TABS,
  CAN_MANAGE_TABS_GLOBAL,
  CAN_MANAGE_TABS_BU_SCOPE,
  CAN_VIEW_TABS_OWN_BU,
} from '../common/permissions'

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
  folderId: true,
  order: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  businessUnit: { select: { id: true, name: true, code: true } },
  folder: { select: { id: true, name: true, icon: true, color: true } },
  createdBy: { select: { id: true, username: true, fullName: true } },
} as const

const FOLDER_SELECT = {
  id: true,
  name: true,
  icon: true,
  color: true,
  order: true,
  businessUnitId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  businessUnit: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, username: true, fullName: true } },
} as const

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
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
      // Global tabs always included; optionally narrow by BU
      const where = buId ? { OR: [{ businessUnitId: buId }, { businessUnitId: null }] } : {}
      return this.prisma.portalTab.findMany({
        where,
        select: TAB_SELECT,
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        take: 200,
      })
    }

    if (
      CAN_MANAGE_TABS_BU_SCOPE.includes(requester.role) ||
      CAN_VIEW_TABS_OWN_BU.includes(requester.role)
    ) {
      const orConditions = requester.businessUnitId
        ? [{ businessUnitId: requester.businessUnitId }, { businessUnitId: null }]
        : [{ businessUnitId: null }]
      const where: Record<string, unknown> = { OR: orConditions }
      if (CAN_VIEW_TABS_OWN_BU.includes(requester.role)) where.isActive = true
      return this.prisma.portalTab.findMany({
        where,
        select: TAB_SELECT,
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        take: 200,
      })
    }

    return []
  }

  async create(requester: Requester, dto: CreateTabDto) {
    if (!CAN_MANAGE_TABS.includes(requester.role)) {
      throw new ForbiddenException('Vous ne pouvez pas créer un onglet.')
    }

    let targetBuId: string | null
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
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

    const folderId = await this.resolveFolderId(dto.folderId ?? null, targetBuId)
    const order = await this.nextTabOrder(folderId ?? null, targetBuId)

    const tab = await this.prisma.portalTab.create({
      data: {
        name: dto.name,
        url: dto.url,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        businessUnitId: targetBuId,
        folderId,
        order,
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

    if (dto.folderId !== undefined) {
      // Valide la portée (folder de même BU/global que l'onglet) ; la valeur elle-même est
      // déjà celle de dto.folderId, réutilisée telle quelle dans `data: dto` ci-dessous.
      await this.resolveFolderId(dto.folderId, tab.businessUnitId)
    }

    if (dto.url && dto.url !== tab.url) {
      // Même contrôle manuel que create() : @@unique([businessUnitId, url]) ignore les NULL,
      // donc deux onglets globaux ne peuvent pas être départagés par la contrainte DB seule.
      if (tab.businessUnitId === null) {
        const existing = await this.prisma.portalTab.findFirst({
          where: { businessUnitId: null, url: dto.url, NOT: { id } },
        })
        if (existing) throw new BadRequestException('Cet URL existe déjà dans les onglets globaux.')
      } else {
        const existing = await this.prisma.portalTab.findUnique({
          where: { businessUnitId_url: { businessUnitId: tab.businessUnitId, url: dto.url } },
        })
        if (existing && existing.id !== id) {
          throw new BadRequestException('Cet URL existe déjà pour cette BU.')
        }
      }
    }

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
      if ((err as { code?: string }).code === 'P2002')
        throw new BadRequestException('Cet URL existe déjà pour cette BU.')
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

  // ---- Dossiers d'onglets ----

  async findAllFolders(requester: Requester, buId?: string) {
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
      const where = buId ? { OR: [{ businessUnitId: buId }, { businessUnitId: null }] } : {}
      return this.prisma.portalTabFolder.findMany({
        where,
        select: FOLDER_SELECT,
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        take: 200,
      })
    }

    if (
      CAN_MANAGE_TABS_BU_SCOPE.includes(requester.role) ||
      CAN_VIEW_TABS_OWN_BU.includes(requester.role)
    ) {
      const orConditions = requester.businessUnitId
        ? [{ businessUnitId: requester.businessUnitId }, { businessUnitId: null }]
        : [{ businessUnitId: null }]
      return this.prisma.portalTabFolder.findMany({
        where: { OR: orConditions },
        select: FOLDER_SELECT,
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        take: 200,
      })
    }

    return []
  }

  async createFolder(requester: Requester, dto: CreateTabFolderDto) {
    if (!CAN_MANAGE_TABS.includes(requester.role)) {
      throw new ForbiddenException('Vous ne pouvez pas créer un dossier.')
    }

    let targetBuId: string | null
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
      targetBuId = dto.businessUnitId ?? null
    } else {
      if (!requester.businessUnitId) throw new ForbiddenException('Aucune BU assignée.')
      targetBuId = requester.businessUnitId
    }

    const max = await this.prisma.portalTabFolder.aggregate({
      where: { businessUnitId: targetBuId },
      _max: { order: true },
    })

    const folder = await this.prisma.portalTabFolder.create({
      data: {
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
        businessUnitId: targetBuId,
        order: (max._max.order ?? -1) + 1,
        createdById: requester.id,
      },
      select: FOLDER_SELECT,
    })

    await this.log(
      requester.id,
      LogAction.TAB_FOLDER_CREATED,
      folder.id,
      { name: folder.name },
      'PortalTabFolder'
    )

    return folder
  }

  async updateFolder(requester: Requester, id: string, dto: UpdateTabFolderDto) {
    const folder = await this.findFolderOrFail(id)
    this.assertCanManageFolder(requester, folder.businessUnitId)

    try {
      const updated = await this.prisma.portalTabFolder.update({
        where: { id },
        data: dto,
        select: FOLDER_SELECT,
      })
      await this.log(requester.id, LogAction.TAB_FOLDER_UPDATED, id, dto as object, 'PortalTabFolder')
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Dossier introuvable.')
      throw err
    }
  }

  async removeFolder(requester: Requester, id: string) {
    const folder = await this.findFolderOrFail(id)
    this.assertCanManageFolder(requester, folder.businessUnitId)

    try {
      // Les onglets du dossier ne sont jamais supprimés : la FK folderId passe à NULL
      // (onDelete: SetNull, cf. schema.prisma) et ils réapparaissent hors dossier.
      await this.prisma.portalTabFolder.delete({ where: { id } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Dossier introuvable.')
      throw err
    }
    await this.log(
      requester.id,
      LogAction.TAB_FOLDER_DELETED,
      id,
      { name: folder.name },
      'PortalTabFolder'
    )

    return { deleted: true }
  }

  async reorderFolders(requester: Requester, dto: ReorderTabFoldersDto) {
    const ids = dto.items.map((i) => i.id)
    const folders = await this.prisma.portalTabFolder.findMany({
      where: { id: { in: ids } },
      select: { id: true, businessUnitId: true },
    })
    if (folders.length !== ids.length) throw new NotFoundException('Dossier introuvable.')
    for (const folder of folders) this.assertCanManageFolder(requester, folder.businessUnitId)

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.portalTabFolder.update({ where: { id: item.id }, data: { order: item.order } })
      )
    )
    await this.log(
      requester.id,
      LogAction.TAB_FOLDER_REORDERED,
      'bulk',
      { count: dto.items.length },
      'PortalTabFolder'
    )

    return { updated: dto.items.length }
  }

  async reorderTabs(requester: Requester, dto: ReorderTabsDto) {
    const ids = dto.items.map((i) => i.id)
    const tabs = await this.prisma.portalTab.findMany({
      where: { id: { in: ids } },
      select: { id: true, businessUnitId: true },
    })
    if (tabs.length !== ids.length) throw new NotFoundException('Onglet introuvable.')
    const tabById = new Map(tabs.map((t) => [t.id, t]))

    // Résout les dossiers cibles une seule fois, pour vérifier que chaque onglet ne rejoint
    // qu'un dossier de la même portée (globale ou même BU) que lui.
    const targetFolderIds = [
      ...new Set(
        dto.items
          .filter((i) => i.folderId !== undefined && i.folderId !== null)
          .map((i) => i.folderId as string)
      ),
    ]
    const folders = targetFolderIds.length
      ? await this.prisma.portalTabFolder.findMany({
          where: { id: { in: targetFolderIds } },
          select: { id: true, businessUnitId: true },
        })
      : []
    const folderById = new Map(folders.map((f) => [f.id, f]))

    for (const item of dto.items) {
      const tab = tabById.get(item.id)!
      this.assertCanManage(requester, tab.businessUnitId)
      if (item.folderId !== undefined && item.folderId !== null) {
        const folder = folderById.get(item.folderId)
        if (!folder) throw new NotFoundException('Dossier introuvable.')
        if (folder.businessUnitId !== tab.businessUnitId) {
          throw new BadRequestException(
            "Un onglet ne peut être déplacé que dans un dossier de la même portée (global ou même BU)."
          )
        }
      }
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.portalTab.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.folderId !== undefined ? { folderId: item.folderId } : {}),
          },
        })
      )
    )
    await this.log(requester.id, LogAction.TAB_REORDERED, 'bulk', { count: dto.items.length })

    return { updated: dto.items.length }
  }

  private async findFolderOrFail(id: string) {
    const folder = await this.prisma.portalTabFolder.findUnique({
      where: { id },
      select: { id: true, name: true, businessUnitId: true },
    })
    if (!folder) throw new NotFoundException('Dossier introuvable.')
    return folder
  }

  private assertCanManageFolder(requester: Requester, folderBuId: string | null) {
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) return
    if (folderBuId === null)
      throw new ForbiddenException('Seuls les administrateurs peuvent gérer les dossiers globaux.')
    if (CAN_MANAGE_TABS_BU_SCOPE.includes(requester.role) && requester.businessUnitId === folderBuId)
      return
    throw new ForbiddenException('Accès refusé à ce dossier.')
  }

  /**
   * Valide qu'un folderId cible partage la portée (globale ou même BU) de l'onglet concerné.
   * undefined = champ non fourni (aucun changement) ; null = retire l'onglet de son dossier.
   */
  private async resolveFolderId(
    folderId: string | null | undefined,
    expectedBuId: string | null
  ): Promise<string | null | undefined> {
    if (folderId === undefined) return undefined
    if (folderId === null) return null
    const folder = await this.prisma.portalTabFolder.findUnique({
      where: { id: folderId },
      select: { id: true, businessUnitId: true },
    })
    if (!folder) throw new BadRequestException('Dossier introuvable.')
    if (folder.businessUnitId !== expectedBuId) {
      throw new BadRequestException(
        "Ce dossier n'appartient pas à la même portée (globale ou même BU) que l'onglet."
      )
    }
    return folderId
  }

  private async nextTabOrder(folderId: string | null, businessUnitId: string | null) {
    const max = await this.prisma.portalTab.aggregate({
      where: { folderId, businessUnitId },
      _max: { order: true },
    })
    return (max._max.order ?? -1) + 1
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
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) return
    if (tabBuId === null)
      throw new ForbiddenException('Seuls les administrateurs peuvent gérer les onglets globaux.')
    if (CAN_MANAGE_TABS_BU_SCOPE.includes(requester.role) && requester.businessUnitId === tabBuId)
      return
    throw new ForbiddenException('Accès refusé à cet onglet.')
  }

  private async log(
    userId: string,
    action: LogAction,
    entityId: string,
    details: object,
    entity: string = 'PortalTab'
  ) {
    await this.prisma.activityLog.create({
      data: { userId, action, entity, entityId, details },
    })
  }
}
