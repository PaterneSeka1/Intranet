#!/bin/bash
# VDM Intranet — Installation complète du kiosque (macOS)
# Usage : bash installer-demarrage.sh [URL]
# Exemple: bash installer-demarrage.sh http://192.168.1.10:3000

set -e

VDM_URL="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIOSK_SCRIPT="/usr/local/bin/kiosk-vdm.sh"
PLIST_DEST="$HOME/Library/LaunchAgents/com.vdm.intranet.plist"

echo "╔══════════════════════════════════════════╗"
echo "║   VDM Intranet — Installation kiosque   ║"
echo "╚══════════════════════════════════════════╝"
echo "  URL : $VDM_URL"
echo ""

# ── 1. Script de lancement ─────────────────────────────────────────
echo "→ [1/4] Installation du script de lancement..."
sudo cp "$SCRIPT_DIR/kiosk-vdm.sh" "$KIOSK_SCRIPT"
sudo chmod +x "$KIOSK_SCRIPT"

# ── 2. Politique Chrome ────────────────────────────────────────────
echo "→ [2/4] Application de la politique Chrome..."
sudo mkdir -p "/Library/Managed Preferences"
# Injecter l'URL dans la politique
sed "s|http://localhost:3000|$VDM_URL|g" \
    "$SCRIPT_DIR/chrome-policy.plist" \
    | sudo tee "/Library/Managed Preferences/com.google.Chrome.plist" > /dev/null
sudo chmod 644 "/Library/Managed Preferences/com.google.Chrome.plist"

# ── 3. Bloquer Ctrl+N pour Chrome au niveau système ───────────────
echo "→ [3/4] Désactivation de Cmd+N (nouvelle fenêtre) dans Chrome..."
# Redirige le raccourci "New Window" vers une combinaison impossible
defaults write com.google.Chrome NSUserKeyEquivalents \
    -dict "New Window" "@~^\\U0000"
# Idem pour "New Incognito Window"
defaults write com.google.Chrome NSUserKeyEquivalents \
    -dict-add "New Incognito Window" "@~^\\U0001"

# ── 4. LaunchAgent (démarrage automatique à la session) ───────────
echo "→ [4/4] Configuration du démarrage automatique..."
sed "s|http://localhost:3000|$VDM_URL|g" \
    "$SCRIPT_DIR/com.vdm.intranet.plist" > "$PLIST_DEST"
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo ""
echo "✓ Installation terminée."
echo ""
echo "  Récapitulatif des restrictions appliquées :"
echo "  • Barre d'adresse      → cachée (kiosk Chrome)"
echo "  • Nouvel onglet Ctrl+T → bloqué (kiosk Chrome)"
echo "  • Nouvelle fenêtre ⌘+N → redirigée vers l'intranet"
echo "  • Outils développeur   → désactivés (politique)"
echo "  • Mode incognito       → désactivé (politique)"
echo "  • Téléchargements      → bloqués (politique)"
echo "  • Historique           → désactivé (politique)"
echo ""
echo "  Redémarrez Chrome pour que toutes les restrictions soient actives."
echo ""
echo "  Pour désinstaller :"
echo "    bash $SCRIPT_DIR/desinstaller.sh"
