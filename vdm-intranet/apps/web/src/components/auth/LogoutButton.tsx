'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { LogoutOverlay } from './LogoutOverlay'

export function LogoutButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
      >
        <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} />
        <span className="hidden sm:inline">Déconnexion</span>
      </button>
      {open && <LogoutOverlay onCancel={() => setOpen(false)} />}
    </>
  )
}
