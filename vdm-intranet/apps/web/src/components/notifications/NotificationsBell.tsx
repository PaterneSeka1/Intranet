'use client'

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { API_BASE } from '@/lib/api-base'
import { notificationsApi, type NotificationItem } from '@/lib/notifications'

const REFRESH_INTERVAL_MS = 60_000

function socketUrl() {
  return `${API_BASE.replace(/\/$/, '')}/notifications`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotificationsBell({ dark = false }: { dark?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  async function refreshCount() {
    try {
      const { count } = await notificationsApi.unreadCount()
      setUnreadCount(count)
    } catch {
      /* garde le compteur courant si le refresh échoue */
    }
  }

  useEffect(() => {
    refreshCount()

    const socket = io(socketUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
    const intervalId = window.setInterval(refreshCount, REFRESH_INTERVAL_MS)

    socket.on('connect', refreshCount)
    socket.on('notification:new', refreshCount)

    return () => {
      window.clearInterval(intervalId)
      socket.off('connect', refreshCount)
      socket.off('notification:new', refreshCount)
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!open) return

    notificationsApi
      .list(1, 20)
      .then((page) => setItems(page.notifications))
      .catch(() => setItems([]))

    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
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
  }, [open])

  async function handleItemClick(item: NotificationItem) {
    if (!item.isRead) {
      try {
        await notificationsApi.markRead(item.id)
        setItems((prev) =>
          prev ? prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)) : prev
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        /* noop */
      }
    }
    if (item.link) window.location.href = item.link
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead()
      setItems((prev) => (prev ? prev.map((i) => ({ ...i, isRead: true })) : prev))
      setUnreadCount(0)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
          dark
            ? 'vdm-sb-link vdm-sb-text-dim'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F28C38] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-100 shadow-2xl z-[9500] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-sm text-gray-900">Notifications</span>
            {items && items.some((i) => !i.isRead) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#F28C38] hover:underline font-medium"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items === null && (
              <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>
            )}
            {items?.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Aucune notification.</p>
            )}
            {items?.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  item.isRead ? '' : 'bg-[#F28C38]/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  {!item.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F28C38] shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.body}</p>
                <p className="text-[10px] text-gray-400 mt-1">{fmtDate(item.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
