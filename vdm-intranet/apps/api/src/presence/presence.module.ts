import { Module } from '@nestjs/common'
import { PresenceController } from './presence.controller'
import { PresenceService } from './presence.service'
import { PresenceScheduleService } from './presence.schedule.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [PresenceController],
  providers: [PresenceService, PresenceScheduleService],
  exports: [PresenceService],
})
export class PresenceModule {}
