import { Module } from '@nestjs/common'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'
import { ReportsPdfService } from './reports-pdf.service'
import { ReportsExcelService } from './reports-excel.service'
import { PdfBrowserService } from './pdf-browser.service'
import { PresenceModule } from '../presence/presence.module'
import { PublicHolidaysModule } from '../public-holidays/public-holidays.module'
import { LeavesModule } from '../leaves/leaves.module'

@Module({
  // PresenceModule : réutilise PresenceScheduleService pour appliquer la même règle "pas encore
  // arrivé ≠ absent" que /pilotage au rapport général (même principe que PilotageModule).
  imports: [PresenceModule, PublicHolidaysModule, LeavesModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPdfService, ReportsExcelService, PdfBrowserService],
})
export class ReportsModule {}
