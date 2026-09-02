'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Événement natif du navigateur — déclenché avant l'affichage du prompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'vdm_pwa_dismissed'

export function PwaInstallGate() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Déjà installée en mode standalone → rien à faire
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // L'utilisateur a déjà refusé → rien à faire
    if (sessionStorage.getItem(STORAGE_KEY)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!prompt) return
    setInstalling(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
      } else {
        sessionStorage.setItem(STORAGE_KEY, '1')
        setVisible(false)
      }
    } finally {
      setInstalling(false)
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!mounted || !visible) return null

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pwa-gate">
        <div className="pwa-backdrop" onClick={handleDismiss} />
        <div className="pwa-card">
          <div className="pwa-icon">
            <img src="/icon-192.png" alt="Veilleur des Médias" />
          </div>

          <h2 className="pwa-title">Installer VDM Intranet</h2>
          <p className="pwa-desc">
            Accédez au portail directement depuis votre bureau — sans navigateur, comme une
            application native.
          </p>

          <ul className="pwa-benefits">
            <li>
              <span className="benefit-dot" style={{ background: '#3DBF7E' }} />
              Ouverture instantanée, sans barre d'adresse
            </li>
            <li>
              <span className="benefit-dot" style={{ background: '#F28C38' }} />
              Icône dans le Dock / bureau
            </li>
            <li>
              <span className="benefit-dot" style={{ background: '#9B7BE8' }} />
              Expérience plein écran dédiée
            </li>
          </ul>

          <button className="pwa-btn-install" onClick={handleInstall} disabled={installing}>
            {installing ? 'Installation…' : "Installer l'application"}
          </button>

          <button className="pwa-btn-skip" onClick={handleDismiss}>
            Continuer dans le navigateur
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

const CSS = `
.pwa-gate {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  animation: pwa-in .25s ease both;
}
@keyframes pwa-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.pwa-backdrop {
  position: absolute; inset: 0;
  background: rgba(6,10,15,.75);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.pwa-card {
  position: relative; z-index: 1;
  background: #fff;
  border-radius: 20px;
  padding: 36px 32px 28px;
  width: 100%; max-width: 360px;
  margin: 16px;
  box-shadow: 0 32px 80px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.06);
  display: flex; flex-direction: column; align-items: center; gap: 0;
  animation: pwa-card-in .35s cubic-bezier(0.22,1,0.36,1) .05s both;
}
@keyframes pwa-card-in {
  from { opacity: 0; transform: translateY(24px) scale(.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.pwa-icon {
  width: 72px; height: 72px;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(242,140,56,.35), 0 2px 6px rgba(0,0,0,.12);
  margin-bottom: 20px;
  flex-shrink: 0;
}
.pwa-icon img { width: 100%; height: 100%; display: block; object-fit: cover; }

.pwa-title {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 18px; font-weight: 700;
  color: #111; letter-spacing: -.3px;
  margin-bottom: 10px; text-align: center;
}

.pwa-desc {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 14px; line-height: 1.55;
  color: #666; text-align: center;
  margin-bottom: 20px;
  max-width: 280px;
}

.pwa-benefits {
  list-style: none;
  width: 100%;
  display: flex; flex-direction: column; gap: 10px;
  margin-bottom: 24px;
  padding: 0 4px;
}
.pwa-benefits li {
  display: flex; align-items: center; gap: 10px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px; color: #444;
}
.benefit-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}

.pwa-btn-install {
  width: 100%;
  background: #F28C38; color: #fff;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 15px; font-weight: 700;
  padding: 14px;
  border-radius: 12px; border: none; cursor: pointer;
  transition: background .15s, transform .1s;
  margin-bottom: 10px;
  letter-spacing: -.1px;
}
.pwa-btn-install:hover:not(:disabled) { background: #e07d29; transform: translateY(-1px); }
.pwa-btn-install:disabled { opacity: .6; cursor: not-allowed; }

.pwa-btn-skip {
  background: none; border: none;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px; color: #999;
  cursor: pointer; padding: 6px;
  transition: color .15s;
}
.pwa-btn-skip:hover { color: #555; }
`
