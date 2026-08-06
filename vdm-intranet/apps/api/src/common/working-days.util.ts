// Convention Date.getUTCDay() : 0=Dimanche, 1=Lundi, …, 6=Samedi.
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]

/**
 * Vrai si `date` (UTC) fait partie du motif hebdomadaire récurrent déclaré pour l'employé
 * (`User.workingDays`). Remplace l'ancienne hypothèse globale week-end (`isWeekendDate`) par un
 * calendrier propre à chaque employé — ex: un profil Pôle TV/Radio travaillant du mardi au samedi.
 * Un motif vide ou absent retombe sur le défaut Lundi-Vendredi.
 */
export function isRecurringWorkDay(workingDays: number[] | null | undefined, date: Date): boolean {
  const days = workingDays && workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS
  return days.includes(date.getUTCDay())
}
