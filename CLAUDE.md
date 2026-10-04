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

## Il codice

- **Prima la prova.** Una regola nuova o un problema da correggere comincia
  da una prova che fallisce per il motivo giusto, poi il codice che la fa
  passare. Lato app in `scripts/prova-<area>.mjs` (`ok(cosa, avuto,
  voluto)`), lato database in `supabase/prova/*.sql` (`atteso`). Una prova
  non si ammorbidisce per farla passare.
- **La logica sta in `src/lib`**, in funzioni che si provano senza browser.
  I componenti mostrano e chiamano. Una regola dentro un `.tsx` non si prova.
- **Si usa quel che c'è**: i componenti di `ds.tsx` e `comune.tsx`, le
  funzioni di `src/lib`, la piattaforma. Nessuna dipendenza nuova senza un sì
  dell'utente.
- TypeScript `strict`: niente `any`, né `as` o `@ts-ignore` senza un commento
  che dice perché.
- Nomi in italiano con le parole della palestra (appello, prove, sostituto,
  quota), gli stessi in SQL, TypeScript e guida.
- I messaggi d'errore sono per chi usa l'app: dicono cosa fare, mai il testo
  grezzo dell'API.
- Una cosa per PR, il diff più corto che la fa. Niente riscritture non
  chieste, niente codice «per dopo».

## Le regole

- Una funzione nuova, un cambio di comportamento o un problema da correggere
  segue la skill `nuova-funzione`, col team di agenti di `.claude/agents/`.
- La sicurezza sta nel database (RLS, grant, funzioni), non nell'app: la
  chiave anon è pubblica. Un file SQL nuovo o cambiato segue la skill
  `nuova-migrazione` e passa dall'agente `rls-reviewer`.
- Quello che chi usa l'app vede in modo diverso si scrive anche in `guida/`.
  Prima della PR, la skill `chiudi-lavoro`.
- `guida/novita.md` e `version` in `package.json` li scrive
  `scripts/versione.mjs` quando si pubblica: non si toccano.
- Sul database vero non si lancia niente senza un sì dell'utente.
- Ogni mockup fatto con `/design` parte dalla libreria in
  `docs/design-canvas/ods-design-system/`, mai da artboard disegnate da zero:
  si copia `Pagina.dc.html` o `PaginaTelefono.dc.html` e si importano i
  componenti con `<dc-import>`. Un componente mancante si aggiunge alla
  libreria come `.dc.html`, copiando i valori dal codice. Se cambia un token
  (`src/styles.css`, `DESIGN.md`) o un componente, si aggiorna il file
  corrispondente nello stesso commit. Prima di pubblicare:
  `node docs/design-canvas/ods-design-system/verifica.mjs`.
- PR unite con «Create a merge commit»: `versione.mjs` legge il titolo dal
  commit di merge.
- Ogni PR ha l'Auto-fix acceso, e si unisce da sé appena le prove su GitHub
  sono verdi e non ci sono conflitti: il sì dell'utente c'è già. Tranne
  quando cambia `supabase/`: lì si aspetta che l'utente abbia lanciato i file
  sul database vero, se no l'app pubblicata cerca cose che non ci sono.
