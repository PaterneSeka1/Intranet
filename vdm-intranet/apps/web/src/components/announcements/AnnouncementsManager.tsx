'use client'

import { useState, useMemo } from 'react'
import { announcementsApi, type Announcement } from '@/lib/announcements'
import { ServerPagination } from '@/components/ui/DataTable'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { Modal } from '@/components/ui/Modal'

const PAGE_SIZE = 10

type Bu = { id: string; name: string; code: string }

interface Props {
  initialAnnouncements: Announcement[]
  buList: Bu[]
}

type FormData = {
  title: string
  body: string
  businessUnitId: string
  isPinned: boolean
  isActive: boolean
  publishedAt: string
  expiresAt: string
}

const EMPTY_FORM: FormData = {
  title: '',
  body: '',
  businessUnitId: '',
  isPinned: false,
  isActive: true,
  publishedAt: '',
  expiresAt: '',
}

function todayUtc(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

export function AnnouncementsManager({ initialAnnouncements, buList }: Props) {
  const [items, setItems] = useState<Announcement[]>(initialAnnouncements)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'planned' | 'expired'>('all')

  const filteredItems = useMemo(() => {
    if (filterStatus === 'all') return items
    return items.filter(a => {
      if (filterStatus === 'inactive') return !a.isActive
      if (!a.isActive) return false
      const now = new Date()
      const pub = new Date(a.publishedAt)
      if (filterStatus === 'planned') return pub > now
      if (filterStatus === 'expired') return !!a.expiresAt && new Date(a.expiresAt) < now
      return pub <= now && (!a.expiresAt || new Date(a.expiresAt) >= now)
    })
  }, [items, filterStatus])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, publishedAt: todayUtc() })
    setError('')
    setShowForm(true)
  }

  function openEdit(a: Announcement) {
    setEditing(a)
    setForm({
      title: a.title,
      body: a.body,
      businessUnitId: a.businessUnitId ?? '',
      isPinned: a.isPinned,
      isActive: a.isActive,
      publishedAt: a.publishedAt.split('T')[0],
      expiresAt: a.expiresAt ? a.expiresAt.split('T')[0] : '',
    })
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        body: form.body,
        businessUnitId: form.businessUnitId || null,
        isPinned: form.isPinned,
        isActive: form.isActive,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }

      if (editing) {
        const updated = await announcementsApi.update(editing.id, payload)
        setItems(prev => prev.map(a => a.id === editing.id ? updated : a))
        closeForm()
        toast.success('Annonce mise à jour.')
      } else {
        const created = await announcementsApi.create(payload)
        setItems(prev => [created, ...prev])
        closeForm()
        toast.success('Annonce créée avec succès.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(a: Announcement) {
    try {
      const updated = await announcementsApi.update(a.id, { isActive: !a.isActive })
      setItems(prev => prev.map(x => x.id === a.id ? updated : x))
      toast.info(updated.isActive ? 'Annonce activée.' : 'Annonce désactivée.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.')
    }
  }

  async function handleDelete(a: Announcement) {
    const ok = await confirm({
      title: 'Supprimer l\'annonce',
      message: `Supprimer l'annonce « ${a.title} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    })
    if (!ok) return
    try {
      await announcementsApi.remove(a.id)
      setItems(prev => prev.filter(x => x.id !== a.id))
      toast.success('Annonce supprimée.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredItems, safePage],
  )

  function getStatus(a: Announcement): { label: string; cls: string } {
    if (!a.isActive) return { label: 'Inactif', cls: 'bg-gray-100 text-gray-500' }
    const now = new Date()
    const pub = new Date(a.publishedAt)
    if (pub > now) return { label: 'Planifié', cls: 'bg-blue-100 text-blue-700' }
    if (a.expiresAt && new Date(a.expiresAt) < now) return { label: 'Expiré', cls: 'bg-red-100 text-red-600' }
    return { label: 'Actif', cls: 'bg-green-100 text-green-700' }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Annonces</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredItems.length !== items.length
              ? `${filteredItems.length} / ${items.length} annonce${items.length > 1 ? 's' : ''}`
              : `${items.length} annonce${items.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value as typeof filterStatus); setPage(1) }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] bg-white text-gray-600"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="planned">Planifié</option>
            <option value="expired">Expiré</option>
            <option value="inactive">Inactif</option>
          </select>
          <button
            onClick={openCreate}
            className="bg-[#F28C38] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#e07d29] transition-colors"
          >
            + Nouvelle annonce
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredItems.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
            {filterStatus === "all" ? <>Aucune annonce pour l&apos;instant.</> : <>Aucune annonce pour ce filtre.</>}
          </div>
        )}

        {pageItems.map(a => {
          const status = getStatus(a)
          return (
            <div
              key={a.id}
              className={`bg-white rounded-2xl border p-5 flex gap-4 ${a.isPinned ? 'border-[#F28C38]/30' : 'border-gray-100'}`}
            >
              {a.isPinned && (
                <div className="mt-0.5 text-[#F28C38] text-lg" title="Épinglée">📌</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="font-semibold text-gray-900 text-sm">{a.title}</div>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{a.body}</p>
                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                  <span>Publication : {fmtDate(a.publishedAt)}</span>
                  {a.expiresAt && <span>Expiration : {fmtDate(a.expiresAt)}</span>}
                  {a.businessUnit && <span>BU : {a.businessUnit.name}</span>}
                  <span>Par : {a.createdBy.fullName ?? a.createdBy.username}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(a)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    a.isActive
                      ? 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500'
                      : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {a.isActive ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => openEdit(a)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )
        })}
        {filteredItems.length > PAGE_SIZE && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <ServerPagination
              page={safePage}
              totalPages={totalPages}
              total={filteredItems.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              label="annonces"
            />
          </div>
        )}
      </div>

      {/* Modale */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editing ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
        subtitle={editing ? `Éditer « ${editing.title} »` : 'Rédiger et programmer une nouvelle communication'}
        size="xl"
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="ann-title" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Titre *</label>
                <input
                  id="ann-title"
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                />
              </div>

              <div>
                <label htmlFor="ann-body" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Corps *</label>
                <textarea
                  id="ann-body"
                  value={form.body}
                  onChange={e => setForm({ ...form, body: e.target.value })}
                  required
                  rows={4}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ann-published" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Publication</label>
                  <input
                    id="ann-published"
                    type="date"
                    value={form.publishedAt}
                    onChange={e => setForm({ ...form, publishedAt: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                  />
                </div>
                <div>
                  <label htmlFor="ann-expires" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Expiration <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
                  </label>
                  <input
                    id="ann-expires"
                    type="date"
                    value={form.expiresAt}
                    onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ann-bu" className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  BU ciblée <span className="text-gray-400 normal-case font-normal">(toutes si vide)</span>
                </label>
                <select
                  id="ann-bu"
                  value={form.businessUnitId}
                  onChange={e => setForm({ ...form, businessUnitId: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] bg-white"
                >
                  <option value="">Toutes les BU</option>
                  {buList.map(bu => (
                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPinned}
                    onChange={e => setForm({ ...form, isPinned: e.target.checked })}
                    className="rounded border-gray-300 text-[#F28C38] focus:ring-[#F28C38]"
                  />
                  <span className="text-sm text-gray-700">Épinglée</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-[#F28C38] focus:ring-[#F28C38]"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
      </Modal>
    </>
  )
}
