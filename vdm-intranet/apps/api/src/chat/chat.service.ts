import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ConversationType, Prisma } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { ChatGateway } from './chat.gateway'
import { chatUploadsDir } from './chat.storage'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { AddParticipantsDto } from './dto/add-participants.dto'

type Requester = { id: string }

const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  matricule: true,
  firstName: true,
  lastName: true,
  fullName: true,
} as const

const CONVERSATION_SELECT = {
  id: true,
  type: true,
  name: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  participants: {
    select: {
      userId: true,
      isAdmin: true,
      lastReadAt: true,
      joinedAt: true,
      user: { select: USER_SUMMARY_SELECT },
    },
  },
} as const

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  type: true,
  body: true,
  isEdited: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  sender: { select: USER_SUMMARY_SELECT },
  attachments: {
    select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true },
  },
} as const

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway
  ) {}

  /** Annuaire complet des employés actifs — volontairement sans restriction de BU/pôle/rôle. */
  async directory() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        ...USER_SUMMARY_SELECT,
        businessUnit: { select: { id: true, name: true, code: true } },
        pole: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 1000,
    })
  }

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      select: {
        ...CONVERSATION_SELECT,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: MESSAGE_SELECT },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })

    // Épinglage/masquage sont des préférences propres à `userId`, jamais exposées aux autres
    // participants (contrairement à `lastReadAt` dans CONVERSATION_SELECT) — récupérées à part.
    const mine = await this.prisma.conversationParticipant.findMany({
      where: { userId, conversationId: { in: conversations.map((c) => c.id) } },
      select: { conversationId: true, isPinned: true, hiddenAt: true },
    })
    const mineByConversation = new Map(mine.map((p) => [p.conversationId, p]))

    // Un seul aller-retour pour tous les compteurs non-lus (au lieu d'un COUNT par conversation) :
    // jointure sur conversation_participants pour appliquer le seuil lastReadAt propre à `userId`,
    // qui diffère d'une conversation à l'autre. Conversations absentes du résultat → 0 non-lu.
    const conversationIds = conversations.map((c) => c.id)
    const unreadRows = conversationIds.length
      ? await this.prisma.$queryRaw<{ conversationId: string; count: number }[]>`
          SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS "count"
          FROM "messages" m
          JOIN "conversation_participants" cp
            ON cp."conversationId" = m."conversationId" AND cp."userId" = ${userId}
          WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
            AND m."isDeleted" = false
            AND m."senderId" != ${userId}
            AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
          GROUP BY m."conversationId"
        `
      : []
    const unreadByConversation = new Map(unreadRows.map((r) => [r.conversationId, r.count]))

    const summaries = conversations.map(({ messages, ...conversation }) => ({
      ...conversation,
      lastMessage: messages[0] ?? null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
      mine: mineByConversation.get(conversation.id),
    }))

    // Une conversation "supprimée" (masquée) par cet utilisateur reste absente de sa liste tant
    // qu'aucun nouveau message n'est arrivé depuis — comportement calqué sur WhatsApp/Messenger
    // plutôt qu'une vraie suppression de l'historique (cf. deleteConversation ci-dessous).
    return summaries
      .filter(({ mine, lastMessage }) => {
        const hiddenAt = mine?.hiddenAt
        if (!hiddenAt) return true
        return !!lastMessage && new Date(lastMessage.createdAt) > hiddenAt
      })
      .map(({ mine, ...summary }) => ({ ...summary, isPinned: mine?.isPinned ?? false }))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
  }

  async getConversation(id: string, userId: string) {
    await this.assertParticipant(id, userId)
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: CONVERSATION_SELECT,
    })
    if (!conversation) throw new NotFoundException('Conversation introuvable.')
    return conversation
  }

  async createConversation(dto: CreateConversationDto, requester: Requester) {
    const participantIds = Array.from(new Set([...dto.participantIds, requester.id]))
    await this.ensureUsersExist(participantIds)

    if (dto.type === ConversationType.DIRECT) {
      if (participantIds.length !== 2) {
        throw new BadRequestException('Une conversation directe doit avoir exactement 2 participants.')
      }
      const [a, b] = participantIds
      // Réutiliser la conversation DIRECT existante entre ces 2 utilisateurs plutôt que d'en
      // recréer une nouvelle à chaque fois qu'on démarre une discussion avec la même personne.
      const existing = await this.prisma.conversation.findFirst({
        where: {
          type: ConversationType.DIRECT,
          AND: [{ participants: { some: { userId: a } } }, { participants: { some: { userId: b } } }],
        },
        select: { id: true },
      })
      if (existing) {
        // Redémarrer une discussion que le demandeur avait supprimée (masquée) doit la refaire
        // apparaître dans sa liste, sinon elle resterait invisible malgré l'ouverture immédiate.
        await this.prisma.conversationParticipant.updateMany({
          where: { conversationId: existing.id, userId: requester.id, hiddenAt: { not: null } },
          data: { hiddenAt: null },
        })
        return this.getConversation(existing.id, requester.id)
      }
    } else if (participantIds.length < 3) {
      throw new BadRequestException('Un groupe doit avoir au moins 2 autres participants.')
    }

    const name =
      dto.type === ConversationType.GROUP
        ? this.cleanRequiredText(dto.name, 'Le nom du groupe est obligatoire.')
        : null

    const conversation = await this.prisma.conversation.create({
      data: {
        type: dto.type,
        name,
        createdById: requester.id,
        participants: {
          create: participantIds.map((userId) => ({
            userId,
            isAdmin: dto.type === ConversationType.GROUP && userId === requester.id,
          })),
        },
      },
      select: CONVERSATION_SELECT,
    })

    this.gateway.emitConversationNew(conversation, participantIds)
    return conversation
  }

  async renameConversation(id: string, name: string, requester: Requester) {
    const participant = await this.assertParticipant(id, requester.id)
    const conversation = await this.prisma.conversation.findUnique({ where: { id } })
    if (!conversation) throw new NotFoundException('Conversation introuvable.')
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Seuls les groupes peuvent être renommés.')
    }
    if (!participant.isAdmin) {
      throw new ForbiddenException("Seul un administrateur du groupe peut le renommer.")
    }

    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { name: this.cleanRequiredText(name, 'Le nom du groupe est obligatoire.') },
      select: CONVERSATION_SELECT,
    })
    this.gateway.emitConversationUpdated(id)
    return updated
  }

  async addParticipants(id: string, dto: AddParticipantsDto, requester: Requester) {
    const participant = await this.assertParticipant(id, requester.id)
    const conversation = await this.prisma.conversation.findUnique({ where: { id } })
    if (!conversation) throw new NotFoundException('Conversation introuvable.')
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException("On ne peut pas ajouter de participant à une conversation directe.")
    }
    if (!participant.isAdmin) {
      throw new ForbiddenException('Seul un administrateur du groupe peut ajouter des participants.')
    }

    const existing = await this.prisma.conversationParticipant.findMany({
      where: { conversationId: id },
      select: { userId: true },
    })
    const existingIds = new Set(existing.map((p) => p.userId))
    const newIds = dto.participantIds.filter((uid) => !existingIds.has(uid))
    if (!newIds.length) return this.getConversation(id, requester.id)

    await this.ensureUsersExist(newIds)
    await this.prisma.conversationParticipant.createMany({
      data: newIds.map((userId) => ({ conversationId: id, userId })),
    })

    this.gateway.joinConversation(id, newIds)
    const updated = await this.getConversation(id, requester.id)
    this.gateway.emitConversationNew(updated, newIds)
    this.gateway.emitConversationUpdated(id)
    return updated
  }

  async removeParticipant(id: string, targetUserId: string, requester: Requester) {
    const participant = await this.assertParticipant(id, requester.id)
    const conversation = await this.prisma.conversation.findUnique({ where: { id } })
    if (!conversation) throw new NotFoundException('Conversation introuvable.')
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException("On ne peut pas retirer de participant d'une conversation directe.")
    }
    const isSelf = targetUserId === requester.id
    if (!isSelf && !participant.isAdmin) {
      throw new ForbiddenException('Seul un administrateur du groupe peut retirer un participant.')
    }

    await this.prisma.conversationParticipant.deleteMany({
      where: { conversationId: id, userId: targetUserId },
    })
    this.gateway.emitConversationUpdated(id)
    return { removed: true }
  }

  async listMessages(conversationId: string, userId: string, before?: string, limit = 30) {
    await this.assertParticipant(conversationId, userId)
    const take = Math.min(100, Math.max(1, limit))

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      select: MESSAGE_SELECT,
      orderBy: { createdAt: 'desc' },
      take,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    })

    return { messages: messages.reverse(), hasMore: messages.length === take }
  }

  async sendMessage(
    conversationId: string,
    body: string | undefined,
    files: Express.Multer.File[],
    requester: Requester
  ) {
    await this.assertParticipant(conversationId, requester.id)

    const cleanBody = body?.trim() || null
    if (!cleanBody && !files.length) {
      throw new BadRequestException('Un message doit contenir du texte ou au moins une pièce jointe.')
    }

    // Regroupées dans une transaction : un seul aller-retour réseau plutôt que deux appels
    // séquentiels, et garantit que la conversation "remonte" toujours en cohérence avec le message.
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId: requester.id,
          body: cleanBody,
          type: files.length ? 'FILE' : 'TEXT',
          attachments: {
            create: files.map((file) => ({
              fileName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              storageKey: file.filename,
            })),
          },
        },
        select: MESSAGE_SELECT,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ])

    this.gateway.emitNewMessage(conversationId, message)
    return message
  }

  async editMessage(messageId: string, body: string, requester: Requester) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!message || message.isDeleted) throw new NotFoundException('Message introuvable.')
    if (message.senderId !== requester.id) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres messages.')
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { body: body.trim(), isEdited: true },
      select: MESSAGE_SELECT,
    })
    this.gateway.emitMessageUpdated(message.conversationId, updated)
    return updated
  }

  async deleteMessage(messageId: string, requester: Requester) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!message || message.isDeleted) throw new NotFoundException('Message introuvable.')
    if (message.senderId !== requester.id) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres messages.')
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, body: null },
    })
    this.gateway.emitMessageDeleted(message.conversationId, messageId)
    return { deleted: true }
  }

  async markRead(conversationId: string, requester: Requester) {
    await this.assertParticipant(conversationId, requester.id)
    const now = new Date()
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: requester.id } },
      data: { lastReadAt: now },
    })
    this.gateway.emitConversationRead(conversationId, requester.id, now)
    return { lastReadAt: now }
  }

  async togglePin(id: string, pinned: boolean, requester: Requester) {
    await this.assertParticipant(id, requester.id)
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: requester.id } },
      data: { isPinned: pinned, pinnedAt: pinned ? new Date() : null },
    })
    this.gateway.emitConversationPinChanged(requester.id, id, pinned)
    return { isPinned: pinned }
  }

  /** "Suppression" d'une conversation = masquage de sa liste pour ce seul utilisateur : l'historique
   * et les autres participants ne sont pas affectés, et elle réapparaît si un nouveau message
   * arrive (cf. listConversations). Distinct de removeParticipant, qui quitte réellement un groupe. */
  async deleteConversation(id: string, requester: Requester) {
    await this.assertParticipant(id, requester.id)
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: requester.id } },
      data: { hiddenAt: new Date(), isPinned: false, pinnedAt: null },
    })
    this.gateway.emitConversationHidden(requester.id, id)
    return { deleted: true }
  }

  async downloadAttachment(attachmentId: string, requester: Requester) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        fileName: true,
        mimeType: true,
        storageKey: true,
        message: { select: { conversationId: true, isDeleted: true } },
      },
    })
    if (!attachment || attachment.message.isDeleted) {
      throw new NotFoundException('Pièce jointe introuvable.')
    }
    await this.assertParticipant(attachment.message.conversationId, requester.id)

    const filePath = path.join(chatUploadsDir(), attachment.storageKey)
    if (!fs.existsSync(filePath)) throw new NotFoundException('Fichier introuvable sur le serveur.')

    return { attachment, filePath }
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    })
    if (!participant) throw new NotFoundException('Conversation introuvable.')
    return participant
  }

  private async ensureUsersExist(userIds: string[]) {
    const count = await this.prisma.user.count({
      where: { id: { in: userIds }, isActive: true },
    })
    if (count !== userIds.length) {
      throw new BadRequestException('Un ou plusieurs participants sont introuvables ou inactifs.')
    }
  }

  private cleanRequiredText(value: string | null | undefined, message: string) {
    const cleaned = value?.trim()
    if (!cleaned) throw new BadRequestException(message)
    return cleaned
  }
}
