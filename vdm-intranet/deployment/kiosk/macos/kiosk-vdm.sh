#!/bin/bash
# VDM Intranet — Lancement en mode kiosque (macOS)
# Remplacez VDM_URL par votre URL de déploiement (ex: http://192.168.1.10:3000)

VDM_URL="${VDM_URL:-http://localhost:3000}"

# Attendre que le réseau soit disponible (max 30s)
for i in $(seq 1 15); do
  if curl -s --max-time 2 "$VDM_URL" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Chercher Chrome ou Chromium
if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [ -f "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
  CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
else
  echo "Chrome ou Chromium introuvable." >&2
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
  --window-position=0,0 \
  "$VDM_URL"
