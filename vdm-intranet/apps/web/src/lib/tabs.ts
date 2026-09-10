import { apiFetch } from './http'

export type TabFolder = {
  id: string
  name: string
  icon?: string | null
  color?: string | null
  order: number
  businessUnitId: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  businessUnit: { id: string; name: string; code: string } | null
  createdBy: { id: string; username: string; fullName?: string | null }
}

export type Tab = {
  id: string
  name: string
  url: string
  description?: string | null
  icon?: string | null
  color?: string | null
  isActive: boolean
  businessUnitId: string | null
  folderId: string | null
  order: number
  createdById: string
  createdAt: string
  updatedAt: string
  businessUnit: { id: string; name: string; code: string } | null
  folder: { id: string; name: string; icon?: string | null; color?: string | null } | null
  createdBy: { id: string; username: string; fullName?: string | null }
  // Présence d'un identifiant partagé (jamais le secret) — cf. tabsApi.getCredential pour le
  // révéler explicitement (consultation journalisée côté serveur).
  credential: { id: string } | null
}

export type TabCredential = {
  username: string
  password: string
  notes: string | null
  updatedAt: string
  updatedBy: { id: string; username: string; fullName?: string | null }
}

export type SetTabCredentialPayload = {
  username: string
  password: string
  notes?: string
}

export type CreateTabPayload = {
  name: string
  url: string
  description?: string
  icon?: string
  color?: string
  businessUnitId?: string
  folderId?: string
}

export type UpdateTabPayload = Partial<{
  name: string
  url: string
  description: string
  icon: string
  color: string
  isActive: boolean
  folderId: string | null
}>

export type CreateTabFolderPayload = {
  name: string
  icon?: string
  color?: string
  businessUnitId?: string
}

export type UpdateTabFolderPayload = Partial<{
  name: string
  icon: string
  color: string
}>

// { id, order } pour un dossier, ou { id, order, folderId } pour un onglet — folderId omis =
// onglet non déplacé entre dossiers, folderId: null = retiré de tout dossier.
export type ReorderItem = { id: string; order: number; folderId?: string | null }

function req<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, init)
}

export const tabsApi = {
  list: (buId?: string): Promise<Tab[]> => {
    const qs = buId ? `?businessUnitId=${encodeURIComponent(buId)}` : ''
    return req<Tab[]>(`/tabs${qs}`)
  },
  create: (payload: CreateTabPayload): Promise<Tab> =>
    req<Tab>('/tabs', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: UpdateTabPayload): Promise<Tab> =>
    req<Tab>(`/tabs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string): Promise<void> => req<void>(`/tabs/${id}`, { method: 'DELETE' }),
  reorder: (items: ReorderItem[]): Promise<{ updated: number }> =>
    req<{ updated: number }>('/tabs/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),
  getCredential: (id: string): Promise<TabCredential> => req<TabCredential>(`/tabs/${id}/credential`),
  setCredential: (
    id: string,
    payload: SetTabCredentialPayload
  ): Promise<{ username: string; notes: string | null; updatedAt: string }> =>
    req(`/tabs/${id}/credential`, { method: 'PUT', body: JSON.stringify(payload) }),
  removeCredential: (id: string): Promise<void> =>
    req<void>(`/tabs/${id}/credential`, { method: 'DELETE' }),
}

export const tabFoldersApi = {
  list: (buId?: string): Promise<TabFolder[]> => {
    const qs = buId ? `?businessUnitId=${encodeURIComponent(buId)}` : ''
    return req<TabFolder[]>(`/tabs/folders${qs}`)
  },
  create: (payload: CreateTabFolderPayload): Promise<TabFolder> =>
    req<TabFolder>('/tabs/folders', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: UpdateTabFolderPayload): Promise<TabFolder> =>
    req<TabFolder>(`/tabs/folders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string): Promise<void> => req<void>(`/tabs/folders/${id}`, { method: 'DELETE' }),
  reorder: (items: ReorderItem[]): Promise<{ updated: number }> =>
    req<{ updated: number }>('/tabs/folders/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    }),
}
