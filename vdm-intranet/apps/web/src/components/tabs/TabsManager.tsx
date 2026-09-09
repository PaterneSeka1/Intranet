'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  FolderPlus,
  Plus,
  Folder as FolderGlyph,
} from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  type Tab,
  type TabFolder,
  type CreateTabPayload,
  type UpdateTabPayload,
  type CreateTabFolderPayload,
  type UpdateTabFolderPayload,
  type ReorderItem,
  tabsApi,
  tabFoldersApi,
} from '@/lib/tabs'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { Modal } from '@/components/ui/Modal'
import {
  TAB_ICON_REGISTRY,
  TAB_ICON_PRESETS,
  DEFAULT_TAB_ICON,
  DEFAULT_TAB_COLOR,
  isImageIcon,
  withAlpha,
  TabIcon,
} from '@/components/tabs/tab-icons'

type BuOption = { id: string; name: string; code: string }

interface Props {
  initialTabs: Tab[]
  initialFolders: TabFolder[]
  userRole: string
  userBuId?: string | null
  buList: BuOption[]
  canManageAll: boolean
}

/** Clé du groupe virtuel "sans dossier" (jamais un vrai id de dossier, cf. PortalTab.folderId). */
const NONE = 'none'
const DEFAULT_FOLDER_ICON = 'folder'

const ICON_PRESETS = TAB_ICON_PRESETS

const IMAGE_ICON_SIZE = 128
const MAX_ICON_FILE_SIZE = 2 * 1024 * 1024

type TabFormData = {
  name: string
  url: string
  description: string
  icon: string
  color: string
  businessUnitId: string // '' = onglet global
  folderId: string // '' = aucun dossier
}

const EMPTY_TAB_FORM: TabFormData = {
  name: '',
  url: '',
  description: '',
  icon: DEFAULT_TAB_ICON,
  color: '#F28C38',
  businessUnitId: '',
  folderId: '',
}

type FolderFormData = {
  name: string
  icon: string
  color: string
  businessUnitId: string // '' = dossier global
}

const EMPTY_FOLDER_FORM: FolderFormData = {
  name: '',
  icon: DEFAULT_FOLDER_ICON,
  color: '#F28C38',
  businessUnitId: '',
}

const GLOBAL_TAB_MANAGERS = ['CTO_ADMIN', 'PDG']
const BU_TAB_MANAGERS = ['DAF', 'RESPONSABLE_BU']

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

/** Regroupe les onglets par dossier (clé NONE pour "sans dossier"), triés par leur rang manuel. */
function buildContainers(tabs: Tab[], folders: TabFolder[]): Record<string, string[]> {
  const map: Record<string, string[]> = { [NONE]: [] }
  for (const f of folders) map[f.id] = []
  const sorted = [...tabs].sort((a, b) => a.order - b.order)
  for (const t of sorted) {
    const key = t.folderId && map[t.folderId] ? t.folderId : NONE
    map[key].push(t.id)
  }
  return map
}

