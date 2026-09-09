'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { MessageCircle, Plus, X } from 'lucide-react'
import { API_BASE } from '@/lib/api-base'
import {
  chatApi,
  conversationDisplayName,
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
} from '@/lib/chat'
import { toast } from '@/lib/toast'
import { Avatar } from '@/components/ui/Avatar'
import { ConversationThread } from './ConversationThread'
import { NewConversationModal } from './NewConversationModal'
import { GroupInfoModal } from './GroupInfoModal'

const REFRESH_INTERVAL_MS = 60_000

function socketUrl() {
  return `${API_BASE.replace(/\/$/, '')}/chat`
}

function fmtPreview(message: ChatMessage | null): string {
  if (!message) return 'Aucun message'
  if (message.isDeleted) return 'Message supprimé'
  if (message.body) return message.body
  if (message.attachments.length) return `📎 ${message.attachments.length} pièce(s) jointe(s)`
  return ''
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

interface ChatWidgetProps {
  currentUserId: string
}

export function ChatWidget({ currentUserId }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([])
  const [activeHasMore, setActiveHasMore] = useState(false)
  const [activeLoading, setActiveLoading] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const activeConversationIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  const refreshConversations = useCallback(async () => {
    try {
      const list = await chatApi.listConversations()
      setConversations(list)
    } catch {
      /* garde la liste courante si le refresh échoue */
    }
  }, [])

  // Connexion socket + listeners globaux (une seule fois) — pattern identique à NotificationsBell /
  // LiveAnnouncements : socket + polling de secours en parallèle.
  useEffect(() => {
    refreshConversations()
    const socket = io(socketUrl(), { withCredentials: true, transports: ['websocket', 'polling'] })
    socketRef.current = socket
    const intervalId = window.setInterval(refreshConversations, REFRESH_INTERVAL_MS)

    socket.on('connect', refreshConversations)

    socket.on('presence:init', ({ onlineUserIds: ids }: { onlineUserIds: string[] }) => {
      setOnlineUserIds(new Set(ids))
    })
    socket.on('presence:update', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev)
        if (isOnline) next.add(userId)
        else next.delete(userId)
        return next
      })
    })

    socket.on('message:new', ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
      const isActive = activeConversationIdRef.current === conversationId
      const isMine = message.senderId === currentUserId
      setConversations((prev) => {
        if (!prev) return prev
        const idx = prev.findIndex((c) => c.id === conversationId)
        if (idx === -1) return prev
        const conv = prev[idx]
        const updated: ConversationSummary = {
          ...conv,
          lastMessage: message,
          updatedAt: message.createdAt,
          unreadCount: isMine || isActive ? conv.unreadCount : conv.unreadCount + 1,
        }
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
      })
      if (isActive) {
        setActiveMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
        if (!isMine) chatApi.markRead(conversationId).catch(() => {})
      }
    })

    socket.on('message:updated', ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
      if (activeConversationIdRef.current === conversationId) {
        setActiveMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)))
      }
      setConversations((prev) =>
        prev?.map((c) => (c.lastMessage?.id === message.id ? { ...c, lastMessage: message } : c)) ?? prev
      )
    })

    socket.on('message:deleted', ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      if (activeConversationIdRef.current === conversationId) {
        setActiveMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, body: null } : m))
        )
      }
      setConversations((prev) =>
        prev?.map((c) =>
          c.lastMessage?.id === messageId ? { ...c, lastMessage: { ...c.lastMessage, isDeleted: true, body: null } } : c
        ) ?? prev
      )
    })

    socket.on('conversation:new', () => refreshConversations())
    socket.on('conversation:updated', ({ conversationId }: { conversationId: string }) => {
      refreshConversations()
      if (activeConversationIdRef.current === conversationId) {
        chatApi.getConversation(conversationId).then(setActiveConversation).catch(() => {})
      }
    })
    socket.on(
      'conversation:read',
      ({ conversationId, userId, lastReadAt }: { conversationId: string; userId: string; lastReadAt: string }) => {
        if (activeConversationIdRef.current !== conversationId) return
        setActiveConversation((prev) =>
          prev
            ? {
                ...prev,
                participants: prev.participants.map((p) => (p.userId === userId ? { ...p, lastReadAt } : p)),
              }
            : prev
        )
      }
    )
    socket.on(
      'typing:update',
      ({ conversationId, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) => {
        if (activeConversationIdRef.current !== conversationId || userId === currentUserId) return
        setTypingUsers((prev) => {
          const next = new Set(prev)
          if (isTyping) next.add(userId)
          else next.delete(userId)
          return next
        })
      }
    )

    return () => {
      window.clearInterval(intervalId)
      socket.disconnect()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, refreshConversations])

  async function openConversation(id: string) {
    setActiveConversationId(id)
    setActiveConversation(null)
    setActiveMessages([])
    setActiveHasMore(false)
    setTypingUsers(new Set())
    setActiveLoading(true)
    try {
      const [conversation, page] = await Promise.all([chatApi.getConversation(id), chatApi.listMessages(id)])
      setActiveConversation(conversation)
      setActiveMessages(page.messages)
      setActiveHasMore(page.hasMore)
      setConversations((prev) => prev?.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)) ?? prev)
      await chatApi.markRead(id)
    } catch {
      toast.error('Impossible de charger cette conversation.')
      setActiveConversationId(null)
    } finally {
      setActiveLoading(false)
    }
  }

  async function loadOlderMessages() {
    if (!activeConversationId || !activeMessages.length) return
    try {
      const page = await chatApi.listMessages(activeConversationId, activeMessages[0].id)
      setActiveMessages((prev) => [...page.messages, ...prev])
      setActiveHasMore(page.hasMore)
    } catch {
      toast.error('Impossible de charger les messages précédents.')
    }
  }

  async function handleSend(body: string, files: File[]) {
    if (!activeConversationId) return
    try {
      const message = await chatApi.sendMessage(activeConversationId, body, files)
      setActiveMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
      setConversations((prev) =>
        prev?.map((c) =>
          c.id === activeConversationId ? { ...c, lastMessage: message, updatedAt: message.createdAt } : c
        ) ?? prev
      )
    } catch {
      toast.error("Échec de l'envoi du message.")
    }
  }

  async function handleEditMessage(messageId: string, body: string) {
    try {
      const message = await chatApi.editMessage(messageId, body)
      setActiveMessages((prev) => prev.map((m) => (m.id === messageId ? message : m)))
    } catch {
      toast.error('Échec de la modification du message.')
    }
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      await chatApi.deleteMessage(messageId)
      setActiveMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, body: null } : m)))
    } catch {
      toast.error('Échec de la suppression du message.')
    }
  }

  function handleTyping(isTyping: boolean) {
    if (!activeConversationId) return
    socketRef.current?.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId: activeConversationId })
  }

  async function handleCreateConversation(payload: { type: 'DIRECT' | 'GROUP'; participantIds: string[]; name?: string }) {
    try {
      const conversation = await chatApi.createConversation(payload)
      setShowNewConversation(false)
      await refreshConversations()
      await openConversation(conversation.id)
    } catch {
      toast.error('Impossible de créer la conversation.')
    }
  }

  const totalUnread = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Messagerie"
        className="fixed bottom-5 right-5 z-[8500] w-14 h-14 rounded-full bg-[#F28C38] text-white shadow-xl flex items-center justify-center hover:brightness-105 transition-all active:scale-95"
      >
        {open ? <X className="w-6 h-6" strokeWidth={2} /> : <MessageCircle className="w-6 h-6" strokeWidth={2} />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[8500] w-[380px] max-w-[calc(100vw-2rem)] h-[70dvh] max-h-[600px] bg-white rounded-2xl border border-gray-100 shadow-2xl flex flex-col overflow-hidden">
          {activeConversationId && activeConversation ? (
            <ConversationThread
              conversation={activeConversation}
              messages={activeMessages}
              hasMore={activeHasMore}
              loading={activeLoading}
              currentUserId={currentUserId}
              onlineUserIds={onlineUserIds}
              typingUserIds={typingUsers}
              onBack={() => setActiveConversationId(null)}
              onLoadMore={loadOlderMessages}
              onSend={handleSend}
              onTyping={handleTyping}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onOpenGroupInfo={() => setShowGroupInfo(true)}
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                <span className="font-bold text-sm text-gray-900">Messagerie</span>
                <button
                  onClick={() => setShowNewConversation(true)}
                  aria-label="Nouvelle conversation"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-[#F28C38] hover:brightness-105 transition-all"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations === null && <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>}
                {conversations?.length === 0 && (
                  <div className="text-center py-10 px-6">
                    <p className="text-sm text-gray-400 mb-3">Aucune conversation pour le moment.</p>
                    <button
                      onClick={() => setShowNewConversation(true)}
                      className="text-sm text-[#F28C38] font-medium hover:underline"
                    >
                      Démarrer une conversation
                    </button>
                  </div>
                )}
                {conversations?.map((conversation) => {
                  const other =
                    conversation.type === 'DIRECT'
                      ? conversation.participants.find((p) => p.userId !== currentUserId)?.user
                      : null
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => openConversation(conversation.id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        conversation.unreadCount > 0 ? 'bg-[#F28C38]/5' : ''
                      }`}
                    >
                      {conversation.type === 'GROUP' ? (
                        <Avatar username={conversation.name ?? 'Groupe'} size="md" />
                      ) : (
                        <Avatar
                          firstName={other?.firstName}
                          lastName={other?.lastName}
                          username={other?.username ?? '?'}
                          size="md"
                          online={other ? onlineUserIds.has(other.id) : undefined}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {conversationDisplayName(conversation, currentUserId)}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0">{fmtTime(conversation.updatedAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-gray-500 truncate">{fmtPreview(conversation.lastMessage)}</p>
                          {conversation.unreadCount > 0 && (
                            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F28C38] text-white text-[10px] font-bold flex items-center justify-center">
                              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {showNewConversation && (
        <NewConversationModal
          currentUserId={currentUserId}
          onClose={() => setShowNewConversation(false)}
          onCreate={handleCreateConversation}
        />
      )}

      {showGroupInfo && activeConversation && (
        <GroupInfoModal
          conversation={activeConversation}
          currentUserId={currentUserId}
          onClose={() => setShowGroupInfo(false)}
          onChanged={async () => {
            const updated = await chatApi.getConversation(activeConversation.id)
            setActiveConversation(updated)
            refreshConversations()
          }}
          onLeft={() => {
            setShowGroupInfo(false)
            setActiveConversationId(null)
            refreshConversations()
          }}
        />
      )}
    </>
  )
}
