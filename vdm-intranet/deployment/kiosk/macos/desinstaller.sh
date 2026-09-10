#!/bin/bash
# VDM Intranet — Désinstallation complète du kiosque (macOS)
#
# Retire tout ce que installer-demarrage.sh a mis en place : le LaunchAgent,
# les scripts de lancement et la politique du navigateur détecté à
# l'installation (lue dans kiosk-install-state.txt). Ne désinstalle pas le
# navigateur lui-même.

set -e

SUPPORT_DIR="$HOME/Library/Application Support/VDM Intranet"
INSTALL_STATE="$SUPPORT_DIR/kiosk-install-state.txt"

echo "→ Suppression du LaunchAgent..."
launchctl unload "$HOME/Library/LaunchAgents/com.vdm.intranet.plist" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.vdm.intranet.plist"

echo "→ Suppression des scripts de lancement..."
sudo rm -f /usr/local/bin/kiosk-vdm.sh /usr/local/bin/vdm-browser-detect.sh

echo "→ Suppression de la politique du navigateur..."
if [ -f "$INSTALL_STATE" ]; then
  # shellcheck disable=SC1090
  source "$INSTALL_STATE" 2>/dev/null || true

  case "$BROWSER_FAMILY" in
    chromium)
      CHROME_POLICY_DIR="/Library/Managed Preferences/$(whoami)"
      sudo rm -f "$CHROME_POLICY_DIR/$BROWSER_DOMAIN.plist"
      sudo rmdir "$CHROME_POLICY_DIR" 2>/dev/null || true
      defaults delete "$BROWSER_DOMAIN" NSUserKeyEquivalents 2>/dev/null || true
      ;;
    firefox)
      if [ -n "$BROWSER_APP" ]; then
        sudo rm -f "$BROWSER_APP/Contents/Resources/distribution/policies.json"
        sudo rmdir "$BROWSER_APP/Contents/Resources/distribution" 2>/dev/null || true
      fi
      ;;
    safari|*)
      : # aucune politique posée pour Safari, rien à retirer
      ;;
  esac
  rm -f "$INSTALL_STATE"
else
  # Poste installé avec une version antérieure à la prise en charge
  # multi-navigateurs (pas de fichier d'état) : on suppose l'ancien
  # comportement Chrome-only et on nettoie les deux emplacements possibles
  # (avec et sans sous-dossier par utilisateur).
  echo "  (aucun fichier d'état trouvé — nettoyage Chrome par défaut)"
  sudo rm -f "/Library/Managed Preferences/com.google.Chrome.plist"
  sudo rm -f "/Library/Managed Preferences/$(whoami)/com.google.Chrome.plist"
  sudo rmdir "/Library/Managed Preferences/$(whoami)" 2>/dev/null || true
  defaults delete com.google.Chrome NSUserKeyEquivalents 2>/dev/null || true
fi

echo ""
echo "✓ Désinstallation terminée. Redémarrez le navigateur."