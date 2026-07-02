import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { isAccueilOnly } from '@/types/user'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner'
import { MobileSidebarToggle } from '@/components/sidebar/MobileSidebarToggle'
import type { Announcement } from '@/lib/announcements'
import Link from 'next/link'
import { BgRestorer } from '@/components/ui/BgRestorer'

async function getActiveAnnouncements(): Promise<Announcement[]> {
  try {
    const cookieStore = await cookies()
    const cookieName = process.env.COOKIE_NAME ?? 'vdm_token'
    const token = cookieStore.get(cookieName)?.value
    if (!token) return []
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/announcements?active=true`,
      { headers: { Cookie: `${cookieName}=${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const announcements = await getActiveAnnouncements()

  if (isAccueilOnly(user.role)) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] flex flex-col">
        <BgRestorer />
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F28C38] flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">VDM Intranet</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/mon-profil" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">Mon profil</Link>
            <Link href="/mon-historique" className="text-xs text-gray-500 hover:text-gray-800 transition-colors">Mon historique</Link>
            <LogoutButton />
          </div>
        </header>
        <AnnouncementBanner announcements={announcements} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    )
  }

  return (
    <MobileSidebarToggle user={user} announcements={announcements}>
      {children}
    </MobileSidebarToggle>
  )
}
