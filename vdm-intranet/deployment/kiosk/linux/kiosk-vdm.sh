#!/bin/bash
# VdM Intranet — Lancement en mode kiosque (Linux)
#
# Exécuté à chaque ouverture de session par l'entrée de démarrage automatique
# XDG (~/.config/autostart/vdm-intranet-kiosk.desktop), installée par
# installer-demarrage.sh. Lance le navigateur retenu à l'installation (lu dans
# kiosk.conf) en mode kiosque natif sur l'URL — même logique que
# kiosk-vdm.sh côté macOS.

INSTALL_DIR="/opt/vdm-intranet"
CONF_FILE="$INSTALL_DIR/kiosk.conf"

# Journal : l'autostart XDG ne conserve pas la sortie du script, sans ce
# fichier un échec au démarrage serait totalement invisible.
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/vdm-intranet"
mkdir -p "$LOG_DIR" 2>/dev/null && exec >> "$LOG_DIR/kiosk.log" 2>&1
echo "── $(date '+%Y-%m-%d %H:%M:%S') : démarrage du kiosque"

# shellcheck source=kiosk.conf
[ -f "$CONF_FILE" ] && source "$CONF_FILE"
VDM_URL="${VDM_URL:-https://intranet.veilleurdesmedias.org}"

# Navigateur retenu à l'installation (celui qui a reçu la politique de
# verrouillage). On ne re-détecte qu'en repli s'il a disparu : sinon,
# installer un autre navigateur plus « prioritaire » après coup le ferait
# lancer à la place — sans aucune politique appliquée.
if [ -z "$BROWSER_BIN" ] || [ ! -x "$BROWSER_BIN" ]; then
  echo "Navigateur installé introuvable ($BROWSER_BIN), nouvelle détection..."
  # shellcheck source=vdm-browser-detect.sh
  source "$INSTALL_DIR/vdm-browser-detect.sh"
  find_vdm_browser
fi

if [ -z "$BROWSER_FAMILY" ] || [ -z "$BROWSER_BIN" ]; then
  echo "Aucun navigateur pris en charge trouvé (Chrome, Edge, Brave, Chromium, Firefox)." >&2
  exit 1
fi
echo "Navigateur : $BROWSER_NAME ($BROWSER_BIN) — URL : $VDM_URL"

# ── Attendre que le réseau/serveur soit prêt (max 40s) ─────────────
# curl n'est pas installé par défaut sur toutes les distributions (Ubuntu
# Desktop notamment) : repli sur wget, sinon simple attente fixe.
for i in $(seq 1 20); do
  if command -v curl >/dev/null 2>&1; then
    curl -s --max-time 2 -o /dev/null "$VDM_URL" && break
  elif command -v wget >/dev/null 2>&1; then
    wget -q --timeout=2 --tries=1 -O /dev/null "$VDM_URL" && break
  else
    sleep 8
    break
  fi
  sleep 2
done

case "$BROWSER_FAMILY" in
  chromium)
    # Après une coupure de courant/extinction brutale, les navigateurs
    # Chromium affichent « Restaurer les pages ? » par-dessus le kiosque :
    # --disable-session-crashed-bubble n'a plus d'effet sur les versions
    # récentes, on marque donc la dernière session comme fermée proprement.
    PREFS="$BROWSER_PROFILE_DIR/Default/Preferences"
    if [ -f "$PREFS" ]; then
      sed -i -e 's/"exited_cleanly":false/"exited_cleanly":true/' \
             -e 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS" 2>/dev/null || true
    fi

    # --password-store=basic : sans lui, sur une session ouverte
    # automatiquement (sans saisie de mot de passe), GNOME/KDE affichent
    # une fenêtre « Déverrouiller le trousseau » qui bloque le kiosque.
    exec "$BROWSER_BIN" \
      --kiosk \
      --noerrdialogs \
      --disable-infobars \
      --disable-session-crashed-bubble \
      --disable-translate \
      --no-first-run \
      --no-default-browser-check \
      --password-store=basic \
      --disable-features=TranslateUI \
      --disable-pinch \
      --overscroll-history-navigation=0 \
      "$VDM_URL"
    ;;

  firefox)
    exec "$BROWSER_BIN" -kiosk "$VDM_URL"
    ;;
esac
