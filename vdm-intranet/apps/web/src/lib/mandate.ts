// ----------------------------------------------------------------
// Périmètre de mandatement (emploi du temps)
// ----------------------------------------------------------------
// Pas de directive 'use client' ici : ces fonctions sont de purs utilitaires (aucune dépendance
// navigateur) et doivent rester appelables depuis des Server Components (ex. planning/page.tsx).
// Un module 'use client' (voir presence.ts) exposerait ses exports comme de simples références
// client non exécutables côté serveur.

export type MandateActor = {
  id: string
  role: string
  businessUnit?: { id: string } | null
  pole?: { id: string } | null
}

export type MandateTargetUser = {
  id: string
  businessUnit?: { id: string } | null
  pole?: { id: string } | null
}

const GLOBAL_MANDATE_ROLES = ['CTO_ADMIN', 'PDG']
const BU_SCOPED_MANDATE_ROLES = ['DAF', 'RESPONSABLE_BU']

/**
 * Reproduit côté client la règle `canMandateUser` de presence.service.ts (portée BU/pôle + règle
 * d'auto-mandat), pour ne proposer que des employés réellement mandatables et éviter un aller-retour
 * en erreur 403. Ex. : la DAF voit les présences de toute l'entreprise mais ne peut définir l'emploi
 * du temps que des employés de sa propre BU.
 */
export function canMandateUser(actor: MandateActor, target: MandateTargetUser): boolean {
  if (actor.id === target.id && actor.role !== 'PDG') return false
  if (GLOBAL_MANDATE_ROLES.includes(actor.role)) return true
  if (BU_SCOPED_MANDATE_ROLES.includes(actor.role) && actor.businessUnit) {
    return target.businessUnit?.id === actor.businessUnit.id
  }
  if (actor.role === 'RESPONSABLE_POLE' && actor.pole) {
    return target.pole?.id === actor.pole.id
  }
  return false
}

export function filterMandatableUsers<T extends MandateTargetUser>(
  actor: MandateActor,
  users: T[]
): T[] {
  return users.filter((u) => canMandateUser(actor, u))
}
