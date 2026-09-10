#!/bin/bash
# VDM Intranet — Lancement en mode kiosque (macOS)
#
# Détecte automatiquement le navigateur installé (Chrome > Edge > Brave >
# Chromium > Firefox > Safari en dernier recours — voir vdm-browser-detect.sh)
# et le lance verrouillé/plein écran sur l'URL. Pas de dépendance à une PWA
# installée au préalable (ancienne version) : chaque famille de navigateur a
# son propre mode kiosque natif, lancé directement sur l'URL. Même logique
# que vdm-kiosk.bat / installer-demarrage.ps1 côté Windows.

VDM_URL="${VDM_URL:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=vdm-browser-detect.sh
source "$SCRIPT_DIR/vdm-browser-detect.sh"

# ── Attendre que le réseau/serveur soit prêt (max 40s) ─────────────
for i in $(seq 1 20); do
  if curl -s --max-time 2 "$VDM_URL" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

find_vdm_browser

if [ -z "$BROWSER_FAMILY" ]; then
  echo "Aucun navigateur pris en charge trouvé (Chrome, Edge, Brave, Chromium, Firefox, Safari)." >&2
  exit 1
fi

case "$BROWSER_FAMILY" in
  chromium)
    exec "$BROWSER_BIN" \
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
    ;;

  firefox)
    exec "$BROWSER_BIN" -kiosk "$VDM_URL"
    ;;

  safari)
    # AUCUN verrouillage réel possible : Safari n'a pas de mode kiosque natif
    # ni de mécanisme de politique d'entreprise hors MDM sur un Mac non
    # supervisé (voir README). On se contente d'ouvrir Safari en plein écran
    # sur l'URL — barre d'adresse, nouvel onglet, historique, etc. restent
    # tous accessibles à l'utilisateur.
    #
    # Le passage en plein écran (⌘+Ctrl+F simulé via System Events) requiert
    # une autorisation Accessibilité accordée UNE FOIS manuellement au
    # processus qui exécute ce script (Réglages Système → Confidentialité et
    # sécurité → Accessibilité) — sans elle, Safari s'ouvre normalement mais
    # ne passe pas plein écran, sans erreur visible.
    open -a Safari "$VDM_URL"
    sleep 3
    osascript -e 'tell application "Safari" to activate' \
              -e 'delay 1' \
              -e 'tell application "System Events" to keystroke "f" using {command down, control down}' \
      2>/dev/null || true
    ;;
esac
