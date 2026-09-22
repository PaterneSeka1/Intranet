'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { MessageCircle, Pin, Plus, Trash2, X } from 'lucide-react'
import { API_BASE } from '@/lib/api-base'
import {
  chatApi,
  chatUserDisplayName,
  conversationDisplayName,
  type ChatMessage,
  type Conversation,
  type ConversationSummary,
} from '@/lib/chat'
import { toast } from '@/lib/toast'
import { confirm } from '@/lib/confirm'
import { Avatar } from '@/components/ui/Avatar'
import { ConversationThread } from './ConversationThread'
import { NewConversationModal } from './NewConversationModal'
import { GroupInfoModal } from './GroupInfoModal'

const REFRESH_INTERVAL_MS = 60_000

// Position mémorisée par appareil/navigateur (préférence purement locale, non partagée) — cf.
// clampPosition/defaultPosition ci-dessous pour la logique de bornage à l'écran.
const WIDGET_POSITION_STORAGE_KEY = 'vdm_chat_widget_position'
const BUTTON_SIZE = 56
const EDGE_MARGIN = 20
const PANEL_GAP = 12
/** Distance de pointeur (px) au-delà de laquelle un pointerdown/up est traité comme un glisser
 * plutôt qu'un simple clic (sinon impossible d'ouvrir/fermer le widget par un clic normal). */
const DRAG_THRESHOLD_PX = 4

type Position = { x: number; y: number }

function clampPosition(pos: Position): Position {
  if (typeof window === 'undefined') return pos
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - BUTTON_SIZE - EDGE_MARGIN)
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - BUTTON_SIZE - EDGE_MARGIN)
  return {
    x: Math.min(Math.max(pos.x, EDGE_MARGIN), maxX),
    y: Math.min(Math.max(pos.y, EDGE_MARGIN), maxY),
  }
}

function defaultPosition(): Position {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return clampPosition({
    x: window.innerWidth - BUTTON_SIZE - EDGE_MARGIN,
    y: window.innerHeight - BUTTON_SIZE - EDGE_MARGIN,
  })
}

