import { redirect } from 'next/navigation'
import { getCurrentUser, serverFetch } from '@/lib/auth'
import { AnnouncementsManager } from '@/components/announcements/AnnouncementsManager'
import type { Announcement } from '@/lib/announcements'

type Bu = { id: string; name: string; code: string }

const CAN_MANAGE = ['CTO_ADMIN', 'PDG', 'DAF']

export default async function AnnoncesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!CAN_MANAGE.includes(user.role)) redirect('/acces-refuse')

  const [announcements, bus] = await Promise.all([
    serverFetch<Announcement[]>('/announcements'),
    serverFetch<Bu[]>('/tabs/business-units'),
  ])

  return (
    <div className="p-6">
      <AnnouncementsManager
        initialAnnouncements={announcements ?? []}
        buList={bus ?? []}
      />
    </div>
  )
}
