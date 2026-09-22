import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Namespace, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'

// Payloads déjà sérialisés par ChatService (formes `select` Prisma, pas les modèles bruts) —
// typage volontairement large, comme `NotifyPayload` dans notifications.service.ts.
type ConversationPayload = { id: string } & Record<string, unknown>
type MessagePayload = { id: string } & Record<string, unknown>

function corsOrigins() {
  const origins =
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  return origins.length ? origins : ['http://localhost:3000']
}

/** Extrait la valeur d'un cookie nommé depuis l'en-tête brut `Cookie` d'un handshake WebSocket. */
function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

const PRESENCE_ROOM = 'chat:presence'

/**
 * Gateway temps réel de la messagerie interne (namespace `/chat`).
 *
 * Présence en ligne et indicateur de saisie sont volontairement gardés en mémoire (pas de colonne
 * DB) : ils n'ont de sens que pour la durée d'une connexion, cf. absence totale de notion de
 * présence en ligne ailleurs dans le repo. Comme les autres gateways du projet (notifications,
 * annonces), ceci suppose une API en instance unique (fork, pas cluster) — voir ecosystem.config.js.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: corsOrigins(),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Gateway namespacé (`namespace: '/chat'`) : NestJS injecte ici directement l'instance
  // `Namespace` (= server.of('/chat')) et non le `Server` racine — d'où le typage `Namespace`,
  // nécessaire notamment pour `.sockets` (Map<socketId, Socket>) utilisé par joinConversation.
  @WebSocketServer()
  private server?: Namespace

  /** userId -> sockets connectés (plusieurs onglets/appareils possibles pour un même utilisateur). */
  private readonly onlineUsers = new Map<string, Set<string>>()

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const raw = client.handshake.headers.cookie
      if (!raw) throw new Error('no cookie')
      const cookieName = this.config.get<string>('COOKIE_NAME') ?? 'vdm_token'
      const token = parseCookie(raw, cookieName)
      if (!token) throw new Error('no token')

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      })
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true },
      })
      if (!user?.isActive) throw new Error('inactive')

      client.data.userId = user.id
      await client.join(`user:${user.id}`)
      await client.join(PRESENCE_ROOM)

      const conversationIds = await this.prisma.conversationParticipant.findMany({
        where: { userId: user.id },
        select: { conversationId: true },
      })
      await Promise.all(conversationIds.map((c) => client.join(`conversation:${c.conversationId}`)))

      const wasOffline = !this.onlineUsers.has(user.id)
      const sockets = this.onlineUsers.get(user.id) ?? new Set<string>()
      sockets.add(client.id)
      this.onlineUsers.set(user.id, sockets)

      client.emit('presence:init', { onlineUserIds: Array.from(this.onlineUsers.keys()) })
      if (wasOffline) {
        this.server?.to(PRESENCE_ROOM).emit('presence:update', { userId: user.id, isOnline: true })
      }
    } catch {
      client.disconnect(true)
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined
    if (!userId) return
    const sockets = this.onlineUsers.get(userId)
    sockets?.delete(client.id)
    if (!sockets?.size) {
      this.onlineUsers.delete(userId)
      this.server?.to(PRESENCE_ROOM).emit('presence:update', { userId, isOnline: false })
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(client: Socket, payload: { conversationId?: string }) {
    this.relayTyping(client, payload?.conversationId, true)
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(client: Socket, payload: { conversationId?: string }) {
    this.relayTyping(client, payload?.conversationId, false)
  }

  private relayTyping(client: Socket, conversationId: string | undefined, isTyping: boolean) {
    const userId = client.data?.userId as string | undefined
    if (!userId || !conversationId) return
    client
      .to(`conversation:${conversationId}`)
      .emit('typing:update', { conversationId, userId, isTyping })
  }

  /** Rejoint les sockets déjà connectés des participants ajoutés à la room de la conversation. */
  joinConversation(conversationId: string, userIds: string[]) {
    if (!this.server) return
    const room = `conversation:${conversationId}`
    for (const userId of userIds) {
      const sockets = this.onlineUsers.get(userId)
      sockets?.forEach((socketId) => this.server?.sockets.get(socketId)?.join(room))
    }
  }

  emitNewMessage(conversationId: string, message: MessagePayload) {
    this.server
      ?.to(`conversation:${conversationId}`)
      .emit('message:new', { conversationId, message })
  }

  emitMessageUpdated(conversationId: string, message: MessagePayload) {
    this.server
      ?.to(`conversation:${conversationId}`)
      .emit('message:updated', { conversationId, message })
  }

  emitMessageDeleted(conversationId: string, messageId: string) {
    this.server
      ?.to(`conversation:${conversationId}`)
      .emit('message:deleted', { conversationId, messageId })
  }

  // "Supprimer pour moi" : masquage privé, jamais diffusé aux autres participants de la conversation
  // (contrairement à emitMessageDeleted) — seulement synchronisé entre les onglets/appareils de
  // ce même utilisateur, comme emitConversationHidden.
  emitMessageHiddenForUser(userId: string, conversationId: string, messageId: string) {
    this.server?.to(`user:${userId}`).emit('message:hidden-for-me', { conversationId, messageId })
  }

  emitConversationNew(conversation: ConversationPayload, participantIds: string[]) {
    this.joinConversation(conversation.id, participantIds)
    this.server
      ?.to(participantIds.map((id) => `user:${id}`))
      .emit('conversation:new', { conversation })
  }

  emitConversationUpdated(conversationId: string) {
    this.server
      ?.to(`conversation:${conversationId}`)
      .emit('conversation:updated', { conversationId })
  }

  emitConversationRead(conversationId: string, userId: string, lastReadAt: Date) {
    this.server
      ?.to(`conversation:${conversationId}`)
      .emit('conversation:read', { conversationId, userId, lastReadAt })
  }

  // Épinglage/masquage sont des préférences privées : émis uniquement vers les autres
  // onglets/appareils du même utilisateur (room `user:{id}`), jamais vers toute la conversation.
  emitConversationPinChanged(userId: string, conversationId: string, isPinned: boolean) {
    this.server?.to(`user:${userId}`).emit('conversation:pin-changed', { conversationId, isPinned })
  }

  emitConversationHidden(userId: string, conversationId: string) {
    this.server?.to(`user:${userId}`).emit('conversation:hidden', { conversationId })
  }

  isOnline(userId: string): boolean {
    return this.onlineUsers.has(userId)
  }
}
