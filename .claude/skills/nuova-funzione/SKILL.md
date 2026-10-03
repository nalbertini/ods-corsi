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
| 4 | Le prove, rosse per il motivo giusto | `scrittore-prove` | se c'è una regola o un problema da correggere |
| 5 | Il codice, finché le prove passano | Claude, con `nuova-migrazione` se cambia `supabase/` | sempre |
| 6 | Le revisioni, **in parallelo** | `revisore-codice` sempre; `rls-reviewer` se cambia `supabase/`; `custode-dati` se cambia `src/lib` o una regola; `designer-ods` se cambia un `.tsx` o `styles.css` | dopo il 5 |
| 7 | Le correzioni dei DA FARE / GRAVE / BLOCCA | Claude, poi di nuovo `scrittore-prove` (verde) | se ce ne sono |
| 8 | L'app in prova, da rompere | `collaudatore` | se cambia qualcosa che si vede |
| 9 | La prova in prima persona | `cliente-ods` | se cambia qualcosa che si vede |
| 10 | Prove, guida, titolo, PR | skill `chiudi-lavoro` | sempre |

## Come si passano il lavoro

- Ogni agente riceve la richiesta in una riga e l'uscita dei passi che gli
  servono, non tutta la conversazione: al 2 le REGOLE e i CASI, al 4 i
  criteri di ACCETTAZIONE, al 6 e all'8 anche i criteri, al 9 la persona
  giusta («la segreteria», «un istruttore», «un genitore»).
- Un problema trovato dopo il 5 diventa prima una prova (`scrittore-prove`),
  poi una correzione.
- I DA VALUTARE, i MEDI e le NOTE non bloccano: vanno nella descrizione della
  PR, e l'utente decide.
- Il collaudatore e il cliente usano il browser uno dopo l'altro, non insieme:
  il riquadro è uno solo.

## Errori comuni

- Saltare il 2 «perché è chiaro»: il cliente serve proprio quando sembra
  chiaro a chi sviluppa.
- Inventare la risposta a una DOMANDA invece di chiederla all'utente.
- Prove scritte dopo il codice: passano subito e non dimostrano niente.
- Lanciare gli agenti del 6 uno alla volta: sono indipendenti.
