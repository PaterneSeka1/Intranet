import { apiFetch } from './http'

export type PublicHoliday = {
  id: string
  date: string
  label: string
  isRecurring: boolean
  createdAt: string
  updatedAt: string
}

type Payload = { date: string; label: string; isRecurring?: boolean }

function req<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, init)
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
