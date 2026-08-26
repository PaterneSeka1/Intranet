'use client'

import { MapPin } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'

export type ConnectionLog = {
  id: string
  type: 'LOGIN' | 'LOGOUT'
  date: string
  connectedAt: string
  disconnectedAt: string | null
  address: string | null
  mapsUrl: string | null
  ipAddress: string | null
  isFirstConnectionOfDay: boolean
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

const columns: Column<ConnectionLog>[] = [
  {
    key: 'date',
    label: 'Date',
    sortable: true,
    sortValue: (l) => l.date,
    render: (l) => (
      <span className="font-medium text-gray-700 whitespace-nowrap">{fmtDate(l.date)}</span>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    sortable: true,
    sortValue: (l) => l.type,
    render: (l) => (
      <span
        className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
          l.type === 'LOGIN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {l.type === 'LOGIN' ? 'Connexion' : 'Déconnexion'}
      </span>
    ),
  },
  {
    key: 'connectedAt',
    label: 'Heure',
    sortable: true,
    sortValue: (l) => l.connectedAt,
    render: (l) => (
      <span className="font-mono text-sm text-gray-600 whitespace-nowrap">
        {fmtTime(l.type === 'LOGOUT' ? (l.disconnectedAt ?? l.connectedAt) : l.connectedAt)}
      </span>
    ),
  },
  {
    key: 'isFirstConnectionOfDay',
    label: '1ère connexion',
    sortable: true,
    sortValue: (l) => (l.isFirstConnectionOfDay ? 0 : 1),
    render: (l) =>
      l.isFirstConnectionOfDay ? (
        <span className="text-xs font-semibold text-[#F28C38]">Oui</span>
      ) : (
        <span className="text-xs text-gray-300">Non</span>
      ),
  },
  {
    key: 'address',
    label: 'Adresse GPS',
    render: (l) =>
      l.mapsUrl ? (
        <a
          href={l.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#F28C38] text-xs underline underline-offset-2 whitespace-nowrap inline-flex items-center gap-1"
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          {l.address ? l.address.slice(0, 28) + (l.address.length > 28 ? '…' : '') : 'Voir carte'}
        </a>
      ) : (
        <span className="text-gray-300 text-xs">—</span>
      ),
  },
  {
    key: 'ipAddress',
    label: 'IP',
    render: (l) => (
      <span className="font-mono text-xs text-gray-400 whitespace-nowrap">
        {l.ipAddress ?? '—'}
      </span>
    ),
  },
]

interface Props {
  logs: ConnectionLog[]
  showGeolocation?: boolean
}

export function MonHistoriqueClient({ logs, showGeolocation = true }: Props) {
  const loginCount = logs.filter((l) => l.type === 'LOGIN').length

  const filteredColumns = showGeolocation
    ? columns
    : columns.filter((c) => c.key !== 'address' && c.key !== 'ipAddress')

  return (
    <DataTable<ConnectionLog>
      data={logs}
      columns={filteredColumns}
      rowKey={(l) => l.id}
      defaultPageSize={25}
      searchable
      searchPlaceholder={
        showGeolocation ? 'Rechercher par date, type, IP…' : 'Rechercher par date, type…'
      }
      filterFn={(l, q) =>
        fmtDate(l.date).includes(q) ||
        (l.type === 'LOGIN' ? 'connexion' : 'déconnexion').includes(q) ||
        (l.ipAddress ?? '').toLowerCase().includes(q) ||
        (l.address ?? '').toLowerCase().includes(q)
      }
      emptyMessage="Aucun historique disponible."
      defaultSort={{ key: 'connectedAt', dir: 'desc' }}
      storageKey="mon-historique"
      header={
        <span className="text-sm text-gray-400">
          {loginCount} connexion{loginCount > 1 ? 's' : ''} enregistrée{loginCount > 1 ? 's' : ''}
          {' · '}
          <span className="text-gray-300">200 dernières entrées max</span>
        </span>
      }
    />
  )
}
