'use client'

import type { User } from '@/types/user'
import { API_BASE as BASE } from './api-base'

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
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      signal: controller.signal,
      ...init,
    })
  } finally {
    clearTimeout(tid)
  }
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
    forgotPassword: (identifier: string) =>
      req<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier }) }),
    resetPassword: (token: string, newPassword: string) =>
      req<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
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
