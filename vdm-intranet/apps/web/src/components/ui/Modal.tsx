'use client'

import { useEffect } from 'react'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
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
            className="shrink-0 ml-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-[22px] leading-none pb-0.5"
          >
            ×
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
