import { ForbiddenException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { AnnouncementsService } from './announcements.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { AnnouncementsGateway } from './announcements.gateway'
import type { NotificationsService } from '../notifications/notifications.service'

/**
 * Couvre l'enrichissement DAF/RESPONSABLE_BU : ils peuvent désormais publier/gérer des annonces,
 * mais strictement limitées à leur propre BU — jamais une annonce globale, jamais celle d'une
 * autre BU.
 */
describe('AnnouncementsService — annonces scopées BU (DAF/RESPONSABLE_BU)', () => {
  let service: AnnouncementsService
  let prisma: {
    announcement: {
      create: jest.Mock
      update: jest.Mock
      delete: jest.Mock
      findUnique: jest.Mock
      findMany: jest.Mock
    }
    businessUnit: { findUnique: jest.Mock }
    user: { findMany: jest.Mock }
    activityLog: { create: jest.Mock }
  }
  let gateway: { emitChanged: jest.Mock }
  let notifications: { notifyUsers: jest.Mock }

  beforeEach(() => {
    prisma = {
      announcement: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...data })),
        delete: jest.fn().mockResolvedValue({ id: 'a1' }),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      businessUnit: { findUnique: jest.fn().mockResolvedValue({ id: 'buA' }) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
    }
    gateway = { emitChanged: jest.fn() }
    notifications = { notifyUsers: jest.fn().mockResolvedValue(undefined) }

    service = new AnnouncementsService(
      prisma as unknown as PrismaService,
      gateway as unknown as AnnouncementsGateway,
      notifications as unknown as NotificationsService
    )
  })

  const dafBuA = { id: 'daf1', role: Role.DAF, businessUnitId: 'buA' }
  const responsableBuB = { id: 'rbu1', role: Role.RESPONSABLE_BU, businessUnitId: 'buB' }
  const employe = { id: 'e1', role: Role.EMPLOYE, businessUnitId: 'buA' }

  const baseDto = { title: 'Info', body: 'Contenu', businessUnitId: null }

  describe('create', () => {
    it('force la BU du manager scopé même si un autre businessUnitId est fourni', async () => {
      await service.create({ ...baseDto, businessUnitId: 'buB' } as never, dafBuA)

      expect(prisma.announcement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ businessUnitId: 'buA' }) })
      )
    })

    it('force la BU même quand aucune BU cible n’est fournie (jamais globale)', async () => {
      await service.create({ ...baseDto } as never, responsableBuB)

      expect(prisma.announcement.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ businessUnitId: 'buB' }) })
      )
    })

    it('refuse un rôle non habilité', async () => {
      await expect(service.create({ ...baseDto } as never, employe)).rejects.toThrow(
        ForbiddenException
      )
    })
  })

  describe('update', () => {
    it("refuse à un manager scopé de modifier l'annonce d'une autre BU", async () => {
      prisma.announcement.findUnique.mockResolvedValue({
        id: 'a1',
        businessUnitId: 'buB',
        publishedAt: new Date(),
        expiresAt: null,
      })

      await expect(service.update('a1', { title: 'x' } as never, dafBuA)).rejects.toThrow(
        ForbiddenException
      )
      expect(prisma.announcement.update).not.toHaveBeenCalled()
    })

    it('refuse un manager scopé qui tente de déplacer son annonce hors de sa BU', async () => {
      prisma.announcement.findUnique.mockResolvedValue({
        id: 'a1',
        businessUnitId: 'buA',
        publishedAt: new Date(),
        expiresAt: null,
      })

      await expect(
        service.update('a1', { businessUnitId: 'buB' } as never, dafBuA)
      ).rejects.toThrow(ForbiddenException)
    })

    it('autorise un manager scopé à modifier une annonce de sa propre BU', async () => {
      prisma.announcement.findUnique.mockResolvedValue({
        id: 'a1',
        businessUnitId: 'buA',
        publishedAt: new Date(),
        expiresAt: null,
      })

      await service.update('a1', { title: 'Nouveau titre' } as never, dafBuA)

      expect(prisma.announcement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: expect.objectContaining({ title: 'Nouveau titre' }),
        })
      )
    })
  })

  describe('remove', () => {
    it("refuse la suppression de l'annonce d'une autre BU", async () => {
      prisma.announcement.findUnique.mockResolvedValue({ id: 'a1', businessUnitId: 'buB' })

      await expect(service.remove('a1', dafBuA)).rejects.toThrow(ForbiddenException)
      expect(prisma.announcement.delete).not.toHaveBeenCalled()
    })

    it('autorise la suppression d’une annonce de sa propre BU', async () => {
      prisma.announcement.findUnique.mockResolvedValue({
        id: 'a1',
        businessUnitId: 'buA',
        title: 'x',
      })

      await service.remove('a1', dafBuA)

      expect(prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
    })
  })

  describe('findAll — liste de gestion (activeOnly=false)', () => {
    it('un manager scopé voit toutes ses annonces (y compris inactives), jamais une autre BU', () => {
      service.findAll(dafBuA, false)

      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ businessUnitId: 'buA' }] },
        })
      )
    })

    it('en mode widget (activeOnly=true), un manager scopé reste un destinataire classique (global + sa BU, actives)', () => {
      service.findAll(dafBuA, true)

      const where = prisma.announcement.findMany.mock.calls[0][0].where
      expect(where.AND).toHaveLength(2)
      expect(where.AND[1]).toEqual({ OR: [{ businessUnitId: null }, { businessUnitId: 'buA' }] })
    })
  })
})
