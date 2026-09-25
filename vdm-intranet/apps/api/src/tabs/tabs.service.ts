import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { LogAction, Prisma, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTabDto } from './dto/create-tab.dto'
import { UpdateTabDto } from './dto/update-tab.dto'
import { CreateTabFolderDto } from './dto/create-tab-folder.dto'
import { UpdateTabFolderDto } from './dto/update-tab-folder.dto'
import { ReorderTabsDto } from './dto/reorder-tabs.dto'
import { ReorderTabFoldersDto } from './dto/reorder-tab-folders.dto'
import { SetTabCredentialDto } from './dto/set-tab-credential.dto'
import {
  CAN_MANAGE_TABS,
  CAN_MANAGE_TABS_GLOBAL,
  CAN_MANAGE_TABS_BU_SCOPE,
  CAN_VIEW_TABS_OWN_BU,
} from '../common/permissions'
import {
  encryptCredentialSecret,
  decryptCredentialSecret,
} from '../common/crypto/tab-credential-crypto.util'

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
  // N'expose jamais le secret dans la liste : seulement de quoi savoir qu'un identifiant partagé
  // existe (tab.credential !== null). Le déchiffrement/la consultation passent uniquement par
  // getCredential(), journalisés.
  credential: { select: { id: true } },
  shares: {
    select: { businessUnit: { select: { id: true, name: true, code: true } } },
    orderBy: { businessUnit: { name: 'asc' } },
  },
} as const

/**
 * Onglets visibles pour une BU : globaux, propres à la BU, partagés avec elle (PortalTabShare) ou
 * rangés dans un dossier partagé avec elle (PortalTabFolderShare). Même règle pour findAll(),
 * assertCanViewTab() et SearchService.searchTabs().
 */
export function tabsVisibleToBu(buId: string | null | undefined): Prisma.PortalTabWhereInput[] {
  return buId
    ? [
        { businessUnitId: null },
        { businessUnitId: buId },
        { shares: { some: { businessUnitId: buId } } },
        { folder: { shares: { some: { businessUnitId: buId } } } },
      ]
    : [{ businessUnitId: null }]
}

