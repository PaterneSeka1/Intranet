#!/bin/bash
# VdM Intranet — Installation complète du kiosque (macOS)
# Usage (poste standard, aucun paramètre requis) : bash installer-demarrage.sh
# Usage (URL différente, cas particulier)        : bash installer-demarrage.sh https://autre-adresse
#
# Détecte automatiquement le navigateur installé (Chrome > Edge > Brave >
# Chromium > Firefox > Safari en dernier recours) et applique la politique de
# verrouillage adaptée à celui-ci — voir vdm-browser-detect.sh et le README
# pour le détail par navigateur (notamment Safari, qui n'offre aucun vrai
# verrouillage sans MDM).

set -e

# Par défaut : l'URL de prod réelle, pas "localhost" — un défaut à
# localhost:3000 grave silencieusement cette URL locale dans la politique du
# navigateur ET le LaunchAgent (page vide/inaccessible sur le poste kiosque
# au démarrage). Même piège que celui déjà corrigé côté kit Windows.
VDM_URL="${1:-https://intranet.veilleurdesmedias.org}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIOSK_SCRIPT="/usr/local/bin/kiosk-vdm.sh"
DETECT_SCRIPT="/usr/local/bin/vdm-browser-detect.sh"
PLIST_DEST="$HOME/Library/LaunchAgents/com.vdm.intranet.plist"
SUPPORT_DIR="$HOME/Library/Application Support/VdM Intranet"
INSTALL_STATE="$SUPPORT_DIR/kiosk-install-state.txt"

echo "╔══════════════════════════════════════════╗"
echo "║   VdM Intranet — Installation kiosque   ║"
echo "╚══════════════════════════════════════════╝"
echo "  URL : $VDM_URL"
echo ""

# ── 0. Détecter le navigateur installé ─────────────────────────────
echo "→ [1/5] Détection du navigateur..."
# shellcheck source=vdm-browser-detect.sh
source "$SCRIPT_DIR/vdm-browser-detect.sh"
find_vdm_browser

if [ -z "$BROWSER_FAMILY" ]; then
  echo "" >&2
  echo "✗ Aucun navigateur pris en charge trouvé (Chrome, Edge, Brave," >&2
  echo "  Chromium, Firefox, Safari). Installez-en un et relancez." >&2
  exit 1
fi
echo "  Navigateur détecté : $BROWSER_NAME ($BROWSER_FAMILY)"
echo ""

# ── 1. Script de lancement ─────────────────────────────────────────
echo "→ [2/5] Installation du script de lancement..."
sudo cp "$SCRIPT_DIR/kiosk-vdm.sh" "$KIOSK_SCRIPT"
sudo cp "$SCRIPT_DIR/vdm-browser-detect.sh" "$DETECT_SCRIPT"
sudo chmod +x "$KIOSK_SCRIPT" "$DETECT_SCRIPT"

# ── 2. Politique du navigateur ──────────────────────────────────────
echo "→ [3/5] Application de la politique de verrouillage..."
mkdir -p "$SUPPORT_DIR"
# Valeurs entre guillemets : plusieurs (BROWSER_NAME, BROWSER_APP) contiennent
# des espaces ("Google Chrome"...) — sans guillemets, le `source` fait par
# desinstaller.sh couperait la ligne et tenterait d'exécuter le reste comme
# une commande (ex. "Chrome"), ce qui ferait échouer le script sous `set -e`.
{
  echo "BROWSER_FAMILY=\"$BROWSER_FAMILY\""
  echo "BROWSER_NAME=\"$BROWSER_NAME\""
  echo "BROWSER_DOMAIN=\"$BROWSER_DOMAIN\""
  echo "BROWSER_APP=\"$BROWSER_APP\""
} > "$INSTALL_STATE"

