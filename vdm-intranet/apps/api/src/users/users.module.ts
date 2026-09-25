import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { UserPhotoService } from './user-photo.service'
import { LeavesModule } from '../leaves/leaves.module'

@Module({
  imports: [LeavesModule],
  controllers: [UsersController],
  providers: [UsersService, UserPhotoService],
  exports: [UsersService],
})
export class UsersModule {}
