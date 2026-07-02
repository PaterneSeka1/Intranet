'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { DataTable, type Column } from '@/components/ui/DataTable'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type Mandate = {
  id: string
  date: string
  expectedArrivalTime: string
  reason: string | null
  createdAt: string
  user: { id: string; username: string; fullName: string | null; role: string; businessUnit: { name: string } | null }
  createdBy: { id: string; username: string; fullName: string | null }
}

interface Props {
  initialMandates: Mandate[]
  canMandate: boolean
  currentUserId: string
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

export function MandatesManager({ initialMandates, canMandate, currentUserId }: Props) {
  const [mandates, setMandates] = useState<Mandate[]>(initialMandates)
  const [deleting, setDeleting] = useState<string | null>(null)

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
      const res = await fetch(`${API}/api/presence/mandates/${m.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message ?? 'Erreur')
      }
      setMandates(prev => prev.filter(x => x.id !== m.id))
      toast.success('Mandat supprimé.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    } finally {
      setDeleting(null)
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
  )
}
