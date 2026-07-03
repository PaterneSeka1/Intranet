'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { ROLE_LABELS, type User } from '@/types/user'

import { API_BASE as API } from '@/lib/api-base'

async function patchMe(data: Record<string, string>): Promise<User> {
  const res = await fetch(`${API}/api/users/me`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Erreur ${res.status}`)
  }
  return res.json()
}

const INPUT = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-shadow'

interface Props {
  user: User
}

export function MonProfilClient({ user }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info')

  // Info form
  const [firstName, setFirstName] = useState(user.firstName ?? '')
  const [lastName, setLastName] = useState(user.lastName ?? '')
  const [email, setEmail] = useState(user.email ?? '')
  const [infoSaving, setInfoSaving] = useState(false)

  // Password form
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  const initials = ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase()
    || user.username[0].toUpperCase()

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInfoSaving(true)
    try {
      await patchMe({ firstName, lastName, email })
      toast.success('Profil mis à jour.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.')
    } finally {
      setInfoSaving(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPwd) {
      toast.error('Veuillez saisir votre mot de passe actuel.')
      return
    }
    if (newPwd.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPwd !== confirmPwd) {
      toast.error('Les mots de passe ne correspondent pas.')
      return
    }
    setPwdSaving(true)
    try {
      await patchMe({ currentPassword: currentPwd, password: newPwd })
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
      toast.success('Mot de passe modifié avec succès.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe.')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Carte identité */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#F28C38]/12 flex items-center justify-center shrink-0">
            <span className="text-[#F28C38] font-bold text-2xl">{initials}</span>
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">{user.fullName ?? user.username}</div>
            <div className="text-sm text-[#F28C38] font-medium">{ROLE_LABELS[user.role]}</div>
            <div className="text-xs text-gray-400 mt-0.5 font-mono">{user.username}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Business Unit', value: user.businessUnit?.name },
            { label: 'Pôle', value: user.pole?.name },
            { label: 'Dernière connexion', value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined },
            { label: 'Compte créé le', value: user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : undefined },
          ].map(({ label, value }) => value ? (
            <div key={label} className="bg-gray-50 rounded-xl px-3.5 py-2.5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
              <div className="text-sm text-gray-700 font-medium">{value}</div>
            </div>
          ) : null)}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['info', 'password'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'info' ? 'Informations' : 'Mot de passe'}
          </button>
        ))}
      </div>

      {/* Tab Informations */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Modifier mes informations</h2>
          <form onSubmit={handleInfoSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="profil-firstname" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Prénom</label>
                <input
                  id="profil-firstname"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className={INPUT}
                  placeholder="Prénom"
                />
              </div>
              <div>
                <label htmlFor="profil-lastname" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Nom</label>
                <input
                  id="profil-lastname"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className={INPUT}
                  placeholder="Nom de famille"
                />
              </div>
            </div>
            <div>
              <label htmlFor="profil-email" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Adresse e-mail</label>
              <input
                id="profil-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={INPUT}
                placeholder="exemple@veilleurdesmedias.com"
              />
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={infoSaving}
                className="bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {infoSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Mot de passe */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-1">Changer mon mot de passe</h2>
          <p className="text-xs text-gray-400 mb-4">Minimum 8 caractères. Votre session restera active après le changement.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="current-pwd" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Mot de passe actuel</label>
              <input
                id="current-pwd"
                type="password"
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                required
                autoComplete="current-password"
                className={INPUT}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="new-pwd" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Nouveau mot de passe</label>
              <input
                id="new-pwd"
                type="password"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={INPUT}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="confirm-pwd" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Confirmer le mot de passe</label>
              <input
                id="confirm-pwd"
                type="password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={INPUT}
                placeholder="••••••••"
              />
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
              )}
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={pwdSaving || (confirmPwd.length > 0 && newPwd !== confirmPwd)}
                className="bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {pwdSaving ? 'Modification…' : 'Modifier le mot de passe'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
