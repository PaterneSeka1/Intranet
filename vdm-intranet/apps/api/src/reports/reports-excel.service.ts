import { Injectable } from '@nestjs/common'
import ExcelJS from 'exceljs'
import { LogAction, Role } from '@prisma/client'
import { ReportsService, STATUS_LABELS } from './reports.service'
import { LOGO_BASE64_PNG } from './assets/logo'

type Requester = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

const BRAND_ORANGE = 'FFF28C38'
const BRAND_NAVY = 'FF111827'
const BRAND_GRAY = 'FF6B7280'
const ROW_STRIPE = 'FFFAFAFA'
const BORDER_LIGHT = 'FFF3F4F6'

const LOGO_BUFFER = Buffer.from(LOGO_BASE64_PNG.split(',')[1], 'base64')

type ColumnDef = { label: string; width: number; numeric?: boolean }

/**
 * Construit les classeurs Excel (.xlsx) des exports — pendant "tableur" de `ReportsPdfService`.
 * Centralise la mise en page (bandeau de marque, en-têtes colorés, gel de volet, filtre auto,
 * alternance de lignes) pour que les quatre rapports partagent un même rendu professionnel.
 */
@Injectable()
export class ReportsExcelService {
  constructor(private readonly reports: ReportsService) {}

  async presenceExcel(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const [rows, summaryRows] = await Promise.all([
      this.reports.getPresenceRows(requester, dateFrom, dateTo),
      this.reports.getPresenceSummaryRows(requester, dateFrom, dateTo),
    ])
    const workbook = this.newWorkbook()
    const periodLabel = this.reports.periodLabel(dateFrom, dateTo, '90 derniers jours par défaut')

    this.buildSheet(workbook, 'Synthèse', {
      title: 'Rapport de présences — Synthèse par personne',
      subtitle: periodLabel,
      headers: [
        { label: 'Utilisateur', width: 16 },
        { label: 'Nom complet', width: 22 },
        { label: 'Rôle', width: 16 },
        { label: 'BU', width: 16 },
        { label: 'Pôle', width: 16 },
        { label: 'Emploi du temps', width: 26 },
        { label: 'Absences', width: 12, numeric: true },
        { label: 'Jours de retard', width: 14, numeric: true },
        { label: 'Minutes de retard (total)', width: 20, numeric: true },
      ],
      rows: summaryRows.map((r) => [
        r.username,
        r.fullName ?? '',
        r.role,
        r.businessUnitName,
        r.poleName,
        r.scheduleLabel,
        r.absences,
        r.lateDays,
        r.lateMinutesTotal,
      ]),
    })

    this.buildSheet(workbook, 'Détail', {
      title: 'Rapport de présences — Détail journalier',
      subtitle: periodLabel,
      headers: [
        { label: 'Date', width: 12 },
        { label: 'Utilisateur', width: 16 },
        { label: 'Nom complet', width: 22 },
        { label: 'Rôle', width: 16 },
        { label: 'BU', width: 16 },
        { label: 'Pôle', width: 16 },
        { label: 'Statut', width: 14 },
        { label: 'Heure attendue', width: 14 },
        { label: 'Arrivée officielle', width: 18 },
        { label: 'Écart (min)', width: 12, numeric: true },
        { label: 'Adresse GPS', width: 30 },
        { label: 'Source', width: 12 },
      ],
      rows: rows.map((r) => [
        this.reports.fmtDate(r.date),
        r.user.username,
        r.user.fullName ?? '',
        r.user.role,
        r.user.businessUnit?.name ?? '',
        r.user.pole?.name ?? '',
        STATUS_LABELS[r.status] ?? r.status,
        r.expectedArrivalTime,
        this.reports.fmtDateTime(r.officialArrivalTime),
        r.delayMinutes ?? '',
        r.address ?? '',
        r.sourceConnectionLogId ? 'Connexion' : 'Manuel',
      ]),
    })

    await this.reports.logExport(requester.id, LogAction.PRESENCE_REPORT_EXPORTED, 'excel')
    return this.toBuffer(workbook)
  }

