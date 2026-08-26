'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { User as UserIcon, KeyRound, Building2, Clock, CalendarDays, type LucideIcon } from 'lucide-react'
import { ROLE_LABELS, type Role, type User } from '@/types/user'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { toast } from '@/lib/toast'
import { Modal } from '@/components/ui/Modal'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { api } from '@/lib/api'
import { leavesApi, type CongeEmployeeCandidate } from '@/lib/leaves'

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
  /** DAF/RESPONSABLE_BU/RESPONSABLE_POLE : édition scopée à leur périmètre (PATCH /users/:id/scoped). */
  canManageScoped: boolean
  currentUserRole: Role
  currentUserId: string
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
// Reflète SCOPED_WRITE_FORBIDDEN_TARGET_ROLES (users.service.ts) : un manager scopé (DAF,
// RESPONSABLE_BU, RESPONSABLE_POLE) ne peut jamais gérer un pair ou un supérieur via /users/:id/scoped.
const SCOPED_WRITE_FORBIDDEN_TARGET_ROLES: Role[] = ['CTO_ADMIN', 'PDG', 'DAF', 'RESPONSABLE_BU']
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

function SectionHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
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
  canManageScoped,
  currentUserRole,
  currentUserId,
}: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [editing, setEditing] = useState<User | null>(null)
  const [scopedEdit, setScopedEdit] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Sélecteur "employé CONGE existant" — pré-remplit l'identité à la création pour garantir
  // qu'on crée bien le même employé que sur la plateforme de congés (matricule == username).
  const [congeEmployees, setCongeEmployees] = useState<CongeEmployeeCandidate[]>([])
  const [congeConfigured, setCongeConfigured] = useState(false)
  const [selectedCongeMatricule, setSelectedCongeMatricule] = useState('')

  // RESPONSABLE_POLE ne touche jamais aux champs administratifs (identité/mot de passe), seulement
  // au planning — cf. assertCanManageScopedTarget (users.service.ts).
  const scopedAdminFieldsAllowed = currentUserRole !== 'RESPONSABLE_POLE'

  function canScopedEditTarget(u: User) {
    return (
      canManageScoped &&
      u.id !== currentUserId &&
      !SCOPED_WRITE_FORBIDDEN_TARGET_ROLES.includes(u.role)
    )
  }

  // Activer/désactiver via /users/:id/activate|deactivate n'est ouvert qu'à DAF/RESPONSABLE_BU
  // côté API (CAN_MANAGE_USERS_BU_SCOPE) — jamais RESPONSABLE_POLE.
  function canScopedActivateTarget(u: User) {
    return scopedAdminFieldsAllowed && canScopedEditTarget(u)
  }

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
    setScopedEdit(false)
    setForm(EMPTY_FORM)
    setSelectedCongeMatricule('')
    setError('')
    setShowForm(true)
    void loadCongeEmployees()
  }

  async function loadCongeEmployees() {
    try {
      const result = await leavesApi.congeEmployeeCandidates()
      setCongeConfigured(result.configured)
      setCongeEmployees(result.employees)
    } catch {
      // Intégration optionnelle : un échec ne doit jamais bloquer la création manuelle.
      setCongeConfigured(false)
      setCongeEmployees([])
    }
  }

  function selectCongeEmployee(matricule: string) {
    setSelectedCongeMatricule(matricule)
    const emp = congeEmployees.find((e) => e.matricule === matricule)
    if (!emp) return
    f({
      username: emp.matricule,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email ?? '',
    })
  }

  function openEdit(u: User) {
    if (canEditUser(u)) {
      setScopedEdit(false)
    } else if (canScopedEditTarget(u)) {
      setScopedEdit(true)
    } else {
      toast.error('Vous ne pouvez pas modifier cet utilisateur.')
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

    if (editing && scopedEdit) {
      if (!canScopedEditTarget(editing)) {
        setError('Vous ne pouvez pas modifier cet utilisateur.')
        return
      }
      setSaving(true)
      setError('')
      try {
        const payload: Record<string, unknown> = {
          scheduleGroupId: form.scheduleGroupId || null,
          individualExpectedArrivalTime: form.individualExpectedArrivalTime || null,
          individualExpectedDepartureTime: form.individualExpectedDepartureTime || null,
          workingDays: form.workingDays,
        }
        if (scopedAdminFieldsAllowed) {
          payload.firstName = form.firstName || undefined
          payload.lastName = form.lastName || undefined
          payload.email = form.email || undefined
          if (form.password) payload.password = form.password
        }
        const updated = await api.users.updateScoped(editing.id, payload)
        setUsers((prev) => prev.map((u) => (u.id === editing.id ? updated : u)))
        setShowForm(false)
        toast.success('Utilisateur mis à jour.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur')
      } finally {
        setSaving(false)
      }
      return
    }

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
    if (!canEditUser(u) && !canScopedActivateTarget(u)) {
      toast.error('Vous ne pouvez pas activer ou désactiver ce compte.')
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
        actions={(u) => (
          <>
            <Link
              href={`/utilisateurs/${u.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:border-[#F28C38] hover:text-[#F28C38] transition-colors"
            >
              Fiche
            </Link>
            {(canEditUser(u) || canScopedEditTarget(u)) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openEdit(u)
                }}
                className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:border-[#F28C38] hover:text-[#F28C38] transition-colors"
              >
                Modifier
              </button>
            )}
            {(canEditUser(u) || canScopedActivateTarget(u)) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleActive(u)
                }}
                className={`text-xs border px-2.5 py-1 rounded-lg transition-colors ${u.isActive ? 'border-red-100 text-red-500 hover:bg-red-50' : 'border-green-100 text-green-600 hover:bg-green-50'}`}
              >
                {u.isActive ? 'Désactiver' : 'Activer'}
              </button>
            )}
          </>
        )}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Modifier — ${editing.username}` : 'Nouvel utilisateur'}
        subtitle={
          editing
            ? scopedEdit
              ? scopedAdminFieldsAllowed
                ? 'Identité, mot de passe et planning de votre périmètre'
                : 'Planning de votre périmètre'
              : 'Mise à jour du compte'
            : 'Créer un nouveau compte sur le portail'
        }
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

          {/* Employé CONGE existant — uniquement à la création, si l'intégration est active et
              qu'il reste des employés CONGE sans compte Intranet correspondant */}
          {!editing && congeConfigured && congeEmployees.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Employé CONGE existant{' '}
                <span className="text-gray-300 normal-case font-normal">
                  (optionnel — pré-remplit l&apos;identité)
                </span>
              </label>
              <select
                value={selectedCongeMatricule}
                onChange={(e) => selectCongeEmployee(e.target.value)}
                className={SELECT}
              >
                <option value="">— Saisie manuelle —</option>
                {congeEmployees
                  .slice()
                  .sort((a, b) =>
                    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
                  )
                  .map((emp) => (
                    <option key={emp.matricule} value={emp.matricule}>
                      {emp.lastName} {emp.firstName} — {emp.matricule}
                      {emp.departmentName ? ` (${emp.departmentName})` : ''}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-gray-400">
                Employés de la plateforme de congés n&apos;ayant pas encore de compte ici. En
                choisir un garantit que c&apos;est le même employé (identifiant = matricule CONGE).
              </p>
            </div>
          )}

          {/* Identité — masquée pour un responsable de pôle en édition scopée (planning uniquement) */}
          {(!scopedEdit || scopedAdminFieldsAllowed) && (
            <div className="space-y-3">
              <SectionHeader icon={UserIcon} title="Identité" />
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
          )}

          {/* Compte — masqué pour un responsable de pôle en édition scopée (planning uniquement) */}
          {(!scopedEdit || scopedAdminFieldsAllowed) && (
            <div className="space-y-3">
              <SectionHeader icon={KeyRound} title="Compte" />
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
          )}

          {/* Rôle & Organisation — jamais modifiable en édition scopée (DAF/RESPONSABLE_BU/RESPONSABLE_POLE) */}
          {!scopedEdit && (
            <div className="space-y-3">
              <SectionHeader icon={Building2} title="Rôle & Organisation" />

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
          )}

          {/* Horaires */}
          <div className="space-y-3">
            <SectionHeader icon={Clock} title="Horaires" />
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
            <SectionHeader icon={CalendarDays} title="Jours de travail récurrents" />
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
