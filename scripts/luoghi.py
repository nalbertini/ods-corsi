"""
I luoghi di nascita del codice fiscale: il codice catastale e il nome.

    python3 scripts/luoghi.py ANPR_archivio_comuni.csv tabella_2_statiesteri.xlsx

I due file sono le tabelle di decodifica dell'ANPR
(https://www.anagrafenazionale.interno.it/area-tecnica/tabelle-di-decodifica/):
l'archivio dei comuni, anche quelli che non ci sono più, e gli stati esteri.
Scrive `src/lib/luoghi.json`, che il modulo carica quando serve, e
`supabase/16-luoghi.sql`, gli stessi dati per `invia_iscrizione`. Si rilancia
quando l'ANPR aggiorna le tabelle (un comune nuovo, una fusione).

Un codice può avere più nomi nel tempo (ABANO, poi ABANO TERME): si tengono
tutti, con la data in cui ognuno ha smesso di valere, così chi è nato prima
del cambio ha il nome di allora.

Serve `openpyxl` (pip install openpyxl) per leggere il file degli stati.
"""
import csv
import json
import sys
from pathlib import Path

import openpyxl

RADICE = Path(__file__).resolve().parent.parent
SEMPRE = '9999-12-31'

comuni_csv, stati_xlsx = sys.argv[1:3]
voci = {}  # codice -> [(al, nome, sigla)]

with open(comuni_csv, encoding='utf-8') as f:
    for r in csv.DictReader(f):
        voci.setdefault(r['CODCATASTALE'], []).append((r['DATACESSAZIONE'], r['DENOMINAZIONE_IT'].strip(), r['SIGLAPROVINCIA'].strip()))

righe = list(openpyxl.load_workbook(stati_xlsx, read_only=True).active.iter_rows(values_only=True))
colonna = {k: i for i, k in enumerate(righe[0])}
for r in righe[1:]:
    codice = r[colonna['CODAT']]
    if not codice:
        continue
    g, m, a = str(r[colonna['DATAFINEVALIDITA']])[:10].split('/')
    voci.setdefault(codice, []).append((f'{a}-{m}-{g}', r[colonna['DENOMINAZIONE']].strip(), 'EE'))

# Per ogni codice, in ordine di fine; due periodi di fila con lo stesso nome
# e la stessa provincia diventano uno.
elenco = {}
for codice in sorted(voci):
    tenuti = []
    for al, nome, sigla in sorted(voci[codice]):
        if tenuti and tenuti[-1][1:] == (nome, sigla):
            tenuti[-1] = (al, nome, sigla)
        else:
            tenuti.append((al, nome, sigla))
    elenco[codice] = [[nome, sigla] + ([] if al == SEMPRE else [al]) for al, nome, sigla in tenuti]

(RADICE / 'src/lib/luoghi.json').write_text(json.dumps(elenco, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

q = lambda s: "'" + s.replace("'", "''") + "'"
valori = ',\n'.join(
    f"({q(codice)}, {q(nome)}, {q(sigla)}, {q(v[2]) if len(v) > 2 else 'null'})"
    for codice, vv in elenco.items() for v in vv for nome, sigla in [v[:2]]
)
(RADICE / 'supabase/16-luoghi.sql').write_text(f"""-- I luoghi di nascita del codice fiscale: generato da `scripts/luoghi.py`
-- dalle tabelle dell'ANPR, non si cambia a mano. Si rilancia quando serve:
-- svuota la tabella e la riempie di nuovo. La tabella e chi la legge stanno
-- in `06-iscrizioni.sql`.
begin;
truncate luoghi_nascita;
insert into luoghi_nascita (codice, nome, sigla, al) values
{valori};
commit;
""", encoding='utf-8')

print(f'{len(elenco)} codici, {sum(map(len, elenco.values()))} nomi')
