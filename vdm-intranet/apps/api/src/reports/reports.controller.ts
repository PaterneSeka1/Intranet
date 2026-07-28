import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ReportsService } from './reports.service'
import { ReportsPdfService } from './reports-pdf.service'

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
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsPdfService: ReportsPdfService
  ) {}

  @Get('presence')
  @ApiOperation({ summary: 'Export CSV — Présences' })
  async presenceCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const csv = await this.reportsService.presenceCsv(user, from, to)
    this.sendCsv(res, csv, 'presences.csv')
  }

  @Get('presence/pdf')
  @ApiOperation({ summary: 'Export PDF — Présences' })
  async presencePdf(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const pdf = await this.reportsPdfService.presencePdf(user, from, to)
    this.sendPdf(res, pdf, 'presences.pdf')
  }

  @Get('activity')
  @ApiOperation({ summary: "Export CSV — Journal d'activité" })
  async activityCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const csv = await this.reportsService.activityCsv(user, from, to)
    this.sendCsv(res, csv, 'activite.csv')
  }

  @Get('activity/pdf')
  @ApiOperation({ summary: "Export PDF — Journal d'activité" })
  async activityPdf(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const pdf = await this.reportsPdfService.activityPdf(user, from, to)
    this.sendPdf(res, pdf, 'activite.pdf')
  }

  @Get('connections')
  @ApiOperation({ summary: 'Export CSV — Connexions' })
  async connectionsCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const csv = await this.reportsService.connectionsCsv(user, from, to)
    this.sendCsv(res, csv, 'connexions.csv')
  }

  @Get('connections/pdf')
  @ApiOperation({ summary: 'Export PDF — Connexions' })
  async connectionsPdf(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const pdf = await this.reportsPdfService.connectionsPdf(user, from, to)
    this.sendPdf(res, pdf, 'connexions.pdf')
  }

  @Get('general')
  @ApiOperation({ summary: 'Export CSV — Rapport général' })
  async generalCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.reportsService.generalCsv(user)
    this.sendCsv(res, csv, 'rapport-general.csv')
  }

  @Get('general/pdf')
  @ApiOperation({ summary: 'Export PDF — Rapport général' })
  async generalPdf(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const pdf = await this.reportsPdfService.generalPdf(user)
    this.sendPdf(res, pdf, 'rapport-general.pdf')
  }

  private sendCsv(res: Response, csv: string, filename: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(Buffer.from(csv, 'utf-8'))
  }

  private sendPdf(res: Response, pdf: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  }
}
