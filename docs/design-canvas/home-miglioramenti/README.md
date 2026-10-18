# Home del sito: canvas di approvazione

Proposta da approvare prima di toccare il sito. Parte dai quattro report di
`docs/proposte-home/` (audit, testi, foto, gravity). Niente è stato cambiato in
`src/`, `supabase/`, sul sito vero o sul database.

## Cosa c'è

| Tavola | Cosa è |
|---|---|
| `HomeAttuale` (1440) e `HomeAttualeTelefono` (375) | La home com'è oggi: schermate intere del sito vero del 18 ottobre 2026 (da `proposte-home/audit`), solo per confronto |
| `HomeProposta` (1440) | La proposta, disegnata con i componenti `Sito*` della libreria |
| `HomePropostaTelefono` (375) | La stessa proposta sul telefono |

I pezzi nuovi stanno in `../ods-design-system/` (`SitoTestata`, `SitoPulsante`,
`SitoTessera`, `SitoTitolo`, `SitoSchedaCorso`, `SitoPerche`, `SitoCitazione`,
`SitoRecensione`, `SitoInBreve`, `SitoDomanda`, `SitoCta`, `SitoPiede`), con le
righe nel README della libreria. Valori copiati da `sito-approvato/TatamiBlu.dc.html`
(colori A2, Big Shoulders Display + Inter). `verifica.mjs`: «tutto in regola».
Le foto: hero, istruttori, sala e cubi sono di `proposte-home/foto/approvate/` (LightCraft); judo, lotta e aikido sono il mix scelto da `proposte-home/alternative/` (sezione «Foto scelte»). Tutte in `img/`.

**Segnaposto:** i dati ancora aperti (D7, D8, D10) hanno cartellino rosso «DA CONFERMARE Dn» sulla tavola.

## Cosa cambia, sezione per sezione (prima → dopo → perché)

| Sezione | Prima | Dopo | Perché |
|---|---|---|---|
| **Hero** | Titolo da 228 px su 4 righe che tocca il sottotitolo (zero spazio), hero alto 1006 px, foto di gruppo tagliata a verticale 317×530 | Titolo da 156 px su 3 righe, 32 px di stacco, sottotitolo con «dai 3 anni in su. Prova una settimana a 5 €.», pulsante giallo «Prova una settimana a 5 €» + «Scrivici», foto di gruppo in riquadro orizzontale | Audit 1-2: il titolo non ruba la prima schermata e il gruppo si vede intero |
| **Numeri** | 9 tessere in 4 colori, 3 altezze, testo da 14 a 96 px; la prova e l'indirizzo dentro le statistiche | 4 tessere uguali (35+, 9, 300+, 13) alte uguali; la prova sta nel pulsante, l'indirizzo nella chiamata finale; sotto, la frase di 14 parole e il motto | Audit 5 + testi §2: una sola fonte per ogni numero |
| **I nostri corsi** | A desktop blocchi di colore alti 340 px senza foto né freccia (foto e freccia solo sul telefono); testi da 3 a 19 parole | Schede con foto (fuoco corretto), freccia da 48 px, pastiglie; testi di 12-14 parole; titolo da 80 px | Audit 7, testi §3, gravity §3. I 4 corsi senza foto (Pre pugilistica, Autodifesa, Avviamento, Sollevamento pesi) hanno una fascia azzurra con l'iniziale |
| **Perché unirti** | Fascia di 4 foto già viste (3 volte ciascuna) + 4 titoli senza testo | 4 tessere con titolo e una riga di testo, senza foto | Audit 4 e 6, testi §4: una foto, un posto |
| **Esperti** | 3 citazioni da 61-88 parole in un carosello, altezze diverse, puntini da 10 px, avatar «SSerena» | 3 carte uguali con estratto di 36-40 parole, «Leggi tutto», una sola iniziale | Audit 11, testi §5. Il testo non si riscrive: si accorcia solo la vista |
| **Recensioni** | 5 carte uguali (31, 36 e tre da 7 parole), foto di gruppo dentro il carosello | 2 carte larghe a testo intero + una carta «In breve» con le tre frasi corte; nessuna foto; titolo «Cosa dicono di noi» | Audit 12, testi §6. Refusi lasciati com'erano (D7) |
| **FAQ** | 6 domande, due doppie sulla prova (con risposte diverse), refusi | 5 domande, risposte di 24-28 parole, in griglia 3 + 2 | Audit 9, testi §7 |
| **Chiamata finale** | «PROVA» da 170 px senza verbo né prezzo, a contatto con la frase, metà vuota | Due colonne: titolo «Una settimana per scegliere.», frase con indirizzo, pulsante pieno «Prova una settimana a 5 €» + «Scrivici» (primario sempre per primo), foto degli istruttori a destra | Audit 3, testi §8 |
| **Ritmo** | Spazi tra sezioni da 6 a 190 px | Un solo passo: 96 px a desktop, 64 px sul telefono; 24 px tra chiamata e piede | Audit 10 |
| **Titoli di sezione** | Tutti da 120 px, come l'hero | 80 px a desktop, 56 px sul telefono | Audit 16 |
| **Bersagli** | Voci di menu 39 px, link del piede 20-30 px, puntini da 10 px | Menu, pulsanti, «Leggi tutto», link del piede: 48 px; sul telefono tasto MENU al posto delle due righe di voci | Audit 13 |
| **Foto** | Fuoco uguale in ogni riquadro | `object-position` per foto da gravity: vedi «Foto scelte»; sala 50% 50%, cubi 75% 50%; versioni migliorate | gravity §3, foto/REPORT |

