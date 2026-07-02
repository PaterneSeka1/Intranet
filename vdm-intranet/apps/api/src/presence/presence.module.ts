import { Module } from '@nestjs/common'
import { PresenceController } from './presence.controller'
import { PresenceService } from './presence.service'
import { PresenceScheduleService } from './presence.schedule.service'

@Module({
  controllers: [PresenceController],
  providers: [PresenceService, PresenceScheduleService],
  exports: [PresenceService],
})
export class PresenceModule {}
