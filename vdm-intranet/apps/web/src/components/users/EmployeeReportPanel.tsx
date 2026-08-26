'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from '@/lib/toast'
import { downloadEmployeeExcelBlob, triggerDownload, getMonthStart, getToday } from '@/lib/excel-export'
import { downloadEmployeePdfBlob } from '@/lib/pdf-export'

interface Props {
  userId: string
  username: string
}

/**
 * Panneau d'export de la fiche individuelle d'un employé (présence, emploi du temps, congés,
 * informations RH) — même patron que les cartes d'export de PilotageClient, réduit à un seul
 * rapport puisque la période s'applique ici à un employé déjà choisi (pas de sélecteur de clé).
 */
export function EmployeeReportPanel({ userId, username }: Props) {
  const [range, setRange] = useState({ from: getMonthStart(), to: getToday() })
  const [excelLoading, setExcelLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  function setField(field: 'from' | 'to', value: string) {
    setRange((prev) => ({ ...prev, [field]: value }))
  }

  function validRange(): boolean {
    if (range.from && range.to && range.from > range.to) {
      toast.error('La date de début doit être antérieure ou égale à la date de fin.')
      return false
    }
    return true
  }

  async function handleExcel() {
    if (!validRange()) return
    setExcelLoading(true)
    try {
      const blob = await downloadEmployeeExcelBlob(
        userId,
        range.from || undefined,
        range.to || undefined
      )
      triggerDownload(blob, `fiche-${username}.xlsx`)
      toast.success('Fiche employé téléchargée.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du téléchargement.')
    } finally {
      setExcelLoading(false)
    }
  }

  async function handlePdf() {
    if (!validRange()) return
    setPdfLoading(true)
    try {
      const blob = await downloadEmployeePdfBlob(
        userId,
        range.from || undefined,
        range.to || undefined
      )
      triggerDownload(blob, `fiche-${username}.pdf`)
      toast.success('Fiche employé téléchargée (PDF).')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du téléchargement.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
          Extraction de données
        </p>
        <h3 className="text-sm font-semibold text-gray-800">Rapport individuel</h3>
        <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
          Présence, emploi du temps, congés et informations RH sur la période sélectionnée.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <div>
          <label
            htmlFor="employee-report-from"
            className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1"
          >
            Du
          </label>
          <input
            id="employee-report-from"
            type="date"
            value={range.from}
            max={range.to || getToday()}
            onChange={(e) => setField('from', e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
          />
        </div>
        <div>
          <label
            htmlFor="employee-report-to"
            className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1"
          >
            Au
          </label>
          <input
            id="employee-report-to"
            type="date"
            value={range.to}
            min={range.from || undefined}
            max={getToday()}
            onChange={(e) => setField('to', e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 focus:border-[#F28C38]"
          />
        </div>
      </div>

      <div className="flex gap-2 max-w-sm">
        <button
          onClick={handleExcel}
          disabled={excelLoading}
          className="flex-1 bg-[#F28C38] hover:bg-[#e07d29] active:bg-[#d06e1a] text-white font-semibold py-2 rounded-xl text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {excelLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Génération…
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" strokeWidth={1.75} />Excel
            </>
          )}
        </button>
        <button
          onClick={handlePdf}
          disabled={pdfLoading}
          className="flex-1 border border-[#F28C38] text-[#F28C38] hover:bg-[#F28C38]/5 font-semibold py-2 rounded-xl text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {pdfLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-[#F28C38] border-t-transparent rounded-full animate-spin" />
              Génération…
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" strokeWidth={1.75} />PDF
            </>
          )}
        </button>
      </div>
    </div>
  )
}
