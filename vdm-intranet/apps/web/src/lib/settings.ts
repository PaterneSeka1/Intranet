import { API_BASE } from './api-base'

export type SettingPair = { key: string; value: string }

export async function fetchSettings(): Promise<SettingPair[]> {
  try {
    const res = await fetch(`${API_BASE}/api/settings`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function saveSettings(settings: SettingPair[]): Promise<SettingPair[]> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Erreur ${res.status}`)
  }
  return res.json()
}

export async function deleteSetting(key: string): Promise<void> {
  await fetch(`${API_BASE}/api/settings/${key}`, {
    method: 'DELETE',
    credentials: 'include',
  })
}
