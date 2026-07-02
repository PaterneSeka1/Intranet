import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ReportsService } from './reports.service'

type AuthUser = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

@ApiTags('reports')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('presence')
  @ApiOperation({ summary: 'Export CSV — Présences' })
  async presenceCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.reportsService.presenceCsv(user, from, to)
    this.sendCsv(res, csv, 'presences.csv')
  }

  @Get('activity')
  @ApiOperation({ summary: 'Export CSV — Journal d\'activité' })
  async activityCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.reportsService.activityCsv(user, from, to)
    this.sendCsv(res, csv, 'activite.csv')
  }

  @Get('connections')
  @ApiOperation({ summary: 'Export CSV — Connexions' })
  async connectionsCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.reportsService.connectionsCsv(user, from, to)
    this.sendCsv(res, csv, 'connexions.csv')
  }

  @Get('general')
  @ApiOperation({ summary: 'Export CSV — Rapport général' })
  async generalCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.reportsService.generalCsv(user)
    this.sendCsv(res, csv, 'rapport-general.csv')
  }

  private sendCsv(res: Response, csv: string, filename: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(Buffer.from(csv, 'utf-8'))
  }
}
