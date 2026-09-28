import { apiFetch } from './http'

export type BusinessUnitRef = { id: string; name: string; code: string }

/**
 * Audience d'un onglet ou d'un dossier : global (visible par tous), ou liste des BU concernées,
 * toutes au même niveau. Un onglet rangé dans un dossier a l'audience du dossier (la sienne
 * reste vide) — cf. tabAudience().
 */
export type AudienceFields = {
  isGlobal: boolean
  businessUnits: { businessUnit: BusinessUnitRef }[]
}

export type TabFolder = AudienceFields & {
  id: string
  name: string
  icon?: string | null
  color?: string | null
  order: number
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy: { id: string; username: string; fullName?: string | null }
}

export type Tab = AudienceFields & {
  id: string
  name: string
  url: string
  description?: string | null
  icon?: string | null
  color?: string | null
  isActive: boolean
  folderId: string | null
  order: number
  createdById: string
  createdAt: string
  updatedAt: string
  folder: { id: string; name: string; icon?: string | null; color?: string | null } | null
  createdBy: { id: string; username: string; fullName?: string | null }
  // Présence d'un identifiant partagé (jamais le secret) — cf. tabsApi.getCredential pour le
  // révéler explicitement (consultation journalisée côté serveur).
  credential: { id: string } | null
}

/** Audience effective : celle du dossier pour un onglet rangé, sinon celle de l'élément. */
export function tabAudience(
  item: AudienceFields & { folderId?: string | null },
  foldersById?: Map<string, TabFolder>
): { isGlobal: boolean; businessUnits: BusinessUnitRef[] } {
  const source = (item.folderId && foldersById?.get(item.folderId)) || item
  return {
    isGlobal: source.isGlobal,
    businessUnits: source.isGlobal ? [] : source.businessUnits.map((b) => b.businessUnit),
  }
}

/** Même audience (mêmes BU, dans n'importe quel ordre, ou toutes deux globales). */
export function sameAudience(
  a: { isGlobal: boolean; businessUnits: BusinessUnitRef[] },
  b: { isGlobal: boolean; businessUnits: BusinessUnitRef[] }
) {
  if (a.isGlobal || b.isGlobal) return a.isGlobal === b.isGlobal
  const ids = new Set(a.businessUnits.map((bu) => bu.id))
  return ids.size === b.businessUnits.length && b.businessUnits.every((bu) => ids.has(bu.id))
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

// Audience : réservée aux gestionnaires globaux (un responsable BU crée pour sa seule BU).
export type AudiencePayload = { isGlobal?: boolean; businessUnitIds?: string[] }

export type CreateTabPayload = AudiencePayload & {
  name: string
  url: string
  description?: string
  icon?: string
  color?: string
  // Rangé dans un dossier, l'onglet hérite de son audience (champs d'audience ignorés).
  folderId?: string
}

export type UpdateTabPayload = AudiencePayload &
  Partial<{
    name: string
    url: string
    description: string
    icon: string
    color: string
    isActive: boolean
    // null = retire l'onglet de son dossier (il garde l'audience du dossier quitté).
    folderId: string | null
  }>

export type CreateTabFolderPayload = AudiencePayload & {
  name: string
  icon?: string
  color?: string
}

export type UpdateTabFolderPayload = AudiencePayload &
  Partial<{
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
  getCredential: (id: string): Promise<TabCredential> =>
    req<TabCredential>(`/tabs/${id}/credential`),
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
