'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User, Role } from '@/types/user'
import { LogoutOverlay } from '@/components/auth/LogoutOverlay'
import { NotificationsBell } from '@/components/notifications/NotificationsBell'
import { GlobalSearch } from '@/components/search/GlobalSearch'

type MenuItem = { label: string; href: string; icon: string }

const MENUS: Record<Role, MenuItem[]> = {
  CTO_ADMIN: [
    { label: 'Accueil', href: '/accueil', icon: '🏠' },
    { label: 'Utilisateurs', href: '/utilisateurs', icon: '👥' },
    { label: 'Présences', href: '/presences', icon: '📅' },
    { label: 'Onglets', href: '/onglets', icon: '📑' },
    { label: 'Annonces', href: '/annonces', icon: '📢' },
    { label: 'Pilotage', href: '/pilotage', icon: '📊' },
    { label: 'Paramètres', href: '/parametres', icon: '⚙️' },
    { label: 'Mon historique', href: '/mon-historique', icon: '🕐' },
  ],
  PDG: [
    { label: 'Accueil', href: '/accueil', icon: '🏠' },
    { label: 'Utilisateurs', href: '/utilisateurs', icon: '👥' },
    { label: 'Annonces', href: '/annonces', icon: '📢' },
    { label: 'Onglets', href: '/onglets', icon: '📑' },
    { label: 'Pilotage', href: '/pilotage', icon: '📊' },
    { label: 'Présences', href: '/presences', icon: '📅' },
    { label: 'Mon historique', href: '/mon-historique', icon: '🕐' },
  ],
  DAF: [
    { label: 'Accueil', href: '/accueil', icon: '🏠' },
    { label: 'Onglets DAF', href: '/onglets', icon: '📑' },
    { label: 'Pilotage & rapports', href: '/pilotage#rapports', icon: '📊' },
    { label: 'Présences', href: '/presences', icon: '📅' },
    { label: 'Mon historique', href: '/mon-historique', icon: '🕐' },
  ],
  RESPONSABLE_BU: [
    { label: 'Accueil', href: '/accueil', icon: '🏠' },
    { label: 'Présences BU', href: '/presences', icon: '📅' },
    { label: 'Onglets BU', href: '/onglets', icon: '📑' },
    { label: 'Pilotage BU', href: '/pilotage', icon: '📊' },
    { label: 'Mon historique', href: '/mon-historique', icon: '🕐' },
  ],
  RESPONSABLE_POLE: [
    { label: 'Accueil', href: '/accueil', icon: '🏠' },
    { label: 'Présences Pôle', href: '/presences', icon: '📅' },
    { label: 'Pilotage Pôle', href: '/pilotage', icon: '📊' },
    { label: 'Mon historique', href: '/mon-historique', icon: '🕐' },
  ],
  EMPLOYE: [],
  CONSULTANT: [],
  STAGIAIRE: [],
  PRESTATAIRE: [],
}

interface SidebarProps {
  user: User
  onClose?: () => void
  appName?: string
  appSubtitle?: string
  logo?: string
}

export function Sidebar({
  user,
  onClose,
  appName = 'VDM Intranet',
  appSubtitle = 'Veilleur des Médias',
  logo,
}: SidebarProps) {
  const pathname = usePathname()
  const [showLogout, setShowLogout] = useState(false)
  const items = MENUS[user.role] ?? []
  const initials =
    ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() ||
    user.username[0].toUpperCase()

  return (
    <aside
      className="w-60 h-screen sticky top-0 flex flex-col shrink-0"
      style={{ background: 'var(--vdm-sidebar-bg)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" />
          ) : (
            <img
              src="/icon-192.png"
              alt=""
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="vdm-sb-text text-sm font-bold leading-tight">{appName}</div>
            <div className="vdm-sb-text-faint text-xs">{appSubtitle}</div>
          </div>
          <div className="hidden lg:block">
            <NotificationsBell dark />
          </div>
        </div>
      </div>

      {/* Recherche globale */}
      <div className="px-3 pt-3">
        <GlobalSearch dark />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const hrefPath = item.href.split('#')[0]
          const active = pathname === hrefPath || pathname.startsWith(hrefPath + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              style={active ? { background: 'var(--vdm-sidebar-active)' } : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active ? 'vdm-sb-text font-semibold' : 'vdm-sb-link vdm-sb-text-dim'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + profil + logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <Link
          href="/mon-profil"
          style={
            pathname === '/mon-profil' ? { background: 'var(--vdm-sidebar-active)' } : undefined
          }
          className={`flex items-center gap-3 px-3 py-2 mb-1 rounded-xl transition-colors ${
            pathname === '/mon-profil' ? 'vdm-sb-text' : 'vdm-sb-link'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <span className="vdm-sb-text text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <div
              className={`text-xs font-medium truncate ${pathname === '/mon-profil' ? 'vdm-sb-text' : 'vdm-sb-text-mid'}`}
            >
              {user.firstName ?? user.username}
            </div>
            <div
              className={`text-xs truncate ${pathname === '/mon-profil' ? 'vdm-sb-text-mid' : 'vdm-sb-text-faint'}`}
            >
              {user.businessUnit?.name ?? 'Mon profil'}
            </div>
          </div>
        </Link>
        <button
          onClick={() => setShowLogout(true)}
          className="vdm-sb-link vdm-sb-text-dim w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
        >
          <span className="text-base">🚪</span>
          Déconnexion
        </button>
      </div>

      {showLogout && <LogoutOverlay onCancel={() => setShowLogout(false)} />}
    </aside>
  )
}
