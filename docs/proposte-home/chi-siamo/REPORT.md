# Chi siamo: report finale

Solo proposta. Niente toccato in `src/`, `supabase/`, sito vero, database; niente commit, PR o upload su Supabase. Data: 18 ottobre 2026.

| Cosa | Dove |
|---|---|
| Audit visivo 1440/768/375 + screenshot | [`audit/REPORT.md`](audit/REPORT.md), `audit/img/` |
| Foto: valutazione, alternative, fuochi | [`foto/REPORT.md`](foto/REPORT.md), `foto/approvate/` |
| Testi e domande | [`testi/REPORT.md`](testi/REPORT.md) |
| Canvas e anteprime | `docs/design-canvas/chi-siamo-miglioramenti/` (`README.md`, 4 tavole `.dc.html`, `anteprima-1440.html`, `anteprima-375.html`, `shot/`) |

`node docs/design-canvas/ods-design-system/verifica.mjs`: «tutto in regola». Unica modifica alla libreria: `SitoCta` ha la prop `alt`.

**Attenzione:** il sito pubblicato non coincide con `docs/sito/chi-siamo.html`: manca il pulsante «Conosci gli istruttori» (il pannello non porta da nessuna parte). Le proposte partono dalla bozza in repo.

## Problemi, con priorità e prima → dopo → perché

| # | Priorità | Problema | Prima | Dopo | Perché |
|---|---|---|---|---|---|
| 1 | Alta | Due tessere sbilanciate | Titoli 30 / 64 px, testi 17 / 21 px, testo ancorato diversamente | Titoli 40 px, testi 20 px, stessa ancora; 38 e 44 parole | Sembravano due pagine diverse |
| 2 | Alta | Frase sulla foto e foto di gruppo | 76 px con righe che si toccano; telefono: foto 343×300 senza lati | 56 px, `text-wrap: balance`; foto 878×440 (fuoco 50% 70%); telefono 343×210 | Il gruppo si vede intero, le righe respirano |
| 3 | Alta | Chiamata finale | «PROVA» 170 px a contatto col testo, nessun link, 6 px dal piede | «Vieni a provare.» + frase + due pulsanti + foto, 24 px dal piede | Come la home: verbo, prezzo, pulsante vero |
| 4 | Alta | «Gli istruttori» | 4 miniature da 64-132 px, nessun pulsante, numero scritto due volte | Una foto 520×390, pulsante «Conosci gli istruttori», testo di 13 parole | Si riconoscono le persone; una sola fonte per il «13» |
| 5 | Alta | Foto ripetute e fila muta | Aikido due volte in 800 px, due foto sparite sul telefono, nessuna parola | 4 foto diverse col nome del corso, 2×2 sul telefono, «Vedi tutti i corsi» | Ogni foto un posto; la fila dice qualcosa |
| 6 | Media | Gerarchia dei titoli | h1 → h3 senza h2; sei misure di titolo | Scala 120 / 80 / 40; h2 sezioni, h3 tessere | Screen reader e coerenza con la home |
| 7 | Media | Missione | Titolo 120 px su due righe, nessuna foto | 80 px, foto di gruppo adulti a destra | Non urla due volte di fila |
| 8 | Media | Valori | Titoli 58 px, una riga ripetuta, tessere vuote | 4 `SitoPerche` uguali; introduzione di 21 parole | La frase tolta ripeteva la missione |
| 9 | Media | Numeri | «300+» al bordo, tre colori | 4 `SitoTessera` uguali (9 attività) | Una scala sola |
| 10 | Media | Alt sbagliati | Hero «judogi» (sono magliette), lotta «in posa» (è un incontro) | Alt corretti (testi §9) | Accessibilità |
| 11 | Media | Ritmo | Spazi da 6 a 190 px | 96 px (64 sul telefono), 48 px (32) tra foto e tessere, 24 px prima del piede | Un solo passo |
| 12 | Bassa | Bersagli | Piede 20-30 px, menu 39 px (1440) | 48 px | Come la home |
| 13 | Bassa | Peso e CLS | 8 foto senza `width`/`height`/`srcset` | Nota per chi pubblica | Non è da mockup |

## Foto in breve

Riusate le v2 della home (hero, istruttori, lotta, sala, cubi). Nuove sviluppate con LightCraft (copie, app non toccata) e confrontate con PhotoCraft (stessi numeri: vince LightCraft di poco): `205` (missione), `987` (fila, al posto di `fbfe492b`), `948` (chiamata finale), poi `1033`, `167`, `42` come alternative. Tolte dalla pagina `12e605fc`, `46c39293`, `fbfe492b`. Fuochi per riquadro nella tabella di `foto/REPORT.md` §3. **L'app LightCraft era occupata da altre sessioni: nessuna query al catalogo, file presi dal disco.**

## Decisioni dell'utente (18 ottobre)

D1 «35+» resta · D2 **9 attività** · D3 13 tecnici · C4 300+ · **D9: due pulsanti** («Prova una settimana a 5 €» → modulo online `app.officinedellosport.it/iscrizioni`, «Scrivici» → Contatti) · D12 prova 5 € per tutte le età (dai 3 anni), solo la settimana · «vicino alla metro Fermi» confermato · **liberatorie per tutte le foto proposte** (resta: nessun cognome leggibile sul dorso) · nessuna foto per i corsi che non ne hanno · «Conosci gli istruttori» → elenco Istruttori.

## Domande ancora aperte (cartellino sulla tavola)

| # | Domanda |
|---|---|
| C6 | Nome ufficiale: «A.s.d. il Centro Judo» o «A.S.D. Il Centro Judo»? Esiste ancora? |
| C7 | Le didascalie della fila portano alle pagine dei singoli corsi? |
| C8 | Un dato concreto per ciascun valore (le frasi ripetono il titolo)? |
| C9 | Ordine dei numeri: come la home (35+, 8→9, 300+, 13) o come oggi (300+, 13, 9, 35+)? |
| C10 | La pagina Istruttori è già pubblicata? |

## Revisione

Fatta da un subagent generico con le istruzioni di `design-reviewer-ods` (l'agente non è registrato in questa sessione). **Nessun BLOCCA**; verdetto «approvato con riserve» su tavola 1440, tavola 375, foto e testi. Corretti i DA FARE: stacco 48/32 px, testo destro a 44 parole, titoli `h3`, corpo 18 px sul telefono, riga alt della foto finale. Restano aperti (da decidere): `istruttori.jpg` e `missione.jpg` sono due gruppi di judoka sullo stesso tatami (alternative `948`/`1033`); `cubi` senza volto e `aikido` unica in bianco e nero. **Non guardati:** 768 px, tema scuro, fuoco da tastiera.
