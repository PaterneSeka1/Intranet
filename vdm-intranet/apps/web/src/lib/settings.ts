import { API_BASE } from './api-base'
import { apiFetch, apiFetchVoid } from './http'

export type SettingPair = { key: string; value: string }

// Lecture publique (page de login, favicon, etc.) : ne doit jamais rediriger/échouer bruyamment.
export async function fetchSettings(): Promise<SettingPair[]> {
  try {
    const res = await fetch(`${API_BASE}/api/settings`, { cache: 'no-store' })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export function saveSettings(settings: SettingPair[]): Promise<SettingPair[]> {
  return apiFetch<SettingPair[]>('/settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
  })
}

export function deleteSetting(key: string): Promise<void> {
  return apiFetchVoid(`/settings/${key}`, { method: 'DELETE' })
}
