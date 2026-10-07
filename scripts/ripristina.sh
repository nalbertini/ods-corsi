#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Rimette una copia del backup (ruoli.sql, schema.sql, dati.sql, come li fa
# .github/workflows/backup.yml) in un Postgres usa e getta e conta le righe
# delle tabelle che contano: un backup che non si ripristina non serve a
# niente, e lo si scoprirebbe quando serve.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… scripts/ripristina.sh <cartella> [<cartella dei certificati>]
#
# Mai il database vero: lavora su un database `ripristino` che crea e butta.
# E non scrive niente dei dati: il repository è pubblico e i log di Actions
# li legge chiunque, quindi escono solo numeri, mai il testo di un errore o
# di una riga.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

cartella=${1:?manca la cartella con ruoli.sql, schema.sql e dati.sql}
certificati=${2:-}
db=ripristino
psql() { command psql -q -X "$@"; }

for f in ruoli.sql schema.sql dati.sql; do
  [ -s "$cartella/$f" ] || { echo "✗ manca $f nella copia"; exit 1; }
done

dropdb --if-exists "$db" 2>/dev/null
createdb "$db"
trap 'dropdb --if-exists "$db" 2>/dev/null || true' EXIT

# Un Postgres vuoto non ha quello che Supabase mette da sé (lo schema auth, lo Storage, i ruoli anon e simili):
# la stessa impalcatura delle prove del database.
psql -d "$db" -v ON_ERROR_STOP=1 -f supabase/prova/finto-supabase.sql >/dev/null
# Su Supabase citext sta nello schema `extensions`, che è nel percorso di ricerca: lo schema della copia lo cita così.
psql -d "$db" -v ON_ERROR_STOP=1 -c 'create schema if not exists extensions; create extension if not exists citext with schema extensions' >/dev/null
psql -d "$db" -v ON_ERROR_STOP=1 -c "alter database $db set search_path = public, extensions" >/dev/null

# I ruoli di Supabase in un Postgres vuoto: gli errori «esiste già» o «non si può» sono attesi.
psql -d "$db" -f "$cartella/ruoli.sql" >/dev/null 2>&1 || true

# Lo schema: «esiste già» è atteso (l'impalcatura ha già auth e storage), il resto no. Lo schema non ha dati: si può dire.
errori=$(psql -d "$db" -f "$cartella/schema.sql" 2>&1 >/dev/null | grep -i 'error' | grep -vi 'already exists' || true)
if [ -n "$errori" ]; then
  echo "✗ lo schema non si rimette a posto:"
  echo "$errori" | sed 's/^/    /' | head -20
  exit 1
fi

# I dati: auth.users non è nella copia (lo gestisce Supabase), quindi le righe che la puntano non passerebbero i
# controlli di chiave esterna; qui si guardano le righe, non i collegamenti. Dei guai si dice quanti, non cosa.
guai=$(psql -d "$db" -c 'set session_replication_role = replica' -f "$cartella/dati.sql" 2>&1 >/dev/null | grep -ci 'error' || true)
if [ "$guai" != 0 ]; then
  echo "✗ i dati non si rimettono a posto: $guai errori (il testo non si stampa: i log sono pubblici; rilancia in locale con la password)"
  exit 1
fi

conta() { psql -d "$db" -At -c "select count(*) from public.$1"; }
persone=$(conta persone)
echo "Righe rimesse a posto:"
for t in persone iscrizioni presenze ricevute; do echo "  $t: $(conta $t)"; done
[ "$persone" -gt 0 ] || { echo "✗ nessuna persona: la copia è vuota o non si è letta"; exit 1; }

if [ -n "$certificati" ]; then
  echo "  file dei certificati: $(find "$certificati" -type f | wc -l | tr -d ' ')"
fi
echo "✓ la copia si rimette a posto"
