'use client'

import { apiFetch } from './http'

export type PresenceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EN_CONGE'

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
  createMandate: (data: {
    userId: string
    date: string
    expectedArrivalTime: string
    reason?: string
  }) => presenceReq<DailyMandate>('/mandates', { method: 'POST', body: JSON.stringify(data) }),
  deleteMandate: (id: string) =>
    presenceReq<{ deleted: boolean }>(`/mandates/${id}`, { method: 'DELETE' }),
  myConnections: (limit = 20) =>
    presenceReq<ConnectionLogEntry[]>(`/my-connections?limit=${limit}`),
}
