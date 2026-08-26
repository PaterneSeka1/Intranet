'use client'

import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <AlertTriangle className="w-10 h-10 text-amber-500" strokeWidth={1.5} />
      <h2 className="text-lg font-semibold text-gray-800">Une erreur est survenue</h2>
      <p className="text-sm text-gray-500 text-center max-w-sm">
        {error.message || 'Impossible de charger les onglets.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#F28C38] text-white text-sm font-medium rounded-xl hover:bg-[#e07d2a] transition-colors"
      >
        Réessayer
      </button>
    </div>
  )
}
