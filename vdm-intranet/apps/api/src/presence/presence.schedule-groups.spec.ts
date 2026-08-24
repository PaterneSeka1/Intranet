import { ForbiddenException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { PresenceService } from './presence.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { PresenceScheduleService } from './presence.schedule.service'
import type { NotificationsService } from '../notifications/notifications.service'
import type { LeaveSyncService } from '../leaves/leave-sync.service'
import type { PublicHolidaysService } from '../public-holidays/public-holidays.service'

/**
 * Couvre l'enrichissement RESPONSABLE_BU : gestion des groupes horaires, mais strictement
 * restreinte à sa propre BU — jamais un groupe global (`businessUnitId: null`), jamais celui
 * d'une autre BU.
 */
describe('PresenceService — groupes horaires scopés BU (RESPONSABLE_BU)', () => {
  let service: PresenceService
  let prisma: {
    scheduleGroup: {
      create: jest.Mock
      update: jest.Mock
      delete: jest.Mock
      findUnique: jest.Mock
    }
    activityLog: { create: jest.Mock }
  }

  beforeEach(() => {
    prisma = {
      scheduleGroup: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'g1', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'g1', ...args.data })),
        delete: jest.fn().mockResolvedValue({ id: 'g1' }),
        findUnique: jest.fn(),
      },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
    }

    service = new PresenceService(
      prisma as unknown as PrismaService,
      {} as unknown as PresenceScheduleService,
      {} as unknown as NotificationsService,
      {} as unknown as LeaveSyncService,
      {} as unknown as PublicHolidaysService
    )
  })

  const ctoAdmin = { id: 'cto1', role: Role.CTO_ADMIN, businessUnitId: null, poleId: null }
  const responsableBuA = {
    id: 'rbu1',
    role: Role.RESPONSABLE_BU,
    businessUnitId: 'buA',
    poleId: null,
  }

  const baseDto = {
    name: 'Nuit',
    code: 'NUIT',
    expectedArrivalTime: '20:00',
  }

  describe('createScheduleGroup', () => {
    it('force la BU du RESPONSABLE_BU même si un autre businessUnitId est fourni', async () => {
      await service.createScheduleGroup(
        { ...baseDto, businessUnitId: 'buB' } as never,
        responsableBuA
      )

      expect(prisma.scheduleGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ businessUnitId: 'buA' }) })
      )
    })

    it('permet au CTO_ADMIN de créer un groupe global (businessUnitId null)', async () => {
      await service.createScheduleGroup({ ...baseDto } as never, ctoAdmin)

      expect(prisma.scheduleGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ businessUnitId: null }) })
      )
    })
  })

  describe('updateScheduleGroup', () => {
    it("refuse à un RESPONSABLE_BU de modifier le groupe d'une autre BU", async () => {
      prisma.scheduleGroup.findUnique.mockResolvedValue({ id: 'g1', businessUnitId: 'buB' })

      await expect(
        service.updateScheduleGroup('g1', { name: 'x' } as never, responsableBuA)
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.scheduleGroup.update).not.toHaveBeenCalled()
    })

    it('refuse à un RESPONSABLE_BU de déplacer son groupe hors de sa BU', async () => {
      prisma.scheduleGroup.findUnique.mockResolvedValue({ id: 'g1', businessUnitId: 'buA' })

      await expect(
        service.updateScheduleGroup('g1', { businessUnitId: 'buB' } as never, responsableBuA)
      ).rejects.toThrow(ForbiddenException)
    })

    it('autorise un RESPONSABLE_BU à modifier un groupe de sa propre BU', async () => {
      prisma.scheduleGroup.findUnique.mockResolvedValue({ id: 'g1', businessUnitId: 'buA' })

      await service.updateScheduleGroup('g1', { name: 'Nuit TV/Radio' } as never, responsableBuA)

      expect(prisma.scheduleGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Nuit TV/Radio' } })
      )
    })
  })

  describe('deleteScheduleGroup', () => {
    it("refuse à un RESPONSABLE_BU de supprimer le groupe d'une autre BU", async () => {
      prisma.scheduleGroup.findUnique.mockResolvedValue({
        id: 'g1',
        businessUnitId: 'buB',
        _count: { users: 0 },
      })

      await expect(service.deleteScheduleGroup('g1', responsableBuA)).rejects.toThrow(
        ForbiddenException
      )
      expect(prisma.scheduleGroup.delete).not.toHaveBeenCalled()
    })

    it('autorise un RESPONSABLE_BU à supprimer un groupe vide de sa propre BU', async () => {
      prisma.scheduleGroup.findUnique.mockResolvedValue({
        id: 'g1',
        businessUnitId: 'buA',
        name: 'Nuit',
        _count: { users: 0 },
      })

      await service.deleteScheduleGroup('g1', responsableBuA)

      expect(prisma.scheduleGroup.delete).toHaveBeenCalledWith({ where: { id: 'g1' } })
    })
  })
})
