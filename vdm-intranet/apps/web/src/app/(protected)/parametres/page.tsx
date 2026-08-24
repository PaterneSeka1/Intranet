import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import { ParametresClient } from '@/components/parametres/ParametresClient'
import { ParametresReadOnly } from '@/components/parametres/ParametresReadOnly'
import { fetchSettings } from '@/lib/settings'

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

export default async function ParametresPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // Le CTO_ADMIN gère intégralement la page (branding compris) ; le PDG obtient un accès en
  // lecture seule à l'organigramme BU/Pôles/groupes horaires/jours fériés — un trou de périmètre
  // plus qu'un choix de gouvernance (il ne pouvait jusqu'ici même pas consulter sa propre
  // structure organisationnelle dans l'outil). Tout autre rôle reste refusé.
  if (user.role !== 'CTO_ADMIN' && user.role !== 'PDG') redirect('/acces-refuse')

  const [groups, buList, poleList, settingsList, holidays] = await Promise.all([
    serverFetch<ScheduleGroup[]>('/presence/schedule-groups') ?? [],
    serverFetch<Bu[]>('/tabs/business-units') ?? [],
    serverFetch<Pole[]>('/tabs/poles') ?? [],
    fetchSettings(),
    serverFetch<Holiday[]>('/public-holidays') ?? [],
  ])

  if (user.role === 'PDG') {
    return (
      <div className="p-6">
        <ParametresReadOnly
          buList={buList ?? []}
          poleList={poleList ?? []}
          groups={groups ?? []}
          holidays={holidays ?? []}
        />
      </div>
    )
  }

  const initialSettings = Object.fromEntries((settingsList ?? []).map((s) => [s.key, s.value]))

  return (
    <div className="p-6">
      <ParametresClient
        initialGroups={groups ?? []}
        buList={buList ?? []}
        initialPoles={poleList ?? []}
        initialSettings={initialSettings}
        initialHolidays={holidays ?? []}
      />
    </div>
  )
}
