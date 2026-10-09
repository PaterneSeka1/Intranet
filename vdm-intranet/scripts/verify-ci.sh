#!/usr/bin/env bash
# Rejoue localement les étapes bloquantes de .github/workflows/ci.yml, dans le même ordre,
# pour détecter un échec CI avant le push. Utilisé par le hook .githooks/pre-push et par la
# skill Claude Code /verif-ci.
#
# Usage : bash scripts/verify-ci.sh [--quick]
#   --quick  saute les builds API/Web (les plus longs)
#
# Non rejoué : `prisma migrate deploy` (exige une base PostgreSQL vide, comme le service CI).

set -uo pipefail

cd "$(dirname "$0")/.."

QUICK=0
[ "${1:-}" = "--quick" ] && QUICK=1

FAILED=()

step() {
  local name="$1"
  shift
  echo ""
  echo "▶ $name"
  if "$@"; then
    echo "✔ $name"
  else
    echo "✘ $name"
    FAILED+=("$name")
  fi
}

step "Générer le client Prisma" npm run db:generate --silent
# --end-of-line auto : sous Windows le working tree peut être en CRLF ; .gitattributes
# normalise en LF au commit, donc seules les vraies différences de style comptent.
step "Formatage (Prettier)" npx prettier --check "**/*.{ts,tsx,json,yaml,md}" \
  --ignore-path .gitignore --end-of-line auto --log-level warn
step "Type-check API" npm run type-check --workspace=apps/api --silent
step "Type-check Web" npm run type-check --workspace=apps/web --silent
step "Tests unitaires (API)" npm run test --workspace=apps/api --silent -- --ci

if [ "$QUICK" -eq 0 ]; then
  step "Build API" npm run build:api --silent
  step "Build Web" npm run build:web --silent
fi

echo ""
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "════ Vérification CI : ÉCHEC (${#FAILED[@]}) ════"
  for f in "${FAILED[@]}"; do echo "  ✘ $f"; done
  exit 1
fi

echo "════ Vérification CI : OK ════"
