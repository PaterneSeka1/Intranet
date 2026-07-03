import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import { ParametresClient } from '@/components/parametres/ParametresClient'
import { fetchSettings } from '@/lib/settings'

type Bu = { id: string; name: string; code: string; description: string | null; isActive: boolean; _count: { users: number; poles: number } }
type Pole = { id: string; name: string; code: string; businessUnitId: string; isActive: boolean; businessUnit: { id: string; name: string; code: string } | null; _count: { users: number } }
type ScheduleGroup = {
  id: string; name: string; code: string; description: string | null;
  expectedArrivalTime: string; businessUnitId: string | null; poleId: string | null;
  isNightShift: boolean; isActive: boolean;
  businessUnit: { id: string; name: string; code: string } | null;
  pole: { id: string; name: string; code: string } | null;
  _count: { users: number };
}

export default async function ParametresPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'CTO_ADMIN') redirect('/acces-refuse')

  const [groups, buList, poleList, settingsList] = await Promise.all([
    serverFetch<ScheduleGroup[]>('/presence/schedule-groups') ?? [],
    serverFetch<Bu[]>('/tabs/business-units') ?? [],
    serverFetch<Pole[]>('/tabs/poles') ?? [],
    fetchSettings(),
  ])

  const initialSettings = Object.fromEntries((settingsList ?? []).map(s => [s.key, s.value]))

  return (
    <div className="p-6">
      <ParametresClient
        initialGroups={groups ?? []}
        buList={buList ?? []}
        initialPoles={poleList ?? []}
        initialSettings={initialSettings}
      />
    </div>
  )
}
