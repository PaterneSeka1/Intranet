import { apiFetch } from './http'

export type EmployeeOnLeave = {
  id: string
  fullName: string | null
  username: string
  role: string
  businessUnit: { id: string; name: string } | null
  startDate: string
  endDate: string
}

export type OnLeaveTodayResult = {
  date: string
  employees: EmployeeOnLeave[]
}

export type CongeEmployeeCandidate = {
  matricule: string
  email: string | null
  firstName: string
  lastName: string
  departmentName: string | null
}

export type CongeEmployeeCandidatesResult = {
  /** false si CONGE_API_URL/CONGE_API_SECRET ne sont pas configurés côté API. */
  configured: boolean
  employees: CongeEmployeeCandidate[]
}

export const leavesApi = {
  onLeaveToday: () => apiFetch<OnLeaveTodayResult>('/leaves/on-leave/today'),
  // Employés CONGE sans compte Intranet correspondant — utilisé par le sélecteur
  // "employé existant" du formulaire de création dans /utilisateurs.
  congeEmployeeCandidates: () => apiFetch<CongeEmployeeCandidatesResult>('/leaves/conge-employees'),
}
