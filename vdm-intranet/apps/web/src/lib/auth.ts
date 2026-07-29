import { cache } from 'react'
import { cookies } from 'next/headers'
import type { User } from '@/types/user'
import { API_BASE as API } from './api-base'

const COOKIE = process.env.COOKIE_NAME ?? 'vdm_token'

export type CurrentUserState = {
  user: User | null
  unavailable: boolean
}

const REQUEST_TIMEOUT_MS = 8_000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export const getCurrentUserState = cache(async (): Promise<CurrentUserState> => {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return { user: null, unavailable: false }

  // Un aléa réseau transitoire entre le serveur Next.js et l'API ne doit pas
  // faire passer toute l'application protégée en "service indisponible" :
  // on retente une fois avant de conclure à une vraie panne.
  const attempt = async (): Promise<CurrentUserState | null> => {
    try {
      const res = await fetchWithTimeout(`${API}/api/auth/me`, {
        headers: { Cookie: `${COOKIE}=${token}` },
        cache: 'no-store',
      })
      if (res.ok) return { user: await res.json(), unavailable: false }
      if (res.status === 401 || res.status === 403) return { user: null, unavailable: false }
      return null
    } catch {
      return null
    }
  }

  return (await attempt()) ?? (await attempt()) ?? { user: null, unavailable: true }
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
    const res = await fetchWithTimeout(`${API}/api${path}`, {
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
