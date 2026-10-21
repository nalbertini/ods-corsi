---
name: nuova-funzione
description: Use when starting a new feature, a change in behavior or a bug fix in ODS Corsi that goes beyond a one-line edit, from a user request or a segnalazione.
---

# Nuova funzione

Dalla richiesta alla PR, con il team di agenti in `.claude/agents/`. Ogni
passo ha la sua condizione: se non vale, si salta, e si dice perché in una
riga. Ogni giro in più costa un'attesa all'utente: il flusso ne prevede una
sola prima del codice e un solo giro di correzioni dopo.

## La corsia

La sceglie l'analista al passo 1, e la dice in testa alle regole. Quando la
richiesta è già chiaramente piccola, la sceglie Claude, e scrive lui le regole.

| Corsia | Quando | Passi |
|---|---|---|
| piccola | niente che si vede, nessun file in `supabase/` | 1 (Claude, senza analista), 5, 6, 8 (un agente solo: `garante-qualita` per un problema corretto, se no `revisore-codice`), 9, 11 |
| media | cambia una regola in `src/lib` o in `supabase/`, ma niente che si vede | 1, 5, 6, 8, 9, 11 |
| grande | cambia qualcosa che qualcuno vede o fa | tutti |

Nel dubbio la corsia più grande. Se a metà lavoro la corsia cresce (spunta
una schermata, un file SQL), si fanno i passi che mancano, e si dice.

## Il flusso

| # | Passo | Chi | Quando |
|---|---|---|---|
| 1 | Le regole, i criteri di accettazione e la corsia | `analista-palestra` | sempre |
| 2 | «È questo che mi serve?» sulle regole | `cliente-ods` | corsia grande |
| 3 | La proposta di design, partendo dalla libreria | Claude, con `/design` | se cambia qualcosa che si vede |
| 4 | **Una fermata sola**: le DOMANDE dei passi 1–2 e il canvas, insieme | l'utente | se ci sono domande o un canvas. Si ritocca finché dice sì. Niente prove né codice prima |
| 5 | Le prove, rosse per il motivo giusto | `scrittore-prove` | se c'è una regola o un problema da correggere |
| 6 | Il codice, finché le prove passano, fedele al design approvato | Claude, con `nuova-migrazione` se cambia `supabase/` | sempre |
| 7 | L'app in prova: prima da rompere, poi in prima persona | `collaudatore`, poi `cliente-ods` solo se al 2 ha avuto dubbi | se cambia qualcosa che si vede |
| 8 | Le revisioni, **tutte in parallelo** | `revisore-codice` e `garante-qualita` sempre; `rls-reviewer` se cambia `supabase/`; `custode-dati` se cambia `src/lib` o una regola; `designer-ods` se cambia un `.tsx` o `styles.css` | dopo il 6 e il 7 |
| 9 | **Un solo giro** di correzioni dei DA FARE / GRAVE / BLOCCA dei passi 7–8 | Claude | se ce ne sono |
| 10 | Il design aggiornato: la libreria dice com'è l'app adesso | Claude | se è cambiato qualcosa che si vede |
| 11 | Prove (tutte, una volta), guida, titolo, PR | skill `chiudi-lavoro` | sempre |

## Il design

**Proposta (3).** Si parte da `docs/design-canvas/ods-design-system/`, mai da
zero: si copia `Pagina.dc.html` o `PaginaTelefono.dc.html` e si importano i
componenti (vedi il README della libreria). Il canvas della funzione sta in
`docs/design-canvas/<nome>/` e mostra com'è oggi (se la schermata esiste già)
e la proposta. Un componente che manca si aggiunge prima alla
libreria. Prima di mostrarlo: `node docs/design-canvas/ods-design-system/verifica.mjs`.
La proposta si pubblica in un **canvas suo**, un Artifact nuovo di tipo Design
con solo le schermate della proposta e i componenti che importa: mai nel canvas
unico, che con centinaia di schermate di altri lavori non si riesce a leggere
(deciso dall'utente il 2026-10-21). Si dà il link di quel canvas.

**Discussione (4).** Ogni giro di correzioni aggiorna il canvas, non resta a
parole. Il design è approvato quando l'utente lo dice: le prove e il codice
partono da quel punto, e un cambio di design dopo si discute di nuovo.

**Aggiornamento (10).** A funzione finita la libreria deve descrivere l'app
com'è, non com'era la proposta: i componenti nuovi o cambiati entrano nella
libreria (`<Nome>.dc.html`, valori copiati dal codice, riga nella tabella del
README), i token cambiati in `src/styles.css` o `DESIGN.md` si ripetono nei
file che li usano, la cornice (`Pagina*.dc.html`) segue il menu e la testata
veri. Se il costruito ha scartato qualcosa dell'approvato, vince il costruito.
Poi `verifica.mjs` e si ripubblica il canvas unico. Il canvas della funzione
resta come storia; quello che vale è la libreria.

**Il canvas unico.** Solo per la libreria e l'archivio di quel che è costruito,
mai per una proposta in discussione. La libreria e tutte le sezioni stanno in un solo Artifact,
le sezioni nella pagina Archivio, ordinate per area, per consultarle insieme. Lo costruisce
`node docs/design-canvas/unico.mjs <cartella>` (una sezione nuova si aggiunge
a `SEZIONI` nello script) e si pubblica sullo stesso Artifact di sempre, con
`files.json` come elenco dei file.

## Come si passano il lavoro

- Ogni agente riceve la richiesta in una riga e l'uscita dei passi che gli
  servono, non tutta la conversazione: al 2 le REGOLE e i CASI, al 5 i
  criteri di ACCETTAZIONE, al 7 e all'8 anche i criteri, al cliente del 7 la
  persona giusta («la segreteria», «un istruttore», «un genitore»).
- Il collaudo (7) viene prima delle revisioni (8): le revisioni guardano il
  codice con dentro quel che il browser ha trovato, e non si rifanno.
- Al 9 una correzione che cambia una regola porta con sé la sua prova
  (prima rossa, poi il codice), ma non si rilanciano gli agenti dell'8 né lo
  `scrittore-prove`: le prove le rilancia `chiudi-lavoro`.
- Quel che resta dopo il 9, e i DA VALUTARE, i MEDI e le NOTE, va nella
  descrizione della PR, e l'utente decide. Un secondo giro si fa solo se lo
  chiede l'utente, o per un BLOCCA (sicurezza, un dato che si perde).
- Il collaudatore e il cliente usano il browser uno dopo l'altro, non insieme:
  il riquadro è uno solo.

## Errori comuni

- Scrivere codice prima che l'utente abbia approvato il design.
- Disegnare una schermata da zero invece di partire dalla libreria.
- Chiudere senza il 10: la libreria resta indietro e la proposta dopo parte da un'app che non c'è più.
- Saltare il 2 «perché è chiaro»: il cliente serve proprio quando sembra
  chiaro a chi sviluppa.
- Inventare la risposta a una DOMANDA invece di chiederla all'utente.
- Prove scritte dopo il codice: passano subito e non dimostrano niente.
- Lanciare gli agenti dell'8 uno alla volta: sono indipendenti.
- La corsia grande per una correzione che non si vede, o un secondo giro di
  revisioni non chiesto: giri in più che l'utente aspetta.
- Fermare l'utente due volte prima del codice: domande e canvas vanno insieme.
