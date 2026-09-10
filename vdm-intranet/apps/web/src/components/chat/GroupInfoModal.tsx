'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, LogOut, Pencil, Search, UserPlus, X } from 'lucide-react'
import { chatApi, chatUserDisplayName, type ChatDirectoryUser, type Conversation } from '@/lib/chat'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { confirm } from '@/lib/confirm'
import { toast } from '@/lib/toast'

interface GroupInfoModalProps {
  conversation: Conversation
  currentUserId: string
  onClose: () => void
  onChanged: () => void
  onLeft: () => void
}

export function GroupInfoModal({
  conversation,
  currentUserId,
  onClose,
  onChanged,
  onLeft,
}: GroupInfoModalProps) {
  const me = conversation.participants.find((p) => p.userId === currentUserId)
  const isAdmin = !!me?.isAdmin

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(conversation.name ?? '')
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [directory, setDirectory] = useState<ChatDirectoryUser[] | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!showAddPicker || directory) return
    chatApi
      .directory()
      .then(setDirectory)
      .catch(() => toast.error("Impossible de charger l'annuaire."))
  }, [showAddPicker, directory])

  const existingIds = new Set(conversation.participants.map((p) => p.userId))
  const candidates = useMemo(() => {
    const pool = directory?.filter((u) => !existingIds.has(u.id)) ?? []
    const q = search.trim().toLowerCase()
    if (!q) return pool
    return pool.filter((u) => chatUserDisplayName(u).toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory, search, conversation.participants])

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Le nom du groupe est obligatoire.')
      return
    }
    setBusy(true)
    try {
      await chatApi.renameConversation(conversation.id, trimmed)
      setEditingName(false)
      onChanged()
    } catch {
      toast.error('Impossible de renommer le groupe.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddParticipants() {
    if (!selectedIds.length) return
    setBusy(true)
    try {
      await chatApi.addParticipants(conversation.id, selectedIds)
      setSelectedIds([])
      setShowAddPicker(false)
      setDirectory(null)
      onChanged()
    } catch {
      toast.error("Impossible d'ajouter ces participants.")
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(userId: string) {
    const ok = await confirm({ message: 'Retirer ce participant du groupe ?', destructive: true })
    if (!ok) return
    try {
      await chatApi.removeParticipant(conversation.id, userId)
      onChanged()
    } catch {
      toast.error('Impossible de retirer ce participant.')
    }
  }

  async function handleLeave() {
    const ok = await confirm({
      message: 'Quitter ce groupe ? Vous ne recevrez plus ses messages.',
      destructive: true,
    })
    if (!ok) return
    try {
      await chatApi.removeParticipant(conversation.id, currentUserId)
      onLeft()
    } catch {
      toast.error('Impossible de quitter le groupe.')
    }
  }

  return (
    <Modal open onClose={onClose} title="Informations du groupe" size="sm">
      <div className="flex items-center gap-3 mb-4">
        <Avatar username={conversation.name ?? 'Groupe'} size="lg" />
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                className="flex-1 text-sm px-2 py-1 rounded-lg border border-gray-200 outline-none focus:border-[#F28C38]"
              />
              <button onClick={saveName} disabled={busy} className="text-[#F28C38] shrink-0">
                <Check className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-900 truncate">{conversation.name}</span>
              {isAdmin && (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-gray-300 hover:text-gray-600 shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400">{conversation.participants.length} membres</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Membres</span>
        {isAdmin && (
          <button
            onClick={() => setShowAddPicker((v) => !v)}
            className="text-xs text-[#F28C38] font-medium hover:underline flex items-center gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
            Ajouter
          </button>
        )}
      </div>

      {showAddPicker && (
        <div className="mb-3 border border-gray-100 rounded-xl p-2">
          <div className="relative mb-2">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300"
              strokeWidth={2}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-[#F28C38]"
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {candidates.map((user) => {
              const isSelected = selectedIds.includes(user.id)
              return (
                <button
                  key={user.id}
                  onClick={() =>
                    setSelectedIds((prev) =>
                      prev.includes(user.id)
                        ? prev.filter((x) => x !== user.id)
                        : [...prev, user.id]
                    )
                  }
                  className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-gray-50 text-left"
                >
                  <Avatar
                    firstName={user.firstName}
                    lastName={user.lastName}
                    username={user.username}
                    size="sm"
                  />
                  <span className="flex-1 text-xs text-gray-800 truncate">
                    {chatUserDisplayName(user)}
                  </span>
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-[#F28C38] border-[#F28C38]' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            onClick={handleAddParticipants}
            disabled={!selectedIds.length || busy}
            className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium text-white bg-[#F28C38] disabled:opacity-40"
          >
            Ajouter au groupe
          </button>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto space-y-0.5 mb-4">
        {conversation.participants.map((participant) => (
          <div
            key={participant.userId}
            className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg"
          >
            <Avatar
              firstName={participant.user.firstName}
              lastName={participant.user.lastName}
              username={participant.user.username}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-800 truncate">
                {chatUserDisplayName(participant.user)}
              </div>
            </div>
            {participant.isAdmin && (
              <span className="text-[10px] font-semibold text-[#F28C38] bg-[#F28C38]/10 px-1.5 py-0.5 rounded-full shrink-0">
                Admin
              </span>
            )}
            {isAdmin && participant.userId !== currentUserId && (
              <button
                onClick={() => handleRemove(participant.userId)}
                aria-label="Retirer"
                className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleLeave}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" strokeWidth={2} />
        Quitter le groupe
      </button>
    </Modal>
  )
}
