import { Module } from '@nestjs/common'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'
import { ReportsPdfService } from './reports-pdf.service'
import { PdfBrowserService } from './pdf-browser.service'

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPdfService, PdfBrowserService],
})
export class ReportsModule {}
