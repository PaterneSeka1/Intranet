'use client'

import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { AnnouncementBanner } from '@/components/announcements/AnnouncementBanner'
import { Widgets } from '@/components/widgets/Widgets'
import { API_BASE } from '@/lib/api-base'
import { announcementsApi, type Announcement } from '@/lib/announcements'

type Props = {
  initialAnnouncements: Announcement[]
  showWidgets?: boolean
}

const REFRESH_INTERVAL_MS = 60_000
const EXPIRY_REFRESH_DELAY_MS = 1_000

function socketUrl() {
  return `${API_BASE.replace(/\/$/, '')}/announcements`
}

export function LiveAnnouncements({ initialAnnouncements, showWidgets = false }: Props) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements)

  useEffect(() => {
    setAnnouncements(initialAnnouncements)
  }, [initialAnnouncements])

  useEffect(() => {
    let mounted = true
    let refreshing = false

    async function refreshAnnouncements() {
      if (refreshing) return
      refreshing = true
      try {
        const next = await announcementsApi.list(true)
        if (mounted) setAnnouncements(next)
      } catch {
        /* keep current announcements if the realtime refresh fails */
      } finally {
        refreshing = false
      }
    }

    const socket = io(socketUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
    const intervalId = window.setInterval(refreshAnnouncements, REFRESH_INTERVAL_MS)

    socket.on('connect', refreshAnnouncements)
    socket.on('announcements:changed', refreshAnnouncements)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
      socket.off('connect', refreshAnnouncements)
      socket.off('announcements:changed', refreshAnnouncements)
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    const now = Date.now()
    let cancelled = false
    const nextExpiry = announcements.reduce<number | null>((earliest, announcement) => {
      if (!announcement.expiresAt) return earliest
      const expiresAt = new Date(announcement.expiresAt).getTime()
      if (Number.isNaN(expiresAt) || expiresAt <= now) return earliest
      return earliest === null ? expiresAt : Math.min(earliest, expiresAt)
    }, null)

    if (!nextExpiry) return

    const timeoutId = window.setTimeout(
      async () => {
        try {
          const next = await announcementsApi.list(true)
          if (!cancelled) setAnnouncements(next)
        } catch {
          /* keep current announcements if the scheduled refresh fails */
        }
      },
      Math.max(nextExpiry - now + EXPIRY_REFRESH_DELAY_MS, EXPIRY_REFRESH_DELAY_MS)
    )

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [announcements])

  return (
    <>
      <AnnouncementBanner announcements={announcements} />
      {showWidgets && <Widgets announcements={announcements} />}
    </>
  )
}
