'use client'

import { API_BASE as BASE } from './api-base'

export type PresenceStatus = 'PRESENT' | 'ABSENT' | 'LATE'

export interface Presence {
  id: string
  userId: string
  date: string
  status: PresenceStatus
  expectedArrivalTime: string
  officialArrivalTime: string | null
  delayMinutes: number | null
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  address: string | null
  mapsUrl: string | null
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
    scheduleGroup: { id: string; name: string; expectedArrivalTime: string; isNightShift: boolean } | null
    individualExpectedArrivalTime: string | null
  }
  presence: Presence | null
  status: PresenceStatus
  expectedArrivalTime: string | null
  scheduleSource: string
}

export interface ScheduleGroup {
  id: string
  name: string
  code: string
  description: string | null
  expectedArrivalTime: string
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
  user: { id: string; username: string; fullName: string | null; role: string; businessUnit: { name: string } | null }
  createdBy: { id: string; username: string; fullName: string | null }
}

export interface FirstLoginPayload {
  latitude: number
  longitude: number
  accuracy?: number
  address?: string
  userAgent?: string
}

async function presenceReq<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch(`${BASE}/api/presence${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      signal: controller.signal,
      ...init,
    })
  } finally {
    clearTimeout(tid)
  }
  if (!res.ok) {
    let msg = 'Erreur serveur'
    try {
      const body = await res.json()
      msg = body.message ?? msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
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
  scheduleGroups: () => presenceReq<ScheduleGroup[]>('/schedule-groups'),
  mandates: () => presenceReq<DailyMandate[]>('/mandates'),
  createMandate: (data: { userId: string; date: string; expectedArrivalTime: string; reason?: string }) =>
    presenceReq<DailyMandate>('/mandates', { method: 'POST', body: JSON.stringify(data) }),
  deleteMandate: (id: string) =>
    presenceReq<{ deleted: boolean }>(`/mandates/${id}`, { method: 'DELETE' }),
}
