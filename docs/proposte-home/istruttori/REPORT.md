# Pagina Istruttori: ciclo di miglioramento (solo proposta)

Data 2026-10-18. Niente cambiato in `src/`, `supabase/`, sul sito vero o sul database; niente commit né PR; niente caricato su Supabase; la libreria LightCraft non è stata modificata (selezione, voti, flag e keyword intatti).

## Dove sta cosa

| Passo | File |
|---|---|
| 1. Audit visivo (1440/768/375) | `audit/REPORT.md`, screenshot in `audit/img/` |
| 2. Foto | `foto/REPORT.md`; `approvate/`, `da-verificare/`, `scartate/`, `confronto/` |
| 3. Testi | `testi/REPORT.md`, `testi/conta.mjs` |
| 4. Mockup | `docs/design-canvas/istruttori-miglioramenti/` (README, 8 tavole, `rendi.mjs`, `anteprima-*.html`, `shot/`); 4 componenti nuovi in `docs/design-canvas/ods-design-system/` (`SitoRitratto`, `SitoDatoPersona`, `SitoBloccoPersona`, `SitoElencoPercorso`). `verifica.mjs`: «tutto in regola» |
| 5. Revisione | sotto |

## Cosa ho trovato

- **La pagina di oggi** (`/istruttori/`) esiste: 13 tessere con l'iniziale, nessuna foto, nessun link. **La scheda singola non esiste** (404): le tavole della scheda sono una proposta, non un confronto.
- **Audit**: 15 punti (4 alti: nessun volto; cerchio da 140 px troppo piccolo; i nomi di una fila a quote diverse; la tredicesima tessera sola). Bersagli del menu 38 px e del piede 20-30 px; CLS 0,07 a 1440 e 0,08 a 375 (sotto 0,1); titolo da 200 px che spinge le tessere a 594 px.
- **Foto**: ritratti con nome (assegnato dall'utente in LightCraft) e utilizzabili: **4 su 13** (Maurizio 42, Maura 200, Fabio 948, Federico 199). Ritratti belli senza nome: 153, 167, 948-1…3 (da abbinare). 308 e simili scartate (bambini sullo sfondo). Confronto PhotoCraft: LightCraft vince su 153, 914, 200, 199; PhotoCraft su 42.
- **Testi**: sull'elenco la lunghezza ±20% **non si raggiunge con i soli dati veri** (2 tessere su 13 con le parole di oggi come con le pastiglie): la proposta pareggia con la forma (altezza uguale, ruolo fuori, corsi in pastiglie) e propone la frase in prima persona di ognuno (10-14 parole) come soluzione vera. Sulla scheda i tre blocchi sono 36/32/25 parole (tutti dentro ±20%) e i quattro dati 9/9/10/10; cambia solo il titolo «Come insegna» → «A scuola».
- **Domande** I1-I12 nel report testi: chiuse I1, I12 e D9 dall'utente; restano I2-I11, come cartellini rossi nel canvas.

## Revisione (design reviewer)

Il tipo di agente `design-reviewer-ods` non è registrato in questa sessione (agente creato dopo l'avvio): l'ho fatto girare come sub-agente generico che segue alla lettera `.claude/agents/design-reviewer-ods.md`. Esito: mockup, foto e testi «approvato con riserve». Cosa è stato corretto:

| Voce | Corretto |
|---|---|
| **BLOCCA** `alt` con nome su foto non abbinate | `alt` neutro di default nel componente; ora le quattro foto usate hanno il nome che LightCraft già conosce (vedi seconda passata) |
| **BLOCCA** gruppo aikido 948 assegnato a 4 persone di altri corsi | tolto dal mockup (le tessere tornano con l'iniziale); ritagli in `foto/da-verificare/`; numeri aggiornati (3 su 13; poi 4 su 13 con la seconda passata) |
| DA FARE cartellini che coprono il titolo delle tessere | cartellino sotto il valore, in flusso (tessere dati alte 230 px) |
| DA FARE screenshot vecchi e numerazione D3/I1 | `rendi.mjs` rilanciato, shot rifatti; I1-I12 coerenti tra canvas e report |
| DA FARE cartellini mancanti | aggiunti I2 (ruolo sotto il nome), I7 («tutti i gruppi» dal canvas), I10, I8/I9/I12 (striscia sopra l'elenco), I11 (menu) |
| DA FARE foto 308 in `approvate/` | spostata in `scartate/` insieme a 422 e 475 |
| DA FARE audit: 35/29/24 contro 36/32/25 | audit corretto: i tre blocchi erano già dentro ±20% |
| DA FARE piede senza telefono e social | superato dalla terza passata: nuovo `SitoPiedeContatti` con telefono e social |

Non verificato dal reviewer: tema scuro (non esiste), 768 sul canvas, `.dc.html` aperti nel canvas, contrasti delle pastiglie ricalcolati (usate le coppie dell'audit home), scheda a 375 a piena risoluzione.

## Seconda passata sulle foto (app LightCraft di nuovo raggiungibile)

Letti in sola lettura i nomi che l'utente ha già dato ai volti in LightCraft (`faces.person` per tutti e 13). Hanno un ritratto singolo utilizzabile **Maurizio Innella (42), Maura Fornetti (200, nuova), Fabio Berta (948, quarto volto) e Federico Vuillermin (199, nuova, con riserva)**: sviluppate copie, confronto PhotoCraft, e le tessere del canvas ora mostrano queste quattro foto con `alt` «Ritratto di Nome Cognome» e **senza** cartellino (liberatorie dichiarate dall'utente). Le altre nove restano con l'iniziale. Ritratti belli ma senza nome in LightCraft (153, 167, 948-1…3): in `foto/non-abbinate/` e `foto/da-verificare/`. Nessun nome assegnato, nessuna keyword, voto o selezione cambiati. Dettagli in `foto/REPORT.md`.

## Decisioni dell'utente applicate (terza passata)

1. **Scheda di default = scarna** (nome, foto se c'è, corsi, pulsanti, invito); la scheda completa di Maurizio resta come esempio per quando i dati arrivano. **I nomi diventano link solo se la scheda è scritta**: nel canvas hanno la freccia Maurizio e Fabio.
2. **Tredici** confermato (cartellino I1 tolto). Liberatorie: nessun cartellino sulle foto.
3. **Due pulsanti**: «Prova una settimana a 5 €» → modulo online; «Scrivici» → Contatti. **Piede**: «vicino alla metro Fermi» (senza minuti), telefono, Instagram, Facebook (nuovo `SitoPiedeContatti`: un edit a `SitoPiede` è stato sovrascritto da un'altra sessione).
4. **4 ritratti su 13**, gli altri con l'iniziale; nessuna sessione ritratti per ora (opzione futura).
5. Domande chiuse: I1, I12 (foto), D9. Restano I2-I11.

## Da decidere (le domande che cambiano il lavoro)

1. **Chi dà un nome ai volti già belli ma senza nome** (153, 167, 948-1…3) e conferma che quelli di 948 sono istruttori ODS.
2. *(Opzione futura, non ora)* **sessione ritratti** da 30 minuti per avere 13 foto coerenti (spec in `foto/REPORT.md`).
4. **Frase in prima persona** per ognuno: sì o no (I6/I7).
5. Le domande ancora aperte di `testi/REPORT.md`: I2-I11.
