import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { ReportsService } from './reports.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { PresenceScheduleService } from '../presence/presence.schedule.service'
import type { PublicHolidaysService } from '../public-holidays/public-holidays.service'
import type { LeaveSyncService } from '../leaves/leave-sync.service'

/**
 * Couvre `getPresenceSummaryRows` (synthèse par personne du rapport de présences : absences,
 * jours de retard, minutes de retard cumulées) — l'absence n'étant jamais persistée en DB, elle
 * doit être recalculée jour par jour avec la même règle que `getSummary`/`getPeriodReport`
 * (motif de travail propre à l'utilisateur, mandat prioritaire, jour férié, congé, "pas encore
 * arrivé ≠ absent" pour le jour courant).
 */
describe('ReportsService — getPresenceSummaryRows', () => {
  let service: ReportsService
  let prisma: {
    user: { findMany: jest.Mock }
    presence: { findMany: jest.Mock }
    dailyMandate: { findMany: jest.Mock }
  }
  let schedule: { isArrivalOverdue: jest.Mock }
  let publicHolidays: { getHolidaysInRange: jest.Mock }
  let leaveSync: { getActiveLeavesInRange: jest.Mock }

  const requester = { id: 'r1', role: Role.CTO_ADMIN, businessUnitId: null, poleId: null }

  function makeUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      username: 'jdupont',
      fullName: 'Jean Dupont',
      role: Role.EMPLOYE,
      businessUnit: { name: 'BU Info' },
      pole: null,
      workingDays: null, // motif par défaut Lundi-Vendredi
      scheduleGroup: { expectedArrivalTime: '09:00', isNightShift: false },
      individualExpectedArrivalTime: null,
      ...overrides,
    }
  }

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn().mockResolvedValue([makeUser()]) },
      presence: { findMany: jest.fn().mockResolvedValue([]) },
      dailyMandate: { findMany: jest.fn().mockResolvedValue([]) },
    }
    schedule = { isArrivalOverdue: jest.fn() }
    publicHolidays = { getHolidaysInRange: jest.fn().mockResolvedValue(new Map()) }
    leaveSync = { getActiveLeavesInRange: jest.fn().mockResolvedValue([]) }

    service = new ReportsService(
      prisma as unknown as PrismaService,
      schedule as unknown as PresenceScheduleService,
      publicHolidays as unknown as PublicHolidaysService,
      leaveSync as unknown as LeaveSyncService
    )
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('rejette une plage invalide (date de début après la date de fin) sans interroger les utilisateurs', async () => {
    await expect(
      service.getPresenceSummaryRows(requester, '2026-08-15', '2026-08-10')
    ).rejects.toThrow(BadRequestException)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('compte un jour de retard et cumule ses minutes depuis une présence déjà enregistrée', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après la plage
    prisma.presence.findMany.mockResolvedValue([
      {
        userId: 'u1',
        date: new Date('2026-08-10T00:00:00.000Z'),
        status: 'LATE',
        delayMinutes: 15,
      },
    ])

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-10', '2026-08-10')

    expect(row).toMatchObject({ absences: 0, lateDays: 1, lateMinutesTotal: 15 })
    expect(schedule.isArrivalOverdue).not.toHaveBeenCalled()
  })

  it('cumule les minutes de retard sur plusieurs jours (0 par défaut si delayMinutes est null)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après la plage
    prisma.presence.findMany.mockResolvedValue([
      {
        userId: 'u1',
        date: new Date('2026-08-10T00:00:00.000Z'),
        status: 'LATE',
        delayMinutes: 10,
      },
      {
        userId: 'u1',
        date: new Date('2026-08-11T00:00:00.000Z'),
        status: 'LATE',
        delayMinutes: null,
      },
    ])

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-10', '2026-08-11')

    expect(row).toMatchObject({ absences: 0, lateDays: 2, lateMinutesTotal: 10 })
  })

  it('ne compte jamais un jour hors motif de travail par défaut (repos), même sans présence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après la plage

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-08', '2026-08-08') // samedi

    expect(row).toMatchObject({ absences: 0, lateDays: 0, lateMinutesTotal: 0 })
  })

  it('un mandat explicite un jour hors motif (week-end) redevient un jour de travail comptable en absence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après le samedi ciblé
    prisma.dailyMandate.findMany.mockResolvedValue([
      {
        userId: 'u1',
        date: new Date('2026-08-08T00:00:00.000Z'),
        expectedArrivalTime: '20:00',
        isNightShift: true,
      },
    ])

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-08', '2026-08-08') // samedi mandaté

    expect(row.absences).toBe(1)
  })

  it('un congé actif ce jour-là exclut le décompte en absence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après la plage
    leaveSync.getActiveLeavesInRange.mockResolvedValue([
      {
        matricule: 'jdupont',
        email: null,
        firstName: 'Jean',
        lastName: 'Dupont',
        type: 'ANNUAL_PAID',
        startDate: '2026-08-10',
        endDate: '2026-08-10',
        departmentName: null,
      },
    ])

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-10', '2026-08-10') // lundi

    expect(row.absences).toBe(0)
  })

  it('un jour férié exclut le décompte en absence même sur un jour normalement travaillé', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après la plage
    publicHolidays.getHolidaysInRange.mockResolvedValue(new Map([['2026-08-10', 'Fête nationale']]))

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-10', '2026-08-10') // lundi férié

    expect(row.absences).toBe(0)
  })

  it("le jour courant avant l'heure attendue (+ tolérance) n'est jamais compté absent (en attente)", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-10T08:40:00.000Z')) // lundi, 08h40
    schedule.isArrivalOverdue.mockReturnValue(false)

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-10', '2026-08-10')

    expect(row.absences).toBe(0)
  })

  it("le jour courant une fois l'heure attendue (+ tolérance) dépassée est compté absent", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-10T09:15:00.000Z')) // lundi, 09h15
    schedule.isArrivalOverdue.mockReturnValue(true)

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-10', '2026-08-10')

    expect(row.absences).toBe(1)
    expect(schedule.isArrivalOverdue).toHaveBeenCalledWith('09:00', expect.any(Date), false)
  })

  it("un jour strictement passé sans présence est directement compté absent, sans vérifier l'heure", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après le lundi ciblé

    const [row] = await service.getPresenceSummaryRows(requester, '2026-08-10', '2026-08-10') // lundi passé

    expect(row.absences).toBe(1)
    expect(schedule.isArrivalOverdue).not.toHaveBeenCalled()
  })
})

