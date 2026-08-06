'use client'

import React, { useState } from 'react'
import { ROLE_LABELS, type Role, type User } from '@/types/user'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { toast } from '@/lib/toast'
import { Modal } from '@/components/ui/Modal'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { api } from '@/lib/api'

type Bu = { id: string; name: string; code: string }
type Pole = { id: string; name: string; code: string; businessUnitId: string }
type ScheduleGroup = {
  id: string
  name: string
  expectedArrivalTime: string
  expectedDepartureTime: string | null
}

interface Props {
  initialUsers: User[]
  buList: Bu[]
  poleList: Pole[]
  scheduleGroups: ScheduleGroup[]
  canManage: boolean
  currentUserRole: Role
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
  individualExpectedDepartureTime: string
  workingDays: number[]
}

const EMPTY_FORM: FormData = {
  username: '',
  password: '',
  firstName: '',
  lastName: '',
  email: '',
  role: 'EMPLOYE',
  businessUnitId: '',
  poleId: '',
  managerId: '',
  scheduleGroupId: '',
  individualExpectedArrivalTime: '',
  individualExpectedDepartureTime: '',
  workingDays: [1, 2, 3, 4, 5],
}

const WEEKDAY_OPTIONS: { label: string; value: number }[] = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Jeu', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sam', value: 6 },
  { label: 'Dim', value: 0 },
]

const ROLE_BADGE: Record<Role, string> = {
  CTO_ADMIN: 'bg-red-100 text-red-700',
  PDG: 'bg-orange-100 text-orange-700',
  DAF: 'bg-yellow-100 text-yellow-700',
  RESPONSABLE_BU: 'bg-blue-100 text-blue-700',
  RESPONSABLE_POLE: 'bg-indigo-100 text-indigo-700',
  EMPLOYE: 'bg-slate-100 text-slate-600',
  CONSULTANT: 'bg-gray-100 text-gray-600',
  STAGIAIRE: 'bg-green-100 text-green-700',
  PRESTATAIRE: 'bg-purple-100 text-purple-700',
}

const ROLE_HINTS: Record<Role, string> = {
  CTO_ADMIN: 'Accès total — administration de la plateforme',
  PDG: 'Direction générale — tableaux de bord & présences',
  DAF: 'Direction administrative — gestion du périmètre DAF',
  RESPONSABLE_BU: "Gestion d'une Business Unit et de ses membres",
  RESPONSABLE_POLE: "Supervision d'un pôle au sein d'une BU",
  EMPLOYE: 'Employé rattachable à une BU — sans droits de gestion',
  CONSULTANT: 'Consultant rattachable à une BU — sans droits de gestion',
  STAGIAIRE: 'Stagiaire rattachable à une BU — sans droits de gestion',
  PRESTATAIRE: 'Prestataire rattachable à une BU — sans droits de gestion',
}

const NO_BU_ROLES: Role[] = ['PDG']
const PROTECTED_ADMIN_ROLES: Role[] = ['CTO_ADMIN', 'PDG']
const DIRECT_MANAGER_ROLES: Role[] = [
  'CTO_ADMIN',
  'PDG',
  'DAF',
  'RESPONSABLE_BU',
  'RESPONSABLE_POLE',
]

const ALL_ROLES: Role[] = [
  'CTO_ADMIN',
  'PDG',
  'DAF',
  'RESPONSABLE_BU',
  'RESPONSABLE_POLE',
  'EMPLOYE',
  'CONSULTANT',
  'STAGIAIRE',
  'PRESTATAIRE',
]

const INPUT =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-shadow'
const SELECT = `${INPUT} bg-white`

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-base">{icon}</span>
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

function getInitials(firstName: string, lastName: string, username: string): string {
  const f = firstName.trim()
  const l = lastName.trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  return username.slice(0, 2).toUpperCase()
}

