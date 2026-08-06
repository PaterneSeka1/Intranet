import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import type { TodayPresenceResult } from '@/lib/presence'
import type { Tab } from '@/lib/tabs'
import { EndDayButton } from '@/components/presence/EndDayButton'
import { ACCUEIL_ONLY_ROLES, ROLE_LABELS } from '@/types/user'

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  LATE: 'bg-orange-100 text-orange-700',
  ABSENT: 'bg-gray-100 text-gray-500',
  EN_CONGE: 'bg-blue-100 text-blue-700',
  REPOS: 'bg-indigo-100 text-indigo-500',
  EN_ATTENTE: 'bg-amber-100 text-amber-600',
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Présent',
  LATE: 'En retard',
  ABSENT: 'Non enregistré',
  EN_CONGE: 'En congé',
  REPOS: 'Repos',
  EN_ATTENTE: 'En attente',
}

const DEFAULT_STATUS_STYLE = 'bg-gray-100 text-gray-500'

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getUTCHours().toString().padStart(2, '0')}h${d.getUTCMinutes().toString().padStart(2, '0')}`
}

function formatDate(): string {
  const d = new Date()
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatDepartureDelay(minutes: number | null | undefined): string {
  if (!minutes) return "À l'heure"
  return minutes > 0 ? `+${minutes} min (plus tard)` : `${minutes} min (plus tôt)`
}

function greeting(): string {
  const hour = new Date().getUTCHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function StatBlock({
  label,
  value,
  accent,
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold ${accent ? 'text-[#F28C38]' : 'text-gray-800'}`}>
        {value}
      </div>
    </div>
  )
}

export default async function AccueilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const showGeolocation = !ACCUEIL_ONLY_ROLES.includes(user.role)

  const [presenceData, allTabs] = await Promise.all([
    serverFetch<TodayPresenceResult>('/presence/today'),
    serverFetch<Tab[]>(
      user.businessUnit ? `/tabs?businessUnitId=${user.businessUnit.id}` : '/tabs'
    ),
  ])

  const presence = presenceData?.presence ?? null
  // Le statut (y compris "pas encore arrivé"/"repos") est calculé côté API, qui seule connaît le
  // planning (mandat/groupe/individuel) et les jours non travaillés (week-end/férié) — ne jamais
  // retomber sur "ABSENT" par défaut ici, sous peine de re-marquer absent avant l'heure attendue.
  const status = presenceData?.status ?? 'ABSENT'
  const activeTabs = (allTabs ?? []).filter((t) => t.isActive)
  const displayName = user.firstName || user.fullName || user.username

  return (
    <div className="p-6 space-y-6">
      {/* Hero de bienvenue */}
      <div className="relative overflow-hidden rounded-2xl bg-[#1B293C] px-6 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#F28C38]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-[#F28C38]/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F28C38] mb-2">
              {ROLE_LABELS[user.role]}
              {user.businessUnit ? ` · ${user.businessUnit.name}` : ''}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              {greeting()}, {displayName} 👋
            </h1>
            <p className="text-sm text-white/60 mt-1.5 capitalize">{formatDate()}</p>
          </div>
        </div>
      </div>

      {/* Carte présence — uniquement les données du jour */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#F28C38]/10 flex items-center justify-center text-base">
              🕒
            </span>
            Ma journée
          </h2>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLE[status] ?? DEFAULT_STATUS_STYLE}`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        <div
          className={`grid grid-cols-2 ${showGeolocation ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-5`}
        >
          <StatBlock
            label="Heure attendue"
            value={
              presence?.expectedArrivalTime && presence.expectedArrivalTime !== '--:--'
                ? presence.expectedArrivalTime
                : (presenceData?.scheduleSource?.time ?? '—')
            }
          />
          <StatBlock label="Arrivée officielle" value={formatTime(presence?.officialArrivalTime)} />
          <StatBlock
            label="Retard"
            value={presence?.delayMinutes ? `+${presence.delayMinutes} min` : '—'}
            accent={!!presence?.delayMinutes}
          />
          {showGeolocation && (
            <StatBlock
              label="Localisation"
              value={
                presence?.mapsUrl ? (
                  <a
                    href={presence.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F28C38] underline underline-offset-2"
                  >
                    Voir carte
                  </a>
                ) : (
                  '—'
                )
              }
            />
          )}
        </div>

        {showGeolocation && presence?.address && (
          <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
            📍 {presence.address}
          </div>
        )}

        {/* Départ */}
        {presence && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div
              className={`grid grid-cols-2 ${showGeolocation ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-5`}
            >
              <StatBlock label="Départ attendu" value={presence.expectedDepartureTime ?? '—'} />
              <StatBlock
                label="Départ officiel"
                value={formatTime(presence.officialDepartureTime)}
              />
              <StatBlock
                label="Écart"
                value={
                  presence.officialDepartureTime
                    ? formatDepartureDelay(presence.departureDelayMinutes)
                    : '—'
                }
                accent={!!presence.departureDelayMinutes}
              />
              {showGeolocation && (
                <StatBlock
                  label="Localisation"
                  value={
                    presence.departureMapsUrl ? (
                      <a
                        href={presence.departureMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#F28C38] underline underline-offset-2"
                      >
                        Voir carte
                      </a>
                    ) : (
                      '—'
                    )
                  }
                />
              )}
            </div>

            {showGeolocation && presence.departureAddress && (
              <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                📍 {presence.departureAddress}
              </div>
            )}

            {!presence.officialDepartureTime && (
              <div className="mt-5">
                <EndDayButton />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Onglets de la BU */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#F28C38]/10 flex items-center justify-center text-base">
              📌
            </span>
            Mes ressources
          </h2>
          {['CTO_ADMIN', 'PDG', 'DAF', 'RESPONSABLE_BU'].includes(user.role) && (
            <a href="/onglets" className="text-xs font-semibold text-[#F28C38] hover:underline">
              Gérer les onglets →
            </a>
          )}
        </div>
        {activeTabs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400 mb-2">
              Aucune ressource configurée pour votre équipe.
            </p>
            {['CTO_ADMIN', 'PDG', 'DAF', 'RESPONSABLE_BU'].includes(user.role) && (
              <a href="/onglets" className="text-xs text-[#F28C38] hover:underline font-medium">
                Ajouter des onglets →
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {activeTabs.map((tab) => (
              <a
                key={tab.id}
                href={tab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-40 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-3 hover:border-[#F28C38]/30 hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <span className="w-14 h-14 rounded-2xl bg-[#F28C38]/10 flex items-center justify-center text-3xl group-hover:bg-[#F28C38]/15 transition-colors">
                  {tab.icon ?? '🔗'}
                </span>
                <span className="text-sm font-semibold text-gray-700 text-center group-hover:text-[#F28C38] transition-colors line-clamp-2 leading-tight">
                  {tab.name}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
