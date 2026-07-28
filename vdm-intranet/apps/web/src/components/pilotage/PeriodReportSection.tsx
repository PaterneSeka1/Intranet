'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { pilotageApi, type PeriodReport } from '@/lib/pilotage'
import { toast } from '@/lib/toast'

type Period = 'week' | 'month'

const LINE_COLORS = ['#F28C38', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#14b8a6', '#f59e0b']

function todayIso(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function shiftIso(iso: string, period: Period): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (period === 'week') dt.setUTCDate(dt.getUTCDate() + 7)
  else dt.setUTCMonth(dt.getUTCMonth() + 1)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function shiftBackIso(iso: string, period: Period): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (period === 'week') dt.setUTCDate(dt.getUTCDate() - 7)
  else dt.setUTCMonth(dt.getUTCMonth() - 1)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function fmtRange(from: string, to: string): string {
  const f = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  return `${f(from)} — ${f(to)}`
}

export function PeriodReportSection() {
  const [period, setPeriod] = useState<Period>('week')
  const [refDate, setRefDate] = useState(todayIso())
  const [report, setReport] = useState<PeriodReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    pilotageApi
      .periodReport(period, refDate)
      .then((data) => {
        if (mounted) setReport(data)
      })
      .catch(() => {
        if (mounted) toast.error('Impossible de charger le rapport de période.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [period, refDate])

  const buCodes = report?.trend.length
    ? Object.keys(report.trend[0]).filter((k) => k !== 'date' && k !== 'overall')
    : []

  const isCurrentPeriod = refDate === todayIso() || (report && report.to >= todayIso())

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Reporting hiérarchique
          </p>
          <h3 className="text-sm font-semibold text-gray-800">
            {report ? fmtRange(report.from, report.to) : '…'}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {(['week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRefDate((d) => shiftBackIso(d, period))}
            className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#F28C38] hover:text-[#F28C38] transition-colors text-sm"
          >
            ‹
          </button>
          <button
            onClick={() => setRefDate((d) => shiftIso(d, period))}
            disabled={!!isCurrentPeriod}
            className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#F28C38] hover:text-[#F28C38] transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ›
          </button>
          {!isCurrentPeriod && (
            <button
              onClick={() => setRefDate(todayIso())}
              className="text-xs text-[#F28C38] hover:underline font-medium"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Taux de présence moyen par BU</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={report?.byBu ?? []} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="buCode" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} unit="%" />
              <Tooltip formatter={(value: number) => [`${value}%`, 'Taux de présence']} />
              <Bar dataKey="presenceRate" fill="#F28C38" radius={[3, 3, 0, 0]} name="Taux" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Tendance quotidienne (%)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={report?.trend ?? []}
              margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d: string) => {
                  const [, m, day] = d.split('-')
                  return `${day}/${m}`
                }}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} unit="%" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {buCodes.length > 1 &&
                buCodes.map((code, i) => (
                  <Line
                    key={code}
                    type="monotone"
                    dataKey={code}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              <Line
                type="monotone"
                dataKey="overall"
                stroke="#111827"
                strokeWidth={2}
                dot={false}
                name="Global"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {report && report.byBu.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          Aucune donnée de présence sur cette période.
        </p>
      )}
    </div>
  )
}
