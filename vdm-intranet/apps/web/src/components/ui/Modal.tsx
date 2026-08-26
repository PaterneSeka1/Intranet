'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  size?: keyof typeof SIZES
  /** Accent stripe color — defaults to orange */
  accent?: string
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'lg',
  accent = '#F28C38',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Escape key
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Focus initial sur le premier élément focusable de la modale, et restauration du focus sur
  // l'élément qui l'avait avant ouverture (au lieu de le laisser sur le déclencheur masqué
  // derrière le fond assombri, ou nulle part).
  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(firstFocusable ?? panel)?.focus()
    return () => {
      previouslyFocusedRef.current?.focus?.()
    }
  }, [open])

  // Piège de focus : Tab/Shift+Tab restent à l'intérieur de la modale plutôt que de sortir vers
  // le contenu masqué derrière le fond assombri.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Prevent body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    /* Backdrop */
    <div
      className="vdm-backdrop-in fixed inset-0 z-[9000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(10,10,10,0.5)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`
          vdm-panel-in
          bg-white w-full ${SIZES[size]}
          rounded-t-3xl sm:rounded-2xl
          shadow-2xl
          max-h-[92dvh] flex flex-col overflow-hidden
        `}
      >
        {/* Top accent stripe */}
        <div
          className="h-1 shrink-0 rounded-t-3xl sm:rounded-t-2xl"
          style={{ background: accent }}
        />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 id="modal-title" className="font-bold text-gray-900 text-[15px] leading-snug">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-gray-400 mt-0.5 leading-snug">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 ml-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 shrink-0 mx-6" />

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
