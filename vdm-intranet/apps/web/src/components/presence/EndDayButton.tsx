'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { presenceApi, type EndDayPayload } from '@/lib/presence'
import { confirm } from '@/lib/confirm'
import { toast } from '@/lib/toast'

type State = 'idle' | 'requesting' | 'sending' | 'error'

const GEO_ERRORS: Record<number, string> = {
  1: "Vous avez refusé l'accès à la localisation. Veuillez autoriser la localisation dans les paramètres de votre navigateur, puis réessayez.",
  2: 'Impossible de déterminer votre position. Vérifiez que le GPS est activé.',
  3: 'La demande de localisation a expiré. Réessayez.',
}

export function EndDayButton() {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    const ok = await confirm({
      title: 'Terminer ma journée',
      message:
        "Votre heure de départ officielle sera enregistrée avec votre position actuelle. Cette action est définitive pour aujourd'hui.",
      confirmLabel: 'Terminer ma journée',
    })
    if (!ok) return

    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par votre navigateur.")
      setState('error')
      return
    }

    setState('requesting')
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setState('sending')
        try {
          const payload: EndDayPayload = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            userAgent: navigator.userAgent,
          }
          await presenceApi.endDay(payload)
          toast.success('Départ enregistré. Bonne soirée !')
          setState('idle')
          router.refresh()
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Erreur lors de l'enregistrement du départ."
          setState('error')
          setError(msg)
        }
      },
      (posError) => {
        setState('error')
        setError(GEO_ERRORS[posError.code] ?? 'Erreur de localisation inconnue.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const isLoading = state === 'requesting' || state === 'sending'

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="w-full sm:w-auto bg-gray-900 hover:bg-black active:bg-gray-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'requesting'
          ? 'Localisation en cours…'
          : state === 'sending'
            ? 'Enregistrement…'
            : '🚪 Terminer ma journée'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
