import { Injectable } from '@nestjs/common'
import { LogAction, Role } from '@prisma/client'
import { PdfBrowserService } from './pdf-browser.service'
import { ReportsService, STATUS_LABELS } from './reports.service'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

type PresenceRows = Awaited<ReturnType<ReportsService['getPresenceRows']>>
type ActivityRows = Awaited<ReturnType<ReportsService['getActivityRows']>>
type ConnectionRows = Awaited<ReturnType<ReportsService['getConnectionRows']>>
type GeneralData = Awaited<ReturnType<ReportsService['getGeneralData']>>

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}

@Injectable()
export class ReportsPdfService {
  constructor(
    private readonly reports: ReportsService,
    private readonly pdfBrowser: PdfBrowserService
  ) {}

  async presencePdf(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const rows = await this.reports.getPresenceRows(requester, dateFrom, dateTo)
    const buffer = await this.renderPdf(this.presenceHtml(rows))
    await this.reports.logExport(requester.id, LogAction.PRESENCE_REPORT_EXPORTED, 'pdf')
    return buffer
  }

  async activityPdf(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const rows = await this.reports.getActivityRows(requester, dateFrom, dateTo)
    const buffer = await this.renderPdf(this.activityHtml(rows))
    await this.reports.logExport(requester.id, LogAction.ACTIVITY_REPORT_EXPORTED, 'pdf')
    return buffer
  }

  async connectionsPdf(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const rows = await this.reports.getConnectionRows(requester, dateFrom, dateTo)
    const buffer = await this.renderPdf(this.connectionsHtml(rows))
    await this.reports.logExport(requester.id, LogAction.CONNECTION_REPORT_EXPORTED, 'pdf')
    return buffer
  }

  async generalPdf(requester: Requester): Promise<Buffer> {
    const data = await this.reports.getGeneralData(requester)
    const buffer = await this.renderPdf(this.generalHtml(data))
    await this.reports.logExport(requester.id, LogAction.GENERAL_REPORT_EXPORTED, 'pdf')
    return buffer
  }

  private async renderPdf(html: string): Promise<Buffer> {
    const page = await this.pdfBrowser.getPage()
    try {
      await page.setContent(html, { waitUntil: 'load' })
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', bottom: '14mm', left: '10mm', right: '10mm' },
        displayHeaderFooter: true,
        footerTemplate:
          '<div style="font-size:9px;width:100%;text-align:center;color:#999;">Page <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
      })
      return Buffer.from(pdf)
    } finally {
      await page.close()
    }
  }

  private renderShell(title: string, bodyHtml: string): string {
    const generatedAt = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 0; }
  .header { border-bottom: 3px solid #F28C38; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: baseline; }
  .header h1 { font-size: 16px; margin: 0; color: #111827; }
  .header .brand { font-size: 11px; color: #F28C38; font-weight: bold; }
  .meta { font-size: 10px; color: #6b7280; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { background: #F28C38; color: white; text-align: left; padding: 5px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
  tr:nth-child(even) td { background: #fafafa; }
  .kv { font-size: 11px; margin-bottom: 4px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <span class="brand">VEILLEUR DES MÉDIAS</span>
  </div>
  <div class="meta">Généré le ${generatedAt}</div>
  ${bodyHtml}
</body>
</html>`
  }

  private table(headers: string[], rows: (string | number)[][]): string {
    return `<table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>
    </table>`
  }

  private presenceHtml(rows: PresenceRows): string {
    const body = this.table(
      ['Date', 'Utilisateur', 'BU', 'Pôle', 'Statut', 'Heure attendue', 'Arrivée', 'Écart (min)'],
      rows.map((r) => [
        this.reports.fmtDate(r.date),
        r.user.fullName ?? r.user.username,
        r.user.businessUnit?.name ?? '',
        r.user.pole?.name ?? '',
        STATUS_LABELS[r.status] ?? r.status,
        r.expectedArrivalTime,
        this.reports.fmtDateTime(r.officialArrivalTime),
        r.delayMinutes ?? '',
      ])
    )
    return this.renderShell('Rapport de présences', body)
  }

  private activityHtml(rows: ActivityRows): string {
    const body = this.table(
      ['Date/Heure', 'Utilisateur', 'BU', 'Action', 'Entité'],
      rows.map((r) => [
        this.reports.fmtDateTime(r.occurredAt),
        r.user.fullName ?? r.user.username,
        r.user.businessUnit?.name ?? '',
        r.action,
        r.entity ?? '',
      ])
    )
    return this.renderShell("Journal d'activité", body)
  }

  private connectionsHtml(rows: ConnectionRows): string {
    const body = this.table(
      ['Date', 'Connexion', 'Déconnexion', 'Utilisateur', 'BU', 'Type', '1ère connexion'],
      rows.map((r) => [
        this.reports.fmtDate(r.date),
        this.reports.fmtDateTime(r.connectedAt),
        this.reports.fmtDateTime(r.disconnectedAt),
        r.user.fullName ?? r.user.username,
        r.user.businessUnit?.name ?? '',
        r.type,
        r.isFirstConnectionOfDay ? 'Oui' : 'Non',
      ])
    )
    return this.renderShell('Rapport de connexions', body)
  }

  private generalHtml(data: GeneralData): string {
    const presMap = new Map(data.presences.map((p) => [p.user.username, p]))
    const rows = data.users.map((u) => {
      const pres = presMap.get(u.username)
      return [
        u.fullName ?? u.username,
        u.role,
        u.businessUnit?.name ?? '',
        u.pole?.name ?? '',
        pres ? STATUS_LABELS[pres.status] : 'Absent',
        this.reports.fmtDateTime(u.lastLoginAt),
      ]
    })
    const body = `
      <p class="kv"><strong>Connexions aujourd'hui :</strong> ${data.connectionsToday}</p>
      ${this.table(['Utilisateur', 'Rôle', 'BU', 'Pôle', 'Présence', 'Dernière connexion'], rows)}
    `
    return this.renderShell('Rapport général', body)
  }
}
