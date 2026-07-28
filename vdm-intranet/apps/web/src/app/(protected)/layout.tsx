import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentUserState } from '@/lib/auth'
import { isAccueilOnly } from '@/types/user'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { MustChangePasswordGuard } from '@/components/auth/MustChangePasswordGuard'
import { LiveAnnouncements } from '@/components/announcements/LiveAnnouncements'
import { MobileSidebarToggle } from '@/components/sidebar/MobileSidebarToggle'
import type { Announcement } from '@/lib/announcements'
import { API_BASE } from '@/lib/api-base'
import Link from 'next/link'
import { BgRestorer } from '@/components/ui/BgRestorer'
import { BgImageLayer } from '@/components/ui/BgImageLayer'
import { ServiceUnavailablePage } from '@/components/ui/ServiceUnavailablePage'
import { fetchSettings } from '@/lib/settings'
import { NotificationsBell } from '@/components/notifications/NotificationsBell'

async function getActiveAnnouncements(): Promise<Announcement[]> {
  try {
    const cookieStore = await cookies()
    const cookieName = process.env.COOKIE_NAME ?? 'vdm_token'
    const token = cookieStore.get(cookieName)?.value
    if (!token) return []
    const res = await fetch(`${API_BASE}/api/announcements?active=true`, {
      headers: { Cookie: `${cookieName}=${token}` },
      cache: 'no-store',
    })
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

  const { user, unavailable } = await getCurrentUserState()

  if (!user) {
    if (!unavailable) redirect('/login')
    return <ServiceUnavailablePage />
  }

  const announcements = await getActiveAnnouncements()
  const settings = await fetchSettings()
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]))
  const appName = s['vdm_app_name'] || 'VDM Intranet'
  const appSubtitle = s['vdm_app_subtitle'] || 'Veilleur des Médias'
  const logo = s['vdm_logo']

  if (isAccueilOnly(user.role)) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--vdm-app-bg)' }}>
        <MustChangePasswordGuard mustChangePassword={!!user.mustChangePassword} />
        <BgRestorer />
        <BgImageLayer />
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#F28C38] flex items-center justify-center">
                <span className="text-white text-xs font-bold">{appName[0]?.toUpperCase()}</span>
              </div>
            )}
            <span className="font-bold text-gray-800 text-sm">{appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/mon-profil"
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              Mon profil
            </Link>
            <Link
              href="/mon-historique"
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              Mon historique
            </Link>
            <NotificationsBell />
            <LogoutButton />
          </div>
        </header>
        <LiveAnnouncements initialAnnouncements={announcements} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    )
  }

  return (
    <MobileSidebarToggle
      user={user}
      announcements={announcements}
      appName={appName}
      appSubtitle={appSubtitle}
      logo={logo}
    >
      <MustChangePasswordGuard mustChangePassword={!!user.mustChangePassword} />
      {children}
    </MobileSidebarToggle>
  )
}
