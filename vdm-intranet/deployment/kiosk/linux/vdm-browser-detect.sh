#!/bin/bash
# VdM Intranet — Détection du navigateur disponible (Linux)
#
# Logique PARTAGÉE entre installer-demarrage.sh (au moment de l'installation,
# pour savoir quelle politique appliquer et OÙ la poser) et kiosk-vdm.sh (en
# repli au démarrage, si le navigateur installé a disparu) — une seule source
# de vérité, comme côté macOS.
#
# Ordre de préférence : Chrome > Edge > Brave > Chromium > Firefox.
#
# Sous Linux, le dossier où chaque navigateur lit sa politique d'entreprise
# dépend de l'éditeur ET du mode de paquetage (.deb/.rpm natif ou snap) — et un
# fichier posé au mauvais endroit est ignoré SANS AUCUNE ERREUR (même piège que
# « Managed Preferences » sur macOS). Les chemins ci-dessous sont donc la
# référence unique : ne pas les dupliquer ailleurs.
#
# Les versions Flatpak ne sont PAS prises en charge : elles tournent dans un
# bac à sable qui ne voit pas /etc/opt/..., /etc/chromium..., /etc/firefox...
# de l'hôte — la politique y serait silencieusement ignorée. Voir README.
#
# Renseigne après appel de find_vdm_browser (variables globales) :
#   BROWSER_NAME        - nom lisible ("Google Chrome", "Firefox"...)
#   BROWSER_FAMILY      - "chromium" | "firefox" | "" (aucun trouvé)
#   BROWSER_BIN         - commande à lancer (chemin absolu)
#   BROWSER_SNAP        - "1" si le navigateur est un snap, "" sinon
#   BROWSER_POLICY_DIRS - dossier(s) de politique, séparés par ":" (aucun
#                         chemin ici ne contient d'espace ni de ":")
#   BROWSER_PROFILE_DIR - dossier de profil (utilisé par kiosk-vdm.sh pour
#                         neutraliser la bulle « Restaurer les pages »)
#   FLATPAK_ONLY        - nom du navigateur Flatpak trouvé quand aucun
#                         navigateur natif n'est installé (message d'erreur)

# Premier exécutable trouvé parmi les noms passés en argument (chemin absolu).
_vdm_first_bin() {
  local name path
  for name in "$@"; do
    path="$(command -v "$name" 2>/dev/null)" || continue
    [ -n "$path" ] && [ -x "$path" ] && { echo "$path"; return 0; }
  done
  return 1
}

