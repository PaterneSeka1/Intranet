'use client'

import { useEffect, useRef, useState } from 'react'

const LS_KEY = 'vdm_dismissed_announcements'

type BannerAnnouncement = {
  id: string
  title: string
  body: string
  isPinned: boolean
  updatedAt?: string
}

type DismissedMap = Record<string, string>

function fingerprint(a: BannerAnnouncement) {
  return a.updatedAt ?? `${a.title}:${a.body}`
}

function loadDismissed(): DismissedMap {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return Object.fromEntries(
        parsed.filter((id) => typeof id === 'string').map((id) => [id, 'legacy'])
      )
    }
    if (parsed && typeof parsed === 'object') return parsed as DismissedMap
    return {}
  } catch {
    return {}
  }
}

function saveDismissed(items: DismissedMap) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

interface Props {
  announcements: BannerAnnouncement[]
}

export function AnnouncementBanner({ announcements }: Props) {
  const [dismissed, setDismissed] = useState<DismissedMap>({})
  const trackRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  const visible = announcements.filter((a) => a.isPinned && dismissed[a.id] !== fingerprint(a))
  const text = visible.map((a) => `📌 ${a.title} — ${a.body}`).join('   ·   ')

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
  }, [text])

  function dismiss() {
    const next = { ...dismissed }
    visible.forEach((a) => {
      next[a.id] = fingerprint(a)
    })
    saveDismissed(next)
    setDismissed(next)
  }

  if (visible.length === 0) return null

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
