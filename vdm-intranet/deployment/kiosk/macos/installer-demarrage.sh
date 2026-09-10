#!/bin/bash
# VDM Intranet — Installation complète du kiosque (macOS)
# Usage (poste standard, aucun paramètre requis) : bash installer-demarrage.sh
# Usage (URL différente, cas particulier)        : bash installer-demarrage.sh https://autre-adresse

set -e

# Par défaut : l'URL de prod réelle, pas "localhost" — un défaut à
# localhost:3000 grave silencieusement cette URL locale dans la politique
# Chrome ET le LaunchAgent (page vide/inaccessible sur le poste kiosque au
# démarrage). Même piège que celui déjà corrigé côté kit Windows.
VDM_URL="${1:-https://intranet.veilleurdesmedias.org}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIOSK_SCRIPT="/usr/local/bin/kiosk-vdm.sh"
PLIST_DEST="$HOME/Library/LaunchAgents/com.vdm.intranet.plist"
# Politique Chrome "Managed Preferences" : sur macOS elle doit être placée
# dans un sous-dossier nommé par l'utilisateur courant, pas directement sous
# Managed Preferences/ (ignorée sinon — voir README).
CHROME_POLICY_USER="$(whoami)"
CHROME_POLICY_DIR="/Library/Managed Preferences/$CHROME_POLICY_USER"
CHROME_POLICY_DEST="$CHROME_POLICY_DIR/com.google.Chrome.plist"

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
sudo mkdir -p "$CHROME_POLICY_DIR"
# Injecter l'URL dans la politique
sed "s|http://localhost:3000|$VDM_URL|g" \
    "$SCRIPT_DIR/chrome-policy.plist" \
    | sudo tee "$CHROME_POLICY_DEST" > /dev/null
sudo chmod 644 "$CHROME_POLICY_DEST"

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
echo "  Ce qui va se passer :"
echo "  1. À chaque ouverture de session → Chrome s'ouvre en mode kiosque"
echo "     (plein écran verrouillé, sans barre d'adresse) sur $VDM_URL"
echo "  2. Aucune interaction utilisateur requise"
echo ""
echo "  Récapitulatif des restrictions appliquées :"
echo "  • Barre d'adresse      → cachée (kiosk Chrome)"
echo "  • Nouvel onglet Ctrl+T → bloqué (kiosk Chrome)"
echo "  • Nouvelle fenêtre ⌘+N → désactivée (raccourci neutralisé)"
echo "  • Outils développeur   → désactivés (politique)"
echo "  • Mode incognito       → désactivé (politique)"
echo "  • Téléchargements      → bloqués (politique)"
echo "  • Historique           → désactivé (politique)"
echo ""
echo "  Si les restrictions ci-dessus ne s'appliquent pas après redémarrage"
echo "  de Chrome, voir la section « Managed Preferences » du README (le"
echo "  mode kiosque lui-même n'en dépend pas et fonctionne indépendamment)."
echo ""
echo "  → Redémarrez la session pour tester le démarrage automatique."
echo ""
echo "  Pour désinstaller :"
echo "    bash $SCRIPT_DIR/desinstaller.sh"
