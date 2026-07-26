'use client'

import { useEffect, useState, useCallback } from 'react'

const RETRY_SECS = 15

function ServerIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F28C38"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  )
}

function WifiOffIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F28C38"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}

export function ServiceUnavailablePage() {
  const [countdown, setCountdown] = useState(RETRY_SECS)
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [dotCount, setDotCount] = useState(0)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const onOnline = () => {
      setIsOnline(true)
      window.location.reload()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setDotCount((d) => (d + 1) % 4), 500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (countdown <= 0) {
      window.location.reload()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const retry = useCallback(() => window.location.reload(), [])

  const progress = Math.round(((RETRY_SECS - countdown) / RETRY_SECS) * 100)
  const offline = isOnline === false

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--vdm-app-bg, linear-gradient(135deg,#f0f2f5 0%,#e4e8ed 100%))' }}
    >
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Top accent bar */}
          <div
            className="h-1.5 bg-gradient-to-r from-[#F28C38] via-[#e07d29] to-[#F28C38] bg-[length:200%_100%]"
            style={{ animation: 'shimmer 2s linear infinite' }}
          />

          <div className="px-8 pt-8 pb-6">
            {/* Icon */}
            <div className="relative w-20 h-20 mx-auto mb-5">
              {offline && (
                <>
                  <span className="absolute inset-0 rounded-full bg-orange-200 opacity-40 animate-ping" />
                  <span
                    className="absolute inset-3 rounded-full bg-orange-100 opacity-30 animate-ping"
                    style={{ animationDelay: '0.4s' }}
                  />
                </>
              )}
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center shadow-sm border border-orange-100">
                {offline ? <WifiOffIcon /> : <ServerIcon />}
              </div>
            </div>

            {/* Status pill */}
            <div className="flex justify-center mb-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  offline ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${offline ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`}
                />
                {offline ? 'Hors ligne' : 'Serveur inaccessible'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-lg font-bold text-gray-900 text-center mb-2">
              {offline ? 'Vous êtes hors connexion' : 'Service temporairement indisponible'}
            </h1>

            {/* Message */}
            <p className="text-sm text-gray-400 text-center leading-relaxed mb-7">
              {offline
                ? 'Vérifiez votre connexion Wi-Fi ou réseau mobile. Cette page se rechargera automatiquement dès que la connexion sera rétablie.'
                : 'Le serveur ne répond pas pour le moment. Il sera de nouveau disponible dans quelques instants.'}
            </p>

            {/* Countdown progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  Nouvelle tentative{'.'.repeat(dotCount)}
                </span>
                <span className="text-xs font-semibold tabular-nums text-[#F28C38]">
                  {countdown}s
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #F28C38, #e07d29)',
                  }}
                />
              </div>
            </div>

            {/* Primary CTA */}
            <button
              onClick={retry}
              className="w-full bg-[#F28C38] hover:bg-[#e07d29] active:bg-[#c96e20] text-white font-semibold py-3 rounded-xl text-sm transition-colors mb-3 flex items-center justify-center gap-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Réessayer maintenant
            </button>

            {/* Secondary */}
            <a
              href="/login"
              className="block text-center text-xs text-gray-300 hover:text-gray-500 transition-colors py-1"
            >
              Retour à la connexion
            </a>
          </div>

          {/* Footer */}
          <div className="px-8 py-3.5 bg-gray-50/70 border-t border-gray-100 flex items-center justify-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#F28C38] flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold leading-none">V</span>
            </div>
            <span className="text-[11px] text-gray-400">VDM Intranet · Veilleur des Médias</span>
          </div>
        </div>

        {/* Below card hint */}
        <p className="text-center text-[10px] text-gray-300 mt-4">Abidjan, Côte d&apos;Ivoire</p>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </div>
  )
}
