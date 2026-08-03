import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import { UsersManager } from '@/components/users/UsersManager'
import type { User } from '@/types/user'

type Bu = { id: string; name: string; code: string }
type Pole = { id: string; name: string; code: string; businessUnitId: string }
type ScheduleGroup = {
  id: string
  name: string
  expectedArrivalTime: string
  expectedDepartureTime: string | null
}

// CAN_VIEW reflète CAN_VIEW_USERS côté API (users.controller.ts) : DAF/RESPONSABLE_BU/RESPONSABLE_POLE
// ont un vrai accès en lecture scopé à leur périmètre (users.service.ts::scopeWhere), pas une simple
// coquille frontend — seul le lien de navigation Sidebar manquait (corrigé séparément).
const CAN_VIEW = ['CTO_ADMIN', 'PDG', 'DAF', 'RESPONSABLE_BU', 'RESPONSABLE_POLE']
const CAN_MANAGE = ['CTO_ADMIN', 'PDG']

export default async function UtilisateursPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!CAN_VIEW.includes(user.role)) redirect('/acces-refuse')

  const [users, buList, poleList, scheduleGroups] = await Promise.all([
    serverFetch<User[]>('/users'),
    serverFetch<Bu[]>('/tabs/business-units'),
    serverFetch<Pole[]>('/tabs/poles'),
    serverFetch<ScheduleGroup[]>('/presence/schedule-groups'),
  ])

  return (
    <div className="p-6">
      <UsersManager
        initialUsers={users ?? []}
        buList={buList ?? []}
        poleList={poleList ?? []}
        scheduleGroups={scheduleGroups ?? []}
        canManage={CAN_MANAGE.includes(user.role)}
        currentUserRole={user.role}
      />
    </div>
  )
}
