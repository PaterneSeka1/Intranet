'use client'

import React, { useState, useId } from 'react'
import { ROLE_LABELS, type Role, type User } from '@/types/user'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { toast } from '@/lib/toast'
import { Modal } from '@/components/ui/Modal'

type Bu = { id: string; name: string; code: string }
type Pole = { id: string; name: string; code: string; businessUnitId: string }
type ScheduleGroup = { id: string; name: string; expectedArrivalTime: string }

interface Props {
  initialUsers: User[]
  buList: Bu[]
  poleList: Pole[]
  scheduleGroups: ScheduleGroup[]
  canManage: boolean
}

type FormData = {
  username: string
  password: string
  firstName: string
  lastName: string
  email: string
  role: Role
  businessUnitId: string
  poleId: string
  managerId: string
  scheduleGroupId: string
  individualExpectedArrivalTime: string
}

const EMPTY_FORM: FormData = {
  username: '',
  password: '',
  firstName: '',
  lastName: '',
  email: '',
  role: 'CONSULTANT',
  businessUnitId: '',
  poleId: '',
  managerId: '',
  scheduleGroupId: '',
  individualExpectedArrivalTime: '',
}

import { API_BASE as API } from '@/lib/api-base'

async function apiReq<T>(path: string, init?: RequestInit): Promise<T> {
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

const ROLE_BADGE: Record<Role, string> = {
  CTO_ADMIN: 'bg-red-100 text-red-700',
  PDG: 'bg-orange-100 text-orange-700',
  DAF: 'bg-yellow-100 text-yellow-700',
  RESPONSABLE_BU: 'bg-blue-100 text-blue-700',
  RESPONSABLE_POLE: 'bg-indigo-100 text-indigo-700',
  CONSULTANT: 'bg-gray-100 text-gray-600',
  STAGIAIRE: 'bg-green-100 text-green-700',
  PRESTATAIRE: 'bg-purple-100 text-purple-700',
}

const ALL_ROLES: Role[] = [
  'CTO_ADMIN', 'PDG', 'DAF', 'RESPONSABLE_BU', 'RESPONSABLE_POLE',
  'CONSULTANT', 'STAGIAIRE', 'PRESTATAIRE',
]

const INPUT = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-shadow'
const SELECT = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] bg-white transition-shadow'

function Field({ label, children }: { label: string; children: React.ReactElement<{ id?: string }> }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {React.cloneElement(children, { id })}
    </div>
  )
}

