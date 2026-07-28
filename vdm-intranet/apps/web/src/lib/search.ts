import { API_BASE as API } from './api-base'

export type SearchResult = {
  type: 'user' | 'tab' | 'announcement'
  id: string
  label: string
  sublabel: string | null
  href: string
  external: boolean
}

export const searchApi = {
  query: async (q: string, signal?: AbortSignal): Promise<SearchResult[]> => {
    const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`, {
      credentials: 'include',
      signal,
    })
    if (!res.ok) throw new Error(`Erreur ${res.status}`)
    return res.json()
  },
}
