import { apiFetch } from './http'

export type SearchResult = {
  type: 'user' | 'tab' | 'announcement'
  id: string
  label: string
  sublabel: string | null
  href: string
  external: boolean
}

export const searchApi = {
  query: (q: string, signal?: AbortSignal): Promise<SearchResult[]> =>
    apiFetch<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`, { signal }),
}
