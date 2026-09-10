'use client'

import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { type Tab, type TabFolder, type TabCredential, tabsApi } from '@/lib/tabs'
import { toast } from '@/lib/toast'
import { Modal } from '@/components/ui/Modal'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { TabIcon, DEFAULT_TAB_COLOR, withAlpha } from '@/components/tabs/tab-icons'

/** Icône par défaut d'un dossier sans icône propre — clé du registre tab-icons.tsx. */
const DEFAULT_FOLDER_ICON = 'folder'

function TabCard({ tab, onManageCredential }: { tab: Tab; onManageCredential?: () => void }) {
  return (
    <a
      href={tab.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative w-32 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-[#F28C38]/30 hover:shadow-md hover:-translate-y-0.5 transition-all group"
    >
      {onManageCredential && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onManageCredential()
          }}
          title="Identifiants partagés disponibles"
          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-gray-50 text-gray-400 hover:text-[#F28C38] hover:bg-[#F28C38]/10 transition-colors"
        >
          <KeyRound className="w-3 h-3" strokeWidth={2} />
        </button>
      )}
      <span
        style={{ background: withAlpha(tab.color || DEFAULT_TAB_COLOR, '1A') }}
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors group-hover:brightness-95"
      >
        <TabIcon value={tab.icon} color={tab.color} className="w-6 h-6" />
      </span>
      <span className="text-xs font-semibold text-gray-700 text-center group-hover:text-[#F28C38] transition-colors line-clamp-2 leading-tight">
        {tab.name}
      </span>
    </a>
  )
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copié.`)
  } catch {
    toast.error('Copie impossible — copiez manuellement.')
  }
}

/** Révèle l'identifiant partagé d'un onglet — chargé à l'ouverture, jamais préchargé (chaque
 * ouverture déclenche une consultation journalisée côté serveur, cf. TabsService.getCredential). */
function CredentialModal({ tab, onClose }: { tab: Tab | null; onClose: () => void }) {
  const [credential, setCredential] = useState<TabCredential | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tab) return
    setCredential(null)
    setError('')
    setLoading(true)
    tabsApi
      .getCredential(tab.id)
      .then(setCredential)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Impossible de charger l'identifiant.")
      )
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <Modal open={!!tab} onClose={onClose} title="Identifiants partagés" subtitle={tab?.name} size="sm">
      {loading && <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>}
      {!loading && error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-xs text-red-600">
          {error}
        </div>
      )}
      {!loading && !error && credential && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Identifiant
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={credential.username}
                onFocus={(e) => e.target.select()}
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(credential.username, "L'identifiant")}
                className="px-3 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Copier
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Mot de passe
            </label>
            <div className="flex gap-2">
              <PasswordInput
                readOnly
                value={credential.password}
                onFocus={(e) => e.target.select()}
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(credential.password, 'Le mot de passe')}
                className="px-3 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Copier
              </button>
            </div>
          </div>

          {credential.notes && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Notes
              </label>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{credential.notes}</p>
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            Mis à jour par {credential.updatedBy.fullName || credential.updatedBy.username} le{' '}
            {new Date(credential.updatedAt).toLocaleDateString('fr-FR')}.
          </p>
        </div>
      )}
    </Modal>
  )
}

/**
 * Tuile "dossier fermé" : l'emblème reprend la silhouette d'un vrai dossier (languette + corps),
 * pas une simple icône dans un carré — cliquer dessus l'ouvre (Modal) pour révéler les onglets à
 * l'intérieur, comme un vrai dossier qu'on ouvrirait.
 */
function FolderTile({ folder, count, onOpen }: { folder: TabFolder; count: number; onOpen: () => void }) {
  const color = folder.color || DEFAULT_TAB_COLOR
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-32 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-[#F28C38]/30 hover:shadow-md hover:-translate-y-0.5 transition-all group"
    >
      <span className="relative w-12 h-11 shrink-0">
        {/* Languette du dossier */}
        <span
          aria-hidden
          style={{ background: color }}
          className="absolute left-0 top-0 h-3 w-7 rounded-t-md"
        />
        {/* Corps du dossier — coin haut-gauche non arrondi pour se fondre avec la languette */}
        <span
          style={{ background: color }}
          className="absolute inset-x-0 bottom-0 top-2 rounded-b-xl rounded-tr-xl overflow-hidden flex items-center justify-center transition-transform group-hover:-translate-y-0.5"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/0 to-black/10"
          />
          <TabIcon
            value={folder.icon || DEFAULT_FOLDER_ICON}
            color="#ffffff"
            className="relative w-4 h-4 drop-shadow-sm"
          />
        </span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-gray-700 text-white text-[9px] font-bold flex items-center justify-center shadow-sm z-10">
            {count}
          </span>
        )}
      </span>
      <span className="text-xs font-semibold text-gray-700 text-center group-hover:text-[#F28C38] transition-colors line-clamp-2 leading-tight">
        {folder.name}
      </span>
    </button>
  )
}

export function HomeResources({
  folders,
  tabsByFolder,
  ungroupedTabs,
}: {
  folders: TabFolder[]
  tabsByFolder: Record<string, Tab[]>
  ungroupedTabs: Tab[]
}) {
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const openFolder = folders.find((f) => f.id === openFolderId) ?? null
  const openFolderTabs = openFolder ? (tabsByFolder[openFolder.id] ?? []) : []

  const [credentialTab, setCredentialTab] = useState<Tab | null>(null)
  const manageCredential = (tab: Tab) => (tab.credential ? () => setCredentialTab(tab) : undefined)

  return (
    <>
      <div className="flex flex-wrap justify-center gap-3">
        {folders.map((folder) => (
          <FolderTile
            key={folder.id}
            folder={folder}
            count={tabsByFolder[folder.id]?.length ?? 0}
            onOpen={() => setOpenFolderId(folder.id)}
          />
        ))}
        {ungroupedTabs.map((tab) => (
          <TabCard key={tab.id} tab={tab} onManageCredential={manageCredential(tab)} />
        ))}
      </div>

      <Modal
        open={!!openFolder}
        onClose={() => setOpenFolderId(null)}
        title={openFolder?.name ?? ''}
        subtitle={`${openFolderTabs.length} onglet${openFolderTabs.length > 1 ? 's' : ''}`}
        size="xl"
        accent={openFolder?.color || DEFAULT_TAB_COLOR}
      >
        {openFolderTabs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Ce dossier est vide.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {openFolderTabs.map((tab) => (
              <TabCard key={tab.id} tab={tab} onManageCredential={manageCredential(tab)} />
            ))}
          </div>
        )}
      </Modal>

      <CredentialModal tab={credentialTab} onClose={() => setCredentialTab(null)} />
    </>
  )
}
