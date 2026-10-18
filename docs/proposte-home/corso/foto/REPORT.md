# Foto della pagina del corso: ruoli, fuochi, sviluppo

**Decisione dell'utente (18/10/2026): le liberatorie ci sono per tutte le foto proposte.** Le colonne «Persone» sotto dicono solo chi si vede (minori, adulti, sfondi), non sono più un blocco; nessun cognome leggibile sul dorso nelle foto usate (la 698 di Judo non è usata). Pre pugilistica e Autodifesa restano **senza foto per ora**; nessuna foto di altri corsi.

Solo proposta. Libreria LightCraft in **sola lettura**: nessuna selezione, voto, flag o keyword toccati; l'app su 127.0.0.1:7980 non è stata usata per sviluppare (le due interrogazioni fatte hanno dato «too many control connections» e «connection reset»: lasciata in pace). I sorgenti sono stati letti **da disco** (`~/Downloads/Officine dello Sport/`), sviluppati come **copie** con `lightcraft-cli render` (nessun sidecar `.xmp`; **`--opt metadata=none`: niente EXIF, quindi niente GPS** — l'iPhone di IMG_2802 lo aveva), confrontati con `photocraft-cli run … filter.cameraRaw`. Niente su Supabase, sito o database.

Riproducibile: `sviluppa.sh` + `sviluppo.txt` (impostazioni per foto), `photocraft.py` (stesse regolazioni in PhotoCraft), `confronto.mjs` (fogli `confronto-1…3.png`: originale | LightCraft | PhotoCraft).

## Regole della pagina (per ogni corso)

La pagina ha **tre posti** per le foto, uno per ruolo, mai due volte la stessa foto in tutto il sito (home compresa):

| Ruolo | Dove | Cosa deve fare | Riquadro desktop · telefono |
|---|---|---|---|
| **A · Apertura** | testata, sotto il titolo | dire che sport è, al primo colpo d'occhio | 1344×619 (2,17) · 343×240 |
| **B · Interno** | accanto al testo «Cosa si fa» | mostrare il gesto o il rapporto istruttore-allievo | quadrato 440×440 · 343×300 (una foto verticale come la 164 vi sta con le tre teste e il busto) |
| **C · Chiusura** | colonna foto della chiamata «Una settimana per scegliere.» (≈ 672×535, a tutta altezza) · 343×240 | un volto o un gesto che accoglie | |

Le foto della home (gruppo, istruttori, cubi, sala) e le tre schede (161, 446, 989) **non** entrano nella pagina: nessuna ripetizione.

`object-position` = `x% y%`, `object-fit: cover`. Sono valori calcolati sulle posizioni dei soggetti nelle foto intere e **da confermare a occhio sulle anteprime** (`../../../design-canvas/corso-miglioramenti/anteprima-*.html`).

## Judo, Lotta, Aikido: il mix già scelto come foto di pagina

Foto già sviluppate in `docs/proposte-home/alternative/` (impostazioni lì). Copie in `approvate/`.

| Corso | Ruolo | Foto (`approvate/`) | Orient. | Fuoco desktop | Fuoco telefono | Persone visibili |
|---|---|---|---|---|---|---|
| Judo | A | `judo-A.jpg` = 690 (presa, due atleti) | O | `50% 12%` (tiene le due teste, perde i piedi) | `50% 50%` | 2 atleti adulti riconoscibili: consenso |
| Judo | B | `judo-B.jpg` = 164 (tre ragazzi abbracciati) | **V** | `50% 30%` | `50% 29%` | **3 minori riconoscibili in primo piano: liberatoria** |
| Judo | C | `judo-C.jpg` = 26 (ritratto istruttore) | O | `85% 50%` (toglie il quadro elettrico a sinistra) | `85% 50%` | istruttore adulto: consenso; una bambina di spalle sullo sfondo, non riconoscibile |
| Lotta | A | `lotta-A.jpg` = 418 (sollevamento) | O | `50% 20%` | `30% 50%` | **2 minori** (volti coperti/di profilo), adulto di spalle; tuta ODS leggibile, «ITA» |
| Lotta | B | `lotta-B.jpg` = 394 (il cinque a fine incontro) | O | `65% 50%` | `58% 50%` | **2 minori** con volto chiaro: liberatoria; adulto tagliato sul bordo destro |
| Lotta | C | `lotta-C.jpg` = 546 (istruttore e due bambini) | O | `10% 50%` | `10% 50%` | **2 bambini piccoli**, un istruttore, genitori sfocati sullo sfondo |
| Aikido | A | `aikido-A.jpg` = 949 (quattro istruttori) | O | `50% 8%` | `50% 50%` | 4 adulti: consenso; un bambino sfocato sul fondo, non riconoscibile |
| Aikido | B | `aikido-B.jpg` = 974 (proiezione, bambino in aria) | O | `24% 50%` | `33% 50%` | **minori**: il bambino proiettato e 3 bambini dietro riconoscibili; sponsor Fijlkam nello sfondo |
| Aikido | C | `aikido-C.jpg` = 874 (capovolta, adulto in hakama) | **V** | `50% 50%` | `50% 45%` | nessun volto; persone sedute lontane |

