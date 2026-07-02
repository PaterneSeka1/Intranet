'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { presenceApi } from '@/lib/presence'

export type Mandate = {
  id: string
  date: string
  expectedArrivalTime: string
  reason: string | null
  createdAt: string
  user: { id: string; username: string; fullName: string | null; role: string; businessUnit: { name: string } | null }
  createdBy: { id: string; username: string; fullName: string | null }
}

type UserOption = {
  id: string
  fullName: string | null
  username: string
  businessUnit: { name: string } | null
}

interface Props {
  initialMandates: Mandate[]
  canMandate: boolean
  currentUserId: string
  users?: UserOption[]
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

const INPUT = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]'

const EMPTY_FORM = { userId: '', date: '', expectedArrivalTime: '', reason: '' }

export function MandatesManager({ initialMandates, canMandate, currentUserId, users = [] }: Props) {
  const [mandates, setMandates] = useState<Mandate[]>(initialMandates)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function handleDelete(m: Mandate) {
    const ok = await confirm({
      title: 'Supprimer le mandat',
      message: `Supprimer le mandat de ${m.user.fullName ?? m.user.username} du ${fmtDate(m.date)} ?`,
      confirmLabel: 'Supprimer',
      destructive: true,
    })
    if (!ok) return
    setDeleting(m.id)
    try {
      await presenceApi.deleteMandate(m.id)
      setMandates(prev => prev.filter(x => x.id !== m.id))
      toast.success('Mandat supprimé.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.userId || !form.date || !form.expectedArrivalTime) {
      setFormError('Employé, date et heure sont obligatoires.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const created = await presenceApi.createMandate({
        userId: form.userId,
        date: form.date,
        expectedArrivalTime: form.expectedArrivalTime,
        reason: form.reason || undefined,
      })
      setMandates(prev => [created as unknown as Mandate, ...prev])
      setShowForm(false)
      setForm(EMPTY_FORM)
      toast.success('Mandat créé.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création.')
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<Mandate>[] = [
    {
      key: 'user',
      label: 'Employé',
      sortable: true,
      sortValue: m => m.user.fullName ?? m.user.username,
      render: m => (
        <span className="font-medium text-gray-800">
          {m.user.fullName ?? m.user.username}
          {m.user.id === currentUserId && (
            <span className="ml-1.5 text-[10px] bg-[#F28C38] text-white px-1.5 py-0.5 rounded-full font-bold">Moi</span>
          )}
        </span>
      ),
    },
    {
      key: 'bu',
      label: 'BU',
      sortable: true,
      sortValue: m => m.user.businessUnit?.name ?? '',
      render: m => <span className="text-xs text-gray-500">{m.user.businessUnit?.name ?? '—'}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      sortValue: m => m.date,
      render: m => <span className="font-mono text-sm text-gray-700">{fmtDate(m.date)}</span>,
    },
    {
      key: 'expectedArrivalTime',
      label: 'Heure mandatée',
      sortable: true,
      sortValue: m => m.expectedArrivalTime,
      render: m => <span className="font-mono text-sm text-gray-700">{m.expectedArrivalTime}</span>,
    },
    {
      key: 'reason',
      label: 'Motif',
      render: m => <span className="text-xs text-gray-500">{m.reason ?? '—'}</span>,
    },
    {
      key: 'createdBy',
      label: 'Créé par',
      sortable: true,
      sortValue: m => m.createdBy.fullName ?? m.createdBy.username,
      render: m => <span className="text-xs text-gray-500">{m.createdBy.fullName ?? m.createdBy.username}</span>,
    },
    {
      key: 'createdAt',
      label: 'Créé le',
      sortable: true,
      sortValue: m => m.createdAt,
      render: m => <span className="text-xs text-gray-400">{fmtDate(m.createdAt)}</span>,
    },
  ]

  return (
    <>
      {canMandate && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setFormError('') }}
            className="bg-[#F28C38] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e07d29] transition-colors"
          >
            + Nouveau mandat
          </button>
        </div>
      )}

      <DataTable<Mandate>
        data={mandates}
        columns={columns}
        rowKey={m => m.id}
        defaultPageSize={25}
        storageKey="mandates"
        searchable
        searchPlaceholder="Rechercher un employé, motif…"
        filterFn={(m, q) =>
          (m.user.fullName ?? '').toLowerCase().includes(q) ||
          m.user.username.toLowerCase().includes(q) ||
          (m.reason ?? '').toLowerCase().includes(q) ||
          (m.user.businessUnit?.name ?? '').toLowerCase().includes(q)
        }
        emptyMessage="Aucun mandat trouvé."
        defaultSort={{ key: 'date', dir: 'desc' }}
        actions={canMandate ? m => (
          <button
            onClick={e => { e.stopPropagation(); handleDelete(m) }}
            disabled={deleting === m.id}
            className="text-xs border border-red-100 text-red-500 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting === m.id ? '…' : 'Supprimer'}
          </button>
        ) : undefined}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nouveau mandat exceptionnel"
        subtitle="Définir une heure d'arrivée dérogatoire pour un employé"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="mandate-user" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Employé *
            </label>
            <select
              id="mandate-user"
              value={form.userId}
              onChange={e => setForm({ ...form, userId: e.target.value })}
              required
              className={INPUT + ' bg-white'}
            >
              <option value="">Sélectionner un employé…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName ?? u.username}{u.businessUnit ? ` — ${u.businessUnit.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="mandate-create-date" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Date *
              </label>
              <input
                id="mandate-create-date"
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                required
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="mandate-create-time" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Heure attendue *
              </label>
              <input
                id="mandate-create-time"
                type="time"
                value={form.expectedArrivalTime}
                onChange={e => setForm({ ...form, expectedArrivalTime: e.target.value })}
                required
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label htmlFor="mandate-create-reason" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Motif <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
            </label>
            <input
              id="mandate-create-reason"
              type="text"
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              className={INPUT}
              placeholder="Ex : Réunion externe, déplacement…"
            />
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
            >
              {saving ? 'Création…' : 'Créer le mandat'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
