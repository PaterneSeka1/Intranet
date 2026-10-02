#!/bin/bash
# Fins de ligne CRLF (kit passé par Windows) : réparation puis relance — voir
# la même ligne, et son explication, dans installer-demarrage.sh.
if head -n 1 "$0" | grep -q $'\r'; then sed -i 's/\r$//' "$(dirname "$0")"/*.sh "$(dirname "$0")"/*.json "$(dirname "$0")"/*.desktop && exec bash "$0" "$@"; echo "✗ Fins de ligne Windows (CRLF) : dans ce dossier, lancez  sed -i 's/\r\$//' *  puis relancez." >&2; exit 1; fi #
# VdM Intranet — Désinstallation complète du kiosque (Linux)
#
# Retire tout ce que installer-demarrage.sh a mis en place : l'entrée de
# démarrage automatique, le dossier /opt/vdm-intranet et la politique du
# navigateur, à partir de la liste EXACTE des fichiers posés
# (policy-files.txt) — aucun chemin deviné. Ne désinstalle pas le navigateur.
#
# À lancer, comme l'installation, depuis la session de l'utilisateur du
# kiosque et SANS sudo.

set -e

INSTALL_DIR="/opt/vdm-intranet"
POLICY_LIST="$INSTALL_DIR/policy-files.txt"
AUTOSTART_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/vdm-intranet-kiosk.desktop"

if [ "$(id -u)" -eq 0 ]; then
  echo "✗ Ne lancez pas ce script avec sudo ni en root : l'entrée de" >&2
  echo "  démarrage automatique de l'utilisateur du kiosque ne serait pas" >&2
  echo "  trouvée. Depuis sa session : bash desinstaller.sh" >&2
  exit 1
fi

echo "→ Suppression du démarrage automatique..."
rm -f "$AUTOSTART_FILE"

echo "→ Suppression de la politique du navigateur..."
if [ -f "$POLICY_LIST" ]; then
  while read -r dest; do
    [ -n "$dest" ] || continue
    sudo rm -f "$dest"
    # Politique Firefox préexistante sauvegardée à l'installation.
    if sudo test -f "$dest.avant-vdm"; then
      sudo mv "$dest.avant-vdm" "$dest"
      echo "  (politique Firefox d'origine restaurée : $dest)"
    fi
    # Dossiers de politique devenus vides uniquement (rmdir échoue sur un
    # dossier qui contient d'autres politiques) ; on ne remonte jamais plus
    # haut que « policies » (/etc/opt, /etc... ne sont pas à nous).
    dir="$(dirname "$dest")"
    sudo rmdir "$dir" 2>/dev/null || true
    case "$dir" in
      */policies/managed) sudo rmdir "$(dirname "$dir")" 2>/dev/null || true ;;
    esac
    echo "  ✓ $dest"
  done < "$POLICY_LIST"
else
  echo "  (aucune liste de politiques trouvée dans $POLICY_LIST — rien à retirer)"
fi

echo "→ Suppression de $INSTALL_DIR..."
sudo rm -rf "$INSTALL_DIR"

echo ""
echo "✓ Désinstallation terminée. Redémarrez le navigateur."
