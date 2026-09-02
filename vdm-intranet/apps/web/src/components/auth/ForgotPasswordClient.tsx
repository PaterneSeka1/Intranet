'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { BgImageLayer } from '@/components/ui/BgImageLayer'

interface Props {
  initialAppName?: string
  initialAppSubtitle?: string
  initialLogo?: string
}

export function ForgotPasswordClient({
  initialAppName = 'VDM Intranet',
  initialAppSubtitle = 'Veilleur des Médias — Abidjan',
  initialLogo,
}: Props) {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.auth.forgotPassword(identifier.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de contacter le serveur.')
    } finally {
      setLoading(false)
    }
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

        {sent ? (
          <div className="space-y-5">
            <div className="bg-green-50 border border-green-100 rounded-xl px-3.5 py-3 text-sm text-green-700">
              Si un compte existe avec cet identifiant, un email contenant un lien de
              réinitialisation vient d'être envoyé.
            </div>
            <Link
              href="/login"
              className="block text-center w-full bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Indiquez votre matricule ou votre email : si un compte correspond, vous recevrez
                un lien pour choisir un nouveau mot de passe.
              </p>
              <label
                htmlFor="fp-identifier"
                className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
              >
                Matricule ou email
              </label>
              <input
                id="fp-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-all placeholder-gray-300"
                placeholder="Ex : EMP-0231 ou prenom.nom@veilleurdesmedias.com"
                required
                autoFocus
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
              {loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
            </button>

            <Link
              href="/login"
              className="block text-center text-xs text-gray-400 hover:text-[#F28C38] transition-colors"
            >
              Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
