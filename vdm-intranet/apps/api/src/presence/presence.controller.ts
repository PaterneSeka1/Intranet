import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common'
import { Request } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PresenceService } from './presence.service'
import { FirstLoginDto } from './dto/first-login.dto'
import { LoginLogDto } from './dto/login-log.dto'
import { EndDayDto } from './dto/end-day.dto'
import { Role } from '@prisma/client'
import { CreateMandateDto } from './dto/create-mandate.dto'
import { CreateScheduleGroupDto } from './dto/create-schedule-group.dto'
import { UpdateScheduleGroupDto } from './dto/update-schedule-group.dto'
import { CAN_MANAGE_MANDATES, CAN_MANAGE_SCHEDULE_GROUPS } from '../common/permissions'

type AuthUser = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

@UseGuards(JwtAuthGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  // ----------------------------------------------------------------
  // Présence — routes fixes AVANT les routes paramétrées
  // ----------------------------------------------------------------

  @Get('today')
  getMyToday(@CurrentUser() user: AuthUser) {
    return this.presenceService.getTodayPresence(user.id, user.role)
  }

  @Get('today/all')
  getTodayAll(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.presenceService.getTodayAllPresences(user, date)
  }

  @Post('first-login')
  firstLogin(@CurrentUser() user: AuthUser, @Body() dto: FirstLoginDto, @Req() req: Request) {
    return this.presenceService.processFirstLogin(user.id, dto, this.getIp(req), user.role)
  }

  @Post('login-log')
  loginLog(@CurrentUser() user: AuthUser, @Body() dto: LoginLogDto, @Req() req: Request) {
    return this.presenceService.recordLoginLog(user.id, dto, this.getIp(req))
  }

  @Post('logout-log')
  logoutLog(@CurrentUser() user: AuthUser, @Body() dto: LoginLogDto, @Req() req: Request) {
    return this.presenceService.recordLogoutLog(user.id, dto, this.getIp(req))
  }

  @Post('end-day')
  endDay(@CurrentUser() user: AuthUser, @Body() dto: EndDayDto, @Req() req: Request) {
    return this.presenceService.processEndDay(user.id, dto, this.getIp(req), user.role)
  }

  // ----------------------------------------------------------------
  // Groupes horaires
  // ----------------------------------------------------------------

  @Get('schedule-groups')
  getScheduleGroups() {
    return this.presenceService.getScheduleGroups()
  }

  @Post('schedule-groups')
  createScheduleGroup(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleGroupDto) {
    if (!CAN_MANAGE_SCHEDULE_GROUPS.includes(user.role)) throw new ForbiddenException()
    return this.presenceService.createScheduleGroup(dto, user.id)
  }

  @Patch('schedule-groups/:id')
  updateScheduleGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleGroupDto
  ) {
    if (!CAN_MANAGE_SCHEDULE_GROUPS.includes(user.role)) throw new ForbiddenException()
    return this.presenceService.updateScheduleGroup(id, dto, user.id)
  }

  @Delete('schedule-groups/:id')
  deleteScheduleGroup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!CAN_MANAGE_SCHEDULE_GROUPS.includes(user.role)) throw new ForbiddenException()
    return this.presenceService.deleteScheduleGroup(id, user.id)
  }

  // ----------------------------------------------------------------
  // Mon historique de connexions
  // ----------------------------------------------------------------

  @Get('my-connections')
  getMyConnections(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const safeLimit = limit ? Math.min(200, Math.max(1, parseInt(limit, 10) || 50)) : 50
    return this.presenceService.getMyConnections(user.id, safeLimit, user.role)
  }

  // ----------------------------------------------------------------
  // Mandats
  // ----------------------------------------------------------------

  @Get('mandates')
  getMandates(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.presenceService.getMandates(user, date)
  }

  @Post('mandates')
  createMandate(@CurrentUser() user: AuthUser, @Body() dto: CreateMandateDto) {
    if (!CAN_MANAGE_MANDATES.includes(user.role)) throw new ForbiddenException()
    return this.presenceService.createMandate(dto, user)
  }

  @Delete('mandates/:id')
  deleteMandate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!CAN_MANAGE_MANDATES.includes(user.role)) throw new ForbiddenException()
    return this.presenceService.deleteMandate(id, user)
  }

  // ----------------------------------------------------------------

  private getIp(req: Request): string {
    return req.ip ?? ''
  }
}
