'use client'

import type { User } from '@/types/user'
import { apiFetch, ApiError } from './http'

export { ApiError }

export interface LoginResponse {
  user: User
  requiresFirstLoginGeolocation: boolean
}

export const api = {
  auth: {
    login: (identifier: string, password: string) =>
      apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
        skipAuthRedirect: true,
      }),
    logout: () => apiFetch<{ message: string }>('/auth/logout', { method: 'POST' }),
    me: () => apiFetch<User>('/auth/me'),
    forgotPassword: (identifier: string) =>
      apiFetch<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      }),
    resetPassword: (token: string, newPassword: string) =>
      apiFetch<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
  },
  users: {
    list: () => apiFetch<User[]>('/users'),
    get: (id: string) => apiFetch<User>(`/users/${id}`),
    create: (data: unknown) =>
      apiFetch<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      apiFetch<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateScoped: (id: string, data: unknown) =>
      apiFetch<User>(`/users/${id}/scoped`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateMe: (data: unknown) =>
      apiFetch<User>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
    activate: (id: string) => apiFetch<User>(`/users/${id}/activate`, { method: 'PATCH' }),
    deactivate: (id: string) => apiFetch<User>(`/users/${id}/deactivate`, { method: 'PATCH' }),
  },
}
