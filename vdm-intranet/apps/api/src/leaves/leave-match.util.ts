import type { ActiveLeave } from './leave-sync.service'

export type MatchableUser = { username: string; matricule?: string | null; email?: string | null }

/// Identité CONGE minimale nécessaire au rapprochement — satisfaite aussi bien par un
/// congé actif (ActiveLeave) que par un employé du référentiel (CongeEmployee).
export type MatchableCongeIdentity = { matricule: string | null; email: string | null }

/// Rapprochement Intranet ↔ Congé : comparé au champ `matricule` Intranet (identifiant de
/// connexion, aligné en déploiement sur le matricule CONGE) quand il est chargé par l'appelant ;
/// sinon replié sur `username` par compatibilité historique (matricule == username pour tous les
/// comptes importés avant l'introduction du champ `matricule`, cf. migration
/// 20260902120000_add_matricule_to_users). L'email sert de dernier repli si rien ne matche.
export function matchLeaveToUser(leave: MatchableCongeIdentity, user: MatchableUser): boolean {
  if (leave.matricule) {
    const reference = user.matricule ?? user.username
    if (reference.toLowerCase() === leave.matricule.toLowerCase()) return true
  }
  if (leave.email && user.email && leave.email.toLowerCase() === user.email.toLowerCase())
    return true
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
