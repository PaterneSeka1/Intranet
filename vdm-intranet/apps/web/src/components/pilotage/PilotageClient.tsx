'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  pilotageApi,
  type Summary,
  type PresenceByBu,
  type ConnectionPoint,
  type ActionPoint,
  type ActivityLogPage,
} from '@/lib/pilotage'
import { ServerPagination } from '@/components/ui/DataTable'
import { toast } from '@/lib/toast'

import { downloadCsvBlob, triggerDownload, getMonthStart, getToday, type DateRange } from '@/lib/csv-export'

type ReportKey = 'presence' | 'activity' | 'connections' | 'general'

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  // Authentification
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  // Actions génériques
  VIEW: 'Consultation',
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  EXPORT: 'Export',
  GEOLOCATION: 'Géolocalisation',
  // Onglets
  TAB_CREATED: 'Onglet créé',
  TAB_UPDATED: 'Onglet modifié',
  TAB_DELETED: 'Onglet supprimé',
  TAB_ENABLED: 'Onglet activé',
  TAB_DISABLED: 'Onglet désactivé',
  // Rapports
  REPORT_EXPORTED: 'Rapport exporté',
  PRESENCE_REPORT_EXPORTED: 'Export présences',
  ACTIVITY_REPORT_EXPORTED: 'Export activité',
  CONNECTION_REPORT_EXPORTED: 'Export connexions',
  GENERAL_REPORT_EXPORTED: 'Rapport général',
  // Annonces
  ANNOUNCEMENT_CREATED: 'Annonce créée',
  ANNOUNCEMENT_UPDATED: 'Annonce modifiée',
  ANNOUNCEMENT_DELETED: 'Annonce supprimée',
  // Groupes horaires
  SCHEDULE_GROUP_CREATED: 'Groupe horaire créé',
  SCHEDULE_GROUP_UPDATED: 'Groupe horaire modifié',
  SCHEDULE_GROUP_DELETED: 'Groupe horaire supprimé',
}

