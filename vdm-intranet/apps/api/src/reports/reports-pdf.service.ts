import { Injectable } from '@nestjs/common'
import { LogAction, Role } from '@prisma/client'
import { PdfBrowserService } from './pdf-browser.service'
import { ReportsService, STATUS_LABELS } from './reports.service'
import { LOGO_BASE64_PNG } from './assets/logo'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

type PresenceRows = Awaited<ReturnType<ReportsService['getPresenceRows']>>
type PresenceSummaryRows = Awaited<ReturnType<ReportsService['getPresenceSummaryRows']>>
type ActivityRows = Awaited<ReturnType<ReportsService['getActivityRows']>>
type ConnectionRows = Awaited<ReturnType<ReportsService['getConnectionRows']>>
type GeneralData = Awaited<ReturnType<ReportsService['getGeneralData']>>

type StatCard = { label: string; value: string | number; accent?: string }

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

@Injectable()
export class ReportsPdfService {
  constructor(
    private readonly reports: ReportsService,
    private readonly pdfBrowser: PdfBrowserService
  ) {}

  async presencePdf(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const [rows, summaryRows] = await Promise.all([
      this.reports.getPresenceRows(requester, dateFrom, dateTo),
      this.reports.getPresenceSummaryRows(requester, dateFrom, dateTo),
    ])
    const periodLabel = this.reports.periodLabel(dateFrom, dateTo, '90 derniers jours par défaut')
    const buffer = await this.renderPdf(this.presenceHtml(rows, summaryRows, periodLabel))
    await this.reports.logExport(requester.id, LogAction.PRESENCE_REPORT_EXPORTED, 'pdf')
    return buffer
  }

  async activityPdf(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const rows = await this.reports.getActivityRows(requester, dateFrom, dateTo)
    const periodLabel = this.reports.periodLabel(dateFrom, dateTo, '90 derniers jours par défaut')
    const buffer = await this.renderPdf(this.activityHtml(rows, periodLabel))
    await this.reports.logExport(requester.id, LogAction.ACTIVITY_REPORT_EXPORTED, 'pdf')
    return buffer
  }

  async connectionsPdf(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const rows = await this.reports.getConnectionRows(requester, dateFrom, dateTo)
    const periodLabel = this.reports.periodLabel(dateFrom, dateTo, '90 derniers jours par défaut')
    const buffer = await this.renderPdf(this.connectionsHtml(rows, periodLabel))
    await this.reports.logExport(requester.id, LogAction.CONNECTION_REPORT_EXPORTED, 'pdf')
    return buffer
  }

  async generalPdf(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const data = await this.reports.getGeneralData(requester, dateFrom, dateTo)
    const buffer = await this.renderPdf(this.generalHtml(data))
    await this.reports.logExport(requester.id, LogAction.GENERAL_REPORT_EXPORTED, 'pdf')
    return buffer
  }

  // ─── Rendu PDF (Puppeteer) ───────────────────────────────────────────────────

