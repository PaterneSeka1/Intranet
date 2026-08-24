'use client'

import { useState } from 'react'
import { presenceApi, type ScheduleGroup } from '@/lib/presence'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { Modal } from '@/components/ui/Modal'

type PoleOption = { id: string; name: string }

interface Props {
  initialGroups: ScheduleGroup[]
  businessUnitId: string
  businessUnitName: string
  poles: PoleOption[]
}

type GroupForm = {
  name: string
  code: string
  description: string
  expectedArrivalTime: string
  expectedDepartureTime: string
  poleId: string
  isNightShift: boolean
}

const EMPTY_FORM: GroupForm = {
  name: '',
  code: '',
  description: '',
  expectedArrivalTime: '',
  expectedDepartureTime: '',
  poleId: '',
  isNightShift: false,
}

const INPUT =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] transition-shadow'
const SELECT = `${INPUT} bg-white`

/**
 * Gestion des groupes horaires d'une Business Unit, réservée à RESPONSABLE_BU
 * (CAN_MANAGE_SCHEDULE_GROUPS_BU_SCOPE côté API — voir presence.service.ts::assertScheduleGroupBuScope).
 * La BU est toujours celle du responsable : jamais de sélecteur de BU ni de groupe global ici,
 * le serveur force et vérifie ce périmètre indépendamment de ce que le client envoie.
 */
export function ScheduleGroupsManager({
  initialGroups,
  businessUnitId,
  businessUnitName,
  poles,
}: Props) {
  const [groups, setGroups] = useState<ScheduleGroup[]>(
    initialGroups.filter((g) => g.businessUnit?.id === businessUnitId)
  )
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ScheduleGroup | null>(null)
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(g: ScheduleGroup) {
    setEditing(g)
    setForm({
      name: g.name,
      code: g.code,
      description: g.description ?? '',
      expectedArrivalTime: g.expectedArrivalTime,
      expectedDepartureTime: g.expectedDepartureTime ?? '',
      poleId: g.pole?.id ?? '',
      isNightShift: g.isNightShift,
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        code: form.code,
        description: form.description || undefined,
        expectedArrivalTime: form.expectedArrivalTime,
        expectedDepartureTime: form.expectedDepartureTime || null,
        poleId: form.poleId || null,
        isNightShift: form.isNightShift,
      }
      if (editing) {
        const updated = await presenceApi.updateScheduleGroup(editing.id, payload)
        setGroups((prev) => prev.map((g) => (g.id === editing.id ? updated : g)))
        toast.success('Groupe horaire mis à jour.')
      } else {
        const created = await presenceApi.createScheduleGroup({ ...payload, businessUnitId })
        setGroups((prev) => [...prev, created])
        toast.success('Groupe horaire créé avec succès.')
      }
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(g: ScheduleGroup) {
    const ok = await confirm({
      title: 'Supprimer le groupe',
      message: `Supprimer le groupe horaire « ${g.name} » ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      destructive: true,
    })
    if (!ok) return
    try {
      await presenceApi.deleteScheduleGroup(g.id)
      setGroups((prev) => prev.filter((x) => x.id !== g.id))
      toast.success(`Groupe « ${g.name} » supprimé.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 mb-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <div className="text-sm font-bold text-gray-800">
            Groupes horaires — {businessUnitName}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Modèles réutilisables (ex : rotation nuit/week-end) proposés dans le calendrier
            ci-dessous.
          </p>
        </div>
        <span className="text-gray-400 text-sm shrink-0 ml-3">
          {groups.length} groupe{groups.length !== 1 ? 's' : ''} {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <div className="flex justify-end mb-3">
            <button
              onClick={openCreate}
              className="bg-[#F28C38] text-white text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-[#e07d29] transition-colors"
            >
              + Nouveau groupe
            </button>
          </div>

          <div className="space-y-2">
            {groups.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-6 border border-dashed border-gray-200 rounded-xl">
                Aucun groupe horaire pour votre BU pour l'instant.
              </div>
            )}
            {groups.map((g) => (
              <div
                key={g.id}
                className={`rounded-xl border p-3.5 flex items-center gap-3 ${g.isNightShift ? 'bg-indigo-950/5 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}
              >
                <div
                  className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 ${g.isNightShift ? 'bg-indigo-100' : 'bg-[#F28C38]/10'}`}
                >
                  <span
                    className={`font-bold text-xs leading-tight ${g.isNightShift ? 'text-indigo-700' : 'text-[#F28C38]'}`}
                  >
                    {g.expectedArrivalTime}
                  </span>
                  <span
                    className={`text-[8px] font-medium ${g.isNightShift ? 'text-indigo-400' : 'text-[#F28C38]/60'}`}
                  >
                    {g.isNightShift ? '🌙 Nuit' : '☀️ Jour'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{g.name}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 font-mono px-1.5 py-0.5 rounded-md">
                      {g.code}
                    </span>
                    {g.pole && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                        {g.pole.name}
                      </span>
                    )}
                    {g.expectedDepartureTime && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        🚪 {g.expectedDepartureTime}
                      </span>
                    )}
                  </div>
                  {g.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{g.description}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(g)}
                    className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(g)}
                    disabled={g._count.users > 0}
                    title={
                      g._count.users > 0 ? `${g._count.users} utilisateur(s) assigné(s)` : undefined
                    }
                    className="text-xs border border-red-100 text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Modifier — ${editing.name}` : 'Nouveau groupe horaire'}
        subtitle={businessUnitName}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Nom *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={INPUT}
                placeholder="Ex : Nuit Pôle TV/Radio"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Code *
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                maxLength={20}
                className={INPUT}
                placeholder="Ex : TVR-NUIT"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Description <span className="text-gray-300 normal-case font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Arrivée attendue *
              </label>
              <input
                type="time"
                value={form.expectedArrivalTime}
                onChange={(e) => setForm({ ...form, expectedArrivalTime: e.target.value })}
                required
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Départ attendu{' '}
                <span className="text-gray-300 normal-case font-normal">(optionnel)</span>
              </label>
              <input
                type="time"
                value={form.expectedDepartureTime}
                onChange={(e) => setForm({ ...form, expectedDepartureTime: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Pôle{' '}
              <span className="text-gray-300 normal-case font-normal">(toute la BU si vide)</span>
            </label>
            <select
              value={form.poleId}
              onChange={(e) => setForm({ ...form, poleId: e.target.value })}
              className={SELECT}
            >
              <option value="">— Toute la BU —</option>
              {poles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isNightShift}
              onChange={(e) => setForm({ ...form, isNightShift: e.target.checked })}
              className="rounded border-gray-300 text-[#F28C38] focus:ring-[#F28C38]"
            />
            <span className="text-sm text-gray-700">Équipe de nuit (franchissement de minuit)</span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le groupe'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
