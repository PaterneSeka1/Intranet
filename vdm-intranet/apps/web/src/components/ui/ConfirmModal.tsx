'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Trash2, HelpCircle } from 'lucide-react'
import { subscribeConfirm, resolveConfirm, type ConfirmOptions } from '@/lib/confirm'

export function ConfirmPortal() {
  const [state, setState] = useState<ConfirmOptions | null>(null)
  const [visible, setVisible] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Subscribe via window events — survives HMR module re-evaluation
  useEffect(() => {
    return subscribeConfirm(
      (opts) => {
        setState(opts)
        setTimeout(() => setVisible(true), 10)
      },
      () => {
        setVisible(false)
        setTimeout(() => setState(null), 250)
      }
    )
  }, [])

  // Focus management
  useEffect(() => {
    if (visible) {
      const btn = state?.destructive ? confirmRef.current : cancelRef.current
      setTimeout(() => btn?.focus(), 60)
    }
  }, [visible, state?.destructive])

  // Escape closes
  useEffect(() => {
    if (!visible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  const close = useCallback((value: boolean) => {
    resolveConfirm(value)
  }, [])

  if (!state) return null

  const {
    title,
    message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    destructive = false,
  } = state

  return (
    /* Backdrop */
    <div
      className={`
        fixed inset-0 z-[9998] flex items-center justify-center p-4
        transition-all duration-250
        ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
      style={{ background: 'rgba(15,15,15,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={() => close(false)}
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className={`
          bg-white rounded-2xl shadow-2xl w-full max-w-[400px]
          overflow-hidden
          transition-all duration-250 ease-out
          ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}
        `}
      >
        {/* Top color stripe */}
        <div className={`h-1.5 w-full ${destructive ? 'bg-red-500' : 'bg-[#F28C38]'}`} />

        <div className="px-7 pt-7 pb-6">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-5">
            <div
              className={`
              shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
              ${destructive ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}
            `}
            >
              {destructive ? (
                <Trash2 className="w-6 h-6" strokeWidth={1.75} />
              ) : (
                <HelpCircle className="w-6 h-6" strokeWidth={1.75} />
              )}
            </div>
            <div className="flex-1 pt-1.5">
              {title && (
                <h2
                  id="confirm-title"
                  className="font-bold text-gray-900 text-base mb-1 leading-snug"
                >
                  {title}
                </h2>
              )}
              <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => close(false)}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={() => close(true)}
              className={`
                flex-1 h-11 rounded-xl text-sm font-bold text-white transition-all
                focus:outline-none focus:ring-2 focus:ring-offset-2
                ${
                  destructive
                    ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400 active:bg-red-700'
                    : 'bg-[#F28C38] hover:bg-[#e07d29] focus:ring-[#F28C38]/50 active:bg-[#d06e20]'
                }
              `}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