case "$BROWSER_FAMILY" in
  chromium)
    # Politique "Managed Preferences" : sur macOS elle doit être placée dans
    # un sous-dossier nommé par l'utilisateur courant (voir README).
    CHROME_POLICY_DIR="/Library/Managed Preferences/$(whoami)"
    CHROME_POLICY_DEST="$CHROME_POLICY_DIR/$BROWSER_DOMAIN.plist"
    sudo mkdir -p "$CHROME_POLICY_DIR"
    sed "s|http://localhost:3000|$VDM_URL|g" \
        "$SCRIPT_DIR/chromium-policy.plist" \
        | sudo tee "$CHROME_POLICY_DEST" > /dev/null
    sudo chmod 644 "$CHROME_POLICY_DEST"

    # Neutraliser ⌘+N / ⌘+⇧+N pour ce navigateur au niveau système.
    defaults write "$BROWSER_DOMAIN" NSUserKeyEquivalents \
        -dict "New Window" "@~^\\U0000"
    defaults write "$BROWSER_DOMAIN" NSUserKeyEquivalents \
        -dict-add "New Incognito Window" "@~^\\U0001"
    ;;

  firefox)
    # Firefox n'utilise ni le registre ni Managed Preferences : la politique
    # se pose dans un fichier policies.json à l'intérieur même du bundle .app
    # (voir README pour les limites par rapport à la famille Chromium —
    # notamment le blocage des téléchargements, moins strict).
    FIREFOX_DIST_DIR="$BROWSER_APP/Contents/Resources/distribution"
    FIREFOX_POLICY_DEST="$FIREFOX_DIST_DIR/policies.json"
    sudo mkdir -p "$FIREFOX_DIST_DIR"
    sed "s|http://localhost:3000|$VDM_URL|g" \
        "$SCRIPT_DIR/firefox-policies.json" \
        | sudo tee "$FIREFOX_POLICY_DEST" > /dev/null
    sudo chmod 644 "$FIREFOX_POLICY_DEST"
    ;;

  safari)
    echo ""
    echo "  ⚠ Safari ne supporte aucune politique de verrouillage sans MDM :"
    echo "    aucune restriction ne sera appliquée (voir README)."
    echo ""
    ;;
esac

# ── 3. LaunchAgent (démarrage automatique à la session) ───────────
echo "→ [4/5] Configuration du démarrage automatique..."
sed "s|http://localhost:3000|$VDM_URL|g" \
    "$SCRIPT_DIR/com.vdm.intranet.plist" > "$PLIST_DEST"
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

# ── 4. Récapitulatif ────────────────────────────────────────────────
echo "→ [5/5] Terminé."
echo ""
echo "✓ Installation terminée."
echo ""
echo "  Ce qui va se passer :"
echo "  1. À chaque ouverture de session → $BROWSER_NAME s'ouvre en mode"
echo "     kiosque sur $VDM_URL"
echo "  2. Aucune interaction utilisateur requise"
echo ""

case "$BROWSER_FAMILY" in
  chromium)
    echo "  Récapitulatif des restrictions appliquées :"
    echo "  • Barre d'adresse      → cachée (kiosk $BROWSER_NAME)"
    echo "  • Nouvel onglet Ctrl+T → bloqué (kiosk $BROWSER_NAME)"
    echo "  • Nouvelle fenêtre ⌘+N → désactivée (raccourci neutralisé)"
    echo "  • Outils développeur   → désactivés (politique)"
    echo "  • Mode incognito       → désactivé (politique)"
    echo "  • Téléchargements      → bloqués (politique)"
    echo "  • Historique           → désactivé (politique)"
    echo ""
    echo "  Si les restrictions ci-dessus ne s'appliquent pas après"
    echo "  redémarrage de $BROWSER_NAME, voir la section « Managed"
    echo "  Preferences » du README (le mode kiosque lui-même n'en dépend"
    echo "  pas et fonctionne indépendamment)."
    ;;
  firefox)
    echo "  Récapitulatif des restrictions appliquées :"
    echo "  • Barre d'adresse/onglets → cachés (mode -kiosk Firefox)"
    echo "  • Outils développeur      → désactivés (politique)"
    echo "  • Navigation privée       → désactivée (politique)"
    echo "  • Mode incognito          → désactivé (politique)"
    echo "  • Gestionnaire de mots de passe → désactivé (politique)"
    echo "  • Historique/cache        → effacés à chaque fermeture (politique)"
    echo "  • Téléchargements         → PAS bloqués aussi strictement que sur"
    echo "    Chrome/Edge/Brave (Firefox n'a pas d'équivalent direct à"
    echo "    DownloadRestrictions) — voir README."
    ;;
  safari)
    echo "  ⚠ Aucune restriction appliquée (Safari, voir avertissement"
    echo "    ci-dessus et le README)."
    ;;
esac

echo ""
echo "  → Redémarrez la session pour tester le démarrage automatique."
echo ""
echo "  Pour désinstaller :"
echo "    bash $SCRIPT_DIR/desinstaller.sh"
