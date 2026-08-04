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

export const leavesApi = {
  onLeaveToday: () => apiFetch<OnLeaveTodayResult>('/leaves/on-leave/today'),
}
