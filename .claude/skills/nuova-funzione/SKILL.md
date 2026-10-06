---
name: nuova-funzione
description: Use when starting a new feature, a change in behavior or a bug fix in ODS Corsi that goes beyond a one-line edit, from a user request or a segnalazione.
---

# Nuova funzione

Dalla richiesta alla PR, con il team di agenti in `.claude/agents/`. Ogni
passo ha la sua condizione: se non vale, si salta, e si dice perché in una
riga.

## Il flusso

| # | Passo | Chi | Quando |
|---|---|---|---|
| 1 | Le regole e i criteri di accettazione | `analista-palestra` | sempre |
| 2 | «È questo che mi serve?» sulle regole | `cliente-ods` | se cambia qualcosa che qualcuno vede o fa |
| 3 | Le DOMANDE dei passi 1–2 | l'utente | se ce ne sono: si chiede prima di andare avanti |
| 4 | La proposta di design, partendo dalla libreria | Claude, con `/design` | se cambia qualcosa che si vede |
| 5 | La discussione sul design | l'utente | dopo il 4: si ritocca finché dice sì. Niente prove né codice prima |
| 6 | Le prove, rosse per il motivo giusto | `scrittore-prove` | se c'è una regola o un problema da correggere |
| 7 | Il codice, finché le prove passano, fedele al design approvato | Claude, con `nuova-migrazione` se cambia `supabase/` | sempre |
| 8 | Le revisioni, **in parallelo** | `revisore-codice` sempre; `rls-reviewer` se cambia `supabase/`; `custode-dati` se cambia `src/lib` o una regola; `designer-ods` se cambia un `.tsx` o `styles.css` | dopo il 7 |
| 9 | Le correzioni dei DA FARE / GRAVE / BLOCCA | Claude, poi di nuovo `scrittore-prove` (verde) | se ce ne sono |
| 10 | L'app in prova, da rompere | `collaudatore` | se cambia qualcosa che si vede |
| 11 | La prova in prima persona | `cliente-ods` | se cambia qualcosa che si vede |
| 12 | Il design aggiornato: la libreria dice com'è l'app adesso | Claude | se è cambiato qualcosa che si vede |
| 13 | Prove, guida, titolo, PR | skill `chiudi-lavoro` | sempre |

## Il design

**Proposta (4).** Si parte da `docs/design-canvas/ods-design-system/`, mai da
zero: si copia `Pagina.dc.html` o `PaginaTelefono.dc.html` e si importano i
componenti (vedi il README della libreria). Il canvas della funzione sta in
`docs/design-canvas/<nome>/` e mostra com'è oggi (se la schermata esiste già)
e la proposta, affiancati; `unico.mjs` lo mette, come pagina, nel canvas unico. Un componente che manca si aggiunge prima alla
libreria. Prima di mostrarlo: `node docs/design-canvas/ods-design-system/verifica.mjs`.
Si pubblica il canvas unico (vedi sotto) e si dà il link all'utente.

**Discussione (5).** Ogni giro di correzioni aggiorna il canvas, non resta a
parole. Il design è approvato quando l'utente lo dice: le prove e il codice
partono da quel punto, e un cambio di design dopo si discute di nuovo.

**Aggiornamento (12).** A funzione finita la libreria deve descrivere l'app
com'è, non com'era la proposta: i componenti nuovi o cambiati entrano nella
libreria (`<Nome>.dc.html`, valori copiati dal codice, riga nella tabella del
README), i token cambiati in `src/styles.css` o `DESIGN.md` si ripetono nei
file che li usano, la cornice (`Pagina*.dc.html`) segue il menu e la testata
veri. Se il costruito ha scartato qualcosa dell'approvato, vince il costruito.
Poi `verifica.mjs` e si ripubblica il canvas unico. Il canvas della funzione
resta come storia; quello che vale è la libreria.

**Il canvas unico.** La libreria e tutte le sezioni stanno in un solo Artifact,
una pagina per sezione, per consultarle insieme. Lo costruisce
`node docs/design-canvas/unico.mjs <cartella>` (una sezione nuova si aggiunge
a `SEZIONI` nello script) e si pubblica sullo stesso Artifact di sempre, con
`files.json` come elenco dei file.

## Come si passano il lavoro

- Ogni agente riceve la richiesta in una riga e l'uscita dei passi che gli
  servono, non tutta la conversazione: al 2 le REGOLE e i CASI, al 6 i
  criteri di ACCETTAZIONE, all'8 e al 10 anche i criteri, all'11 la persona
  giusta («la segreteria», «un istruttore», «un genitore»).
- Un problema trovato dopo il 7 diventa prima una prova (`scrittore-prove`),
  poi una correzione.
- I DA VALUTARE, i MEDI e le NOTE non bloccano: vanno nella descrizione della
  PR, e l'utente decide.
- Il collaudatore e il cliente usano il browser uno dopo l'altro, non insieme:
  il riquadro è uno solo.

## Errori comuni

- Scrivere codice prima che l'utente abbia approvato il design.
- Disegnare una schermata da zero invece di partire dalla libreria.
- Chiudere senza il 12: la libreria resta indietro e la proposta dopo parte da un'app che non c'è più.
- Saltare il 2 «perché è chiaro»: il cliente serve proprio quando sembra
  chiaro a chi sviluppa.
- Inventare la risposta a una DOMANDA invece di chiederla all'utente.
- Prove scritte dopo il codice: passano subito e non dimostrano niente.
- Lanciare gli agenti dell'8 uno alla volta: sono indipendenti.
