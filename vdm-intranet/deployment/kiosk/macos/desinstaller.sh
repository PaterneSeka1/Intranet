#!/bin/bash
# VDM Intranet — Désinstallation complète du kiosque

set -e

echo "→ Suppression du LaunchAgent..."
launchctl unload "$HOME/Library/LaunchAgents/com.vdm.intranet.plist" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.vdm.intranet.plist"

echo "→ Suppression du script de lancement..."
sudo rm -f /usr/local/bin/kiosk-vdm.sh

echo "→ Suppression de la politique Chrome..."
sudo rm -f "/Library/Managed Preferences/com.google.Chrome.plist"

echo "→ Restauration des raccourcis Chrome..."
defaults delete com.google.Chrome NSUserKeyEquivalents 2>/dev/null || true

echo ""
echo "✓ Désinstallation terminée. Redémarrez Chrome."
