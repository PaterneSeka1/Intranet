import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ReportsPdfService } from './reports-pdf.service'
import { ReportsExcelService } from './reports-excel.service'

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
    private readonly reportsExcelService: ReportsExcelService,
    private readonly reportsPdfService: ReportsPdfService
  ) {}

  @Get('presence')
  @ApiOperation({ summary: 'Export Excel — Présences' })
  async presenceExcel(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const buffer = await this.reportsExcelService.presenceExcel(user, from, to)
    this.sendExcel(res, buffer, 'presences.xlsx')
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
  @ApiOperation({ summary: "Export Excel — Journal d'activité" })
  async activityExcel(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const buffer = await this.reportsExcelService.activityExcel(user, from, to)
    this.sendExcel(res, buffer, 'activite.xlsx')
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
  @ApiOperation({ summary: 'Export Excel — Connexions' })
  async connectionsExcel(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const buffer = await this.reportsExcelService.connectionsExcel(user, from, to)
    this.sendExcel(res, buffer, 'connexions.xlsx')
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
  @ApiOperation({ summary: 'Export Excel — Rapport général' })
  async generalExcel(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const buffer = await this.reportsExcelService.generalExcel(user, from, to)
    this.sendExcel(res, buffer, 'rapport-general.xlsx')
  }

  @Get('general/pdf')
  @ApiOperation({ summary: 'Export PDF — Rapport général' })
  async generalPdf(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const pdf = await this.reportsPdfService.generalPdf(user, from, to)
    this.sendPdf(res, pdf, 'rapport-general.pdf')
  }

  private sendExcel(res: Response, buffer: Buffer, filename: string) {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  }

  private sendPdf(res: Response, pdf: Buffer, filename: string) {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  }
}