# Vrai si la commande est en réalité un snap : soit un lien vers
# /usr/bin/snap (cas /snap/bin/firefox), soit l'enveloppe de transition
# Ubuntu (/usr/bin/chromium-browser, /usr/bin/firefox) qui relance le snap.
_vdm_is_snap() {
  local bin="$1" snap_name="$2"
  case "$bin" in /snap/bin/*) return 0 ;; esac
  [ "$(readlink -f "$bin" 2>/dev/null)" = "/usr/bin/snap" ] && return 0
  [ -n "$snap_name" ] && [ -e "/snap/bin/$snap_name" ] \
    && grep -qs "/snap/bin/$snap_name" "$bin" && return 0
  return 1
}

find_vdm_browser() {
  BROWSER_NAME=""
  BROWSER_FAMILY=""
  BROWSER_BIN=""
  BROWSER_SNAP=""
  BROWSER_POLICY_DIRS=""
  BROWSER_PROFILE_DIR=""
  FLATPAK_ONLY=""

  local bin real

  if bin="$(_vdm_first_bin google-chrome-stable google-chrome)"; then
    BROWSER_NAME="Google Chrome"
    BROWSER_FAMILY="chromium"
    BROWSER_BIN="$bin"
    BROWSER_POLICY_DIRS="/etc/opt/chrome/policies/managed"
    BROWSER_PROFILE_DIR="$HOME/.config/google-chrome"
  elif bin="$(_vdm_first_bin microsoft-edge-stable microsoft-edge)"; then
    BROWSER_NAME="Microsoft Edge"
    BROWSER_FAMILY="chromium"
    BROWSER_BIN="$bin"
    BROWSER_POLICY_DIRS="/etc/opt/edge/policies/managed"
    BROWSER_PROFILE_DIR="$HOME/.config/microsoft-edge"
  elif bin="$(_vdm_first_bin brave-browser brave-browser-stable brave)"; then
    BROWSER_NAME="Brave Browser"
    BROWSER_FAMILY="chromium"
    BROWSER_BIN="$bin"
    BROWSER_POLICY_DIRS="/etc/brave/policies/managed"
    if _vdm_is_snap "$bin" brave; then
      # Snap confiné : lecture de /etc/brave non garantie — l'installeur le
      # signale et demande de vérifier dans brave://policy.
      BROWSER_SNAP="1"
      BROWSER_PROFILE_DIR="$HOME/snap/brave/current/.config/BraveSoftware/Brave-Browser"
    else
      BROWSER_PROFILE_DIR="$HOME/.config/BraveSoftware/Brave-Browser"
    fi
  elif bin="$(_vdm_first_bin chromium chromium-browser)"; then
    BROWSER_NAME="Chromium"
    BROWSER_FAMILY="chromium"
    BROWSER_BIN="$bin"
    # Debian/Fedora/Arch lisent /etc/chromium, Ubuntu (snap compris — le snap
    # a une autorisation explicite sur ce dossier) lit /etc/chromium-browser.
    # Les deux sont posés : un dossier non lu est simplement sans effet.
    BROWSER_POLICY_DIRS="/etc/chromium/policies/managed:/etc/chromium-browser/policies/managed"
    if _vdm_is_snap "$bin" chromium; then
      BROWSER_SNAP="1"
      BROWSER_PROFILE_DIR="$HOME/snap/chromium/common/chromium"
    else
      BROWSER_PROFILE_DIR="$HOME/.config/chromium"
    fi
  elif bin="$(_vdm_first_bin firefox firefox-esr)"; then
    BROWSER_NAME="Firefox"
    BROWSER_FAMILY="firefox"
    BROWSER_BIN="$bin"
    # /etc/firefox/policies est lu par les builds Mozilla (.deb, tarball) ET
    # par le snap Firefox d'Ubuntu. Pour un build de distribution, le dossier
    # « distribution » à côté du vrai binaire est le mécanisme historique qui
    # marche toujours — on pose les deux (sauf snap : dossier en lecture
    # seule). Debian ESR lit en plus /etc/firefox-esr/policies.
    BROWSER_POLICY_DIRS="/etc/firefox/policies"
    case "$(basename "$bin")" in
      firefox-esr) BROWSER_POLICY_DIRS="$BROWSER_POLICY_DIRS:/etc/firefox-esr/policies" ;;
    esac
    if _vdm_is_snap "$bin" firefox; then
      BROWSER_SNAP="1"
    else
      real="$(readlink -f "$bin" 2>/dev/null)"
      # /usr/bin/firefox est parfois un script shell (et non un lien) : on ne
      # garde le dossier que s'il contient bien le binaire Firefox lui-même.
      if [ -n "$real" ] && [ -f "$(dirname "$real")/application.ini" ]; then
        BROWSER_POLICY_DIRS="$BROWSER_POLICY_DIRS:$(dirname "$real")/distribution"
      fi
    fi
  elif command -v flatpak >/dev/null 2>&1; then
    # Aucun navigateur natif : on signale un éventuel Flatpak pour que le
    # message d'erreur soit explicite (plutôt qu'un « aucun navigateur »).
    local app
    for app in com.google.Chrome com.microsoft.Edge com.brave.Browser \
               org.chromium.Chromium org.mozilla.firefox; do
      if flatpak info "$app" >/dev/null 2>&1; then
        FLATPAK_ONLY="$app"
        break
      fi
    done
  fi
}
