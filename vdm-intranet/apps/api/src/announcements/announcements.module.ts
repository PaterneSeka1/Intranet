import { Module } from '@nestjs/common'
import { AnnouncementsController } from './announcements.controller'
import { AnnouncementsGateway } from './announcements.gateway'
import { AnnouncementsService } from './announcements.service'

@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsGateway, AnnouncementsService],
})
export class AnnouncementsModule {}