function IconPickerField({
  value,
  color,
  onChange,
  processing,
  onImageChange,
}: {
  value: string
  color: string
  onChange: (icon: string) => void
  processing: boolean
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const iconIsDataImage = value.startsWith('data:image/')
  const inputId = useMemo(() => `icon-image-${Math.random().toString(36).slice(2)}`, [])
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
        Icône
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {ICON_PRESETS.map((ico) => {
          const Icon = TAB_ICON_REGISTRY[ico]
          const selected = value === ico
          const activeColor = color || DEFAULT_TAB_COLOR
          return (
            <button
              key={ico}
              type="button"
              onClick={() => onChange(ico)}
              style={
                selected
                  ? {
                      background: withAlpha(activeColor, '1A'),
                      color: activeColor,
                      boxShadow: `inset 0 0 0 1px ${activeColor}`,
                    }
                  : undefined
              }
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selected ? '' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )
        })}
        <label
          htmlFor={inputId}
          style={
            isImageIcon(value)
              ? {
                  background: withAlpha(color || DEFAULT_TAB_COLOR, '1A'),
                  color: color || DEFAULT_TAB_COLOR,
                  boxShadow: `inset 0 0 0 1px ${color || DEFAULT_TAB_COLOR}`,
                }
              : undefined
          }
          className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs font-semibold cursor-pointer transition-colors ${
            isImageIcon(value) ? 'border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
          title="Choisir une image"
        >
          {processing ? '…' : 'IMG'}
        </label>
        <input id={inputId} type="file" accept="image/*" onChange={onImageChange} className="sr-only" />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <div
          style={{ background: withAlpha(color || DEFAULT_TAB_COLOR, '1A') }}
          className="w-10 h-10 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden"
        >
          <TabIcon value={value} color={color} className="w-6 h-6" />
        </div>
        <div className="text-[11px] text-gray-400 leading-snug">
          {isImageIcon(value) ? 'Image redimensionnée automatiquement.' : 'Icône de la palette ou image.'}
        </div>
      </div>
      <input
        type="text"
        value={iconIsDataImage ? 'Image sélectionnée' : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={iconIsDataImage}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
        maxLength={100000}
        placeholder="Nom d'icône ou URL image"
      />
      {iconIsDataImage && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_TAB_ICON)}
          className="mt-1.5 text-[11px] font-semibold text-gray-400 hover:text-red-500"
        >
          Retirer l'image
        </button>
      )}
    </div>
  )
}

function DragHandle({
  attributes,
  listeners,
  className,
}: {
  attributes: React.HTMLAttributes<HTMLElement>
  listeners: Record<string, unknown> | undefined
  className?: string
}) {
  return (
    <span
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className={`shrink-0 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-grab active:cursor-grabbing touch-none ${className ?? 'p-1'}`}
      title="Glisser pour réordonner"
    >
      <GripVertical className="w-3.5 h-3.5" strokeWidth={1.75} />
    </span>
  )
}

