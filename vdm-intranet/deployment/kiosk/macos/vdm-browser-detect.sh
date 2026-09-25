#!/bin/bash
# VdM Intranet — Détection du navigateur disponible (macOS)
#
# Logique PARTAGÉE entre installer-demarrage.sh (au moment de l'installation,
# pour savoir quelle politique appliquer) et kiosk-vdm.sh (à chaque démarrage,
# pour savoir comment lancer le navigateur) — une seule source de vérité,
# pour éviter que les deux se désynchronisent (l'un cherchant un navigateur
# que l'autre ne reconnaît plus).
#
# Ordre de préférence : Chrome > Edge > Brave > Chromium > Firefox > Safari.
# Safari est un DERNIER RECOURS : pas de mode kiosque natif ni de politique
# d'entreprise possible sans MDM sur un Mac non supervisé (voir README) — il
# n'est choisi que si aucun autre navigateur pris en charge n'est installé.
#
# Renseigne après appel de find_vdm_browser (variables globales) :
#   BROWSER_NAME   - nom lisible ("Google Chrome", "Firefox"...)
#   BROWSER_FAMILY - "chromium" | "firefox" | "safari" | "" (aucun trouvé)
#   BROWSER_BIN    - exécutable à lancer (vide pour Safari : voir kiosk-vdm.sh)
#   BROWSER_APP    - chemin du bundle .app
#   BROWSER_DOMAIN - identifiant de bundle utilisé pour la politique
#                    Managed Preferences (uniquement pour la famille Chromium)

find_vdm_browser() {
  BROWSER_NAME=""
  BROWSER_FAMILY=""
  BROWSER_BIN=""
  BROWSER_APP=""
  BROWSER_DOMAIN=""

  if [ -d "/Applications/Google Chrome.app" ]; then
    BROWSER_NAME="Google Chrome"
    BROWSER_FAMILY="chromium"
    BROWSER_APP="/Applications/Google Chrome.app"
    BROWSER_BIN="$BROWSER_APP/Contents/MacOS/Google Chrome"
    BROWSER_DOMAIN="com.google.Chrome"
  elif [ -d "/Applications/Microsoft Edge.app" ]; then
    BROWSER_NAME="Microsoft Edge"
    BROWSER_FAMILY="chromium"
    BROWSER_APP="/Applications/Microsoft Edge.app"
    BROWSER_BIN="$BROWSER_APP/Contents/MacOS/Microsoft Edge"
    BROWSER_DOMAIN="com.microsoft.Edge"
  elif [ -d "/Applications/Brave Browser.app" ]; then
    BROWSER_NAME="Brave Browser"
    BROWSER_FAMILY="chromium"
    BROWSER_APP="/Applications/Brave Browser.app"
    BROWSER_BIN="$BROWSER_APP/Contents/MacOS/Brave Browser"
    BROWSER_DOMAIN="com.brave.Browser"
  elif [ -d "/Applications/Chromium.app" ]; then
    BROWSER_NAME="Chromium"
    BROWSER_FAMILY="chromium"
    BROWSER_APP="/Applications/Chromium.app"
    BROWSER_BIN="$BROWSER_APP/Contents/MacOS/Chromium"
    # Build "officiel" open source, moins standardisé en entreprise que les
    # trois ci-dessus : identifiant de bundle à confirmer sur le poste réel
    # si la politique ne s'applique pas (chromium.org ne documente pas de
    # schéma de politique aussi formellement que Google/Microsoft/Brave).
    BROWSER_DOMAIN="org.chromium.Chromium"
  elif [ -d "/Applications/Firefox.app" ]; then
    BROWSER_NAME="Firefox"
    BROWSER_FAMILY="firefox"
    BROWSER_APP="/Applications/Firefox.app"
    BROWSER_BIN="$BROWSER_APP/Contents/MacOS/firefox"
  elif [ -d "/Applications/Safari.app" ]; then
    BROWSER_NAME="Safari"
    BROWSER_FAMILY="safari"
    BROWSER_APP="/Applications/Safari.app"
    # Pas d'exécutable direct utile : Safari se lance via `open -a Safari`
    # (voir kiosk-vdm.sh), jamais par chemin binaire + arguments.
  fi
}
