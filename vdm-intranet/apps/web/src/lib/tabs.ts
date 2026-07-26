import { API_BASE as BASE } from './api-base'

export type Tab = {
  id: string
  name: string
  url: string
  description?: string | null
  icon?: string | null
  color?: string | null
  isActive: boolean
  businessUnitId: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  businessUnit: { id: string; name: string; code: string } | null
  createdBy: { id: string; username: string; fullName?: string | null }
}

export type CreateTabPayload = {
  name: string
  url: string
  description?: string
  icon?: string
  color?: string
  businessUnitId?: string
}

export type UpdateTabPayload = Partial<{
  name: string
  url: string
  description: string
  icon: string
  color: string
  isActive: boolean
}>

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Erreur ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const tabsApi = {
  list: (buId?: string): Promise<Tab[]> => {
    const qs = buId ? `?businessUnitId=${encodeURIComponent(buId)}` : ''
    return req<Tab[]>(`/tabs${qs}`)
  },
  create: (payload: CreateTabPayload): Promise<Tab> =>
    req<Tab>('/tabs', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: UpdateTabPayload): Promise<Tab> =>
    req<Tab>(`/tabs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string): Promise<void> => req<void>(`/tabs/${id}`, { method: 'DELETE' }),
}
