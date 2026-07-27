import { cache } from 'react'
import { cookies } from 'next/headers'
import type { User } from '@/types/user'
import { API_BASE as API } from './api-base'

const COOKIE = process.env.COOKIE_NAME ?? 'vdm_token'

export type CurrentUserState = {
  user: User | null
  unavailable: boolean
}

export const getCurrentUserState = cache(async (): Promise<CurrentUserState> => {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return { user: null, unavailable: false }

  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Cookie: `${COOKIE}=${token}` },
      cache: 'no-store',
    })
    if (res.ok) return { user: await res.json(), unavailable: false }
    if (res.status === 401 || res.status === 403) return { user: null, unavailable: false }
    return { user: null, unavailable: true }
  } catch {
    return { user: null, unavailable: true }
  }
})

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { user } = await getCurrentUserState()
  return user
})

export async function serverFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null

  try {
    const res = await fetch(`${API}/api${path}`, {
      headers: {
        Cookie: `${COOKIE}=${token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      cache: 'no-store',
      ...init,
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
