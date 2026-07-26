import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { LogAction, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAnnouncementDto } from './dto/create-announcement.dto'
import { UpdateAnnouncementDto } from './dto/update-announcement.dto'

type Requester = { id: string; role: Role }

const MANAGE_ROLES: Role[] = [Role.CTO_ADMIN, Role.PDG, Role.DAF]

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
  constructor(private readonly prisma: PrismaService) {}

  findAll(requester: Requester | undefined, activeOnly = false) {
    const canSeeAll = requester && MANAGE_ROLES.includes(requester.role)
    const now = new Date()
    const where =
      activeOnly || !canSeeAll
        ? {
            isActive: true,
            publishedAt: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          }
        : {}

    return this.prisma.announcement.findMany({
      where,
      select: ANNOUNCEMENT_SELECT,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 100,
    })
  }

  async create(dto: CreateAnnouncementDto, requester: Requester) {
    if (!MANAGE_ROLES.includes(requester.role)) {
      throw new ForbiddenException('Réservé aux administrateurs.')
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        businessUnitId: dto.businessUnitId,
        isPinned: dto.isPinned ?? false,
        isActive: dto.isActive ?? true,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdById: requester.id,
      },
      select: ANNOUNCEMENT_SELECT,
    })

    await this.log(requester.id, LogAction.ANNOUNCEMENT_CREATED, announcement.id, {
      title: dto.title,
    })
    return announcement
  }

  async update(id: string, dto: UpdateAnnouncementDto, requester: Requester) {
    if (!MANAGE_ROLES.includes(requester.role)) {
      throw new ForbiddenException('Réservé aux administrateurs.')
    }

    const existing = await this.prisma.announcement.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Annonce introuvable.')

    const data: Record<string, unknown> = {}
    if (dto.title !== undefined) data.title = dto.title
    if (dto.body !== undefined) data.body = dto.body
    if (dto.businessUnitId !== undefined) data.businessUnitId = dto.businessUnitId
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned
    if (dto.isActive !== undefined) data.isActive = dto.isActive
    if (dto.publishedAt !== undefined) data.publishedAt = new Date(dto.publishedAt)
    if ('expiresAt' in dto) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null

    try {
      const updated = await this.prisma.announcement.update({
        where: { id },
        data,
        select: ANNOUNCEMENT_SELECT,
      })
      await this.log(requester.id, LogAction.ANNOUNCEMENT_UPDATED, id, dto as object)
      return updated
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025')
        throw new NotFoundException('Annonce introuvable.')
      throw err
    }
  }

  async remove(id: string, requester: Requester) {
    if (!MANAGE_ROLES.includes(requester.role)) {
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
    return { deleted: true }
  }

  private async log(userId: string, action: LogAction, entityId: string, details: object) {
    await this.prisma.activityLog.create({
      data: { userId, action, entity: 'Announcement', entityId, details },
    })
  }
}
