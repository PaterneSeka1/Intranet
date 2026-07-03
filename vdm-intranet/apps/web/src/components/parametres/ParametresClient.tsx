'use client'

import { useState, useRef } from 'react'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { Modal } from '@/components/ui/Modal'

import { API_BASE as API } from '@/lib/api-base'
import { saveSettings, deleteSetting } from '@/lib/settings'

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
  initialSettings?: Record<string, string>
}

const EMPTY_BU: BuForm = { name: '', code: '', description: '' }
const EMPTY_POLE: PoleForm = { name: '', code: '', businessUnitId: '' }

export function ParametresClient({ initialGroups, buList: initialBuList, initialPoles = [], initialSettings = {} }: Props) {
  const [tab, setTab] = useState<'bg' | 'groups' | 'org'>('bg')

  // --- Fond d'écran ---
  const [appBg, setAppBg] = useState(initialSettings['vdm_app_bg'] ?? '')
  const [loginBg, setLoginBg] = useState(initialSettings['vdm_login_bg'] ?? '')

  async function applyAppBg(value: string) {
    setAppBg(value)
    document.documentElement.style.setProperty('--vdm-app-bg', value)
    try {
      await saveSettings([{ key: 'vdm_app_bg', value }])
      toast.success('Fond d\'écran principal appliqué pour tous les utilisateurs.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
    }
  }

  async function applyLoginBg(value: string) {
    setLoginBg(value)
    if (!value.startsWith('url(')) {
      document.documentElement.style.setProperty('--vdm-sidebar-bg', value)
    }
    try {
      await saveSettings([{ key: 'vdm_login_bg', value }])
      toast.success(value.startsWith('url(') ? 'Image de connexion appliquée pour tous.' : 'Fond de connexion et sidebar appliqués pour tous.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
    }
  }

  async function resetBg(target: 'app' | 'login') {
    if (target === 'app') {
      setAppBg('')
      try { await deleteSetting('vdm_app_bg') } catch {}
      document.documentElement.style.setProperty('--vdm-app-bg', '#f4f4f6')
      toast.info('Fond d\'écran principal réinitialisé pour tous.')
    } else {
      setLoginBg('')
      try { await deleteSetting('vdm_login_bg') } catch {}
      document.documentElement.style.setProperty('--vdm-sidebar-bg', '#111827')
      toast.info('Fond de connexion et sidebar réinitialisés pour tous.')
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
        <BgPanel
          appBg={appBg}
          loginBg={loginBg}
          onApplyApp={applyAppBg}
          onApplyLogin={applyLoginBg}
          onResetApp={() => resetBg('app')}
          onResetLogin={() => resetBg('login')}
          initialSettings={initialSettings}
        />
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
                      <button onClick={() => deleteBu(bu)} disabled={bu._count.users > 0 || (bu._count.poles ?? 0) > 0} title={(bu._count.users > 0 || (bu._count.poles ?? 0) > 0) ? 'Impossible de supprimer — utilisateurs ou pôles rattachés' : undefined} className="text-xs border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed">Supprimer</button>
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
              <PolesSection
                poles={poles}
                bus={bus}
                onAdd={() => { setEditingPole(null); setPoleForm(EMPTY_POLE); setPoleError(''); setShowPoleForm(true) }}
                onEdit={pole => { setEditingPole(pole); setPoleForm({ name: pole.name, code: pole.code, businessUnitId: pole.businessUnitId }); setPoleError(''); setShowPoleForm(true) }}
                onToggle={togglePoleActive}
                onDelete={deletePole}
              />

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
          <GroupsSection
            groups={groups}
            bus={bus}
            poles={poles}
            onOpenCreate={openCreateGroup}
            onOpenEdit={openEditGroup}
            onDelete={deleteGroup}
          />

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
// Panneau fond d'écran unifié
// ---------------------------------------------------------------------------

const ANGLES = [
  { label: '↘', value: 135 },
  { label: '→', value: 90 },
  { label: '↓', value: 180 },
  { label: '↗', value: 45 },
]

const TEXT_PRESETS = [
  { label: 'Blanc pur',   value: '#ffffff' },
  { label: 'Blanc cassé', value: '#f8fafc' },
  { label: 'Gris clair',  value: '#cbd5e1' },
  { label: 'Crème',       value: '#fef3c7' },
  { label: 'Bleu clair',  value: '#bfdbfe' },
  { label: 'Vert clair',  value: '#bbf7d0' },
  { label: 'Orange clair',value: '#fed7aa' },
  { label: 'Gris foncé',  value: '#374151' },
]

const HOVER_PRESETS = [
  { label: 'Blanc subtil',  value: 'rgba(255,255,255,0.08)' },
  { label: 'Blanc léger',   value: 'rgba(255,255,255,0.15)' },
  { label: 'Blanc marqué',  value: 'rgba(255,255,255,0.25)' },
  { label: 'Orange VDM',    value: 'rgba(242,140,56,0.22)' },
  { label: 'Noir subtil',   value: 'rgba(0,0,0,0.15)' },
  { label: 'Aucun',         value: 'rgba(0,0,0,0)' },
]

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

function BgPanel({
  appBg, loginBg, onApplyApp, onApplyLogin, onResetApp, onResetLogin, initialSettings,
}: {
  appBg: string
  loginBg: string
  onApplyApp: (v: string) => void
  onApplyLogin: (v: string) => void
  onResetApp: () => void
  onResetLogin: () => void
  initialSettings: Record<string, string>
}) {
  const [target, setTarget] = useState<'app' | 'login'>('app')
  const [showCustom, setShowCustom] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [c1, setC1] = useState('#F28C38')
  const [c2, setC2] = useState('#e07d29')
  const [angle, setAngle] = useState(135)
  const [solid, setSolid] = useState(false)

  const [sidebarActive, setSidebarActive] = useState(initialSettings['vdm_sidebar_active'] ?? '#f28c38')
  const [sidebarText, setSidebarText] = useState(initialSettings['vdm_sidebar_text'] ?? '#ffffff')
  const [sidebarHover, setSidebarHover] = useState(initialSettings['vdm_sidebar_hover'] ?? 'rgba(255,255,255,0.1)')
  const [hoverColor, setHoverColor] = useState('#ffffff')
  const [hoverOpacity, setHoverOpacity] = useState(10)

  const [bgImage, setBgImage] = useState(initialSettings['vdm_bg_image'] ?? '')
  const [bgImageOpacity, setBgImageOpacity] = useState(initialSettings['vdm_bg_image_opacity'] ? Math.round(Number(initialSettings['vdm_bg_image_opacity']) * 100) : 30)

  const saveDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function debouncedSave(key: string, value: string) {
    clearTimeout(saveDebounce.current[key])
    saveDebounce.current[key] = setTimeout(() => saveSettings([{ key, value }]).catch(() => {}), 600)
  }

  function applySidebarActive(value: string) {
    setSidebarActive(value)
    document.documentElement.style.setProperty('--vdm-sidebar-active', value)
    debouncedSave('vdm_sidebar_active', value)
  }

  function applySidebarText(value: string) {
    setSidebarText(value)
    document.documentElement.style.setProperty('--vdm-sidebar-text', value)
    debouncedSave('vdm_sidebar_text', value)
  }

  function applyHover(value: string) {
    setSidebarHover(value)
    document.documentElement.style.setProperty('--vdm-sidebar-hover', value)
    debouncedSave('vdm_sidebar_hover', value)
  }

  function applyCustomHover() {
    applyHover(`rgba(${hexToRgb(hoverColor)},${(hoverOpacity / 100).toFixed(2)})`)
  }

  function applyImageOpacity(value: number) {
    setBgImageOpacity(value)
    const opacity = (value / 100).toFixed(2)
    document.documentElement.style.setProperty('--vdm-bg-image-opacity', opacity)
    debouncedSave('vdm_bg_image_opacity', opacity)
  }

  function removeImage() {
    setBgImage('')
    document.documentElement.style.setProperty('--vdm-bg-image', 'none')
    document.documentElement.style.setProperty('--vdm-bg-image-opacity', '0')
    deleteSetting('vdm_bg_image').catch(() => {})
    deleteSetting('vdm_bg_image_opacity').catch(() => {})
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await compressImage(file)
      setBgImage(dataUrl)
      const opacity = (bgImageOpacity / 100).toFixed(2)
      document.documentElement.style.setProperty('--vdm-bg-image', `url("${dataUrl}")`)
      document.documentElement.style.setProperty('--vdm-bg-image-opacity', opacity)
      try {
        await saveSettings([
          { key: 'vdm_bg_image', value: dataUrl },
          { key: 'vdm_bg_image_opacity', value: opacity },
        ])
        toast.success('Image de fond appliquée pour tous les utilisateurs.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
      }
    } catch {
      toast.error('Impossible de charger l\'image.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const current = target === 'app' ? appBg : loginBg
  const onApply = target === 'app' ? onApplyApp : onApplyLogin
  const onReset = target === 'app' ? onResetApp : onResetLogin
  const customValue = solid ? c1 : `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)`

  return (
    <div className="space-y-4">

      {/* Sélecteur de cible + aperçus */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { key: 'app' as const, label: 'Application', desc: 'Interface principale', bg: appBg, onReset: onResetApp },
          { key: 'login' as const, label: 'Connexion & Sidebar', desc: 'Page de login · Navigation', bg: loginBg, onReset: onResetLogin },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTarget(t.key)}
            className={`relative rounded-2xl overflow-hidden border-2 transition-all text-left ${
              target === t.key ? 'border-[#F28C38]' : 'border-gray-100 hover:border-gray-200'
            }`}
          >
            {/* Bande de couleur */}
            <div
              className="h-16 w-full"
              style={{ background: t.bg || '#f4f4f6' }}
            />
            {/* Infos */}
            <div className="bg-white px-3 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-900">{t.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{t.desc}</div>
              </div>
              <div className="flex items-center gap-2">
                {t.bg && (
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); t.onReset() }}
                    className="text-[10px] text-gray-300 hover:text-red-400 transition-colors font-medium"
                  >
                    Réinit.
                  </span>
                )}
                <div className={`w-2 h-2 rounded-full ${target === t.key ? 'bg-[#F28C38]' : 'bg-gray-200'}`} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Panneau de sélection */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">

        {/* Image overlay — uniquement pour l'application */}
        {target === 'app' && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Image de fond</p>
            {bgImage ? (
              <div className="space-y-3">
                {/* Prévisualisation */}
                <div className="relative rounded-xl overflow-hidden h-24 border border-gray-100">
                  <img src={bgImage} alt="" className="w-full h-full object-cover" style={{ opacity: bgImageOpacity / 100 }} />
                  <div className="absolute inset-0" style={{ background: 'var(--vdm-app-bg)' }} />
                  <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-normal" style={{ opacity: bgImageOpacity / 100 }} />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
                  >
                    Retirer
                  </button>
                </div>
                {/* Opacité */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-[10px] text-gray-500 font-medium shrink-0">Opacité</span>
                  <input
                    type="range" min="5" max="100" value={bgImageOpacity}
                    onChange={e => applyImageOpacity(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full accent-[#F28C38]"
                  />
                  <span className="text-[10px] font-semibold text-gray-700 w-8 text-right">{bgImageOpacity}%</span>
                </div>
                {/* Remplacer */}
                <label className="flex items-center gap-2 text-[10px] text-gray-400 hover:text-[#F28C38] cursor-pointer transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {uploading ? 'Compression…' : 'Remplacer l\'image'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleImageUpload} />
                </label>
              </div>
            ) : (
              <label className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-dashed cursor-pointer transition-colors ${
                uploading ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-200 hover:border-[#F28C38]/60 text-gray-500 hover:text-[#F28C38]'
              }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span className="text-xs font-medium flex-1">
                  {uploading ? 'Compression…' : 'Choisir une image (JPG, PNG, WebP)'}
                </span>
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleImageUpload} />
              </label>
            )}
          </div>
        )}

        {/* Couleur active + survol — sidebar seulement */}
        {target === 'login' && (
          <div className="space-y-5">

          {/* Lien actif */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Couleur du lien actif</p>
            <div className="flex items-center gap-3">
              <label className="relative w-9 h-9 rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-[#F28C38] transition-colors shrink-0">
                <input type="color" value={sidebarActive} onChange={e => applySidebarActive(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-full h-full" style={{ background: sidebarActive }} />
              </label>
              <span className="text-xs font-mono text-gray-500 flex-1">{sidebarActive}</span>
              <button onClick={() => applySidebarActive('#f28c38')} className="text-[10px] text-gray-400 hover:text-red-400 transition-colors">Réinit.</button>
            </div>
            <div className="mt-2 rounded-xl overflow-hidden border border-gray-100" style={{ background: 'var(--vdm-sidebar-bg, #111827)' }}>
              <div className="px-3 py-2 text-xs text-white/40">Accueil</div>
              <div className="px-3 py-2 text-xs text-white font-semibold" style={{ background: 'var(--vdm-sidebar-active)' }}>Utilisateurs (actif)</div>
              <div className="px-3 py-2 text-xs text-white/40">Présences</div>
            </div>
          </div>

          {/* Texte */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Couleur du texte</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TEXT_PRESETS.map(t => (
                <button
                  key={t.value}
                  onClick={() => applySidebarText(t.value)}
                  title={t.label}
                  style={{ background: t.value, border: sidebarText === t.value ? '2px solid #F28C38' : '2px solid #e5e7eb' }}
                  className="w-7 h-7 rounded-lg transition-all hover:scale-110"
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="relative w-9 h-9 rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-[#F28C38] transition-colors shrink-0">
                <input type="color" value={sidebarText} onChange={e => applySidebarText(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-full h-full" style={{ background: sidebarText }} />
              </label>
              <span className="text-xs font-mono text-gray-500 flex-1">{sidebarText}</span>
              <button onClick={() => applySidebarText('#ffffff')} className="text-[10px] text-gray-400 hover:text-red-400 transition-colors">Réinit.</button>
            </div>
            <div className="mt-2 rounded-xl overflow-hidden border border-gray-100" style={{ background: 'var(--vdm-sidebar-bg, #111827)' }}>
              <div className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--vdm-sidebar-text)' }}>Accueil (actif)</div>
              <div className="px-3 py-2 text-xs" style={{ color: `color-mix(in srgb, ${sidebarText} 50%, transparent)` }}>Utilisateurs</div>
              <div className="px-3 py-2 text-xs" style={{ color: `color-mix(in srgb, ${sidebarText} 40%, transparent)` }}>Veilleur des Médias</div>
            </div>
          </div>

          {/* Survol */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Couleur de survol</p>

            {/* Aperçu simulé */}
            <div className="rounded-xl overflow-hidden mb-3 border border-gray-100" style={{ background: 'var(--vdm-sidebar-bg, #111827)' }}>
              <div className="px-3 py-2 text-xs text-white/40">Accueil</div>
              <div className="px-3 py-2 text-xs text-white transition-colors" style={{ background: 'var(--vdm-sidebar-hover)' }}>Utilisateurs (survolé)</div>
              <div className="px-3 py-2 text-xs text-white/40">Présences</div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {HOVER_PRESETS.map(h => (
                <button
                  key={h.value}
                  onClick={() => applyHover(h.value)}
                  title={h.label}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                    sidebarHover === h.value
                      ? 'border-[#F28C38] bg-[#F28C38]/10 text-[#F28C38]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            {/* Personnalisé */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-400">Couleur</span>
                <label className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-[#F28C38] transition-colors">
                  <input type="color" value={hoverColor} onChange={e => setHoverColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="w-full h-full" style={{ background: hoverColor }} />
                </label>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400">Opacité</span>
                  <span className="text-[10px] font-medium text-gray-600">{hoverOpacity}%</span>
                </div>
                <input
                  type="range" min="0" max="40" value={hoverOpacity}
                  onChange={e => setHoverOpacity(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full accent-[#F28C38]"
                />
              </div>
              <button
                onClick={applyCustomHover}
                className="px-3 py-1.5 bg-[#F28C38] hover:bg-[#e07d29] text-white text-[10px] font-semibold rounded-lg transition-colors"
              >
                Appliquer
              </button>
            </div>
          </div>

          </div>
        )}

        {/* Couleur personnalisée (escamotable) */}
        <div>
          <button
            onClick={() => setShowCustom(v => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Couleur personnalisée</p>
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`text-gray-300 transition-transform ${showCustom ? 'rotate-180' : ''}`}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {showCustom && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setSolid(false)} className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${!solid ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>Dégradé</button>
                  <button onClick={() => setSolid(true)} className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${solid ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>Uni</button>
                </div>
              </div>
              <div className="h-9 rounded-xl" style={{ background: customValue }} />
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400">{solid ? 'Couleur' : 'C1'}</span>
                  <label className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-[#F28C38] transition-colors">
                    <input type="color" value={c1} onChange={e => setC1(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="w-full h-full" style={{ background: c1 }} />
                  </label>
                </div>
                {!solid && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-400">C2</span>
                    <label className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-[#F28C38] transition-colors">
                      <input type="color" value={c2} onChange={e => setC2(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="w-full h-full" style={{ background: c2 }} />
                    </label>
                  </div>
                )}
                {!solid && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400">Direction</span>
                    <div className="flex gap-1">
                      {ANGLES.map(a => (
                        <button key={a.value} onClick={() => setAngle(a.value)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${angle === a.value ? 'bg-[#F28C38] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{a.label}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => onApply(customValue)} className="ml-auto px-4 py-1.5 bg-[#F28C38] hover:bg-[#e07d29] text-white text-xs font-semibold rounded-xl transition-colors">
                  Appliquer
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Palette prédéfinie — une seule fois */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Palettes</p>
          {BG_GRADIENTS.map(group => (
            <div key={group.category}>
              <p className="text-[10px] text-gray-300 font-medium mb-1.5">{group.category}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {group.items.map(bg => (
                  <button
                    key={bg.value}
                    onClick={() => onApply(bg.value)}
                    title={bg.label}
                    style={{ background: bg.value }}
                    className={`relative h-10 rounded-xl transition-all ${
                      current === bg.value ? 'ring-2 ring-[#F28C38] ring-offset-1 scale-[0.93]' : 'hover:scale-[0.96]'
                    }`}
                  >
                    <span className="absolute inset-0 flex items-end p-1">
                      <span className="text-white text-[9px] font-semibold drop-shadow leading-tight line-clamp-1">{bg.label}</span>
                    </span>
                    {current === bg.value && (
                      <span className="absolute top-0.5 right-0.5 bg-white/30 rounded-full w-3.5 h-3.5 flex items-center justify-center text-white text-[8px]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Groupes horaires — section refactorisée
// ---------------------------------------------------------------------------

type BuMin = { id: string; name: string; code: string }
type PoleMin = { id: string; name: string; code: string; businessUnitId: string }

function GroupsSection({
  groups, bus, poles, onOpenCreate, onOpenEdit, onDelete,
}: {
  groups: ScheduleGroup[]
  bus: BuMin[]
  poles: PoleMin[]
  onOpenCreate: () => void
  onOpenEdit: (g: ScheduleGroup) => void
  onDelete: (g: ScheduleGroup) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filterBu, setFilterBu] = useState('')

  const filtered = groups.filter(g => {
    if (filterBu && g.businessUnitId !== filterBu) return false
    if (search) {
      const q = search.toLowerCase()
      return g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div>
      {/* Barre d'outils */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Rechercher un groupe…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300 w-52"
          />
          {bus.length > 0 && (
            <select
              value={filterBu}
              onChange={e => setFilterBu(e.target.value)}
              className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] bg-white"
            >
              <option value="">Toutes les BU</option>
              {bus.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <span className="self-center text-sm text-gray-400">{filtered.length} groupe{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={onOpenCreate} className="bg-[#F28C38] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e07d29] transition-colors shrink-0">
          + Nouveau groupe
        </button>
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map(g => {
          const isNight = g.isNightShift
          const pole = poles.find(p => p.id === g.poleId)
          return (
            <div
              key={g.id}
              className={`rounded-2xl border p-4 flex items-center gap-4 transition-all ${
                isNight
                  ? 'bg-indigo-950/5 border-indigo-100'
                  : 'bg-white border-gray-100'
              }`}
            >
              {/* Horloge */}
              <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${isNight ? 'bg-indigo-100' : 'bg-[#F28C38]/10'}`}>
                <span className={`font-bold text-sm leading-tight ${isNight ? 'text-indigo-700' : 'text-[#F28C38]'}`}>{g.expectedArrivalTime}</span>
                <span className={`text-[9px] font-medium mt-0.5 ${isNight ? 'text-indigo-400' : 'text-[#F28C38]/60'}`}>{isNight ? '🌙 Nuit' : '☀️ Jour'}</span>
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{g.name}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 font-mono px-1.5 py-0.5 rounded-md">{g.code}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {g.businessUnit && (
                    <span className="text-[10px] bg-[#F28C38]/10 text-[#F28C38] px-2 py-0.5 rounded-full font-medium">{g.businessUnit.name}</span>
                  )}
                  {pole && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{pole.name}</span>
                  )}
                  {!g.businessUnit && !pole && (
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Global</span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {g._count.users} utilisateur{g._count.users !== 1 ? 's' : ''}
                  </span>
                </div>
                {g.description && <p className="text-xs text-gray-400 mt-1 truncate">{g.description}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <button onClick={() => onOpenEdit(g)} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Modifier</button>
                <button
                  onClick={() => onDelete(g)}
                  disabled={g._count.users > 0}
                  title={g._count.users > 0 ? `${g._count.users} utilisateur(s) assigné(s)` : undefined}
                  className="text-xs border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
            {search || filterBu ? 'Aucun groupe correspondant.' : 'Aucun groupe horaire défini.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pôles — section refactorisée
// ---------------------------------------------------------------------------

function PolesSection({
  poles, bus, onAdd, onEdit, onToggle, onDelete,
}: {
  poles: Pole[]
  bus: BuMin[]
  onAdd: () => void
  onEdit: (p: Pole) => void
  onToggle: (p: Pole) => Promise<void>
  onDelete: (p: Pole) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filterBu, setFilterBu] = useState('')

  const filtered = poles.filter(p => {
    if (filterBu && p.businessUnitId !== filterBu) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    }
    return true
  })

  const totalUsers = poles.reduce((acc, p) => acc + p._count.users, 0)

  return (
    <div>
      {/* Barre d'outils */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Rechercher un pôle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300 w-52"
          />
          {bus.length > 0 && (
            <select
              value={filterBu}
              onChange={e => setFilterBu(e.target.value)}
              className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] bg-white"
            >
              <option value="">Toutes les BU</option>
              {bus.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <span className="self-center text-sm text-gray-400">
            {filtered.length} pôle{filtered.length !== 1 ? 's' : ''} · {totalUsers} membre{totalUsers !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onAdd} className="bg-[#F28C38] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e07d29] transition-colors shrink-0">
          + Nouveau pôle
        </button>
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map(pole => (
          <div key={pole.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <span className="text-blue-600 font-bold text-[10px]">{pole.code.slice(0, 5)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{pole.name}</span>
                {!pole.isActive && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Inactif</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {pole.businessUnit && (
                  <span className="text-[10px] bg-[#F28C38]/10 text-[#F28C38] px-2 py-0.5 rounded-full font-medium">{pole.businessUnit.name}</span>
                )}
                <span className="text-[10px] text-gray-400">
                  {pole._count.users} utilisateur{pole._count.users !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => onToggle(pole)} className={`text-xs border px-3 py-1.5 rounded-lg transition-colors ${pole.isActive ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-100 text-green-600 hover:bg-green-50'}`}>
                {pole.isActive ? 'Désactiver' : 'Activer'}
              </button>
              <button onClick={() => onEdit(pole)} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Modifier</button>
              <button
                onClick={() => onDelete(pole)}
                disabled={pole._count.users > 0}
                title={pole._count.users > 0 ? `${pole._count.users} utilisateur(s) assigné(s)` : undefined}
                className="text-xs border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
            {search || filterBu ? 'Aucun pôle correspondant.' : 'Aucun pôle défini.'}
          </div>
        )}
      </div>
    </div>
  )
}
