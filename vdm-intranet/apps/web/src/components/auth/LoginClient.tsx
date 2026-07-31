'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { presenceApi } from '@/lib/presence'
import { toast } from '@/lib/toast'
import { GeoLocationScreen } from '@/components/presence/GeoLocationScreen'
import { LoginAnimation } from '@/components/auth/LoginAnimation'
import { BgImageLayer } from '@/components/ui/BgImageLayer'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { fetchSettings } from '@/lib/settings'
import { escapeCssString, opacitySettingToCss } from '@/lib/theme-settings'

type Step = 'form' | 'geo' | 'animating'

interface Props {
  initialAppName?: string
  initialAppSubtitle?: string
  initialLogo?: string
}

export function LoginClient({
  initialAppName = 'VDM Intranet',
  initialAppSubtitle = 'Veilleur des Médias — Abidjan',
  initialLogo,
}: Props) {
  const [step, setStep] = useState<Step>('form')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetchSettings()
      .then((settings) => {
        if (cancelled) return
        const m = Object.fromEntries(settings.map((s) => [s.key, s.value]))
        if (m['vdm_bg_image']) {
          document.documentElement.style.setProperty(
            '--vdm-bg-image',
            `url("${escapeCssString(m['vdm_bg_image'])}")`
          )
          const opacity = opacitySettingToCss(m['vdm_bg_image_opacity'])
          document.documentElement.style.setProperty('--vdm-bg-image-opacity', opacity)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      document.documentElement.style.removeProperty('--vdm-bg-image')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { user, requiresFirstLoginGeolocation } = await api.auth.login(
        username.trim(),
        password
      )

      // La géolocalisation de 1ère connexion du jour est prioritaire sur le
      // changement de mot de passe obligatoire : sinon la présence du jour
      // n'est jamais enregistrée pour un compte fraîchement créé/réinitialisé.
      // Une fois la géolocalisation faite (ou si elle n'est pas requise),
      // MustChangePasswordGuard renvoie l'utilisateur vers /mon-profil.
      if (requiresFirstLoginGeolocation) {
        setStep('geo')
        return
      }

      if (user.mustChangePassword) {
        router.replace('/mon-profil')
        router.refresh()
        return
      }

      presenceApi.loginLog({ userAgent: navigator.userAgent }).catch(() => {
        toast.warning('Présence non enregistrée — veuillez réessayer.')
      })
      setStep('animating')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(
          err.status === 401
            ? 'Identifiant ou mot de passe incorrect.'
            : 'Erreur serveur — réessayez.'
        )
      } else {
        toast.error('Impossible de contacter le serveur.')
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--vdm-login-bg)' }}
    >
      <BgImageLayer />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-[360px] p-8">
        <div className="text-center mb-8">
          <img
            src={initialLogo || '/logo_entreprise.png'}
            alt="Veilleur des Médias"
            className="h-12 w-auto mx-auto mb-4"
          />
          <h1 className="text-lg font-bold text-gray-900">{initialAppName}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{initialAppSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Identifiant
            </label>
            <input
              id="login-username"
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
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Mot de passe
            </label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-all placeholder-gray-300"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F28C38] hover:bg-[#e07d29] active:bg-[#d06e1a] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

          <div className="flex justify-end -mt-1">
            <Link
              href="/mot-de-passe-oublie"
              className="text-xs text-gray-400 hover:text-[#F28C38] transition-colors"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
