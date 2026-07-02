'use client'

import { useState } from 'react'
import { LogoutOverlay } from './LogoutOverlay'

export function LogoutButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        Déconnexion
      </button>
      {open && <LogoutOverlay onCancel={() => setOpen(false)} />}
    </>
  )
}
