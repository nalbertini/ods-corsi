# ODS Corsi

Il titolo di ogni PR finisce nella pagina Novità dell'app e decide la versione
(vedi «La versione» nel README): `Nuovo: …` per una funzione nuova,
`Risolto: …` per un problema corretto, senza prefisso per il resto. Va scritto
per chi usa l'app, in italiano.

Tutto è in italiano: codice, commenti, commit, guida. I commenti dicono perché.

## Le prove

- `npm run build:tutto`: app e timer, controllo dei tipi compreso.
- `npm run prova:*`: le regole della modalità prova, senza browser.
- `npm run prova:sql`: le prove di `supabase/prova` su un Postgres (variabili
  `PG*`; in locale con Docker, vedi la skill `nuova-migrazione`).

Le stesse girano su ogni PR (`.github/workflows/controlla.yml`).

## Le regole

- La sicurezza sta nel database (RLS, grant, funzioni), non nell'app: la
  chiave anon è pubblica. Un file SQL nuovo o cambiato segue la skill
  `nuova-migrazione` e passa dall'agente `rls-reviewer`.
- Quello che chi usa l'app vede in modo diverso si scrive anche in `guida/`.
  Prima della PR, la skill `chiudi-lavoro`.
- `guida/novita.md` e `version` in `package.json` li scrive
  `scripts/versione.mjs` quando si pubblica: non si toccano.
- Sul database vero non si lancia niente senza un sì dell'utente.
- PR unite con «Create a merge commit»: `versione.mjs` legge il titolo dal
  commit di merge.
