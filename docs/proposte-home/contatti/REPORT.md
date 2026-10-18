# Contatti: ciclo di miglioramento (proposta)

Data: 2026-10-18. **Solo proposta**: niente in `src/`, `supabase/`, sul sito vero o sul database; niente commit, PR o upload su Supabase.

| Parte | Dove |
|---|---|
| Audit (15 problemi, 4 alti) | `audit/REPORT.md`, screenshot in `audit/img/` |
| Foto e mappa | `foto/REPORT.md` (`sviluppate/`, `photocraft/`, `img/confronto.jpg`) |
| Testi, percorso «prova una settimana», domande | `testi/REPORT.md` |
| Mockup da approvare | `docs/design-canvas/contatti-miglioramenti/` (4 tavole, `anteprima-*.html`, `shot/`, README) |
| Componenti nuovi | `docs/design-canvas/ods-design-system/` → `SitoRecapito`, `SitoMappa`, `SitoArrivo` |

## Decisioni dell'utente applicate (18 ottobre 2026)

Nessuna riga orari (C1) · WhatsApp sul 346 329 2786 (C2) · due pulsanti: «Prova una settimana a 5 €» → modulo online, «Scrivici» → WhatsApp (D9); prova per tutte le età dai 3 anni, solo la settimana, nessuna lezione singola (D12) · «vicino alla metro Fermi» confermato senza minuti (C4) · liberatorie ok per tutte le foto · nessuna foto di ingresso: due foto. Canvas, anteprime e screenshot rigenerati. **Ancora aperte: C3, C5, C6, C7.** Le «cose da sapere» qui sotto sono quelle del primo giro: dove contraddicono, vale questa sezione.

## Le cose da sapere (primo giro)

1. **Mancano gli orari.** Nessun orario in pagina: la proposta ha la riga «Quando trovarci» con il dato da confermare (C1).
2. **La pagina non porta alla prova.** In fondo «PROVA» a 200 px senza verbo; sul telefono la testata dice solo «Prova». Proposta: pulsante «Prova una settimana a 5 €» in cima e «Una settimana per scegliere» con tre modi: **online** (opzione, da decidere: il modulo di ODS Corsi c'è dal 2 ottobre 2026, il pulsante di oggi punta già a `app.officinedellosport.it/iscrizioni/`), **telefono**, **in sede**. Collegato a D9 e D10 della home.
3. **«A pochi metri dalla metro Fermi» non è verificato**: la mappa non mostra la stazione. «Fermata Fermi, Linea 1» è un fatto pubblico («capolinea» tolto: può cambiare); i minuti a piedi sono C4. La frase resta solo se confermata.
4. **Foto:** la libreria LightCraft non ha nessuna foto dell'ingresso o dell'esterno. L'app era saturata dalle altre sessioni: ho letto in sola lettura il catalogo su disco e guardato 118 scatti in 3 cartelle; ne ho sviluppati 5 a confronto (LightCraft vs PhotoCraft: 5 a 0 LightCraft), **nessuno è meglio delle due foto già approvate**. Proposta: lezione + sala + posto per «L'ingresso di Via Sassi» (da scattare, senza persone). Cubi tolta (morbida, minore).
5. **Bersagli e mappa:** telefono 39 px → tessera intera con azione da 48 px; mappa con `width`/`height`, frase sulla metro fuori dall'immagine.
6. **Minorenni e liberatorie: segnalati, non decisi** (lezione in fila: ragazzi di spalle con «…ITA» leggibile; cubi: volto fuori campo; `avv-0018` ha minori riconoscibili e non è usata).

## Domande aperte

**Aperte:** C3 pagina Facebook `ilCentroJudo` giusta? · C5 parcheggio · C6 chi scatta la foto dell'ingresso (non c'è, per ora due foto) · C7 «Via Sassi» o «Via Vittorio Sassi». Chiuse dall'utente: C1, C2, C4, D9, D10, D12.

## Controlli

- `node docs/design-canvas/ods-design-system/verifica.mjs` → «tutto in regola».
- Anteprime: `node docs/design-canvas/contatti-miglioramenti/rendi.mjs`.

## Revisione di design-reviewer-ods

Primo giro (agente generico con il ruolo di `.claude/agents/design-reviewer-ods.md`: l'agente nominato non era visibile a questa sessione). Verifica: `verifica.mjs` «tutto in regola»; targhetta della mappa dentro il riquadro a 375; azioni 48 px, pulsanti 56 px; nessun colore fuori palette.
**Verdetti:** 1440 e 375 «approvato con riserve»; `SitoRecapito`/`SitoArrivo` approvati; `SitoMappa`, testi e foto «approvato con riserve». Non guardati: 768, tema scuro, tastiera, peso reale.

Corretti:
- **BLOCCA** piede «vicino alla metro Fermi» (condiviso con la home) senza cartellino → cartellino C4 sopra il piede; decisione da prendere una volta per home e Contatti.
- **DA FARE** cartellino D9/D12 sull'intro della prova; C7 (via) su tessera Indirizzo e nel README; «fino alla porta» → «fino a Via Sassi 26»; «capolinea» tolto (resta «fermata Fermi, Linea 1»); cartellini di liberatoria (minori, adulti) sulle due foto.

Restano aperti, da decidere: il pulsante di prova viene prima del telefono (D9); la riga «In auto» è corta (6 parole) finché C5 è vuoto; la fila di foto ha un buco se C6 non arriva (serve un layout a due foto); la foto «sala» taglia un'allieva a destra e ha adulti riconoscibili (liberatoria); i cartellini sono solo del canvas, non vanno nel codice.

### Seconda revisione (dopo le decisioni dell'utente)

Nessun BLOCCA; 1440 e 375 «approvato con riserve». Verifica: `verifica.mjs` «tutto in regola»; restano solo i cartellini C3, C5, C7. Corretti (DA FARE): «Il pulsante in alto porta qui» (falso) → «Ci arrivi dal pulsante «Prova una settimana a 5 €»»; ritaglio della foto lezione `50% 45%` (teste dei ragazzi dentro il riquadro); titoli delle tre schede della prova allineati (testo della scheda 3 allungato con «vicino alla metro Fermi»); vuoto in fondo al telefono tolto (6000 px).
Restano da valutare: ordine dei pulsanti nella testata («Scrivici» poi «Prova») opposto al corpo (la testata è `SitoTestata`, comune alla home); ~100 px di vuoto nelle FAQ della seconda fila; `CONTATTACI` a 375 con ~8 px dalla testata. Non guardati: 768, tema scuro, contrasti misurati, rendering dal vivo con le immagini.
