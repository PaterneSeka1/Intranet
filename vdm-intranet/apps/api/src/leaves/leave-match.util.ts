import type { ActiveLeave } from './leave-sync.service'

export type MatchableUser = { username: string; email?: string | null }

/// Rapprochement Intranet ↔ Congé : le matricule Congé est aligné en déploiement
/// sur le login (username) Intranet ; l'email sert de repli si le matricule ne matche pas.
export function matchLeaveToUser(leave: ActiveLeave, user: MatchableUser): boolean {
  if (leave.matricule && leave.matricule.toLowerCase() === user.username.toLowerCase()) return true
  if (leave.email && user.email && leave.email.toLowerCase() === user.email.toLowerCase()) return true
  return false
}

function toUtcDateOnly(value: string | Date): number {
  const d = typeof value === 'string' ? new Date(value) : value
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/// Un congé peut chevaucher plusieurs jours d'une plage — ce test day-by-day
/// est utilisé par les rapports hebdo/mensuels après un seul fetch de la plage complète.
export function isLeaveActiveOnDay(leave: ActiveLeave, day: Date): boolean {
  const dayMs = toUtcDateOnly(day)
  return dayMs >= toUtcDateOnly(leave.startDate) && dayMs <= toUtcDateOnly(leave.endDate)
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL_PAID: 'Congé payé',
  ANTICIPATED_PAID: 'Congé anticipé',
  PERMISSION: 'Permission',
  FAMILY_EXCEPTIONAL: 'Congé familial exceptionnel',
  MENSTRUAL: 'Congé menstruel',
  CONGE_M: 'Congé menstruel',
  MATERNITY_PATERNITY: 'Congé maternité/paternité',
  SICKNESS: 'Congé maladie',
  SICK: 'Congé maladie',
  UNPAID: 'Mise à disponibilité',
  TRAINING: 'Congé de formation',
  ANNUAL: 'Congé payé',
  OTHER: 'Congé',
}

export function leaveTypeLabel(type: string): string {
  return LEAVE_TYPE_LABELS[type] ?? 'Congé'
}
