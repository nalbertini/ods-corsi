---
name: nuova-migrazione
description: Use when adding a new numbered SQL file under supabase/ (NN-nome.sql), or changing an existing one: new table, column, policy, function or trigger on the Supabase database of ODS Corsi.
---

# Nuova migrazione

Una migrazione qui non è solo il file SQL: Supabase non tiene il conto di
cosa è stato lanciato, quindi lo tengono `LEGGIMI.md`, `controllo.sql` e le
prove. Un pezzo dimenticato è un database vero che resta indietro senza che
nessuno se ne accorga.

## I file, tutti

| File | Cosa ci va |
|---|---|
| `supabase/NN-nome.sql` | Il numero dopo l'ultimo. Testata come `25-segnalazioni.sql` (vedi sotto). |
| `supabase/LEGGIMI.md` § 2 | La voce `NN.` nell'elenco in ordine. |
| `supabase/LEGGIMI.md` § 2 | Nel paragrafo «Su un database già in uso»: «Per … basta `NN-nome.sql` (dopo `XX`), che [non] chiede di rilanciare `06-iscrizioni.sql`: finché non c'è, …». |
| `supabase/controllo.sql` | Una riga `('NN-nome.sql', 'cosa', <qualcosa che fa solo lui>)`. Anche quando si cambia un file numerato già esistente: una riga per la cosa nuova. |
| `supabase/prova/nome.sql` | La prova: testata «Si lancia dopo …», `\set ON_ERROR_STOP on`, gli helper `chi`/`tenta`/`atteso` come in `prova/anagrafiche.sql`. Ogni ruolo: segreteria, istruttore, iscritto, tablet, `anon`. |
| `README.md` § «Le prove» | La riga `supabase/prova/nome.sql` nella tabella. |
| `supabase/LEGGIMI.md` § «Provare lo schema senza Supabase» | Una frase sulla prova nuova. |
| `scripts/prova-sql.sh` | Solo se la prova parte dai dati di un'altra: il nome in `prima()`. |

Se la migrazione serve a una funzione dell'app, la modalità prova
(`src/lib/*Prova.ts`) deve rifare le stesse regole, e l'app deve reggere il
«finché non c'è» scritto in LEGGIMI.

## Il file SQL

- Testata: cosa fa, chi può fare cosa, «Si lancia dopo `XX`», se chiede di
  rilanciare `06-iscrizioni.sql`, cosa fa l'app finché non c'è.
- Si deve poter rilanciare: `create table if not exists`, `add column if not
  exists`, `create or replace function`, `drop policy if exists` prima di
  `create policy`, `create or replace trigger`.
- `alter table … enable row level security`, poi `revoke all … from anon,
  authenticated` e solo i `grant` che servono (colonne per `update`).
- Funzioni: `revoke all on function … from public, anon` e `grant execute …
  to authenticated`. Chi tocca i file 01–05 deve rilanciare `06`, che rimette
  i permessi alle funzioni.
- In fondo: `notify pgrst, 'reload schema';`.

## Provare

La CI la lancia su ogni PR, ma si prova prima, in locale. Senza Postgres,
c'è Docker:

```bash
docker run -d --rm --name ods-pg -e POSTGRES_PASSWORD=prova -p 55432:5432 postgres:17
PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH PGHOST=localhost PGPORT=55432 PGUSER=postgres PGPASSWORD=prova npm run prova:sql
docker stop ods-pg
```

Deve finire con `TUTTO A POSTO`, la prova nuova compresa. Poi si rompe un
valore atteso della prova nuova e si rilancia: deve diventare rossa, se no
non sta provando niente.

## Sul database vero

Non si lancia niente sul progetto Supabase senza un sì esplicito
dell'utente. Dopo l'unione, l'utente lancia `NN-nome.sql` (e `06` se serve)
nel SQL Editor, poi `controllo.sql`: la riga nuova deve dire «ok». Con il MCP
di Supabase, dopo, `get_advisors` (security) per le policy mancanti.

## Errori comuni

- Dimenticare la riga nella tabella «Le prove» del README, o in
  `controllo.sql`.
- Una prova che non si è mai vista fallire.
- `create policy` senza `drop policy if exists`: il secondo lancio si rompe.
- Tabella nuova senza `revoke … from anon`: Supabase dà tutto ad `anon`.
