import { Module } from '@nestjs/common'
import { PilotageService } from './pilotage.service'
import { PilotageController } from './pilotage.controller'

@Module({
  controllers: [PilotageController],
  providers: [PilotageService],
})
export class PilotageModule {}
