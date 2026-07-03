import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { isAccueilOnly } from '@/types/user'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner'
import { MobileSidebarToggle } from '@/components/sidebar/MobileSidebarToggle'
import type { Announcement } from '@/lib/announcements'
import { API_BASE } from '@/lib/api-base'
import Link from 'next/link'
import { BgRestorer } from '@/components/ui/BgRestorer'
import { BgImageLayer } from '@/components/ui/BgImageLayer'

async function getActiveAnnouncements(): Promise<Announcement[]> {
  try {
    const cookieStore = await cookies()
    const cookieName = process.env.COOKIE_NAME ?? 'vdm_token'
    const token = cookieStore.get(cookieName)?.value
    if (!token) return []
    const res = await fetch(
      `${API_BASE}/api/announcements?active=true`,
      { headers: { Cookie: `${cookieName}=${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const hasToken = !!cookieStore.get(process.env.COOKIE_NAME ?? 'vdm_token')?.value

  if (!hasToken) redirect('/login')

  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--vdm-app-bg)' }}>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-[#F28C38] text-2xl">⚠</span>
          </div>
          <h1 className="text-base font-bold text-gray-900 mb-2">Service indisponible</h1>
          <p className="text-sm text-gray-500 mb-6">
            Le serveur ne répond pas. Vérifiez votre connexion ou réessayez dans quelques instants.
          </p>
          <a
            href="/"
            className="inline-block bg-[#F28C38] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#e07d29] transition-colors"
          >
            Réessayer
          </a>
        </div>
      </div>
    )
  }

  const announcements = await getActiveAnnouncements()

  if (isAccueilOnly(user.role)) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--vdm-app-bg)' }}>
        <BgRestorer />
        <BgImageLayer />
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
