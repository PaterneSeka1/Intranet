import { API_BASE as API } from './api-base'

export type Announcement = {
  id: string
  title: string
  body: string
  businessUnitId: string | null
  isPinned: boolean
  isActive: boolean
  publishedAt: string
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  businessUnit: { id: string; name: string; code: string } | null
  createdBy: { id: string; username: string; fullName: string | null }
}

type CreatePayload = {
  title: string
  body: string
  businessUnitId?: string | null
  isPinned?: boolean
  isActive?: boolean
  publishedAt?: string
  expiresAt?: string | null
}

type UpdatePayload = Partial<CreatePayload>

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Erreur ${res.status}`)
  }
  return res.json()
}

export const announcementsApi = {
  list: (activeOnly = false) =>
    req<Announcement[]>(`/announcements${activeOnly ? '?active=true' : ''}`),

  create: (payload: CreatePayload) =>
    req<Announcement>('/announcements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdatePayload) =>
    req<Announcement>(`/announcements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    req<{ deleted: boolean }>(`/announcements/${id}`, { method: 'DELETE' }),
}
