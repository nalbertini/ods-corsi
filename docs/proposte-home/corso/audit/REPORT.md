# Audit visivo della pagina del corso — officinedellosport.it

Data: 2026-10-18. Sito pubblico, `src/`, `supabase/` e database non toccati.
Pagine guardate: **Judo** (tre foto in fila, la più ricca), **Lotta**, **Aikido** (una sola foto) e **Pre pugilistica** (corso senza foto sua). Le altre cinque pagine usano lo stesso template (vedi tabella foto in `../foto/REPORT.md`).
Misure: 1440, 768, 375 px, tema chiaro, Chrome headless (playwright-core) con scroll lento per far caricare le foto. Il tema scuro non esiste (nessun `prefers-color-scheme`): niente da verificare.
Screenshot in `img/`: pagina intera `<pagina>-<larghezza>-full.png`; fette leggibili `judo-d-0…4`, `lotta-d-*`, `aikido-d-*`, `prepug-d-*` (1440) e `*-m-*` (375). Misure grezze (altezze, foto, bersagli) rifatte a ogni passata con lo stesso script, riportate qui sotto.

Metodo: gerarchia, ritmo, bersagli, CLS, accessibilità, foto secondo `impeccable`, `ui-ux-pro-max` e le regole della home (`proposte-home/audit/REPORT.md`). Non ho lanciato i comandi automatici di audit delle skill: giudizio visivo + misure da DOM.

## Cosa funziona (da non toccare)

- Un solo `h1`, `lang="it"`, `title` e `description` per pagina, canonical, `alt` descrittivo su ogni foto di contenuto.
- Nessun overflow orizzontale a 375 (`scrollWidth` = 375) né a 768.
- Le quattro tessere dei dati (Per chi · Quando · Dove · Per iniziare) rispondono alle domande di un genitore nei primi 1100 px; sul telefono sono due per riga e restano leggibili.
- Gli orari in tessere (nome · ora · giorni · anni di nascita) sono chiari: sono la parte migliore della pagina.
- Contrasti: gli stessi colori della home (inchiostro su giallo 8,95:1, bianco su blu 5,46:1, bianco su inchiostro 14,83:1).
- CLS quasi zero (≤ 0,001) su Judo, Lotta e Aikido.

## Problemi, in ordine di priorità

### ALTA

