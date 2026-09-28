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

/**
 * Audience d'un onglet ou d'un dossier : global, ou liste des BU concernées (toutes au même
 * niveau). Un onglet rangé dans un dossier a pour audience celle du dossier (cf. tabAudience).
 */
type Audience = { isGlobal: boolean; buIds: string[] }

type AudienceInput = { isGlobal?: boolean; businessUnitIds?: string[] }

type AudienceRows = { isGlobal: boolean; businessUnits: { businessUnitId: string }[] }

const EMPTY_AUDIENCE: Audience = { isGlobal: false, buIds: [] }

const AUDIENCE_SELECT = {
  isGlobal: true,
  businessUnits: { select: { businessUnitId: true } },
} as const

/** Champs d'un onglet nécessaires aux contrôles d'audience (droits, visibilité, doublons d'URL). */
const TAB_AUDIENCE_SELECT = {
  id: true,
  name: true,
  url: true,
  isActive: true,
  folderId: true,
  ...AUDIENCE_SELECT,
  folder: { select: AUDIENCE_SELECT },
} as const

const BU_LIST_SELECT = {
  select: { businessUnit: { select: { id: true, name: true, code: true } } },
  orderBy: { businessUnit: { name: 'asc' } },
} as const

const TAB_SELECT = {
  id: true,
  name: true,
  url: true,
  description: true,
  icon: true,
  color: true,
  isActive: true,
  isGlobal: true,
  folderId: true,
  order: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  businessUnits: BU_LIST_SELECT,
  folder: { select: { id: true, name: true, icon: true, color: true } },
  createdBy: { select: { id: true, username: true, fullName: true } },
  // N'expose jamais le secret dans la liste : seulement de quoi savoir qu'un identifiant partagé
  // existe (tab.credential !== null). Le déchiffrement/la consultation passent uniquement par
  // getCredential(), journalisés.
  credential: { select: { id: true } },
} as const

const FOLDER_SELECT = {
  id: true,
  name: true,
  icon: true,
  color: true,
  order: true,
  isGlobal: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  businessUnits: BU_LIST_SELECT,
  createdBy: { select: { id: true, username: true, fullName: true } },
} as const

function toAudience(rows: AudienceRows): Audience {
  return rows.isGlobal
    ? { isGlobal: true, buIds: [] }
    : { isGlobal: false, buIds: rows.businessUnits.map((b) => b.businessUnitId) }
}

/** Audience effective d'un onglet : celle de son dossier s'il est rangé, sinon la sienne. */
function tabAudience(tab: AudienceRows & { folder: AudienceRows | null }): Audience {
  return toAudience(tab.folder ?? tab)
}

function sameAudience(a: Audience, b: Audience) {
  if (a.isGlobal !== b.isGlobal) return false
  if (a.isGlobal) return true
  const set = new Set(a.buIds)
  return set.size === new Set(b.buIds).size && b.buIds.every((id) => set.has(id))
}

function audienceRowsData(audience: Audience) {
  return {
    isGlobal: audience.isGlobal,
    businessUnits: {
      deleteMany: {},
      create: audience.buIds.map((businessUnitId) => ({ businessUnitId })),
    },
  }
}

/**
 * Onglets visibles pour une BU : globaux ou concernant la BU, directement ou via leur dossier.
 * Même règle pour findAll(), assertCanViewTab() et SearchService.searchTabs().
 */
export function tabsVisibleToBu(buId: string | null | undefined): Prisma.PortalTabWhereInput[] {
  const global: Prisma.PortalTabWhereInput[] = [
    { folderId: null, isGlobal: true },
    { folder: { isGlobal: true } },
  ]
  if (!buId) return global
  const concernsBu = { some: { businessUnitId: buId } }
  return [
    ...global,
    { folderId: null, businessUnits: concernsBu },
    { folder: { businessUnits: concernsBu } },
  ]
}

