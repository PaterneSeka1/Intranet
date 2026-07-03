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

    const sidebarActive = localStorage.getItem('vdm_sidebar_active')
    if (sidebarActive) document.documentElement.style.setProperty('--vdm-sidebar-active', sidebarActive)
    const sidebarHover = localStorage.getItem('vdm_sidebar_hover')
    if (sidebarHover) document.documentElement.style.setProperty('--vdm-sidebar-hover', sidebarHover)
    const sidebarText = localStorage.getItem('vdm_sidebar_text')
    if (sidebarText) document.documentElement.style.setProperty('--vdm-sidebar-text', sidebarText)

    const bgImage = localStorage.getItem('vdm_bg_image')
    if (bgImage) {
      document.documentElement.style.setProperty('--vdm-bg-image', `url("${bgImage}")`)
      const opacity = localStorage.getItem('vdm_bg_image_opacity') ?? '0.5'
      document.documentElement.style.setProperty('--vdm-bg-image-opacity', opacity)
    }
  }, [])
  return null
}
