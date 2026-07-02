import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/Toaster'
import { ConfirmPortal } from '@/components/ui/ConfirmModal'
import { PwaRegister } from '@/components/PwaRegister'

export const metadata: Metadata = {
  title: 'VDM Intranet',
  description: 'Portail interne Veilleur des Médias — Abidjan, Côte d\'Ivoire',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VDM Intranet',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#F28C38',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="bg-[#F4F4F6] font-outfit antialiased">
        {children}
        <Toaster />
        <ConfirmPortal />
        <PwaRegister />
      </body>
    </html>
  )
}
