import { Injectable, NotFoundException } from '@nestjs/common'
import { NotificationType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsGateway } from './notifications.gateway'

export type NotifyPayload = {
  type: NotificationType
  title: string
  body: string
  link?: string | null
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway
  ) {}

  async findMine(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const where = { userId }

    const [total, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return { total, page, limit, pages: Math.ceil(total / limit), notifications }
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } })
    return { count }
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } })
    if (!notification) throw new NotFoundException('Notification introuvable.')
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } })
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
    return { updated: result.count }
  }

  async remove(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId } })
    if (!notification) throw new NotFoundException('Notification introuvable.')
    await this.prisma.notification.delete({ where: { id } })
    return { id }
  }

  async notifyUser(userId: string, payload: NotifyPayload) {
    await this.prisma.notification.create({ data: { userId, ...payload } })
    this.gateway.emitToUser(userId)
  }

  async notifyUsers(userIds: string[], payload: NotifyPayload) {
    if (!userIds.length) return
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, ...payload })),
    })
    this.gateway.emitToUsers(userIds)
  }
}
