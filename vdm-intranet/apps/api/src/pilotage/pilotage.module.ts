import { Module } from '@nestjs/common'
import { PilotageService } from './pilotage.service'
import { PilotageController } from './pilotage.controller'
import { PublicHolidaysModule } from '../public-holidays/public-holidays.module'
import { LeavesModule } from '../leaves/leaves.module'

@Module({
  imports: [PublicHolidaysModule, LeavesModule],
  controllers: [PilotageController],
  providers: [PilotageService],
})
export class PilotageModule {}
