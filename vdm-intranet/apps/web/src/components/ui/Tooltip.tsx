'use client'

import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const GAP = 8

const TRANSFORM_BY_SIDE = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0, -50%)',
} as const

type Side = keyof typeof TRANSFORM_BY_SIDE

interface TooltipProps {
  label: string
  children: ReactNode
  side?: Side
  /** `block` (au lieu de `inline-flex`) pour les déclencheurs qui doivent occuper toute la largeur
   * de leur conteneur (ex. bouton de pièce jointe en `w-full`). */
  block?: boolean
  className?: string
}

/** Infobulle survolable, positionnée en `fixed` via portail vers `document.body` et calculée à
 * partir du rectangle du déclencheur. Contrairement à `title` (délai natif ~1,5 s, souvent manqué
 * au survol rapide) ou à une bulle positionnée en `absolute` dans le flux, elle s'affiche
 * immédiatement et n'est jamais rognée par les conteneurs `overflow-hidden`/`overflow-y-auto` du
 * widget de messagerie (panneau, liste de conversations, fil de messages). */
export function Tooltip({
  label,
  children,
  side = 'top',
  block = false,
  className = '',
}: TooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const positions: Record<Side, { top: number; left: number }> = {
      top: { top: rect.top - GAP, left: rect.left + rect.width / 2 },
      bottom: { top: rect.bottom + GAP, left: rect.left + rect.width / 2 },
      left: { top: rect.top + rect.height / 2, left: rect.left - GAP },
      right: { top: rect.top + rect.height / 2, left: rect.right + GAP },
    }
    setCoords(positions[side])
  }

  function hide() {
    setCoords(null)
  }

  return (
    <span
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={`${block ? 'block' : 'inline-flex'} ${className}`}
    >
      {children}
      {coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: TRANSFORM_BY_SIDE[side],
            }}
            className="pointer-events-none z-[9999] whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  )
}
