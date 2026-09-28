import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { TabsService } from './tabs.service'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * Couvre l'audience des onglets et dossiers : global ou liste de BU concernées (toutes au même
 * niveau), modifiable par les seuls gestionnaires globaux ; un responsable BU gère le contenu des
 * éléments concernant sa BU ; un onglet rangé dans un dossier hérite de l'audience du dossier ;
 * aucune BU ne voit deux onglets de même URL.
 */
describe('TabsService — audience des onglets et dossiers', () => {
  let service: TabsService
  let prisma: {
    portalTab: {
      create: jest.Mock
      update: jest.Mock
      findUnique: jest.Mock
      findFirst: jest.Mock
      findMany: jest.Mock
      aggregate: jest.Mock
    }
    portalTabFolder: {
      create: jest.Mock
      update: jest.Mock
      delete: jest.Mock
      findUnique: jest.Mock
      findMany: jest.Mock
      aggregate: jest.Mock
    }
    portalTabCredential: { findUnique: jest.Mock }
    businessUnit: { count: jest.Mock; findUnique: jest.Mock }
    activityLog: { create: jest.Mock }
    $transaction: jest.Mock
  }

  beforeEach(() => {
    prisma = {
      portalTab: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't1', ...data })),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _max: { order: null } }),
      },
      portalTabFolder: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'f1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'f1', ...data })),
        delete: jest.fn().mockResolvedValue({ id: 'f1' }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _max: { order: null } }),
      },
      portalTabCredential: { findUnique: jest.fn().mockResolvedValue(null) },
      businessUnit: {
        count: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.length)),
        findUnique: jest.fn().mockResolvedValue({ name: 'BU B' }),
      },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    }
    service = new TabsService(prisma as unknown as PrismaService)
  })

  const admin = { id: 'adm', role: Role.CTO_ADMIN, businessUnitId: null }
  const responsableBuA = { id: 'rbuA', role: Role.RESPONSABLE_BU, businessUnitId: 'buA' }
  const employeBuB = { id: 'eB', role: Role.EMPLOYE, businessUnitId: 'buB' }
  const employeBuC = { id: 'eC', role: Role.EMPLOYE, businessUnitId: 'buC' }

  const baseDto = { name: 'Outil', url: 'https://outil.example.com' }

  const bus = (...ids: string[]) => ids.map((businessUnitId) => ({ businessUnitId }))

  /** Onglet hors dossier concernant les BU données. */
  const rootTab = (...buIds: string[]) => ({
    id: 't1',
    name: 'Outil',
    url: baseDto.url,
    isActive: true,
    folderId: null,
    isGlobal: false,
    businessUnits: bus(...buIds),
    folder: null,
  })

  /** Onglet rangé dans un dossier concernant les BU données. */
  const tabInFolder = (...buIds: string[]) => ({
    ...rootTab(),
    folderId: 'f1',
    folder: { isGlobal: false, businessUnits: bus(...buIds) },
  })

  const folder = (...buIds: string[]) => ({
    id: 'f1',
    name: 'Commun',
    isGlobal: false,
    businessUnits: bus(...buIds),
  })

  describe('create', () => {
    it('crée un onglet pour plusieurs BU à la fois, sans doublon', async () => {
      await service.create(admin, { ...baseDto, businessUnitIds: ['buA', 'buB', 'buA'] })
      const { data } = prisma.portalTab.create.mock.calls[0][0]
      expect(data.isGlobal).toBe(false)
      expect(data.businessUnits).toEqual({ create: bus('buA', 'buB') })
    })

    it('crée un onglet global', async () => {
      await service.create(admin, { ...baseDto, isGlobal: true, businessUnitIds: ['buA'] })
      const { data } = prisma.portalTab.create.mock.calls[0][0]
      expect(data.isGlobal).toBe(true)
      expect(data.businessUnits).toBeUndefined()
    })

    it('refuse un onglet sans BU ni audience globale', async () => {
      await expect(service.create(admin, baseDto)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('un responsable BU crée pour sa seule BU', async () => {
      await service.create(responsableBuA, baseDto)
      const { data } = prisma.portalTab.create.mock.calls[0][0]
      expect(data.businessUnits).toEqual({ create: bus('buA') })
    })

    it("refuse qu'un responsable BU ajoute d'autres BU", async () => {
      await expect(
        service.create(responsableBuA, { ...baseDto, businessUnitIds: ['buA', 'buB'] })
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.portalTab.create).not.toHaveBeenCalled()
    })

    it("rangé dans un dossier, l'onglet n'a pas d'audience propre", async () => {
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA', 'buB'))
      await service.create(responsableBuA, { ...baseDto, folderId: 'f1' })
      const { data } = prisma.portalTab.create.mock.calls[0][0]
      expect(data.folderId).toBe('f1')
      expect(data.isGlobal).toBe(false)
      expect(data.businessUnits).toBeUndefined()
    })

    it("refuse une URL déjà visible dans l'une des BU concernées", async () => {
      prisma.portalTab.findFirst.mockResolvedValue(rootTab('buB'))
      await expect(
        service.create(admin, { ...baseDto, businessUnitIds: ['buA', 'buB'] })
      ).rejects.toThrow('Cet URL existe déjà pour la BU « BU B ».')
    })
  })

  describe('update', () => {
    it('ajoute et retire des BU librement', async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA', 'buB'))
      await service.update(admin, 't1', { businessUnitIds: ['buB', 'buC'] })
      const { data } = prisma.portalTab.update.mock.calls[0][0]
      expect(data.isGlobal).toBe(false)
      expect(data.businessUnits).toEqual({ deleteMany: {}, create: bus('buB', 'buC') })
      expect(data).not.toHaveProperty('businessUnitIds')
    })

    it('un responsable BU modifie le contenu d’un onglet commun à sa BU', async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA', 'buB'))
      await service.update(responsableBuA, 't1', { name: 'Nouveau nom' })
      const { data } = prisma.portalTab.update.mock.calls[0][0]
      expect(data.name).toBe('Nouveau nom')
      expect(data).not.toHaveProperty('businessUnits')
    })

    it('un responsable BU peut renvoyer la liste inchangée (dans un autre ordre)', async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA', 'buB'))
      await service.update(responsableBuA, 't1', { businessUnitIds: ['buB', 'buA'] })
      expect(prisma.portalTab.update.mock.calls[0][0].data).not.toHaveProperty('businessUnits')
    })

    it('refuse qu’un responsable BU modifie la liste des BU', async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA', 'buB'))
      await expect(
        service.update(responsableBuA, 't1', { businessUnitIds: ['buA'] })
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.portalTab.update).not.toHaveBeenCalled()
    })

    it('refuse un responsable BU dont la BU n’est pas concernée', async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buB'))
      await expect(service.update(responsableBuA, 't1', { name: 'X' })).rejects.toBeInstanceOf(
        ForbiddenException
      )
    })

    it('refuse de retirer toutes les BU sans rendre l’onglet global', async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA'))
      await expect(
        service.update(admin, 't1', { isGlobal: false, businessUnitIds: [] })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('en sortant de son dossier, l’onglet garde l’audience du dossier', async () => {
      prisma.portalTab.findUnique.mockResolvedValue(tabInFolder('buA', 'buB'))
      await service.update(responsableBuA, 't1', { folderId: null })
      const { data } = prisma.portalTab.update.mock.calls[0][0]
      expect(data.folderId).toBeNull()
      expect(data.businessUnits).toEqual({ deleteMany: {}, create: bus('buA', 'buB') })
    })

    it("refuse qu'un responsable BU range l'onglet dans un dossier d'autres BU", async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA'))
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA', 'buB'))
      await expect(service.update(responsableBuA, 't1', { folderId: 'f1' })).rejects.toBeInstanceOf(
        ForbiddenException
      )
    })

    it("un admin range l'onglet dans un dossier : il perd son audience propre", async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA'))
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA', 'buB'))
      await service.update(admin, 't1', { folderId: 'f1' })
      const { data } = prisma.portalTab.update.mock.calls[0][0]
      expect(data.folderId).toBe('f1')
      expect(data.businessUnits).toEqual({ deleteMany: {}, create: [] })
    })

    it("refuse de modifier l'audience d'un onglet rangé dans un dossier", async () => {
      prisma.portalTab.findUnique.mockResolvedValue(tabInFolder('buA'))
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA'))
      await expect(
        service.update(admin, 't1', { businessUnitIds: ['buB'] })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('refuse de rendre global un onglet dont l’URL existe déjà en global', async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA'))
      prisma.portalTab.findFirst.mockResolvedValue({ id: 't2' })
      await expect(service.update(admin, 't1', { isGlobal: true })).rejects.toThrow(
        'Cet URL existe déjà dans les onglets globaux.'
      )
    })
  })

  describe('dossiers', () => {
    it('crée un dossier pour plusieurs BU', async () => {
      await service.createFolder(admin, { name: 'VdM RH', businessUnitIds: ['buA', 'buB'] })
      const { data } = prisma.portalTabFolder.create.mock.calls[0][0]
      expect(data.businessUnits).toEqual({ create: bus('buA', 'buB') })
    })

    it('modifie la liste des BU d’un dossier', async () => {
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA', 'buB'))
      await service.updateFolder(admin, 'f1', { businessUnitIds: ['buC'] })
      const { data } = prisma.portalTabFolder.update.mock.calls[0][0]
      expect(data.businessUnits).toEqual({ deleteMany: {}, create: bus('buC') })
    })

    it('refuse qu’un responsable BU modifie la liste des BU d’un dossier', async () => {
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA'))
      await expect(
        service.updateFolder(responsableBuA, 'f1', { businessUnitIds: ['buA', 'buB'] })
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('un responsable BU renomme un dossier commun à sa BU', async () => {
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA', 'buB'))
      await service.updateFolder(responsableBuA, 'f1', { name: 'Réseaux sociaux' })
      expect(prisma.portalTabFolder.update.mock.calls[0][0].data).toEqual({
        name: 'Réseaux sociaux',
      })
    })

    it('refuse une BU ajoutée au dossier où un de ses onglets doublerait une URL', async () => {
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA'))
      prisma.portalTab.findMany.mockResolvedValue([{ id: 't1', url: baseDto.url }])
      prisma.portalTab.findFirst.mockResolvedValue(rootTab('buB'))
      await expect(
        service.updateFolder(admin, 'f1', { businessUnitIds: ['buA', 'buB'] })
      ).rejects.toThrow('Cet URL existe déjà pour la BU « BU B ».')
      expect(prisma.portalTab.findFirst.mock.calls[0][0].where.id).toEqual({ notIn: ['t1'] })
      expect(prisma.portalTabFolder.update).not.toHaveBeenCalled()
    })

    it('à la suppression du dossier, ses onglets reprennent son audience', async () => {
      prisma.portalTabFolder.findUnique.mockResolvedValue(folder('buA', 'buB'))
      prisma.portalTab.findMany.mockResolvedValue([{ id: 't1' }])
      await service.removeFolder(admin, 'f1')
      const { data } = prisma.portalTab.update.mock.calls[0][0]
      expect(data.folderId).toBeNull()
      expect(data.businessUnits).toEqual({ deleteMany: {}, create: bus('buA', 'buB') })
      expect(prisma.portalTabFolder.delete).toHaveBeenCalledWith({ where: { id: 'f1' } })
    })
  })

  describe('getCredential (visibilité)', () => {
    // Identifiant absent : un accès accordé aboutit à NotFound, un accès refusé à Forbidden.
    it("autorise un employé d'une BU concernée", async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA', 'buB'))
      await expect(service.getCredential(employeBuB, 't1')).rejects.toBeInstanceOf(
        NotFoundException
      )
    })

    it("autorise un employé d'une BU concernée par le dossier de l'onglet", async () => {
      prisma.portalTab.findUnique.mockResolvedValue(tabInFolder('buA', 'buB'))
      await expect(service.getCredential(employeBuB, 't1')).rejects.toBeInstanceOf(
        NotFoundException
      )
    })

    it("refuse un employé d'une BU non concernée", async () => {
      prisma.portalTab.findUnique.mockResolvedValue(rootTab('buA', 'buB'))
      await expect(service.getCredential(employeBuC, 't1')).rejects.toBeInstanceOf(
        ForbiddenException
      )
    })
  })
})
