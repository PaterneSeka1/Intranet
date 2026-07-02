'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { presenceApi } from '@/lib/presence'
import { GeoLocationScreen } from '@/components/presence/GeoLocationScreen'
import { LoginAnimation } from '@/components/auth/LoginAnimation'

type Step = 'form' | 'geo' | 'animating'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('form')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const bg = localStorage.getItem('vdm_login_bg')
    if (bg) document.body.style.background = bg
    return () => { document.body.style.background = '' }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { requiresFirstLoginGeolocation } = await api.auth.login(username.trim(), password)

      if (requiresFirstLoginGeolocation) {
        setStep('geo')
      } else {
        presenceApi.loginLog({ userAgent: navigator.userAgent }).catch(() => {})
        setStep('animating')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Identifiant ou mot de passe incorrect.' : 'Erreur serveur — réessayez.')
      } else {
        setError('Impossible de contacter le serveur.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAnimationComplete = useCallback(() => {
    router.push('/accueil')
    router.refresh()
  }, [router])

  function handleGeoSuccess() {
    setStep('animating')
  }

  if (step === 'animating') {
    return <LoginAnimation username={username} onComplete={handleAnimationComplete} />
  }

  if (step === 'geo') {
    return <GeoLocationScreen onSuccess={handleGeoSuccess} />
  }

  return (
    <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-[360px] p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#F28C38] flex items-center justify-center mx-auto mb-4 shadow-md shadow-orange-100">
            <span className="text-white text-2xl font-bold">V</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900">VDM Intranet</h1>
          <p className="text-xs text-gray-400 mt-0.5">Veilleur des Médias — Abidjan</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Identifiant
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-all placeholder-gray-300"
              placeholder="Ex : CTO"
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-all placeholder-gray-300"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F28C38] hover:bg-[#e07d29] active:bg-[#d06e1a] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
