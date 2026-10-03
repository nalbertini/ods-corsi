---
name: ODS Corsi
description: Il calendario dei corsi e il registro delle presenze di Officine Dello Sport, Collegno.
colors:
  nero-palestra: "#121212"
  superficie: "#1c1c1c"
  superficie-alta: "#242424"
  menu: "#161616"
  riga: "#333333"
  riga-tenue: "#2a2a2a"
  tratteggio: "#4a4a46"
  testo: "#f2f2f0"
  testo-secondario: "#c9c9c4"
  testo-spento: "#8c8c88"
  testo-flebile: "#5a5a56"
  tasto: "#b8b8b2"
  rosso-ingranaggio: "#e4292a"
  verde-ingranaggio: "#16a54a"
  giallo-ingranaggio: "#f4c31b"
  blu-ingranaggio: "#1b8ac4"
  viola-corso: "#8b5cc4"
  su-colore: "#121212"
  su-rosso: "#ffffff"
  rosso-testo: "#ff5a52"
  rosso-testo-chiaro: "#b81d1d"
  carta-chiara: "#f4f4f1"
  superficie-chiara: "#ffffff"
  superficie-alta-chiara: "#e9e9e5"
  riga-chiara: "#d4d4ce"
  testo-chiaro: "#161616"
  testo-spento-chiaro: "#6b6b67"
  verde-chiaro: "#12913f"
  verde-testo-chiaro: "#0b7a33"
  giallo-testo-chiaro: "#8f6a00"
typography:
  display:
    fontFamily: "'Saira Condensed', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "'Saira Condensed', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  title:
    fontFamily: "'Saira Condensed', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.03em"
  body:
    fontFamily: "Barlow, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.4
  body-small:
    fontFamily: "Barlow, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "'Saira Condensed', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.24em"
  button:
    fontFamily: "'Saira Condensed', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "0.16em"
    fontVariation: "oblique 9deg"
rounded:
  none: "0px"
  timbro: "3px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
  bordo-pagina: "20px"
  bordo-tablet: "32px"
components:
  button-primary:
    backgroundColor: "{colors.rosso-ingranaggio}"
    textColor: "{colors.su-rosso}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "56px"
  button-go:
    backgroundColor: "{colors.verde-ingranaggio}"
    textColor: "{colors.su-colore}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "56px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.tasto}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "56px"
  button-ghost-hover:
    textColor: "{colors.testo}"
  icon-button:
    textColor: "{colors.tasto}"
    rounded: "{rounded.none}"
    size: "44px"
  card:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.none}"
    padding: "14px"
  input:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.testo}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "52px"
  riga-appello:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.testo}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "56px"
  scheda:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.testo-spento}"
    rounded: "{rounded.none}"
    height: "40px"
  scheda-attiva:
    backgroundColor: "{colors.superficie-alta}"
    textColor: "{colors.testo}"
  chip:
    textColor: "{colors.testo-secondario}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  tablet-tessera:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.testo}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "84px"
---

# Design System: ODS Corsi

## Overview

**Creative North Star: "Il Tabellone di Palestra"**

ODS Corsi è segnaletica di sala prima che interfaccia. Si usa in piedi, col telefono in una mano durante l'appello, da un tablet appeso al muro guardato da due metri, dal computer della reception tra una telefonata e l'altra. Ogni scelta visiva risponde a quella scena: fondo nero pieno, i cinque colori degli ingranaggi del marchio usati come segnali, lettere condensate in maiuscolo obliquo che si leggono dalla porta, bersagli alti quanto un dito di fretta. *Prima si legge da lontano, poi si fa bello* (lo dice il codice stesso).

La densità è quella di un tabellone: poche cose, grandi, con contrasto netto. Niente angoli arrotondati, niente ombre decorative, niente sfumature: la profondità la fanno i bordi da 2px e il passaggio da `superficie` a `superficie-alta`. Lo stato si capisce dal colore del bordo e dal segno grande a sinistra prima ancora di leggere il nome. Il tema chiaro esiste per la reception illuminata: stessi segnali, carta calda invece del nero.

Il sistema rifiuta l'aspetto da SaaS generico: niente card morbide con ombra, niente pillole arrotondate, niente gradienti, niente icone decorative dove basta una parola in maiuscolo.

