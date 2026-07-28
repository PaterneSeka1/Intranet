import { Module } from '@nestjs/common'
import { PilotageService } from './pilotage.service'
import { PilotageController } from './pilotage.controller'
import { PublicHolidaysModule } from '../public-holidays/public-holidays.module'

@Module({
  imports: [PublicHolidaysModule],
  controllers: [PilotageController],
  providers: [PilotageService],
})
export class PilotageModule {}
