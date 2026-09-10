#!/bin/bash
# VDM Intranet — Lancement en mode kiosque (macOS)
#
# Chrome en vrai mode kiosque (--kiosk, plein écran verrouillé, sans barre
# d'adresse) directement sur l'URL — ne dépend plus d'une PWA installée au
# préalable. L'ancienne version cherchait une PWA installée via
# WebAppInstallForceList (politique Chrome) et ouvrait Chrome en --app en
# attendant : fragile (l'installation forcée de PWA dépend d'une politique
# "Managed Preferences" pas toujours honorée hors MDM — voir README), et
# --app --start-fullscreen n'est de toute façon pas un vrai mode kiosque
# (raccourcis clavier, menu Chrome toujours accessibles). Même refonte que
# vdm-kiosk.bat / installer-demarrage.ps1 côté Windows.

VDM_URL="${VDM_URL:-http://localhost:3000}"

# ── Attendre que le réseau/serveur soit prêt (max 40s) ─────────────
for i in $(seq 1 20); do
  if curl -s --max-time 2 "$VDM_URL" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

# ── Chercher Chrome ───────────────────────────────────────────────
if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [ -f "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
  CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
else
  echo "Chrome introuvable. Installez Google Chrome." >&2
  exit 1
fi

exec "$CHROME" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  "$VDM_URL"
