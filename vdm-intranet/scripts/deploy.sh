#!/usr/bin/env bash
# Déploiement prod (VPS) — build vérifié AVANT tout redémarrage pm2.
#
# Principe : on ne redémarre jamais un process sur un build incomplet. Un build:api qui sort
# en exit 0 sans rien émettre (voir apps/api/tsconfig.build.json) ou un build:web interrompu
# arrête le script avant `pm2 restart`, le process en cours continue de tourner sur l'ancien code
# déjà chargé en mémoire.
#
# Usage (depuis n'importe où) : bash scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

API_URL="https://api-intranet.veilleurdesmedias.org/api/auth/me"
WEB_URL="https://intranet.veilleurdesmedias.org/login"
PG_CONTAINER="vdm_postgres"

step() { echo -e "\n\033[1;34m[deploy]\033[0m $*"; }
fail() { echo -e "\n\033[1;31m[deploy] ÉCHEC :\033[0m $*" >&2; exit 1; }

set -a
# shellcheck disable=SC1091
source .env
set +a

# Pas de `npm ci` : il supprime node_modules pendant que vdm-web/vdm-api tournent encore.
# On n'installe que si le lockfile a changé depuis la dernière installation.
if [ package-lock.json -nt node_modules/.package-lock.json ]; then
  step "Dépendances (lockfile modifié)"
  npm install --no-audit --no-fund
  git checkout -- package-lock.json # annule la normalisation locale éventuelle (fsevents dev:true)
  touch node_modules/.package-lock.json # sinon le checkout ci-dessus redéclenche l'install au prochain déploiement
else
  step "Dépendances à jour, installation ignorée"
fi

step "Client Prisma"
npm run db:generate

step "Migrations en attente ?"
if (cd packages/database && npx prisma migrate status >/dev/null 2>&1); then
  echo "Aucune migration en attente."
else
  mkdir -p backups
  dump="backups/vdm_intranet_pre_deploy_$(date -u +%Y%m%dT%H%M%SZ).dump"
  step "Sauvegarde de la base avant migration → $dump"
  docker exec "$PG_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$dump"
  [ -s "$dump" ] || fail "sauvegarde vide, migration annulée"
  npm run db:migrate
fi

step "Build API"
npm run build:api
ts_count=$(find apps/api/src -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' | wc -l)
js_count=$(find apps/api/dist -name '*.js' 2>/dev/null | wc -l)
[ -f apps/api/dist/main.js ] || fail "apps/api/dist/main.js absent"
[ "$ts_count" -eq "$js_count" ] || fail "build API incomplet ($js_count .js pour $ts_count .ts)"
echo "OK : $js_count/$ts_count fichiers compilés."

step "Build Web"
npm run build:web
[ -s apps/web/.next/BUILD_ID ] || fail "apps/web/.next/BUILD_ID absent"

step "Redémarrage pm2"
pm2 restart vdm-api vdm-web --update-env

step "Vérifications"
check() {
  local url=$1 expected=$2 code=""
  for _ in $(seq 1 15); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)
    [ "$code" = "$expected" ] && { echo "OK : $url → $code"; return 0; }
    sleep 2
  done
  pm2 logs vdm-api vdm-web --lines 30 --nostream || true
  fail "$url → $code (attendu $expected)"
}
check "$API_URL" 401
check "$WEB_URL" 200

step "Déploiement terminé ($(git rev-parse --short HEAD))."