**C1. La foto di testata è una verticale tagliata a orizzontale e ingrandita.** Judo: `12e605fc` è 1169×1800 (verticale), mostrata in 1344×619 con `object-position 50% 56%`: si vede solo una striscia centrale e il file è **ingrandito del 15 %** (1169 px di larghezza su 1344), quindi molle. In più sulla giacca a destra si legge un nome («…MERIUC ITA»). Lotta: `9b15677c` è 1350×1800 verticale, tagliata a 619 px di altezza (al 25 % dall'alto: via i piedi e il tatami), ingrandita 0,5 %. Aikido: `fbfe492b` è 1800×1349 (ok come formato) ma è un primo piano di un istruttore con una bambina, sfocato, con la mano sul viso: la foto più debole del sito.
Prova: `img/judo-d-0.png`, `lotta-d-0.png`, `aikido-d-0.png`.
Proposta: testata con foto **orizzontale ≥ 1800 px di larghezza** (nessun ingrandimento), fuoco per riquadro da `../foto/REPORT.md`.

**C2. Quattro pagine su nove non hanno una foto «loro».** Pre pugilistica e Metodo Globale di Autodifesa mostrano la foto degli istruttori in kimono di judo con la cintura nera (`814a717b`): su una pagina di boxe è la foto sbagliata, ed è la stessa foto della fila di Judo. Preparazione atletica e Sollevamento pesi mostrano la stessa sala vuota (`1a03b6b2`). Il genitore che apre due pagine vede la stessa foto con testi diversi.
Prova: `img/prepug-d-0.png`; `814a717b` è anche la prima foto della fila a Judo.
Proposta: una foto per pagina; dove la libreria non ha niente (pugilistica, autodifesa, pesi) la pagina dichiara di non averla (fascia tipografica, come nei mockup) invece di prendere in prestito un'altra disciplina. Vedi `../foto/REPORT.md`.

**C3. Chiusura con «PROVA» a 200 px e metà vuota.** Lo stesso difetto della home (audit 3): il pulsante vero è la parola «PROVA» in un blocco giallo senza verbo, senza prezzo, con la metà destra vuota; sembra un titolo, non un pulsante. È l'ultima cosa che si vede e la più importante (portare a provare).
Prova: `img/judo-d-4.png`.
Proposta: la stessa chiamata finale della home («Una settimana per scegliere.», frase con l'indirizzo, pulsante «Prova una settimana a 5 €»), con a fianco una foto.

### MEDIA

**C4. Tessere con un buco in mezzo.** In ogni tessera di presentazione titolo in alto e testo in fondo: tra i due 70-120 px di vuoto (`img/judo-d-1.png`, «Due idee di Kano», «1964 · Giochi di Tokyo»). Il testo non si lega al suo titolo; a 1440 una tessera da 2 righe pesa quanto una da 5. Le tessere dell'orario hanno la stessa altezza fissa (170 px) anche con una riga.
Proposta: testo subito sotto il titolo (stacco 16-24 px), altezza dal contenuto, uguale solo nella riga.

**C5. Troppi titoli grandi: 7 «urla» da 120 px.** Judo: `h1` da 200 px, poi 4 `h2` da 120 px (due su 2 righe: «COSA PUÒ ASPETTARSI UN GENITORE O UN ATLETA» occupa 204 px), + «Perché sceglierlo» da 120 px su 2 righe. Nessun titolo è più importante di un altro. Sul telefono gli `h2` sono 56 px ma «Perché sceglierlo» scende a 48 e le tessere a 31,5-40 px: la scala cambia senza ordine.
Proposta: titoli di sezione 80 px a 1440, 56 sul telefono (come la home); `h1` come oggi.

**C6. «Quando» dice una cosa a metà e l'orario vero sta 2000 px più sotto.** Nelle tessere dei dati il «Quando» è una frase («Lunedì, mercoledì e venerdì; martedì e giovedì per gli agonisti»), ma gli orari con le ore (17:00–18:00…) stanno nella sezione «Orario delle lezioni» a y = 3121 (Judo, 1440) e 3500 (375). Chi cerca «a che ora?» scorre 5 schermate. Le età sono in due posti con due forme («Dai 7 anni (nati dal 2019)» e «7-9 anni · nati 2019-2017»).
Proposta: l'orario subito dopo i dati (secondo blocco della pagina), una sola forma per l'età; la storia e i valori dopo.

**C7. Griglia dell'orario con un buco.** Judo ha 5 gruppi in due colonne: l'ultima riga ha una tessera sola e metà vuota (`judo-d-2`); Pre pugilistica ha 1 tessera in una colonna di due, alta come se ce ne fossero altre (`prepug-d-1`).
Proposta: l'ultimo gruppo si allarga a tutta riga, la tessera sola resta a larghezza piena.

**C8. Foto in fila e foto della testata si ripetono.** Judo: la fila di 3 foto ha una foto già vista (istruttori `814a717b`, anche in Pre pugilistica e Autodifesa) e una di gruppo (`18c88f1d`, minori riconoscibili, già in home).
Proposta: una foto, un posto (stessa regola della home); la fila di Judo usa foto nuove e dichiarate nel report.

**C9. Testata a 375: il menu si spezza in due righe e occupa 190 px.** Logo + «Contattaci» + «Prova» nella prima riga; sotto 4 voci su due righe (la quarta, «Istruttori», sola). Le voci sono 38 px di altezza, 45-88 px di larghezza (sotto i 44 px in un lato: «Home» 45×20 nel piede).
Proposta: come la home: tasto MENU a 48 px al posto delle due righe, «Prova» sempre visibile.

**C10. Pre pugilistica: CLS 0,06 a 1440 e 0,04 a 375.** Sotto la soglia di 0,1 ma 60 volte più alto delle altre pagine: il titolo su 2 righe a 175 px cambia altezza quando carica il font (Big Shoulders Display).
Proposta: `font-display: optional` o dimensioni riservate al titolo.

### BASSA

**C11. Bersagli sotto i 44 px.** Voci di menu 38 px (1440), link del piede 20-30 px di altezza (Privacy, Cookie, Contributi pubblici, Instagram, Facebook, voci del menu ripetuto): 14 elementi a 1440, 10 a 768, 9 a 375. Pulsanti «Contattaci» e «Prova» a 48 px: ok.
Proposta: 48 px (area cliccabile, non solo testo) in menu e piede.

**C12. Le foto non hanno `width`/`height`, `srcset` né `loading="lazy"`.** Cinque foto su Judo: solo il logo ha `width`/`height`. Il CLS è basso perché il riquadro ha altezza fissa, ma la foto della testata e la fila sono scaricate nella versione intera su telefono (1800 px per un riquadro da 343).
Proposta: dimensioni, `srcset` 720/1440/1800, `lazy` sotto la piega, `fetchpriority=high` sulla testata.

**C13. Le età sono sull'anno 2026.** «7-9 anni · nati 2019-2017» invecchia ogni settembre; gli anni di nascita restano. Già segnalato in `docs/sito/judo.md`.
Proposta: mostrare gli anni di nascita per primi, l'età come aiuto («7-9 anni») — decisione di chi gestisce i dati.

**C14. Dati che il genitore cerca e la pagina non ha.** Quota mensile/annuale, certificato medico, vestiario/kimono, nome e cognome di chi insegna (la pagina non rimanda a «Istruttori»), come si prenota la prova. Niente di questo è nel testo di oggi: **non lo invento**; le domande sono in `../testi/REPORT.md`.

## Riepilogo

| # | Problema | Priorità |
|---|---|---|
| C1 | Foto di testata verticale tagliata a orizzontale e ingrandita (Judo, Lotta); Aikido sfocata | alta |
| C2 | Foto prese in prestito da un'altra disciplina (Pre pugilistica, Autodifesa, Pesi, Prep. atletica) | alta |
| C3 | Chiusura «PROVA» enorme senza verbo né prezzo | alta |
| C4 | Tessere con 70-120 px di vuoto tra titolo e testo | media |
| C5 | Titoli di sezione tutti uguali (120 px, fino a 2 righe) | media |
| C6 | Orario con le ore a 5 schermate dai dati; età in due forme | media |
| C7 | Ultima riga dell'orario con buco / tessera sola | media |
| C8 | Foto in fila ripetute tra pagine | media |
| C9 | Menu a 375 su due righe, 190 px | media |
| C10 | CLS 0,06 su Pre pugilistica | media |
| C11 | Bersagli 20-38 px in menu e piede | bassa |
| C12 | Foto senza dimensioni, `srcset`, `lazy` | bassa |
| C13 | Età sull'anno 2026 | bassa |
| C14 | Quota, certificato, kimono, istruttori e prenotazione mancano | domanda |

## Limiti

- Chrome headless a larghezza fissa (non un telefono vero); 768 e 375 misurati ma guardati solo a 375.
- Pagine non guardate a schermo (Preparazione atletica, Giocomotricità, Avviamento, Autodifesa, Pesi): stesso template, stesse tessere; per le foto vedi la tabella in `../foto/REPORT.md`; i testi sono stati letti nei sorgenti `docs/sito/*.html`.
- Il tema scuro non esiste: niente da verificare.
