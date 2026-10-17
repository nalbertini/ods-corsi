#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Manda il sito generato nel repository del sito (quello da cui lo serve GitHub Pages).
#
#   scripts/pubblica-sito.sh <sito-generato> <repository-del-sito>
#
# Copia i file generati nel repository (quello che non c'è più nelle pagine
# sparisce anche dal sito) e, solo se qualcosa è cambiato, fa un commit e lo
# spinge. Mai un sito vuoto o a metà: senza la home nella cartella generata non
# fa niente e finisce con un errore, così il sito di prima resta com'è.
#
# Lo lancia `.github/workflows/sito.yml`; si prova in `scripts/prova-sito-pubblica.mjs`.
# ---------------------------------------------------------------------------
set -euo pipefail

errore() {
  echo "✗ $1" >&2
  exit 1
}

generato="${1:-}"
repo="${2:-}"
[ -n "$generato" ] && [ -n "$repo" ] || errore "Uso: scripts/pubblica-sito.sh <sito-generato> <repository-del-sito>"
[ -d "$generato" ] || errore "La cartella del sito generato «$generato» non c'è."
[ -f "$generato/index.html" ] || errore "Nel sito generato manca index.html (la home): non pubblico un sito vuoto o a metà."
[ -e "$repo/.git" ] || errore "«$repo» non è un repository: non ci copio niente."
[ "$(cd "$generato" && pwd -P)" != "$(cd "$repo" && pwd -P)" ] || errore "Il sito generato e il repository del sito sono la stessa cartella."

# Quello che è sparito dalle pagine sparisce dal sito; la cartella .git del repository non si tocca.
rsync -a --delete --exclude=.git "$generato"/ "$repo"/

cd "$repo"
git add -A
if git diff --cached --quiet; then
  echo "Niente da pubblicare: il sito è già com'è."
  exit 0
fi
git -c user.name="ODS Corsi" -c user.email="ods-corsi@users.noreply.github.com" commit -q -m "Il sito aggiornato dalle pagine pubblicate"
git push -q origin HEAD
echo "✓ Sito pubblicato."
