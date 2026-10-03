#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tutte le prove SQL di supabase/prova, ognuna su un database suo.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=… npm run prova:sql
#
# Serve un Postgres qualunque e `psql`; il database lo legge dalle solite
# variabili PG*. Una volta sola costruisce `prova_base` (finto-supabase.sql e
# tutti i file numerati dello schema), poi per ogni prova ne fa una copia,
# lancia prima le prove di cui usa i dati e poi lei. Una prova nuova in
# supabase/prova entra da sé; se si appoggia a un'altra, va aggiunta in `prima`.
#
# Lo lancia anche `.github/workflows/controlla.yml` su ogni PR.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

psql() { command psql -q -X -v ON_ERROR_STOP=1 "$@"; }

# Le prove che partono dai dati lasciati da un'altra (lo dicono in testa).
prima() {
  case $1 in
    presenze-istruttori | prove) echo tablet ;;
    istruttori-dalle-lezioni) echo tablet presenze-istruttori ;;
    timer-lezioni) echo timer ;;
  esac
}

dropdb --if-exists prova_base 2>/dev/null
createdb prova_base
for f in supabase/prova/finto-supabase.sql supabase/[0-9][0-9]-*.sql; do
  psql -d prova_base -f "$f" >/dev/null 2>&1 || { echo "✗ lo schema non si carica: $f"; psql -d prova_base -f "$f" >/dev/null; exit 1; }
done

guai=0
for f in supabase/prova/*.sql; do
  nome=$(basename "$f" .sql)
  [ "$nome" = finto-supabase ] && continue
  dropdb --if-exists prova 2>/dev/null
  createdb -T prova_base prova
  esito=0
  for p in $(prima "$nome") "$nome"; do
    errori=$(psql -d prova -c 'set client_min_messages = warning' -f "supabase/prova/$p.sql" 2>&1 >/dev/null) || { esito=1; break; }
  done
  if [ $esito = 0 ]; then echo "  ✓ $nome"; else echo "  ✗ $nome"; echo "$errori" | sed 's/^/      /'; guai=$((guai + 1)); fi
done
dropdb --if-exists prova 2>/dev/null
dropdb --if-exists prova_base 2>/dev/null

if [ $guai = 0 ]; then echo; echo 'TUTTO A POSTO'; else echo; echo "$guai COSE NON TORNANO"; exit 1; fi
