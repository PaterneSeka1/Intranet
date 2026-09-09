'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Info,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  chatApi,
  chatUserDisplayName,
  conversationDisplayName,
  type ChatMessage,
  type Conversation,
} from '@/lib/chat'
import { Avatar } from '@/components/ui/Avatar'
import { confirm } from '@/lib/confirm'
import { toast } from '@/lib/toast'

const MAX_FILES_PER_MESSAGE = 5
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
const TYPING_STOP_DELAY_MS = 2500

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

interface ConversationThreadProps {
  conversation: Conversation
  messages: ChatMessage[]
  hasMore: boolean
  loading: boolean
  currentUserId: string
  onlineUserIds: Set<string>
  typingUserIds: Set<string>
  onBack: () => void
  onLoadMore: () => void
  onSend: (body: string, files: File[]) => void
  onTyping: (isTyping: boolean) => void
  onEditMessage: (messageId: string, body: string) => void
  onDeleteMessage: (messageId: string) => void
  onOpenGroupInfo: () => void
}

export function ConversationThread({
  conversation,
  messages,
  hasMore,
  loading,
  currentUserId,
  onlineUserIds,
  typingUserIds,
  onBack,
  onLoadMore,
  onSend,
  onTyping,
  onEditMessage,
  onDeleteMessage,
  onOpenGroupInfo,
}: ConversationThreadProps) {
  const [body, setBody] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<number | null>(null)
  const wasTypingRef = useRef(false)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversation.id])

  const other = conversation.type === 'DIRECT' ? conversation.participants.find((p) => p.userId !== currentUserId) : null
  const isOnline = other ? onlineUserIds.has(other.userId) : false

  const typingNames = Array.from(typingUserIds)
    .map((id) => {
      const participant = conversation.participants.find((p) => p.userId === id)
      return participant ? chatUserDisplayName(participant.user).split(' ')[0] : null
    })
    .filter(Boolean)

  function stopTypingNow() {
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
    if (wasTypingRef.current) {
      onTyping(false)
      wasTypingRef.current = false
    }
  }

  function handleBodyChange(value: string) {
    setBody(value)
    if (value.trim()) {
      if (!wasTypingRef.current) {
        onTyping(true)
        wasTypingRef.current = true
      }
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = window.setTimeout(stopTypingNow, TYPING_STOP_DELAY_MS)
    } else {
      stopTypingNow()
    }
  }

  function handleFilePick(fileList: FileList | null) {
    if (!fileList?.length) return
    const incoming = Array.from(fileList)
    const tooBig = incoming.filter((f) => f.size > MAX_FILE_SIZE_BYTES)
    if (tooBig.length) toast.error(`Fichier trop volumineux (15 Mo max) : ${tooBig[0].name}`)
    const next = [...pendingFiles, ...incoming.filter((f) => f.size <= MAX_FILE_SIZE_BYTES)].slice(
      0,
      MAX_FILES_PER_MESSAGE
    )
    setPendingFiles(next)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSend() {
    const trimmed = body.trim()
    if (!trimmed && !pendingFiles.length) return
    onSend(trimmed, pendingFiles)
    setBody('')
    setPendingFiles([])
    stopTypingNow()
  }

  function startEdit(message: ChatMessage) {
    setEditingId(message.id)
    setEditingBody(message.body ?? '')
  }

  function saveEdit() {
    if (!editingId) return
    const trimmed = editingBody.trim()
    if (trimmed) onEditMessage(editingId, trimmed)
    setEditingId(null)
  }

  async function handleDelete(messageId: string) {
    const ok = await confirm({
      message: 'Supprimer ce message ? Cette action est irréversible.',
      destructive: true,
    })
    if (ok) onDeleteMessage(messageId)
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 shrink-0">
        <button
          onClick={onBack}
          aria-label="Retour"
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        </button>
        {conversation.type === 'GROUP' ? (
          <Avatar username={conversation.name ?? 'Groupe'} size="sm" />
        ) : (
          <Avatar
            firstName={other?.user.firstName}
            lastName={other?.user.lastName}
            username={other?.user.username ?? '?'}
            size="sm"
            online={isOnline}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {conversationDisplayName(conversation, currentUserId)}
          </div>
          <div className="text-[11px] text-gray-400 truncate">
            {conversation.type === 'GROUP'
              ? `${conversation.participants.length} membres`
              : isOnline
                ? 'En ligne'
                : 'Hors ligne'}
          </div>
        </div>
        {conversation.type === 'GROUP' && (
          <button
            onClick={onOpenGroupInfo}
            aria-label="Informations du groupe"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
          >
            <Info className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {hasMore && (
          <div className="text-center">
            <button onClick={onLoadMore} className="text-xs text-[#F28C38] font-medium hover:underline">
              Charger les messages précédents
            </button>
          </div>
        )}
        {loading && <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Aucun message. Dites bonjour 👋</p>
        )}
        {messages.map((message) => {
          const isMine = message.senderId === currentUserId
          const isRead =
            conversation.type === 'DIRECT' &&
            isMine &&
            !!other?.lastReadAt &&
            new Date(other.lastReadAt) >= new Date(message.createdAt)
          const isEditing = editingId === message.id

          return (
            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`group max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                {conversation.type === 'GROUP' && !isMine && (
                  <span className="text-[10px] text-gray-400 mb-0.5 px-1">
                    {chatUserDisplayName(message.sender)}
                  </span>
                )}
                <div
                  className={`relative rounded-2xl px-3 py-2 ${
                    message.isDeleted
                      ? 'bg-gray-50 text-gray-400 italic text-sm'
                      : isMine
                        ? 'bg-[#F28C38] text-white'
                        : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.isDeleted ? (
                    <span className="text-sm">Message supprimé</span>
                  ) : isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="text-sm text-gray-900 bg-white rounded-lg px-2 py-1 outline-none min-w-[140px]"
                      />
                      <button onClick={saveEdit} className="text-white/90 hover:text-white shrink-0">
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-white/90 hover:text-white shrink-0">
                        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {message.body && <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>}
                      {message.attachments.map((attachment) =>
                        isImage(attachment.mimeType) ? (
                          <a
                            key={attachment.id}
                            href={chatApi.attachmentUrl(attachment.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="block mt-1.5"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={chatApi.attachmentUrl(attachment.id)}
                              alt={attachment.fileName}
                              className="max-w-full max-h-48 rounded-lg object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            key={attachment.id}
                            href={chatApi.attachmentUrl(attachment.id)}
                            target="_blank"
                            rel="noreferrer"
                            className={`mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                              isMine ? 'bg-white/15 hover:bg-white/25' : 'bg-white hover:bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <Paperclip className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                            <span className="truncate flex-1">{attachment.fileName}</span>
                            <span className="opacity-70 shrink-0">{fmtSize(attachment.size)}</span>
                          </a>
                        )
                      )}
                    </>
                  )}

                  {!message.isDeleted && isMine && !isEditing && (
                    <div className="absolute -left-14 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                      {message.type === 'TEXT' && (
                        <button
                          onClick={() => startEdit(message)}
                          aria-label="Modifier"
                          className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(message.id)}
                        aria-label="Supprimer"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 px-1">
                  <span className="text-[10px] text-gray-400">
                    {fmtTime(message.createdAt)}
                    {message.isEdited && !message.isDeleted ? ' · modifié' : ''}
                  </span>
                  {isRead ? (
                    <CheckCheck className="w-3 h-3 text-[#F28C38]" strokeWidth={2} />
                  ) : isMine && !message.isDeleted ? (
                    <Check className="w-3 h-3 text-gray-300" strokeWidth={2} />
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {typingNames.length > 0 && (
        <div className="px-3 pb-1 text-[11px] text-gray-400 italic flex items-center gap-1 shrink-0">
          <Users className="w-3 h-3" strokeWidth={2} />
          {typingNames.length === 1 ? `${typingNames[0]} écrit…` : 'Plusieurs personnes écrivent…'}
        </div>
      )}

      <div className="border-t border-gray-100 p-2.5 shrink-0">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingFiles.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className="flex items-center gap-1 bg-gray-100 rounded-full pl-2 pr-1 py-1 text-xs text-gray-600"
              >
                <span className="truncate max-w-[120px]">{file.name}</span>
                <button
                  onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-gray-200"
                >
                  <X className="w-3 h-3" strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => handleFilePick(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Joindre un fichier"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0"
          >
            <Paperclip className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </button>
          <textarea
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Écrire un message…"
            rows={1}
            className="flex-1 resize-none max-h-24 rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#F28C38] transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() && !pendingFiles.length}
            aria-label="Envoyer"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[#F28C38] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-105 transition-all shrink-0"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </>
  )
}
