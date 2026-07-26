export type Role =
  | 'CTO_ADMIN'
  | 'PDG'
  | 'DAF'
  | 'RESPONSABLE_BU'
  | 'RESPONSABLE_POLE'
  | 'CONSULTANT'
  | 'STAGIAIRE'
  | 'PRESTATAIRE'

export interface BU {
  id: string
  name: string
  code: string
}

export interface Pole {
  id: string
  name: string
  code: string
}

export interface User {
  id: string
  username: string
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  email?: string | null
  role: Role
  isActive: boolean
  mustChangePassword?: boolean
  lastLoginAt?: string | null
  createdAt?: string
  businessUnit?: BU | null
  pole?: Pole | null
  manager?: Pick<User, 'id' | 'username' | 'fullName'> | null
  scheduleGroupId?: string | null
  individualExpectedArrivalTime?: string | null
  individualExpectedDepartureTime?: string | null
}

export const ROLE_LABELS: Record<Role, string> = {
  CTO_ADMIN: 'CTO / Administrateur',
  PDG: 'Président Directeur Général',
  DAF: 'Dir. Administrative & Financière',
  RESPONSABLE_BU: 'Responsable Business Unit',
  RESPONSABLE_POLE: 'Responsable Pôle',
  CONSULTANT: 'Consultant',
  STAGIAIRE: 'Stagiaire',
  PRESTATAIRE: 'Prestataire',
}

export const ACCUEIL_ONLY_ROLES: Role[] = ['CONSULTANT', 'STAGIAIRE', 'PRESTATAIRE']

export const isAccueilOnly = (role: Role) => ACCUEIL_ONLY_ROLES.includes(role)
