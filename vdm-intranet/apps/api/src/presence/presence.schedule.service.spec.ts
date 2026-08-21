import { PresenceScheduleService } from './presence.schedule.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { ConfigService } from '@nestjs/config'

/**
 * Couvre la résolution mandat > groupe > individuel > aucun (arrivée et départ), et la
 * propagation du flag isNightShift avec priorité au mandat (via `??`, jamais `||` : un mandat qui
 * fixe explicitement isNightShift=false doit primer sur un groupe de nuit — cas d'un mandat
 * "week-end" désactivant le mode nuit du groupe par défaut du Pôle TV/Radio).
 */
describe('PresenceScheduleService', () => {
  let service: PresenceScheduleService
  let findUnique: jest.Mock

  const date = new Date('2026-08-10T00:00:00.000Z')

  beforeEach(() => {
    findUnique = jest.fn()
    const prisma = { user: { findUnique } } as unknown as PrismaService
    const config = { get: jest.fn().mockReturnValue('0') } as unknown as ConfigService
    service = new PresenceScheduleService(prisma, config)
  })

  describe('getScheduleSource (arrivée)', () => {
    it('utilise le mandat en priorité sur le groupe et l’individuel', async () => {
      findUnique.mockResolvedValue({
        scheduleGroupId: 'g1',
        individualExpectedArrivalTime: '08:30',
        scheduleGroup: { expectedArrivalTime: '09:00', isNightShift: false },
        mandates: [{ expectedArrivalTime: '20:00', isNightShift: null }],
      })

      const result = await service.getScheduleSource('u1', date)

      expect(result).toEqual({ time: '20:00', source: 'mandate', isNightShift: false })
    })

    it('un mandat isNightShift=true prime sur un groupe diurne', async () => {
      findUnique.mockResolvedValue({
        scheduleGroupId: 'g1',
        individualExpectedArrivalTime: null,
        scheduleGroup: { expectedArrivalTime: '09:00', isNightShift: false },
        mandates: [{ expectedArrivalTime: '20:00', isNightShift: true }],
      })

      const result = await service.getScheduleSource('u1', date)

      expect(result.isNightShift).toBe(true)
    })

    it('un mandat isNightShift=false désactive explicitement le mode nuit d’un groupe de nuit', async () => {
      findUnique.mockResolvedValue({
        scheduleGroupId: 'g1',
        individualExpectedArrivalTime: null,
        scheduleGroup: { expectedArrivalTime: '20:00', isNightShift: true },
        mandates: [{ expectedArrivalTime: '10:00', isNightShift: false }],
      })

      const result = await service.getScheduleSource('u1', date)

      // Point critique : `??` doit préserver le `false` explicite du mandat, pas le `true` du groupe.
      expect(result.isNightShift).toBe(false)
    })

    it('retombe sur le groupe si aucun mandat pour cette date', async () => {
      findUnique.mockResolvedValue({
        scheduleGroupId: 'g1',
        individualExpectedArrivalTime: '08:30',
        scheduleGroup: { expectedArrivalTime: '09:00', isNightShift: true },
        mandates: [],
      })

      const result = await service.getScheduleSource('u1', date)

      expect(result).toEqual({ time: '09:00', source: 'group', isNightShift: true })
    })

    it('retombe sur l’horaire individuel si aucun groupe ni mandat', async () => {
      findUnique.mockResolvedValue({
        scheduleGroupId: null,
        individualExpectedArrivalTime: '08:30',
        scheduleGroup: null,
        mandates: [],
      })

      const result = await service.getScheduleSource('u1', date)

      expect(result).toEqual({ time: '08:30', source: 'individual', isNightShift: false })
    })

    it('retourne "none" si l’utilisateur est introuvable', async () => {
      findUnique.mockResolvedValue(null)

      const result = await service.getScheduleSource('u1', date)

      expect(result).toEqual({ time: null, source: 'none', isNightShift: false })
    })
  })

  describe('getDepartureScheduleSource (départ)', () => {
    it('utilise le mandat en priorité quand il fixe une heure de départ', async () => {
      findUnique.mockResolvedValue({
        individualExpectedDepartureTime: '17:00',
        scheduleGroup: { expectedDepartureTime: '18:00', isNightShift: false },
        mandates: [{ expectedDepartureTime: '05:00', isNightShift: true }],
      })

      const result = await service.getDepartureScheduleSource('u1', date)

      expect(result).toEqual({ time: '05:00', source: 'mandate', isNightShift: true })
    })

    it("retombe sur le groupe si le mandat existe mais n'a pas d'heure de départ (formulaire simple)", async () => {
      findUnique.mockResolvedValue({
        individualExpectedDepartureTime: null,
        scheduleGroup: { expectedDepartureTime: '18:00', isNightShift: false },
        mandates: [{ expectedDepartureTime: null, isNightShift: null }],
      })

      const result = await service.getDepartureScheduleSource('u1', date)

      expect(result).toEqual({ time: '18:00', source: 'group', isNightShift: false })
    })

    it('retombe sur l’individuel si aucun groupe ni mandat de départ', async () => {
      findUnique.mockResolvedValue({
        individualExpectedDepartureTime: '17:00',
        scheduleGroup: null,
        mandates: [],
      })

      const result = await service.getDepartureScheduleSource('u1', date)

      expect(result).toEqual({ time: '17:00', source: 'individual', isNightShift: false })
    })
  })

  describe('calculatePresenceStatus — franchissement de minuit (équipe de nuit)', () => {
    it('avec isNightShift, une arrivée juste après minuit est correctement comptée en retard (attendu 23:50, arrivé 00:05)', () => {
      const actual = new Date('2026-08-10T00:05:00.000Z')

      const result = service.calculatePresenceStatus('23:50', actual, true)

      // 23:50 -> 00:05 le "lendemain" = 15 min d'écart réel, seulement détecté grâce à +24h.
      expect(result.status).toBe('LATE')
      expect(result.delayMinutes).toBe(15)
    })

    it('sans isNightShift, la même arrivée est faussement comptée comme non-retard (régression à éviter)', () => {
      const actual = new Date('2026-08-10T00:05:00.000Z')

      const result = service.calculatePresenceStatus('23:50', actual, false)

      // Sans le flag, 00:05 (=5) est numériquement "avant" 23:50 (=1430) : le calcul brut donne un
      // écart négatif et masque un vrai retard de nuit — exactement ce que la propagation de
      // isNightShift depuis le mandat doit empêcher pour le Pôle TV/Radio.
      expect(result.status).toBe('PRESENT')
      expect(result.delayMinutes).toBeNull()
    })

    it('cas jour classique : retard calculé normalement sans effet nuit', () => {
      const actual = new Date('2026-08-10T09:15:00.000Z')

      const result = service.calculatePresenceStatus('09:00', actual, false)

      expect(result.status).toBe('LATE')
      expect(result.delayMinutes).toBe(15)
    })
  })

  describe('isArrivalOverdue — "pas encore arrivé" ne doit jamais être compté absent', () => {
    it("n'est pas overdue avant l'heure attendue (08:40 pour un attendu de 09:00)", () => {
      const now = new Date('2026-08-10T08:40:00.000Z')

      expect(service.isArrivalOverdue('09:00', now, false)).toBe(false)
    })

    it("n'est pas overdue exactement à l'heure attendue, dans la tolérance", () => {
      const now = new Date('2026-08-10T09:00:00.000Z')

      expect(service.isArrivalOverdue('09:00', now, false)).toBe(false)
    })

    it('devient overdue une fois la tolérance dépassée', async () => {
      const config = { get: jest.fn().mockReturnValue('10') } as unknown as ConfigService
      const prisma = { user: { findUnique } } as unknown as PrismaService
      const serviceWithTolerance = new PresenceScheduleService(prisma, config)
      const now = new Date('2026-08-10T09:11:00.000Z')

      expect(serviceWithTolerance.isArrivalOverdue('09:00', now, false)).toBe(true)
      expect(
        serviceWithTolerance.isArrivalOverdue('09:00', new Date('2026-08-10T09:05:00.000Z'), false)
      ).toBe(false)
    })

    it('gère le franchissement de minuit pour une équipe de nuit (attendu 23:50, arrivée pas encore enregistrée à 00:05 → 15 min de retard réel, overdue)', () => {
      const now = new Date('2026-08-10T00:05:00.000Z')

      expect(service.isArrivalOverdue('23:50', now, true)).toBe(true)
      // Sans le flag nuit, le même instant paraîtrait "avant" 23:50 et masquerait le retard réel.
      expect(service.isArrivalOverdue('23:50', now, false)).toBe(false)
    })
  })

  describe('calculateDepartureDelayMinutes', () => {
    it('écart positif si parti après l’heure attendue', () => {
      const actual = new Date('2026-08-10T18:20:00.000Z')

      const delay = service.calculateDepartureDelayMinutes('18:00', actual, false)

      expect(delay).toBe(20)
    })

    it('écart négatif si parti avant l’heure attendue', () => {
      const actual = new Date('2026-08-10T17:45:00.000Z')

      const delay = service.calculateDepartureDelayMinutes('18:00', actual, false)

      expect(delay).toBe(-15)
    })

    describe('équipe de nuit — fin de poste après minuit (ex: groupe NUIT_2000, départ attendu 05:00)', () => {
      it('départ anticipé avant minuit : écart négatif (parti en avance), pas un faux "retard" énorme', () => {
        // Poste attendu 20:00 -> 05:00 le lendemain ; départ réel enregistré à 23:30 le même soir.
        const actual = new Date('2026-08-10T23:30:00.000Z')

        const delay = service.calculateDepartureDelayMinutes('05:00', actual, true)

        // Sans la correction symétrique, le calcul brut (23:30 - 05:00 = +1110 min) affichait à
        // tort un très grand retard alors que l'employé est parti ~5h30 avant l'heure.
        expect(delay).toBe(-330)
      })

      it('sans isNightShift, le même départ anticipé serait faussement compté comme un énorme retard (régression à éviter)', () => {
        const actual = new Date('2026-08-10T23:30:00.000Z')

        const delay = service.calculateDepartureDelayMinutes('05:00', actual, false)

        expect(delay).toBe(1110)
      })

      it('départ après minuit, après l’heure attendue : retard calculé normalement (déjà correct sans ajustement)', () => {
        const actual = new Date('2026-08-10T06:10:00.000Z')

        const delay = service.calculateDepartureDelayMinutes('05:00', actual, true)

        expect(delay).toBe(70)
      })

      it('départ après minuit, avant l’heure attendue : écart négatif calculé normalement', () => {
        const actual = new Date('2026-08-10T04:30:00.000Z')

        const delay = service.calculateDepartureDelayMinutes('05:00', actual, true)

        expect(delay).toBe(-30)
      })
    })
  })
})
