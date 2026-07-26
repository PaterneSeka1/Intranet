'use client'

import { useState } from 'react'
import { type Tab, type CreateTabPayload, type UpdateTabPayload, tabsApi } from '@/lib/tabs'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { Modal } from '@/components/ui/Modal'

type BuOption = { id: string; name: string; code: string }

interface Props {
  initialTabs: Tab[]
  userRole: string
  userBuId?: string | null
  buList: BuOption[]
  canManageAll: boolean
}

const ICON_PRESETS = [
  '📰',
  '🔔',
  '▶️',
  '✖️',
  '📘',
  '💼',
  '📁',
  '✉️',
  '📋',
  '📝',
  '📊',
  '🐙',
  '▲',
  '☁️',
  '📗',
  '🔗',
]

const IMAGE_ICON_SIZE = 128
const MAX_ICON_FILE_SIZE = 2 * 1024 * 1024

type FormData = {
  name: string
  url: string
  description: string
  icon: string
  color: string
  businessUnitId: string // '' = global tab
}

const EMPTY_FORM: FormData = {
  name: '',
  url: '',
  description: '',
  icon: '🔗',
  color: '#F28C38',
  businessUnitId: '',
}

const GLOBAL_TAB_MANAGERS = ['CTO_ADMIN', 'PDG']
const BU_TAB_MANAGERS = ['DAF', 'RESPONSABLE_BU']

