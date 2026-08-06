import { Module } from '@nestjs/common'
import { PresenceController } from './presence.controller'
import { PresenceService } from './presence.service'
import { PresenceScheduleService } from './presence.schedule.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { LeavesModule } from '../leaves/leaves.module'
import { PublicHolidaysModule } from '../public-holidays/public-holidays.module'

@Module({
  imports: [NotificationsModule, LeavesModule, PublicHolidaysModule],
  controllers: [PresenceController],
  providers: [PresenceService, PresenceScheduleService],
  // PresenceScheduleService exporté : réutilisé par PilotageService pour appliquer la même règle
  // "pas encore arrivé ≠ absent" aux KPI du jour (summary/presence-by-bu).
  exports: [PresenceService, PresenceScheduleService],
})
export class PresenceModule {}