function loadStoredPosition(): Position | null {
  try {
    const raw = window.localStorage.getItem(WIDGET_POSITION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Position>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    return clampPosition({ x: parsed.x, y: parsed.y })
  } catch {
    return null
  }
}

/** Panneau ancré près du bouton, en s'ouvrant à l'opposé du bord le plus proche pour ne jamais
 * sortir de l'écran quel que soit l'endroit où le bouton a été déposé. */
function computePanelStyle(position: Position | null): CSSProperties {
  if (typeof window === 'undefined' || !position) {
    return { bottom: BUTTON_SIZE + EDGE_MARGIN + PANEL_GAP, right: EDGE_MARGIN }
  }
  const style: CSSProperties = {}
  if (position.y > window.innerHeight / 2)
    style.bottom = window.innerHeight - position.y + PANEL_GAP
  else style.top = position.y + BUTTON_SIZE + PANEL_GAP
  if (position.x > window.innerWidth / 2) style.right = window.innerWidth - position.x - BUTTON_SIZE
  else style.left = position.x
  return style
}

function socketUrl() {
  return `${API_BASE.replace(/\/$/, '')}/chat`
}

/** Épinglées en tête, sinon ordre déjà décroissant par activité — tri stable donc sans effet sur
 * l'ordre relatif au sein d'un même groupe (épinglé/non-épinglé). */
function sortConversations(list: ConversationSummary[]): ConversationSummary[] {
  return [...list].sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
}

function fmtPreview(message: ChatMessage | null): string {
  if (!message) return 'Aucun message'
  if (message.isDeleted) return 'Message supprimé'
  if (message.body) return message.body
  if (message.attachments.length) return `📎 ${message.attachments.length} pièce(s) jointe(s)`
  return ''
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  const [position, setPosition] = useState<Position | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const positionRef = useRef<Position>({ x: 0, y: 0 })
  // true juste après un glisser réel (pour ignorer le "click" natif que le navigateur émet quand
  // même après un mouseup/touchend — sinon le widget s'ouvrirait/fermerait involontairement à
  // chaque déplacement). Remis à false dès que ce click a été absorbé.
  const justDraggedRef = useRef(false)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const activeConversationIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])
  // Miroir de `open`, lu depuis le handler socket (fermé sur sa valeur initiale sinon) pour ne
  // notifier que si la conversation concernée n'est pas déjà affichée à l'écran.
  const openRef = useRef(false)
  useEffect(() => {
    openRef.current = open
  }, [open])

  // Position du bouton flottant : restaurée depuis localStorage (ou coin bas-droit par défaut),
  // re-bornée à l'écran si la fenêtre est redimensionnée après un déplacement.
  useEffect(() => {
    const initial = loadStoredPosition() ?? defaultPosition()
    positionRef.current = initial
    setPosition(initial)

    function handleResize() {
      setPosition((prev) => {
        const next = clampPosition(prev ?? defaultPosition())
        positionRef.current = next
        return next
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
      moved: false,
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
    drag.moved = true
    const next = clampPosition({ x: drag.originX + dx, y: drag.originY + dy })
    positionRef.current = next
    setPosition(next)
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (drag.moved) {
      justDraggedRef.current = true
      try {
        window.localStorage.setItem(
          WIDGET_POSITION_STORAGE_KEY,
          JSON.stringify(positionRef.current)
        )
      } catch {
        /* stockage indisponible (navigation privée…) — position simplement non mémorisée */
      }
    }
  }

  // Le "click" (natif — couvre aussi l'activation clavier Entrée/Espace sur le bouton, à la
  // différence des événements pointer) reste la seule source de vérité pour ouvrir/fermer le
  // widget ; on l'ignore une fois s'il vient de conclure un glisser réel.
  function handleButtonClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    setOpen((v) => !v)
  }

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

    socket.on(
      'message:new',
      ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
        const isActive = activeConversationIdRef.current === conversationId
        const isMine = message.senderId === currentUserId
        let found = true
        let matchedConversation: ConversationSummary | undefined
        setConversations((prev) => {
          if (!prev) return prev
          const idx = prev.findIndex((c) => c.id === conversationId)
          if (idx === -1) {
            found = false
            return prev
          }
          const conv = prev[idx]
          matchedConversation = conv
          const updated: ConversationSummary = {
            ...conv,
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount: isMine || isActive ? conv.unreadCount : conv.unreadCount + 1,
          }
          return sortConversations([updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)])
        })
        // Conversation absente de la liste locale (p. ex. supprimée/masquée) : un nouveau message
        // doit la faire réapparaître, cf. ChatService.listConversations.
        if (!found) refreshConversations()
        if (isActive) {
          setActiveMessages((prev) =>
            prev.some((m) => m.id === message.id) ? prev : [...prev, message]
          )
          if (!isMine) chatApi.markRead(conversationId).catch(() => {})
        }
        // Toast uniquement si le message n'est pas de moi et que sa conversation n'est pas déjà
        // affichée à l'écran (widget ouvert + conversation active) — sinon redondant avec le fil.
        const isOnScreen = openRef.current && isActive
        if (!isMine && !isOnScreen && matchedConversation) {
          const who =
            matchedConversation.type === 'GROUP'
              ? `${chatUserDisplayName(message.sender)} · ${conversationDisplayName(matchedConversation, currentUserId)}`
              : chatUserDisplayName(message.sender)
          toast.info(`${who} : ${fmtPreview(message)}`)
        }
      }
    )

    socket.on(
      'message:updated',
      ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
        if (activeConversationIdRef.current === conversationId) {
          setActiveMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)))
        }
        setConversations(
          (prev) =>
            prev?.map((c) =>
              c.lastMessage?.id === message.id ? { ...c, lastMessage: message } : c
            ) ?? prev
        )
      }
    )

    socket.on(
      'message:deleted',
      ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
        if (activeConversationIdRef.current === conversationId) {
          setActiveMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, body: null } : m))
          )
        }
        setConversations(
          (prev) =>
            prev?.map((c) =>
              c.lastMessage?.id === messageId
                ? { ...c, lastMessage: { ...c.lastMessage, isDeleted: true, body: null } }
                : c
            ) ?? prev
        )
      }
    )

    socket.on('conversation:new', () => refreshConversations())
    socket.on('conversation:updated', ({ conversationId }: { conversationId: string }) => {
      refreshConversations()
      if (activeConversationIdRef.current === conversationId) {
        chatApi
          .getConversation(conversationId)
          .then(setActiveConversation)
          .catch(() => {})
      }
    })
    socket.on(
      'conversation:read',
      ({
        conversationId,
        userId,
        lastReadAt,
      }: {
        conversationId: string
        userId: string
        lastReadAt: string
      }) => {
        if (activeConversationIdRef.current !== conversationId) return
        setActiveConversation((prev) =>
          prev
            ? {
                ...prev,
                participants: prev.participants.map((p) =>
                  p.userId === userId ? { ...p, lastReadAt } : p
                ),
              }
            : prev
        )
      }
    )
    // Épinglage/masquage synchronisés entre les onglets/appareils du même utilisateur (room privée
    // `user:{id}` côté gateway, cf. ChatGateway.emitConversationPinChanged/emitConversationHidden).
    socket.on(
      'conversation:pin-changed',
      ({ conversationId, isPinned }: { conversationId: string; isPinned: boolean }) => {
        setConversations((prev) =>
          prev
            ? sortConversations(prev.map((c) => (c.id === conversationId ? { ...c, isPinned } : c)))
            : prev
        )
      }
    )
    socket.on('conversation:hidden', ({ conversationId }: { conversationId: string }) => {
      setConversations((prev) => prev?.filter((c) => c.id !== conversationId) ?? prev)
      if (activeConversationIdRef.current === conversationId) setActiveConversationId(null)
    })
    socket.on(
      'typing:update',
      ({
        conversationId,
        userId,
        isTyping,
      }: {
        conversationId: string
        userId: string
        isTyping: boolean
      }) => {
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
      const [conversation, page] = await Promise.all([
        chatApi.getConversation(id),
        chatApi.listMessages(id),
      ])
      setActiveConversation(conversation)
      setActiveMessages(page.messages)
      setActiveHasMore(page.hasMore)
      setConversations(
        (prev) => prev?.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)) ?? prev
      )
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
      setActiveMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      )
      setConversations(
        (prev) =>
          prev?.map((c) =>
            c.id === activeConversationId
              ? { ...c, lastMessage: message, updatedAt: message.createdAt }
              : c
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
      setActiveMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, body: null } : m))
      )
    } catch {
      toast.error('Échec de la suppression du message.')
    }
  }

  function handleTyping(isTyping: boolean) {
    if (!activeConversationId) return
    socketRef.current?.emit(isTyping ? 'typing:start' : 'typing:stop', {
      conversationId: activeConversationId,
    })
  }

  async function handleCreateConversation(payload: {
    type: 'DIRECT' | 'GROUP'
    participantIds: string[]
    name?: string
  }) {
    try {
      const conversation = await chatApi.createConversation(payload)
      setShowNewConversation(false)
      await refreshConversations()
      await openConversation(conversation.id)
    } catch {
      toast.error('Impossible de créer la conversation.')
    }
  }

  async function handleTogglePin(conversation: ConversationSummary) {
    const next = !conversation.isPinned
    setConversations((prev) =>
      prev
        ? sortConversations(
            prev.map((c) => (c.id === conversation.id ? { ...c, isPinned: next } : c))
          )
        : prev
    )
    try {
      await chatApi.togglePin(conversation.id, next)
    } catch {
      toast.error(
        next
          ? "Impossible d'épingler cette conversation."
          : 'Impossible de désépingler cette conversation.'
      )
      refreshConversations()
    }
  }

  async function handleDeleteConversation(conversation: ConversationSummary) {
    const ok = await confirm({
      message: `Supprimer la conversation avec ${conversationDisplayName(conversation, currentUserId)} ? Elle réapparaîtra si de nouveaux messages arrivent.`,
      destructive: true,
    })
    if (!ok) return
    setConversations((prev) => prev?.filter((c) => c.id !== conversation.id) ?? prev)
    if (activeConversationId === conversation.id) setActiveConversationId(null)
    try {
      await chatApi.deleteConversation(conversation.id)
    } catch {
      toast.error('Impossible de supprimer cette conversation.')
      refreshConversations()
    }
  }

  // Badge du bouton flottant : nombre de conversations non lues (pas le total de messages non lus,
  // qui reste affiché par conversation dans la liste ci-dessous).
  const unreadConversationsCount = conversations?.filter((c) => c.unreadCount > 0).length ?? 0

  return (
    <>
      <button
        onClick={handleButtonClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          ...(position
            ? { left: position.x, top: position.y }
            : { right: EDGE_MARGIN, bottom: EDGE_MARGIN }),
          touchAction: 'none',
        }}
        aria-label="Messagerie (glisser pour déplacer)"
        title="Messagerie (glisser pour déplacer)"
        className="fixed z-[8500] w-14 h-14 rounded-full bg-[#F28C38] text-white shadow-xl flex items-center justify-center hover:brightness-105 transition-transform active:scale-95 cursor-grab active:cursor-grabbing select-none"
      >
        {open ? (
          <X className="w-6 h-6" strokeWidth={2} />
        ) : (
          <MessageCircle className="w-6 h-6" strokeWidth={2} />
        )}
        {!open && unreadConversationsCount > 0 && (
          <span
            title={`${unreadConversationsCount} conversation(s) non lue(s)`}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white"
          >
            {unreadConversationsCount > 9 ? '9+' : unreadConversationsCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={computePanelStyle(position)}
          className="fixed z-[8500] w-[380px] max-w-[calc(100vw-2rem)] h-[70dvh] max-h-[600px] bg-white rounded-2xl border border-gray-100 shadow-2xl flex flex-col overflow-hidden"
        >
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
                  title="Nouvelle conversation"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-[#F28C38] hover:brightness-105 transition-all"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations === null && (
                  <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
                )}
                {conversations?.length === 0 && (
                  <div className="text-center py-10 px-6">
                    <p className="text-sm text-gray-400 mb-3">
                      Aucune conversation pour le moment.
                    </p>
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
                    <div
                      key={conversation.id}
                      className={`group flex items-center gap-1 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        conversation.unreadCount > 0 ? 'bg-[#F28C38]/5' : ''
                      }`}
                    >
                      <button
                        onClick={() => openConversation(conversation.id)}
                        className="flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-3"
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
                            <span className="flex items-center gap-1 min-w-0">
                              {conversation.isPinned && (
                                <Pin
                                  className="w-3 h-3 text-[#F28C38] shrink-0 fill-current"
                                  strokeWidth={2}
                                  aria-label="Épinglée"
                                />
                              )}
                              <span
                                className="text-sm font-semibold text-gray-900 truncate"
                                title={conversationDisplayName(conversation, currentUserId)}
                              >
                                {conversationDisplayName(conversation, currentUserId)}
                              </span>
                            </span>
                            <span
                              className="text-[10px] text-gray-400 shrink-0"
                              title={new Date(conversation.updatedAt).toLocaleString('fr-FR', {
                                dateStyle: 'long',
                                timeStyle: 'short',
                              })}
                            >
                              {fmtTime(conversation.updatedAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p
                              className="text-xs text-gray-500 truncate"
                              title={fmtPreview(conversation.lastMessage)}
                            >
                              {fmtPreview(conversation.lastMessage)}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F28C38] text-white text-[10px] font-bold flex items-center justify-center">
                                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="hidden group-hover:flex items-center gap-0.5 pr-2 shrink-0">
                        <button
                          onClick={() => handleTogglePin(conversation)}
                          aria-label={conversation.isPinned ? 'Désépingler' : 'Épingler'}
                          title={conversation.isPinned ? 'Désépingler' : 'Épingler'}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            conversation.isPinned
                              ? 'text-[#F28C38] hover:bg-[#F28C38]/10'
                              : 'text-gray-400 hover:text-[#F28C38] hover:bg-[#F28C38]/10'
                          }`}
                        >
                          <Pin
                            className={`w-3.5 h-3.5 ${conversation.isPinned ? 'fill-current' : ''}`}
                            strokeWidth={2}
                          />
                        </button>
                        <button
                          onClick={() => handleDeleteConversation(conversation)}
                          aria-label="Supprimer la conversation"
                          title="Supprimer la conversation"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
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
