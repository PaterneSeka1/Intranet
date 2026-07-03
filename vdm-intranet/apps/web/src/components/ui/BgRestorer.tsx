'use client'

import { useEffect } from 'react'

export function BgRestorer() {
  useEffect(() => {
    const appBg = localStorage.getItem('vdm_app_bg')
    if (appBg) document.documentElement.style.setProperty('--vdm-app-bg', appBg)
    const loginBg = localStorage.getItem('vdm_login_bg')
    if (loginBg && !loginBg.startsWith('url(')) {
      document.documentElement.style.setProperty('--vdm-sidebar-bg', loginBg)
    }
    const sidebarHover = localStorage.getItem('vdm_sidebar_hover')
    if (sidebarHover) document.documentElement.style.setProperty('--vdm-sidebar-hover', sidebarHover)
  }, [])
  return null
}