function TabCardContent({
  tab,
  canManageThis,
  onToggle,
  onEdit,
  onDelete,
  showFolderBadge,
  dragHandle,
}: {
  tab: Tab
  canManageThis: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  showFolderBadge?: boolean
  dragHandle?: React.ReactNode
}) {
  return (
    <div
      style={tab.color ? { borderBottom: `3px solid ${tab.color}` } : undefined}
      className={`bg-white rounded-2xl border p-4 flex flex-col gap-2 transition-all ${tab.isActive ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {dragHandle}
          <span
            style={{ background: withAlpha(tab.color || DEFAULT_TAB_COLOR, '1A') }}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          >
            <TabIcon value={tab.icon} color={tab.color} className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-gray-800 text-sm truncate">{tab.name}</div>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {tab.businessUnit ? (
                <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full inline-block">
                  {tab.businessUnit.code}
                </span>
              ) : (
                <span className="text-[10px] text-[#F28C38] bg-[#F28C38]/10 px-1.5 py-0.5 rounded-full inline-block">
                  Global
                </span>
              )}
              {showFolderBadge && tab.folder && (
                <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 max-w-[110px]">
                  <FolderGlyph className="w-2.5 h-2.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">{tab.folder.name}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        {canManageThis && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
              title={tab.isActive ? 'Désactiver' : 'Activer'}
            >
              {tab.isActive ? (
                <ToggleRight className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <ToggleLeft className="w-4 h-4" strokeWidth={1.75} />
              )}
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-[#F28C38] transition-colors"
              title="Modifier"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      {tab.description && <p className="text-xs text-gray-500 line-clamp-2">{tab.description}</p>}

      <a
        href={tab.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto text-xs text-[#F28C38] hover:underline truncate block"
      >
        {tab.url}
      </a>
    </div>
  )
}

function SortableTabCard({
  tab,
  disabled,
  canManageThis,
  onToggle,
  onEdit,
  onDelete,
}: {
  tab: Tab
  disabled: boolean
  canManageThis: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
    disabled,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <TabCardContent
        tab={tab}
        canManageThis={canManageThis}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandle={!disabled ? <DragHandle attributes={attributes} listeners={listeners} /> : undefined}
      />
    </div>
  )
}

function TabGrid({
  containerKey,
  ids,
  tabsById,
  dndEnabled,
  onReordered,
  canManage,
  onToggleActive,
  onEditTab,
  onDeleteTab,
}: {
  containerKey: string
  ids: string[]
  tabsById: Map<string, Tab>
  dndEnabled: boolean
  onReordered: (containerKey: string, newIds: string[]) => void
  canManage: (tab: Tab) => boolean
  onToggleActive: (tab: Tab) => void
  onEditTab: (tab: Tab) => void
  onDeleteTab: (tab: Tab) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    onReordered(containerKey, arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {ids.map((id) => {
            const tab = tabsById.get(id)
            if (!tab) return null
            const manageable = canManage(tab)
            return (
              <SortableTabCard
                key={id}
                tab={tab}
                disabled={!dndEnabled || !manageable}
                canManageThis={manageable}
                onToggle={() => onToggleActive(tab)}
                onEdit={() => onEditTab(tab)}
                onDelete={() => onDeleteTab(tab)}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function FolderSection({
  folder,
  ids,
  tabsById,
  dndEnabled,
  canManageThis,
  collapsed,
  onToggleCollapsed,
  onEditFolder,
  onDeleteFolder,
  onCreateTabHere,
  onReorderTabs,
  canManage,
  onToggleActive,
  onEditTab,
  onDeleteTab,
}: {
  folder: TabFolder
  ids: string[]
  tabsById: Map<string, Tab>
  dndEnabled: boolean
  canManageThis: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  onEditFolder: () => void
  onDeleteFolder: () => void
  onCreateTabHere: () => void
  onReorderTabs: (containerKey: string, newIds: string[]) => void
  canManage: (tab: Tab) => boolean
  onToggleActive: (tab: Tab) => void
  onEditTab: (tab: Tab) => void
  onDeleteTab: (tab: Tab) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
    disabled: !dndEnabled || !canManageThis,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-gray-50/60 border border-gray-100 rounded-2xl p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button type="button" onClick={onToggleCollapsed} className="flex items-center gap-2 min-w-0 text-left flex-1">
          {dndEnabled && canManageThis && <DragHandle attributes={attributes} listeners={listeners} className="p-1 -ml-1" />}
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.75} />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.75} />
          )}
          <span
            style={{ background: withAlpha(folder.color || DEFAULT_TAB_COLOR, '1A') }}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          >
            <TabIcon value={folder.icon || DEFAULT_FOLDER_ICON} color={folder.color} className="w-4 h-4" />
          </span>
          <span className="font-semibold text-gray-800 text-sm truncate">{folder.name}</span>
          <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded-full shrink-0">
            {ids.length}
          </span>
          {folder.businessUnitId === null ? (
            <span className="text-[10px] text-[#F28C38] bg-[#F28C38]/10 px-1.5 py-0.5 rounded-full shrink-0">
              Global
            </span>
          ) : folder.businessUnit ? (
            <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded-full shrink-0">
              {folder.businessUnit.code}
            </span>
          ) : null}
        </button>
        {canManageThis && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onCreateTabHere}
              className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-[#F28C38] transition-colors"
              title="Ajouter un onglet dans ce dossier"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={onEditFolder}
              className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-[#F28C38] transition-colors"
              title="Modifier le dossier"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={onDeleteFolder}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              title="Supprimer le dossier"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      {!collapsed &&
        (ids.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">
            Dossier vide — modifiez un onglet pour le ranger ici.
          </div>
        ) : (
          <TabGrid
            containerKey={folder.id}
            ids={ids}
            tabsById={tabsById}
            dndEnabled={dndEnabled}
            onReordered={onReorderTabs}
            canManage={canManage}
            onToggleActive={onToggleActive}
            onEditTab={onEditTab}
            onDeleteTab={onDeleteTab}
          />
        ))}
    </div>
  )
}

export function TabsManager({
  initialTabs,
  initialFolders,
  userRole,
  userBuId,
  buList,
  canManageAll,
}: Props) {
  const [tabs, setTabs] = useState<Tab[]>(initialTabs)
  const [folders, setFolders] = useState<TabFolder[]>(
    [...initialFolders].sort((a, b) => a.order - b.order)
  )
  const [containerItems, setContainerItems] = useState<Record<string, string[]>>(() =>
    buildContainers(initialTabs, initialFolders)
  )
  const [folderOrder, setFolderOrder] = useState<string[]>(() => folders.map((f) => f.id))
  const folderOrderRef = useRef(folderOrder)
  folderOrderRef.current = folderOrder

  useEffect(() => {
    setContainerItems(buildContainers(tabs, folders))
  }, [tabs, folders])

  useEffect(() => {
    setFolderOrder(folders.map((f) => f.id))
  }, [folders])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; tab?: Tab } | null>(null)
  const [form, setForm] = useState<TabFormData>(EMPTY_TAB_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [iconProcessing, setIconProcessing] = useState(false)

  const [folderModal, setFolderModal] = useState<{ mode: 'create' | 'edit'; folder?: TabFolder } | null>(
    null
  )
  const [folderForm, setFolderForm] = useState<FolderFormData>(EMPTY_FOLDER_FORM)
  const [folderSubmitting, setFolderSubmitting] = useState(false)
  const [folderError, setFolderError] = useState('')
  const [folderIconProcessing, setFolderIconProcessing] = useState(false)

  const [filterBu, setFilterBu] = useState<string>('')
  const [search, setSearch] = useState('')

  // La recherche peut ne montrer qu'une partie des onglets d'un dossier : désactiver le
  // glisser-déposer dans ce cas évite d'envoyer un ordre incohérent au serveur. Le filtre BU,
  // lui, ne fait jamais que masquer des dossiers/onglets entiers (un dossier appartient toujours
  // à une seule BU), donc il reste compatible avec la réorganisation.
  const dndEnabled = search.trim() === ''

  const folderSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const canManage = (tab: Tab) => {
    if (GLOBAL_TAB_MANAGERS.includes(userRole)) return true
    if (tab.businessUnitId === null) return false
    return BU_TAB_MANAGERS.includes(userRole) && tab.businessUnitId === userBuId
  }

  const canManageFolder = (folder: TabFolder) => {
    if (GLOBAL_TAB_MANAGERS.includes(userRole)) return true
    if (folder.businessUnitId === null) return false
    return BU_TAB_MANAGERS.includes(userRole) && folder.businessUnitId === userBuId
  }

  const canCreateTabs = canManageAll || (BU_TAB_MANAGERS.includes(userRole) && !!userBuId)
  const canCreateFolders = canCreateTabs

  const tabsById = useMemo(() => new Map(tabs.map((t) => [t.id, t])), [tabs])
  const foldersById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])

  // ---- Formulaire onglet ----

  function openCreate(folder?: TabFolder) {
    setForm({
      ...EMPTY_TAB_FORM,
      businessUnitId: folder
        ? (folder.businessUnitId ?? '')
        : canManageAll
          ? ''
          : (userBuId ?? ''),
      folderId: folder ? folder.id : '',
    })
    setError('')
    setModal({ mode: 'create' })
  }

  function openEdit(tab: Tab) {
    setForm({
      name: tab.name,
      url: tab.url,
      description: tab.description ?? '',
      icon: tab.icon ?? DEFAULT_TAB_ICON,
      color: tab.color ?? '#F28C38',
      businessUnitId: tab.businessUnitId ?? '',
      folderId: tab.folderId ?? '',
    })
    setError('')
    setModal({ mode: 'edit', tab })
  }

  // Portée BU à respecter pour la liste des dossiers proposés dans le formulaire : celle du
  // formulaire en création (modifiable), celle — figée — de l'onglet en édition.
  const formScopeBuId =
    modal?.mode === 'edit' ? (modal.tab?.businessUnitId ?? null) : form.businessUnitId || null
  const availableFoldersForForm = useMemo(
    () => folders.filter((f) => (f.businessUnitId ?? null) === formScopeBuId),
    [folders, formScopeBuId]
  )

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
          folderId: form.folderId || undefined,
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
          folderId: form.folderId || null,
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

  // ---- Formulaire dossier ----

  function openCreateFolder() {
    setFolderForm({
      ...EMPTY_FOLDER_FORM,
      businessUnitId: canManageAll ? '' : (userBuId ?? ''),
    })
    setFolderError('')
    setFolderModal({ mode: 'create' })
  }

  function openEditFolder(folder: TabFolder) {
    setFolderForm({
      name: folder.name,
      icon: folder.icon ?? DEFAULT_FOLDER_ICON,
      color: folder.color ?? '#F28C38',
      businessUnitId: folder.businessUnitId ?? '',
    })
    setFolderError('')
    setFolderModal({ mode: 'edit', folder })
  }

  async function handleFolderSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFolderSubmitting(true)
    setFolderError('')
    try {
      if (folderModal?.mode === 'create') {
        const payload: CreateTabFolderPayload = {
          name: folderForm.name,
          icon: folderForm.icon || undefined,
          color: folderForm.color || undefined,
          businessUnitId: canManageAll ? folderForm.businessUnitId || undefined : undefined,
        }
        const created = await tabFoldersApi.create(payload)
        setFolders((prev) => [...prev, created])
        setFolderModal(null)
        toast.success('Dossier créé avec succès.')
      } else if (folderModal?.mode === 'edit' && folderModal.folder) {
        const payload: UpdateTabFolderPayload = {
          name: folderForm.name,
          icon: folderForm.icon || undefined,
          color: folderForm.color || undefined,
        }
        const updated = await tabFoldersApi.update(folderModal.folder.id, payload)
        setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
        setTabs((prev) =>
          prev.map((t) =>
            t.folderId === updated.id
              ? { ...t, folder: { id: updated.id, name: updated.name, icon: updated.icon, color: updated.color } }
              : t
          )
        )
        setFolderModal(null)
        toast.success('Dossier mis à jour.')
      }
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setFolderSubmitting(false)
    }
  }

  async function handleFolderIconImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFolderError('')
    setFolderIconProcessing(true)
    try {
      const icon = await resizeIconImage(file)
      setFolderForm((f) => ({ ...f, icon }))
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Impossible d'utiliser cette image.")
    } finally {
      setFolderIconProcessing(false)
    }
  }

  async function handleDeleteFolder(folder: TabFolder) {
    const ok = await confirm({
      title: 'Supprimer le dossier',
      message: `Supprimer le dossier « ${folder.name} » ? Les onglets qu'il contient ne seront pas supprimés : ils redeviendront "sans dossier".`,
      confirmLabel: 'Supprimer',
      destructive: true,
    })
    if (!ok) return
    try {
      await tabFoldersApi.remove(folder.id)
      setFolders((prev) => prev.filter((f) => f.id !== folder.id))
      setTabs((prev) =>
        prev.map((t) => (t.folderId === folder.id ? { ...t, folderId: null, folder: null } : t))
      )
      toast.success(`Dossier « ${folder.name} » supprimé.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    }
  }

  // ---- Réorganisation (glisser-déposer) ----

  async function handleTabsReordered(containerKey: string, newIds: string[]) {
    setContainerItems((prev) => ({ ...prev, [containerKey]: newIds }))
    const folderId = containerKey === NONE ? null : containerKey
    const items: ReorderItem[] = newIds.map((id, index) => ({ id, order: index, folderId }))
    const orderByIdInContainer = new Map(items.map((i) => [i.id, i.order]))
    setTabs((prev) =>
      prev.map((t) => {
        const order = orderByIdInContainer.get(t.id)
        return order === undefined ? t : { ...t, order }
      })
    )
    try {
      await tabsApi.reorder(items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la réorganisation des onglets.')
    }
  }

  async function persistFolderOrder(order: string[]) {
    const items: ReorderItem[] = order.map((id, index) => ({ id, order: index }))
    const orderById = new Map(items.map((i) => [i.id, i.order]))
    setFolders((prev) =>
      [...prev]
        .map((f) => (orderById.has(f.id) ? { ...f, order: orderById.get(f.id)! } : f))
        .sort((a, b) => a.order - b.order)
    )
    try {
      await tabFoldersApi.reorder(items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la réorganisation des dossiers.')
    }
  }

  function handleFolderDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const order = folderOrderRef.current
    const oldIndex = order.indexOf(active.id as string)
    const newIndex = order.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(order, oldIndex, newIndex)
    setFolderOrder(next)
    persistFolderOrder(next)
  }

  // ---- Filtrage ----

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
  const filteredIds = useMemo(() => new Set(filtered.map((t) => t.id)), [filtered])
  const hasActiveFilters = !!search || !!filterBu

  const visibleFolderOrder = useMemo(() => {
    if (!hasActiveFilters) return folderOrder
    return folderOrder.filter((fid) => {
      const folder = foldersById.get(fid)
      if (filterBu === '__global__' && folder?.businessUnitId !== null) return false
      if (filterBu && filterBu !== '__global__' && folder?.businessUnitId !== filterBu) return false
      const ids = containerItems[fid] ?? []
      return ids.some((id) => filteredIds.has(id))
    })
  }, [folderOrder, hasActiveFilters, filterBu, foldersById, containerItems, filteredIds])

  const visibleNoneIds = useMemo(() => {
    const ids = containerItems[NONE] ?? []
    return hasActiveFilters ? ids.filter((id) => filteredIds.has(id)) : ids
  }, [containerItems, hasActiveFilters, filteredIds])

  const nothingVisible = visibleFolderOrder.length === 0 && visibleNoneIds.length === 0

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
        <div className="flex gap-2">
          {canCreateFolders && (
            <button
              onClick={openCreateFolder}
              className="border border-gray-200 hover:border-[#F28C38]/40 text-gray-600 hover:text-[#F28C38] font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" strokeWidth={1.75} />
              Nouveau dossier
            </button>
          )}
          {canCreateTabs && (
            <button
              onClick={() => openCreate()}
              className="bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              + Nouvel onglet
            </button>
          )}
        </div>
      </div>

      {/* Contenu */}
      {nothingVisible ? (
        <div className="text-center py-16 text-gray-400 text-sm">Aucun onglet trouvé</div>
      ) : (
        <div className="space-y-4">
          {visibleFolderOrder.length > 0 && (
            <DndContext
              sensors={folderSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleFolderDragEnd}
            >
              <SortableContext items={visibleFolderOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {visibleFolderOrder.map((fid) => {
                    const folder = foldersById.get(fid)
                    if (!folder) return null
                    const ids = (containerItems[fid] ?? []).filter(
                      (id) => !hasActiveFilters || filteredIds.has(id)
                    )
                    return (
                      <FolderSection
                        key={fid}
                        folder={folder}
                        ids={ids}
                        tabsById={tabsById}
                        dndEnabled={dndEnabled}
                        canManageThis={canManageFolder(folder)}
                        collapsed={!!collapsed[fid]}
                        onToggleCollapsed={() => setCollapsed((p) => ({ ...p, [fid]: !p[fid] }))}
                        onEditFolder={() => openEditFolder(folder)}
                        onDeleteFolder={() => handleDeleteFolder(folder)}
                        onCreateTabHere={() => openCreate(folder)}
                        onReorderTabs={handleTabsReordered}
                        canManage={canManage}
                        onToggleActive={toggleActive}
                        onEditTab={openEdit}
                        onDeleteTab={handleDelete}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {visibleNoneIds.length > 0 && (
            <div>
              {folders.length > 0 && (
                <div className="flex items-center gap-2 px-1 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Sans dossier
                  </span>
                  <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                    {visibleNoneIds.length}
                  </span>
                </div>
              )}
              <TabGrid
                containerKey={NONE}
                ids={visibleNoneIds}
                tabsById={tabsById}
                dndEnabled={dndEnabled}
                onReordered={handleTabsReordered}
                canManage={canManage}
                onToggleActive={toggleActive}
                onEditTab={openEdit}
                onDeleteTab={handleDelete}
              />
            </div>
          )}
        </div>
      )}

      {/* Modale création / édition d'onglet */}
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
                onChange={(e) => setForm((f) => ({ ...f, businessUnitId: e.target.value, folderId: '' }))}
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
              htmlFor="tab-folder"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Dossier <span className="text-gray-400 normal-case font-normal">(optionnel)</span>
            </label>
            <select
              id="tab-folder"
              value={form.folderId}
              onChange={(e) => setForm((f) => ({ ...f, folderId: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
            >
              <option value="">Aucun dossier</option>
              {availableFoldersForForm.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

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
            <IconPickerField
              value={form.icon}
              color={form.color}
              onChange={(icon) => setForm((f) => ({ ...f, icon }))}
              processing={iconProcessing}
              onImageChange={handleIconImageChange}
            />
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

      {/* Modale création / édition de dossier */}
      <Modal
        open={!!folderModal}
        onClose={() => setFolderModal(null)}
        title={folderModal?.mode === 'create' ? 'Nouveau dossier' : `Modifier — ${folderModal?.folder?.name ?? ''}`}
        subtitle={
          folderModal?.mode === 'create'
            ? 'Regrouper des onglets sous un même dossier'
            : 'Mettre à jour ce dossier'
        }
        size="lg"
      >
        <form onSubmit={handleFolderSubmit} className="space-y-4">
          {canManageAll && folderModal?.mode === 'create' && (
            <div>
              <label
                htmlFor="folder-bu"
                className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
              >
                Audience
              </label>
              <select
                id="folder-bu"
                value={folderForm.businessUnitId}
                onChange={(e) => setFolderForm((f) => ({ ...f, businessUnitId: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
              >
                <option value="">Tous les utilisateurs (Global)</option>
                {buList.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name}
                  </option>
                ))}
              </select>
              {folderForm.businessUnitId === '' && (
                <p className="text-[11px] text-[#F28C38] mt-1.5">
                  Ce dossier — et les onglets qui y seront rangés — sera visible par tous les
                  utilisateurs sans exception.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="folder-name"
              className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
            >
              Nom
            </label>
            <input
              id="folder-name"
              type="text"
              value={folderForm.name}
              onChange={(e) => setFolderForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300"
              placeholder="Ex : Réseaux sociaux"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IconPickerField
              value={folderForm.icon}
              color={folderForm.color}
              onChange={(icon) => setFolderForm((f) => ({ ...f, icon }))}
              processing={folderIconProcessing}
              onImageChange={handleFolderIconImageChange}
            />
            <div>
              <label
                htmlFor="folder-color"
                className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide"
              >
                Couleur
              </label>
              <input
                id="folder-color"
                type="color"
                value={folderForm.color}
                onChange={(e) => setFolderForm((f) => ({ ...f, color: e.target.value }))}
                className="w-full h-10 border border-gray-200 rounded-xl cursor-pointer p-1"
              />
              <div className="text-xs text-gray-400 mt-1 text-center">{folderForm.color}</div>
            </div>
          </div>

          {folderError && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
              {folderError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setFolderModal(null)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={folderSubmitting || folderIconProcessing}
              className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {folderSubmitting || folderIconProcessing
                ? 'Enregistrement…'
                : folderModal?.mode === 'create'
                  ? 'Créer'
                  : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
