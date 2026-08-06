'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { presenceApi } from '@/lib/presence'
import type { DailyMandate, PresenceRow, ScheduleGroup } from '@/lib/presence'

type UserOption = PresenceRow['user']

interface Props {
  users: UserOption[]
  scheduleGroups: ScheduleGroup[]
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

const INPUT =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Index du jour de semaine, Lundi=0 … Dimanche=6 (convention FR, contrairement à getUTCDay()). */
function mondayIndex(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month, day)).getUTCDay() // 0=Dim..6=Sam
  return (jsDay + 6) % 7
}

type Cell = { iso: string; day: number; weekdayIdx: number } | null

function buildMonthCells(year: number, month: number): Cell[] {
  const total = daysInMonth(year, month)
  const leading = mondayIndex(year, month, 1)
  const cells: Cell[] = Array.from({ length: leading }, () => null)
  for (let day = 1; day <= total; day++) {
    cells.push({ iso: isoDate(year, month, day), day, weekdayIdx: mondayIndex(year, month, day) })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const EMPTY_DRAFT = {
  expectedArrivalTime: '',
  expectedDepartureTime: '',
  isNightShift: false,
  reason: '',
}

/**
 * Calendrier mensuel par employé : peindre des créneaux (jour/nuit/week-end) sur plusieurs jours
 * à la fois, à partir de modèles (ScheduleGroup de la BU/Pôle) ou d'une saisie libre. Pensé pour
 * les rotations du Pôle TV/Radio, mais générique à tout employé mandatable par l'utilisateur.
 */
export function PlanningCalendar({ users, scheduleGroups }: Props) {
  const now = new Date()
  const [selectedBuId, setSelectedBuId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? '')
  const [year, setYear] = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth())

  // Liste des BU présentes dans le périmètre de l'utilisateur, pour filtrer le sélecteur employé
  // (utile dès que la liste dépasse une poignée de personnes, ex. CTO_ADMIN/PDG sur toute l'entreprise).
  const businessUnits = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of users) {
      if (u.businessUnit) map.set(u.businessUnit.id, u.businessUnit.name)
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'fr')
    )
  }, [users])

  const usersInSelectedBu = useMemo(
    () => (selectedBuId ? users.filter((u) => u.businessUnit?.id === selectedBuId) : users),
    [users, selectedBuId]
  )

  const [mandates, setMandates] = useState<DailyMandate[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [applying, setApplying] = useState(false)

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId]
  )

  const cells = useMemo(() => buildMonthCells(year, month), [year, month])

  // Jours "hors travail" par défaut pour l'employé sélectionné (motif récurrent déclaré à sa
  // fiche) — remplace l'ancienne hypothèse week-end fixe pour refléter un profil type Mar-Sam.
  const workingDaysSet = useMemo(
    () => new Set(selectedUser?.workingDays?.length ? selectedUser.workingDays : [1, 2, 3, 4, 5]),
    [selectedUser]
  )

  const mandateByDate = useMemo(() => {
    const map = new Map<string, DailyMandate>()
    for (const m of mandates) map.set(m.date.slice(0, 10), m)
    return map
  }, [mandates])

  const loadMandates = useCallback(async () => {
    if (!selectedUserId) {
      setMandates([])
      return
    }
    setLoading(true)
    try {
      const from = isoDate(year, month, 1)
      const to = isoDate(year, month, daysInMonth(year, month))
      const data = await presenceApi.mandatesRange({ userId: selectedUserId, from, to })
      setMandates(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du chargement du planning.')
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, year, month])

  useEffect(() => {
    loadMandates()
    setSelectedDates(new Set())
  }, [loadMandates])

  function handleBuChange(buId: string) {
    setSelectedBuId(buId)
    // Si l'employé sélectionné n'appartient pas à la BU choisie, on force une nouvelle sélection
    // plutôt que de garder un employé caché du filtre en cours.
    const stillValid =
      !buId || users.some((u) => u.id === selectedUserId && u.businessUnit?.id === buId)
    if (!stillValid) setSelectedUserId('')
  }

  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) {
      m = 11
      y -= 1
    } else if (m > 11) {
      m = 0
      y += 1
    }
    setMonth(m)
    setYear(y)
  }

  function toggleDate(iso: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  function selectWeekday(weekdayIdx: number) {
    const isos = cells
      .filter((c): c is NonNullable<Cell> => !!c && c.weekdayIdx === weekdayIdx)
      .map((c) => c.iso)
    setSelectedDates((prev) => {
      const next = new Set(prev)
      const allSelected = isos.every((iso) => next.has(iso))
      for (const iso of isos) {
        if (allSelected) next.delete(iso)
        else next.add(iso)
      }
      return next
    })
  }

  function applyTemplate(group: ScheduleGroup) {
    setDraft((prev) => ({
      expectedArrivalTime: group.expectedArrivalTime,
      expectedDepartureTime: group.expectedDepartureTime ?? '',
      isNightShift: group.isNightShift,
      reason: prev.reason,
    }))
  }

  async function handleApply() {
    if (!selectedUserId || selectedDates.size === 0 || !draft.expectedArrivalTime) return
    setApplying(true)
    try {
      const days = Array.from(selectedDates).map((date) => ({
        date,
        expectedArrivalTime: draft.expectedArrivalTime,
        expectedDepartureTime: draft.expectedDepartureTime || undefined,
        isNightShift: draft.isNightShift || undefined,
        reason: draft.reason || undefined,
      }))
      await presenceApi.bulkCreateMandates({ userId: selectedUserId, days })
      toast.success(`${days.length} jour(s) planifié(s).`)
      setSelectedDates(new Set())
      await loadMandates()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.")
    } finally {
      setApplying(false)
    }
  }

  async function handleClearDay(mandate: DailyMandate) {
    const ok = await confirm({
      title: 'Supprimer ce jour planifié',
      message: `Supprimer le créneau du ${mandate.date.slice(0, 10)} ?`,
      confirmLabel: 'Supprimer',
      destructive: true,
    })
    if (!ok) return
    try {
      await presenceApi.deleteMandate(mandate.id)
      toast.success('Jour supprimé du planning.')
      await loadMandates()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  const relevantGroups = useMemo(() => {
    return scheduleGroups.filter(
      (g) =>
        (!g.businessUnit && !g.pole) ||
        (!!g.businessUnit && g.businessUnit.id === selectedUser?.businessUnit?.id) ||
        (!!g.pole && g.pole.id === selectedUser?.pole?.id)
    )
  }, [scheduleGroups, selectedUser])

  const defaultArrival =
    selectedUser?.scheduleGroup?.expectedArrivalTime ??
    selectedUser?.individualExpectedArrivalTime ??
    null

  if (users.length === 0) {
    return (
      <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-6 text-sm text-gray-400">
        Aucun employé dans votre périmètre.
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      {/* Colonne calendrier */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            {businessUnits.length > 1 && (
              <div>
                <label
                  htmlFor="planning-bu"
                  className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
                >
                  Filtrer par BU
                </label>
                <select
                  id="planning-bu"
                  value={selectedBuId}
                  onChange={(e) => handleBuChange(e.target.value)}
                  className={INPUT + ' bg-white min-w-[160px]'}
                >
                  <option value="">Toutes les BU</option>
                  {businessUnits.map((bu) => (
                    <option key={bu.id} value={bu.id}>
                      {bu.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label
                htmlFor="planning-user"
                className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
              >
                Employé
              </label>
              <select
                id="planning-user"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={INPUT + ' bg-white min-w-[220px]'}
              >
                <option value="">Sélectionner un employé…</option>
                {usersInSelectedBu.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName ?? u.username}
                    {u.businessUnit ? ` — ${u.businessUnit.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
              aria-label="Mois précédent"
            >
              ‹
            </button>
            <span className="text-sm font-bold text-gray-700 w-36 text-center">
              {MONTH_LABELS[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
              aria-label="Mois suivant"
            >
              ›
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => selectWeekday(5)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:border-[#F28C38] hover:text-[#F28C38] text-gray-600 transition-colors"
          >
            Tous les samedis
          </button>
          <button
            type="button"
            onClick={() => selectWeekday(6)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:border-[#F28C38] hover:text-[#F28C38] text-gray-600 transition-colors"
          >
            Tous les dimanches
          </button>
          {selectedDates.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDates(new Set())}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors"
            >
              Effacer la sélection ({selectedDates.size})
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAYS.map((wd, idx) => (
            <button
              key={wd}
              type="button"
              onClick={() => selectWeekday(idx)}
              title={`Sélectionner tous les ${wd}`}
              className="text-[11px] font-bold text-gray-400 uppercase pb-1 hover:text-[#F28C38] transition-colors"
            >
              {wd}
            </button>
          ))}
          {cells.map((cell, idx) => {
            if (!cell) return <div key={`pad-${idx}`} />
            const mandate = mandateByDate.get(cell.iso)
            const selected = selectedDates.has(cell.iso)
            // weekdayIdx : Lun=0…Dim=6 (convention FR) → conversion vers Date.getUTCDay() (Dim=0…Sam=6)
            const isOffDay = !workingDaysSet.has((cell.weekdayIdx + 1) % 7)

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => toggleDate(cell.iso)}
                className={[
                  'relative rounded-xl border p-2 text-left min-h-[64px] transition-colors',
                  selected
                    ? 'border-[#F28C38] bg-[#F28C38]/10 ring-2 ring-[#F28C38]/30'
                    : mandate
                      ? 'border-indigo-100 bg-indigo-50/60 hover:border-indigo-200'
                      : isOffDay
                        ? 'border-gray-100 bg-gray-50/60 hover:border-gray-200'
                        : 'border-gray-100 hover:border-gray-200',
                ].join(' ')}
              >
                <div className="text-xs font-bold text-gray-500">{cell.day}</div>
                {mandate ? (
                  <div className="mt-1 text-[11px] font-mono text-indigo-700 leading-tight">
                    {mandate.expectedArrivalTime}
                    {mandate.expectedDepartureTime ? `–${mandate.expectedDepartureTime}` : ''}
                    {mandate.isNightShift && (
                      <div className="text-[9px] font-bold text-indigo-400">NUIT</div>
                    )}
                  </div>
                ) : defaultArrival ? (
                  <div className="mt-1 text-[11px] font-mono text-gray-300 leading-tight">
                    {defaultArrival}
                  </div>
                ) : null}
                {mandate && (
                  <span
                    role="button"
                    aria-label="Supprimer ce jour"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClearDay(mandate)
                    }}
                    className="absolute top-1 right-1 text-gray-300 hover:text-red-500 text-xs leading-none"
                  >
                    ×
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {loading && <p className="text-xs text-gray-400 mt-3">Chargement du planning…</p>}
      </div>

      {/* Panneau modèles + application */}
      <div className="bg-gray-50/60 border border-gray-100 rounded-2xl p-4 space-y-4 self-start">
        <div>
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
            Modèles de créneaux
          </h3>
          {relevantGroups.length === 0 ? (
            <p className="text-xs text-gray-400">
              Aucun groupe horaire disponible pour cet employé.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {relevantGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => applyTemplate(g)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-[#F28C38] hover:text-[#F28C38] text-gray-600 transition-colors"
                >
                  {g.name} ({g.expectedArrivalTime}
                  {g.expectedDepartureTime ? `–${g.expectedDepartureTime}` : ''})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="planning-arrival"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Heure d&apos;arrivée *
            </label>
            <input
              id="planning-arrival"
              type="time"
              value={draft.expectedArrivalTime}
              onChange={(e) => setDraft({ ...draft, expectedArrivalTime: e.target.value })}
              className={INPUT + ' bg-white'}
            />
          </div>
          <div>
            <label
              htmlFor="planning-departure"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Heure de départ{' '}
              <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
            </label>
            <input
              id="planning-departure"
              type="time"
              value={draft.expectedDepartureTime}
              onChange={(e) => setDraft({ ...draft, expectedDepartureTime: e.target.value })}
              className={INPUT + ' bg-white'}
            />
          </div>
          <label
            htmlFor="planning-night"
            className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none"
          >
            <input
              id="planning-night"
              type="checkbox"
              checked={draft.isNightShift}
              onChange={(e) => setDraft({ ...draft, isNightShift: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-[#F28C38] focus:ring-[#F28C38]/20"
            />
            Équipe de nuit
          </label>
          <div>
            <label
              htmlFor="planning-reason"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Motif <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
            </label>
            <input
              id="planning-reason"
              type="text"
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              className={INPUT + ' bg-white'}
              placeholder="Ex : Rotation nuit, astreinte week-end…"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleApply}
          disabled={
            !selectedUserId || selectedDates.size === 0 || !draft.expectedArrivalTime || applying
          }
          className="w-full bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40 transition-colors"
        >
          {applying
            ? 'Application…'
            : `Appliquer à ${selectedDates.size} jour${selectedDates.size > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
