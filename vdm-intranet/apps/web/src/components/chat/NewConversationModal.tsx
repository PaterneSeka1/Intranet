'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { chatApi, chatUserDisplayName, type ChatDirectoryUser, type ConversationType } from '@/lib/chat'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/lib/toast'

interface NewConversationModalProps {
  currentUserId: string
  onClose: () => void
  onCreate: (payload: { type: ConversationType; participantIds: string[]; name?: string }) => void
}

export function NewConversationModal({ currentUserId, onClose, onCreate }: NewConversationModalProps) {
  const [users, setUsers] = useState<ChatDirectoryUser[] | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    chatApi
      .directory()
      .then((list) => setUsers(list.filter((u) => u.id !== currentUserId)))
      .catch(() => {
        toast.error("Impossible de charger l'annuaire.")
        setUsers([])
      })
  }, [currentUserId])

  const filtered = useMemo(() => {
    if (!users) return []
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const haystack = [chatUserDisplayName(u), u.username, u.matricule, u.businessUnit?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [users, search])

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleSubmit() {
    if (!selectedIds.length) return
    const type: ConversationType = selectedIds.length === 1 ? 'DIRECT' : 'GROUP'
    if (type === 'GROUP' && !groupName.trim()) {
      toast.error('Le nom du groupe est obligatoire.')
      return
    }
    setSubmitting(true)
    onCreate({ type, participantIds: selectedIds, name: type === 'GROUP' ? groupName.trim() : undefined })
  }

  return (
    <Modal open onClose={onClose} title="Nouvelle conversation" subtitle="1 personne pour discuter en direct, plusieurs pour créer un groupe" size="md">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" strokeWidth={2} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un collègue…"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#F28C38] transition-colors"
        />
      </div>

      {selectedIds.length > 1 && (
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Nom du groupe"
          className="w-full mb-3 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#F28C38] transition-colors"
        />
      )}

      <div className="max-h-72 overflow-y-auto -mx-2">
        {users === null && <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>}
        {users !== null && filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Aucun résultat.</p>
        )}
        {filtered.map((user) => {
          const isSelected = selectedIds.includes(user.id)
          return (
            <button
              key={user.id}
              onClick={() => toggle(user.id)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
            >
              <Avatar firstName={user.firstName} lastName={user.lastName} username={user.username} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{chatUserDisplayName(user)}</div>
                <div className="text-xs text-gray-400 truncate">{user.businessUnit?.name ?? user.matricule ?? user.username}</div>
              </div>
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                  isSelected ? 'bg-[#F28C38] border-[#F28C38]' : 'border-gray-300'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedIds.length || submitting}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#F28C38] disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 transition-all"
        >
          {selectedIds.length > 1 ? 'Créer le groupe' : 'Démarrer la conversation'}
        </button>
      </div>
    </Modal>
  )
}
