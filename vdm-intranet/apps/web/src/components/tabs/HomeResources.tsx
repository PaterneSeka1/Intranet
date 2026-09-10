'use client'

import { useState } from 'react'
import type { Tab, TabFolder } from '@/lib/tabs'
import { Modal } from '@/components/ui/Modal'
import { TabIcon, DEFAULT_TAB_COLOR, withAlpha } from '@/components/tabs/tab-icons'

/** Icône par défaut d'un dossier sans icône propre — clé du registre tab-icons.tsx. */
const DEFAULT_FOLDER_ICON = 'folder'

function TabCard({ tab }: { tab: Tab }) {
  return (
    <a
      href={tab.url}
      target="_blank"
      rel="noopener noreferrer"
      className="w-32 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-[#F28C38]/30 hover:shadow-md hover:-translate-y-0.5 transition-all group"
    >
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
          <TabCard key={tab.id} tab={tab} />
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
              <TabCard key={tab.id} tab={tab} />
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
