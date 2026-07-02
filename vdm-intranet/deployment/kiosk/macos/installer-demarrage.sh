#!/bin/bash
# VDM Intranet — Installation du démarrage automatique (macOS)
# Usage: bash installer-demarrage.sh [URL]
# Exemple: bash installer-demarrage.sh http://192.168.1.10:3000

set -e

VDM_URL="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIOSK_SCRIPT="/usr/local/bin/kiosk-vdm.sh"
PLIST_SRC="$SCRIPT_DIR/com.vdm.intranet.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.vdm.intranet.plist"

echo "→ Installation du démarrage automatique VDM Intranet"
echo "  URL : $VDM_URL"
echo ""

# Copier le script de lancement
echo "→ Installation du script de lancement..."
sudo cp "$SCRIPT_DIR/kiosk-vdm.sh" "$KIOSK_SCRIPT"
sudo chmod +x "$KIOSK_SCRIPT"

# Injecter l'URL dans le plist
echo "→ Configuration du LaunchAgent..."
sed "s|http://localhost:3000|$VDM_URL|g" "$PLIST_SRC" > "$PLIST_DEST"

# Charger le LaunchAgent (actif dès maintenant et aux prochaines sessions)
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo ""
echo "✓ Installation terminée."
echo "✓ L'application s'ouvrira automatiquement à la prochaine session."
echo ""
echo "Pour désinstaller :"
echo "  launchctl unload ~/Library/LaunchAgents/com.vdm.intranet.plist"
echo "  rm ~/Library/LaunchAgents/com.vdm.intranet.plist"
echo "  sudo rm /usr/local/bin/kiosk-vdm.sh"
