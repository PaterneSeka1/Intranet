'use client'

import { useState } from 'react'

// ---------------------------------------------------------------------------
// Vue lecture seule de l'organigramme (PDG) — organisation, groupes horaires
// et jours fériés, sans aucun contrôle de création/modification/suppression.
// La gestion complète (branding, mutations) reste réservée au CTO_ADMIN via
// `ParametresClient`.
// ---------------------------------------------------------------------------

type Bu = {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  _count: { users: number; poles: number }
}

type Pole = {
  id: string
  name: string
  code: string
  businessUnitId: string
  isActive: boolean
  businessUnit: { id: string; name: string; code: string } | null
  _count: { users: number }
}

type ScheduleGroup = {
  id: string
  name: string
  code: string
  description: string | null
  expectedArrivalTime: string
  expectedDepartureTime: string | null
  businessUnitId: string | null
  poleId: string | null
  isNightShift: boolean
  isActive: boolean
  businessUnit: { id: string; name: string; code: string } | null
  pole: { id: string; name: string; code: string } | null
  _count: { users: number }
}

type Holiday = { id: string; date: string; label: string; isRecurring: boolean }

interface Props {
  buList: Bu[]
  poleList: Pole[]
  groups: ScheduleGroup[]
  holidays: Holiday[]
}

const TABS = [
  { key: 'org', label: 'Organisation' },
  { key: 'groups', label: 'Groupes horaires' },
  { key: 'holidays', label: 'Jours fériés' },
] as const

type TabKey = (typeof TABS)[number]['key']

const CARD = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm'
const BADGE_ACTIVE = 'text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700'
const BADGE_INACTIVE = 'text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500'

export function ParametresReadOnly({ buList, poleList, groups, holidays }: Props) {
  const [tab, setTab] = useState<TabKey>('org')

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Organisation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Consultation en lecture seule. La gestion (création, modification, branding) reste
          réservée au CTO.
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-[#F28C38] text-[#F28C38]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'org' && (
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Business Units ({buList.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {buList.map((bu) => (
                <div key={bu.id} className={CARD}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{bu.name}</p>
                      <p className="text-xs text-gray-400">{bu.code}</p>
                    </div>
                    <span className={bu.isActive ? BADGE_ACTIVE : BADGE_INACTIVE}>
                      {bu.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {bu.description && <p className="text-sm text-gray-500 mt-2">{bu.description}</p>}
                  <p className="text-xs text-gray-400 mt-3">
                    {bu._count.users} utilisateur(s) · {bu._count.poles} pôle(s)
                  </p>
                </div>
              ))}
              {buList.length === 0 && (
                <p className="text-sm text-gray-400 italic">Aucune Business Unit.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Pôles ({poleList.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {poleList.map((pole) => (
                <div key={pole.id} className={CARD}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{pole.name}</p>
                      <p className="text-xs text-gray-400">
                        {pole.code} · {pole.businessUnit?.name ?? '—'}
                      </p>
                    </div>
                    <span className={pole.isActive ? BADGE_ACTIVE : BADGE_INACTIVE}>
                      {pole.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">{pole._count.users} utilisateur(s)</p>
                </div>
              ))}
              {poleList.length === 0 && <p className="text-sm text-gray-400 italic">Aucun pôle.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'groups' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className={CARD}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-400">{g.code}</p>
                </div>
                <span className={g.isActive ? BADGE_ACTIVE : BADGE_INACTIVE}>
                  {g.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {g.expectedArrivalTime}
                {g.expectedDepartureTime ? ` → ${g.expectedDepartureTime}` : ''}
                {g.isNightShift ? ' · Équipe de nuit' : ''}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {g.businessUnit?.name ?? g.pole?.name ?? 'Global'} · {g._count.users} utilisateur(s)
              </p>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-gray-400 italic">Aucun groupe horaire.</p>
          )}
        </div>
      )}

      {tab === 'holidays' && (
        <div className={CARD}>
          <ul className="divide-y divide-gray-100">
            {holidays
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-700">{h.label}</span>
                  <span className="text-gray-400">
                    {h.date}
                    {h.isRecurring ? ' · récurrent' : ''}
                  </span>
                </li>
              ))}
            {holidays.length === 0 && (
              <li className="py-2 text-sm text-gray-400 italic">Aucun jour férié configuré.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
