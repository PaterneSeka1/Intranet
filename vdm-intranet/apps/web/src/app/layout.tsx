import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/Toaster'
import { ConfirmPortal } from '@/components/ui/ConfirmModal'
import { PwaRegister } from '@/components/PwaRegister'
import { PwaInstallGate } from '@/components/PwaInstallGate'
import { PwaAutoStart } from '@/components/PwaAutoStart'
import { fetchSettings } from '@/lib/settings'
import { opacitySettingToCss } from '@/lib/theme-settings'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSettings()
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]))
  const appName = s['vdm_app_name'] || 'VDM Intranet'
  const favicon = s['vdm_favicon'] || s['vdm_logo'] || '/icon.svg'

  return {
    title: appName,
    description: "Portail interne Veilleur des Médias — Abidjan, Côte d'Ivoire",
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: appName,
    },
    icons: {
      icon: favicon,
      apple: favicon,
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#F28C38',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await fetchSettings()
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]))
  const cssVars = [
    s['vdm_app_bg'] && `--vdm-app-bg:${s['vdm_app_bg']}`,
    s['vdm_login_bg'] &&
      `--vdm-login-bg:${s['vdm_login_bg']};--vdm-sidebar-bg:${s['vdm_login_bg']}`,
    s['vdm_sidebar_active'] && `--vdm-sidebar-active:${s['vdm_sidebar_active']}`,
    s['vdm_sidebar_hover'] && `--vdm-sidebar-hover:${s['vdm_sidebar_hover']}`,
    s['vdm_sidebar_text'] && `--vdm-sidebar-text:${s['vdm_sidebar_text']}`,
    s['vdm_bg_image_opacity'] &&
      `--vdm-bg-image-opacity:${opacitySettingToCss(s['vdm_bg_image_opacity'])}`,
  ]
    .filter(Boolean)
    .join(';')

  return (
    <html lang="fr">
      <body className="bg-[#F4F4F6] font-outfit antialiased">
        {cssVars && <style dangerouslySetInnerHTML={{ __html: `:root{${cssVars}}` }} />}
        {children}
        <Toaster />
        <ConfirmPortal />
        <PwaRegister />
        <PwaInstallGate />
        <PwaAutoStart />
      </body>
    </html>
  )
}
