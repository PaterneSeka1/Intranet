'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Download } from 'lucide-react'

type OS = 'macos' | 'windows' | 'other'
type Phase = 'idle' | 'ask' | 'downloading' | 'done'

const STORAGE_KEY = 'vdm_autostart_done'
const DEFAULT_APP_NAME = 'VDM Intranet'

// Support limité (Chrome/Edge desktop) — absent sur Firefox/Safari.
interface NavigatorWithRelatedApps extends Navigator {
  getInstalledRelatedApps?: () => Promise<unknown[]>
}

function detectOS(): OS {
  const ua = navigator.userAgent
  if (/Mac/i.test(ua) && !/iPhone|iPad/.test(ua)) return 'macos'
  if (/Win/i.test(ua)) return 'windows'
  return 'other'
}

/**
 * Vérifie si l'application est toujours installée (via le manifeste
 * auto-référencé dans manifest.ts). Retourne `null` si le navigateur ne
 * supporte pas l'API — dans ce cas on ne peut pas savoir, donc on ne
 * touche à rien plutôt que de se tromper.
 */
async function isAppStillInstalled(): Promise<boolean | null> {
  const nav = navigator as NavigatorWithRelatedApps
  if (!nav.getInstalledRelatedApps) return null
  try {
    const related = await nav.getInstalledRelatedApps()
    return related.length > 0
  } catch {
    return null
  }
}

/**
 * Récupère le nom d'affichage courant de l'application (personnalisable via
 * les paramètres) — c'est le nom que Chrome utilise pour le raccourci créé
 * à l'installation (Menu Démarrer sous Windows, dossier Chrome Apps sous
 * macOS), indispensable pour vérifier plus tard si l'app est toujours là.
 */
async function fetchAppName(): Promise<string> {
  try {
    const res = await fetch('/manifest.webmanifest')
    const manifest = await res.json()
    if (typeof manifest?.name === 'string' && manifest.name.trim()) return manifest.name.trim()
  } catch {
    // Repli silencieux ci-dessous
  }
  return document.title || DEFAULT_APP_NAME
}

/* ── Génère le script macOS (.command) ──────────────────────────── */
function macosScript(appUrl: string, appName: string): string {
  const safeName = appName.replace(/[/:]/g, '-')
  const lines = [
    '#!/bin/bash',
    `APP_URL='${appUrl}'`,
    'SUPPORT_DIR="$HOME/Library/Application Support/VDM Intranet"',
    'LAUNCHER="$SUPPORT_DIR/vdm-launch.sh"',
    'PLIST="$HOME/Library/LaunchAgents/com.vdm.intranet.plist"',
    '',
    'echo "Configuration du démarrage automatique VDM Intranet..."',
    'mkdir -p "$SUPPORT_DIR"',
    '',
    "# Script de lancement exécuté à chaque connexion : vérifie d'abord que",
    "# l'application est toujours installée avant de l'ouvrir. Si elle a été",
    '# désinstallée, il retire lui-même le démarrage automatique.',
    "cat > \"$LAUNCHER\" <<'LAUNCHER_CONTENT'",
    '#!/bin/bash',
    `APP_PATH="$HOME/Applications/Chrome Apps/${safeName}.app"`,
    'PLIST_PATH="$HOME/Library/LaunchAgents/com.vdm.intranet.plist"',
    '',
    'if [ ! -d "$APP_PATH" ]; then',
    '  launchctl unload "$PLIST_PATH" 2>/dev/null || true',
    '  rm -f "$PLIST_PATH"',
    '  exit 0',
    'fi',
    '',
    'sleep 8',
    'open "$APP_PATH"',
    'LAUNCHER_CONTENT',
    'chmod +x "$LAUNCHER"',
    '',
    '# Écrire le LaunchAgent (exécute le script de lancement à chaque connexion)',
    'cat > "$PLIST" <<PLIST_CONTENT',
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key><string>com.vdm.intranet</string>',
    '  <key>ProgramArguments</key>',
    '  <array>',
    '    <string>/bin/bash</string>',
    '    <string>$LAUNCHER</string>',
    '  </array>',
    '  <key>RunAtLoad</key><true/>',
    '</dict>',
    '</plist>',
    'PLIST_CONTENT',
    '',
    '# Charger le service',
    'launchctl unload "$PLIST" 2>/dev/null || true',
    'launchctl load "$PLIST"',
    '',
    'echo ""',
    'echo "✓ VDM Intranet s\'ouvrira automatiquement au prochain démarrage."',
    'echo ""',
    'read -p "Appuyez sur Entrée pour fermer..."',
  ]
  return lines.join('\n')
}

