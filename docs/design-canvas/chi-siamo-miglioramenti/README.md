# Chi siamo: canvas di approvazione

Proposta da approvare prima di toccare il sito. Parte dai report di
`docs/proposte-home/chi-siamo/` (audit, foto, testi). Niente è stato cambiato in
`src/`, `supabase/`, sul sito vero o sul database.

## Cosa c'è

| Tavola | Cosa è |
|---|---|
| `ChiSiamoAttuale` (1440) e `ChiSiamoAttualeTelefono` (375) | La pagina com'è oggi: schermate intere del sito vero del 18 ottobre 2026 (da `proposte-home/chi-siamo/audit`), solo per confronto |
| `ChiSiamoProposta` (1440) | La proposta, disegnata con i componenti `Sito*` della libreria |
| `ChiSiamoPropostaTelefono` (375) | La stessa proposta sul telefono |

Componenti da `../ods-design-system/`: `SitoTestata`, `SitoPulsante`, `SitoTessera`, `SitoTitolo`, `SitoPerche` (i quattro valori), `SitoCta`, `SitoPiede`. Unica modifica alla libreria: `SitoCta` ha una prop `alt` per il testo della foto (prima era fisso «istruttori in judogi»). Hero, due tessere, pannello istruttori, fila di foto e missione sono pochi `div` con gli stessi valori (colori A2, Big Shoulders Display + Inter).
Foto da `proposte-home/chi-siamo/foto/approvate/` (LightCraft), in `img/`. `verifica.mjs`: «tutto in regola».

**Segnaposto:** le domande ancora aperte (C6-C10) hanno un cartellino rosso.

## Cosa cambia, sezione per sezione (prima → dopo → perché)

| Sezione | Prima | Dopo | Perché |
|---|---|---|---|
| **Titolo e frase** | «Chi siamo» da 200 px, frase a destra | 120 px, stessa frase | Audit 6: una scala sola (hero 156, sezione 80, tessera 40) |
| **Foto + frase grande** | Foto 878×600 e frase da 76 px con `line-height` 0,9 che si tocca; sul telefono foto 343×300 senza lati e frase incollata | Foto 878×440 (fuoco 50% 70%), frase 56 px su 4 righe con `text-wrap: balance`; telefono 16:10 e 6 px di stacco | Audit 2, foto §3 |
| **Due tessere** | Titoli 30 e 64 px, testi 17 e 21 px, ancora diversa | Titoli 40 px, testi 20 px, stessa ancora in alto; 38 e 44 parole | Audit 1, testi §2 |
| **Numeri** | 4 tessere, «300+» al bordo, tre colori | 4 tessere uguali (SitoTessera), 9 attività (D2), nessun cartellino sui numeri salvo C9 | Audit 9 |
| **Gli istruttori** | Titolo 120 px, 4 miniature 64-132 px, nessun pulsante | Pannello con titolo 80 px, testo di 13 parole, pulsante «Conosci gli istruttori», una foto 520×390 | Audit 4, testi §4 |
| **Fila di foto** | 4 foto senza parole, aikido già vista nel pannello, 2 foto sparite sul telefono | 4 foto diverse con il nome del corso, 2×2 sul telefono, «Vedi tutti i corsi» | Audit 5, foto §1-2 |
| **Missione** | Titolo 120 px su due righe, nessuna foto | Titolo 80 px, testo 22 px, foto di gruppo di adulti a destra (`205`) | Audit 7 |
| **Valori** | Titoli 58 px, tessere da 190 px a una riga | `SitoPerche` 4 tessere uguali; introduzione di 21 parole (senza la frase che ripeteva la missione) | Audit 8, testi §7 |
| **Chiamata finale** | «PROVA» 170 px a contatto con la frase, nessun pulsante | «Vieni a provare.», frase, due pulsanti, foto di 4 istruttori | Audit 3, testi §8 |
| **Ritmo** | Spazi da 6 a 190 px | 96 px (64 sul telefono); 48 px (32) tra foto e due tessere, che ne sono la continuazione; 24 px tra chiamata e piede | Audit 12 |

## Decisioni dell'utente (18 ottobre) e domande ancora aperte

Chiuse: D1 («35+ anni» resta), D2 (**9 attività**), D3 (13 tecnici), C4 (300+), **D9 (due pulsanti: «Prova una settimana a 5 €» → modulo online `app.officinedellosport.it/iscrizioni`, «Scrivici» → Contatti)**, D12 (prova 5 € per tutte le età, dai 3 anni, solo la settimana), «vicino alla metro Fermi» (piede), liberatorie (tutte le foto proposte; resta: nessun cognome leggibile sul dorso), nessuna foto per i corsi che non ne hanno.

Aperte, con cartellino sulla tavola: **C6** nome «A.s.d. il Centro Judo», **C7** didascalie della fila verso le pagine corso, **C8** un dato concreto per ogni valore, **C9** ordine dei numeri, **C10** pagina Istruttori pubblicata (il pulsante «Conosci gli istruttori» va all'elenco Istruttori).

Note nate dal disegno: la foto della chiamata finale (`948`) è un'alternativa (vedi `foto/REPORT.md`: `1033`, `814a717b`); il cartellino C9 copre un po' la cifra di «35+» (è solo un segnaposto).

## Come si guarda

`canvas.json` elenca le quattro tavole; `rendi.mjs` genera `anteprima-1440.html` e `anteprima-375.html` (pagine autonome, apribili nel browser) e `shot/` ha gli screenshot, a pagina intera (`proposta-1440`, `proposta-375`) e a fette (`f1440-N`, `f375-N`). I `.dc.html` si aprono col canvas, non nel browser da soli.

## Revisione di design-reviewer-ods

Verdetti: **ChiSiamoProposta**, **ChiSiamoPropostaTelefono**, foto e testi «approvato con riserve»; nessun BLOCCA. (L'agente `design-reviewer-ods` non è registrato in questa sessione: la revisione è stata fatta da un subagent generico con le sue istruzioni.)

Corretti (DA FARE): stacco foto → due tessere a 48 px (32 sul telefono); testo di destra a 44 parole (+16 % sulle 38 di sinistra); titoli delle tessere ora `h3`; corpo delle tessere a 18 px sul telefono; riga dell'alt della foto finale nel report dei testi.
Per chi pubblica (gerarchia): `h1` → `h2` per le sezioni (Gli istruttori, missione, I nostri valori, la fila di foto con un `h2` nascosto «I nostri corsi») → `h3` per le tessere e i valori.

Restano aperti, da decidere: `istruttori.jpg` e `missione.jpg` sono due gruppi di judoka sullo stesso tatami (alternative: `948` o `1033` per il pannello, vedi `proposte-home/chi-siamo/foto/REPORT.md`); `cubi` senza volto e `aikido` unica in bianco e nero (scelte volute, da confermare); il default di `alt` in `SitoCta` resta «istruttori in judogi»: ogni pagina deve passare il suo. Non guardati: 768 px, tema scuro, fuoco da tastiera.

Seconda revisione: nessun BLOCCA; corretto il nome ricamato leggibile sulla giacca in `img/missione.jpg` (coperto). Restano da valutare: il cartellino C9 taglia la cima di «35+» (segnaposto, da togliere alla pubblicazione); colore spinto di `sala` e `cubi` (come nella home, non ritoccato); etichetta «Contatti» nel menu contro «Contattaci» nel piede (etichette del sito di oggi).
