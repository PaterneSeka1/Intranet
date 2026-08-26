'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { User, LayoutGrid, Megaphone, type LucideIcon } from 'lucide-react'
import { searchApi, type SearchResult } from '@/lib/search'

const ICONS: Record<SearchResult['type'], LucideIcon> = {
  user: User,
  tab: LayoutGrid,
  announcement: Megaphone,
}

const DEBOUNCE_MS = 300

export function GlobalSearch({ dark = false }: { dark?: boolean }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchApi
        .query(q, controller.signal)
        .then((data) => {
          setResults(data)
          setLoading(false)
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher…"
        className={`w-full text-sm rounded-xl px-3 py-2 focus:outline-none transition-colors ${
          dark
            ? 'bg-white/10 text-white placeholder-white/40 focus:bg-white/15'
            : 'bg-gray-100 text-gray-700 placeholder-gray-400 focus:bg-gray-50 border border-transparent focus:border-[#F28C38]'
        }`}
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl z-[9500] overflow-hidden max-h-80 overflow-y-auto">
          {loading && <p className="text-sm text-gray-400 text-center py-4">Recherche…</p>}
          {!loading && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Aucun résultat.</p>
          )}
          {!loading &&
            results.map((r) => {
              const Icon = ICONS[r.type]
              const content = (
                <div className="px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-start gap-2.5">
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.label}</div>
                    {r.sublabel && (
                      <div className="text-xs text-gray-400 truncate">{r.sublabel}</div>
                    )}
                  </div>
                </div>
              )
              return r.external ? (
                <a
                  key={`${r.type}-${r.id}`}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  {content}
                </a>
              ) : (
                <Link key={`${r.type}-${r.id}`} href={r.href} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              )
            })}
        </div>
      )}
    </div>
  )
}
