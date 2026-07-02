'use client'

import { useEffect } from 'react'

const LS_KEY_APP = 'vdm_app_bg'

export function BgRestorer() {
  useEffect(() => {
    const bg = localStorage.getItem(LS_KEY_APP)
    if (bg) document.body.style.background = bg
  }, [])
  return null
}