## Decisioni dell'utente applicate

- **Pulsanti:** «Prova una settimana a 5 €» → modulo online (app.officinedellosport.it/iscrizioni); «Scrivici» → pagina Contatti (il 346 329 2786 risponde anche su WhatsApp). Appaiono insieme in testata (solo a 1440: sul telefono c'è il tasto MENU), hero e chiamata finale (e in Contatti); il primario è sempre il primo.
- **Numeri:** 9 attività (non 8), 13 tecnici, «35+ anni di sport», «300+ atleti»: tolti i cartellini D1, D2, D3.
- **Podi:** resta «svariati podi», nessun numero (D4 chiusa). Recensioni vere, senza fonte né stelle (D6 chiusa).
- **Citazioni:** titolo «Lo sport secondo chi lo studia» (D5), autori con nome e ruolo come oggi.
- **Prova:** vale per tutte le età (dai 3 anni), solo la settimana, nessuna lezione singola (D12).
- **Liberatorie:** l'utente le ha per tutte le foto proposte. Regola: nessun cognome leggibile sul dorso.
- **Corsi senza foto** (Pre pugilistica, Autodifesa, Avviamento, Sollevamento pesi): fascia con l'iniziale, nessuna foto di altri corsi.

## Domande aperte (sulla tavola restano i cartellini rossi)

1. **D8** Nicola A. ha dato il permesso a comparire col nome? Va bene la menzione di «Maurizio» nella recensione di Nando?
2. **D7** I refusi delle recensioni («x chi», «Discretamente strutturato Persone…») restano com'è.
3. **D10** Le FAQ «Come mi iscrivo?» possono citare il modulo online?
4. **Foto delle schede:** sfondi e sponsor non ODS in aikido (Fijlkam) e lotta (tuta «ITA / OFFICIAL», arbitro): vanno bene in home? (vedi «Foto scelte» e la seconda revisione).
5. **«Leggi tutto»:** il testo intero si apre nella carta, in un pannello o in una pagina?
6. **Pulsante di prova** in testata, hero, sottotitolo e chiamata finale: togliere l'offerta dal sottotitolo?
7. **Lunghezza sul telefono:** 12 900 px contro 11 100 di oggi: nove schede una sotto l'altra; alternativa due colonne o carosello.
8. La foto `lezione` (12e605fc) è in `img/` ma non usata (può andare nella pagina del Judo).

## Foto scelte (mix)

Dalla scelta in `proposte-home/alternative/{judo,lotta,aikido}/` (report lì). Nella home ogni corso ha **un solo posto, la scheda**; le altre foto vanno nella pagina del corso (da costruire, qui solo documentate).

| Corso | Posto | Foto | Fuoco (scheda 442×240 · telefono 343×220) | Minori (liberatorie ok) |
|---|---|---|---|---|
| Judo | scheda home | `161-judo-C` → `img/judo.jpg` | 50% 0% · 50% 30% | 2 ragazzi riconoscibili (liberatoria c'è) |
| Lotta | scheda home | `446-lotta-A` → `img/lotta.jpg` | 50% 85% · 50% 50% | 2 minori, volti di profilo o coperti (liberatoria c'è) |
| Aikido | scheda home | `989-aikido-B` → `img/aikido.jpg` | 50% 5% · 35% 50% | nessuno riconoscibile; tablet e sponsor Fijlkam nello sfondo |

Attenzione: **989** viene dall'evento Fijlkam (scritte e sponsor visibili) e **446** ha sfondo e tuta di gara diversi dalla palestra ODS.

Pagine corso (solo da documentare, non costruite): **Judo** 690-judo-A (azione, adulti), 164-judo-B, 26-judo-C (ritratto istruttore); **Lotta** 546-lotta-B (apertura), 394-lotta-C (chiusura), 418-lotta-A (ripiego senza volti); **Aikido** 949-aikido-C, 974-aikido-A, 874-aikido-A (senza volti). Escono dalla home 46c39293 e 701a887f.

## Come si guarda

`canvas.json` elenca le quattro tavole; `rendi.mjs` genera `anteprima-1440.html` e `anteprima-375.html` (pagine autonome, apribili nel browser) e `shot/` ha gli screenshot, a pagina intera e a fette di 1400 px (`f1440-N`, `f375-N`). I `.dc.html` si aprono col canvas (come gli
altri di `docs/design-canvas/`), non nel browser da soli.

## Revisione di design-reviewer-ods

Verdetti: **HomeProposta** e **HomePropostaTelefono** «approvato con riserve»; nessun BLOCCA.

Corretti (DA FARE): stacco hero→tessere→motto portato a 48 px (32 sul telefono); titolo della
chiamata finale sul telefono 48 px con `text-wrap: balance` (anche titoli di sezione); cartellini D8
e D7 sulle recensioni (poi D9 chiusa dall'utente: due pulsanti).
Corretti (DA VALUTARE, a costo zero): titolo della chiamata finale a 88 px (dentro i 72-88); carte
recensione più basse (300 px); foto dell'hero allineata in basso al pulsante; fascia delle schede senza
foto a 120 px sul telefono.

Restano aperti, da decidere: il pulsante di prova compare in testata, hero, sottotitolo e chiamata
finale (togliere l'offerta dal sottotitolo?); le recensioni di Nicola A. (31 parole) e In breve (21)
non rientrano nel ±20 % senza toccare le parole; non guardati:
768 px, tema scuro, fuoco da tastiera.

### Seconda revisione (foto mix)

Approvate con riserve, nessun volto tagliato a 1440 e 375, pesi 170-283 KB, nessuna foto ripetuta.
Corretto: i testi alternativi delle schede descrivono la foto (la gara di lotta non è «una lezione»).
Restano aperti, da decidere (i fuochi sono quelli scelti dall'utente, non toccati):
- **Aikido (989):** banner e sponsor Fijlkam leggibili sullo sfondo, palazzetto non ODS. Ritaglio più stretto (zoom ~1,3×, fuoco 35% 50%) o altra foto, oppure si accetta il marchio federale.
- **Lotta (446):** in alto un arbitro senza testa (fuoco 85% → ~95% a 1440 lo toglie); tuta «ITA / OFFICIAL» e tappeto rosso e giallo.
- **Judo (161) a 1440:** capelli del ragazzo centrale al bordo alto (fuoco 0%) e una quarta persona tagliata a destra; zoom ~1,1× lo risolve.
- Le tre foto hanno più colore e «evento» di sala e cubi: lasciato così (niente ritocchi percepibili).