/**
 * Couvre `getEmployeeReportData` (fiche individuelle : présence, emploi du temps, congés) —
 * en particulier le périmètre BU/Pôle (repli 404 plutôt que 403, même convention que
 * `users.service.ts::findOne`) et le filtrage des congés à ceux du seul employé demandé.
 */
describe('ReportsService — getEmployeeReportData', () => {
  let service: ReportsService
  let prisma: {
    user: { findFirst: jest.Mock }
    presence: { findMany: jest.Mock }
    dailyMandate: { findMany: jest.Mock }
  }
  let schedule: { isArrivalOverdue: jest.Mock }
  let publicHolidays: { getHolidaysInRange: jest.Mock }
  let leaveSync: { getActiveLeavesInRange: jest.Mock }

  function makeEmployee(overrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      username: 'jdupont',
      email: 'jdupont@veilleurdesmedias.com',
      firstName: 'Jean',
      lastName: 'Dupont',
      fullName: 'Jean Dupont',
      role: Role.EMPLOYE,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      lastLoginAt: null,
      businessUnit: { name: 'BU Info' },
      pole: null,
      manager: null,
      workingDays: null, // motif par défaut Lundi-Vendredi
      scheduleGroup: { name: 'Bureau', expectedArrivalTime: '09:00', isNightShift: false },
      individualExpectedArrivalTime: null,
      individualExpectedDepartureTime: null,
      ...overrides,
    }
  }

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(makeEmployee()) },
      presence: { findMany: jest.fn().mockResolvedValue([]) },
      dailyMandate: { findMany: jest.fn().mockResolvedValue([]) },
    }
    schedule = { isArrivalOverdue: jest.fn() }
    publicHolidays = { getHolidaysInRange: jest.fn().mockResolvedValue(new Map()) }
    leaveSync = {
      getActiveLeavesInRange: jest.fn().mockResolvedValue([]),
    }

    service = new ReportsService(
      prisma as unknown as PrismaService,
      schedule as unknown as PresenceScheduleService,
      publicHolidays as unknown as PublicHolidaysService,
      leaveSync as unknown as LeaveSyncService
    )
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renvoie 404 (pas 403) quand l'employé demandé est hors périmètre du demandeur", async () => {
    prisma.user.findFirst.mockResolvedValue(null) // hors BU du RESPONSABLE_BU demandeur
    const requester = { id: 'r1', role: Role.RESPONSABLE_BU, businessUnitId: 'bu-1', poleId: null }

    await expect(service.getEmployeeReportData(requester, 'u1')).rejects.toThrow(
      NotFoundException
    )
  })

  it('rejette une plage invalide sans interroger l’employé', async () => {
    const requester = { id: 'r1', role: Role.CTO_ADMIN, businessUnitId: null, poleId: null }

    await expect(
      service.getEmployeeReportData(requester, 'u1', '2026-08-15', '2026-08-10')
    ).rejects.toThrow(BadRequestException)
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it("calcule la synthèse d'assiduité et renvoie le détail de présence de l'employé demandé", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T10:00:00.000Z')) // jeudi, après la plage
    const requester = { id: 'r1', role: Role.CTO_ADMIN, businessUnitId: null, poleId: null }
    prisma.presence.findMany.mockResolvedValue([
      {
        userId: 'u1',
        date: new Date('2026-08-10T00:00:00.000Z'),
        status: 'LATE',
        delayMinutes: 15,
        expectedArrivalTime: '09:00',
        officialArrivalTime: new Date('2026-08-10T09:15:00.000Z'),
      },
    ])

    const data = await service.getEmployeeReportData(requester, 'u1', '2026-08-10', '2026-08-11')

    expect(data.summary).toMatchObject({ absences: 1, lateDays: 1, lateMinutesTotal: 15 })
    expect(data.presenceRows).toHaveLength(1)
    expect(data.user.scheduleLabel).toContain('09:00')
  })

  it("ne renvoie que les congés de l'employé demandé, pas ceux d'un autre employé de la période", async () => {
    const requester = { id: 'r1', role: Role.CTO_ADMIN, businessUnitId: null, poleId: null }
    leaveSync.getActiveLeavesInRange.mockResolvedValue([
      {
        matricule: 'jdupont',
        email: null,
        firstName: 'Jean',
        lastName: 'Dupont',
        type: 'ANNUAL_PAID',
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        departmentName: null,
      },
      {
        matricule: 'autre-employe',
        email: null,
        firstName: 'Autre',
        lastName: 'Employé',
        type: 'SICK',
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        departmentName: null,
      },
    ])

    const data = await service.getEmployeeReportData(requester, 'u1', '2026-08-01', '2026-08-13')

    expect(data.leaves).toHaveLength(1)
    expect(data.leaves[0]).toMatchObject({ typeLabel: 'Congé payé', startDate: '2026-08-10' })
  })
})
