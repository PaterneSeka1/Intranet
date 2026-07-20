'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE_LABELS } from '@/types/user'
import { presenceApi, type PresenceRow } from '@/lib/presence'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/lib/toast'

const STATUS_BADGE: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  LATE: 'bg-orange-100 text-orange-700',
  ABSENT: 'bg-gray-100 text-gray-400',
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Présent',
  LATE: 'En retard',
  ABSENT: 'Absent',
}

const SOURCE_LABEL: Record<string, string> = {
  mandate: 'Mandat',
  group: 'Groupe',
  individual: 'Individuel',
  none: '—',
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getUTCHours().toString().padStart(2, '0')}h${d.getUTCMinutes().toString().padStart(2, '0')}`
}

interface MandateForm {
  userId: string
  userLabel: string
  date: string
  expectedArrivalTime: string
  reason: string
}

interface Props {
  rows: PresenceRow[]
  canMandate: boolean
  currentUserId: string
  date?: string
}

export function PresenceTable({ rows, canMandate, currentUserId, date }: Props) {
  const router = useRouter()
  const [mandateForm, setMandateForm] = useState<MandateForm | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mandateError, setMandateError] = useState('')

  function openMandate(row: PresenceRow) {
    const today = new Date()
    const dateStr = date ?? `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
    setMandateForm({
      userId: row.user.id,
      userLabel: row.user.fullName ?? row.user.username,
      date: dateStr,
      expectedArrivalTime: row.expectedArrivalTime ?? '08:00',
      reason: '',
    })
    setMandateError('')
  }

  async function submitMandate(e: React.FormEvent) {
    e.preventDefault()
    if (!mandateForm) return
    setSubmitting(true)
    setMandateError('')
    try {
      await presenceApi.createMandate({
        userId: mandateForm.userId,
        date: mandateForm.date,
        expectedArrivalTime: mandateForm.expectedArrivalTime,
        reason: mandateForm.reason || undefined,
      })
      setMandateForm(null)
      toast.success('Mandat créé avec succès.')
      router.refresh()
    } catch (err) {
      setMandateError(err instanceof Error ? err.message : 'Erreur lors de la création du mandat.')
    } finally {
      setSubmitting(false)
    }
  }

  // --------------------------------------------------------------------------
  // Columns
  // --------------------------------------------------------------------------

  const columns: Column<PresenceRow>[] = [
    {
      key: 'fullName',
      label: 'Employé',
      sortable: true,
      sortValue: r => r.user.fullName ?? r.user.username,
      render: r => (
        <span className="font-medium text-gray-800 flex items-center gap-1.5 whitespace-nowrap">
          {r.user.fullName ?? r.user.username}
          {r.user.id === currentUserId && (
            <span className="text-[10px] bg-[#F28C38] text-white px-1.5 py-0.5 rounded-full font-bold">Moi</span>
          )}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Rôle',
      sortable: true,
      sortValue: r => r.user.role,
      render: r => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {ROLE_LABELS[r.user.role as keyof typeof ROLE_LABELS] ?? r.user.role}
        </span>
      ),
    },
    {
      key: 'bu',
      label: 'BU',
      sortable: true,
      sortValue: r => r.user.businessUnit?.name ?? '',
      render: r => <span className="text-xs text-gray-500 whitespace-nowrap">{r.user.businessUnit?.name ?? '—'}</span>,
    },
    {
      key: 'pole',
      label: 'Pôle',
      sortable: true,
      sortValue: r => r.user.pole?.name ?? '',
      render: r => <span className="text-xs text-gray-500 whitespace-nowrap">{r.user.pole?.name ?? '—'}</span>,
    },
    {
      key: 'scheduleSource',
      label: 'Source',
      render: r => (
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 whitespace-nowrap">
          {SOURCE_LABEL[r.scheduleSource] ?? r.scheduleSource}
        </span>
      ),
    },
    {
      key: 'expectedArrivalTime',
      label: 'Heure attendue',
      sortable: true,
      sortValue: r => r.expectedArrivalTime ?? '',
      render: r => (
        <span className="font-mono text-sm text-gray-700 whitespace-nowrap">
          {r.expectedArrivalTime ?? '—'}
        </span>
      ),
    },
    {
      key: 'officialArrivalTime',
      label: 'Arrivée',
      sortable: true,
      sortValue: r => r.presence?.officialArrivalTime ?? '',
      render: r => (
        <span className="font-mono text-sm text-gray-700 whitespace-nowrap">
          {fmtTime(r.presence?.officialArrivalTime)}
        </span>
      ),
    },
    {
      key: 'delayMinutes',
      label: 'Écart',
      sortable: true,
      sortValue: r => r.presence?.delayMinutes ?? 0,
      render: r => r.presence?.delayMinutes ? (
        <span className="text-orange-600 font-semibold text-sm whitespace-nowrap">+{r.presence.delayMinutes} min</span>
      ) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      sortValue: r => STATUS_LABEL[r.status] ?? r.status,
      render: r => (
        <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[r.status]}`}>
          {STATUS_LABEL[r.status]}
        </span>
      ),
    },
    {
      key: 'location',
      label: 'Localisation',
      render: r => r.presence?.mapsUrl ? (
        <a
          href={r.presence.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-[#F28C38] text-xs underline underline-offset-2 whitespace-nowrap"
        >
          📍 Carte
        </a>
      ) : <span className="text-gray-200">—</span>,
    },
    {
      key: 'officialDepartureTime',
      label: 'Départ',
      sortable: true,
      sortValue: r => r.presence?.officialDepartureTime ?? '',
      render: r => (
        <span className="font-mono text-sm text-gray-700 whitespace-nowrap">
          {fmtTime(r.presence?.officialDepartureTime)}
        </span>
      ),
    },
    {
      key: 'departureDelayMinutes',
      label: 'Écart départ',
      sortable: true,
      sortValue: r => r.presence?.departureDelayMinutes ?? 0,
      render: r => {
        const d = r.presence?.departureDelayMinutes
        if (!r.presence?.officialDepartureTime) return <span className="text-gray-200">—</span>
        if (!d) return <span className="text-gray-400 text-sm">À l'heure</span>
        return (
          <span className={`font-semibold text-sm whitespace-nowrap ${d > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
            {d > 0 ? `+${d} min` : `${d} min`}
          </span>
        )
      },
    },
    {
      key: 'departureLocation',
      label: 'Localisation départ',
      render: r => r.presence?.departureMapsUrl ? (
        <a
          href={r.presence.departureMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-[#F28C38] text-xs underline underline-offset-2 whitespace-nowrap"
        >
          📍 Carte
        </a>
      ) : <span className="text-gray-200">—</span>,
    },
  ]

  return (
    <>
      <DataTable<PresenceRow>
        data={rows}
        columns={columns}
        rowKey={r => r.user.id}
        defaultPageSize={25}
        storageKey="presences"
        searchable
        searchPlaceholder="Rechercher un employé…"
        filterFn={(r, q) =>
          (r.user.fullName ?? '').toLowerCase().includes(q) ||
          r.user.username.toLowerCase().includes(q) ||
          (r.user.businessUnit?.name ?? '').toLowerCase().includes(q) ||
          STATUS_LABEL[r.status]?.toLowerCase().includes(q)
        }
        emptyMessage="Aucun utilisateur dans votre périmètre."
        defaultSort={{ key: 'status', dir: 'asc' }}
        actions={canMandate ? r => (
          <button
            onClick={e => { e.stopPropagation(); openMandate(r) }}
            className="text-xs text-gray-500 hover:text-[#F28C38] border border-gray-200 hover:border-[#F28C38] px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
          >
            Mandater
          </button>
        ) : undefined}
      />

      {/* Modale mandat */}
      {mandateForm && (
        <Modal
          open
          onClose={() => setMandateForm(null)}
          title="Créer un mandat exceptionnel"
          subtitle={`Pour ${mandateForm.userLabel}`}
          size="md"
        >
          <form onSubmit={submitMandate} className="space-y-4">
            <div>
              <label htmlFor="mandate-date" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Date</label>
              <input
                id="mandate-date"
                type="date"
                value={mandateForm.date}
                onChange={e => setMandateForm({ ...mandateForm, date: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                required
              />
            </div>
            <div>
              <label htmlFor="mandate-time" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Nouvelle heure attendue
              </label>
              <input
                id="mandate-time"
                type="time"
                value={mandateForm.expectedArrivalTime}
                onChange={e => setMandateForm({ ...mandateForm, expectedArrivalTime: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                required
              />
            </div>
            <div>
              <label htmlFor="mandate-reason" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Motif <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
              </label>
              <input
                id="mandate-reason"
                type="text"
                value={mandateForm.reason}
                onChange={e => setMandateForm({ ...mandateForm, reason: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300"
                placeholder="Ex : Réunion externe, déplacement…"
              />
            </div>

            {mandateError && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
                {mandateError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setMandateForm(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