const PRESENCE_COLORS = { present: '#22c55e', late: '#F28C38', absent: '#e5e7eb' }
const PIE_COLORS = ['#F28C38', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6', '#f59e0b', '#6366f1']
const EXPORT_ROLES = ['CTO_ADMIN', 'PDG', 'DAF']

type ReportConfig = {
  key: ReportKey
  label: string
  description: string
  icon: string
  filename: string
  hasDateRange: boolean
}

const REPORTS: ReportConfig[] = [
  {
    key: 'presence',
    label: 'Présences',
    description: 'Statuts, horaires d\'arrivée et localisations de tous les employés.',
    icon: '📅',
    filename: 'presences.csv',
    hasDateRange: true,
  },
  {
    key: 'activity',
    label: 'Journal d\'activité',
    description: 'Actions effectuées dans le portail (créations, modifications, exports).',
    icon: '📋',
    filename: 'activite.csv',
    hasDateRange: true,
  },
  {
    key: 'connections',
    label: 'Connexions',
    description: 'Historique des connexions avec adresses IP et géolocalisation.',
    icon: '🔌',
    filename: 'connexions.csv',
    hasDateRange: true,
  },
  {
    key: 'general',
    label: 'Rapport général',
    description: 'Vue consolidée : utilisateurs actifs, BU, groupes horaires et statistiques.',
    icon: '📊',
    filename: 'rapport-general.csv',
    hasDateRange: false,
  },
]

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props { role: string }

export function PilotageClient({ role }: Props) {
  // Pilotage
  const [summary, setSummary] = useState<Summary | null>(null)
  const [presenceByBu, setPresenceByBu] = useState<PresenceByBu[]>([])
  const [connectionsChart, setConnectionsChart] = useState<ConnectionPoint[]>([])
  const [activityChart, setActivityChart] = useState<ActionPoint[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLogPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartDays, setChartDays] = useState(14)

  // Journal
  const [logPage, setLogPage] = useState(1)
  const [logSearch, setLogSearch] = useState('')
  const [logAction, setLogAction] = useState('')
  const [logLoading, setLogLoading] = useState(false)

  // Exports
  const [exportLoading, setExportLoading] = useState<ReportKey | null>(null)
  const [ranges, setRanges] = useState<Record<ReportKey, DateRange>>({
    presence:    { from: getMonthStart(), to: getToday() },
    activity:    { from: getMonthStart(), to: getToday() },
    connections: { from: getMonthStart(), to: getToday() },
    general:     { from: '', to: '' },
  })

  useEffect(() => {
    Promise.all([pilotageApi.summary(), pilotageApi.presenceByBu()])
      .then(([s, p]) => { setSummary(s); setPresenceByBu(p) })
      .catch(err => { toast.error(err instanceof Error ? err.message : 'Impossible de charger le résumé.') })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setChartLoading(true)
    Promise.all([pilotageApi.connectionsChart(chartDays), pilotageApi.activityChart(chartDays)])
      .then(([c, a]) => { setConnectionsChart(c); setActivityChart(a) })
      .catch(err => { toast.error(err instanceof Error ? err.message : 'Impossible de charger les graphiques.') })
      .finally(() => setChartLoading(false))
  }, [chartDays])

  const fetchLog = useCallback(async (page: number, search: string, action: string) => {
    setLogLoading(true)
    try {
      const result = await pilotageApi.activityLog({ page, limit: 25, search: search || undefined, action: action || undefined })
      setActivityLog(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de charger le journal d\'activité.')
    } finally { setLogLoading(false) }
  }, [])

  useEffect(() => { fetchLog(1, '', '') }, [fetchLog])

  useEffect(() => {
    const timer = setTimeout(() => { setLogPage(1); fetchLog(1, logSearch, logAction) }, 400)
    return () => clearTimeout(timer)
  }, [logSearch, logAction, fetchLog])

  function handlePageChange(newPage: number) {
    setLogPage(newPage)
    fetchLog(newPage, logSearch, logAction)
  }

  function setRange(key: ReportKey, field: keyof DateRange, value: string) {
    setRanges(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  async function handleExport(report: ReportConfig) {
    const { from, to } = ranges[report.key]
    if (report.hasDateRange && from && to && from > to) {
      toast.error('La date de début doit être antérieure ou égale à la date de fin.')
      return
    }
    setExportLoading(report.key)
    try {
      const blob = await downloadCsvBlob(
        report.key,
        report.hasDateRange && from ? from : undefined,
        report.hasDateRange && to ? to : undefined,
      )
      triggerDownload(blob, report.filename)
      toast.success(`Rapport « ${report.label} » téléchargé.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du téléchargement.')
    } finally { setExportLoading(null) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-[#F28C38] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const todayLabel = summary
    ? new Date(summary.date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      })
    : ''

  const buChartData = presenceByBu.map(b => ({
    name: b.buCode,
    Présent: b.present,
    Retard: b.late,
    Absent: b.absent,
  }))

  return (
    <div className="space-y-8">

      {/* ── En-tête avec date + sélecteur de période ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tableau de bord</p>
          <h2 className="text-xl font-bold text-gray-900 capitalize">{todayLabel}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Période :</span>
          {[7, 14, 30, 60].map(d => (
            <button
              key={d}
              onClick={() => setChartDays(d)}
              disabled={chartLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60 ${
                chartDays === d
                  ? 'bg-[#F28C38] border-[#F28C38] text-white shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:border-[#F28C38] hover:text-[#F28C38] bg-white'
              }`}
            >
              {d} j
            </button>
          ))}
          {chartLoading && <span className="w-4 h-4 border-2 border-[#F28C38] border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>

      {/* ── KPIs ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Employés actifs" value={summary.totalActive} accentClass="bg-gray-300" valueClass="text-gray-800" />
          <KpiCard label="Présents" value={summary.present} accentClass="bg-green-400" valueClass="text-green-600" />
          <KpiCard label="En retard" value={summary.late} accentClass="bg-[#F28C38]" valueClass="text-[#F28C38]" />
          <KpiCard label="Absents" value={summary.absent} accentClass="bg-gray-200" valueClass="text-gray-400" />
          <KpiCard
            label="Taux de présence"
            value={`${summary.presenceRate} %`}
            accentClass={summary.presenceRate >= 80 ? 'bg-green-400' : 'bg-[#F28C38]'}
            valueClass={summary.presenceRate >= 80 ? 'text-green-600' : 'text-[#F28C38]'}
          />
          <KpiCard label="Mandats du jour" value={summary.mandatesToday} accentClass="bg-purple-300" valueClass="text-purple-600" />
        </div>
      )}

            {/* ── Exports CSV (CTO_ADMIN, PDG, DAF uniquement) ── */}
      {EXPORT_ROLES.includes(role) && (
        <section>
          <div className="mb-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Extraction de données</p>
            <h3 className="text-sm font-semibold text-gray-800">Exports CSV</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {REPORTS.map(report => (
              <div key={report.key} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3.5">
                {/* En-tête carte */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F28C38]/10 flex items-center justify-center text-xl shrink-0">
                    {report.icon}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <div className="font-semibold text-gray-900 text-sm leading-tight">{report.label}</div>
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{report.description}</p>
                  </div>
                </div>

                {/* Plage de dates */}
                {report.hasDateRange && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`pilot-${report.key}-from`} className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Du</label>
                      <input
                        id={`pilot-${report.key}-from`}
                        type="date"
                        value={ranges[report.key].from}
                        max={ranges[report.key].to || getToday()}
                        onChange={e => setRange(report.key, 'from', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                      />
                    </div>
                    <div>
                      <label htmlFor={`pilot-${report.key}-to`} className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Au</label>
                      <input
                        id={`pilot-${report.key}-to`}
                        type="date"
                        value={ranges[report.key].to}
                        min={ranges[report.key].from || undefined}
                        max={getToday()}
                        onChange={e => setRange(report.key, 'to', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                      />
                    </div>
                  </div>
                )}

                {/* Bouton téléchargement */}
                <button
                  onClick={() => handleExport(report)}
                  disabled={exportLoading === report.key}
                  className="mt-auto w-full bg-[#F28C38] hover:bg-[#e07d29] active:bg-[#d06e1a] text-white font-semibold py-2 rounded-xl text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {exportLoading === report.key ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Génération…</>
                  ) : (
                    <><span className="text-sm leading-none">↓</span>Télécharger CSV</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Graphiques ── */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity duration-300 ${chartLoading ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Aujourd&apos;hui</p>
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Présences par BU</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Présent" fill={PRESENCE_COLORS.present} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Retard" fill={PRESENCE_COLORS.late} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Absent" fill={PRESENCE_COLORS.absent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{chartDays} derniers jours</p>
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Connexions</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={connectionsChart} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={d => { const [, m, day] = d.split('-'); return `${day}/${m}` }}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={d => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }} />
              <Bar dataKey="connexions" fill="#F28C38" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top actions (pie) ── */}
      {activityChart.length > 0 && (
        <div className={`bg-white rounded-2xl border border-gray-100 p-5 transition-opacity duration-300 ${chartLoading ? 'opacity-40 pointer-events-none' : ''}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{chartDays} derniers jours</p>
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Top actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={activityChart.map(a => ({ name: ACTION_LABELS[a.action] ?? a.action, value: a.count }))}
                  cx="50%" cy="50%" outerRadius={80} dataKey="value"
                >
                  {activityChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2.5">
              {activityChart.map((a, i) => (
                <div key={a.action} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs text-gray-600 flex-1">{ACTION_LABELS[a.action] ?? a.action}</span>
                  <span className="text-xs font-bold text-gray-800 tabular-nums">{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Journal d'activité ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Audit</p>
            <h3 className="text-sm font-semibold text-gray-800">Journal d&apos;activité</h3>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <input
              type="text"
              placeholder="Rechercher un utilisateur…"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] placeholder-gray-300 w-44"
            />
            <select
              value={logAction}
              onChange={e => setLogAction(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38] text-gray-600"
            >
              <option value="">Toutes les actions</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date / Heure', 'Utilisateur', 'Rôle', 'Action', 'Entité', 'IP'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`transition-opacity duration-200 ${logLoading ? 'opacity-40' : ''}`}>
              {activityLog?.logs.map((log, idx) => (
                <tr key={log.id} className={`hover:bg-[#F28C38]/5 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-3 py-2.5 font-mono text-gray-500 whitespace-nowrap">
                    {new Date(log.occurredAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{log.user.fullName ?? log.user.username}</td>
                  <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap text-[11px]">{log.user.role}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block bg-white border border-gray-100 shadow-sm px-2 py-0.5 rounded-lg text-gray-600 whitespace-nowrap">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">
                    {log.entity ? `${log.entity}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-gray-400 whitespace-nowrap">{log.ipAddress ?? '—'}</td>
                </tr>
              ))}
              {activityLog?.logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-400">Aucun événement trouvé</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {activityLog && (
          <div className="mt-3">
            <ServerPagination
              page={logPage}
              totalPages={activityLog.pages}
              total={activityLog.total}
              pageSize={25}
              loading={logLoading}
              onPageChange={handlePageChange}
              label="événements"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  accentClass,
  valueClass,
}: {
  label: string
  value: string | number
  accentClass: string
  valueClass: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-1 relative overflow-hidden">
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${accentClass}`} />
      <div className={`text-2xl font-bold pl-3 tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-gray-400 pl-3 leading-tight">{label}</div>
    </div>
  )
}
