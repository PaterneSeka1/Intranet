import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { LogAction, NotificationType, Prisma, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAnnouncementDto } from './dto/create-announcement.dto'
import { UpdateAnnouncementDto } from './dto/update-announcement.dto'
import { AnnouncementsGateway } from './announcements.gateway'
import { NotificationsService } from '../notifications/notifications.service'
import { CAN_MANAGE_ANNOUNCEMENTS } from '../common/permissions'

type Requester = { id: string; role: Role; businessUnitId?: string | null }

const ANNOUNCEMENT_SELECT = {
  id: true,
  title: true,
  body: true,
  businessUnitId: true,
  isPinned: true,
  isActive: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  businessUnit: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, username: true, fullName: true } },
} as const

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly announcementsGateway: AnnouncementsGateway,
    private readonly notifications: NotificationsService
  ) {}

  findAll(requester: Requester | undefined, activeOnly = false) {
    const canSeeAll = requester && CAN_MANAGE_ANNOUNCEMENTS.includes(requester.role)
    const now = new Date()
    const whereParts: Prisma.AnnouncementWhereInput[] = []

    if (activeOnly || !canSeeAll) {
      whereParts.push({
        isActive: true,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      })
    }

    if (!canSeeAll) {
      whereParts.push({
        OR: requester?.businessUnitId
          ? [{ businessUnitId: null }, { businessUnitId: requester.businessUnitId }]
          : [{ businessUnitId: null }],
      })
    }

    const where: Prisma.AnnouncementWhereInput = whereParts.length ? { AND: whereParts } : {}

    return this.prisma.announcement.findMany({
      where,
      select: ANNOUNCEMENT_SELECT,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 100,
    })
  }

  async create(dto: CreateAnnouncementDto, requester: Requester) {
    if (!CAN_MANAGE_ANNOUNCEMENTS.includes(requester.role)) {
      throw new ForbiddenException('Réservé aux administrateurs.')
    }

    const title = this.cleanRequiredText(dto.title, 'Le titre est obligatoire.')
    const body = this.cleanRequiredText(dto.body, 'Le corps de l’annonce est obligatoire.')
    const businessUnitId = this.cleanOptionalId(dto.businessUnitId)
    await this.ensureBusinessUnitExists(businessUnitId)

    const publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : new Date()
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null
    this.ensureDateRange(publishedAt, expiresAt)

    let announcement
    try {
      announcement = await this.prisma.announcement.create({
        data: {
          title,
          body,
          businessUnitId,
          isPinned: dto.isPinned ?? false,
          isActive: dto.isActive ?? true,
          publishedAt,
          expiresAt,
          createdById: requester.id,
        },
        select: ANNOUNCEMENT_SELECT,
      })
    } catch (err: unknown) {
      this.handleKnownWriteError(err)
      throw err
    }

    await this.log(requester.id, LogAction.ANNOUNCEMENT_CREATED, announcement.id, {
      title,
    })
    this.announcementsGateway.emitChanged('created', announcement.id)

    if (announcement.isActive) {
      const targets = await this.prisma.user.findMany({
        where: { isActive: true, ...(businessUnitId ? { businessUnitId } : {}) },
        select: { id: true },
      })
      await this.notifications.notifyUsers(
        targets.map((u) => u.id),
        {
          type: NotificationType.ANNOUNCEMENT_PUBLISHED,
          title: 'Nouvelle annonce',
          body: title,
          link: '/annonces',
        }
      )
    }

    return announcement
  }

  async update(id: string, dto: UpdateAnnouncementDto, requester: Requester) {
    if (!CAN_MANAGE_ANNOUNCEMENTS.includes(requester.role)) {
      throw new ForbiddenException('Réservé aux administrateurs.')
    }

    const existing = await this.prisma.announcement.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Annonce introuvable.')

    const data: Record<string, unknown> = {}
    if (dto.title !== undefined)
      data.title = this.cleanRequiredText(dto.title, 'Le titre est obligatoire.')
    if (dto.body !== undefined)
      data.body = this.cleanRequiredText(dto.body, 'Le corps de l’annonce est obligatoire.')
    if (dto.businessUnitId !== undefined) {
      const businessUnitId = this.cleanOptionalId(dto.businessUnitId)
      await this.ensureBusinessUnitExists(businessUnitId)
      data.businessUnitId = businessUnitId
    }
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned
    if (dto.isActive !== undefined) data.isActive = dto.isActive
    if (dto.publishedAt !== undefined) data.publishedAt = new Date(dto.publishedAt)
    if ('expiresAt' in dto) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null

    const nextPublishedAt = (data.publishedAt as Date | undefined) ?? existing.publishedAt
    const nextExpiresAt = 'expiresAt' in data ? (data.expiresAt as Date | null) : existing.expiresAt
    this.ensureDateRange(nextPublishedAt, nextExpiresAt)

    try {
      const updated = await this.prisma.announcement.update({
        where: { id },
        data,
        select: ANNOUNCEMENT_SELECT,
      })
      await this.log(requester.id, LogAction.ANNOUNCEMENT_UPDATED, id, dto as object)
      this.announcementsGateway.emitChanged('updated', id)
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Annonce introuvable.')
      this.handleKnownWriteError(err)
      throw err
    }
  }

  async remove(id: string, requester: Requester) {
    if (!CAN_MANAGE_ANNOUNCEMENTS.includes(requester.role)) {
      throw new ForbiddenException('Réservé aux administrateurs.')
    }

    const existing = await this.prisma.announcement.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Annonce introuvable.')

    try {
      await this.prisma.announcement.delete({ where: { id } })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Annonce introuvable.')
      throw err
    }
    await this.log(requester.id, LogAction.ANNOUNCEMENT_DELETED, id, { title: existing.title })
    this.announcementsGateway.emitChanged('deleted', id)
    return { deleted: true }
  }

  private async log(userId: string, action: LogAction, entityId: string, details: object) {
    await this.prisma.activityLog.create({
      data: { userId, action, entity: 'Announcement', entityId, details },
    })
  }

  private cleanRequiredText(value: string | null | undefined, message: string) {
    if (typeof value !== 'string') throw new BadRequestException(message)
    const cleaned = value.trim()
    if (!cleaned) throw new BadRequestException(message)
    return cleaned
  }

  private cleanOptionalId(value: string | null | undefined) {
    const cleaned = value?.trim()
    return cleaned || null
  }

  private ensureDateRange(publishedAt: Date, expiresAt: Date | null) {
    if (Number.isNaN(publishedAt.getTime())) {
      throw new BadRequestException('Date de publication invalide.')
    }
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Date d’expiration invalide.')
    }
    if (expiresAt && expiresAt <= publishedAt) {
      throw new BadRequestException('La date d’expiration doit être postérieure à la publication.')
    }
  }

  private async ensureBusinessUnitExists(businessUnitId: string | null) {
    if (!businessUnitId) return
    const exists = await this.prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { id: true },
    })
    if (!exists) throw new BadRequestException('BU ciblée introuvable.')
  }

  private handleKnownWriteError(err: unknown) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return
    if (err.code === 'P2003') throw new BadRequestException('BU ciblée introuvable.')
  }
}
