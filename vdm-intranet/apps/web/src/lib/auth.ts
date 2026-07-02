import { cookies } from 'next/headers'
import type { User } from '@/types/user'

const COOKIE = process.env.COOKIE_NAME ?? 'vdm_token'
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null

  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Cookie: `${COOKIE}=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function serverFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null

  try {
    const res = await fetch(`${API}/api${path}`, {
      headers: { Cookie: `${COOKIE}=${token}`, 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
      ...init,
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
