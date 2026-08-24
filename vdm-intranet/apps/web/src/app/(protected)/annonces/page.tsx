import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import { AnnouncementsManager } from '@/components/announcements/AnnouncementsManager'
import type { Announcement } from '@/lib/announcements'

type Bu = { id: string; name: string; code: string }

// DAF/RESPONSABLE_BU gèrent des annonces limitées à leur propre BU (CAN_MANAGE_ANNOUNCEMENTS_BU_SCOPE
// côté API) : jamais globales, jamais une autre BU — cf. announcements.service.ts.
const CAN_MANAGE_GLOBAL = ['CTO_ADMIN', 'PDG']
const CAN_MANAGE_BU_SCOPE = ['DAF', 'RESPONSABLE_BU']

export default async function AnnoncesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const isGlobalManager = CAN_MANAGE_GLOBAL.includes(user.role)
  const isBuManager = !isGlobalManager && CAN_MANAGE_BU_SCOPE.includes(user.role)
  if (!isGlobalManager && !isBuManager) redirect('/acces-refuse')
  if (isBuManager && !user.businessUnit) redirect('/acces-refuse')

  const [announcements, bus] = await Promise.all([
    serverFetch<Announcement[]>('/announcements'),
    serverFetch<Bu[]>('/tabs/business-units'),
  ])

  return (
    <div className="p-6">
      <AnnouncementsManager
        initialAnnouncements={announcements ?? []}
        buList={bus ?? []}
        scopedBu={isBuManager ? (user.businessUnit ?? null) : null}
      />
    </div>
  )
}
