import { apiFetch } from './http'

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

function req<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, init)
}

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    req<NotificationsPage>(`/notifications?page=${page}&limit=${limit}`),

  unreadCount: () => req<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) => req<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () => req<{ updated: number }>('/notifications/read-all', { method: 'PATCH' }),

  remove: (id: string) => req<{ id: string }>(`/notifications/${id}`, { method: 'DELETE' }),
}
