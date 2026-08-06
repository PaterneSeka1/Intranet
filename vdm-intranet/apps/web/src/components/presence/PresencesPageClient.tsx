'use client'

import { useRouter } from 'next/navigation'
import { PresenceTable } from '@/components/presence/PresenceTable'
import { MandatesManager } from '@/components/presence/MandatesManager'
import type { PresenceRow } from '@/lib/presence'
import type { Mandate } from '@/components/presence/MandatesManager'
import { findHolidayForDate, type PublicHoliday } from '@/lib/public-holidays'

interface Props {
  rows: PresenceRow[]
  mandates: Mandate[]
  date: string
  canMandate: boolean
  currentUserId: string
  currentUserRole: string
  holidays: PublicHoliday[]
}

function fmtDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-')
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  return dt.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function todayIso(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  return [0, 6].includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function PresencesPageClient({
  rows,
  mandates,
  date,
  canMandate,
  currentUserId,
  currentUserRole,
  holidays,
}: Props) {
  const router = useRouter()
  const today = todayIso()
  const isToday = date === today
  const holiday = findHolidayForDate(date, holidays)

  const present = rows.filter((r) => r.status === 'PRESENT').length
  const late = rows.filter((r) => r.status === 'LATE').length
  const onLeave = rows.filter((r) => r.status === 'EN_CONGE').length
  const absent = rows.filter((r) => r.status === 'ABSENT').length
  // Statuts calculés côté API, jamais comptés comme absences : REPOS = pas le jour de travail
  // (week-end/férié sans mandat, ou aucun planning défini), EN_ATTENTE = heure attendue pas
  // encore dépassée.
  const dayOff = rows.filter((r) => r.status === 'REPOS').length
  const pending = rows.filter((r) => r.status === 'EN_ATTENTE').length

  function navigate(newDate: string) {
    router.push(`/presences?date=${newDate}`)
  }

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Présences</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{fmtDateLabel(date)}</p>
        </div>

        {/* Navigation par date */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(shiftDate(date, -1))}
            className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#F28C38] hover:text-[#F28C38] transition-colors text-sm"
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => navigate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
          />
          <button
            onClick={() => navigate(shiftDate(date, 1))}
            disabled={isToday}
            className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#F28C38] hover:text-[#F28C38] transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ›
          </button>
          {!isToday && (
            <button
              onClick={() => navigate(today)}
              className="text-xs text-[#F28C38] hover:underline font-medium"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      {/* Bannière jour férié */}
      {holiday && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 text-sm text-orange-700 mb-4">
          Jour férié — {holiday.label}
        </div>
      )}

      {/* Bannière week-end : informatif seulement — les employés au repos apparaissent désormais
          avec leur propre statut "Repos" dans le tableau, ceux mandatés ce jour-là restent suivis
          normalement (retard/absence réels possibles). */}
      {isWeekend(date) && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm text-blue-600 mb-4">
          Week-end — seuls les employés mandatés ce jour sont suivis, les autres sont au repos.
        </div>
      )}

      {/* Compteurs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{present}</div>
          <div className="text-xs text-green-600 font-semibold mt-0.5">Présents</div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{late}</div>
          <div className="text-xs text-orange-600 font-semibold mt-0.5">En retard</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{onLeave}</div>
          <div className="text-xs text-blue-600 font-semibold mt-0.5">En congé</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{pending}</div>
          <div className="text-xs text-amber-600 font-semibold mt-0.5">En attente</div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-indigo-500">{dayOff}</div>
          <div className="text-xs text-indigo-500 font-semibold mt-0.5">Repos</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-500">{absent}</div>
          <div className="text-xs text-gray-400 font-semibold mt-0.5">Absents</div>
        </div>
      </div>

      {/* Tableau présences */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Tableau de présences</h2>
        <PresenceTable
          rows={rows}
          canMandate={canMandate}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          date={date}
        />
      </div>

      {/* Mandats */}
      {canMandate && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">Mandats exceptionnels</h2>
            <span className="text-xs text-gray-400">
              {mandates.length} mandat{mandates.length > 1 ? 's' : ''} ce jour
            </span>
          </div>
          <MandatesManager
            initialMandates={mandates}
            canMandate={canMandate}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            users={rows.map((r) => r.user)}
          />
        </div>
      )}
    </div>
  )
}
