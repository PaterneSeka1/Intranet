#!/bin/bash
# Kit copié/zippé depuis un poste Windows (fins de ligne CRLF) : bash échoue
# sur chaque ligne avant même d'arriver au code. Cette ligne, qui DOIT rester
# la première instruction et finir par « # » (le \r tombe dans le
# commentaire), répare le dossier du kit puis relance le script.
if head -n 1 "$0" | grep -q $'\r'; then sed -i 's/\r$//' "$(dirname "$0")"/*.sh "$(dirname "$0")"/*.json "$(dirname "$0")"/*.desktop && exec bash "$0" "$@"; echo "✗ Fins de ligne Windows (CRLF) : dans ce dossier, lancez  sed -i 's/\r\$//' *  puis relancez." >&2; exit 1; fi #
# VdM Intranet — Installation complète du kiosque (Linux)
# Usage (poste standard, aucun paramètre requis) : bash installer-demarrage.sh
# Usage (URL différente, cas particulier)        : bash installer-demarrage.sh https://autre-adresse
#
# À lancer depuis la session de l'utilisateur du kiosque, SANS sudo : le
# script demande lui-même le mot de passe administrateur pour les étapes
# système (voir étape 0).
#
# Détecte le navigateur installé (Chrome > Edge > Brave > Chromium > Firefox),
# applique la politique de verrouillage dans le dossier exact attendu par ce
# navigateur, puis configure le démarrage automatique en mode kiosque à
# l'ouverture de session (autostart XDG : GNOME, KDE, Xfce, Cinnamon, MATE).

set -e

# Par défaut : l'URL de prod réelle, jamais "localhost" (piège déjà corrigé
# sur les kits Windows et macOS — voir README).
VDM_URL="${1:-https://intranet.veilleurdesmedias.org}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Dossier d'installation fixe, sans espace : il est écrit tel quel dans la
# ligne Exec= de l'entrée autostart, où un espace casserait le lancement sans
# aucun message d'erreur.
INSTALL_DIR="/opt/vdm-intranet"
CONF_FILE="$INSTALL_DIR/kiosk.conf"
POLICY_LIST="$INSTALL_DIR/policy-files.txt"
AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
AUTOSTART_FILE="$AUTOSTART_DIR/vdm-intranet-kiosk.desktop"

echo "╔══════════════════════════════════════════╗"
echo "║   VdM Intranet — Installation kiosque   ║"
echo "╚══════════════════════════════════════════╝"
echo "  URL : $VDM_URL"
echo ""

# ── 0. Vérifications préalables ─────────────────────────────────────
# Lancé avec sudo, $HOME pointerait sur /root : l'entrée de démarrage
# automatique serait créée dans /root/.config/autostart et ne se
# déclencherait JAMAIS pour l'utilisateur du kiosque — sans erreur visible.
if [ "$(id -u)" -eq 0 ]; then
  echo "✗ Ne lancez pas ce script avec sudo ni en root." >&2
  echo "  Ouvrez la session de l'utilisateur du kiosque, puis :" >&2
  echo "    bash installer-demarrage.sh" >&2
  echo "  (le mot de passe administrateur sera demandé au besoin)." >&2
  exit 1
fi

# Kit incomplet (zip mal extrait, fichier oublié sur la clé USB) : on
# s'arrête avant d'avoir posé quoi que ce soit.
for f in kiosk-vdm.sh vdm-browser-detect.sh chromium-policy.json \
         firefox-policies.json vdm-intranet-kiosk.desktop; do
  if [ ! -f "$SCRIPT_DIR/$f" ]; then
    echo "✗ Fichier manquant dans le dossier du kit : $f" >&2
    exit 1
  fi
done

# Dossier autostart de l'utilisateur inscriptible ? (~/.config parfois créé
# en root par un ancien `sudo`). Vérifié AVANT toute étape système, pour ne
# pas laisser une politique posée sans démarrage automatique.
if ! mkdir -p "$AUTOSTART_DIR" 2>/dev/null || [ ! -w "$AUTOSTART_DIR" ]; then
  echo "✗ Impossible d'écrire dans $AUTOSTART_DIR." >&2
  echo "  Corrigez le propriétaire puis relancez :" >&2
  echo "    sudo chown -R \"\$(id -un)\": \"${XDG_CONFIG_HOME:-$HOME/.config}\"" >&2
  exit 1
fi

# Commande root avec umask 022 imposé : sur les postes durcis (umask 077),
# `mkdir -p`/`install -D` créeraient les dossiers PARENTS en 700 —
# /etc/opt/chrome illisible par l'utilisateur, et le navigateur ignorerait
# alors sa politique en silence (même famille de piège que « Managed
# Preferences » sur macOS).
sudo_022() {
  sudo sh -c 'umask 022; exec "$@"' sh "$@"
}

# Copie d'un fichier du kit vers sa destination système. Les fins de ligne
# sont normalisées au passage : un kit édité/zippé depuis un poste Windows
# (CRLF) ferait échouer chaque ligne des scripts installés (« $'\r': command
# not found »), au démarrage, sans que personne ne le voie.
install_from_kit() { # <source> <destination> <mode> [sed-expression]
  local tmp
  tmp="$(mktemp)"
  sed -e 's/\r$//' ${4:+-e "$4"} "$SCRIPT_DIR/$1" > "$tmp"
  sudo_022 install -D -m "$3" -o root -g root "$tmp" "$2"
  rm -f "$tmp"
}

# Échapper l'URL pour la substitution sed (« | » est le séparateur choisi,
# « & » réinsère le motif trouvé).
URL_SED="$(printf '%s' "$VDM_URL" | sed -e 's/[|&\\]/\\&/g')"
SUBST_URL="s|http://localhost:3000|$URL_SED|g"

# ── 1. Détecter le navigateur installé ─────────────────────────────
echo "→ [1/5] Détection du navigateur..."
# shellcheck source=vdm-browser-detect.sh
source <(sed 's/\r$//' "$SCRIPT_DIR/vdm-browser-detect.sh")
find_vdm_browser

if [ -z "$BROWSER_FAMILY" ]; then
  echo "" >&2
  if [ -n "$FLATPAK_ONLY" ]; then
    echo "✗ Seule une version Flatpak a été trouvée ($FLATPAK_ONLY)." >&2
    echo "  Les navigateurs Flatpak ne lisent pas les politiques système :" >&2
    echo "  installez la version .deb/.rpm officielle (ou snap pour" >&2
    echo "  Chromium/Firefox sur Ubuntu) puis relancez. Voir README." >&2
  else
    echo "✗ Aucun navigateur pris en charge trouvé (Chrome, Edge, Brave," >&2
    echo "  Chromium, Firefox). Installez-en un et relancez." >&2
  fi
  exit 1
fi
echo "  Navigateur détecté : $BROWSER_NAME ($BROWSER_BIN)"
[ -n "$BROWSER_SNAP" ] && echo "  (paquet snap)"
echo ""

echo "  Le mot de passe administrateur va être demandé pour les étapes système."
sudo -v

# ── 2. Script de lancement ─────────────────────────────────────────
echo "→ [2/5] Installation du script de lancement dans $INSTALL_DIR..."
sudo_022 install -d -m 755 -o root -g root "$INSTALL_DIR"
install_from_kit kiosk-vdm.sh "$INSTALL_DIR/kiosk-vdm.sh" 755
install_from_kit vdm-browser-detect.sh "$INSTALL_DIR/vdm-browser-detect.sh" 644

# Configuration lue par kiosk-vdm.sh à chaque démarrage. Valeurs entre
# guillemets simples (les noms contiennent des espaces : "Google Chrome").
# Les ' éventuels de l'URL sont échappés pour ne pas casser le `source`.
q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
CONF_TMP="$(mktemp)"
{
  echo "# Généré par installer-demarrage.sh le $(date '+%Y-%m-%d %H:%M') — ne pas éditer à la main"
  echo "VDM_URL=$(q "$VDM_URL")"
  echo "BROWSER_NAME=$(q "$BROWSER_NAME")"
  echo "BROWSER_FAMILY=$(q "$BROWSER_FAMILY")"
  echo "BROWSER_BIN=$(q "$BROWSER_BIN")"
  echo "BROWSER_PROFILE_DIR=$(q "$BROWSER_PROFILE_DIR")"
} > "$CONF_TMP"
sudo_022 install -m 644 -o root -g root "$CONF_TMP" "$CONF_FILE"
rm -f "$CONF_TMP"

# ── 3. Politique du navigateur ──────────────────────────────────────
echo "→ [3/5] Application de la politique de verrouillage..."
case "$BROWSER_FAMILY" in
  chromium) POLICY_SRC="chromium-policy.json"; POLICY_NAME="vdm-intranet.json" ;;
  firefox)  POLICY_SRC="firefox-policies.json"; POLICY_NAME="policies.json" ;;
esac

# Un JSON invalide est ignoré en bloc par le navigateur, sans message.
if command -v python3 >/dev/null 2>&1; then
  if ! sed -e 's/\r$//' -e "$SUBST_URL" "$SCRIPT_DIR/$POLICY_SRC" \
       | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; then
    echo "✗ $POLICY_SRC n'est pas un JSON valide — installation interrompue." >&2
    exit 1
  fi
fi

# Liste de tout ce qui est posé, relue par desinstaller.sh (aucun chemin à
# deviner au moment de la désinstallation).
LIST_TMP="$(mktemp)"
IFS=':' read -r -a POLICY_DIRS <<< "$BROWSER_POLICY_DIRS"
for dir in "${POLICY_DIRS[@]}"; do
  [ -n "$dir" ] || continue
  dest="$dir/$POLICY_NAME"
  if [ "$BROWSER_FAMILY" = "firefox" ] && sudo test -f "$dest" \
     && ! sudo test -f "$dest.avant-vdm" \
     && ! sudo grep -qF "$VDM_URL" "$dest"; then
    # policies.json est un fichier unique pour Firefox : une politique
    # posée par un autre outil est sauvegardée (et restaurée par
    # desinstaller.sh) plutôt qu'écrasée sans le dire.
    sudo cp -p "$dest" "$dest.avant-vdm"
    echo "  (politique Firefox existante sauvegardée : $dest.avant-vdm)"
  fi
  sudo_022 install -d -m 755 -o root -g root "$dir"
  install_from_kit "$POLICY_SRC" "$dest" 644 "$SUBST_URL"
  echo "$dest" >> "$LIST_TMP"
  echo "  ✓ $dest"
done
sudo_022 install -m 644 -o root -g root "$LIST_TMP" "$POLICY_LIST"
rm -f "$LIST_TMP"

# ── 4. Démarrage automatique à l'ouverture de session ──────────────
echo "→ [4/5] Configuration du démarrage automatique..."
mkdir -p "$AUTOSTART_DIR"
sed -e 's/\r$//' "$SCRIPT_DIR/vdm-intranet-kiosk.desktop" > "$AUTOSTART_FILE"
chmod 644 "$AUTOSTART_FILE"
echo "  ✓ $AUTOSTART_FILE"

# Vérification finale, en tant qu'utilisateur du kiosque (pas root) : chaque
# élément est relu à son emplacement définitif — un dossier parent
# préexistant non traversable serait détecté ici plutôt qu'au démarrage.
MISSING=""
[ -x "$INSTALL_DIR/kiosk-vdm.sh" ] || MISSING="$MISSING $INSTALL_DIR/kiosk-vdm.sh"
[ -r "$CONF_FILE" ] || MISSING="$MISSING $CONF_FILE"
[ -r "$AUTOSTART_FILE" ] || MISSING="$MISSING $AUTOSTART_FILE"
while read -r dest; do
  [ -r "$dest" ] || MISSING="$MISSING $dest"
done < "$POLICY_LIST"
if [ -n "$MISSING" ]; then
  echo "✗ Éléments absents ou illisibles après installation :$MISSING" >&2
  exit 1
fi

# ── 5. Récapitulatif ────────────────────────────────────────────────
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
    echo "  • Outils développeur   → désactivés (politique)"
    echo "  • Mode incognito       → désactivé (politique)"
    echo "  • Téléchargements      → bloqués (politique)"
    echo "  • Historique           → désactivé (politique)"
    echo ""
    echo "  Vérification (recommandée) : ouvrir chrome://policy dans"
    echo "  $BROWSER_NAME — DeveloperToolsAvailability, DownloadRestrictions..."
    echo "  doivent y figurer avec le statut « OK »."
    ;;
  firefox)
    echo "  Récapitulatif des restrictions appliquées :"
    echo "  • Barre d'adresse/onglets → cachés (mode -kiosk Firefox)"
    echo "  • Outils développeur      → désactivés (politique)"
    echo "  • Navigation privée       → désactivée (politique)"
    echo "  • Gestionnaire de mots de passe → désactivé (politique)"
    echo "  • Historique/cache        → effacés à chaque fermeture (politique)"
    echo "  • Téléchargements         → PAS bloqués aussi strictement que sur"
    echo "    Chrome/Edge/Brave — voir README."
    echo ""
    echo "  Vérification (recommandée) : ouvrir about:policies dans Firefox —"
    echo "  le statut doit être « Actif »."
    ;;
esac
if [ -n "$BROWSER_SNAP" ]; then
  echo ""
  echo "  ⚠ $BROWSER_NAME est installé en snap : la vérification ci-dessus est"
  echo "    indispensable (voir la section snap du README)."
fi

echo ""
echo "  → Fermez puis rouvrez la session pour tester le démarrage automatique."
echo "  → Journal du lanceur : ${XDG_STATE_HOME:-$HOME/.local/state}/vdm-intranet/kiosk.log"
echo ""
echo "  Pour désinstaller :"
echo "    bash \"$SCRIPT_DIR/desinstaller.sh\""
