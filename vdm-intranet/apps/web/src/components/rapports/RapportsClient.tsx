'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'

import { downloadCsvBlob, triggerDownload, getMonthStart, getToday, type DateRange } from '@/lib/csv-export'

type ReportKey = 'presence' | 'activity' | 'connections' | 'general'

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
    description: 'Historique des présences, statuts, horaires d\'arrivée et localisations de tous les employés.',
    icon: '📅',
    filename: 'presences.csv',
    hasDateRange: true,
  },
  {
    key: 'activity',
    label: 'Journal d\'activité',
    description: 'Toutes les actions effectuées dans le portail (créations, modifications, suppressions, exports).',
    icon: '📋',
    filename: 'activite.csv',
    hasDateRange: true,
  },
  {
    key: 'connections',
    label: 'Connexions',
    description: 'Historique des connexions et déconnexions de l\'ensemble des utilisateurs avec IP et géolocalisation.',
    icon: '🔌',
    filename: 'connexions.csv',
    hasDateRange: true,
  },
  {
    key: 'general',
    label: 'Rapport général',
    description: 'Vue d\'ensemble consolidée : utilisateurs actifs, BU, groupes horaires et statistiques agrégées.',
    icon: '📊',
    filename: 'rapport-general.csv',
    hasDateRange: false,
  },
]


export function RapportsClient() {
  const [loading, setLoading] = useState<ReportKey | null>(null)
  const [ranges, setRanges] = useState<Record<ReportKey, DateRange>>({
    presence:    { from: getMonthStart(), to: getToday() },
    activity:    { from: getMonthStart(), to: getToday() },
    connections: { from: getMonthStart(), to: getToday() },
    general:     { from: '', to: '' },
  })

  function setRange(key: ReportKey, field: keyof DateRange, value: string) {
    setRanges(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  async function handleDownload(report: ReportConfig) {
    const { from, to } = ranges[report.key]
    if (report.hasDateRange && from && to && from > to) {
      toast.error('La date de début doit être antérieure ou égale à la date de fin.')
      return
    }
    setLoading(report.key)
    try {
      const blob = await downloadCsvBlob(
        report.key,
        report.hasDateRange && from ? from : undefined,
        report.hasDateRange && to ? to : undefined,
      )
      triggerDownload(blob, report.filename)
      toast.success(`Rapport « ${report.label} » téléchargé.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'export.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {REPORTS.map(report => (
        <div key={report.key} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#F28C38]/10 flex items-center justify-center text-2xl shrink-0">
              {report.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 text-[15px]">{report.label}</div>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{report.description}</p>
            </div>
          </div>

          {report.hasDateRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${report.key}-from`} className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Du
                </label>
                <input
                  id={`${report.key}-from`}
                  type="date"
                  value={ranges[report.key].from}
                  max={ranges[report.key].to || getToday()}
                  onChange={e => setRange(report.key, 'from', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                />
              </div>
              <div>
                <label htmlFor={`${report.key}-to`} className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Au
                </label>
                <input
                  id={`${report.key}-to`}
                  type="date"
                  value={ranges[report.key].to}
                  min={ranges[report.key].from || undefined}
                  max={getToday()}
                  onChange={e => setRange(report.key, 'to', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => handleDownload(report)}
            disabled={loading === report.key}
            className="w-full bg-[#F28C38] hover:bg-[#e07d29] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === report.key ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <span className="text-base">↓</span>
                Télécharger CSV
              </>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}
