'use client'

import { useEffect, useRef, useState } from 'react'

const LS_KEY = 'vdm_dismissed_announcements'

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

interface Props {
  announcements: { id: string; title: string; body: string; isPinned: boolean }[]
}

export function AnnouncementBanner({ announcements }: Props) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const trackRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    setDismissedIds(loadDismissed())
  }, [])

  const visible = announcements.filter((a) => !dismissedIds.has(a.id))

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let pos = 0
    const speed = 0.5
    const animate = () => {
      pos -= speed
      if (Math.abs(pos) >= el.scrollWidth / 2) pos = 0
      el.style.transform = `translateX(${pos}px)`
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [visible.length])

  function dismiss() {
    const next = new Set(dismissedIds)
    visible.forEach((a) => next.add(a.id))
    saveDismissed(next)
    setDismissedIds(next)
  }

  if (visible.length === 0) return null

  const text = visible
    .map((a) => `${a.isPinned ? '📌 ' : ''}${a.title} — ${a.body}`)
    .join('   ·   ')

  return (
    <div className="relative bg-[#F28C38] text-white text-xs font-medium overflow-hidden h-8 flex items-center shrink-0">
      <div className="overflow-hidden flex-1">
        <div ref={trackRef} className="flex whitespace-nowrap will-change-transform">
          <span className="pr-24">{text}</span>
          <span className="pr-24">{text}</span>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 px-3 text-white/70 hover:text-white text-base leading-none"
        aria-label="Fermer la bannière"
      >
        ×
      </button>
    </div>
  )
}
