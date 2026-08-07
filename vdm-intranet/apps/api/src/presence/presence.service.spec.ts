import { ForbiddenException, BadRequestException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { PresenceService } from './presence.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { PresenceScheduleService } from './presence.schedule.service'
import type { NotificationsService } from '../notifications/notifications.service'
import type { LeaveSyncService } from '../leaves/leave-sync.service'
import type { PublicHolidaysService } from '../public-holidays/public-holidays.service'

/**
 * Couvre le scoping BU/Pôle du nouvel endpoint de création en masse de mandats
 * (`bulkCreateMandates`) et l'extension du filtre `userId` sur `getMandates` : un responsable ne
 * doit jamais pouvoir mandater/lire hors de son périmètre, y compris via le paramètre `userId`.
 */
describe('PresenceService — mandats', () => {
  let service: PresenceService
  let prisma: {
    user: { findUnique: jest.Mock }
    dailyMandate: {
      upsert: jest.Mock
      findMany: jest.Mock
      findUnique: jest.Mock
      delete: jest.Mock
    }
    activityLog: { create: jest.Mock }
    $transaction: jest.Mock
  }
  let notifications: { notifyUser: jest.Mock }

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      dailyMandate: {
        upsert: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 'm1' }),
      },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((arg: unknown) =>
        Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma)
      ),
    }
    notifications = { notifyUser: jest.fn().mockResolvedValue(undefined) }

    service = new PresenceService(
      prisma as unknown as PrismaService,
      {} as unknown as PresenceScheduleService,
      notifications as unknown as NotificationsService,
      {} as unknown as LeaveSyncService,
      {} as unknown as PublicHolidaysService
    )
  })

  const responsableBuA = {
    id: 'r1',
    role: Role.RESPONSABLE_BU,
    businessUnitId: 'buA',
    poleId: null,
  }
  const ctoAdmin = { id: 'cto1', role: Role.CTO_ADMIN, businessUnitId: null, poleId: null }
  const pdg = { id: 'pdg1', role: Role.PDG, businessUnitId: null, poleId: null }

  describe('bulkCreateMandates', () => {
    const days = [
      { date: '2026-08-10', expectedArrivalTime: '20:00', isNightShift: true },
      { date: '2026-08-11', expectedArrivalTime: '10:00', isNightShift: false },
    ]

    it('autorise un RESPONSABLE_BU à peindre un mois pour un employé de sa propre BU', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        role: Role.EMPLOYE,
        businessUnitId: 'buA',
        poleId: null,
        isActive: true,
      })

      const result = await service.bulkCreateMandates({ userId: 'target', days }, responsableBuA)

      expect(result).toHaveLength(2)
      expect(prisma.dailyMandate.upsert).toHaveBeenCalledTimes(2)
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        'target',
        expect.objectContaining({ title: 'Planning mensuel mis à jour' })
      )
    })

    it("refuse un RESPONSABLE_BU qui cible un employé d'une autre BU", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        role: Role.EMPLOYE,
        businessUnitId: 'buB',
        poleId: null,
        isActive: true,
      })

      await expect(
        service.bulkCreateMandates({ userId: 'target', days }, responsableBuA)
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.dailyMandate.upsert).not.toHaveBeenCalled()
    })

    it('rejette un payload contenant des dates en double, sans écrire en base', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        role: Role.EMPLOYE,
        businessUnitId: 'buA',
        poleId: null,
        isActive: true,
      })
      const duplicated = [
        { date: '2026-08-10', expectedArrivalTime: '20:00' },
        { date: '2026-08-10', expectedArrivalTime: '10:00' },
      ]

      await expect(
        service.bulkCreateMandates({ userId: 'target', days: duplicated }, responsableBuA)
      ).rejects.toThrow(BadRequestException)
      expect(prisma.dailyMandate.upsert).not.toHaveBeenCalled()
    })
  })

  describe('Règle absolue — le CTO_ADMIN ne gère jamais l’emploi du temps du PDG', () => {
    it('refuse bulkCreateMandates quand un CTO_ADMIN cible le PDG', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'pdg1',
        role: Role.PDG,
        businessUnitId: null,
        poleId: null,
        isActive: true,
      })

      await expect(
        service.bulkCreateMandates(
          { userId: 'pdg1', days: [{ date: '2026-08-10', expectedArrivalTime: '09:00' }] },
          ctoAdmin
        )
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.dailyMandate.upsert).not.toHaveBeenCalled()
    })

    it('refuse createMandate quand un CTO_ADMIN cible le PDG', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'pdg1',
        role: Role.PDG,
        businessUnitId: null,
        poleId: null,
        isActive: true,
      })

      await expect(
        service.createMandate(
          { userId: 'pdg1', date: '2026-08-10', expectedArrivalTime: '09:00' },
          ctoAdmin
        )
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.dailyMandate.upsert).not.toHaveBeenCalled()
    })

    it('autorise en revanche le PDG à mandater le CTO_ADMIN (accès global inchangé)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'cto1',
        role: Role.CTO_ADMIN,
        businessUnitId: null,
        poleId: null,
        isActive: true,
      })

      const result = await service.bulkCreateMandates(
        { userId: 'cto1', days: [{ date: '2026-08-10', expectedArrivalTime: '09:00' }] },
        pdg
      )

      expect(result).toHaveLength(1)
      expect(prisma.dailyMandate.upsert).toHaveBeenCalledTimes(1)
    })

    it("refuse deleteMandate à un CTO_ADMIN sur un mandat du PDG, même s'il en est le créateur (repli createdById inopérant)", async () => {
      prisma.dailyMandate.findUnique.mockResolvedValue({
        id: 'm1',
        userId: 'pdg1',
        createdById: 'cto1', // simule un mandat créé avant l'introduction de cette règle
        user: { role: Role.PDG, businessUnitId: null, poleId: null },
      })

      await expect(service.deleteMandate('m1', ctoAdmin)).rejects.toThrow(ForbiddenException)
      expect(prisma.dailyMandate.delete).not.toHaveBeenCalled()
    })

    it('autorise en revanche le PDG à supprimer un mandat du CTO_ADMIN', async () => {
      prisma.dailyMandate.findUnique.mockResolvedValue({
        id: 'm2',
        userId: 'cto1',
        createdById: 'someone-else',
        user: { role: Role.CTO_ADMIN, businessUnitId: null, poleId: null },
      })

      const result = await service.deleteMandate('m2', pdg)

      expect(result).toEqual({ deleted: true })
      expect(prisma.dailyMandate.delete).toHaveBeenCalledWith({ where: { id: 'm2' } })
    })
  })

  describe('Règle absolue — un responsable ne définit jamais lui-même son propre planning', () => {
    it('refuse bulkCreateMandates quand un RESPONSABLE_BU se cible lui-même', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'r1',
        role: Role.RESPONSABLE_BU,
        businessUnitId: 'buA',
        poleId: null,
        isActive: true,
      })

      await expect(
        service.bulkCreateMandates(
          { userId: 'r1', days: [{ date: '2026-08-10', expectedArrivalTime: '09:00' }] },
          responsableBuA
        )
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.dailyMandate.upsert).not.toHaveBeenCalled()
    })

    it('refuse createMandate quand un CTO_ADMIN se cible lui-même', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'cto1',
        role: Role.CTO_ADMIN,
        businessUnitId: null,
        poleId: null,
        isActive: true,
      })

      await expect(
        service.createMandate(
          { userId: 'cto1', date: '2026-08-10', expectedArrivalTime: '09:00' },
          ctoAdmin
        )
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.dailyMandate.upsert).not.toHaveBeenCalled()
    })

    it('autorise en revanche le PDG à définir son propre planning', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'pdg1',
        role: Role.PDG,
        businessUnitId: null,
        poleId: null,
        isActive: true,
      })

      const result = await service.bulkCreateMandates(
        { userId: 'pdg1', days: [{ date: '2026-08-10', expectedArrivalTime: '09:00' }] },
        pdg
      )

      expect(result).toHaveLength(1)
      expect(prisma.dailyMandate.upsert).toHaveBeenCalledTimes(1)
    })

    it("refuse deleteMandate à un RESPONSABLE_BU sur son propre mandat, même s'il en est le créateur (repli createdById inopérant)", async () => {
      prisma.dailyMandate.findUnique.mockResolvedValue({
        id: 'm3',
        userId: 'r1',
        createdById: 'r1', // simule un mandat créé avant l'introduction de cette règle
        user: { role: Role.RESPONSABLE_BU, businessUnitId: 'buA', poleId: null },
      })

      await expect(service.deleteMandate('m3', responsableBuA)).rejects.toThrow(
        ForbiddenException
      )
      expect(prisma.dailyMandate.delete).not.toHaveBeenCalled()
    })

    it('autorise en revanche le PDG à supprimer son propre mandat', async () => {
      prisma.dailyMandate.findUnique.mockResolvedValue({
        id: 'm4',
        userId: 'pdg1',
        createdById: 'pdg1',
        user: { role: Role.PDG, businessUnitId: null, poleId: null },
      })

      const result = await service.deleteMandate('m4', pdg)

      expect(result).toEqual({ deleted: true })
      expect(prisma.dailyMandate.delete).toHaveBeenCalledWith({ where: { id: 'm4' } })
    })
  })

  describe('getMandates — filtre userId composé en AND du scope', () => {
    it("n'élargit jamais le périmètre d'un responsable BU même si un userId hors périmètre est passé", async () => {
      prisma.dailyMandate.findMany.mockResolvedValue([])

      await service.getMandates(responsableBuA, { userId: 'employe-hors-bu' })

      const call = prisma.dailyMandate.findMany.mock.calls[0][0]
      // Le where doit combiner scope ET userId via AND, jamais remplacer le scope par le userId reçu.
      expect(call.where.user.AND).toEqual([{ businessUnitId: 'buA' }, { id: 'employe-hors-bu' }])
    })
  })
})

