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
- I percorsi critici della palestra (iscrizioni, quote, presenze, certificati,
  ricevute, backup) stanno in `docs/qa/percorsi-critici.md`, con le prove che
  li coprono. Un problema corretto lascia una prova che non lo fa tornare;
  l'agente `garante-qualita` lo controlla prima della PR.
- La sicurezza sta nel database (RLS, grant, funzioni), non nell'app: la
  chiave anon è pubblica. Un file SQL nuovo o cambiato segue la skill
  `nuova-migrazione` e passa dall'agente `rls-reviewer`.
- Quello che chi usa l'app vede in modo diverso si scrive anche in `guida/`.
  Prima della PR, la skill `chiudi-lavoro`.
- `guida/novita.md` e `version` in `package.json` li scrive
  `scripts/versione.mjs` quando si pubblica: non si toccano.
- Sul database vero i file SQL di una PR li lancia Claude, prima di unirla: il sì dell'utente
  c'è già (regola data il 2026-10-18). Ogni altra scrittura sul database vero
  (dati, cancellazioni, cose fuori dalla PR) resta con il sì dell'utente.
- Una funzione che cambia qualcosa che si vede parte dal design: proposta in
  un canvas che parte dalla libreria, discussione con l'utente, solo dopo
  prove e codice, e a fine lavoro la libreria aggiornata (skill
  `nuova-funzione`, passi 3, 4 e 10).
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
  quando cambia `supabase/`: lì prima si lanciano i file sul database vero
  (li lancia Claude), se no l'app pubblicata cerca cose che non ci sono.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Agent skills

### Issue tracker

Le issue stanno su GitHub (`nalbertini/ods-corsi`), con `gh`. Vedi `docs/agents/issue-tracker.md`.

### Triage labels

Etichette predefinite: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Vedi `docs/agents/triage-labels.md`.

### Domain docs

Single-context: un `GLOSSARY.md` e `docs/adr/` alla radice. Vedi `docs/agents/domain.md`.
