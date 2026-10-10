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
  riga-campo: "#6e6e6a"
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
  riga-campo-chiara: "#8a8a85"
  testo-chiaro: "#161616"
  testo-spento-chiaro: "#656561"
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
- **Riga Campo** (#6e6e6a / chiaro #8a8a85): il bordo dei campi e delle scelte del modulo, a 3:1 sul fondo (WCAG 1.4.11): `Riga` sul nero non ci arriva. Campi, scelte e il tasto INDIETRO dei passi; il resto resta su `Riga`.
- **Riga Tenue** (#2a2a2a / chiaro #e2e2dd): divisori, linea dei titoletti, separatori tra colonne.
- **Tratteggio** (#4a4a46 / chiaro #b0b0aa): bordi tratteggiati di "aggiungi" e del riquadro firma.
- **Testo** (#f2f2f0 / chiaro #161616), **Testo Secondario** (#c9c9c4 / #3d3d3a), **Testo Spento** (#8c8c88 / #656561), **Testo Flebile** (#5a5a56 / #a8a8a3): quattro gradini di testo, dal nome al segnaposto. Il segnaposto dei campi della segreteria (Cerca iscritto) usa lo Spento, non il Flebile: è l’unica indicazione di cosa scrivere e deve leggersi.
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
- **Titolo di gruppo** (700, 26px, 1, riga 2px `riga` sopra): un gruppo di riquadri dentro una sezione lunga (i gruppi di IMPOSTAZIONI), la scheda di un iscritto.
- **Title** (700, 19–22px, 1.05): nome della lezione, ora, nome sul tablet (22px), tasti.
- **Body** (Barlow 500, 17px, 1.4): nomi nell'appello, campi, testo dei moduli.
- **Body small** (Barlow 400, 13–15px, 1.35–1.5): note, dettagli, frasi sotto i titoli, in `testo-spento`.
- **Label** (Saira 700, 11–16px, 0.12–0.24em, maiuscolo): titoletti di sezione con la riga, etichette dei campi, bollini, fasi.

### Named Rules
**La Regola dell'Obliquo.** L'obliquo 9° (`.ob`, `font-style: oblique 9deg`) è per i tasti e il marchio. Non per il testo corrente.

**La Regola dei Numeri Tabellari.** Orari, conteggi e prezzi usano `.num`/`.cond` con `tabular-nums`: le cifre non ballano quando cambiano.

**La Regola del Maiuscolo Spaziato.** Le etichette sono maiuscole e spaziate largo (0.12–0.24em); i nomi delle persone mai. Eccezione: le voci del menu di segreteria stanno a 0.1em da 768px, perché nessuna vada a capo accanto al suo numero.

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
- **Shape:** squadrato (0px), alto 56px sul telefono (`.btn`), 48px in segreteria (`.sg-btn`), 60–88px sul tablet (`.tb-btn`).
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
- **La famiglia** (`.famiglia-chip`, modulo a passi): con più persone, sotto l'avanzamento, in ogni passo tranne l'ultimo, una pastiglia per persona (`Chip`: un `.sg-chip` col nome in maiuscolo, a capo). Quella che si sta scrivendo è accesa; le altre portano un `.sg-tag` giallo col numero delle cose che mancano. Chi si iscrive da solo non la vede nei passi. AGGIUNGI UN FAMILIARE sta solo all'ultimo passo, dopo il riepilogo e prima di mandare: sotto LA FAMIGLIA, il titolo «Iscrivi anche qualcun altro della famiglia?» (`.passo-titolo`), la frase e il tasto tratteggiato (`.btn-dashed`) a tutta riga; a sei persone al suo posto sta il riquadro SIETE IN SEI col tasto CHIAMA. Il foglio **CHI AGGIUNGI?** (`.foglio`) sale dal fondo sotto il velo, largo al massimo 520px: UN ADULTO o UN BAMBINO, per il bambino CHI FIRMA PER LUI? fra gli adulti già nella famiglia, poi AGGIUNGI e ANNULLA a tutta larghezza. Con più persone il totale sopra la barra è quello della famiglia: una cifra per persona e lo sconto a parte («Luca 155 € + Paola 350 € − sconto famiglia 60 €»).
- **Schede** (`.scheda`): righe di tasti uguali con gap 4px; attiva: fondo `superficie-alta`, bordo e testo `testo`.
- **Scelte del modulo di iscrizione** (`.modulo-corso`): bordo 2px `riga`, quadratino da 22px a sinistra; scelta = bordo `testo`, fondo `superficie-alta`, quadratino con ✓ (più risposte) o ● (una sola) in `testo`. Non è verde: scegliere non è fatto. È verde solo il file caricato. Sotto il nome di un corso, età e orari del listino in Barlow 13px `testo-spento` (`testo-secondario` sul tasto scelto, per il contrasto); con la data di nascita, sotto i corsi della sua età vengono i gruppi SENZA FASCIA D'ETÀ e ALTRI CORSI, ciascuno dopo la sua etichetta; se si sceglie un corso fuori età, sotto l'ultimo gruppo un avviso in `giallo-testo` lo nomina. Il **COMUNE dal CAP** (modulo a passi): un comune solo si scrive nel campo, con sotto la nota in `giallo-testo` («Dal CAP …»); fino a sei comuni, sotto il campo la frase 14px e i comuni come scelte `una` affiancate (`SceltaCorsi`); più di sei, una tendina `.campo` con l'etichetta «IL CAP … È DI N COMUNI». Nella scheda iscritto della segreteria (DATI ANAGRAFICI) è lo stesso, coi componenti della segreteria: nota del `Campo`, comuni come `.sg-chip`, tendina `.sg-campo`. Per il genitore che si iscrive col figlio, dentro il riquadro giallo «Ti iscrivi anche tu?», l'elenco comincia con **ALLA STESSA ORA DI** e il nome del figlio, etichetta in `giallo-testo` (`.modulo-etichetta-stessa-ora`); poi GLI ALTRI CORSI PER LA TUA ETÀ (staccato come gli altri gruppi, `.modulo-altri`), SENZA FASCIA D'ETÀ, ALTRI CORSI. Un corso scelto che non è più alla stessa ora ha sotto la riga, sul tasto stesso, l'avviso in Barlow 13px 600 `giallo-testo` (`.modulo-corso-avviso`).
- **Avanzamento** (`.avanza`, modulo a passi): un segmento per passo, alto 6px e gap 4px; passi fatti in `verde`, quello di adesso in `testo`, gli altri in `riga`. Sotto, il numero del passo in Saira 56px e accanto, su due righe, «DI N» e il nome del passo in Saira 15px 0.16em `testo-secondario`. Per chi legge lo schermo dice «Passo N di N: nome».
- **Barra del passo** (`.barra-passo`): resta in fondo allo schermo (sticky), con bordo sopra 2px `riga` e fondo del tema. Sopra i tasti: cosa manca in una riga sola, alta 44px a prescindere da quante voci sono (titolo «MANCANO N» in `rosso-testo`, il tasto «VAI A: prima voce» con bordo 2px `rosso`, e ▾ con bordo `riga-campo` che apre l'elenco; ogni voce è un tasto alto 44px che porta al campo, l'elenco scorre dentro la barra fino a 30dvh; Saira 13px 0.12em) oppure, se non manca niente, la nota con ✓ `verde-testo`. Sotto: INDIETRO largo 110px e AVANTI che prende il resto, principale, o `vai` verde all'ultimo passo, che manda. Quando INDIETRO chiede (due tocchi), la domanda prende tutta la riga e AVANTI scende sotto. Nei passi del corso e dei documenti, sopra la barra sta sempre il **totale**: una riga con fondo `superficie`, bordo sopra 2px `riga`, a sinistra cosa lo compone (14px `testo-secondario`: «Quota 50 € + Judo adulti annuale 360 €»), a destra la cifra in Saira 28px 700 `testo`; senza corso scelto non c'è.
- **Riepilogo** (`.riepilogo`): riquadro `.card` con una riga per cosa, alta almeno 56px, divise da 2px `riga-tenue`. A sinistra il segno, Saira 22px: ✓ `verde-testo` (fatto), – `giallo-testo` (manca una cosa facoltativa), ! `rosso-testo` (non va), oppure il numero della riga («E ADESSO»). Titolo Barlow 600, sotto il dettaglio 13px `testo-spento`. A destra il tasto (MODIFICA, CARICA) alto 44px, bordo 2px `riga`, Saira 13px 0.14em.
- **Bollini** (`.prova-marchio`, `.sg-bollino`, `.sg-tag`, `.sg-segno-regola`): 12px maiuscolo spaziato (11px `.prova-marchio` e `.sg-bollino`, DATI DI PROVA: devono stare nei 56px del menu), bordo 2px giallo o fondo pieno; 13px nella testata di un filo delle segnalazioni.
- **Etichetta attività** (`.attivita-et`): cosa si fa in una lezione, accanto all'orario. Saira 700 12px (15px sul tablet, che si legge da due metri), maiuscolo, 0.1em, bordo 2px `riga`, testo `testo-secondario`; al massimo due righe, poi «…», col nome intero nel `title`. Vuota non c'è: né etichetta né spazio. L'orario non va mai a capo: a stringersi è l'etichetta.

### Cards / Containers
- **Corner Style:** 0px.
- **Background:** `superficie`, su fondo `nero-palestra`.
- **Border:** 2px `riga`; i toni cambiano il bordo (giallo per prova, rosso per guaio) o aggiungono una barra sinistra di 4px.
- **Fatto e messo da parte** (lezione passata, segnalazione chiusa): fondo trasparente, bordo `riga-tenue`, titolo `testo-secondario`.
- **Messaggi di un filo:** quelli degli altri hanno una barra sinistra di 4px `testo-spento` e un rientro; quelli della segreteria no.
- **Internal Padding:** 14px (telefono), 20–28px (segreteria e tablet).
- **Numero** (`.sg-numero`, in fila in `.sg-numeri`): il conto in cima a una sezione di segreteria (PRESENZE, STATISTICHE, VESTIARIO). Fondo `superficie`, bordo 2px `riga`, padding 16px 18px; etichetta Saira 12px 0.2em `testo-spento`, cifra Saira 44px 700, riga sotto 13px `testo-spento`. **Allarme** (da saldare, assenze): bordo `rosso` ed etichetta `rosso-testo`. Quattro per riga; VESTIARIO ne ha cinque (`data-cinque`), due per riga sotto i 1000px.
- **Barra per salvare** (`.sg-listino-salva`, LISTINO e VESTIARIO): c'è solo con una bozza diversa da quella salvata, sticky in fondo; fondo `superficie`, bordo 2px `giallo`, padding 12px 16px. A sinistra la frase in 14px `testo-secondario` (cosa cambia, «fino a SALVA resta com'era»), o cosa non va in `rosso-testo` con SALVA spento; poi BUTTA I CAMBI (linea, chiede) e SALVA (pieno).
- **Spiegazione a richiesta (`.sg-spiega`):** la spiegazione lunga di un riquadro, chiusa in un `<details>`. Il tasto «COME FUNZIONA?» è un'etichetta Saira 700 13px, 0.12em, in `testo-secondario`, alta 44px, con `+` / `−` davanti che dice se è aperta; aperta passa a `testo`. Fuoco: contorno 2px `testo`. Numeri, stati e avvisi non ci vanno mai dentro.

### Inputs / Fields
- **Style:** bordo 2px `riga`, fondo `superficie` (in segreteria `nero-palestra`), alto 52px (44px in segreteria, 56px sul tablet), Barlow 17px.
- **Focus:** il bordo passa a `testo`, nessun alone.
- **Errore:** bordo ed etichetta rossi, nota sotto in `testo` (il rosso sullo scuro non arriva a 4,5:1), che dice cosa fare («togli 5 caratteri»); avviso in `giallo-testo`. **Sola lettura:** bordo tratteggiato, testo spento, fondo trasparente.

### Navigation
- **Testata** (telefono/tablet verticale): marchio a ingranaggi e nome obliquo a sinistra, schede sotto; da 960px stessa riga e bordo inferiore `riga-tenue`.
- **Menu di segreteria:** colonna di 240px su `menu`; voci Saira 16px 0.12em in `testo-secondario` (0.12em solo sul telefono, 0.1em da 768px; da 1001px nessuna va a capo); da 768px i tre tasti (?, tema, impostazioni) e il bollino DATI DI PROVA stanno in cima, sotto il marchio, in una riga alta 44px (sul tablet il bollino va sotto; sul telefono i tre tasti stanno nella barra in cima); COPIA LINK e chi è entrato in fondo, e scorrono con le voci; la voce corrente ha la barra sinistra 4px del colore `testo` e fondo `superficie` (mai rossa: il rosso è per ciò che manca); i numeri delle voci sono bollini gialli a destra.

### Firma a schermo intero
`TavolaFirma` si apre da FIRMA A SCHERMO INTERO o da un tocco sul riquadro (`FirmaSchermoIntero.dc.html`). Copre tutto (`position: fixed`, altezza = `visualViewport.height` in `--altezza-firma`, con `100dvh` di riserva: su iOS Safari con le barre in vista `100dvh` non basta; safe area) e sta ferma: `touch-action: none`, `overscroll-behavior: none`, pagina sotto `inert`, tasto indietro disattivato. In cima ANNULLA, il nome (in verticale solo il nome, su una riga con i puntini; in orizzontale «LA FIRMA DI nome») e FATTO (rosso solo con una firma vera, se no `surface-2` con testo `dim`, 4,6:1 scuro e 4,8:1 chiaro); in mezzo il riquadro tratteggiato con la riga a un quarto dal fondo.
- **Verticale**: sotto il riquadro CANCELLA E RIFAI. Tasti da 48px. L'avviso di rotazione sta dentro il riquadro, come in orizzontale (un solo elemento, sempre montato). Dentro il riquadro, in cima (non copre la riga), un riquadro con bordo e testo `giallo-testo`, non cliccabile, con un telefono SVG a linea che si gira: «GIRA IL TELEFONO IN ORIZZONTALE: FIRMI MEGLIO». Sparisce al primo dito, a telefono già girato e se c'è l'avviso di rotazione (`invitoGirare`).
- **Orizzontale**: una sola barra compatta da 56px, tasti da 44px (ANNULLA · nome · CANCELLA E RIFAI · FATTO), niente piede, riquadro a 8px dai bordi: prende l'80% e oltre dell'altezza visibile (346 su 420, 256 su 330). L'avviso «Hai girato il telefono: firma di nuovo» sta dentro il riquadro, sopra la riga e l'invito, e sparisce alla prima penna.

Nel modulo FIRMA A SCHERMO INTERO è a tutta larghezza, 56px, rosso a firma vuota e linea («RIFAI …») a firma fatta, con sotto «In orizzontale firmi meglio: gira il telefono quando apri la firma.». Girando il telefono la bozza si cancella e un avviso giallo lo dice.

### Riga dell'ordine di vestiario
- **Telefono** (la pagina degli ordini, `RigaOrdine`): un riquadro `.card` per riga, padding 14px, gap 8px; in cima «RIGA N» (Saira 15px 0.24em `testo-spento`) e, dalla seconda, «Togli» sottolineato 14px `testo-secondario`, alto 44px. Sotto i campi del modulo: PER CHI · NOME E COGNOME, CAPO («capo · prezzo»), TAGLIA e QUANTI affiancati. Con un capo scelto, in fondo «N × prezzo» e il prezzo della riga sopra un filo 2px `riga`, 17px 700. Quel che manca è la nota rossa sotto il campo, col suo bordo rosso: il riquadro resta com'è.
- **Segreteria** (ordine aperto e NUOVO ORDINE, `.sg-righe-vestiario`): una riga di campi `.sg-campo` sotto la testata della tabella (PER CHI, CAPO, TAGLIA, QUANTI, PREZZO), griglia 1fr 1.7fr 84px 68px 64px 44px, gap 10px, filetto 1px `superficie-alta`; prezzo Saira 16px 700 a destra, «Togli» `.sg-link` solo con più di una riga; una taglia fuori catalogo ha il bordo `rosso`, e la frase («Manca: la taglia della riga 2») sta sotto le righe. Sotto i 1000px la testata sparisce, le etichette dei campi si vedono e la riga va su due colonne.
- **Elenco degli ordini** (`.sg-riga-vestiario`): come la tabella degli iscritti; lo stato è un `.sg-segno-regola` con la parola (DA SALDARE rosso, SALDATO verde, ANNULLATO spento). L'annullato ha il testo `testo-spento` ma non è trasparente: si legge ancora. Sotto il nome, 12px `testo-spento`, quando e da dove è arrivato («Arrivato il 9 ottobre, 16:10 · dal link»); accanto, il bollino giallo STESSO TELEFONO se un altro ordine della raccolta ha lo stesso numero (giallo: è da guardare, non un guaio). Sotto il totale, 12px 600 `rosso-testo`, quel che manca a chi ha pagato una parte («mancano 7 €»). Non c'è un «da rendere»: corretto al ribasso, un ordine saldato resta saldato; TOGLI IL SEGNO si offre solo se il totale sale.
- **Il pagamento di un ordine:** SEGNA SALDATO è un'etichetta con tre tasti verdi, uno per modo (BONIFICO, SATISPAY, CONTANTI): si segna com'è arrivato, senza un passo in più. Saldato, il riquadro ha il bordo `verde` e dice «Saldato con bonifico il 5 ottobre»; con una parte pagata, sopra, «Pagati 63 € · mancano 7 €» in Saira 15px. Dal banco, SALVA, GIÀ SALDATO ha accanto la tendina del modo («in contanti» di partenza).

### Riga dell'appello (firma del sistema)
Riga piena larga 56px: segno grande a sinistra (Saira 22px), nome Barlow 17px. Tre stati senza leggere: presente = bordo e segno verdi; assente = bordo e segno rossi, nome barrato e spento; non segnato = bordo `riga`.

### Lezione e Striscia dei giorni
La lezione è una riga con barra sinistra 6px nella tinta del corso, ora e nome in Saira, conteggio a destra che diventa verde a appello fatto. La striscia dei giorni è una griglia di 7 caselle alte 62px: oggi ha il numero giallo, il giorno scelto bordo `testo` e fondo `superficie-alta`, i puntini blu contano le lezioni.

### Tessere del tablet
- **Appello veloce** (`.tb-veloce`): sotto la lezione aperta i nomi stanno a tre colonne, righe alte 60px, bordo 2px, Barlow 22px (sono nomi di persona: niente Saira maiuscola; «Giacomo Maria R.» con la spunta sta in una riga a 1280px e in verticale a 800px); segnato = bordo e testo verdi su `superficie-alta`, con la spunta. Le tessere delle altre schermate (`.tb-tessera` da sola) restano da 84px con bordo 3px.
- **Lezione aperta** (`.tb-aperta-lezione`): la card è un tasto che apre l'appello intero (aria-label «Apri l'appello: corso»), con AREA ISTRUTTORE (`.tb-btn-linea`) a destra, in ogni card se le aperte sono due. Senza lezione aperta AREA ISTRUTTORE sta in basso a sinistra. Il vecchio tasto verde da 88px non c'è più.
- **Gruppi della giornata** (`.tb-gruppo`): a destra PRECEDENTI, IN CORSO, PIÙ TARDI, titolo da 15px; in IN CORSO le lezioni seguono l'ordine delle card a sinistra, la più recente in cima.
- **Testata:** i tasti tema e Accensione (esci dal tablet) sono da 60px con icone da 28px, solo dentro `.tb-testata`; la testata sta su una riga a 1280px e in verticale.
- **Piede:** `.tb-btn-quadro` è un tasto da 60px quadrato con la sola icona (la nota della musica).

### Musica del telefono
- **Barra della musica** (`.musica-telefono`, in fondo alla pagina TIMER dell'app istruttori, sticky sopra la barra delle pagine): la barra del tablet (`MusicaSala`) su due righe, larga al massimo 560px. Sopra il brano e il volume − N + a 44px; sotto ⏮ ▶ ⏭ ☰ ✕ a 52px, con ▶ che prende il resto. Ferma dopo un ricaricamento, ▶ è verde pieno e la riga sotto dice «Tocca ▶ per farla partire» (non con un errore). Spenta, resta solo **ACCENDI LA MUSICA** (`.musica-accendi`, 52px). Con YouTube (`data-forma='video-accanto'`) il riquadro del video (200×200, `surface-2` con bordo 2px `line`) entra nella barra, a destra, e i comandi gli stanno accanto in colonna: il brano, ▶ largo, ⏮ ⏭, ☰ ✕, a 44px; niente volume. Il timer sopra resta in una colonna: dentro l'app un riquadro più stretto di 560px conta come verticale anche se è più largo che alto (`perLaSala`). Il pannello ☰ sale dal basso a tutta larghezza, titolo LA MUSICA.
- **Barra piccola** (`.musica-mini`): fuori dal TIMER, sopra la barra delle pagine (sullo schermo largo in fondo al corpo), alta 56px su `surface`: la nota, il titolo, **MUSICA** o **MUSICA IN PAUSA** scritto, e un solo tasto ⏸/▶ da 44px. Il resto riporta al TIMER. La striscia dell'allenamento sta in alto: le due non si toccano. Il lettore di YouTube nell'angolo si alza con `--angolo-player` per non coprire queste barre, e c'è solo mentre la musica suona o è in pausa; allora la pagina si allunga sotto di 212px (`SPAZIO_YOUTUBE`), così scorrendo CHIUDI e i nomi salgono sopra il video.
- **IMPOSTAZIONI** accanto al titolo TIMER (`.icon-btn.testo`, 44px): apre le impostazioni del timer (Spotify, i file) senza la barra delle schede del timer; aperte, diventa ‹ TIMER (e ‹ APPELLO sparisce). Non c'è con un allenamento aperto. Sotto i 380px resta solo l'ingranaggio.

### Timbro kanji
Il carattere dell'istruttore in un quadrato con bordo rosso e raggio 3px, in un serif giapponese di sistema; tre misure (22, 32, 56px).

### Timbri della scheda
In cima alla scheda di un iscritto (`.sg-timbro`), da non confondere col timbro kanji: rettangoli squadrati che sono tasti e portano alla loro sezione. Bordo 2px del tono dello stato con barra sinistra 4px, fondo `nero-palestra`; titoletto Label 12px in `testo-spento`, parola Title 22px nel `-testo` del tono (verde a posto, giallo da guardare, rosso manca), righe Saira 14px a 0.12em in `testo-secondario`; una riga che è un avviso a sé (DA STAMPARE) ha il suo riquadro giallo. Le parole sono quelle della colonna IN REGOLA, dalla stessa funzione (`timbriScheda`). **Piccolo** (il documento, che non serve per entrare): colonna più stretta, parola 19px, righe 12px spente. **Spento** (scheda disattivata): bordo `riga`, testo `testo-spento`, stesse parole; sopra, un avviso a bordo tratteggiato `testo` con DISATTIVATA in Saira e la frase in Barlow 15px, mai rosso perché si annulla. Al passaggio il bordo passa a `testo`. Sotto i 1000px si mettono uno sotto l'altro.

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