/**
 * Couvre la règle métier : un employé sans Presence enregistrée aujourd'hui n'est ABSENT que si
 * (1) c'est réellement son jour de travail ET (2) son heure d'arrivée attendue (+ tolérance) est
 * dépassée. Avant ce seuil → EN_ATTENTE ; un jour non travaillé (week-end/férié sans mandat, ou
 * sans planning défini) → REPOS. Un mandat explicite prime toujours sur le week-end/férié.
 */
describe('PresenceService — statuts "aujourd’hui" (repos / en attente / absent)', () => {
  let service: PresenceService
  let prisma: {
    user: { findMany: jest.Mock; findUnique: jest.Mock }
    presence: { findMany: jest.Mock; findUnique: jest.Mock }
    dailyMandate: { findMany: jest.Mock }
  }
  let schedule: {
    isArrivalOverdue: jest.Mock
    getScheduleSource: jest.Mock
    getDepartureScheduleSource: jest.Mock
  }
  let leaveSync: { getActiveLeaves: jest.Mock }
  let publicHolidays: { isHoliday: jest.Mock }

  const requester = { id: 'r1', role: Role.CTO_ADMIN, businessUnitId: null, poleId: null }

  function makeUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      username: 'u1',
      email: null,
      firstName: 'U',
      lastName: '1',
      fullName: 'U 1',
      role: Role.EMPLOYE,
      isActive: true,
      businessUnitId: null,
      poleId: null,
      scheduleGroupId: null,
      individualExpectedArrivalTime: null,
      individualExpectedDepartureTime: null,
      businessUnit: null,
      pole: null,
      scheduleGroup: null,
      ...overrides,
    }
  }

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      presence: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      dailyMandate: { findMany: jest.fn().mockResolvedValue([]) },
    }
    schedule = {
      isArrivalOverdue: jest.fn(),
      getScheduleSource: jest.fn(),
      getDepartureScheduleSource: jest.fn(),
    }
    leaveSync = { getActiveLeaves: jest.fn().mockResolvedValue([]) }
    publicHolidays = { isHoliday: jest.fn().mockResolvedValue({ isHoliday: false, label: null }) }

    service = new PresenceService(
      prisma as unknown as PrismaService,
      schedule as unknown as PresenceScheduleService,
      {} as unknown as NotificationsService,
      leaveSync as unknown as LeaveSyncService,
      publicHolidays as unknown as PublicHolidaysService
    )
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('getTodayAllPresences', () => {
    it('marque REPOS un employé sans mandat un jour de week-end (jamais ABSENT)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-08T09:00:00.000Z')) // samedi
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          scheduleGroup: {
            id: 'g1',
            name: 'Jour',
            expectedArrivalTime: '08:00',
            expectedDepartureTime: '17:00',
            isNightShift: false,
          },
        }),
      ])

      const rows = await service.getTodayAllPresences(requester, '2026-08-08')

      expect(rows[0].status).toBe('REPOS')
      expect(schedule.isArrivalOverdue).not.toHaveBeenCalled()
    })

    it("marque EN_ATTENTE un jour de travail avant l'heure attendue (+ tolérance)", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T08:40:00.000Z')) // lundi, 08h40
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          scheduleGroup: {
            id: 'g1',
            name: 'Jour',
            expectedArrivalTime: '09:00',
            expectedDepartureTime: null,
            isNightShift: false,
          },
        }),
      ])
      schedule.isArrivalOverdue.mockReturnValue(false)

      const rows = await service.getTodayAllPresences(requester, '2026-08-10')

      expect(rows[0].status).toBe('EN_ATTENTE')
    })

    it("marque ABSENT un jour de travail une fois l'heure attendue (+ tolérance) dépassée", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T09:15:00.000Z')) // lundi, 09h15
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          scheduleGroup: {
            id: 'g1',
            name: 'Jour',
            expectedArrivalTime: '09:00',
            expectedDepartureTime: null,
            isNightShift: false,
          },
        }),
      ])
      schedule.isArrivalOverdue.mockReturnValue(true)

      const rows = await service.getTodayAllPresences(requester, '2026-08-10')

      expect(rows[0].status).toBe('ABSENT')
    })

    it('un mandat explicite un jour de week-end reste un jour de travail (peut redevenir ABSENT)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-08T20:30:00.000Z')) // samedi soir, mandaté
      prisma.user.findMany.mockResolvedValue([makeUser()])
      prisma.dailyMandate.findMany.mockResolvedValue([
        { userId: 'u1', expectedArrivalTime: '20:00', isNightShift: true },
      ])
      schedule.isArrivalOverdue.mockReturnValue(true)

      const rows = await service.getTodayAllPresences(requester, '2026-08-08')

      expect(rows[0].status).toBe('ABSENT')
      expect(schedule.isArrivalOverdue).toHaveBeenCalledWith('20:00', expect.any(Date), true)
    })

    it('une date passée sans présence est directement ABSENT (jour déjà terminé, jamais EN_ATTENTE)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après le lundi ciblé
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          scheduleGroup: {
            id: 'g1',
            name: 'Jour',
            expectedArrivalTime: '09:00',
            expectedDepartureTime: null,
            isNightShift: false,
          },
        }),
      ])

      const rows = await service.getTodayAllPresences(requester, '2026-08-10') // lundi passé

      expect(rows[0].status).toBe('ABSENT')
      expect(schedule.isArrivalOverdue).not.toHaveBeenCalled()
    })

    it("une date future n'est jamais ABSENT (le jour n'a pas encore eu lieu)", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-08T10:00:00.000Z')) // samedi, avant le lundi ciblé
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          scheduleGroup: {
            id: 'g1',
            name: 'Jour',
            expectedArrivalTime: '09:00',
            expectedDepartureTime: null,
            isNightShift: false,
          },
        }),
      ])

      const rows = await service.getTodayAllPresences(requester, '2026-08-10') // lundi futur

      expect(rows[0].status).toBe('EN_ATTENTE')
      expect(schedule.isArrivalOverdue).not.toHaveBeenCalled()
    })
  })

  describe('getTodayPresence', () => {
    it('renvoie REPOS pour son propre widget un jour de week-end sans mandat', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-08T09:00:00.000Z')) // samedi
      schedule.getScheduleSource.mockResolvedValue({
        time: '08:00',
        source: 'group',
        isNightShift: false,
      })
      prisma.user.findUnique.mockResolvedValue({ username: 'u1', email: null })

      const result = await service.getTodayPresence('u1')

      expect(result.status).toBe('REPOS')
    })

    it("renvoie EN_ATTENTE avant l'heure attendue, jamais ABSENT", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T08:40:00.000Z')) // lundi, 08h40
      schedule.getScheduleSource.mockResolvedValue({
        time: '09:00',
        source: 'group',
        isNightShift: false,
      })
      schedule.isArrivalOverdue.mockReturnValue(false)
      prisma.user.findUnique.mockResolvedValue({ username: 'u1', email: null })

      const result = await service.getTodayPresence('u1')

      expect(result.status).toBe('EN_ATTENTE')
    })

    it('respecte le motif workingDays de l’employé pour son propre widget (Mardi-Samedi)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T09:00:00.000Z')) // lundi — hors motif
      schedule.getScheduleSource.mockResolvedValue({
        time: '09:00',
        source: 'group',
        isNightShift: false,
      })
      prisma.user.findUnique.mockResolvedValue({
        username: 'u1',
        email: null,
        workingDays: [2, 3, 4, 5, 6],
      })

      const result = await service.getTodayPresence('u1')

      expect(result.status).toBe('REPOS')
      expect(schedule.isArrivalOverdue).not.toHaveBeenCalled()
    })
  })

  describe('motif hebdomadaire personnalisé (workingDays) — remplace l’hypothèse week-end globale', () => {
    it('marque REPOS un lundi pour un employé en motif Mardi-Samedi (jour hors motif, pourtant jour ouvré classique)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-10T09:00:00.000Z')) // lundi
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          workingDays: [2, 3, 4, 5, 6], // Mardi-Samedi
          scheduleGroup: {
            id: 'g1',
            name: 'Rotation TV/Radio',
            expectedArrivalTime: '09:00',
            expectedDepartureTime: '18:00',
            isNightShift: false,
          },
        }),
      ])

      const rows = await service.getTodayAllPresences(requester, '2026-08-10')

      expect(rows[0].status).toBe('REPOS')
      expect(schedule.isArrivalOverdue).not.toHaveBeenCalled()
    })

    it('évalue normalement (jamais REPOS) un samedi pour ce même employé, alors que le samedi est REPOS par défaut', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-08T09:15:00.000Z')) // samedi, 09h15
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          workingDays: [2, 3, 4, 5, 6], // Mardi-Samedi
          scheduleGroup: {
            id: 'g1',
            name: 'Rotation TV/Radio',
            expectedArrivalTime: '09:00',
            expectedDepartureTime: '18:00',
            isNightShift: false,
          },
        }),
      ])
      schedule.isArrivalOverdue.mockReturnValue(true)

      const rows = await service.getTodayAllPresences(requester, '2026-08-08')

      expect(rows[0].status).toBe('ABSENT')
      expect(schedule.isArrivalOverdue).toHaveBeenCalledWith('09:00', expect.any(Date), false)
    })

    it('un motif vide ([]) retombe sur le défaut Lundi-Vendredi (samedi reste REPOS)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-08T09:00:00.000Z')) // samedi
      prisma.user.findMany.mockResolvedValue([
        makeUser({
          workingDays: [],
          scheduleGroup: {
            id: 'g1',
            name: 'Jour',
            expectedArrivalTime: '08:00',
            expectedDepartureTime: '17:00',
            isNightShift: false,
          },
        }),
      ])

      const rows = await service.getTodayAllPresences(requester, '2026-08-08')

      expect(rows[0].status).toBe('REPOS')
    })
  })
})
