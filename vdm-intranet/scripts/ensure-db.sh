#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if ! docker info >/dev/null 2>&1; then
  echo "[db] Docker n'est pas démarré, lancement de Docker Desktop..."

  if [[ "$(uname)" != "Darwin" ]]; then
    echo "[db] Démarrage automatique non supporté sur cet OS. Démarre le daemon Docker puis relance." >&2
    exit 1
  fi

  open -a Docker

  echo -n "[db] Attente du démarrage de Docker"
  i=0
  until docker info >/dev/null 2>&1 || [ "$i" -ge 60 ]; do
    echo -n "."
    sleep 2
    i=$((i + 1))
  done
  echo ""

  if ! docker info >/dev/null 2>&1; then
    echo "[db] Docker n'a pas démarré après 120s. Lance Docker Desktop manuellement puis relance la commande." >&2
    exit 1
  fi
fi

docker compose up -d postgres >/dev/null

echo -n "[db] Attente que Postgres soit prêt"
i=0
until docker exec vdm_postgres pg_isready -U "${POSTGRES_USER:-vdm_user}" -d "${POSTGRES_DB:-vdm_intranet}" >/dev/null 2>&1 || [ "$i" -ge 30 ]; do
  echo -n "."
  sleep 1
  i=$((i + 1))
done
echo ""

if ! docker exec vdm_postgres pg_isready -U "${POSTGRES_USER:-vdm_user}" -d "${POSTGRES_DB:-vdm_intranet}" >/dev/null 2>&1; then
  echo "[db] Postgres ne répond pas après 30s. Vérifie 'docker logs vdm_postgres'." >&2
  exit 1
fi

echo "[db] Postgres prêt sur le port 5434."
