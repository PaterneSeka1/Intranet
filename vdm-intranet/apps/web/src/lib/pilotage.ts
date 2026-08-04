import { apiFetch } from './http'

export type Summary = {
  date: string
  totalActive: number
  present: number
  late: number
  onLeave: number
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
  onLeave: number
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

export type PeriodReportBu = {
  buId: string
  buName: string
  buCode: string
  workingDays: number
  totalUserDays: number
  present: number
  late: number
  onLeave: number
  absent: number
  presenceRate: number
}

/** `date` est une string ISO ; toutes les autres clés (codes BU + `overall`) sont des taux numériques. */
export type PeriodReportTrendPoint = Record<string, string | number>

export type PeriodReport = {
  period: 'week' | 'month'
  from: string
  to: string
  byBu: PeriodReportBu[]
  trend: PeriodReportTrendPoint[]
}

function req<T>(path: string): Promise<T> {
  return apiFetch<T>(path)
}

export const pilotageApi = {
  summary: (): Promise<Summary> => req<Summary>('/pilotage/summary'),
  presenceByBu: (): Promise<PresenceByBu[]> => req<PresenceByBu[]>('/pilotage/presence-by-bu'),
  periodReport: (period: 'week' | 'month', date?: string): Promise<PeriodReport> =>
    req<PeriodReport>(`/pilotage/period-report?period=${period}${date ? `&date=${date}` : ''}`),
  connectionsChart: (days = 14): Promise<ConnectionPoint[]> =>
    req<ConnectionPoint[]>(`/pilotage/connections-chart?days=${days}`),
  activityChart: (days = 30): Promise<ActionPoint[]> =>
    req<ActionPoint[]>(`/pilotage/activity-chart?days=${days}`),
  activityLog: (params: {
    page?: number
    limit?: number
    search?: string
    action?: string
  }): Promise<ActivityLogPage> => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.search) qs.set('search', params.search)
    if (params.action) qs.set('action', params.action)
    return req<ActivityLogPage>(`/pilotage/activity-log?${qs.toString()}`)
  },
}
