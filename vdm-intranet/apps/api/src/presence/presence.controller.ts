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
import { Role } from '@prisma/client'
import { CreateMandateDto } from './dto/create-mandate.dto'
import { CreateScheduleGroupDto } from './dto/create-schedule-group.dto'
import { UpdateScheduleGroupDto } from './dto/update-schedule-group.dto'

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
    return this.presenceService.getTodayPresence(user.id)
  }

  @Get('today/all')
  getTodayAll(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.presenceService.getTodayAllPresences(user, date)
  }

  @Post('first-login')
  firstLogin(
    @CurrentUser() user: AuthUser,
    @Body() dto: FirstLoginDto,
    @Req() req: Request,
  ) {
    return this.presenceService.processFirstLogin(user.id, dto, this.getIp(req))
  }

  @Post('login-log')
  loginLog(
    @CurrentUser() user: AuthUser,
    @Body() dto: LoginLogDto,
    @Req() req: Request,
  ) {
    return this.presenceService.recordLoginLog(user.id, dto, this.getIp(req))
  }

  @Post('logout-log')
  logoutLog(
    @CurrentUser() user: AuthUser,
    @Body() dto: LoginLogDto,
    @Req() req: Request,
  ) {
    return this.presenceService.recordLogoutLog(user.id, dto, this.getIp(req))
  }

  // ----------------------------------------------------------------
  // Groupes horaires
  // ----------------------------------------------------------------

  @Get('schedule-groups')
  getScheduleGroups() {
    return this.presenceService.getScheduleGroups()
  }

  @Post('schedule-groups')
  createScheduleGroup(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScheduleGroupDto,
  ) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.presenceService.createScheduleGroup(dto, user.id)
  }

  @Patch('schedule-groups/:id')
  updateScheduleGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleGroupDto,
  ) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.presenceService.updateScheduleGroup(id, dto, user.id)
  }

  @Delete('schedule-groups/:id')
  deleteScheduleGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.presenceService.deleteScheduleGroup(id, user.id)
  }

  // ----------------------------------------------------------------
  // Mon historique de connexions
  // ----------------------------------------------------------------

  @Get('my-connections')
  getMyConnections(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    return this.presenceService.getMyConnections(user.id, limit ? parseInt(limit, 10) : 50)
  }

  // ----------------------------------------------------------------
  // Mandats
  // ----------------------------------------------------------------

  @Get('mandates')
  getMandates(@CurrentUser() user: AuthUser) {
    return this.presenceService.getMandates(user)
  }

  @Post('mandates')
  createMandate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMandateDto,
  ) {
    const CAN_MANDATE = [Role.CTO_ADMIN, Role.RESPONSABLE_BU, Role.RESPONSABLE_POLE]
    if (!CAN_MANDATE.includes(user.role)) throw new ForbiddenException()
    return this.presenceService.createMandate(dto, user)
  }

  @Delete('mandates/:id')
  deleteMandate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const CAN_MANDATE = [Role.CTO_ADMIN, Role.RESPONSABLE_BU, Role.RESPONSABLE_POLE]
    if (!CAN_MANDATE.includes(user.role)) throw new ForbiddenException()
    return this.presenceService.deleteMandate(id, user)
  }

  // ----------------------------------------------------------------

  private getIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]).trim()
    }
    return req.ip ?? ''
  }
}
