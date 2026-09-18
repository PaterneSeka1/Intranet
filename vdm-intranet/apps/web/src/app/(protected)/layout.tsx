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
import { User, History } from 'lucide-react'
import { BgRestorer } from '@/components/ui/BgRestorer'
import { BgImageLayer } from '@/components/ui/BgImageLayer'
import { ServiceUnavailablePage } from '@/components/ui/ServiceUnavailablePage'
import { fetchSettings } from '@/lib/settings'
import { NotificationsBell } from '@/components/notifications/NotificationsBell'
import { ChatWidget } from '@/components/chat/ChatWidget'

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
    return await res.json()
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
        <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            {logo ? (
              <img
                src={logo}
                alt=""
                className="w-7 h-7 rounded-lg object-contain bg-white shrink-0"
              />
            ) : (
              <img
                src="/icon-192.png"
                alt=""
                className="w-7 h-7 rounded-lg object-cover shrink-0"
              />
            )}
            <span className="font-bold text-gray-800 text-sm hidden sm:inline truncate">
              {appName}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <Link
              href="/mon-profil"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              <User className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">Mon profil</span>
            </Link>
            <Link
              href="/mon-historique"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              <History className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">Mon historique</span>
            </Link>
            <NotificationsBell />
            <LogoutButton />
          </div>
        </header>
        <div className="relative z-[2] flex-1 flex flex-col">
          <LiveAnnouncements initialAnnouncements={announcements} showWidgets />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
        <ChatWidget currentUserId={user.id} />
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
      <ChatWidget currentUserId={user.id} />
    </MobileSidebarToggle>
  )
}
