#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Un Postgres con lo schema delle prove SQL e un PostgREST davanti, in Docker:
# il motore Supabase della segreteria ci gira sopra senza Supabase vero.
#
#   bash scripts/segreteria-comune/avvia.sh
#   PGRST_URL=http://localhost:53000 PGRST_JWT_SECRET=una-chiave-lunga-almeno-trentadue-caratteri \
#     npm run prova:segreteria-comune
#   bash scripts/segreteria-comune/avvia.sh ferma
#
# Lo schema è quello di scripts/prova-sql.sh (finto-supabase.sql e i file
# numerati), più postgrest.sql. Serve solo Docker. Lo usa anche
# `.github/workflows/controlla.yml`.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/../.."

docker rm -f ods-comune-rest ods-comune-pg >/dev/null 2>&1 || true
docker network rm ods-comune >/dev/null 2>&1 || true
[ "${1:-}" = ferma ] && exit 0

docker network create ods-comune >/dev/null
docker run -d --rm --name ods-comune-pg --network ods-comune -e POSTGRES_PASSWORD=prova postgres:17 >/dev/null
until docker exec ods-comune-pg pg_isready -q -U postgres; do sleep 1; done
# pg_isready risponde già durante l'avvio, prima del riavvio finale dell'immagine.
until docker exec ods-comune-pg psql -U postgres -c 'select 1' >/dev/null 2>&1; do sleep 1; done
sleep 2
docker exec ods-comune-pg createdb -U postgres ods

for f in supabase/prova/finto-supabase.sql supabase/[0-9][0-9]-*.sql supabase/[0-9][0-9][0-9]-*.sql scripts/segreteria-comune/postgrest.sql; do
  docker exec -i ods-comune-pg psql -q -X -v ON_ERROR_STOP=1 -U postgres -d ods <"$f" >/dev/null 2>&1 ||
    { echo "✗ lo schema non si carica: $f"; docker exec -i ods-comune-pg psql -q -X -v ON_ERROR_STOP=1 -U postgres -d ods <"$f" >/dev/null; exit 1; }
done

docker run -d --rm --name ods-comune-rest --network ods-comune -p 53000:3000 \
  -e PGRST_DB_URI=postgres://authenticator:prova@ods-comune-pg:5432/ods \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET=una-chiave-lunga-almeno-trentadue-caratteri \
  postgrest/postgrest:v12.2.12 >/dev/null
until curl -sf -o /dev/null localhost:53000/; do sleep 1; done
echo 'PostgREST su http://localhost:53000'
