#!/bin/bash
# VDM Intranet — Désinstallation complète du kiosque (macOS)
#
# Retire tout ce que installer-demarrage.sh a mis en place : le LaunchAgent,
# le script de lancement et la politique Chrome. Ne désinstalle pas Chrome
# lui-même.

set -e

echo "→ Suppression du LaunchAgent..."
launchctl unload "$HOME/Library/LaunchAgents/com.vdm.intranet.plist" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.vdm.intranet.plist"

echo "→ Suppression du script de lancement..."
sudo rm -f /usr/local/bin/kiosk-vdm.sh

echo "→ Suppression de la politique Chrome..."
# Même sous-dossier par utilisateur qu'à l'installation (voir README) —
# pas directement sous Managed Preferences/.
CHROME_POLICY_DIR="/Library/Managed Preferences/$(whoami)"
sudo rm -f "$CHROME_POLICY_DIR/com.google.Chrome.plist"
# Retirer le sous-dossier s'il est devenu vide (n'était utilisé que par VDM Intranet)
sudo rmdir "$CHROME_POLICY_DIR" 2>/dev/null || true

echo "→ Restauration des raccourcis Chrome..."
defaults delete com.google.Chrome NSUserKeyEquivalents 2>/dev/null || true

echo ""
echo "✓ Désinstallation terminée. Redémarrez Chrome."