**Aikido A rifatta** (`aikido-A.jpg`, sorgente `DSC09379`, id 949 da confermare: 948 è `DSC09375`): l'alone giallo attorno a gonna e braccia c'è già nel file della macchina (sfocatura da ritratto), non nasce dallo sviluppo; sviluppo più leggero (ombre +8, luci −10, bianchi +5, nitidezza 35) rispetto a `alternative/aikido/949-aikido-C.jpg`, che non è più usato.

Note: Judo A e Aikido A sono le due aperture **senza minori** (giudizio mio dalla foto, età non verificata). La 418 di Lotta ha il logo ODS e «ITA»; la 446 della scheda è della stessa gara, quindi la pagina Lotta mostra due volte la stessa mattina (23/03/2025): accettabile, ma tre foto di un solo evento stancano (già segnalato in `alternative/lotta/REPORT.md`). Aikido B (974) e C vengono dall'evento Fijlkam: sfondi e sponsor non ODS (domanda D3 in `../testi/REPORT.md`).

## Gli altri sei corsi: libreria cercata, foto sviluppate

Cartelle guardate a miniature (54 + 55 + 158 + 98 + 9 file sciolti; 484 + 223 già viste dalle sessioni precedenti): **«2025 2 febbraio 20 officine»** (54 foto di sala pesi, mai usate prima) e **«2025 2 febbraio 22 avviam-prep-lotta-calist»** (55), più i file sciolti e `Facebook/`. Sviluppate 13 copie (12 nuove + Aikido A rifatta) (lato lungo 1800, JPEG q82; le due da Facebook sono di 1440 px: massimo nativo).

### Sviluppo (impostazioni LightCraft; esposizione/contrasto/luci/ombre/vibranza sono i `--set` di `sviluppo.txt`)

| Foto (`approvate/`) | Sorgente | Difetti | Cosa ho fatto | LightCraft vs PhotoCraft |
|---|---|---|---|---|
| `preparazione-atletica-A` | `IMG_2802.jpg` (id 1031) 5167×2903 | un po' piatta, luci; **GPS nel file** (tolto) | +0,1 EV, contrasto +6, luci −15, ombre +15, nitidezza 40 | pari |
| `preparazione-atletica-B` | cartella 22, `DSC_0043` | parete bruciata, **donna a sinistra morbida/mossa** | temp 5600, luci −20, ombre +15, nitidezza 45 | **LightCraft**: PhotoCraft lascia la parete gialla e più chiara |
| `preparazione-atletica-C` | `facebook_1188033673327241` (id 1100) 1440×1799 | sorgente piccola, logo in basso | +0,1 EV, ombre +12, nitidezza 30 | pari |
| `pesi-A` | cartella 20, `DSC_0066` | scura | temp 5700, +0,2 EV, luci −20, ombre +20 | pari (LightCraft di poco più pulita) |
| `pesi-B` | cartella 20, `DSC_0069` | scura, piatto rosso sfocato in primo piano | come pesi-A | pari |
| `pesi-riserva` | cartella 20, `DSC_0061` | **parete giallo-verde**, ombre chiuse; **volti morbidi, a fuoco solo il piatto** | temp 5700, +0,2 EV, luci −20, ombre +20, bianchi +10, rumore 15 | **LightCraft**: la dominante resta in PhotoCraft |
| `giocomotricita-A` | Cup, `DSC_0511` (id 539) | luce calda, ok | +0,15 EV, luci −15, ombre +15 | pari |
| `giocomotricita-C` | Cup, `DSC_0593` (id 585) | parete azzurrina | +0,1 EV, ombre +15 | pari |
| `giocomotricita-riserva` | Cup, `DSC_0603` (id 591) | idem; **altri cinque bambini**, stessa premiazione | idem | pari |
| `avviamento-A/B/C` | cartella 22, `DSC_0028`, `0030`, `0023` | **dominante rossa/magenta** sul tappeto e sulla pelle; **A e B: volti morbidi** (messa a fuoco sul fondo) | temp 5700, tinta −8, saturazione −8, luci −15, ombre +15, rumore 12 | LightCraft di poco: il rosso resta più acceso in PhotoCraft |

Giudizio sui fogli a 490 px: **differenze piccole**. LightCraft nettamente meglio solo dove c'è una dominante da togliere (pesi-A, preparazione-atletica-B); negli altri casi i due strumenti sono quasi uguali. PhotoCraft mai meglio. Temperatura convertita a occhio (5700 K → −20, scala di `filter.cameraRaw`).

Limiti onesti: i difetti di fuoco non si correggono (la donna in `preparazione-atletica-B`; `pesi-B` ha il piatto sfocato; i volti di `avviamento-A/B` e `pesi-riserva` sono morbidi: dichiarate deboli, da sostituire con scatti nuovi); nessuna maschera, nessun denoise a modello; nitidezza controllata sui fogli, non a 100 % su ogni volto.

### Ruoli e fuochi