export function UsersManager({ initialUsers, buList, poleList, scheduleGroups, canManage }: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [editing, setEditing] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(u: User) {
    setEditing(u)
    setForm({
      username: u.username,
      password: '',
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      email: u.email ?? '',
      role: u.role,
      businessUnitId: u.businessUnit?.id ?? '',
      poleId: u.pole?.id ?? '',
      managerId: u.manager?.id ?? '',
      scheduleGroupId: '',
      individualExpectedArrivalTime: '',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        role: form.role,
        businessUnitId: form.businessUnitId || undefined,
        poleId: form.poleId || undefined,
        managerId: form.managerId || undefined,
        scheduleGroupId: form.scheduleGroupId || undefined,
        individualExpectedArrivalTime: form.individualExpectedArrivalTime || undefined,
      }
      if (!editing) {
        payload.username = form.username
        payload.password = form.password
        const created = await apiReq<User>('/users', { method: 'POST', body: JSON.stringify(payload) })
        setUsers(prev => [created, ...prev])
        setShowForm(false)
        setEditing(null)
        toast.success(`Utilisateur « ${created.username} » créé avec succès.`)
      } else {
        if (form.password) payload.password = form.password
        const updated = await apiReq<User>(`/users/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setUsers(prev => prev.map(u => u.id === editing.id ? updated : u))
        setShowForm(false)
        setEditing(null)
        toast.success('Utilisateur mis à jour.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u: User) {
    try {
      const path = u.isActive ? `/users/${u.id}/deactivate` : `/users/${u.id}/activate`
      const updated = await apiReq<User>(path, { method: 'PATCH' })
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x))
      toast.info(updated.isActive ? `${updated.username} activé.` : `${updated.username} désactivé.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.')
    }
  }

  // -------------------------------------------------------------------------
  // Column definitions
  // -------------------------------------------------------------------------

  const columns: Column<User>[] = [
    {
      key: 'fullName',
      label: 'Nom',
      sortable: true,
      sortValue: u => u.fullName ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
      render: u => (
        <span className="font-medium text-gray-800">
          {u.fullName ?? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—')}
        </span>
      ),
    },
    {
      key: 'username',
      label: 'Identifiant',
      sortable: true,
      render: u => <span className="font-mono text-xs text-gray-500">{u.username}</span>,
    },
    {
      key: 'role',
      label: 'Rôle',
      sortable: true,
      render: u => (
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>
          {ROLE_LABELS[u.role]}
        </span>
      ),
    },
    {
      key: 'bu',
      label: 'BU',
      sortable: true,
      sortValue: u => u.businessUnit?.name ?? '',
      render: u => <span className="text-gray-500 text-xs">{u.businessUnit?.name ?? '—'}</span>,
    },
    {
      key: 'isActive',
      label: 'Statut',
      sortable: true,
      sortValue: u => (u.isActive ? 'Actif' : 'Inactif'),
      render: u => (
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
          {u.isActive ? 'Actif' : 'Inactif'}
        </span>
      ),
    },
  ]

  return (
    <>
      <DataTable<User>
        data={users}
        columns={columns}
        rowKey={u => u.id}
        defaultPageSize={25}
        storageKey="utilisateurs"
        searchable
        searchPlaceholder="Nom, identifiant, BU…"
        filterFn={(u, q) =>
          u.username.toLowerCase().includes(q) ||
          (u.fullName ?? '').toLowerCase().includes(q) ||
          (u.businessUnit?.name ?? '').toLowerCase().includes(q) ||
          ROLE_LABELS[u.role].toLowerCase().includes(q)
        }
        emptyMessage="Aucun utilisateur trouvé."
        defaultSort={{ key: 'role', dir: 'asc' }}
        header={
          <>
            <span className="text-sm text-gray-500">{users.length} compte{users.length > 1 ? 's' : ''}</span>
            {canManage && (
              <button
                onClick={openCreate}
                className="bg-[#F28C38] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e07d29] transition-colors"
              >
                + Nouveau
              </button>
            )}
          </>
        }
        actions={canManage ? u => (
          <>
            <button
              onClick={e => { e.stopPropagation(); openEdit(u) }}
              className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:border-[#F28C38] hover:text-[#F28C38] transition-colors"
            >
              Modifier
            </button>
            <button
              onClick={e => { e.stopPropagation(); toggleActive(u) }}
              className={`text-xs border px-2.5 py-1 rounded-lg transition-colors ${
                u.isActive
                  ? 'border-red-100 text-red-500 hover:bg-red-50'
                  : 'border-green-100 text-green-600 hover:bg-green-50'
              }`}
            >
              {u.isActive ? 'Désactiver' : 'Activer'}
            </button>
          </>
        ) : undefined}
      />

      {/* Modale */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Modifier — ${editing.username}` : 'Nouvel utilisateur'}
        subtitle={editing ? 'Mise à jour des informations du compte' : 'Création d\'un nouveau compte utilisateur'}
        size="xl"
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Prénom">
                  <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Nom">
                  <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={INPUT} />
                </Field>
              </div>

              <Field label="Identifiant *">
                <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required disabled={!!editing} className={`${INPUT} ${editing ? 'bg-gray-50 text-gray-400' : ''}`} />
              </Field>

              <Field label={editing ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe *'}>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editing} minLength={4} placeholder={editing ? 'Laisser vide pour ne pas changer' : ''} className={INPUT} />
              </Field>

              <Field label="Email">
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={INPUT} />
              </Field>

              <Field label="Rôle *">
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })} required className={SELECT}>
                  {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Business Unit">
                  <select
                    value={form.businessUnitId}
                    onChange={e => setForm({ ...form, businessUnitId: e.target.value, poleId: '' })}
                    className={SELECT}
                  >
                    <option value="">— Aucune —</option>
                    {buList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
                <Field label="Pôle">
                  <select value={form.poleId} onChange={e => setForm({ ...form, poleId: e.target.value })} className={SELECT}>
                    <option value="">— Aucun —</option>
                    {poleList
                      .filter(p => !form.businessUnitId || p.businessUnitId === form.businessUnitId)
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                    }
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Groupe horaire">
                  <select value={form.scheduleGroupId} onChange={e => setForm({ ...form, scheduleGroupId: e.target.value })} className={SELECT}>
                    <option value="">— Aucun —</option>
                    {scheduleGroups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.expectedArrivalTime})</option>)}
                  </select>
                </Field>
                <Field label="Heure individuelle">
                  <input type="time" value={form.individualExpectedArrivalTime} onChange={e => setForm({ ...form, individualExpectedArrivalTime: e.target.value })} className={INPUT} />
                </Field>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                  {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
      </Modal>
    </>
  )
}