/* ── Génère le script Windows (.bat) ────────────────────────────── */
function windowsScript(appUrl: string, appName: string): string {
  const safeName = appName.replace(/[\\/:*?"<>|]/g, '').trim() || DEFAULT_APP_NAME
  const lines = [
    '@echo off',
    'chcp 65001 >nul',
    'title VDM Intranet — Démarrage automatique',
    'echo.',
    'echo Configuration du démarrage automatique...',
    'echo.',
    '',
    'set "VDM_URL=' + appUrl + '"',
    'set "VDM_APP_NAME=' + safeName + '"',
    'set "CHROME="',
    '',
    'if exist "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" (',
    '  set "CHROME=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
    ') else if exist "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" (',
    '  set "CHROME=C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"',
    ') else if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (',
    '  set "CHROME=%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"',
    ')',
    '',
    'if "%CHROME%"=="" (',
    '  echo Chrome introuvable. Installez Google Chrome et relancez ce fichier.',
    '  pause & exit /b 1',
    ')',
    '',
    ':: Script de lancement (exécuté à chaque démarrage) : vérifie que',
    ":: l'application est toujours installée avant de l'ouvrir. On le place",
    ':: dans le démarrage Windows plutôt que la commande Chrome directement,',
    ":: pour pouvoir s'auto-désactiver en cas de désinstallation.",
    'set "VDM_DIR=%LocalAppData%\\VDM Intranet"',
    'set "LAUNCHER=%VDM_DIR%\\vdm-launch.bat"',
    // Chrome place le raccourci de la PWA installée dans un sous-dossier de
    // Start Menu\Programs\ dont le nom dépend de la langue de Chrome
    // ("Chrome Apps" en anglais, "Applications Chrome" en français, etc.) —
    // deviner ce sous-dossier est fragile (constaté sur un poste Chrome FR :
    // le chemin anglais ne correspondait jamais, donc vdm-launch.bat
    // supprimait sa propre entrée de démarrage dès le premier redémarrage,
    // sans erreur visible). On cherche le fichier récursivement sous
    // Programs\ à l'exécution plutôt que de fiabiliser un chemin exact.
    'set "SHORTCUT_NAME=%VDM_APP_NAME%.lnk"',
    'mkdir "%VDM_DIR%" >nul 2>&1',
    '',
    'echo @echo off> "%LAUNCHER%"',
    'echo dir /s /b /a-d "%AppData%\\Microsoft\\Windows\\Start Menu\\Programs\\%SHORTCUT_NAME%" ^>nul 2^>nul>>"%LAUNCHER%"',
    'echo if errorlevel 1 goto :cleanup>>"%LAUNCHER%"',
    'echo start "" "%CHROME%" --app="%VDM_URL%" --start-fullscreen>>"%LAUNCHER%"',
    'echo exit /b 0>>"%LAUNCHER%"',
    'echo :cleanup>>"%LAUNCHER%"',
    'echo reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "VDM Intranet" /f>>"%LAUNCHER%"',
    '',
    ':: Ajouter le lanceur au démarrage Windows',
    'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" ^',
    '  /v "VDM Intranet" /t REG_SZ ^',
    '  /d "\\"%LAUNCHER%\\"" /f >nul',
    '',
    "echo ✓ VDM Intranet s'ouvrira automatiquement au prochain démarrage.",
    'echo.',
    'pause',
  ]
  return lines.join('\r\n')
}

/* ── Déclenche le téléchargement d'un fichier texte ────────────── */
function downloadScript(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: filename,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/* ── Composant principal ─────────────────────────────────────────── */
export function PwaAutoStart() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [os, setOs] = useState<OS>('other')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    let active = true
    let handler: (() => void) | null = null

    async function init() {
      // La proposition a déjà été traitée (oui ou non) lors d'une précédente
      // installation. Si l'application a depuis été désinstallée, on
      // réinitialise le drapeau pour pouvoir la proposer à nouveau au
      // moment d'une future réinstallation.
      if (localStorage.getItem(STORAGE_KEY)) {
        const stillInstalled = await isAppStillInstalled()
        if (stillInstalled === false) {
          localStorage.removeItem(STORAGE_KEY)
        }
      }

      if (!active || localStorage.getItem(STORAGE_KEY)) return

      handler = () => {
        setOs(detectOS())
        // Laisser 1.5s pour que l'animation d'installation se termine
        setTimeout(() => setPhase('ask'), 1500)
      }
      window.addEventListener('appinstalled', handler)
    }

    init()

    return () => {
      active = false
      if (handler) window.removeEventListener('appinstalled', handler)
    }
  }, [])

  async function handleYes() {
    const appUrl = window.location.origin
    setPhase('downloading')

    const appName = await fetchAppName()

    if (os === 'macos') {
      downloadScript(macosScript(appUrl, appName), 'vdm-demarrage-auto.command')
    } else if (os === 'windows') {
      downloadScript(windowsScript(appUrl, appName), 'vdm-demarrage-auto.bat')
    }

    localStorage.setItem(STORAGE_KEY, '1')
    setTimeout(() => setPhase('done'), 400)
  }

  function handleNo() {
    localStorage.setItem(STORAGE_KEY, '1')
    setPhase('idle')
  }

  if (!mounted || phase === 'idle') return null

  const instructionFile = os === 'macos' ? 'vdm-demarrage-auto.command' : 'vdm-demarrage-auto.bat'

  const instructionNote =
    os === 'macos'
      ? "Si macOS bloque l'ouverture : clic droit → Ouvrir → Ouvrir"
      : 'Si Windows affiche « Contrôle intelligent des applications a bloqué un fichier potentiellement dangereux » : clic droit sur le fichier → Propriétés → cocher Débloquer → OK, puis redouble-cliquez dessus.'

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="as-overlay">
        <div className="as-backdrop" />
        <div className="as-card">
          {/* ── Demande initiale ── */}
          {phase === 'ask' && (
            <>
              <div className="as-check">
                <CheckCircle2 size={28} strokeWidth={1.75} />
              </div>
              <h2 className="as-title">Application installée !</h2>
              <p className="as-desc">
                Voulez-vous que <strong>VDM Intranet</strong> s&rsquo;ouvre automatiquement à chaque
                démarrage de l&rsquo;ordinateur ?
              </p>
              <div className="as-actions">
                <button className="as-btn-yes" onClick={handleYes}>
                  Oui, démarrage automatique
                </button>
                <button className="as-btn-no" onClick={handleNo}>
                  Non merci
                </button>
              </div>
            </>
          )}

          {/* ── Téléchargement en cours ── */}
          {phase === 'downloading' && (
            <div className="as-loading">
              <div className="as-spinner" />
              <p>Préparation du script…</p>
            </div>
          )}

          {/* ── Instructions finales ── */}
          {phase === 'done' && (
            <>
              <div className="as-check">
                <Download size={28} strokeWidth={1.75} />
              </div>
              <h2 className="as-title">Une dernière étape</h2>
              <p className="as-desc">
                Le fichier <code className="as-code">{instructionFile}</code> a été téléchargé.
                Double-cliquez dessus pour activer le démarrage automatique.
              </p>
              {(os === 'macos' || os === 'windows') && (
                <div className="as-note">{instructionNote}</div>
              )}
              <button className="as-btn-yes" onClick={() => setPhase('idle')}>
                Compris
              </button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}

const CSS = `
.as-overlay {
  position: fixed; inset: 0; z-index: 9998;
  display: flex; align-items: center; justify-content: center;
  animation: as-in .2s ease both;
}
@keyframes as-in { from { opacity:0 } to { opacity:1 } }

.as-backdrop {
  position: absolute; inset: 0;
  background: rgba(6,10,15,.7);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.as-card {
  position: relative; z-index: 1;
  background: #fff; border-radius: 20px;
  padding: 36px 28px 28px;
  width: 100%; max-width: 340px; margin: 16px;
  box-shadow: 0 32px 80px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.06);
  display: flex; flex-direction: column; align-items: center; gap: 0;
  text-align: center;
  animation: as-card-in .3s cubic-bezier(.22,1,.36,1) .05s both;
}
@keyframes as-card-in {
  from { opacity:0; transform:translateY(20px) scale(.97) }
  to   { opacity:1; transform:translateY(0) scale(1) }
}

.as-check {
  width: 56px; height: 56px;
  background: #F28C38; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 800; color: #fff;
  box-shadow: 0 8px 24px rgba(242,140,56,.35);
  margin-bottom: 20px;
}

.as-title {
  font-family: system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size: 17px; font-weight: 700; color: #111;
  letter-spacing: -.2px; margin-bottom: 10px;
}

.as-desc {
  font-family: system-ui,-apple-system,sans-serif;
  font-size: 14px; line-height: 1.55; color: #555;
  margin-bottom: 24px; max-width: 270px;
}

.as-actions {
  width: 100%; display: flex; flex-direction: column; gap: 8px;
}

.as-btn-yes {
  width: 100%; background: #F28C38; color: #fff;
  font-family: system-ui,-apple-system,sans-serif;
  font-size: 14px; font-weight: 700;
  padding: 13px; border-radius: 11px; border: none;
  cursor: pointer; transition: background .15s, transform .1s;
  letter-spacing: -.1px;
}
.as-btn-yes:hover { background: #e07d29; transform: translateY(-1px); }

.as-btn-no {
  background: none; border: none;
  font-family: system-ui,-apple-system,sans-serif;
  font-size: 13px; color: #999; cursor: pointer;
  padding: 6px; transition: color .15s;
}
.as-btn-no:hover { color: #555; }

.as-code {
  font-family: 'SF Mono','Fira Code','Consolas',monospace;
  font-size: 12px; background: #f3f4f6;
  padding: 2px 6px; border-radius: 5px; color: #374151;
}

.as-note {
  font-family: system-ui,-apple-system,sans-serif;
  font-size: 12px; color: #888; line-height: 1.5;
  background: #f9fafb; border-radius: 8px;
  padding: 10px 12px; margin-bottom: 16px; width: 100%;
  border: 1px solid #e5e7eb; text-align: left;
}

.as-loading {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 16px 0; font-family: system-ui,-apple-system,sans-serif;
  font-size: 14px; color: #666;
}
.as-spinner {
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid #f3f3f3; border-top-color: #F28C38;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg) } }
`
