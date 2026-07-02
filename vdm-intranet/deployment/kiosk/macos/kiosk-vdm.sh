#!/bin/bash
# VDM Intranet — Lancement en mode kiosque (macOS)

VDM_URL="${VDM_URL:-http://localhost:3000}"

# Chercher Chrome ou Chromium
if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  CHROME_PROCESS="Google Chrome"
elif [ -f "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
  CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
  CHROME_PROCESS="Chromium"
else
  echo "Chrome ou Chromium introuvable." >&2
  exit 1
fi

# Fermer Chrome s'il est déjà ouvert — OBLIGATOIRE pour que --kiosk s'applique
if pgrep -x "$CHROME_PROCESS" > /dev/null 2>&1; then
  pkill -x "$CHROME_PROCESS" 2>/dev/null || true
  sleep 1
fi

# Attendre que le serveur réponde (max 30s)
for i in $(seq 1 15); do
  if curl -s --max-time 2 "$VDM_URL" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

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
  --window-position=0,0 \
  "$VDM_URL"
