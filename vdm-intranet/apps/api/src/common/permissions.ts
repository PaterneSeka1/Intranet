import { Role } from '@prisma/client'

/** Rôles sans sidebar — accueil uniquement */
export const ACCUEIL_ONLY_ROLES: Role[] = [
  Role.EMPLOYE,
  Role.CONSULTANT,
  Role.STAGIAIRE,
  Role.PRESTATAIRE,
]

/** Rôles pouvant voir le pilotage, avec scope appliqué côté service */
export const CAN_VIEW_PILOTAGE: Role[] = [
  Role.CTO_ADMIN,
  Role.PDG,
  Role.DAF,
  Role.RESPONSABLE_BU,
  Role.RESPONSABLE_POLE,
]

/** Rôles pouvant gérer les utilisateurs */
export const CAN_MANAGE_USERS: Role[] = [Role.CTO_ADMIN, Role.PDG]

/** Rôles pouvant voir la liste des utilisateurs */
export const CAN_VIEW_USERS: Role[] = [
  Role.CTO_ADMIN,
  Role.PDG,
  Role.DAF,
  Role.RESPONSABLE_BU,
  Role.RESPONSABLE_POLE,
]

/** Rôles pouvant gérer les paramètres */
export const CAN_MANAGE_SETTINGS: Role[] = [Role.CTO_ADMIN]

/** Rôles pouvant gérer les onglets */
export const CAN_MANAGE_TABS: Role[] = [Role.CTO_ADMIN, Role.PDG, Role.DAF, Role.RESPONSABLE_BU]

export const isAccueilOnly = (role: Role) => ACCUEIL_ONLY_ROLES.includes(role)