function isImageIcon(value?: string | null) {
  return !!value && (/^data:image\//.test(value) || /^https?:\/\//.test(value))
}

function resizeIconImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Le fichier choisi doit être une image.'))
  }
  if (file.size > MAX_ICON_FILE_SIZE) {
    return Promise.reject(new Error('Image trop lourde : limite 2 Mo.'))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Impossible de lire l'image."))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("Impossible de charger l'image."))
      img.onload = () => {
        const scale = Math.min(IMAGE_ICON_SIZE / img.width, IMAGE_ICON_SIZE / img.height, 1)
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error("Impossible de préparer l'image."))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const webp = canvas.toDataURL('image/webp', 0.9)
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function TabIcon({
  value,
  className = 'w-8 h-8',
  imageClassName = 'rounded-lg',
}: {
  value?: string | null
  className?: string
  imageClassName?: string
}) {
  if (isImageIcon(value)) {
    return (
      <span
        className={`${className} inline-flex shrink-0 items-center justify-center overflow-hidden`}
      >
        <img
          src={value ?? ''}
          alt=""
          className={`w-full h-full object-contain ${imageClassName}`}
        />
      </span>
    )
  }

  return (
    <span className={`${className} inline-flex shrink-0 items-center justify-center text-2xl`}>
      {value || '🔗'}
    </span>
  )
}

export function TabsManager({ initialTabs, userRole, userBuId, buList, canManageAll }: Props) {
  const [tabs, setTabs] = useState<Tab[]>(initialTabs)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; tab?: Tab } | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [iconProcessing, setIconProcessing] = useState(false)
  const [filterBu, setFilterBu] = useState<string>('')
  const [search, setSearch] = useState('')

  const canManage = (tab: Tab) => {
    if (GLOBAL_TAB_MANAGERS.includes(userRole)) return true
    if (tab.businessUnitId === null) return false
    return BU_TAB_MANAGERS.includes(userRole) && tab.businessUnitId === userBuId
  }

  const canCreateTabs = canManageAll || (BU_TAB_MANAGERS.includes(userRole) && !!userBuId)

  function openCreate() {
    setForm({ ...EMPTY_FORM, businessUnitId: canManageAll ? '' : (userBuId ?? '') })
    setError('')
    setModal({ mode: 'create' })
  }

  function openEdit(tab: Tab) {
    setForm({
      name: tab.name,
      url: tab.url,
      description: tab.description ?? '',
      icon: tab.icon ?? '🔗',
      color: tab.color ?? '#F28C38',
      businessUnitId: tab.businessUnitId ?? '',
    })
    setError('')
    setModal({ mode: 'edit', tab })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (modal?.mode === 'create') {
        const payload: CreateTabPayload = {
          name: form.name,
          url: form.url,
          description: form.description || undefined,
          icon: form.icon || undefined,
          color: form.color || undefined,
          // '' means global: omit businessUnitId so API treats it as null
          businessUnitId: canManageAll ? form.businessUnitId || undefined : undefined,
        }
        const created = await tabsApi.create(payload)
        setTabs((prev) => [...prev, created])
        setModal(null)
        toast.success('Onglet créé avec succès.')
      } else if (modal?.mode === 'edit' && modal.tab) {
        const payload: UpdateTabPayload = {
          name: form.name,
          url: form.url,
          description: form.description || undefined,
          icon: form.icon || undefined,
          color: form.color || undefined,
        }
        const updated = await tabsApi.update(modal.tab.id, payload)
        setTabs((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        setModal(null)
        toast.success('Onglet mis à jour.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleIconImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setIconProcessing(true)
    try {
      const icon = await resizeIconImage(file)
      setForm((f) => ({ ...f, icon }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'utiliser cette image.")
    } finally {
      setIconProcessing(false)
    }
  }

  async function toggleActive(tab: Tab) {
    try {
      const updated = await tabsApi.update(tab.id, { isActive: !tab.isActive })
      setTabs((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      toast.info(
        updated.isActive ? `Onglet « ${tab.name} » activé.` : `Onglet « ${tab.name} » désactivé.`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.')
    }
  }

  async function handleDelete(tab: Tab) {
    const ok = await confirm({
      title: "Supprimer l'onglet",
      message: `Supprimer l'onglet « ${tab.name} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    })
    if (!ok) return
    try {
      await tabsApi.remove(tab.id)
      setTabs((prev) => prev.filter((t) => t.id !== tab.id))
      toast.success(`Onglet « ${tab.name} » supprimé.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  const filtered = tabs.filter((t) => {
    if (filterBu === '__global__') {
      if (t.businessUnitId !== null) return false
    } else if (filterBu) {
      if (t.businessUnitId !== filterBu) return false
    }
    if (
      search &&
      !t.name.toLowerCase().includes(search.toLowerCase()) &&
      !t.url.toLowerCase().includes(search.toLowerCase())
    )
      return false
    return true
  })
  const iconIsDataImage = form.icon.startsWith('data:image/')

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Rechercher un onglet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300 w-56"
          />
          {canManageAll && (
            <select
              value={filterBu}
              onChange={(e) => setFilterBu(e.target.value)}
              className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] text-gray-700"
            >
              <option value="">Toutes les BU</option>
              <option value="__global__">Onglets globaux</option>
              {buList.map((bu) => (
                <option key={bu.id} value={bu.id}>
                  {bu.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {canCreateTabs && (
          <button
            onClick={openCreate}
            className="bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
          >
            + Nouvel onglet
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Aucun onglet trouvé</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((tab) => (
            <div
              key={tab.id}
              style={tab.color ? { borderBottom: `3px solid ${tab.color}` } : undefined}
              className={`bg-white rounded-2xl border p-4 flex flex-col gap-2 transition-all ${tab.isActive ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <TabIcon value={tab.icon} className="w-8 h-8" />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-sm truncate">{tab.name}</div>
                    {tab.businessUnit ? (
                      <div className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                        {tab.businessUnit.code}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#F28C38] bg-[#F28C38]/10 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                        Global
                      </div>
                    )}
                  </div>
                </div>
                {canManage(tab) && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(tab)}
                      className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors text-xs"
                      title={tab.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {tab.isActive ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => openEdit(tab)}
                      className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-[#F28C38] transition-colors text-xs"
                      title="Modifier"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(tab)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors text-xs"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {tab.description && (
                <p className="text-xs text-gray-500 line-clamp-2">{tab.description}</p>
              )}

              <a
                href={tab.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto text-xs text-[#F28C38] hover:underline truncate block"
              >
                {tab.url}
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Modale création / édition */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nouvel onglet' : `Modifier — ${modal?.tab?.name ?? ''}`}
        subtitle={
          modal?.mode === 'create'
            ? 'Ajouter un onglet à la bibliothèque'
            : 'Mettre à jour les informations de cet onglet'
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {canManageAll && modal?.mode === 'create' && (
            <div>
              <label
                htmlFor="tab-bu"
                className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
              >
                Audience
              </label>
              <select
                id="tab-bu"
                value={form.businessUnitId}
                onChange={(e) => setForm((f) => ({ ...f, businessUnitId: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
              >
                <option value="">Tous les utilisateurs (Global)</option>
                {buList.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name}
                  </option>
                ))}
              </select>
              {form.businessUnitId === '' && (
                <p className="text-[11px] text-[#F28C38] mt-1.5">
                  Cet onglet sera visible par tous les utilisateurs sans exception.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="tab-name"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Nom
            </label>
            <input
              id="tab-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300"
              placeholder="Ex : Google News"
              required
            />
          </div>

          <div>
            <label
              htmlFor="tab-url"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              URL
            </label>
            <input
              id="tab-url"
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300"
              placeholder="https://…"
              required
            />
          </div>

          <div>
            <label
              htmlFor="tab-desc"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Description <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
            </label>
            <input
              id="tab-desc"
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300"
              placeholder="Courte description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tab-icon"
                className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide"
              >
                Icône
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ICON_PRESETS.map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, icon: ico }))}
                    className={`text-xl w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${form.icon === ico ? 'bg-[#F28C38]/10 ring-1 ring-[#F28C38]' : 'hover:bg-gray-100'}`}
                  >
                    {ico}
                  </button>
                ))}
                <label
                  htmlFor="tab-icon-image"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs font-semibold cursor-pointer transition-colors ${
                    isImageIcon(form.icon)
                      ? 'bg-[#F28C38]/10 ring-1 ring-[#F28C38] border-[#F28C38]/30 text-[#F28C38]'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                  title="Choisir une image"
                >
                  {iconProcessing ? '…' : 'IMG'}
                </label>
                <input
                  id="tab-icon-image"
                  type="file"
                  accept="image/*"
                  onChange={handleIconImageChange}
                  className="sr-only"
                />
              </div>
              <div className="mb-2 flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                  <TabIcon value={form.icon} className="w-8 h-8" />
                </div>
                <div className="text-[11px] text-gray-400 leading-snug">
                  {isImageIcon(form.icon)
                    ? 'Image redimensionnée automatiquement.'
                    : 'Emoji, symbole ou image.'}
                </div>
              </div>
              <input
                id="tab-icon"
                type="text"
                value={iconIsDataImage ? 'Image sélectionnée' : form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                disabled={iconIsDataImage}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                maxLength={100000}
                placeholder="Emoji ou URL image"
              />
              {iconIsDataImage && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: '🔗' }))}
                  className="mt-1.5 text-[11px] font-semibold text-gray-400 hover:text-red-500"
                >
                  Retirer l'image
                </button>
              )}
            </div>
            <div>
              <label
                htmlFor="tab-color"
                className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide"
              >
                Couleur
              </label>
              <input
                id="tab-color"
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-full h-10 border border-gray-200 rounded-xl cursor-pointer p-1"
              />
              <div className="text-xs text-gray-400 mt-1 text-center">{form.color}</div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || iconProcessing}
              className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {submitting || iconProcessing
                ? 'Enregistrement…'
                : modal?.mode === 'create'
                  ? 'Créer'
                  : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
