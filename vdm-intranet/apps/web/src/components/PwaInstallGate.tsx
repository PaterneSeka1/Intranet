'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Événement natif du navigateur — déclenché avant l'affichage du prompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'vdm_pwa_dismissed'
const INSTALLED_KEY = 'vdm_pwa_installed'

// Support limité (Chrome/Edge desktop) — absent sur Firefox/Safari.
interface NavigatorWithPwa extends Navigator {
  standalone?: boolean
  getInstalledRelatedApps?: () => Promise<unknown[]>
}

/**
 * Vrai si la page tourne dans une fenêtre d'application plutôt qu'un onglet.
 * `standalone` seul ne suffit pas : le démarrage automatique Windows lance
 * Chrome en `--app --start-fullscreen` (display-mode: fullscreen), et Edge /
 * Chrome peuvent exposer `window-controls-overlay` ou `minimal-ui`.
 */
function isRunningAsApp(): boolean {
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
  if (modes.some((m) => window.matchMedia(`(display-mode: ${m})`).matches)) return true
  if ((navigator as NavigatorWithPwa).standalone) return true // iOS Safari
  return document.referrer.startsWith('android-app://')
}

/**
 * Vérifie via le manifeste auto-référencé (manifest.ts) si la PWA est
 * installée. `null` si l'API n'est pas supportée : on ne peut pas savoir.
 */
async function isAppInstalled(): Promise<boolean | null> {
  const nav = navigator as NavigatorWithPwa
  if (!nav.getInstalledRelatedApps) return null
  try {
    const related = await nav.getInstalledRelatedApps()
    return related.length > 0
  } catch {
    return null
  }
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: Storage, key: string, value: string | null) {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
  } catch {
    // Stockage indisponible (navigation privée) — sans conséquence
  }
}

export function PwaInstallGate() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Dans la fenêtre de l'app → mémoriser l'installation et ne rien afficher
    if (isRunningAsApp()) {
      writeStorage(localStorage, INSTALLED_KEY, '1')
      return
    }

    // L'utilisateur a déjà refusé → rien à faire
    if (readStorage(sessionStorage, STORAGE_KEY)) return

    let active = true
    let pendingEvent: BeforeInstallPromptEvent | null = null
    // Tant que la vérification d'installation n'est pas terminée, on met
    // l'événement de côté au lieu d'afficher le modal.
    let checked = false
    let installed = false

    function show() {
      if (!active || !pendingEvent || installed || isRunningAsApp()) return
      setPrompt(pendingEvent)
      setVisible(true)
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      pendingEvent = e as BeforeInstallPromptEvent
      if (checked) show()
    }

    const onInstalled = () => {
      installed = true
      writeStorage(localStorage, INSTALLED_KEY, '1')
      setVisible(false)
      setPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    isAppInstalled().then((result) => {
      if (!active) return
      if (result === true) {
        writeStorage(localStorage, INSTALLED_KEY, '1')
        installed = true
      } else if (result === false) {
        // Désinstallée depuis → on pourra reproposer l'installation
        writeStorage(localStorage, INSTALLED_KEY, null)
      } else {
        // API indisponible : on se fie au drapeau mémorisé
        installed = readStorage(localStorage, INSTALLED_KEY) === '1'
      }
      checked = true
      show()
    })

    return () => {
      active = false
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!prompt) return
    setInstalling(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') {
        writeStorage(localStorage, INSTALLED_KEY, '1')
        setVisible(false)
      } else {
        writeStorage(sessionStorage, STORAGE_KEY, '1')
        setVisible(false)
      }
    } finally {
      setInstalling(false)
    }
  }

  function handleDismiss() {
    writeStorage(sessionStorage, STORAGE_KEY, '1')
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
            <img src="/logo_entreprise.png" alt="Veilleur des Médias" />
          </div>

          <h2 className="pwa-title">Installer VdM Intranet</h2>
          <p className="pwa-desc">
            Accédez à VdM Intranet directement depuis votre bureau — sans navigateur, comme une
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
.pwa-icon img { width: 100%; height: 100%; display: block; object-fit: contain; background: #fff; }

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
