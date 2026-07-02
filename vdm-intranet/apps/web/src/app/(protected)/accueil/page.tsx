import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import { ROLE_LABELS } from '@/types/user'
import type { TodayPresenceResult } from '@/lib/presence'
import type { Tab } from '@/lib/tabs'

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  LATE: 'bg-orange-100 text-orange-700',
  ABSENT: 'bg-gray-100 text-gray-500',
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Présent',
  LATE: 'En retard',
  ABSENT: 'Non enregistré',
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getUTCHours().toString().padStart(2, '0')}h${d.getUTCMinutes().toString().padStart(2, '0')}`
}

export default async function AccueilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [presenceData, allTabs] = await Promise.all([
    serverFetch<TodayPresenceResult>('/presence/today'),
    user.businessUnit
      ? serverFetch<Tab[]>(`/tabs?businessUnitId=${user.businessUnit.id}`)
      : Promise.resolve([] as Tab[]),
  ])

  const presence = presenceData?.presence ?? null
  const status = presence?.status ?? 'ABSENT'
  const activeTabs = (allTabs ?? []).filter(t => t.isActive)

  const initials = ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase()
    || user.username[0].toUpperCase()

  const ACCUEIL_ONLY = ['CONSULTANT', 'STAGIAIRE', 'PRESTATAIRE']

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour, {user.firstName ?? user.username}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Bienvenue sur le portail VDM Intranet</p>
      </div>

      {/* Carte profil + présence */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(242,140,56,0.12)] flex items-center justify-center shrink-0">
            <span className="text-[#F28C38] font-bold text-lg">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-base">
                {user.fullName ?? user.username}
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            </div>
            <div className="text-sm text-[#F28C38] font-medium mt-0.5">{ROLE_LABELS[user.role]}</div>

            <div className="flex flex-wrap gap-2 mt-2">
              {user.businessUnit && (
                <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                  {user.businessUnit.name}
                </span>
              )}
              {user.pole && (
                <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                  {user.pole.name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Heure attendue</div>
                <div className="text-sm font-semibold text-gray-800">
                  {presence?.expectedArrivalTime && presence.expectedArrivalTime !== '--:--'
                    ? presence.expectedArrivalTime
                    : presenceData?.scheduleSource?.time ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Arrivée officielle</div>
                <div className="text-sm font-semibold text-gray-800">{formatTime(presence?.officialArrivalTime)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Retard</div>
                <div className={`text-sm font-semibold ${presence?.delayMinutes ? 'text-orange-600' : 'text-gray-800'}`}>
                  {presence?.delayMinutes ? `+${presence.delayMinutes} min` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Localisation</div>
                <div className="text-sm font-semibold">
                  {presence?.mapsUrl ? (
                    <a href={presence.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#F28C38] underline underline-offset-2">
                      Voir carte
                    </a>
                  ) : '—'}
                </div>
              </div>
            </div>

            {presence?.address && (
              <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                {presence.address}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onglets de la BU */}
      {activeTabs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">
              Mes ressources — {user.businessUnit?.name}
            </h2>
            {['CTO_ADMIN', 'RESPONSABLE_BU'].includes(user.role) && (
              <a href="/onglets" className="text-xs text-[#F28C38] hover:underline">
                Gérer les onglets →
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {activeTabs.map(tab => (
              <a
                key={tab.id}
                href={tab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-2xl border border-gray-100 p-3.5 flex flex-col items-center gap-2 hover:border-[#F28C38]/30 hover:shadow-sm transition-all group"
              >
                <span className="text-3xl">{tab.icon ?? '🔗'}</span>
                <span className="text-xs font-semibold text-gray-700 text-center group-hover:text-[#F28C38] transition-colors line-clamp-2 leading-tight">
                  {tab.name}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
