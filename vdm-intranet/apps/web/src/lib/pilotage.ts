const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type Summary = {
  date: string
  totalActive: number
  present: number
  late: number
  absent: number
  presenceRate: number
  mandatesToday: number
}

export type PresenceByBu = {
  buId: string
  buName: string
  buCode: string
  total: number
  present: number
  late: number
  absent: number
}

export type ConnectionPoint = {
  date: string
  connexions: number
}

export type ActionPoint = {
  action: string
  count: number
}

export type ActivityLogEntry = {
  id: string
  action: string
  entity?: string | null
  entityId?: string | null
  details?: unknown
  ipAddress?: string | null
  userAgent?: string | null
  occurredAt: string
  user: { id: string; username: string; fullName?: string | null; role: string }
}

export type ActivityLogPage = {
  total: number
  page: number
  limit: number
  pages: number
  logs: ActivityLogEntry[]
}

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  return res.json() as Promise<T>
}

export const pilotageApi = {
  summary: (): Promise<Summary> => req<Summary>('/pilotage/summary'),
  presenceByBu: (): Promise<PresenceByBu[]> => req<PresenceByBu[]>('/pilotage/presence-by-bu'),
  connectionsChart: (days = 14): Promise<ConnectionPoint[]> => req<ConnectionPoint[]>(`/pilotage/connections-chart?days=${days}`),
  activityChart: (days = 30): Promise<ActionPoint[]> => req<ActionPoint[]>(`/pilotage/activity-chart?days=${days}`),
  activityLog: (params: { page?: number; limit?: number; search?: string; action?: string }): Promise<ActivityLogPage> => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.search) qs.set('search', params.search)
    if (params.action) qs.set('action', params.action)
    return req<ActivityLogPage>(`/pilotage/activity-log?${qs.toString()}`)
  },
}

export async function downloadReport(path: string, filename: string) {
  const res = await fetch(`${BASE}/api/reports/${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
