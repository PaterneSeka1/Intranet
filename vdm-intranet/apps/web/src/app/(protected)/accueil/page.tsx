import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
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

export default async function AccueilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [presenceData, allTabs] = await Promise.all([
    serverFetch<TodayPresenceResult>('/presence/today'),
    serverFetch<Tab[]>(user.businessUnit ? `/tabs?businessUnitId=${user.businessUnit.id}` : '/tabs'),
  ])

  const presence = presenceData?.presence ?? null
  const status = presence?.status ?? 'ABSENT'
  const activeTabs = (allTabs ?? []).filter(t => t.isActive)

  return (
    <div className="p-6 space-y-6">

      {/* Carte présence — uniquement les données du jour */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-500 capitalize">{formatDate()}</p>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLE[status] ?? DEFAULT_STATUS_STYLE}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
          <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
            {presence.address}
          </div>
        )}
      </div>

      {/* Onglets de la BU */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">Mes ressources</h2>
          {['CTO_ADMIN', 'RESPONSABLE_BU'].includes(user.role) && (
            <a href="/onglets" className="text-xs text-[#F28C38] hover:underline">
              Gérer les onglets →
            </a>
          )}
        </div>
        {activeTabs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400 mb-2">Aucune ressource configurée pour votre équipe.</p>
            {['CTO_ADMIN', 'RESPONSABLE_BU'].includes(user.role) && (
              <a href="/onglets" className="text-xs text-[#F28C38] hover:underline font-medium">
                Ajouter des onglets →
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {activeTabs.map(tab => (
              <a
                key={tab.id}
                href={tab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-40 bg-white rounded-2xl border border-gray-100 p-5 flex flex-col items-center gap-3 hover:border-[#F28C38]/30 hover:shadow-sm transition-all group"
              >
                <span className="text-4xl">{tab.icon ?? '🔗'}</span>
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
