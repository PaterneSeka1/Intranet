'use client'

import { useEffect, useState } from 'react'
import { Download, FileQuestion } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { apiFetchBlob } from '@/lib/http'
import { chatApi, type MessageAttachment } from '@/lib/chat'

type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'sheet' | 'text' | 'unsupported'

type SheetWorkbook = {
  sheetNames: string[]
  sheets: Record<string, unknown[][]>
}

interface AttachmentPreviewModalProps {
  attachment: MessageAttachment | null
  onClose: () => void
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function extOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : ''
}

function getPreviewKind(mimeType: string, fileName: string): PreviewKind {
  const ext = extOf(fileName)
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf' || ext === '.pdf') return 'pdf'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (
    ['.xlsx', '.xls', '.xlsm', '.csv'].includes(ext) ||
    mimeType === 'text/csv' ||
    mimeType.includes('spreadsheet') ||
    mimeType === 'application/vnd.ms-excel'
  )
    return 'sheet'
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text'
  return 'unsupported'
}

/**
 * Aperçu d'une pièce jointe sans téléchargement préalable. Le fichier est récupéré en mémoire
 * (blob) puis rendu selon son type via une blob: URL plutôt que l'URL brute de l'API : celle-ci
 * répond avec Content-Disposition: attachment (téléchargement forcé), en-tête qui ne s'applique
 * pas à une blob: URL construite côté client.
 */
export function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [workbook, setWorkbook] = useState<SheetWorkbook | null>(null)
  const [activeSheet, setActiveSheet] = useState<string | null>(null)

  useEffect(() => {
    if (!attachment) return
    const att = attachment
    let cancelled = false
    let createdUrl: string | null = null
    setError(null)
    setObjectUrl(null)
    setTextContent(null)
    setWorkbook(null)
    setActiveSheet(null)

    const kind = getPreviewKind(att.mimeType, att.fileName)
    if (kind === 'unsupported') {
      setLoading(false)
      return
    }
    setLoading(true)

    async function load() {
      try {
        const blob = await apiFetchBlob(`/chat/attachments/${att.id}`)
        if (cancelled) return

        if (kind === 'sheet') {
          const XLSX = await import('xlsx')
          const wb =
            extOf(att.fileName) === '.csv'
              ? XLSX.read(await blob.text(), { type: 'string' })
              : XLSX.read(await blob.arrayBuffer(), { type: 'array' })
          const sheets: Record<string, unknown[][]> = {}
          wb.SheetNames.forEach((name) => {
            sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
              header: 1,
              raw: false,
              defval: '',
            }) as unknown[][]
          })
          if (cancelled) return
          setWorkbook({ sheetNames: wb.SheetNames, sheets })
          setActiveSheet(wb.SheetNames[0] ?? null)
        } else if (kind === 'text') {
          setTextContent(await blob.text())
        } else {
          createdUrl = URL.createObjectURL(blob)
          setObjectUrl(createdUrl)
        }
      } catch {
        if (!cancelled) setError("Impossible de charger l'aperçu de ce fichier.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [attachment])

  if (!attachment) return null

  const kind = getPreviewKind(attachment.mimeType, attachment.fileName)
  const activeRows = activeSheet ? (workbook?.sheets[activeSheet] ?? []) : []

  return (
    <Modal
      open={!!attachment}
      onClose={onClose}
      title={attachment.fileName}
      subtitle={fmtSize(attachment.size)}
      size="2xl"
    >
      <div className="flex flex-col gap-3">
        <a
          href={chatApi.attachmentUrl(attachment.id)}
          className="self-start flex items-center gap-1.5 text-xs font-medium text-[#F28C38] hover:underline"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={2} />
          Télécharger
        </a>

        {loading && (
          <p className="text-sm text-gray-400 text-center py-10">Chargement de l&apos;aperçu…</p>
        )}
        {error && <p className="text-sm text-red-500 text-center py-10">{error}</p>}

        {!loading && !error && kind === 'image' && objectUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={objectUrl}
            alt={attachment.fileName}
            className="max-w-full max-h-[75vh] mx-auto rounded-lg object-contain"
          />
        )}

        {!loading && !error && kind === 'pdf' && objectUrl && (
          <iframe
            src={objectUrl}
            title={attachment.fileName}
            className="w-full h-[75vh] rounded-lg border border-gray-100"
          />
        )}

        {!loading && !error && kind === 'video' && objectUrl && (
          <video src={objectUrl} controls className="max-w-full max-h-[75vh] mx-auto rounded-lg" />
        )}

        {!loading && !error && kind === 'audio' && objectUrl && (
          <audio src={objectUrl} controls className="w-full" />
        )}

        {!loading && !error && kind === 'text' && textContent !== null && (
          <pre className="text-xs bg-gray-50 rounded-lg p-3 max-h-[75vh] overflow-auto whitespace-pre-wrap break-words">
            {textContent}
          </pre>
        )}

        {!loading && !error && kind === 'sheet' && workbook && activeSheet && (
          <div className="flex flex-col gap-2">
            {workbook.sheetNames.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {workbook.sheetNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActiveSheet(name)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeSheet === name
                        ? 'bg-[#F28C38] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-gray-100">
              <table className="text-xs border-collapse w-full">
                <tbody>
                  {activeRows.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        i === 0 ? 'bg-gray-50 font-semibold' : 'odd:bg-white even:bg-gray-50/50'
                      }
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-2.5 py-1.5 border border-gray-100 whitespace-nowrap"
                        >
                          {String(cell ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && kind === 'unsupported' && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileQuestion className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
            <p className="text-sm text-gray-400">Aperçu non disponible pour ce type de fichier.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
