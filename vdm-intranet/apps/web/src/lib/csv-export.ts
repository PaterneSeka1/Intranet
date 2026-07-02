import { API_BASE } from './api-base'

export type DateRange = { from: string; to: string }

export function getMonthStart(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function getToday(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadCsvBlob(key: string, from?: string, to?: string): Promise<Blob> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 60_000)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/reports/${key}${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(tid)
  }
  if (!res.ok) {
    let msg = 'Erreur lors de la génération du rapport.'
    try { const body = await res.json(); msg = body.message ?? msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.blob()
}
