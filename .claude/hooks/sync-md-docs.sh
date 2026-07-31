#!/bin/bash
# Stop hook — force la mise à jour de SESSION_HANDOFF.md / TACHE.md quand du code
# a changé dans vdm-intranet/apps ou vdm-intranet/packages depuis la dernière sync.
set -u

ROOT="/Users/macbookpro/YAGAMI/Intranet"
STATE_FILE="$ROOT/.claude/.md-sync-state"

cd "$ROOT" || exit 0

STATUS=$(git status --porcelain -- vdm-intranet/apps vdm-intranet/packages 2>/dev/null)
DIFF=$(git diff -- vdm-intranet/apps vdm-intranet/packages 2>/dev/null)

if [ -z "$STATUS" ] && [ -z "$DIFF" ]; then
  exit 0
fi

CURRENT_HASH=$(printf '%s%s' "$STATUS" "$DIFF" | shasum -a 256 | awk '{print $1}')
LAST_HASH=""
[ -f "$STATE_FILE" ] && LAST_HASH=$(cat "$STATE_FILE")

if [ "$CURRENT_HASH" = "$LAST_HASH" ]; then
  exit 0
fi

REASON="Des fichiers de code ont été modifiés dans apps/ ou packages/ (vdm-intranet) au cours de ce tour. Avant de terminer : 1) Ajoute une entrée courte et datée dans vdm-intranet/SESSION_HANDOFF.md résumant le changement. 2) Coche ou ajoute la tâche correspondante dans vdm-intranet/TACHE.md, en respectant strictement la structure et le style déjà en place dans ces deux fichiers (français, dates absolues). Si le changement est mineur ou déjà documenté, l'indiquer brièvement plutôt que d'ajouter une entrée redondante. 3) Puis exécute exactement cette commande pour marquer la synchronisation comme faite : mkdir -p '$ROOT/.claude' && echo '$CURRENT_HASH' > '$STATE_FILE'"

jq -n --arg reason "$REASON" '{decision: "block", reason: $reason}'
