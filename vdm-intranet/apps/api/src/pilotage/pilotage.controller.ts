import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { LogAction, Role } from '@prisma/client'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PilotageService } from './pilotage.service'

type AuthUser = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

@ApiTags('pilotage')
@UseGuards(JwtAuthGuard)
@Controller('pilotage')
export class PilotageController {
  constructor(private readonly pilotageService: PilotageService) {}

  @Get('summary')
  @ApiOperation({ summary: 'KPIs du jour' })
  getSummary(@CurrentUser() user: AuthUser) {
    return this.pilotageService.getSummary(user)
  }

  @Get('presence-by-bu')
  @ApiOperation({ summary: "Présences par BU (aujourd'hui)" })
  getPresenceByBu(@CurrentUser() user: AuthUser) {
    return this.pilotageService.getPresenceByBu(user)
  }

  @Get('period-report')
  @ApiOperation({ summary: 'Rapport de présence agrégé sur une période (semaine ou mois)' })
  getPeriodReport(
    @CurrentUser() user: AuthUser,
    @Query('period') period = 'week',
    @Query('date') date?: string
  ) {
    if (period !== 'week' && period !== 'month') {
      throw new BadRequestException('period doit être "week" ou "month".')
    }
    return this.pilotageService.getPeriodReport(user, period, date)
  }

  @Get('connections-chart')
  @ApiOperation({ summary: 'Connexions par jour (N derniers jours)' })
  getConnectionsChart(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.pilotageService.getConnectionsChart(user, days ? parseInt(days, 10) : 14)
  }

  @Get('activity-chart')
  @ApiOperation({ summary: 'Top actions (N derniers jours)' })
  getActivityChart(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.pilotageService.getActivityChart(user, days ? parseInt(days, 10) : 30)
  }

  @Get('activity-log')
  @ApiOperation({ summary: "Journal d'activité paginé" })
  getActivityLog(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search?: string,
    @Query('action') action?: string
  ) {
    if (action && !Object.values(LogAction).includes(action as LogAction)) {
      throw new BadRequestException("Valeur d'action invalide.")
    }
    return this.pilotageService.getActivityLog(
      user,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit, 10) || 25)),
      search,
      action
    )
  }
}
