'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { presenceApi, type FirstLoginPayload } from '@/lib/presence'
import { api } from '@/lib/api'

interface Props {
  onSuccess: () => void
}

type State = 'idle' | 'requesting' | 'sending' | 'error'

const GEO_ERRORS: Record<number, string> = {
  1: "Vous avez refusé l'accès à la localisation. Veuillez autoriser la localisation dans les paramètres de votre navigateur, puis réessayez.",
  2: "Impossible de déterminer votre position. Vérifiez que le GPS est activé.",
  3: "La demande de localisation a expiré. Réessayez.",
}

export function GeoLocationScreen({ onSuccess }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)

  async function requestLocation() {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas supportée par votre navigateur.")
      return
    }

    setState('requesting')
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setState('sending')
        try {
          const payload: FirstLoginPayload = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            userAgent: navigator.userAgent,
            mapsUrl: `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`,
          }
          await presenceApi.firstLogin(payload)
          onSuccess()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement de la présence.'
          setState('error')
          setError(msg)
        }
      },
      (posError) => {
        setState('error')
        setError(GEO_ERRORS[posError.code] ?? "Erreur de localisation inconnue.")
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const isLoading = state === 'requesting' || state === 'sending'

  return (
    <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-[400px] p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[rgba(242,140,56,0.1)] flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[#F28C38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <h1 className="text-lg font-bold text-gray-900 mb-2">
          Localisation obligatoire
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          C&apos;est votre première connexion de la journée.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          La géolocalisation est requise pour enregistrer votre présence officielle.
        </p>

        {/* État requesting */}
        {state === 'requesting' && (
          <div className="bg-blue-50 rounded-xl p-4 mb-4 text-sm text-blue-700">
            Demande de localisation en cours… autorisez l&apos;accès dans la fenêtre de votre navigateur.
          </div>
        )}

        {/* État sending */}
        {state === 'sending' && (
          <div className="bg-green-50 rounded-xl p-4 mb-4 text-sm text-green-700">
            Position obtenue — enregistrement de la présence…
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4 text-sm text-red-600 text-left">
            {error}
          </div>
        )}

        <button
          onClick={requestLocation}
          disabled={isLoading}
          className="w-full bg-[#F28C38] hover:bg-[#e07d29] active:bg-[#d06e1a] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading
            ? 'Localisation en cours…'
            : state === 'error'
              ? 'Réessayer la localisation'
              : 'Autoriser la localisation'}
        </button>

        <p className="text-xs text-gray-400 mt-4">
          La saisie manuelle n&apos;est pas autorisée pour la première connexion.
        </p>

        <button
          onClick={async () => { await api.auth.logout().catch(() => {}); router.push('/login') }}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