export function UsersManager({
  initialUsers,
  buList,
  poleList,
  scheduleGroups,
  canManage,
  currentUserRole,
}: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [editing, setEditing] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function f(patch: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function toggleWorkingDay(day: number) {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b),
    }))
  }

  const manageableRoles =
    currentUserRole === 'PDG'
      ? ALL_ROLES.filter((role) => !PROTECTED_ADMIN_ROLES.includes(role))
      : ALL_ROLES

  function canUseRole(role: Role) {
    return currentUserRole === 'CTO_ADMIN' || !PROTECTED_ADMIN_ROLES.includes(role)
  }

  function canEditUser(user: User) {
    if (!canManage) return false
    if (currentUserRole === 'CTO_ADMIN') return true
    return currentUserRole === 'PDG' && !PROTECTED_ADMIN_ROLES.includes(user.role)
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(u: User) {
    if (!canEditUser(u)) {
      toast.error('Seul le CTO peut modifier un compte CTO ou PDG.')
      return
    }
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
      scheduleGroupId: u.scheduleGroupId ?? '',
      individualExpectedArrivalTime: u.individualExpectedArrivalTime ?? '',
      individualExpectedDepartureTime: u.individualExpectedDepartureTime ?? '',
      workingDays: u.workingDays ?? [1, 2, 3, 4, 5],
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (editing && !canEditUser(editing)) {
      setError('Seul le CTO peut modifier un compte CTO ou PDG.')
      return
    }
    if (!canUseRole(form.role)) {
      setError('Seul le CTO peut attribuer le rôle CTO ou PDG.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        email: form.email || undefined,
        role: form.role,
        businessUnitId: form.businessUnitId || null,
        poleId: form.poleId || null,
        managerId: form.managerId || null,
        scheduleGroupId: form.scheduleGroupId || null,
        individualExpectedArrivalTime: form.individualExpectedArrivalTime || null,
        individualExpectedDepartureTime: form.individualExpectedDepartureTime || null,
        workingDays: form.workingDays,
      }
      if (!editing) {
        payload.username = form.username
        payload.password = form.password
        const created = await api.users.create(payload)
        setUsers((prev) => [created, ...prev])
        setShowForm(false)
        toast.success(`Compte « ${created.username} » créé avec succès.`)
      } else {
        if (form.password) payload.password = form.password
        const updated = await api.users.update(editing.id, payload)
        setUsers((prev) => prev.map((u) => (u.id === editing.id ? updated : u)))
        setShowForm(false)
        toast.success('Utilisateur mis à jour.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u: User) {
    if (!canEditUser(u)) {
      toast.error('Seul le CTO peut activer ou désactiver un compte CTO ou PDG.')
      return
    }
    try {
      const updated = u.isActive ? await api.users.deactivate(u.id) : await api.users.activate(u.id)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
      toast.info(
        updated.isActive ? `${updated.username} activé.` : `${updated.username} désactivé.`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.')
    }
  }

  const noBuRole = NO_BU_ROLES.includes(form.role)
  const filteredPoles = poleList.filter(
    (p) => !form.businessUnitId || p.businessUnitId === form.businessUnitId
  )
  const initials = getInitials(form.firstName, form.lastName, form.username || '?')

  const columns: Column<User>[] = [
    {
      key: 'fullName',
      label: 'Nom',
      sortable: true,
      sortValue: (u) => u.fullName ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
      render: (u) => {
        const name = u.fullName ?? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null)
        const ini = getInitials(u.firstName ?? '', u.lastName ?? '', u.username)
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#F28C38]/10 flex items-center justify-center shrink-0">
              <span className="text-[#F28C38] text-[10px] font-bold">{ini}</span>
            </div>
            <div>
              <div className="font-medium text-gray-800 text-sm">{name ?? '—'}</div>
              <div className="text-[10px] text-gray-400 font-mono">{u.username}</div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'role',
      label: 'Rôle',
      sortable: true,
      render: (u) => (
        <span
          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}
        >
          {ROLE_LABELS[u.role]}
        </span>
      ),
    },
    {
      key: 'bu',
      label: 'BU',
      sortable: true,
      sortValue: (u) => u.businessUnit?.name ?? '',
      render: (u) => <span className="text-gray-500 text-xs">{u.businessUnit?.name ?? '—'}</span>,
    },
    {
      key: 'isActive',
      label: 'Statut',
      sortable: true,
      sortValue: (u) => (u.isActive ? 'Actif' : 'Inactif'),
      render: (u) => (
        <span
          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
        >
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
        rowKey={(u) => u.id}
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
            <span className="text-sm text-gray-500">
              {users.length} compte{users.length > 1 ? 's' : ''}
            </span>
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
        actions={
          canManage
            ? (u) =>
                canEditUser(u) ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(u)
                      }}
                      className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:border-[#F28C38] hover:text-[#F28C38] transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleActive(u)
                      }}
                      className={`text-xs border px-2.5 py-1 rounded-lg transition-colors ${u.isActive ? 'border-red-100 text-red-500 hover:bg-red-50' : 'border-green-100 text-green-600 hover:bg-green-50'}`}
                    >
                      {u.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                  </>
                ) : null
            : undefined
        }
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Modifier — ${editing.username}` : 'Nouvel utilisateur'}
        subtitle={editing ? 'Mise à jour du compte' : 'Créer un nouveau compte sur le portail'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Aperçu identité */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-[#F28C38] flex items-center justify-center shrink-0">
              <span className="text-white text-base font-bold">{initials}</span>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-sm">
                {form.firstName || form.lastName ? (
                  `${form.firstName} ${form.lastName}`.trim()
                ) : (
                  <span className="text-gray-400 font-normal">Prénom Nom</span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                {form.username && (
                  <span className="text-[10px] font-mono text-gray-400">{form.username}</span>
                )}
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[form.role]}`}
                >
                  {ROLE_LABELS[form.role]}
                </span>
              </div>
            </div>
          </div>

          {/* Identité */}
          <div className="space-y-3">
            <SectionHeader icon="👤" title="Identité" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Prénom
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => f({ firstName: e.target.value })}
                  className={INPUT}
                  placeholder="Ex : Konan"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Nom
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => f({ lastName: e.target.value })}
                  className={INPUT}
                  placeholder="Ex : Yao"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => f({ email: e.target.value })}
                className={INPUT}
                placeholder="prenom.nom@veilleurdesmedias.com"
              />
            </div>
          </div>

          {/* Compte */}
          <div className="space-y-3">
            <SectionHeader icon="🔑" title="Compte" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Identifiant *
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => f({ username: e.target.value })}
                  required
                  disabled={!!editing}
                  className={`${INPUT} ${editing ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                  placeholder="Ex : KYao"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  {editing ? 'Nouveau mot de passe' : 'Mot de passe *'}
                </label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) => f({ password: e.target.value })}
                  required={!editing}
                  minLength={8}
                  placeholder={editing ? 'Vide = inchangé' : '8 caractères minimum'}
                  className={INPUT}
                />
              </div>
            </div>
          </div>

          {/* Rôle & Organisation */}
          <div className="space-y-3">
            <SectionHeader icon="🏢" title="Rôle & Organisation" />

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Rôle *
              </label>
              <select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as Role
                  if (NO_BU_ROLES.includes(role)) {
                    f({ role, businessUnitId: '', poleId: '' })
                  } else {
                    f({ role })
                  }
                }}
                required
                className={SELECT}
              >
                {manageableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">{ROLE_HINTS[form.role]}</p>
            </div>

            {noBuRole ? (
              <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl text-xs text-gray-400 border border-gray-100">
                Ce rôle n'est pas rattaché à une Business Unit.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Business Unit
                  </label>
                  <select
                    value={form.businessUnitId}
                    onChange={(e) => f({ businessUnitId: e.target.value, poleId: '' })}
                    className={SELECT}
                  >
                    <option value="">— Aucune —</option>
                    {buList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Pôle
                  </label>
                  <select
                    value={form.poleId}
                    onChange={(e) => f({ poleId: e.target.value })}
                    disabled={!form.businessUnitId}
                    className={`${SELECT} ${!form.businessUnitId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="">— Aucun —</option>
                    {filteredPoles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Manager direct{' '}
                <span className="text-gray-300 normal-case font-normal">(optionnel)</span>
              </label>
              <select
                value={form.managerId}
                onChange={(e) => f({ managerId: e.target.value })}
                className={SELECT}
              >
                <option value="">— Aucun —</option>
                {users
                  .filter(
                    (u) =>
                      u.isActive &&
                      DIRECT_MANAGER_ROLES.includes(u.role) &&
                      (!editing || u.id !== editing.id)
                  )
                  .sort((a, b) =>
                    (a.fullName ?? a.username).localeCompare(b.fullName ?? b.username)
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName ?? u.username} — {ROLE_LABELS[u.role]}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Horaires */}
          <div className="space-y-3">
            <SectionHeader icon="🕐" title="Horaires" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Groupe horaire
                </label>
                <select
                  value={form.scheduleGroupId}
                  onChange={(e) => f({ scheduleGroupId: e.target.value })}
                  className={SELECT}
                >
                  <option value="">— Aucun —</option>
                  {scheduleGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.expectedArrivalTime})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Arrivée individuelle{' '}
                  <span className="text-gray-300 normal-case font-normal">(prioritaire)</span>
                </label>
                <input
                  type="time"
                  value={form.individualExpectedArrivalTime}
                  onChange={(e) => f({ individualExpectedArrivalTime: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Départ individuel{' '}
                  <span className="text-gray-300 normal-case font-normal">(prioritaire)</span>
                </label>
                <input
                  type="time"
                  value={form.individualExpectedDepartureTime}
                  onChange={(e) => f({ individualExpectedDepartureTime: e.target.value })}
                  className={INPUT}
                />
              </div>
            </div>
          </div>

          {/* Jours de travail récurrents */}
          <div className="space-y-3">
            <SectionHeader icon="📅" title="Jours de travail récurrents" />
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((wd) => {
                const active = form.workingDays.includes(wd.value)
                return (
                  <button
                    key={wd.value}
                    type="button"
                    onClick={() => toggleWorkingDay(wd.value)}
                    className={[
                      'w-12 py-2 rounded-xl text-xs font-bold border transition-colors',
                      active
                        ? 'border-[#F28C38] bg-[#F28C38]/10 text-[#F28C38]'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300',
                    ].join(' ')}
                  >
                    {wd.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Jours travaillés chaque semaine par défaut — un jour non coché devient « Repos » et
              n&apos;est plus compté absent. Les exceptions ponctuelles (rotation, mois
              particulier…) se gèrent depuis Emploi du temps. Tout décocher si le planning de cet
              employé est entièrement défini par mandats.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