  private async renderPdf(html: string): Promise<Buffer> {
    const page = await this.pdfBrowser.getPage()
    try {
      await page.setContent(html, { waitUntil: 'load' })
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '10mm', right: '10mm' },
        displayHeaderFooter: true,
        footerTemplate: `
          <div style="font-size:8px;width:100%;padding:0 10mm;display:flex;justify-content:space-between;color:#9ca3af;font-family:Helvetica,Arial,sans-serif;">
            <span>VEILLEUR DES MÉDIAS — Document à usage interne</span>
            <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>`,
      })
      return Buffer.from(pdf)
    } finally {
      await page.close()
    }
  }

  // ─── Gabarit commun ──────────────────────────────────────────────────────────

  private renderShell(title: string, periodLabel: string, bodyHtml: string): string {
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
  body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; font-size: 10px; }

  .header {
    display: flex; align-items: center; justify-content: space-between;
    background: #FFF6EC; border-bottom: 3px solid #F28C38;
    padding: 10px 14px; margin-bottom: 18px;
  }
  .header .brand { display: flex; align-items: center; gap: 10px; }
  .header .brand img { height: 30px; display: block; }
  .header h1 { font-size: 15px; margin: 0; color: #111827; }
  .header .period {
    font-size: 10px; color: #6b7280; text-align: right; line-height: 1.5;
  }
  .header .period strong { color: #F28C38; }

  .stat-cards { display: flex; gap: 10px; margin-bottom: 18px; }
  .stat-card {
    flex: 1; background: #ffffff; border: 1px solid #f0e4d8; border-radius: 8px;
    padding: 8px 10px; border-left: 3px solid #F28C38;
  }
  .stat-card .value { font-size: 16px; font-weight: 700; color: #111827; }
  .stat-card .label { font-size: 8.5px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }

  section.block { margin-bottom: 20px; }
  section.block h2 {
    font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    color: #9ca3af; margin: 0 0 6px 2px;
  }

  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  thead { display: table-header-group; }
  th {
    background: #F28C38; color: white; text-align: left; padding: 6px 7px;
    font-weight: 700; text-transform: uppercase; font-size: 8px; letter-spacing: 0.03em;
  }
  th:first-child { border-radius: 4px 0 0 0; }
  th:last-child { border-radius: 0 4px 0 0; }
  td { padding: 5px 7px; border-bottom: 1px solid #f3f4f6; }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; white-space: nowrap; }
  .empty { text-align: center; color: #9ca3af; padding: 16px; font-style: italic; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${LOGO_BASE64_PNG}" alt="Veilleur des Médias" />
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="period">
      <div><strong>${escapeHtml(periodLabel)}</strong></div>
      <div>Généré le ${generatedAt}</div>
    </div>
  </div>
  ${bodyHtml}
</body>
</html>`
  }

  private statCards(cards: StatCard[]): string {
    return `<div class="stat-cards">${cards
      .map(
        (c) => `<div class="stat-card">
          <div class="value">${escapeHtml(c.value)}</div>
          <div class="label">${escapeHtml(c.label)}</div>
        </div>`
      )
      .join('')}</div>`
  }

  private block(title: string, innerHtml: string): string {
    return `<section class="block"><h2>${escapeHtml(title)}</h2>${innerHtml}</section>`
  }

  private table(
    headers: string[],
    rows: (string | number)[][],
    opts: { numericCols?: number[] } = {}
  ): string {
    const numeric = new Set(opts.numericCols ?? [])
    if (rows.length === 0) {
      return `<div class="empty">Aucune donnée sur la période sélectionnée.</div>`
    }
    return `<table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(
          (r) =>
            `<tr>${r
              .map(
                (c, i) => `<td${numeric.has(i) ? ' class="num"' : ''}>${escapeHtml(c)}</td>`
              )
              .join('')}</tr>`
        )
        .join('')}</tbody>
    </table>`
  }

  // ─── Rapports ────────────────────────────────────────────────────────────────

  private presenceHtml(
    rows: PresenceRows,
    summaryRows: PresenceSummaryRows,
    periodLabel: string
  ): string {
    const stats = this.statCards([
      { label: 'Personnes suivies', value: summaryRows.length },
      { label: 'Absences cumulées', value: sum(summaryRows.map((r) => r.absences)) },
      { label: 'Jours de retard', value: sum(summaryRows.map((r) => r.lateDays)) },
      { label: 'Minutes de retard cumulées', value: sum(summaryRows.map((r) => r.lateMinutesTotal)) },
    ])

    const summaryTable = this.table(
      ['Utilisateur', 'Rôle', 'BU', 'Pôle', 'Absences', 'Jours de retard', 'Minutes de retard'],
      summaryRows.map((r) => [
        r.fullName ?? r.username,
        r.role,
        r.businessUnitName,
        r.poleName,
        r.absences,
        r.lateDays,
        r.lateMinutesTotal,
      ]),
      { numericCols: [4, 5, 6] }
    )

    const detailTable = this.table(
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
      ]),
      { numericCols: [7] }
    )

    const body =
      stats +
      this.block('Synthèse par personne', summaryTable) +
      this.block('Détail journalier', detailTable)

    return this.renderShell('Rapport de présences', periodLabel, body)
  }

  private activityHtml(rows: ActivityRows, periodLabel: string): string {
    const stats = this.statCards([{ label: 'Événements journalisés', value: rows.length }])
    const body =
      stats +
      this.block(
        "Journal d'activité",
        this.table(
          ['Date/Heure', 'Utilisateur', 'BU', 'Action', 'Entité'],
          rows.map((r) => [
            this.reports.fmtDateTime(r.occurredAt),
            r.user.fullName ?? r.user.username,
            r.user.businessUnit?.name ?? '',
            r.action,
            r.entity ?? '',
          ])
        )
      )
    return this.renderShell("Journal d'activité", periodLabel, body)
  }

  private connectionsHtml(rows: ConnectionRows, periodLabel: string): string {
    const stats = this.statCards([
      { label: 'Connexions', value: rows.length },
      { label: 'Premières connexions du jour', value: rows.filter((r) => r.isFirstConnectionOfDay).length },
    ])
    const body =
      stats +
      this.block(
        'Détail des connexions',
        this.table(
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
      )
    return this.renderShell('Rapport de connexions', periodLabel, body)
  }

  private generalHtml(data: GeneralData): string {
    const present = data.users.filter((u) => u.statusLabel === STATUS_LABELS.PRESENT).length
    const late = data.users.filter((u) => u.statusLabel === STATUS_LABELS.LATE).length
    const absent = data.users.filter((u) => u.statusLabel === STATUS_LABELS.ABSENT).length
    const onLeave = data.users.filter((u) => u.statusLabel === STATUS_LABELS.EN_CONGE).length

    const stats = this.statCards([
      { label: 'Employés actifs', value: data.users.length },
      { label: "Présents aujourd'hui", value: present + late },
      { label: "Absents aujourd'hui", value: absent },
      { label: 'En congé', value: onLeave },
      { label: 'Connexions sur la période', value: data.connectionsCount },
    ])

    const rows = data.users.map((u) => [
      u.fullName ?? u.username,
      u.role,
      u.businessUnit?.name ?? '',
      u.pole?.name ?? '',
      u.statusLabel,
      u.absences,
      u.lateDays,
      u.lateMinutesTotal,
      this.reports.fmtDateTime(u.lastLoginAt),
    ])

    const body =
      stats +
      this.block(
        "Vue d'ensemble par utilisateur",
        this.table(
          [
            'Utilisateur',
            'Rôle',
            'BU',
            'Pôle',
            "Présence aujourd'hui",
            'Absences (période)',
            'Retards (période)',
            'Minutes retard (période)',
            'Dernière connexion',
          ],
          rows,
          { numericCols: [5, 6, 7] }
        )
      )

    const periodLabel = this.reports.fmtPeriodLabel(data.periodFrom, data.periodTo)
    return this.renderShell('Rapport général', periodLabel, body)
  }
}
