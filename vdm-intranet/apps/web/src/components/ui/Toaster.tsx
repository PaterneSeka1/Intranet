'use client'

import { useEffect, useRef, useState } from 'react'
import { subscribeToasts, dismissToast, type ToastItem, type ToastType } from '@/lib/toast'

// ---------------------------------------------------------------------------
// Config par type
// ---------------------------------------------------------------------------

const CONFIG: Record<
  ToastType,
  {
    bar: string
    icon: string
    iconBg: string
    iconColor: string
    title: string
  }
> = {
  success: {
    bar: 'bg-green-500',
    icon: '✓',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    title: 'Succès',
  },
  error: {
    bar: 'bg-red-500',
    icon: '✕',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    title: 'Erreur',
  },
  info: {
    bar: 'bg-blue-500',
    icon: 'ℹ',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Information',
  },
  warning: {
    bar: 'bg-amber-500',
    icon: '⚠',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'Attention',
  },
}

// ---------------------------------------------------------------------------
// Carte toast individuelle
// ---------------------------------------------------------------------------

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const startRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const cfg = CONFIG[item.type]

  function startExit() {
    setVisible(false)
    setTimeout(onDone, 300)
  }

  useEffect(() => {
    // Trigger enter animation
    const t = setTimeout(() => setVisible(true), 10)

    // Progress bar animation
    startRef.current = performance.now()
    function tick(now: number) {
      const elapsed = now - startRef.current
      const pct = Math.max(0, 100 - (elapsed / item.duration) * 100)
      setProgress(pct)
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        startExit()
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      clearTimeout(t)
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={`
        relative flex items-start gap-3 w-[340px] bg-white rounded-2xl shadow-xl border border-gray-100
        overflow-hidden px-4 py-4 pointer-events-auto cursor-default
        transition-all duration-300 ease-out select-none
        ${visible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-12 scale-95'}
      `}
    >
      {/* Left color bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cfg.bar}`} />

      {/* Icon */}
      <div
        className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${cfg.iconBg} ${cfg.iconColor}`}
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">
          {cfg.title}
        </p>
        <p className="text-sm text-gray-800 leading-snug break-words">{item.message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={startExit}
        className="shrink-0 -mt-0.5 -mr-1 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors text-base leading-none"
        aria-label="Fermer"
      >
        ×
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-100">
        <div className={`h-full ${cfg.bar} transition-none`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toaster global
// ---------------------------------------------------------------------------

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribeToasts(
      (item) => setToasts((prev) => [...prev.slice(-4), item]),
      (id) => setToasts((prev) => prev.filter((t) => t.id !== id))
    )
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDone={() => dismissToast(t.id)} />
      ))}
    </div>
  )
}