  async activityExcel(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const rows = await this.reports.getActivityRows(requester, dateFrom, dateTo)
    const workbook = this.newWorkbook()

    this.buildSheet(workbook, "Journal d'activité", {
      title: "Journal d'activité",
      subtitle: this.reports.periodLabel(dateFrom, dateTo, '90 derniers jours par défaut'),
      headers: [
        { label: 'Date/Heure', width: 16 },
        { label: 'Utilisateur', width: 16 },
        { label: 'Nom complet', width: 22 },
        { label: 'Rôle', width: 16 },
        { label: 'BU', width: 16 },
        { label: 'Action', width: 20 },
        { label: 'Entité', width: 16 },
        { label: 'ID Entité', width: 18 },
        { label: 'IP', width: 16 },
        { label: 'User-Agent', width: 40 },
      ],
      rows: rows.map((r) => [
        this.reports.fmtDateTime(r.occurredAt),
        r.user.username,
        r.user.fullName ?? '',
        r.user.role,
        r.user.businessUnit?.name ?? '',
        r.action,
        r.entity ?? '',
        r.entityId ?? '',
        r.ipAddress ?? '',
        r.userAgent ?? '',
      ]),
    })

    await this.reports.logExport(requester.id, LogAction.ACTIVITY_REPORT_EXPORTED, 'excel')
    return this.toBuffer(workbook)
  }

  async connectionsExcel(
    requester: Requester,
    dateFrom?: string,
    dateTo?: string
  ): Promise<Buffer> {
    const rows = await this.reports.getConnectionRows(requester, dateFrom, dateTo)
    const workbook = this.newWorkbook()

    this.buildSheet(workbook, 'Connexions', {
      title: 'Rapport de connexions',
      subtitle: this.reports.periodLabel(dateFrom, dateTo, '90 derniers jours par défaut'),
      headers: [
        { label: 'Date', width: 12 },
        { label: 'Heure connexion', width: 16 },
        { label: 'Heure déconnexion', width: 16 },
        { label: 'Utilisateur', width: 16 },
        { label: 'Nom complet', width: 22 },
        { label: 'Rôle', width: 16 },
        { label: 'BU', width: 16 },
        { label: 'Type', width: 12 },
        { label: '1ère connexion', width: 14 },
        { label: 'IP', width: 16 },
        { label: 'Adresse GPS', width: 30 },
      ],
      rows: rows.map((r) => [
        this.reports.fmtDate(r.date),
        this.reports.fmtDateTime(r.connectedAt),
        this.reports.fmtDateTime(r.disconnectedAt),
        r.user.username,
        r.user.fullName ?? '',
        r.user.role,
        r.user.businessUnit?.name ?? '',
        r.type,
        r.isFirstConnectionOfDay ? 'Oui' : 'Non',
        r.ipAddress ?? '',
        r.address ?? '',
      ]),
    })

    await this.reports.logExport(requester.id, LogAction.CONNECTION_REPORT_EXPORTED, 'excel')
    return this.toBuffer(workbook)
  }

