import { DEFAULT_WORKING_DAYS, isRecurringWorkDay } from './working-days.util'

// Dates de référence UTC : lundi 2026-08-03 → dimanche 2026-08-09.
const MONDAY = new Date('2026-08-03T00:00:00.000Z')
const TUESDAY = new Date('2026-08-04T00:00:00.000Z')
const FRIDAY = new Date('2026-08-07T00:00:00.000Z')
const SATURDAY = new Date('2026-08-08T00:00:00.000Z')
const SUNDAY = new Date('2026-08-09T00:00:00.000Z')

describe('isRecurringWorkDay', () => {
  it('retombe sur Lundi-Vendredi quand workingDays est absent', () => {
    expect(isRecurringWorkDay(undefined, MONDAY)).toBe(true)
    expect(isRecurringWorkDay(undefined, FRIDAY)).toBe(true)
    expect(isRecurringWorkDay(undefined, SATURDAY)).toBe(false)
    expect(isRecurringWorkDay(undefined, SUNDAY)).toBe(false)
  })

  it('retombe sur Lundi-Vendredi quand workingDays est un tableau vide', () => {
    expect(isRecurringWorkDay([], MONDAY)).toBe(true)
    expect(isRecurringWorkDay([], SATURDAY)).toBe(false)
  })

  it('respecte un motif personnalisé (ex: profil Mardi-Samedi du Pôle TV/Radio)', () => {
    const mardiSamedi = [2, 3, 4, 5, 6]
    expect(isRecurringWorkDay(mardiSamedi, MONDAY)).toBe(false)
    expect(isRecurringWorkDay(mardiSamedi, TUESDAY)).toBe(true)
    expect(isRecurringWorkDay(mardiSamedi, SATURDAY)).toBe(true)
    expect(isRecurringWorkDay(mardiSamedi, SUNDAY)).toBe(false)
  })

  it('expose le motif par défaut Lundi-Vendredi', () => {
    expect(DEFAULT_WORKING_DAYS).toEqual([1, 2, 3, 4, 5])
  })
})
