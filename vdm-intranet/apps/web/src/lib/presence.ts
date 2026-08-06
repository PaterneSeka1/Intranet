'use client'

import { apiFetch } from './http'

// REPOS et EN_ATTENTE sont calculés côté API à la volée (jamais persistés) : REPOS = pas le jour
// de travail de l'employé (week-end/férié sans mandat, ou aucun planning défini), EN_ATTENTE =
// jour de travail mais heure d'arrivée attendue pas encore dépassée.
export type PresenceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EN_CONGE' | 'REPOS' | 'EN_ATTENTE'

export interface LeaveInfo {
  typeLabel: string
  startDate: string
  endDate: string
}

export interface Presence {
  id: string
  userId: string
  date: string
  status: PresenceStatus
  expectedArrivalTime: string
  officialArrivalTime: string | null
  delayMinutes: number | null
  expectedDepartureTime: string | null
  officialDepartureTime: string | null
  departureDelayMinutes: number | null
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  address: string | null
  mapsUrl: string | null
  departureLatitude: number | null
  departureLongitude: number | null
  departureAccuracy: number | null
  departureAddress: string | null
  departureMapsUrl: string | null
  sourceConnectionLogId: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduleSource {
  time: string | null
  source: 'mandate' | 'group' | 'individual' | 'none'
  isNightShift: boolean
}

export interface TodayPresenceResult {
  presence: Presence | null
  scheduleSource: ScheduleSource
  date: string
  onLeave: LeaveInfo | null
  status: PresenceStatus | null
}

export interface PresenceRow {
  user: {
    id: string
    username: string
    fullName: string | null
    firstName: string | null
    lastName: string | null
    role: string
    businessUnit: { id: string; name: string; code: string } | null
    pole: { id: string; name: string; code: string } | null
    scheduleGroup: {
      id: string
      name: string
      expectedArrivalTime: string
      expectedDepartureTime: string | null
      isNightShift: boolean
    } | null
    individualExpectedArrivalTime: string | null
    individualExpectedDepartureTime: string | null
    workingDays: number[]
  }
  presence: Presence | null
  status: PresenceStatus
  leave: LeaveInfo | null
  expectedArrivalTime: string | null
  scheduleSource: string
}

export interface ScheduleGroup {
  id: string
  name: string
  code: string
  description: string | null
  expectedArrivalTime: string
  expectedDepartureTime: string | null
  isNightShift: boolean
  isActive: boolean
  businessUnit: { id: string; name: string } | null
  pole: { id: string; name: string } | null
  _count: { users: number }
}

export interface DailyMandate {
  id: string
  userId: string
  date: string
  expectedArrivalTime: string
  expectedDepartureTime: string | null
  isNightShift: boolean | null
  reason: string | null
  createdById: string
  user: {
    id: string
    username: string
    fullName: string | null
    role: string
    businessUnit: { name: string } | null
  }
  createdBy: { id: string; username: string; fullName: string | null }
}

export interface MandatePayload {
  userId: string
  date: string
  expectedArrivalTime: string
  expectedDepartureTime?: string
  isNightShift?: boolean
  reason?: string
}

export interface BulkMandateDay {
  date: string
  expectedArrivalTime: string
  expectedDepartureTime?: string
  isNightShift?: boolean
  reason?: string
}

export interface FirstLoginPayload {
  latitude: number
  longitude: number
  accuracy?: number
  address?: string
  userAgent?: string
}

export type EndDayPayload = FirstLoginPayload

export interface ConnectionLogEntry {
  id: string
  type: 'LOGIN' | 'LOGOUT'
  date: string
  connectedAt: string
  disconnectedAt: string | null
  address: string | null
  mapsUrl: string | null
  ipAddress: string | null
  userAgent: string | null
  isFirstConnectionOfDay: boolean
}

function presenceReq<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(`/presence${path}`, init)
}

export const presenceApi = {
  today: () => presenceReq<TodayPresenceResult>('/today'),
  todayAll: () => presenceReq<PresenceRow[]>('/today/all'),
  firstLogin: (data: FirstLoginPayload) =>
    presenceReq<Presence>('/first-login', { method: 'POST', body: JSON.stringify(data) }),
  loginLog: (data?: Partial<FirstLoginPayload>) =>
    presenceReq<unknown>('/login-log', { method: 'POST', body: JSON.stringify(data ?? {}) }),
  logoutLog: (data?: Partial<FirstLoginPayload>) =>
    presenceReq<unknown>('/logout-log', { method: 'POST', body: JSON.stringify(data ?? {}) }),
  endDay: (data: EndDayPayload) =>
    presenceReq<Presence>('/end-day', { method: 'POST', body: JSON.stringify(data) }),
  scheduleGroups: () => presenceReq<ScheduleGroup[]>('/schedule-groups'),
  mandates: () => presenceReq<DailyMandate[]>('/mandates'),
  createMandate: (data: MandatePayload) =>
    presenceReq<DailyMandate>('/mandates', { method: 'POST', body: JSON.stringify(data) }),
  bulkCreateMandates: (data: { userId: string; days: BulkMandateDay[] }) =>
    presenceReq<DailyMandate[]>('/mandates/bulk', { method: 'POST', body: JSON.stringify(data) }),
  mandatesRange: (params: { userId: string; from: string; to: string }) => {
    const qs = new URLSearchParams(params).toString()
    return presenceReq<DailyMandate[]>(`/mandates?${qs}`)
  },
  deleteMandate: (id: string) =>
    presenceReq<{ deleted: boolean }>(`/mandates/${id}`, { method: 'DELETE' }),
  myConnections: (limit = 20) =>
    presenceReq<ConnectionLogEntry[]>(`/my-connections?limit=${limit}`),
}
