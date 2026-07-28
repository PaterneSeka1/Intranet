import { API_BASE } from './api-base'
import { triggerDownload } from './csv-export'

export { triggerDownload }

export async function downloadPdfBlob(
  key: 'presence' | 'activity' | 'connections' | 'general',
  from?: string,
  to?: string
): Promise<Blob> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 60_000)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/reports/${key}/pdf${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(tid)
  }
  if (!res.ok) {
    let msg = 'Erreur lors de la génération du PDF.'
    try {
      const body = await res.json()
      msg = body.message ?? msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return res.blob()
}
