---
name: chiudi-lavoro
description: Use when work on a branch of ODS Corsi is done and about to be committed or turned into a pull request, or when the user says «chiudi», «apri la PR», «fai la PR».
---

# Chiudi il lavoro

Una PR qui arriva a chi usa l'app: il titolo finisce nella pagina Novità,
la guida si legge dentro l'app, e quello che si unisce a `main` si pubblica
da sé. Prima di aprirla, queste quattro cose, in ordine.

## 1. Le prove, tutte

```bash
npm run build:tutto
for s in $(node -p "Object.keys(require('./package.json').scripts).filter((s) => s.startsWith('prova:') && s !== 'prova:sql').join(' ')"); do npm run -s $s >/dev/null 2>&1 || echo "✗ $s"; done
```

Se è cambiato qualcosa in `supabase/`, anche `npm run prova:sql` (i comandi
con Docker sono nella skill `nuova-migrazione`). Un comportamento nuovo
dell'app ha il suo caso nello script `scripts/prova-*.mjs` della sua area, che
prova la modalità prova (`src/lib/*Prova.ts`).

Se è cambiato qualcosa che si vede, anche `node docs/design-canvas/ods-design-system/verifica.mjs`:
la libreria deve già descrivere l'app com'è ora (`nuova-funzione`, passo 12).

## 2. Il database

File numerati in `supabase/` nuovi o cambiati: **REQUIRED SUB-SKILL:**
`nuova-migrazione`, e controllare che ci sia tutto quello che elenca.

## 3. La guida

Per ogni cosa che chi usa l'app vede in modo diverso (un tasto, una voce,
una regola):

| Cosa è cambiato | Dove si scrive |
|---|---|
| Una voce del menu della segreteria | `guida/segreteria/<voce>.md` |
| Una voce nuova della segreteria | la sua pagina, e la riga nella tabella di `guida/segreteria/README.md` |
| Istruttori, sala, iscrizioni, area iscritti | `guida/istruttori.md`, `sala.md`, `iscrizioni.md`, `iscritti.md` |
| Una cosa che vale per tutte le voci di un'area | una volta sola, nella pagina dell'area (es. `guida/segreteria/README.md`), non ripetuta in ogni voce |
| Una funzione nuova | due righe in «Cosa fa oggi» del `README.md` |

I nomi di tasti e voci si scrivono in **MAIUSCOLO**, come nell'app. Non si
toccano `guida/novita.md` né `version` in `package.json`: li scrive
`scripts/versione.mjs` quando si pubblica.

## 4. Il titolo e la descrizione

Titolo in italiano, per chi usa l'app, con quello che cambia per lui:

| Cos'è | Titolo |
|---|---|
| Una cosa che prima l'app non faceva | `Nuovo: …` |
| Una cosa che non andava e ora va | `Risolto: …` |
| Tutto il resto, anche il lavoro interno | senza prefisso |

Una PR che fa due cose prende il prefisso della più grossa. Esempio:
`Nuovo: il kanji di ogni istruttore, come un timbro accanto al nome`, non
«Aggiunge colonna kanji a persone».

La descrizione: cosa cambia e per chi; **Sul database**, se c'è, i file da
lanciare dopo l'unione e se va rilanciato `06-iscrizioni.sql`; **Prove**,
quelle lanciate e il loro esito; **Guida**, le pagine toccate.

Dopo la PR: legarla alla sessione e accendere l'Auto-fix. Appena le prove su
GitHub sono verdi e non ci sono conflitti, unirla con `gh pr merge --merge`
(l'auto-merge di GitHub è spento nel repo). Se la PR cambia `supabase/`, si
unisce solo dopo che l'utente ha detto di aver lanciato i file sul database.
