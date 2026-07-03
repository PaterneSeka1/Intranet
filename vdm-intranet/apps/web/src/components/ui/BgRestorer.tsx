'use client'

import { useEffect } from 'react'

export function BgRestorer() {
  useEffect(() => {
    const appBg = localStorage.getItem('vdm_app_bg')
    if (appBg) document.documentElement.style.setProperty('--vdm-app-bg', appBg)
  }, [])
  return null
}
