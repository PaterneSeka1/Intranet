import { apiFetchBlob } from './http'
import { triggerDownload } from './excel-export'

export { triggerDownload }

export function downloadPdfBlob(
  key: 'presence' | 'activity' | 'connections' | 'general',
  from?: string,
  to?: string
): Promise<Blob> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return apiFetchBlob(`/reports/${key}/pdf${qs ? `?${qs}` : ''}`, {
    defaultErrorMessage: 'Erreur lors de la génération du PDF.',
  })
}

export function downloadEmployeePdfBlob(
  userId: string,
  from?: string,
  to?: string
): Promise<Blob> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return apiFetchBlob(`/reports/employee/${userId}/pdf${qs ? `?${qs}` : ''}`, {
    defaultErrorMessage: 'Erreur lors de la génération de la fiche employé.',
  })
}
