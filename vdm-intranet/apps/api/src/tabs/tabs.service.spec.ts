import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { TabsService } from './tabs.service'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * Couvre le partage d'un onglet de BU avec d'autres BU (PortalTabShare) : réservé aux
 * gestionnaires globaux, interdit sur un onglet global, sans doublon d'URL dans une BU
 * destinataire, et visibilité (identifiant partagé compris) étendue aux BU destinataires.
 */
describe('TabsService — onglets partagés entre BU', () => {
  let service: TabsService
  let prisma: {
    portalTab: {
      create: jest.Mock
      update: jest.Mock
      findUnique: jest.Mock
      findFirst: jest.Mock
      aggregate: jest.Mock
    }
    portalTabCredential: { findUnique: jest.Mock }
    businessUnit: { count: jest.Mock; findUnique: jest.Mock }
    activityLog: { create: jest.Mock }
  }

  beforeEach(() => {
    prisma = {
      portalTab: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't1', ...data })),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _max: { order: null } }),
      },
      portalTabCredential: { findUnique: jest.fn().mockResolvedValue(null) },
      businessUnit: {
        count: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.length)),
        findUnique: jest.fn().mockResolvedValue({ name: 'BU B' }),
      },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
    }
    service = new TabsService(prisma as unknown as PrismaService)
  })

  const admin = { id: 'adm', role: Role.CTO_ADMIN, businessUnitId: null }
  const responsableBuA = { id: 'rbuA', role: Role.RESPONSABLE_BU, businessUnitId: 'buA' }
  const employeBuB = { id: 'eB', role: Role.EMPLOYE, businessUnitId: 'buB' }
  const employeBuC = { id: 'eC', role: Role.EMPLOYE, businessUnitId: 'buC' }

  const baseDto = { name: 'Outil', url: 'https://outil.example.com' }

  describe('create', () => {
    it('crée les partages demandés par un admin, sans la BU propriétaire', async () => {
      await service.create(admin, {
        ...baseDto,
        businessUnitId: 'buA',
        sharedBusinessUnitIds: ['buB', 'buA', 'buB'],
      })
      const { data } = prisma.portalTab.create.mock.calls[0][0]
      expect(data.businessUnitId).toBe('buA')
      expect(data.shares).toEqual({ create: [{ businessUnitId: 'buB' }] })
    })

    it('refuse le partage demandé par un responsable BU', async () => {
      await expect(
        service.create(responsableBuA, { ...baseDto, sharedBusinessUnitIds: ['buB'] })
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.portalTab.create).not.toHaveBeenCalled()
    })

    it('refuse de partager un onglet global', async () => {
      await expect(
        service.create(admin, { ...baseDto, sharedBusinessUnitIds: ['buB'] })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('refuse une URL déjà visible dans une BU destinataire', async () => {
      prisma.portalTab.findFirst.mockResolvedValue({ businessUnitId: 'buB', shares: [] })
      await expect(
        service.create(admin, { ...baseDto, businessUnitId: 'buA', sharedBusinessUnitIds: ['buB'] })
      ).rejects.toThrow('Cet URL existe déjà pour la BU « BU B ».')
    })
  })

  describe('update', () => {
    it('remplace la liste des partages', async () => {
      prisma.portalTab.findUnique.mockResolvedValue({
        id: 't1',
        name: 'Outil',
        url: baseDto.url,
        businessUnitId: 'buA',
        isActive: true,
        shares: [{ businessUnitId: 'buB' }],
      })
      await service.update(admin, 't1', { sharedBusinessUnitIds: ['buC'] })
      const { data } = prisma.portalTab.update.mock.calls[0][0]
      expect(data.shares).toEqual({ deleteMany: {}, create: [{ businessUnitId: 'buC' }] })
      expect(data).not.toHaveProperty('sharedBusinessUnitIds')
    })
  })

  describe('getCredential (visibilité)', () => {
    beforeEach(() => {
      prisma.portalTab.findUnique.mockResolvedValue({
        id: 't1',
        name: 'Outil',
        url: baseDto.url,
        businessUnitId: 'buA',
        isActive: true,
        shares: [{ businessUnitId: 'buB' }],
      })
    })

    it("autorise un employé d'une BU destinataire", async () => {
      // Accès accordé : on atteint la recherche de l'identifiant (absent ici).
      await expect(service.getCredential(employeBuB, 't1')).rejects.toBeInstanceOf(
        NotFoundException
      )
    })

    it("refuse un employé d'une BU non destinataire", async () => {
      await expect(service.getCredential(employeBuC, 't1')).rejects.toBeInstanceOf(
        ForbiddenException
      )
    })
  })
})