| Corso | Ruolo | Foto | Orient. | Fuoco desktop | Fuoco telefono | Persone visibili |
|---|---|---|---|---|---|---|
| **Preparazione atletica** | A | `…-A` IMG_2802: sei persone con kettlebell e funi | O (16:9) | `50% 60%` (14 px sopra i capelli e sotto i piedi) | `40% 60%` | 6 adulti riconoscibili: consenso di tutti |
| | B | `…-B` DSC_0043: palla medica e disco, due persone | O | `70% 50%` | `80% 50%` | 2 adulti; **soggetto sinistro morbido**: seconda scelta |
| | C | `…-C` 1100: funi con l'istruttore | **V** | `50% 35%` | `50% 35%` | 2-3 adulti; sorgente Facebook 1440 px |
| **Sollevamento pesi** | A | `…-A` DSC_0066: disco rosso in primo piano, atleta supina (volto e piatto a fuoco) | O | `50% 55%` | `60% 50%` | 1 adulto, volto in parte coperto |
| | B | `…-B` DSC_0069: l'istruttrice che spiega | O | `45% 50%` | `45% 50%` | istruttrice adulta |
| | C | — (`pesi-riserva` DSC_0061: bilanciere con istruttrice in piedi, **volti morbidi**: solo se non ce n'è altra) | | | | 2 adulti riconoscibili |
| **Giocomotricità e psicomotricità** | A | `…-A` DSC_0511: l'istruttrice batte il cinque a un bambino | O | `50% 0%` | `40% 40%` | **2 bambini piccoli** + genitori sul fondo |
| | B | — (nessuna: i cinque volti di DSC_0593 occupano 1230 px su 1800, nel riquadro quadrato ne restano 1201: uno verrebbe tagliato; «Cosa si fa» va a tutta larghezza) | | | | |
| | C | `…-C` DSC_0593: cinque bambini piccoli in fila | O | `50% 50%` | `50% 50%` | **5 minori in primo piano** (la riserva DSC_0603 è un'altra fila di cinque bambini, stessa premiazione) |
| **Avviamento alle arti marziali** | A | `…-A` DSC_0028: istruttrice e bimbi che saltano la corda (**volti morbidi**) | O | `50% 40%` | `40% 50%` | **minori** (6-8) + istruttrice |
| | B | `…-B` DSC_0030: istruttrice e gruppo | O | `92% 50%` | `90% 50%` | **minori** |
| | C | `…-C` DSC_0023: girotondo con il nastro | O | `40% 50%` | `40% 50%` | **minori**, volti di spalle in parte |
| **Pre pugilistica** | | **nessuna foto** | | | | |
| **Metodo Globale di Autodifesa** | | **nessuna foto** | | | | |

### Cose da decidere (segnalate, non decise)

1. **Pre pugilistica e Autodifesa: nessuna foto in libreria — decisione: senza foto per ora** (né in `Facebook/`, che è quasi solo grafica). La pagina oggi mostra la foto dei judoka con la cintura nera: sbagliata per una pagina di boxe. Proposta: fascia tipografica con il titolo (nel mockup) finché non ci sono foto vere; **domanda: si può organizzare una mezz'ora di scatti a una lezione?**
2. **Giocomotricità: foto da una premiazione.** Le foto di Giocomotricità (Cup del 23/03/2025) sono bambini con la medaglia: l'età visibile pare 5-7 anni, il corso è 3-5; il gesto è una premiazione, non una lezione. **Q14** (report dei testi): c'è una foto di una lezione vera? **Chi sono i bambini di Avviamento e Giocomotricità**: foto.md assegna la 341 e la 343 (bambini in body di lotta, ~8-10 anni) alla Giocomotricità (3-5 anni): **non l'ho usata**. Le tre di Giocomotricità qui sono bambini piccoli veri; le tre di Avviamento vengono dalla cartella di febbraio 2025 («avviam-prep-lotta-calist»): da confermare che sia il gruppo giusto e l'età.
3. **Il nome di file `DSC_0163` e altri** esistono due volte (Cup e Esame cinture): per la pagina uso il percorso intero in `sviluppo.txt`; gli id di libreria sono quelli di `docs/sito/foto.md` dove noti (1031, 1100, 539, 585, 591), per le altre **da cercare** (non ho voluto riaprire l'app).
4. **Liberatorie**: chiuso, l'utente le ha per tutte le foto proposte.
5. **Risoluzione**: 1800 px su un riquadro da 1344 è 1,3× (ok); su uno schermo retina a tutta larghezza servirebbero 2688 px. La foto Facebook (1440 px, `preparazione-atletica-C`) va nel riquadro C da 672 px (2,1×: bene), non in uno più largo. In pagina: `width`/`height` dichiarati, `srcset` 720/1440/1800, `loading=lazy` sotto la piega, `fetchpriority=high` sulla testata (audit C12).
6. Le vecchie foto pubblicate nelle pagine corso (`12e605fc`, `46c39293`, `814a717b`, `18c88f1d`, `9b15677c`, `fbfe492b`, `1a03b6b2`, `72d0e1bc`, `6e742106`) escono tutte dalla proposta. Se il sito le cancella dal bucket o le lascia è una decisione sua.
