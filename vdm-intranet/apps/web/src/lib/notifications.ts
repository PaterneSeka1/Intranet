import { API_BASE as API } from './api-base'

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export type NotificationsPage = {
  total: number
  page: number
  limit: number
  pages: number
  notifications: NotificationItem[]
}

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

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    req<NotificationsPage>(`/notifications?page=${page}&limit=${limit}`),

  unreadCount: () => req<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) => req<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () => req<{ updated: number }>('/notifications/read-all', { method: 'PATCH' }),
}
