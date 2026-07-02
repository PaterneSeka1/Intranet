#!/bin/bash
# VDM Intranet — Lancement au démarrage (macOS)

VDM_URL="${VDM_URL:-http://localhost:3000}"
APP_NAME="VDM Intranet"

# ── Attendre que le serveur réponde (max 40s) ─────────────────────
for i in $(seq 1 20); do
  if curl -s --max-time 2 "$VDM_URL" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

# ── Chercher Chrome ───────────────────────────────────────────────
if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  CHROME_PROCESS="Google Chrome"
elif [ -f "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
  CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
  CHROME_PROCESS="Chromium"
else
  echo "Chrome introuvable." >&2
  exit 1
fi

# ── Chercher la PWA installée ─────────────────────────────────────
# Chrome installe les PWA dans ~/Applications/Chrome Apps/
PWA_APP="$HOME/Applications/Chrome Apps/${APP_NAME}.app"

if [ -d "$PWA_APP" ]; then
  # PWA installée → ouvrir directement comme app native
  open "$PWA_APP"
else
  # PWA pas encore installée → ouvrir Chrome pour déclencher
  # l'installation automatique via la politique WebAppInstallForceList
  # puis relancer ce script dans 10s pour retrouver la PWA
  pkill -x "$CHROME_PROCESS" 2>/dev/null || true
  sleep 1

  # Lancer Chrome, la politique va installer la PWA automatiquement
  "$CHROME" \
    --no-first-run \
    --disable-session-crashed-bubble \
    "$VDM_URL" &

  # Attendre l'installation (max 30s) puis basculer vers la PWA
  for i in $(seq 1 15); do
    sleep 2
    if [ -d "$PWA_APP" ]; then
      pkill -x "$CHROME_PROCESS" 2>/dev/null || true
      sleep 1
      open "$PWA_APP"
      exit 0
    fi
  done

  # Si la PWA n'est toujours pas trouvée, rester sur Chrome en mode app
  pkill -x "$CHROME_PROCESS" 2>/dev/null || true
  sleep 1
  exec "$CHROME" \
    --app="$VDM_URL" \
    --start-fullscreen \
    --no-first-run \
    --disable-session-crashed-bubble
fi
