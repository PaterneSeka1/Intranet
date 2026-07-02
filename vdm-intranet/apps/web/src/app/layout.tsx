import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/Toaster'
import { ConfirmPortal } from '@/components/ui/ConfirmModal'

export const metadata: Metadata = {
  title: 'VDM Intranet',
  description: 'Portail Intranet — Veilleur des Médias',
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
      </body>
    </html>
  )
}
