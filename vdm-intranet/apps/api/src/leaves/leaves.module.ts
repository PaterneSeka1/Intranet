import { Module } from '@nestjs/common'
import { LeavesController } from './leaves.controller'
import { LeavesService } from './leaves.service'
import { LeaveSyncService } from './leave-sync.service'

@Module({
  controllers: [LeavesController],
  providers: [LeavesService, LeaveSyncService],
  exports: [LeaveSyncService],
})
export class LeavesModule {}
