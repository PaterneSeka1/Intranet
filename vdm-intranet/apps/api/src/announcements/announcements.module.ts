import { Module } from '@nestjs/common'
import { AnnouncementsController } from './announcements.controller'
import { AnnouncementsGateway } from './announcements.gateway'
import { AnnouncementsService } from './announcements.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsGateway, AnnouncementsService],
})
export class AnnouncementsModule {}
