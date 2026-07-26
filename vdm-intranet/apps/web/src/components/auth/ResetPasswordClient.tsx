'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { toast } from '@/lib/toast'
import { BgImageLayer } from '@/components/ui/BgImageLayer'
import { PasswordInput } from '@/components/ui/PasswordInput'

interface Props {
  token?: string
  initialAppName?: string
  initialAppSubtitle?: string
  initialLogo?: string
}

function Shell({
  appName,
  appSubtitle,
  logo,
  children,
}: {
  appName: string
  appSubtitle: string
  logo?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--vdm-login-bg)' }}
    >
      <BgImageLayer />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-[360px] p-8">
        <div className="text-center mb-8">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4 shadow-md shadow-orange-100"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#F28C38] flex items-center justify-center mx-auto mb-4 shadow-md shadow-orange-100">
              <span className="text-white text-2xl font-bold">
                {appName[0]?.toUpperCase() ?? 'V'}
              </span>
            </div>
          )}
          <h1 className="text-lg font-bold text-gray-900">{appName}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{appSubtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ResetPasswordClient({
  token,
  initialAppName = 'VDM Intranet',
  initialAppSubtitle = 'Veilleur des Médias — Abidjan',
  initialLogo,
}: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  if (!token) {
    return (
      <Shell appName={initialAppName} appSubtitle={initialAppSubtitle} logo={initialLogo}>
        <div className="space-y-5">
          <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-3 text-sm text-red-600">
            Ce lien de réinitialisation est invalide ou incomplet.
          </div>
          <Link
            href="/mot-de-passe-oublie"
            className="block text-center w-full bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Demander un nouveau lien
          </Link>
        </div>
      </Shell>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      await api.auth.resetPassword(token!, password)
      toast.success('Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.')
      router.push('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de contacter le serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell appName={initialAppName} appSubtitle={initialAppSubtitle} logo={initialLogo}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="rp-password"
            className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
          >
            Nouveau mot de passe
          </label>
          <PasswordInput
            id="rp-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-all placeholder-gray-300"
            placeholder="••••••••"
            required
            autoFocus
            autoComplete="new-password"
          />
        </div>

        <div>
          <label
            htmlFor="rp-confirm"
            className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
          >
            Confirmer le mot de passe
          </label>
          <PasswordInput
            id="rp-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-all placeholder-gray-300"
            placeholder="••••••••"
            required
            autoComplete="new-password"
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
          {loading ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
        </button>
      </form>
    </Shell>
  )
}
