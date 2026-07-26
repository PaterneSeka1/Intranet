'use client'

import { useEffect } from 'react'
import { fetchSettings } from '@/lib/settings'
import { escapeCssString } from '@/lib/theme-settings'

export function BgRestorer() {
  useEffect(() => {
    let cancelled = false
    fetchSettings()
      .then((settings) => {
        if (cancelled) return
        const m = Object.fromEntries(settings.map((s) => [s.key, s.value]))
        if (m['vdm_bg_image']) {
          document.documentElement.style.setProperty(
            '--vdm-bg-image',
            `url("${escapeCssString(m['vdm_bg_image'])}")`
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
