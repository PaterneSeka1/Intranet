'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner'
import type { User } from '@/types/user'
import type { Announcement } from '@/lib/announcements'
import { BgRestorer } from '@/components/ui/BgRestorer'
import { BgImageLayer } from '@/components/ui/BgImageLayer'
import { Widgets } from '@/components/widgets/Widgets'

interface Props {
  user: User
  announcements: Announcement[]
  children: React.ReactNode
}

export function MobileSidebarToggle({ user, announcements, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--vdm-app-bg)' }}>
      <BgRestorer />
      <BgImageLayer />
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — toujours visible sur lg, slide depuis la gauche sur mobile */}
      <div
        className={`
          fixed lg:relative lg:flex-none inset-y-0 left-0 z-50 lg:z-auto
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <Sidebar user={user} onClose={() => setMobileOpen(false)} />
      </div>

      {/* Contenu principal */}
      <div className="relative z-[2] flex-1 flex flex-col min-w-0">
        {/* Header mobile uniquement */}
        <div className="lg:hidden bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect y="2" width="18" height="2" rx="1" fill="currentColor" />
              <rect y="8" width="18" height="2" rx="1" fill="currentColor" />
              <rect y="14" width="18" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F28C38] flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">VDM Intranet</span>
          </div>
        </div>

        <AnnouncementBanner announcements={announcements} />
        <main className="flex-1 overflow-auto">{children}</main>
        <Widgets />
      </div>
    </div>
  )
}
