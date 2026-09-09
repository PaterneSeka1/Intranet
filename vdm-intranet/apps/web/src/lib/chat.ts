import { apiFetch } from './http'
import { API_BASE } from './api-base'

export type ConversationType = 'DIRECT' | 'GROUP'
export type ChatMessageType = 'TEXT' | 'FILE'

export type ChatUserSummary = {
  id: string
  username: string
  matricule: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
}

export type ChatDirectoryUser = ChatUserSummary & {
  businessUnit: { id: string; name: string; code: string } | null
  pole: { id: string; name: string; code: string } | null
}

export type ConversationParticipant = {
  userId: string
  isAdmin: boolean
  lastReadAt: string | null
  joinedAt: string
  user: ChatUserSummary
}

export type MessageAttachment = {
  id: string
  fileName: string
  mimeType: string
  size: number
  createdAt: string
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  type: ChatMessageType
  body: string | null
  isEdited: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  sender: ChatUserSummary
  attachments: MessageAttachment[]
}

export type Conversation = {
  id: string
  type: ConversationType
  name: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  participants: ConversationParticipant[]
}

export type ConversationSummary = Conversation & {
  lastMessage: ChatMessage | null
  unreadCount: number
}

export type MessagesPage = { messages: ChatMessage[]; hasMore: boolean }

function req<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, init)
}

export const chatApi = {
  directory: () => req<ChatDirectoryUser[]>('/chat/users'),

  listConversations: () => req<ConversationSummary[]>('/chat/conversations'),

  createConversation: (payload: { type: ConversationType; participantIds: string[]; name?: string }) =>
    req<Conversation>('/chat/conversations', { method: 'POST', body: JSON.stringify(payload) }),

  getConversation: (id: string) => req<Conversation>(`/chat/conversations/${id}`),

  renameConversation: (id: string, name: string) =>
    req<Conversation>(`/chat/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  addParticipants: (id: string, participantIds: string[]) =>
    req<Conversation>(`/chat/conversations/${id}/participants`, {
      method: 'POST',
      body: JSON.stringify({ participantIds }),
    }),

  removeParticipant: (id: string, userId: string) =>
    req<{ removed: boolean }>(`/chat/conversations/${id}/participants/${userId}`, {
      method: 'DELETE',
    }),

  listMessages: (id: string, before?: string, limit = 30) => {
    const qs = new URLSearchParams({ limit: String(limit) })
    if (before) qs.set('before', before)
    return req<MessagesPage>(`/chat/conversations/${id}/messages?${qs.toString()}`)
  },

  sendMessage: (id: string, body: string, files: File[]) => {
    const form = new FormData()
    if (body) form.set('body', body)
    files.forEach((file) => form.append('files', file))
    return req<ChatMessage>(`/chat/conversations/${id}/messages`, { method: 'POST', body: form })
  },

  editMessage: (id: string, body: string) =>
    req<ChatMessage>(`/chat/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) }),

  deleteMessage: (id: string) => req<{ deleted: boolean }>(`/chat/messages/${id}`, { method: 'DELETE' }),

  markRead: (id: string) =>
    req<{ lastReadAt: string }>(`/chat/conversations/${id}/read`, { method: 'PATCH' }),

  attachmentUrl: (attachmentId: string) => `${API_BASE}/api/chat/attachments/${attachmentId}`,
}

/** Nom d'affichage d'un utilisateur, cohérent avec le reste de l'app (prénom+nom, sinon username). */
export function chatUserDisplayName(user: ChatUserSummary): string {
  return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username
}

/** Nom d'affichage d'une conversation : nom du groupe, sinon l'autre participant en DIRECT. */
export function conversationDisplayName(conversation: Conversation, currentUserId: string): string {
  if (conversation.type === 'GROUP') return conversation.name || 'Groupe'
  const other = conversation.participants.find((p) => p.userId !== currentUserId)
  return other ? chatUserDisplayName(other.user) : 'Conversation'
}

export function chatInitials(user: ChatUserSummary): string {
  const f = user.firstName?.trim()
  const l = user.lastName?.trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  return user.username.slice(0, 2).toUpperCase()
}
