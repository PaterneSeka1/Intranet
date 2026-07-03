'use client'

import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { Modal } from '@/components/ui/Modal'

import { API_BASE as API } from '@/lib/api-base'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Bu = { id: string; name: string; code: string; description: string | null; isActive: boolean; _count: { users: number; poles: number } }

type Pole = { id: string; name: string; code: string; businessUnitId: string; isActive: boolean; businessUnit: { id: string; name: string; code: string } | null; _count: { users: number } }

type BuForm = { name: string; code: string; description: string }
type PoleForm = { name: string; code: string; businessUnitId: string }

type ScheduleGroup = {
  id: string
  name: string
  code: string
  description: string | null
  expectedArrivalTime: string
  businessUnitId: string | null
  poleId: string | null
  isNightShift: boolean
  isActive: boolean
  businessUnit: { id: string; name: string; code: string } | null
  pole: { id: string; name: string; code: string } | null
  _count: { users: number }
}

type GroupForm = {
  name: string
  code: string
  description: string
  expectedArrivalTime: string
  businessUnitId: string
  poleId: string
  isNightShift: boolean
}

// ---------------------------------------------------------------------------
// Gradients disponibles
// ---------------------------------------------------------------------------

const BG_GRADIENTS: { category: string; items: { label: string; value: string }[] }[] = [
  {
    category: 'Chauds',
    items: [
      { label: 'Aurore orange',    value: 'linear-gradient(135deg, #F28C38 0%, #e07d29 100%)' },
      { label: 'Coucher de soleil', value: 'linear-gradient(135deg, #7c3aed 0%, #F28C38 100%)' },
      { label: 'Corail',           value: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)' },
      { label: 'Caramel',          value: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)' },
    ],
  },
  {
    category: 'Froids',
    items: [
      { label: 'Océan bleu',   value: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' },
      { label: 'Nuit violette', value: 'linear-gradient(135deg, #2d1b69 0%, #7c3aed 100%)' },
      { label: 'Glacier',       value: 'linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 100%)' },
      { label: 'Minuit',        value: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' },
    ],
  },
  {
    category: 'Naturels',
    items: [
      { label: 'Forêt verte', value: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)' },
      { label: 'Tropique',    value: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)' },
      { label: 'Prairie',     value: 'linear-gradient(135deg, #365314 0%, #84cc16 100%)' },
      { label: 'Ébène',       value: 'linear-gradient(135deg, #1c1917 0%, #44403c 100%)' },
    ],
  },
  {
    category: 'Neutres',
    items: [
      { label: 'Gris ardoise', value: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)' },
      { label: 'Anthracite',   value: 'linear-gradient(135deg, #111827 0%, #374151 100%)' },
      { label: 'Brume',        value: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)' },
      { label: 'Rose poudré',  value: 'linear-gradient(135deg, #fda4af 0%, #fb7185 100%)' },
    ],
  },
]

function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(maxWidth / img.width, 1)
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const LS_KEY_APP = 'vdm_app_bg'
const LS_KEY_LOGIN = 'vdm_login_bg'

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function apiReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Erreur ${res.status}`)
  }
  return res.json()
}

const EMPTY_GROUP: GroupForm = {
  name: '',
  code: '',
  description: '',
  expectedArrivalTime: '08:00',
  businessUnitId: '',
  poleId: '',
  isNightShift: false,
}

const INPUT = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]'
const SELECT = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] bg-white'

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

interface Props {
  initialGroups: ScheduleGroup[]
  buList: Bu[]
  initialPoles?: Pole[]
}

const EMPTY_BU: BuForm = { name: '', code: '', description: '' }
const EMPTY_POLE: PoleForm = { name: '', code: '', businessUnitId: '' }

export function ParametresClient({ initialGroups, buList: initialBuList, initialPoles = [] }: Props) {
  const [tab, setTab] = useState<'bg' | 'groups' | 'org'>('bg')

  // --- Fond d'écran ---
  const [appBg, setAppBg] = useState('')
  const [loginBg, setLoginBg] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY_APP) ?? ''
    setAppBg(stored)
    if (stored) document.documentElement.style.setProperty('--vdm-app-bg', stored)
    setLoginBg(localStorage.getItem(LS_KEY_LOGIN) ?? '')
  }, [])

  function applyAppBg(value: string) {
    setAppBg(value)
    document.documentElement.style.setProperty('--vdm-app-bg', value)
    try {
      localStorage.setItem(LS_KEY_APP, value)
      toast.success('Fond d\'écran principal appliqué.')
    } catch {
      toast.warning('Fond appliqué mais image trop grande pour être sauvegardée — elle s\'effacera à la prochaine ouverture.')
    }
  }

  function applyLoginBg(value: string) {
    setLoginBg(value)
    localStorage.setItem(LS_KEY_LOGIN, value)
    toast.success('Fond d\'écran de connexion appliqué.')
  }

  function resetBg(target: 'app' | 'login') {
    if (target === 'app') {
      setAppBg('')
      localStorage.removeItem(LS_KEY_APP)
      document.documentElement.style.setProperty('--vdm-app-bg', '#f4f4f6')
      toast.info('Fond d\'écran principal réinitialisé.')
    } else {
      setLoginBg('')
      localStorage.removeItem(LS_KEY_LOGIN)
      document.documentElement.style.setProperty('--vdm-login-bg', '#f4f4f6')
      toast.info('Fond d\'écran de connexion réinitialisé.')
    }
  }

  // --- Organisation (BU & Pôles) ---
  const [bus, setBus] = useState<Bu[]>(initialBuList)
  const [poles, setPoles] = useState<Pole[]>(initialPoles)
  const [orgSubTab, setOrgSubTab] = useState<'bu' | 'poles'>('bu')

  // BU form
  const [showBuForm, setShowBuForm] = useState(false)
  const [editingBu, setEditingBu] = useState<Bu | null>(null)
  const [buForm, setBuForm] = useState<BuForm>(EMPTY_BU)
  const [buSaving, setBuSaving] = useState(false)
  const [buError, setBuError] = useState('')

  async function handleBuSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBuSaving(true)
    setBuError('')
    try {
      const payload = { name: buForm.name, code: buForm.code, description: buForm.description || undefined }
      if (editingBu) {
        const updated = await apiReq<Bu>(`/tabs/business-units/${editingBu.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setBus(prev => prev.map(b => b.id === editingBu.id ? updated : b))
        toast.success('Business Unit mise à jour.')
      } else {
        const created = await apiReq<Bu>('/tabs/business-units', { method: 'POST', body: JSON.stringify(payload) })
        setBus(prev => [...prev, created])
        toast.success('Business Unit créée.')
      }
      setShowBuForm(false)
      setEditingBu(null)
    } catch (err) {
      setBuError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBuSaving(false)
    }
  }

  async function deleteBu(bu: Bu) {
    const ok = await confirm({ title: 'Supprimer la BU', message: `Supprimer « ${bu.name} » ? Cette action est irréversible.`, confirmLabel: 'Supprimer', destructive: true })
    if (!ok) return
    try {
      await apiReq(`/tabs/business-units/${bu.id}`, { method: 'DELETE' })
      setBus(prev => prev.filter(b => b.id !== bu.id))
      toast.success(`BU « ${bu.name} » supprimée.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  async function toggleBuActive(bu: Bu) {
    try {
      const updated = await apiReq<Bu>(`/tabs/business-units/${bu.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !bu.isActive }) })
      setBus(prev => prev.map(b => b.id === bu.id ? updated : b))
      toast.success(`BU « ${bu.name} » ${updated.isActive ? 'activée' : 'désactivée'}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.')
    }
  }

  // Pole form
  const [showPoleForm, setShowPoleForm] = useState(false)
  const [editingPole, setEditingPole] = useState<Pole | null>(null)
  const [poleForm, setPoleForm] = useState<PoleForm>(EMPTY_POLE)
  const [poleSaving, setPoleSaving] = useState(false)
  const [poleError, setPoleError] = useState('')

  async function handlePoleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPoleSaving(true)
    setPoleError('')
    try {
      const payload = { name: poleForm.name, code: poleForm.code, businessUnitId: poleForm.businessUnitId }
      if (editingPole) {
        const updated = await apiReq<Pole>(`/tabs/poles/${editingPole.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setPoles(prev => prev.map(p => p.id === editingPole.id ? updated : p))
        toast.success('Pôle mis à jour.')
      } else {
        const created = await apiReq<Pole>('/tabs/poles', { method: 'POST', body: JSON.stringify(payload) })
        setPoles(prev => [...prev, created])
        toast.success('Pôle créé.')
      }
      setShowPoleForm(false)
      setEditingPole(null)
    } catch (err) {
      setPoleError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPoleSaving(false)
    }
  }

  async function deletePole(pole: Pole) {
    const ok = await confirm({ title: 'Supprimer le pôle', message: `Supprimer « ${pole.name} » ? Cette action est irréversible.`, confirmLabel: 'Supprimer', destructive: true })
    if (!ok) return
    try {
      await apiReq(`/tabs/poles/${pole.id}`, { method: 'DELETE' })
      setPoles(prev => prev.filter(p => p.id !== pole.id))
      toast.success(`Pôle « ${pole.name} » supprimé.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  async function togglePoleActive(pole: Pole) {
    try {
      const updated = await apiReq<Pole>(`/tabs/poles/${pole.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !pole.isActive }) })
      setPoles(prev => prev.map(p => p.id === pole.id ? updated : p))
      toast.success(`Pôle « ${pole.name} » ${updated.isActive ? 'activé' : 'désactivé'}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.')
    }
  }

  // --- Groupes horaires ---
  const [groups, setGroups] = useState<ScheduleGroup[]>(initialGroups)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ScheduleGroup | null>(null)
  const [groupForm, setGroupForm] = useState<GroupForm>(EMPTY_GROUP)
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupError, setGroupError] = useState('')

  async function refreshGroups() {
    try {
      const g = await apiReq<ScheduleGroup[]>('/presence/schedule-groups')
      setGroups(g)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de recharger les groupes.')
    }
  }

  function openCreateGroup() {
    setEditingGroup(null)
    setGroupForm(EMPTY_GROUP)
    setGroupError('')
    setShowGroupForm(true)
  }

  function openEditGroup(g: ScheduleGroup) {
    setEditingGroup(g)
    setGroupForm({
      name: g.name,
      code: g.code,
      description: g.description ?? '',
      expectedArrivalTime: g.expectedArrivalTime,
      businessUnitId: g.businessUnitId ?? '',
      poleId: g.poleId ?? '',
      isNightShift: g.isNightShift,
    })
    setGroupError('')
    setShowGroupForm(true)
  }

  async function handleGroupSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGroupSaving(true)
    setGroupError('')
    try {
      const payload = {
        name: groupForm.name,
        code: groupForm.code,
        description: groupForm.description || undefined,
        expectedArrivalTime: groupForm.expectedArrivalTime,
        businessUnitId: groupForm.businessUnitId || undefined,
        poleId: groupForm.poleId || undefined,
        isNightShift: groupForm.isNightShift,
      }

      if (editingGroup) {
        await apiReq(`/presence/schedule-groups/${editingGroup.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        await refreshGroups()
        setShowGroupForm(false)
        toast.success('Groupe horaire mis à jour.')
      } else {
        await apiReq('/presence/schedule-groups', { method: 'POST', body: JSON.stringify(payload) })
        await refreshGroups()
        setShowGroupForm(false)
        toast.success('Groupe horaire créé avec succès.')
      }
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setGroupSaving(false)
    }
  }

  async function deleteGroup(g: ScheduleGroup) {
    const ok = await confirm({
      title: 'Supprimer le groupe',
      message: `Supprimer le groupe horaire « ${g.name} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    })
    if (!ok) return
    try {
      await apiReq(`/presence/schedule-groups/${g.id}`, { method: 'DELETE' })
      setGroups(prev => prev.filter(x => x.id !== g.id))
      toast.success(`Groupe « ${g.name} » supprimé.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configuration du portail</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {(['bg', 'groups', 'org'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'bg' ? 'Fond d\'écran' : t === 'groups' ? 'Groupes horaires' : 'Organisation'}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab : Fond d'écran */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'bg' && (
        <div className="space-y-6">
          <BgSection
            title="Fond de l'application"
            subtitle="Appliqué immédiatement à l'interface principale."
            current={appBg}
            onApply={applyAppBg}
            onReset={() => resetBg('app')}
          />
          <BgSection
            title="Fond de la page de connexion"
            subtitle="Affiché sur l'écran de login au prochain chargement."
            current={loginBg}
            onApply={applyLoginBg}
            onReset={() => resetBg('login')}
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab : Organisation */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'org' && (
        <div className="space-y-4">
          {/* Sous-onglets */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {(['bu', 'poles'] as const).map(st => (
              <button key={st} onClick={() => setOrgSubTab(st)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${orgSubTab === st ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {st === 'bu' ? 'Business Units' : 'Pôles'}
              </button>
            ))}
          </div>

          {/* BU */}
          {orgSubTab === 'bu' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{bus.length} BU{bus.length > 1 ? 's' : ''}</p>
                <button onClick={() => { setEditingBu(null); setBuForm(EMPTY_BU); setBuError(''); setShowBuForm(true) }} className="bg-[#F28C38] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e07d29] transition-colors">+ Nouvelle BU</button>
              </div>
              <div className="space-y-3">
                {bus.map(bu => (
                  <div key={bu.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#F28C38]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#F28C38] font-bold text-xs">{bu.code.slice(0, 4)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                        {bu.name}
                        {!bu.isActive && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Inactif</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{bu._count.users} utilisateur{bu._count.users > 1 ? 's' : ''} · {bu._count.poles} pôle{bu._count.poles > 1 ? 's' : ''}</div>
                      {bu.description && <p className="text-xs text-gray-500 mt-0.5">{bu.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleBuActive(bu)} className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${bu.isActive ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-100 text-green-600 hover:bg-green-50'}`}>{bu.isActive ? 'Désactiver' : 'Activer'}</button>
                      <button onClick={() => { setEditingBu(bu); setBuForm({ name: bu.name, code: bu.code, description: bu.description ?? '' }); setBuError(''); setShowBuForm(true) }} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Modifier</button>
                      <button onClick={() => deleteBu(bu)} disabled={bu._count.users > 0} className="text-xs border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed">Supprimer</button>
                    </div>
                  </div>
                ))}
                {bus.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Aucune Business Unit.</div>}
              </div>

              <Modal open={showBuForm} onClose={() => setShowBuForm(false)} title={editingBu ? 'Modifier la BU' : 'Nouvelle Business Unit'} subtitle={editingBu ? `Éditer « ${editingBu.name} »` : 'Créer une nouvelle unité organisationnelle'} size="md">
                <form onSubmit={handleBuSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label htmlFor="bu-name" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nom *</label><input id="bu-name" type="text" value={buForm.name} onChange={e => setBuForm({ ...buForm, name: e.target.value })} required className={INPUT} /></div>
                    <div><label htmlFor="bu-code" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Code *</label><input id="bu-code" type="text" value={buForm.code} onChange={e => setBuForm({ ...buForm, code: e.target.value.toUpperCase() })} required className={INPUT} placeholder="ex: BU_DIGITAL" /></div>
                  </div>
                  <div><label htmlFor="bu-desc" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Description</label><input id="bu-desc" type="text" value={buForm.description} onChange={e => setBuForm({ ...buForm, description: e.target.value })} className={INPUT} /></div>
                  {buError && <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">{buError}</div>}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setShowBuForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                    <button type="submit" disabled={buSaving} className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">{buSaving ? 'Enregistrement…' : editingBu ? 'Mettre à jour' : 'Créer'}</button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

          {/* Pôles */}
          {orgSubTab === 'poles' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{poles.length} pôle{poles.length > 1 ? 's' : ''}</p>
                <button onClick={() => { setEditingPole(null); setPoleForm(EMPTY_POLE); setPoleError(''); setShowPoleForm(true) }} className="bg-[#F28C38] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e07d29] transition-colors">+ Nouveau pôle</button>
              </div>
              <div className="space-y-3">
                {poles.map(pole => (
                  <div key={pole.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 font-bold text-xs">{pole.code.slice(0, 4)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                        {pole.name}
                        {!pole.isActive && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Inactif</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{pole.businessUnit?.name ?? '—'} · {pole._count.users} utilisateur{pole._count.users > 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => togglePoleActive(pole)} className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${pole.isActive ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-100 text-green-600 hover:bg-green-50'}`}>{pole.isActive ? 'Désactiver' : 'Activer'}</button>
                      <button onClick={() => { setEditingPole(pole); setPoleForm({ name: pole.name, code: pole.code, businessUnitId: pole.businessUnitId }); setPoleError(''); setShowPoleForm(true) }} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Modifier</button>
                      <button onClick={() => deletePole(pole)} disabled={pole._count.users > 0} className="text-xs border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed">Supprimer</button>
                    </div>
                  </div>
                ))}
                {poles.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Aucun pôle défini.</div>}
              </div>

              <Modal open={showPoleForm} onClose={() => setShowPoleForm(false)} title={editingPole ? 'Modifier le pôle' : 'Nouveau pôle'} subtitle={editingPole ? `Éditer « ${editingPole.name} »` : 'Créer un nouveau pôle'} size="md">
                <form onSubmit={handlePoleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label htmlFor="pole-name" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nom *</label><input id="pole-name" type="text" value={poleForm.name} onChange={e => setPoleForm({ ...poleForm, name: e.target.value })} required className={INPUT} /></div>
                    <div><label htmlFor="pole-code" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Code *</label><input id="pole-code" type="text" value={poleForm.code} onChange={e => setPoleForm({ ...poleForm, code: e.target.value.toUpperCase() })} required className={INPUT} placeholder="ex: POLE_DATA" /></div>
                  </div>
                  <div>
                    <label htmlFor="pole-bu" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Business Unit *</label>
                    <select id="pole-bu" value={poleForm.businessUnitId} onChange={e => setPoleForm({ ...poleForm, businessUnitId: e.target.value })} required className={SELECT}>
                      <option value="">Sélectionner une BU…</option>
                      {bus.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  {poleError && <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">{poleError}</div>}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setShowPoleForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                    <button type="submit" disabled={poleSaving} className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">{poleSaving ? 'Enregistrement…' : editingPole ? 'Mettre à jour' : 'Créer'}</button>
                  </div>
                </form>
              </Modal>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab : Groupes horaires */}
      {/* ------------------------------------------------------------------ */}
      {tab === 'groups' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{groups.length} groupe{groups.length > 1 ? 's' : ''}</p>
            <button
              onClick={openCreateGroup}
              className="bg-[#F28C38] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e07d29] transition-colors"
            >
              + Nouveau groupe
            </button>
          </div>

          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#F28C38]/10 flex items-center justify-center shrink-0">
                  <span className="text-[#F28C38] font-bold text-sm">{g.expectedArrivalTime}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">
                    {g.name}
                    {g.isNightShift && (
                      <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Nuit</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Code : {g.code}
                    {g.businessUnit && ` · ${g.businessUnit.name}`}
                    {` · ${g._count.users} utilisateur${g._count.users > 1 ? 's' : ''}`}
                  </div>
                  {g.description && <p className="text-xs text-gray-500 mt-1">{g.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEditGroup(g)}
                    className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => deleteGroup(g)}
                    className="text-xs border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
                Aucun groupe horaire défini.
              </div>
            )}
          </div>

          {/* Modale groupe */}
          <Modal
            open={showGroupForm}
            onClose={() => setShowGroupForm(false)}
            title={editingGroup ? 'Modifier le groupe' : 'Nouveau groupe horaire'}
            subtitle={editingGroup ? `Éditer « ${editingGroup.name} »` : 'Définir les paramètres d\'un nouveau groupe'}
            size="lg"
          >
                <form onSubmit={handleGroupSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="grp-name" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nom *</label>
                      <input id="grp-name" type="text" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} required className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="grp-code" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Code *</label>
                      <input id="grp-code" type="text" value={groupForm.code} onChange={e => setGroupForm({ ...groupForm, code: e.target.value.toUpperCase() })} required className={INPUT} placeholder="ex: GRP_MATIN" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="grp-arrival" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Heure d'arrivée attendue *</label>
                    <input id="grp-arrival" type="time" value={groupForm.expectedArrivalTime} onChange={e => setGroupForm({ ...groupForm, expectedArrivalTime: e.target.value })} required className={INPUT} />
                  </div>

                  <div>
                    <label htmlFor="grp-desc" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Description</label>
                    <input id="grp-desc" type="text" value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} className={INPUT} />
                  </div>

                  <div>
                    <label htmlFor="grp-bu" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Business Unit</label>
                    <select
                      id="grp-bu"
                      value={groupForm.businessUnitId}
                      onChange={e => setGroupForm({ ...groupForm, businessUnitId: e.target.value, poleId: '' })}
                      className={SELECT}
                    >
                      <option value="">— Toutes —</option>
                      {bus.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                    </select>
                  </div>

                  {groupForm.businessUnitId && (
                    <div>
                      <label htmlFor="grp-pole" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Pôle <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
                      </label>
                      <select
                        id="grp-pole"
                        value={groupForm.poleId}
                        onChange={e => setGroupForm({ ...groupForm, poleId: e.target.value })}
                        className={SELECT}
                      >
                        <option value="">— Tous les pôles —</option>
                        {poles.filter(p => p.businessUnitId === groupForm.businessUnitId).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={groupForm.isNightShift} onChange={e => setGroupForm({ ...groupForm, isNightShift: e.target.checked })} className="rounded border-gray-300 text-[#F28C38]" />
                    <span className="text-sm text-gray-700">Équipe de nuit</span>
                  </label>

                  {groupError && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">{groupError}</div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setShowGroupForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      Annuler
                    </button>
                    <button type="submit" disabled={groupSaving} className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                      {groupSaving ? 'Enregistrement…' : editingGroup ? 'Mettre à jour' : 'Créer'}
                    </button>
                  </div>
                </form>
          </Modal>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section fond d'écran
// ---------------------------------------------------------------------------

const ANGLES = [
  { label: '↘', value: 135 },
  { label: '→', value: 90 },
  { label: '↓', value: 180 },
  { label: '↗', value: 45 },
]

function BgSection({
  title, subtitle, current, onApply, onReset,
}: {
  title: string
  subtitle: string
  current: string
  onApply: (v: string) => void
  onReset: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [c1, setC1] = useState('#F28C38')
  const [c2, setC2] = useState('#e07d29')
  const [angle, setAngle] = useState(135)
  const [solid, setSolid] = useState(false)

  const isImage = current.startsWith('url(')
  const customValue = solid ? c1 : `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)`

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await compressImage(file)
      onApply(`url("${dataUrl}") center / cover no-repeat`)
    } catch {
      toast.error('Impossible de charger l\'image.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">

      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {current && (
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Aperçu du fond actif */}
      {current && (
        <div
          className="w-full h-16 rounded-xl flex items-center justify-center"
          style={{ background: current }}
        >
          <span className="text-white text-xs font-semibold drop-shadow bg-black/20 px-2.5 py-1 rounded-full">
            {isImage ? '📷 Image personnalisée' : 'Fond actif'}
          </span>
        </div>
      )}

      {/* ── Image de fond ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Image de fond</p>
        <label className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
          uploading
            ? 'border-gray-200 text-gray-300 cursor-not-allowed'
            : 'border-gray-200 hover:border-[#F28C38]/60 text-gray-500 hover:text-[#F28C38]'
        }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span className="text-xs font-medium flex-1">
            {uploading ? 'Compression en cours…' : isImage ? 'Remplacer l\'image' : 'Choisir une image (JPG, PNG, WebP)'}
          </span>
          {isImage && (
            <span
              role="button"
              onClick={e => { e.preventDefault(); onReset() }}
              className="text-[10px] text-red-400 hover:text-red-600 font-medium"
            >
              Retirer
            </span>
          )}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleImageUpload} />
        </label>
      </div>

      {/* ── Couleur personnalisée ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Couleur personnalisée</p>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setSolid(false)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${!solid ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
            >
              Dégradé
            </button>
            <button
              onClick={() => setSolid(true)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${solid ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
            >
              Uni
            </button>
          </div>
        </div>

        {/* Aperçu live */}
        <div className="w-full h-12 rounded-xl mb-3" style={{ background: customValue }} />

        <div className="flex items-end gap-3">
          {/* Couleur 1 */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-medium">{solid ? 'Couleur' : 'Couleur 1'}</span>
            <label className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-[#F28C38] transition-colors">
              <input type="color" value={c1} onChange={e => setC1(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="w-full h-full rounded-lg" style={{ background: c1 }} />
            </label>
          </div>

          {/* Couleur 2 (gradient only) */}
          {!solid && (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-medium">Couleur 2</span>
              <label className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-[#F28C38] transition-colors">
                <input type="color" value={c2} onChange={e => setC2(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-full h-full rounded-lg" style={{ background: c2 }} />
              </label>
            </div>
          )}

          {/* Direction (gradient only) */}
          {!solid && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-gray-400 font-medium">Direction</span>
              <div className="flex gap-1">
                {ANGLES.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setAngle(a.value)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                      angle === a.value ? 'bg-[#F28C38] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => onApply(customValue)}
            className="ml-auto px-4 py-2 bg-[#F28C38] hover:bg-[#e07d29] text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Appliquer
          </button>
        </div>
      </div>

      {/* ── Palettes prédéfinies ── */}
      <div className="space-y-4">
        {BG_GRADIENTS.map(group => (
          <div key={group.category}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">{group.category}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {group.items.map(bg => (
                <button
                  key={bg.value}
                  onClick={() => onApply(bg.value)}
                  title={bg.label}
                  style={{ background: bg.value }}
                  className={`relative h-14 rounded-xl transition-all ${
                    current === bg.value ? 'ring-2 ring-[#F28C38] ring-offset-2 scale-[0.94]' : 'hover:scale-[0.96]'
                  }`}
                >
                  <span className="absolute inset-0 flex items-end justify-start p-1.5">
                    <span className="text-white text-[10px] font-semibold drop-shadow leading-tight">{bg.label}</span>
                  </span>
                  {current === bg.value && (
                    <span className="absolute top-1 right-1 bg-white/30 rounded-full w-4 h-4 flex items-center justify-center text-white text-[9px]">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
