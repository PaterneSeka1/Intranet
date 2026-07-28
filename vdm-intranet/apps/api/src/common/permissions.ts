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

/** Rôles voyant le pilotage sans restriction de BU/pôle */
export const CAN_VIEW_PILOTAGE_GLOBAL: Role[] = [Role.CTO_ADMIN, Role.PDG]

/** Rôles voyant le pilotage restreint à leur BU */
export const CAN_VIEW_PILOTAGE_BU_SCOPE: Role[] = [Role.DAF, Role.RESPONSABLE_BU]

/** Rôles pouvant accéder aux rapports (exports) */
export const CAN_VIEW_REPORTS: Role[] = [
  Role.CTO_ADMIN,
  Role.PDG,
  Role.DAF,
  Role.RESPONSABLE_BU,
  Role.RESPONSABLE_POLE,
]

/** Rôles pouvant exporter les rapports étendus (activité/connexions/général), pas seulement présence */
export const CAN_EXPORT_EXTENDED_REPORTS: Role[] = [
  Role.CTO_ADMIN,
  Role.PDG,
  Role.RESPONSABLE_BU,
  Role.RESPONSABLE_POLE,
]

/** Rôles voyant les rapports sans restriction de BU/pôle */
export const CAN_VIEW_REPORTS_GLOBAL: Role[] = [Role.CTO_ADMIN, Role.PDG]

/** Rôles voyant les rapports restreints à leur BU */
export const CAN_VIEW_REPORTS_BU_SCOPE: Role[] = [Role.DAF, Role.RESPONSABLE_BU]

/** Rôles voyant les présences sans restriction de BU/pôle */
export const CAN_VIEW_PRESENCE_GLOBAL: Role[] = [Role.CTO_ADMIN, Role.PDG]

/** Rôles voyant les présences restreintes à leur BU */
export const CAN_VIEW_PRESENCE_BU_SCOPE: Role[] = [Role.DAF, Role.RESPONSABLE_BU]

/** Rôles pouvant créer/supprimer des mandats journaliers */
export const CAN_MANAGE_MANDATES: Role[] = [
  Role.CTO_ADMIN,
  Role.PDG,
  Role.DAF,
  Role.RESPONSABLE_BU,
  Role.RESPONSABLE_POLE,
]

/** Rôles pouvant gérer les groupes horaires */
export const CAN_MANAGE_SCHEDULE_GROUPS: Role[] = [Role.CTO_ADMIN]

/** Rôles pouvant gérer les onglets de n'importe quelle BU ou globaux */
export const CAN_MANAGE_TABS_GLOBAL: Role[] = [Role.CTO_ADMIN, Role.PDG]

/** Rôles pouvant gérer uniquement les onglets de leur propre BU */
export const CAN_MANAGE_TABS_BU_SCOPE: Role[] = [Role.DAF, Role.RESPONSABLE_BU]

/** Rôles en lecture seule sur les onglets de leur propre BU */
export const CAN_VIEW_TABS_OWN_BU: Role[] = [
  Role.RESPONSABLE_POLE,
  Role.EMPLOYE,
  Role.CONSULTANT,
  Role.STAGIAIRE,
  Role.PRESTATAIRE,
]

/** Rôles pouvant gérer l'organisation (Business Units, Pôles) */
export const CAN_MANAGE_ORGANIZATION: Role[] = [Role.CTO_ADMIN]

/** Rôles pouvant gérer les annonces */
export const CAN_MANAGE_ANNOUNCEMENTS: Role[] = [Role.CTO_ADMIN, Role.PDG]

/** Rôles pouvant gérer les utilisateurs restreints à leur propre BU */
export const CAN_MANAGE_USERS_BU_SCOPE: Role[] = [Role.DAF, Role.RESPONSABLE_BU]

/** Rôles admin protégés : seul CTO_ADMIN peut créer/modifier ces comptes */
export const PROTECTED_ADMIN_ROLES: Role[] = [Role.CTO_ADMIN, Role.PDG]

export const isAccueilOnly = (role: Role) => ACCUEIL_ONLY_ROLES.includes(role)