  async generalExcel(requester: Requester, dateFrom?: string, dateTo?: string): Promise<Buffer> {
    const data = await this.reports.getGeneralData(requester, dateFrom, dateTo)
    const workbook = this.newWorkbook()
    const periodLabel = this.reports.fmtPeriodLabel(data.periodFrom, data.periodTo)
    const presMap = new Map(data.presences.map((p) => [p.user.username, p]))

    this.buildSheet(workbook, "Vue d'ensemble", {
      title: 'Rapport général',
      subtitle: `${periodLabel} · Connexions sur la période : ${data.connectionsCount}`,
      headers: [
        { label: 'Utilisateur', width: 16 },
        { label: 'Nom complet', width: 22 },
        { label: 'Rôle', width: 16 },
        { label: 'BU', width: 16 },
        { label: 'Pôle', width: 16 },
        { label: 'Emploi du temps', width: 26 },
        { label: "Présence aujourd'hui", width: 16 },
        { label: 'Arrivée', width: 18 },
        { label: 'Écart (min)', width: 12, numeric: true },
        { label: 'Absences (période)', width: 16, numeric: true },
        { label: 'Retards (période)', width: 16, numeric: true },
        { label: 'Minutes de retard (période)', width: 20, numeric: true },
        { label: 'Dernière connexion', width: 18 },
      ],
      rows: data.users.map((u) => {
        const pres = presMap.get(u.username)
        return [
          u.username,
          u.fullName ?? '',
          u.role,
          u.businessUnit?.name ?? '',
          u.pole?.name ?? '',
          u.scheduleLabel,
          u.statusLabel,
          pres ? this.reports.fmtDateTime(pres.officialArrivalTime) : '',
          pres?.delayMinutes ?? '',
          u.absences,
          u.lateDays,
          u.lateMinutesTotal,
          this.reports.fmtDateTime(u.lastLoginAt),
        ]
      }),
    })

    await this.reports.logExport(requester.id, LogAction.GENERAL_REPORT_EXPORTED, 'excel')
    return this.toBuffer(workbook)
  }

  async employeeExcel(
    requester: Requester,
    userId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<Buffer> {
    const data = await this.reports.getEmployeeReportData(requester, userId, dateFrom, dateTo)
    const { user, summary, presenceRows, leaves } = data
    const workbook = this.newWorkbook()
    const displayName = user.fullName ?? user.username
    const periodLabel = this.reports.fmtPeriodLabel(data.periodFrom, data.periodTo)

    this.buildSheet(workbook, 'Fiche', {
      title: `Fiche employé — ${displayName}`,
      subtitle: `Généré le ${this.reports.fmtDate(new Date())}`,
      headers: [
        { label: 'Champ', width: 22 },
        { label: 'Valeur', width: 40 },
      ],
      rows: [
        ['Identifiant', user.username],
        ['Nom complet', displayName],
        ['Email', user.email ?? ''],
        ['Rôle', user.role],
        ['Business Unit', user.businessUnit?.name ?? ''],
        ['Pôle', user.pole?.name ?? ''],
        ['Manager', user.manager?.fullName ?? user.manager?.username ?? ''],
        ['Emploi du temps', user.scheduleLabel],
        ['Statut du compte', user.isActive ? 'Actif' : 'Inactif'],
        ['Compte créé le', this.reports.fmtDate(user.createdAt)],
        ['Dernière connexion', this.reports.fmtDateTime(user.lastLoginAt)],
      ],
    })

    this.buildSheet(workbook, 'Présence', {
      title: 'Détail de présence',
      subtitle: `${periodLabel} · Absences : ${summary.absences} · Jours de retard : ${summary.lateDays} · Minutes de retard : ${summary.lateMinutesTotal}`,
      headers: [
        { label: 'Date', width: 12 },
        { label: 'Statut', width: 14 },
        { label: 'Heure attendue', width: 14 },
        { label: 'Arrivée officielle', width: 18 },
        { label: 'Écart (min)', width: 12, numeric: true },
        { label: 'Adresse GPS', width: 30 },
        { label: 'Source', width: 12 },
      ],
      rows: presenceRows.map((r) => [
        this.reports.fmtDate(r.date),
        STATUS_LABELS[r.status] ?? r.status,
        r.expectedArrivalTime,
        this.reports.fmtDateTime(r.officialArrivalTime),
        r.delayMinutes ?? '',
        r.address ?? '',
        r.sourceConnectionLogId ? 'Connexion' : 'Manuel',
      ]),
    })

    this.buildSheet(workbook, 'Congés', {
      title: 'Congés sur la période',
      subtitle: periodLabel,
      headers: [
        { label: 'Type', width: 26 },
        { label: 'Du', width: 14 },
        { label: 'Au', width: 14 },
      ],
      rows: leaves.map((l) => [l.typeLabel, this.reports.fmtDate(l.startDate), this.reports.fmtDate(l.endDate)]),
    })

    await this.reports.logExport(requester.id, LogAction.EMPLOYEE_REPORT_EXPORTED, 'excel')
    return this.toBuffer(workbook)
  }

  // ─── Construction & mise en page ────────────────────────────────────────────

  private newWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Portail Intranet — Veilleur des Médias'
    workbook.created = new Date()
    return workbook
  }

