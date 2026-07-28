import { API_BASE as API } from './api-base'

export type PublicHoliday = {
  id: string
  date: string
  label: string
  isRecurring: boolean
  createdAt: string
  updatedAt: string
}

type Payload = { date: string; label: string; isRecurring?: boolean }

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

export const publicHolidaysApi = {
  list: () => req<PublicHoliday[]>('/public-holidays'),

  create: (payload: Payload) =>
    req<PublicHoliday>('/public-holidays', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: Partial<Payload>) =>
    req<PublicHoliday>(`/public-holidays/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  remove: (id: string) => req<{ deleted: boolean }>(`/public-holidays/${id}`, { method: 'DELETE' }),
}

/** Miroir client de `matchesDate` côté API — compare un ISO "YYYY-MM-DD" à la liste des jours fériés. */
export function findHolidayForDate(
  iso: string,
  holidays: PublicHoliday[]
): PublicHoliday | undefined {
  const [y, m, d] = iso.split('-').map(Number)
  return holidays.find((h) => {
    const hd = new Date(h.date)
    return h.isRecurring
      ? hd.getUTCMonth() + 1 === m && hd.getUTCDate() === d
      : hd.getUTCFullYear() === y && hd.getUTCMonth() + 1 === m && hd.getUTCDate() === d
  })
}