/** Dossiers visibles pour une BU : globaux, propres à la BU ou partagés avec elle. */
function foldersVisibleToBu(buId: string | null | undefined): Prisma.PortalTabFolderWhereInput[] {
  return buId
    ? [
        { businessUnitId: null },
        { businessUnitId: buId },
        { shares: { some: { businessUnitId: buId } } },
      ]
    : [{ businessUnitId: null }]
}

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
  shares: {
    select: { businessUnit: { select: { id: true, name: true, code: true } } },
    orderBy: { businessUnit: { name: 'asc' } },
  },
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
      // Global tabs always included; optionally narrow by BU (onglets partagés avec elle inclus)
      const where = buId ? { OR: tabsVisibleToBu(buId) } : {}
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
      const where: Prisma.PortalTabWhereInput = { OR: tabsVisibleToBu(requester.businessUnitId) }
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
    }

    const sharedBuIds = await this.resolveSharedBuIds(
      requester,
      targetBuId,
      dto.sharedBusinessUnitIds,
      'onglet'
    )
    const folderId = await this.resolveFolderId(dto.folderId ?? null, targetBuId)
    if (targetBuId !== null) {
      await this.assertUrlFreeForBus(dto.url, [
        targetBuId,
        ...(sharedBuIds ?? []),
        ...(await this.folderShareBuIds(folderId ?? null)),
      ])
    }

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
        shares: sharedBuIds?.length
          ? { create: sharedBuIds.map((businessUnitId) => ({ businessUnitId })) }
          : undefined,
      },
      select: TAB_SELECT,
    })

    await this.log(requester.id, LogAction.TAB_CREATED, tab.id, {
      name: tab.name,
      url: tab.url,
      ...(sharedBuIds?.length ? { sharedBusinessUnitIds: sharedBuIds } : {}),
    })

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

    const { sharedBusinessUnitIds, ...fields } = dto
    const sharedBuIds = await this.resolveSharedBuIds(
      requester,
      tab.businessUnitId,
      sharedBusinessUnitIds,
      'onglet'
    )
    const urlChanged = !!dto.url && dto.url !== tab.url
    const folderChanged = dto.folderId !== undefined && dto.folderId !== tab.folderId

    if (urlChanged && tab.businessUnitId === null) {
      // Même contrôle manuel que create() : @@unique([businessUnitId, url]) ignore les NULL,
      // donc deux onglets globaux ne peuvent pas être départagés par la contrainte DB seule.
      const existing = await this.prisma.portalTab.findFirst({
        where: { businessUnitId: null, url: dto.url, NOT: { id } },
      })
      if (existing) throw new BadRequestException('Cet URL existe déjà dans les onglets globaux.')
    } else if (
      tab.businessUnitId !== null &&
      (urlChanged || folderChanged || sharedBuIds !== undefined)
    ) {
      // Toutes les BU qui verront l'onglet après la modification : propriétaire, partages
      // directs, et BU destinataires de son dossier (futur ou actuel).
      await this.assertUrlFreeForBus(
        dto.url ?? tab.url,
        [
          tab.businessUnitId,
          ...(sharedBuIds ?? tab.shares.map((s) => s.businessUnitId)),
          ...(await this.folderShareBuIds(folderChanged ? (dto.folderId ?? null) : tab.folderId)),
        ],
        [id]
      )
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
        data: {
          ...fields,
          ...(sharedBuIds !== undefined
            ? {
                shares: {
                  deleteMany: {},
                  create: sharedBuIds.map((businessUnitId) => ({ businessUnitId })),
                },
              }
            : {}),
        },
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

  // ---- Identifiant partagé d'un onglet ----

  async getCredential(requester: Requester, tabId: string) {
    const tab = await this.findTabOrFail(tabId)
    this.assertCanViewTab(requester, tab)

    const credential = await this.prisma.portalTabCredential.findUnique({
      where: { tabId },
      select: {
        username: true,
        passwordEnc: true,
        notes: true,
        updatedAt: true,
        updatedBy: { select: { id: true, username: true, fullName: true } },
      },
    })
    if (!credential) throw new NotFoundException('Aucun identifiant enregistré pour cet onglet.')

    await this.log(requester.id, LogAction.TAB_CREDENTIAL_VIEWED, tabId, { tabName: tab.name })

    return {
      username: credential.username,
      password: decryptCredentialSecret(credential.passwordEnc),
      notes: credential.notes,
      updatedAt: credential.updatedAt,
      updatedBy: credential.updatedBy,
    }
  }

  async setCredential(requester: Requester, tabId: string, dto: SetTabCredentialDto) {
    const tab = await this.findTabOrFail(tabId)
    this.assertCanManage(requester, tab.businessUnitId)

    const passwordEnc = encryptCredentialSecret(dto.password)
    const credential = await this.prisma.portalTabCredential.upsert({
      where: { tabId },
      create: {
        tabId,
        username: dto.username,
        passwordEnc,
        notes: dto.notes,
        updatedById: requester.id,
      },
      update: {
        username: dto.username,
        passwordEnc,
        notes: dto.notes ?? null,
        updatedById: requester.id,
      },
      select: {
        username: true,
        notes: true,
        updatedAt: true,
        updatedBy: { select: { id: true, username: true, fullName: true } },
      },
    })

    await this.log(requester.id, LogAction.TAB_CREDENTIAL_SET, tabId, { tabName: tab.name })

    return credential
  }

  async deleteCredential(requester: Requester, tabId: string) {
    const tab = await this.findTabOrFail(tabId)
    this.assertCanManage(requester, tab.businessUnitId)

    try {
      await this.prisma.portalTabCredential.delete({ where: { tabId } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Aucun identifiant enregistré pour cet onglet.')
      throw err
    }
    await this.log(requester.id, LogAction.TAB_CREDENTIAL_DELETED, tabId, { tabName: tab.name })

    return { deleted: true }
  }

  // ---- Dossiers d'onglets ----

  async findAllFolders(requester: Requester, buId?: string) {
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
      const where = buId ? { OR: foldersVisibleToBu(buId) } : {}
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
      return this.prisma.portalTabFolder.findMany({
        where: { OR: foldersVisibleToBu(requester.businessUnitId) },
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

    const sharedBuIds = await this.resolveSharedBuIds(
      requester,
      targetBuId,
      dto.sharedBusinessUnitIds,
      'dossier'
    )

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
        shares: sharedBuIds?.length
          ? { create: sharedBuIds.map((businessUnitId) => ({ businessUnitId })) }
          : undefined,
      },
      select: FOLDER_SELECT,
    })

    await this.log(
      requester.id,
      LogAction.TAB_FOLDER_CREATED,
      folder.id,
      {
        name: folder.name,
        ...(sharedBuIds?.length ? { sharedBusinessUnitIds: sharedBuIds } : {}),
      },
      'PortalTabFolder'
    )

    return folder
  }

  async updateFolder(requester: Requester, id: string, dto: UpdateTabFolderDto) {
    const folder = await this.findFolderOrFail(id)
    this.assertCanManageFolder(requester, folder.businessUnitId)

    const { sharedBusinessUnitIds, ...fields } = dto
    const sharedBuIds = await this.resolveSharedBuIds(
      requester,
      folder.businessUnitId,
      sharedBusinessUnitIds,
      'dossier'
    )
    if (sharedBuIds?.length) {
      // Les onglets du dossier deviennent visibles dans les BU destinataires : aucun ne doit y
      // doubler un onglet de même URL déjà visible.
      const folderTabs = await this.prisma.portalTab.findMany({
        where: { folderId: id },
        select: { id: true, url: true },
      })
      const folderTabIds = folderTabs.map((t) => t.id)
      for (const t of folderTabs) await this.assertUrlFreeForBus(t.url, sharedBuIds, folderTabIds)
    }

    try {
      const updated = await this.prisma.portalTabFolder.update({
        where: { id },
        data: {
          ...fields,
          ...(sharedBuIds !== undefined
            ? {
                shares: {
                  deleteMany: {},
                  create: sharedBuIds.map((businessUnitId) => ({ businessUnitId })),
                },
              }
            : {}),
        },
        select: FOLDER_SELECT,
      })
      await this.log(
        requester.id,
        LogAction.TAB_FOLDER_UPDATED,
        id,
        dto as object,
        'PortalTabFolder'
      )
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
      select: { id: true, url: true, businessUnitId: true, folderId: true },
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
          select: { id: true, businessUnitId: true, shares: { select: { businessUnitId: true } } },
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
            'Un onglet ne peut être déplacé que dans un dossier de la même portée (global ou même BU).'
          )
        }
        if (item.folderId !== tab.folderId && folder.shares.length) {
          await this.assertUrlFreeForBus(
            tab.url,
            folder.shares.map((s) => s.businessUnitId),
            [tab.id]
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
    if (
      CAN_MANAGE_TABS_BU_SCOPE.includes(requester.role) &&
      requester.businessUnitId === folderBuId
    )
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
      select: {
        id: true,
        name: true,
        url: true,
        businessUnitId: true,
        isActive: true,
        folderId: true,
        shares: { select: { businessUnitId: true } },
        folder: { select: { shares: { select: { businessUnitId: true } } } },
      },
    })
    if (!tab) throw new NotFoundException('Onglet introuvable.')
    return tab
  }

  /**
   * Normalise la liste des BU destinataires du partage d'un onglet ou d'un dossier. undefined =
   * champ non fourni (aucun changement) ; [] = retire tous les partages. Réservé aux gestionnaires
   * globaux, et seulement pour un élément de BU (un élément global est déjà visible par toutes
   * les BU). La BU propriétaire est ignorée si elle figure dans la liste.
   */
  private async resolveSharedBuIds(
    requester: Requester,
    ownerBuId: string | null,
    ids: string[] | undefined,
    kind: 'onglet' | 'dossier'
  ): Promise<string[] | undefined> {
    if (ids === undefined) return undefined
    const unique = [...new Set(ids)].filter((buId) => buId !== ownerBuId)
    if (!CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
      throw new ForbiddenException(
        `Seuls les administrateurs peuvent partager un ${kind} avec d'autres BU.`
      )
    }
    if (unique.length === 0) return []
    if (ownerBuId === null) {
      throw new BadRequestException(
        `Un ${kind} global est déjà visible par toutes les BU : il ne peut pas être partagé.`
      )
    }
    const count = await this.prisma.businessUnit.count({ where: { id: { in: unique } } })
    if (count !== unique.length) throw new BadRequestException('Business Unit introuvable.')
    return unique
  }

  /** BU destinataires d'un dossier ([] si aucun dossier ou dossier non partagé). */
  private async folderShareBuIds(folderId: string | null): Promise<string[]> {
    if (!folderId) return []
    const shares = await this.prisma.portalTabFolderShare.findMany({
      where: { folderId },
      select: { businessUnitId: true },
    })
    return shares.map((s) => s.businessUnitId)
  }

  /**
   * Une BU ne doit jamais voir deux onglets de même URL : ni l'un des siens, ni un onglet partagé
   * avec elle directement ou via son dossier (la contrainte @@unique([businessUnitId, url]) ne
   * couvre que le premier cas).
   */
  private async assertUrlFreeForBus(url: string, buIds: string[], excludeTabIds: string[] = []) {
    if (buIds.length === 0) return
    const inBus = { some: { businessUnitId: { in: buIds } } }
    const conflict = await this.prisma.portalTab.findFirst({
      where: {
        url,
        ...(excludeTabIds.length ? { id: { notIn: excludeTabIds } } : {}),
        OR: [{ businessUnitId: { in: buIds } }, { shares: inBus }, { folder: { shares: inBus } }],
      },
      select: {
        businessUnitId: true,
        shares: { select: { businessUnitId: true } },
        folder: { select: { shares: { select: { businessUnitId: true } } } },
      },
    })
    if (!conflict) return
    const conflictBuIds = [
      conflict.businessUnitId,
      ...conflict.shares.map((s) => s.businessUnitId),
      ...(conflict.folder?.shares.map((s) => s.businessUnitId) ?? []),
    ]
    const buId = buIds.find((b) => conflictBuIds.includes(b))
    const bu = buId
      ? await this.prisma.businessUnit.findUnique({ where: { id: buId }, select: { name: true } })
      : null
    throw new BadRequestException(
      bu ? `Cet URL existe déjà pour la BU « ${bu.name} ».` : 'Cet URL existe déjà pour cette BU.'
    )
  }

  private assertCanManage(requester: Requester, tabBuId: string | null) {
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) return
    if (tabBuId === null)
      throw new ForbiddenException('Seuls les administrateurs peuvent gérer les onglets globaux.')
    if (CAN_MANAGE_TABS_BU_SCOPE.includes(requester.role) && requester.businessUnitId === tabBuId)
      return
    throw new ForbiddenException('Accès refusé à cet onglet.')
  }

  /**
   * Vérifie qu'un onglet est *visible* pour le requester — même règle de portée que findAll()
   * (global toujours visible, sinon même BU ou BU destinataire d'un partage de l'onglet ou de son
   * dossier), avec la même exigence isActive pour les rôles en lecture seule (CAN_VIEW_TABS_OWN_BU). Contrairement à assertCanManage, un manager BU/global
   * n'a pas besoin d'être le gestionnaire de CET onglet précis : voir son identifiant partagé est
   * ouvert à tout utilisateur qui verrait l'onglet dans la liste.
   */
  private assertCanViewTab(
    requester: Requester,
    tab: {
      businessUnitId: string | null
      isActive: boolean
      shares: { businessUnitId: string }[]
      folder: { shares: { businessUnitId: string }[] } | null
    }
  ) {
    const isViewerOnlyRole = CAN_VIEW_TABS_OWN_BU.includes(requester.role)
    if (isViewerOnlyRole && !tab.isActive) {
      throw new ForbiddenException('Onglet désactivé.')
    }
    if (tab.businessUnitId === null) return // Onglet global : visible par tous.
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) return
    if (!requester.businessUnitId) throw new ForbiddenException('Accès refusé à cet onglet.')
    if (requester.businessUnitId === tab.businessUnitId) return
    const isShared = (s: { businessUnitId: string }) =>
      s.businessUnitId === requester.businessUnitId
    if (tab.shares.some(isShared) || tab.folder?.shares.some(isShared)) return
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