  private async toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    const data = await workbook.xlsx.writeBuffer()
    return Buffer.from(data)
  }

  /**
   * Construit une feuille complète : bandeau de marque (logo, titre, sous-titre), en-tête de
   * tableau coloré, lignes de données zébrées, volet gelé + filtre auto sous l'en-tête, et note
   * de pied de page. Même structure pour les 4 rapports, seuls titre/colonnes/données varient.
   */
  private buildSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    opts: { title: string; subtitle: string; headers: ColumnDef[]; rows: (string | number)[][] }
  ) {
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31))
    const columnCount = opts.headers.length

    opts.headers.forEach((h, i) => {
      sheet.getColumn(i + 1).width = h.width
    })

    // Bandeau de marque : logo + titre + sous-titre (période, portée, métadonnées).
    sheet.mergeCells(1, 1, 1, columnCount)
    sheet.getRow(1).height = 32
    const titleCell = sheet.getCell(1, 1)
    titleCell.value = opts.title
    titleCell.font = { bold: true, size: 14, color: { argb: BRAND_NAVY } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 6 }

    sheet.mergeCells(2, 1, 2, columnCount)
    sheet.getRow(2).height = 18
    const subtitleCell = sheet.getCell(2, 1)
    subtitleCell.value = opts.subtitle
    subtitleCell.font = { size: 9, italic: true, color: { argb: BRAND_GRAY } }
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 6 }

    sheet.getRow(3).height = 6 // séparateur

    // @types/node 22 rend `Buffer` générique (`Buffer<ArrayBuffer>` vs `Buffer<ArrayBufferLike>`) —
    // incompatibilité de typage connue entre cette version et les .d.ts d'exceljs, sans impact
    // runtime (c'est un vrai Buffer dans tous les cas) ; `any` évite de trancher quelle
    // instanciation générique de `Buffer` s'applique ici.
    const imageId = workbook.addImage({ buffer: LOGO_BUFFER as any, extension: 'png' })
    sheet.addImage(imageId, { tl: { col: 0.05, row: 0.05 }, ext: { width: 120, height: 40 } })

    // En-tête de tableau.
    const headerRowNumber = 4
    const headerRow = sheet.getRow(headerRowNumber)
    headerRow.values = opts.headers.map((h) => h.label)
    headerRow.height = 20
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_ORANGE } }
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
    })

    // Données, zébrées, alignement à droite pour les colonnes numériques.
    opts.rows.forEach((r, i) => {
      const row = sheet.addRow(r)
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { size: 10, color: { argb: 'FF374151' } }
        cell.border = { bottom: { style: 'hair', color: { argb: BORDER_LIGHT } } }
        if (opts.headers[colNumber - 1]?.numeric) {
          cell.alignment = { horizontal: 'right' }
        }
        if (i % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_STRIPE } }
        }
      })
    })

    sheet.views = [
      { state: 'frozen', ySplit: headerRowNumber, showGridLines: false, activeCell: 'A1' },
    ]
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: columnCount },
    }

    const footerRowNumber = headerRowNumber + opts.rows.length + 2
    sheet.mergeCells(footerRowNumber, 1, footerRowNumber, columnCount)
    const footerCell = sheet.getCell(footerRowNumber, 1)
    footerCell.value =
      opts.rows.length === 0
        ? 'Aucune donnée sur la période sélectionnée.'
        : `${opts.rows.length} ligne(s) — document généré automatiquement par le portail Intranet Veilleur des Médias.`
    footerCell.font = { italic: true, size: 8, color: { argb: BRAND_GRAY } }
  }
}
