import { Module } from '@nestjs/common'
import { PresenceController } from './presence.controller'
import { PresenceService } from './presence.service'
import { PresenceScheduleService } from './presence.schedule.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { LeavesModule } from '../leaves/leaves.module'

@Module({
  imports: [NotificationsModule, LeavesModule],
  controllers: [PresenceController],
  providers: [PresenceService, PresenceScheduleService],
  exports: [PresenceService],
})
export class PresenceModule {}