/** Dossiers visibles pour une BU : globaux ou concernant la BU. */
function foldersVisibleToBu(buId: string | null | undefined): Prisma.PortalTabFolderWhereInput[] {
  return buId
    ? [{ isGlobal: true }, { businessUnits: { some: { businessUnitId: buId } } }]
    : [{ isGlobal: true }]
}

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
      // Tout, ou seulement ce que voit une BU donnée (filtre optionnel).
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

    // Rangé dans un dossier : l'onglet hérite de son audience (les champs d'audience du DTO sont
    // alors ignorés) ; il suffit de pouvoir gérer ce dossier. Sinon : audience propre.
    let ownAudience = EMPTY_AUDIENCE
    let effective: Audience
    if (dto.folderId) {
      const folder = await this.findFolderOrFail(dto.folderId, BadRequestException)
      effective = toAudience(folder)
      this.assertCanManageAudience(requester, effective, 'dossier')
    } else {
      ownAudience = await this.resolveNewAudience(requester, dto, 'onglet')
      effective = ownAudience
    }

    await this.assertUrlFree(dto.url, effective)

    const tab = await this.prisma.portalTab.create({
      data: {
        name: dto.name,
        url: dto.url,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        isGlobal: ownAudience.isGlobal,
        folderId: dto.folderId ?? null,
        order: await this.nextTabOrder(dto.folderId ?? null),
        createdById: requester.id,
        businessUnits: ownAudience.buIds.length
          ? { create: ownAudience.buIds.map((businessUnitId) => ({ businessUnitId })) }
          : undefined,
      },
      select: TAB_SELECT,
    })

    await this.log(requester.id, LogAction.TAB_CREATED, tab.id, {
      name: tab.name,
      url: tab.url,
      ...(dto.folderId ? { folderId: dto.folderId } : this.audienceLog(ownAudience)),
    })

    return tab
  }

  async update(requester: Requester, id: string, dto: UpdateTabDto) {
    const tab = await this.findTabOrFail(id)
    const current = tabAudience(tab)
    this.assertCanManageAudience(requester, current, 'onglet')

    const { isGlobal, businessUnitIds, folderId, ...fields } = dto
    const audienceRequested = isGlobal !== undefined || businessUnitIds !== undefined
    const nextFolderId = folderId !== undefined ? folderId : tab.folderId
    const folderChanged = nextFolderId !== tab.folderId

    const ownCurrent = toAudience(tab)
    let nextOwn = ownCurrent
    let effective: Audience
    if (nextFolderId) {
      if (audienceRequested) {
        throw new BadRequestException(
          "Un onglet rangé dans un dossier a l'audience du dossier : modifiez celle du dossier."
        )
      }
      const folder = await this.findFolderOrFail(nextFolderId, BadRequestException)
      effective = toAudience(folder)
      nextOwn = EMPTY_AUDIENCE
      if (folderChanged) this.assertCanMoveTab(requester, current, effective)
    } else {
      // Hors dossier : audience demandée, ou — en sortant d'un dossier — celle du dossier quitté
      // (l'onglet reste visible des mêmes BU).
      const base = folderChanged ? current : ownCurrent
      nextOwn = audienceRequested
        ? await this.resolveAudienceChange(requester, { isGlobal, businessUnitIds }, base, 'onglet')
        : base
      effective = nextOwn
    }

    const urlChanged = !!dto.url && dto.url !== tab.url
    if (urlChanged || !sameAudience(current, effective)) {
      await this.assertUrlFree(dto.url ?? tab.url, effective, [id])
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
          ...(folderChanged
            ? { folderId: nextFolderId, order: await this.nextTabOrder(nextFolderId) }
            : {}),
          ...(!sameAudience(ownCurrent, nextOwn) || folderChanged ? audienceRowsData(nextOwn) : {}),
        },
        select: TAB_SELECT,
      })
      await this.log(requester.id, action, id, {
        ...fields,
        ...(folderChanged ? { folderId: nextFolderId } : {}),
        ...(!sameAudience(current, effective)
          ? { ...this.audienceLog(effective), previous: this.audienceLog(current) }
          : {}),
      })
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Onglet introuvable.')
      throw err
    }
  }

  async remove(requester: Requester, id: string) {
    const tab = await this.findTabOrFail(id)
    this.assertCanManageAudience(requester, tabAudience(tab), 'onglet')

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
    this.assertCanManageAudience(requester, tabAudience(tab), 'onglet')

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
    this.assertCanManageAudience(requester, tabAudience(tab), 'onglet')

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

    const audience = await this.resolveNewAudience(requester, dto, 'dossier')
    const max = await this.prisma.portalTabFolder.aggregate({ _max: { order: true } })

    const folder = await this.prisma.portalTabFolder.create({
      data: {
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
        isGlobal: audience.isGlobal,
        order: (max._max.order ?? -1) + 1,
        createdById: requester.id,
        businessUnits: audience.buIds.length
          ? { create: audience.buIds.map((businessUnitId) => ({ businessUnitId })) }
          : undefined,
      },
      select: FOLDER_SELECT,
    })

    await this.log(
      requester.id,
      LogAction.TAB_FOLDER_CREATED,
      folder.id,
      { name: folder.name, ...this.audienceLog(audience) },
      'PortalTabFolder'
    )

    return folder
  }

  async updateFolder(requester: Requester, id: string, dto: UpdateTabFolderDto) {
    const folder = await this.findFolderOrFail(id)
    const current = toAudience(folder)
    this.assertCanManageAudience(requester, current, 'dossier')

    const { isGlobal, businessUnitIds, ...fields } = dto
    const next =
      isGlobal !== undefined || businessUnitIds !== undefined
        ? await this.resolveAudienceChange(
            requester,
            { isGlobal, businessUnitIds },
            current,
            'dossier'
          )
        : current
    const audienceChanged = !sameAudience(current, next)

    if (audienceChanged) {
      // Les onglets du dossier suivent son audience : aucun ne doit doubler une URL déjà visible
      // dans l'une des BU qui le verront.
      const folderTabs = await this.prisma.portalTab.findMany({
        where: { folderId: id },
        select: { id: true, url: true },
      })
      const folderTabIds = folderTabs.map((t) => t.id)
      for (const t of folderTabs) await this.assertUrlFree(t.url, next, folderTabIds)
    }

    try {
      const updated = await this.prisma.portalTabFolder.update({
        where: { id },
        data: { ...fields, ...(audienceChanged ? audienceRowsData(next) : {}) },
        select: FOLDER_SELECT,
      })
      await this.log(
        requester.id,
        LogAction.TAB_FOLDER_UPDATED,
        id,
        {
          ...fields,
          ...(audienceChanged
            ? { ...this.audienceLog(next), previous: this.audienceLog(current) }
            : {}),
        },
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
    const audience = toAudience(folder)
    this.assertCanManageAudience(requester, audience, 'dossier')

    // Les onglets du dossier ne sont jamais supprimés : ils en sortent en reprenant l'audience du
    // dossier (sinon ils ne seraient plus visibles que des administrateurs).
    const folderTabs = await this.prisma.portalTab.findMany({
      where: { folderId: id },
      select: { id: true },
    })
    try {
      await this.prisma.$transaction([
        ...folderTabs.map((t) =>
          this.prisma.portalTab.update({
            where: { id: t.id },
            data: { folderId: null, ...audienceRowsData(audience) },
          })
        ),
        this.prisma.portalTabFolder.delete({ where: { id } }),
      ])
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
      select: { id: true, ...AUDIENCE_SELECT },
    })
    if (folders.length !== ids.length) throw new NotFoundException('Dossier introuvable.')
    for (const folder of folders) {
      this.assertCanManageAudience(requester, toAudience(folder), 'dossier')
    }

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
      select: TAB_AUDIENCE_SELECT,
    })
    if (tabs.length !== ids.length) throw new NotFoundException('Onglet introuvable.')
    const tabById = new Map(tabs.map((t) => [t.id, t]))

    // Résout les dossiers cibles une seule fois pour contrôler les déplacements entre dossiers.
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
          select: { id: true, ...AUDIENCE_SELECT },
        })
      : []
    const folderById = new Map(folders.map((f) => [f.id, f]))

    // Audience propre à réécrire pour chaque onglet qui entre dans un dossier ou en sort.
    const ownAudienceById = new Map<string, Audience>()
    for (const item of dto.items) {
      const tab = tabById.get(item.id)!
      const current = tabAudience(tab)
      this.assertCanManageAudience(requester, current, 'onglet')
      if (item.folderId === undefined || item.folderId === tab.folderId) continue

      if (item.folderId === null) {
        // Sortie de dossier : l'onglet garde l'audience du dossier quitté.
        ownAudienceById.set(tab.id, current)
        continue
      }
      const folder = folderById.get(item.folderId)
      if (!folder) throw new NotFoundException('Dossier introuvable.')
      const target = toAudience(folder)
      this.assertCanMoveTab(requester, current, target)
      if (!sameAudience(current, target)) await this.assertUrlFree(tab.url, target, [tab.id])
      ownAudienceById.set(tab.id, EMPTY_AUDIENCE)
    }

    await this.prisma.$transaction(
      dto.items.map((item) => {
        const own = ownAudienceById.get(item.id)
        return this.prisma.portalTab.update({
          where: { id: item.id },
          data: {
            order: item.order,
            ...(item.folderId !== undefined ? { folderId: item.folderId } : {}),
            ...(own ? audienceRowsData(own) : {}),
          },
        })
      })
    )
    await this.log(requester.id, LogAction.TAB_REORDERED, 'bulk', { count: dto.items.length })

    return { updated: dto.items.length }
  }

  private async findFolderOrFail(
    id: string,
    NotFound: typeof NotFoundException | typeof BadRequestException = NotFoundException
  ) {
    const folder = await this.prisma.portalTabFolder.findUnique({
      where: { id },
      select: { id: true, name: true, ...AUDIENCE_SELECT },
    })
    if (!folder) throw new NotFound('Dossier introuvable.')
    return folder
  }

  private async findTabOrFail(id: string) {
    const tab = await this.prisma.portalTab.findUnique({
      where: { id },
      select: TAB_AUDIENCE_SELECT,
    })
    if (!tab) throw new NotFoundException('Onglet introuvable.')
    return tab
  }

  private async nextTabOrder(folderId: string | null) {
    const max = await this.prisma.portalTab.aggregate({
      where: { folderId },
      _max: { order: true },
    })
    return (max._max.order ?? -1) + 1
  }

  /**
   * Audience d'un nouvel onglet/dossier. Un gestionnaire global la choisit librement (au moins une
   * BU, ou global) ; un responsable BU crée toujours pour sa seule BU.
   */
  private async resolveNewAudience(
    requester: Requester,
    input: AudienceInput,
    kind: 'onglet' | 'dossier'
  ): Promise<Audience> {
    let base = EMPTY_AUDIENCE
    if (!CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
      if (!requester.businessUnitId) throw new ForbiddenException('Aucune BU assignée.')
      base = { isGlobal: false, buIds: [requester.businessUnitId] }
    }
    const audience = await this.resolveAudienceChange(requester, input, base, kind)
    if (!audience.isGlobal && audience.buIds.length === 0) {
      throw new BadRequestException(`Choisissez au moins une BU, ou rendez le ${kind} global.`)
    }
    return audience
  }

  /**
   * Applique une demande d'audience (isGlobal / businessUnitIds, champs omis = inchangés) à une
   * audience de départ. Modifier la liste des BU est réservé aux gestionnaires globaux ; renvoyer
   * l'audience inchangée reste permis à tous (formulaire renvoyant les valeurs courantes).
   */
  private async resolveAudienceChange(
    requester: Requester,
    input: AudienceInput,
    base: Audience,
    kind: 'onglet' | 'dossier'
  ): Promise<Audience> {
    const isGlobal = input.isGlobal ?? (input.businessUnitIds !== undefined ? false : base.isGlobal)
    const next: Audience = isGlobal
      ? { isGlobal: true, buIds: [] }
      : { isGlobal: false, buIds: [...new Set(input.businessUnitIds ?? base.buIds)] }
    if (sameAudience(next, base)) return base

    if (!CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) {
      throw new ForbiddenException(
        `Seuls les administrateurs peuvent modifier les BU concernées par un ${kind}.`
      )
    }
    if (!next.isGlobal && next.buIds.length === 0) {
      throw new BadRequestException(`Choisissez au moins une BU, ou rendez le ${kind} global.`)
    }
    if (next.buIds.length) {
      const count = await this.prisma.businessUnit.count({ where: { id: { in: next.buIds } } })
      if (count !== next.buIds.length) throw new BadRequestException('Business Unit introuvable.')
    }
    return next
  }

  /**
   * Gestion (contenu, identifiant, rang) d'un onglet ou d'un dossier : gestionnaires globaux, ou
   * responsable d'une des BU concernées. Jamais un responsable BU sur un élément global.
   */
  private assertCanManageAudience(
    requester: Requester,
    audience: Audience,
    kind: 'onglet' | 'dossier'
  ) {
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) return
    const plural = kind === 'onglet' ? 'onglets globaux' : 'dossiers globaux'
    if (audience.isGlobal)
      throw new ForbiddenException(`Seuls les administrateurs peuvent gérer les ${plural}.`)
    if (
      CAN_MANAGE_TABS_BU_SCOPE.includes(requester.role) &&
      !!requester.businessUnitId &&
      audience.buIds.includes(requester.businessUnitId)
    )
      return
    throw new ForbiddenException(`Accès refusé à ce ${kind}.`)
  }

  /**
   * Ranger un onglet dans un dossier lui donne l'audience du dossier : un responsable BU ne peut le
   * faire que si les BU qui voient l'onglet restent les mêmes (la liste des BU étant réservée aux
   * gestionnaires globaux).
   */
  private assertCanMoveTab(requester: Requester, current: Audience, target: Audience) {
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) return
    this.assertCanManageAudience(requester, target, 'dossier')
    if (!sameAudience(current, target)) {
      throw new ForbiddenException(
        "Ce dossier ne concerne pas les mêmes BU que l'onglet : seul un administrateur peut l'y ranger."
      )
    }
  }

  /**
   * Aucune BU ne doit voir deux onglets de même URL, et deux onglets globaux ne peuvent pas avoir
   * la même URL (même contrôle qu'avant l'audience multi-BU, sans contrainte DB possible).
   */
  private async assertUrlFree(url: string, audience: Audience, excludeTabIds: string[] = []) {
    const exclude = excludeTabIds.length ? { id: { notIn: excludeTabIds } } : {}
    if (audience.isGlobal) {
      const conflict = await this.prisma.portalTab.findFirst({
        where: { url, ...exclude, OR: tabsVisibleToBu(null) },
        select: { id: true },
      })
      if (conflict) throw new BadRequestException('Cet URL existe déjà dans les onglets globaux.')
      return
    }
    if (audience.buIds.length === 0) return

    const inBus = { some: { businessUnitId: { in: audience.buIds } } }
    const conflict = await this.prisma.portalTab.findFirst({
      where: {
        url,
        ...exclude,
        OR: [{ folderId: null, businessUnits: inBus }, { folder: { businessUnits: inBus } }],
      },
      select: TAB_AUDIENCE_SELECT,
    })
    if (!conflict) return
    const conflictBuIds = tabAudience(conflict).buIds
    const buId = audience.buIds.find((b) => conflictBuIds.includes(b))
    const bu = buId
      ? await this.prisma.businessUnit.findUnique({ where: { id: buId }, select: { name: true } })
      : null
    throw new BadRequestException(
      bu ? `Cet URL existe déjà pour la BU « ${bu.name} ».` : 'Cet URL existe déjà pour cette BU.'
    )
  }

  /**
   * Vérifie qu'un onglet est *visible* pour le requester — même règle que findAll() (global, ou
   * BU du requester parmi les BU concernées par l'onglet ou son dossier), avec la même exigence
   * isActive pour les rôles en lecture seule (CAN_VIEW_TABS_OWN_BU). Contrairement à
   * assertCanManageAudience, voir l'identifiant partagé est ouvert à tout utilisateur qui verrait
   * l'onglet dans la liste.
   */
  private assertCanViewTab(
    requester: Requester,
    tab: AudienceRows & { isActive: boolean; folder: AudienceRows | null }
  ) {
    const isViewerOnlyRole = CAN_VIEW_TABS_OWN_BU.includes(requester.role)
    if (isViewerOnlyRole && !tab.isActive) {
      throw new ForbiddenException('Onglet désactivé.')
    }
    const audience = tabAudience(tab)
    if (audience.isGlobal) return
    if (CAN_MANAGE_TABS_GLOBAL.includes(requester.role)) return
    if (requester.businessUnitId && audience.buIds.includes(requester.businessUnitId)) return
    throw new ForbiddenException('Accès refusé à cet onglet.')
  }

  private audienceLog(audience: Audience) {
    return audience.isGlobal ? { isGlobal: true } : { businessUnitIds: audience.buIds }
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