**Key Characteristics:**
- Nero palestra (`#121212`) come fondo, superfici a gradini tonali, bordi 2px pieni.
- Cinque colori del marchio, ciascuno con un solo significato (rosso azione/errore, verde fatto/presente, giallo avviso/prova, blu informazione, testo).
- Saira Condensed obliqua 9° per tasti e titoli, Barlow per il testo corrente.
- Raggio zero ovunque, tranne il timbro kanji.
- Misure dettate dal tocco: righe da 56px, tasti tablet da 60–96px.
- Etichette spaziate (0.12–0.24em) in maiuscolo come struttura della pagina.

## Colors

Un nero da palestra con cinque segnali puri presi dagli ingranaggi del logo; i neutri sono grigi caldi, appena verso il giallo.

### Primary
- **Rosso Ingranaggio** (#e4292a): ciò che manca o non va — l'assenza nell'appello, il SENZA APPELLO, i dati mancanti, gli errori — e, in segreteria, solo i tasti di ciò che non si annulla (FAI LA RICEVUTA, STAMPATO CANCELLALO, IMPORTA). Fuori dalla segreteria resta anche l'azione principale (`btn-primary`, avvio del timer) e il timbro kanji. Non è un colore dei corsi. Uguale nei due temi per bordi e fondi; come testo piccolo diventa **Rosso Testo** (`--rosso-testo`: #ff5a52 sul tema scuro, #b81d1d sul chiaro), perché il rosso del marchio si ferma a 3,8:1.

### Secondary
- **Verde Ingranaggio** (#16a54a; #12913f sul tema chiaro): conferma e presenza. Come testo piccolo sul tema chiaro diventa **Verde Testo** (#0b7a33, `--verde-testo`), come il giallo. Tasto `btn-go`, "SEGNA LA PRESENZA" del tablet, riga presente, conteggio completo, toast di conferma.

### Tertiary
- **Giallo Ingranaggio** (#f4c31b): avviso e attenzione. Bordi delle prove, spia della coda offline, giorno di oggi, bollino PROVA. Come testo sul tema chiaro diventa **Giallo Testo** (#8f6a00), perché il giallo puro sul bianco non si legge.
- **Blu Ingranaggio** (#1b8ac4): informazione quieta. I puntini delle lezioni nella striscia dei giorni, le barre delle statistiche.

### Neutral
- **Nero Palestra** (#121212 / chiaro #f4f4f1): fondo di pagina; anche il testo sopra i colori del marchio (`su-colore`) in entrambi i temi.
- **Superficie** (#1c1c1c / chiaro #ffffff): card, righe, campi.
- **Superficie Alta** (#242424 / chiaro #e9e9e5): stato selezionato (giorno scelto, scheda attiva, chip premuto).
- **Menu** (#161616 / chiaro #ebebe7): la colonna del menu di segreteria.
- **Riga** (#333333 / chiaro #d4d4ce): i bordi da 2px di ogni contenitore e tasto.
- **Riga Tenue** (#2a2a2a / chiaro #e2e2dd): divisori, linea dei titoletti, separatori tra colonne.
- **Tratteggio** (#4a4a46 / chiaro #b0b0aa): bordi tratteggiati di "aggiungi" e del riquadro firma.
- **Testo** (#f2f2f0 / chiaro #161616), **Testo Secondario** (#c9c9c4 / #3d3d3a), **Testo Spento** (#8c8c88 / #6b6b67), **Testo Flebile** (#5a5a56 / #a8a8a3): quattro gradini di testo, dal nome al segnaposto.
- **Tasto** (#b8b8b2 / chiaro #4a4a46): il testo dei tasti a linea a riposo, che si accende in `testo` al passaggio.

### Named Rules
**La Regola del Segnale Unico.** Ogni colore del marchio ha un significato e uno solo. Il rosso non decora, il verde non è "brand": se un elemento è verde, qualcosa è fatto o presente. In segreteria il rosso dice solo «manca» o «non si torna indietro». Nella settimana è rosso solo il SENZA APPELLO; istruttore? e sala? sono grigi, perché sono buchi del corso e il rosso lo hanno in CORSI. Le lezioni passate con l'appello fatto si fanno da parte (fondo trasparente, bordo tenue). In DA FARE il numero è rosso solo per ciò che è già un guaio (appelli, certificati mancanti, quote); giallo (`giallo-testo`) per ciò che aspetta una risposta o scade presto, come i numeri del menu; le stampe stanno in una riga neutra in fondo.

**La Regola dei Colori dei Corsi.** Un corso si colora fra Blu, Viola (#8b5cc4, fuori dal marchio, scelto apposta per non essere un segnale), Giallo e Verde. Mai Rosso (`supabase/26-colori-corsi.sql`).

**La Regola della Tinta del Corso.** Il colore di un corso arriva come `--tinta` e vive solo su un bordo spesso (sinistra 6–8px, o in alto 4–6px). Mai come fondo pieno.

**La Regola del Testo sul Colore.** Sopra verde, giallo e blu pieno il testo è `su-colore` (#121212), in entrambi i temi. Sopra il rosso è bianco (#ffffff): il nero si ferma a 4,1:1, il bianco arriva a 4,5:1.

## Typography

**Display Font:** Saira Condensed (con 'Helvetica Neue', Arial)
**Body Font:** Barlow (con 'Helvetica Neue', Helvetica, Arial)

**Character:** Una condensata sportiva, da tabellone, inclinata di 9° come il lettering del marchio, accanto a una grottesca morbida e leggibile per nomi e frasi. I font sono serviti in locale da `public/fonts` (licenza OFL), nessuna richiesta a Google.

### Hierarchy
- **Display** (700, 56px, 1): l'ora del tablet di sala; il conteggio dell'appello a 46px. Numeri tabellari.
- **Headline** (700, 34–40px, 1): titolo di sezione della segreteria, nome della sala sul tablet, lezione aperta (38px).
- **Title** (700, 19–22px, 1.05): nome della lezione, ora, nome sul tablet (22px), tasti.
- **Body** (Barlow 500, 17px, 1.4): nomi nell'appello, campi, testo dei moduli.
- **Body small** (Barlow 400, 13–15px, 1.35–1.5): note, dettagli, frasi sotto i titoli, in `testo-spento`.
- **Label** (Saira 700, 11–16px, 0.12–0.24em, maiuscolo): titoletti di sezione con la riga, etichette dei campi, bollini, fasi.

### Named Rules
**La Regola dell'Obliquo.** L'obliquo 9° (`.ob`, `font-style: oblique 9deg`) è per i tasti e il marchio. Non per il testo corrente.

**La Regola dei Numeri Tabellari.** Orari, conteggi e prezzi usano `.num`/`.cond` con `tabular-nums`: le cifre non ballano quando cambiano.

**La Regola del Maiuscolo Spaziato.** Le etichette sono maiuscole e spaziate largo (0.12–0.24em); i nomi delle persone mai.

## Layout

Telefono prima: una colonna con 20px di margine laterale, la testata col marchio a sinistra e le schede che vanno a capo sotto. Da 640px il contenuto si centra in una colonna di 720px; da 768px le iscrizioni vanno in due colonne; da 960px (`LARGO` in `lib/largo.ts`) calendario e appello si affiancano (`minmax(380px, 460px)` + resto), ciascuno col suo scorrimento, e l'appello diventa una griglia `auto-fill minmax(260px, 1fr)`.

La segreteria è un'app da scrivania: menu fisso di 240px a sinistra, corpo con 36px di margine e 18px tra i blocchi, tabelle larghe; sotto i 1000px le colonne si impilano. Il tablet di sala usa 32px di margine (16px sotto i 900px), griglie a tessere `minmax(190px, 1fr)` e due colonne `1fr 380px` in orizzontale.

Ritmo: gap 4px tra caselle sorelle (giorni, schede), 6–8px tra righe d'elenco, 10–14px dentro le card, 18–28px tra sezioni. Le altezze rispettano `dvh` e le safe area (`--safe-t`, `--safe-b`).

**La Regola del Dito di Fretta.** Nessun bersaglio sotto 44px; le righe dell'appello stanno a 56px, i tasti del tablet a 60–96px. Le misure non sono estetica.

## Elevation & Depth

Piatto per scelta. La profondità è tonale (`nero-palestra` → `superficie` → `superficie-alta`) e di contorno (bordo 2px `riga`, che diventa `testo` quando l'elemento è selezionato o un pannello è in primo piano). Le ombre esistono solo per ciò che galleggia davvero sopra il contenuto.

### Shadow Vocabulary
- **Pannello flottante** (`box-shadow: 0 16px 50px rgba(0, 0, 0, 0.45)`): le playlist del tablet aperte sopra il piede.
- **Fascia di conferma** (`box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.6)`): la fascia in basso del tablet dopo un tocco.
- **Lettore in angolo** (`box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35)`): il player YouTube rimpicciolito.
- **Velo** (`rgba(0, 0, 0, 0.6)`): sotto cassetti e dialoghi della segreteria.

### Named Rules
**La Regola del Bordo che si Accende.** Selezione e fuoco si mostrano col bordo che passa a `testo` (o al colore dello stato), mai con un'ombra.

## Shapes

Squadrato. Raggio zero su tasti, card, campi, schede, chip, dialoghi e cassetti. I contorni sono pieni da 2px (3px su tessere e chip del tablet, che si guardano da lontano); tratteggiati quando indicano qualcosa da aggiungere, da firmare, o un dato letto e non scritto. La tinta di un corso è una barra spessa sul lato sinistro o in alto. L'unica eccezione al raggio zero è il **timbro kanji** degli istruttori (3–6px, bordo rosso), e i piccoli raggi 2–4px delle barre nelle statistiche.

## Components

### Buttons
Decisi e da palestra: maiuscolo, obliquo, spaziato largo.
- **Shape:** squadrato (0px), alto 56px sul telefono (`.btn`), 48px in segreteria (`.sg-btn`), 60–88px sul tablet (`.tb-btn`, `.tb-btn-segna`).
- **Primario:** fondo Rosso Ingranaggio, testo `su-rosso` (bianco), Saira 700 19px, 0.16em, obliquo 9°, padding 0 22px.
- **Primario in segreteria** (`.sg-btn-pieno`): fondo `testo`, testo `nero-palestra` — si legge come tasto principale senza usare il rosso. `.sg-btn-rosso` (testo bianco) è solo per ciò che non si annulla.
- **Vai:** fondo Verde Ingranaggio, per confermare una presenza o un invio.
- **Linea / Ghost:** bordo 2px `riga`, testo `tasto`; al passaggio bordo `testo-spento` e testo `testo` (120ms).
- **Tratteggiato:** bordo 2px tratteggiato `tratteggio`, largo quanto la colonna, per "aggiungi".
- **Disabilitato** (in segreteria): blocco `superficie-alta` senza bordo, testo `testo-spento`, `not-allowed` — non somiglia né al tasto pieno né a quello a linea; accanto, il motivo («Scrivi il titolo»). Altrove opacità 0.4.
- **Fuoco:** contorno 2px `testo` con 2px di distanza.

### Icon Button
Quadrato 44px con bordo 2px `riga` e segno in `tasto`; quando contiene una parola si allarga (`.icon-btn.testo`).

### Chips & Schede
- **Chip** (`.sg-chip`): 44px, bordo 2px, Saira 13px 0.12em; premuto: bordo `testo` e fondo `superficie-alta`. Variante piena: fondo `testo`, testo `nero-palestra`.
- **Schede** (`.scheda`): righe di tasti uguali con gap 4px; attiva: fondo `superficie-alta`, bordo e testo `testo`.
- **Scelte del modulo di iscrizione** (`.modulo-corso`): bordo 2px `riga`, quadratino da 22px a sinistra; scelta = bordo `testo`, fondo `superficie-alta`, quadratino con ✓ (più risposte) o ● (una sola) in `testo`. Non è verde: scegliere non è fatto. È verde solo il file caricato.
- **Bollini** (`.prova-marchio`, `.spia-coda`, `.sg-tag`): 11px maiuscolo spaziato, bordo 2px giallo o fondo pieno; 13px nella testata di un filo delle segnalazioni.

### Cards / Containers
- **Corner Style:** 0px.
- **Background:** `superficie`, su fondo `nero-palestra`.
- **Border:** 2px `riga`; i toni cambiano il bordo (giallo per prova, rosso per guaio) o aggiungono una barra sinistra di 4px.
- **Fatto e messo da parte** (lezione passata, segnalazione chiusa): fondo trasparente, bordo `riga-tenue`, titolo `testo-secondario`.
- **Messaggi di un filo:** quelli degli altri hanno una barra sinistra di 4px `testo-spento` e un rientro; quelli della segreteria no.
- **Internal Padding:** 14px (telefono), 20–28px (segreteria e tablet).

### Inputs / Fields
- **Style:** bordo 2px `riga`, fondo `superficie` (in segreteria `nero-palestra`), alto 52px (44px in segreteria, 56px sul tablet), Barlow 17px.
- **Focus:** il bordo passa a `testo`, nessun alone.
- **Errore:** bordo ed etichetta rossi, nota sotto in `testo` (il rosso sullo scuro non arriva a 4,5:1), che dice cosa fare («togli 5 caratteri»); avviso in `giallo-testo`. **Sola lettura:** bordo tratteggiato, testo spento, fondo trasparente.

### Navigation
- **Testata** (telefono/tablet verticale): marchio a ingranaggi e nome obliquo a sinistra, schede sotto; da 960px stessa riga e bordo inferiore `riga-tenue`.
- **Menu di segreteria:** colonna di 240px su `menu`; voci Saira 16px 0.12em in `testo-secondario`; la voce corrente ha la barra sinistra 4px del colore `testo` e fondo `superficie` (mai rossa: il rosso è per ciò che manca); i numeri delle voci sono bollini gialli a destra.

### Riga dell'appello (firma del sistema)
Riga piena larga 56px: segno grande a sinistra (Saira 22px), nome Barlow 17px. Tre stati senza leggere: presente = bordo e segno verdi; assente = bordo e segno rossi, nome barrato e spento; non segnato = bordo `riga`.

### Lezione e Striscia dei giorni
La lezione è una riga con barra sinistra 6px nella tinta del corso, ora e nome in Saira, conteggio a destra che diventa verde a appello fatto. La striscia dei giorni è una griglia di 7 caselle alte 62px: oggi ha il numero giallo, il giorno scelto bordo `testo` e fondo `superficie-alta`, i puntini blu contano le lezioni.

### Tessere del tablet
Nomi da toccare alti 84px, bordo 3px, Barlow 22px (sono nomi di persona: niente Saira maiuscola); segnato = bordo e testo verdi su `superficie-alta`. La lezione aperta ha il tasto più grande dello schermo (88px, verde).

### Timbro kanji
Il carattere dell'istruttore in un quadrato con bordo rosso e raggio 3px, in un serif giapponese di sistema; tre misure (22, 32, 56px).

## Do's and Don'ts

### Do:
- **Do** usare i token di `:root` (`--bg`, `--surface`, `--line`, `--rosso`…) e mai esadecimali sciolti: il tema chiaro li ridefinisce.
- **Do** dare a ogni stato un bordo colorato e un segno grande, così si legge da lontano.
- **Do** tenere i bersagli ad almeno 44px, 56px per le righe che si toccano in piedi, 60px+ sul tablet.
- **Do** scrivere tasti ed etichette in maiuscolo Saira Condensed, tasti obliqui 9°.
- **Do** usare `su-colore` (#121212) per il testo sopra verde, giallo e blu pieno; `su-rosso` (bianco) sopra il rosso.
- **Do** usare `--giallo-testo`, `--verde-testo` e `--rosso-testo` per giallo, verde e rosso scritti, mai `--giallo`, `--verde` o `--rosso` puri come testo piccolo.

### Don't:
- **Don't** arrotondare angoli: raggio 0 ovunque, salvo il timbro kanji.
- **Don't** usare ombre per dare profondità a card o tasti; solo per ciò che galleggia (playlist, fascia, lettore).
- **Don't** usare gradienti o fondi pieni nella tinta del corso: la tinta vive su una barra di bordo.
- **Don't** usare un colore del marchio per decorare: rosso è mancanza o errore, verde è fatto, giallo è avviso.
- **Don't** dare il rosso a un corso, alla voce attiva del menu o a un tasto che si può annullare.
- **Don't** caricare font da servizi esterni: i caratteri stanno in `public/fonts`.
- **Don't** mettere il maiuscolo spaziato sui nomi delle persone.
