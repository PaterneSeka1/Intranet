'use client'

import type { User } from '@/types/user'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (res.status === 401 || res.status === 403) {
    if (typeof window !== 'undefined') {
      window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`
    }
    throw new ApiError(res.status, 'Session expirée. Redirection vers la connexion…')
  }
  if (!res.ok) {
    let msg = 'Erreur serveur'
    try { const body = await res.json(); msg = body.message ?? msg } catch { /* ignore */ }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}

export interface LoginResponse {
  user: User
  requiresFirstLoginGeolocation: boolean
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      req<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    logout: () => req<{ message: string }>('/auth/logout', { method: 'POST' }),
    me: () => req<User>('/auth/me'),
  },
  users: {
    list: () => req<User[]>('/users'),
    get: (id: string) => req<User>(`/users/${id}`),
    create: (data: unknown) => req<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      req<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    activate: (id: string) => req<User>(`/users/${id}/activate`, { method: 'PATCH' }),
    deactivate: (id: string) => req<User>(`/users/${id}/deactivate`, { method: 'PATCH' }),
  },
}
