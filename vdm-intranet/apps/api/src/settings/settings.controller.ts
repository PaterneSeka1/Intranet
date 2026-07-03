import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { SettingsService, SettingPair } from './settings.service'
import { Role } from '@prisma/client'

type AuthUser = { id: string; role: Role }

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll()
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  upsert(
    @CurrentUser() user: AuthUser,
    @Body() body: { settings: SettingPair[] },
  ) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.settingsService.upsertMany(body.settings)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':key')
  remove(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.settingsService.deleteKey(key)
  }
}
