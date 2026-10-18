# Foto della home: prima e dopo

Sviluppo non distruttivo con LightCraft (import, `set_develop`, `render_preview`, `export`) e confronto con PhotoCraft (CLI). Originali in `originali/`, versioni LightCraft in `migliorate/`, versioni PhotoCraft in `photocraft/`, scelte finali in `approvate/` (`<id>-v2.jpg`, JPEG qualità 82). Niente caricato su Supabase, niente committato: decide l'utente.

**Lato lungo: 1800 px, non 2000.** Gli originali sul bucket sono già 1800 px sul lato lungo; portarli a 2000 sarebbe un ingrandimento che non aggiunge dettaglio, quindi l'export resta a misura nativa. Se serve davvero 2000, va rifatto da un file sorgente più grande.

**PhotoCraft: confrontato** con `photocraft-cli run … --cmd filter.cameraRaw` (stessi 7 originali, stessa misura nativa, JPEG q82), export in `photocraft/`. Le versioni scelte sono in `approvate/` (elenco in `approvate/VINCITORI.md`).

## Tabella

Impostazioni = valori `set_develop` di LightCraft (nr = riduzione rumore luminanza/colore, nitidezza = quantità/mascheratura).

| Foto | Difetti rilevati | Impostazioni | Peso prima → dopo |
|---|---|---|---|
| **Hero** `18c88f1d…` (gruppo, tappeto giallo) 1800×1012 | Piatta, grigia, poco contrasto; fotogramma da video, un po' morbido; parete con scrostature | esposizione +0,15, contrasto +14, alte luci −15, ombre +25, neri −8, vibranza +15, chiarezza +8, nitidezza 35/30, nr 12/20 | 284 KB → 239 KB |
| **Istruttori** `814a717b…` (cinture nere) 1800×1350 | Dominante calda sui judogi, leggermente morbida (probabile ricompressione) | temperatura 5900, esposizione +0,1, alte luci −10, bianchi −5, ombre +10, nitidezza 40/30, nr 10/15 | 459 KB → 360 KB |
| **Presa di judo** `46c39293…` 1201×1800 | Colori molto saturi, judogi giallini, alte luci sul soffitto | temperatura 6000, saturazione −8, alte luci −20, ombre +10, contrasto +5, nitidezza 35/30, nr 10/15 | 402 KB → 271 KB |
| **Bambino sui cubi** `40ae8db3…` 1800×1199 | Colori saturi quasi fluo, mosso/morbido sul soggetto, tinte verdi fredde | saturazione −18, alte luci −10, ombre +10, nitidezza 55 raggio 1,2, nr 15/20 | 360 KB → 196 KB |
| **Lotta** `701a887f…` 1201×1800 | Sottoesposta, dominante verde-azzurra, vignettatura scura | temperatura 7900, esposizione +0,7, ombre +40, neri +10, contrasto +5, vibranza +20, nitidezza 40/30, nr 25/25 | 293 KB → 213 KB |
| **Sala preparazione** `1a03b6b2…` 1201×1800 | Pareti bianche bruciate, rumore sulle zone scure, cromia un po' forzata | esposizione −0,25, alte luci −55, bianchi −15, ombre +20, saturazione −6, nitidezza 40/30, nr 25/25 | 513 KB → 318 KB |
| **Lezione in fila** `12e605fc…` 1169×1800 | Dominante gialla sulla parete, ombre chiuse, luce dal soffitto che brilla | temperatura 5700, esposizione +0,25, contrasto +8, alte luci −20, ombre +20, vibranza +8, nitidezza 40/30, nr 15/20 | 463 KB → 317 KB |

Totale: 2,77 MB → 1,81 MB (−35%) a parità di dimensioni.

## Cose da decidere (segnalate, non decise)

- **Minorenni riconoscibili**: hero (gruppo di bambini a volto scoperto), lotta (due ragazzi in primo piano + bambino seduto sullo sfondo), lezione in fila (ragazzi di spalle, un volto di profilo, nome «…ITA» leggibile sul dorso), presa di judo (ragazza sullo sfondo, probabile adulta ma da verificare). Bambino sui cubi: volto fuori campo. Servono le liberatorie, oppure ritagli o sostituzioni.
- **Orizzonte**: in tutte le foto la parete è verticale e il tappeto orizzontale entro la tolleranza; nessun raddrizzamento applicato.
- **Distrazioni**: sala preparazione ha un montante in primo piano che taglia il quadro a metà (scelta compositiva, non ritoccabile senza ritaglio); lotta ha il bambino seduto sullo sfondo; lezione in fila ha il pezzo di tappeto per terra dietro l'istruttore. Spot/rimozione non applicati: servono maschere a mano e peserebbero sul tempo.
- Nessuna modifica è stata fatta con maschere locali o `denoise` basato su modello: solo regolazioni globali.

## LightCraft: dove rende meglio

- **Foto con dominante di colore e poca luce (lotta, lezione in fila, istruttori)**: il solo cursore di temperatura riporta pareti e judogi a un grigio/bianco credibile senza toccare il resto; il guadagno è il più visibile e va tenuto.
- **Alte luci bruciate (sala preparazione)**: recupera le pareti bianche con alte luci/bianchi negativi; lì il risultato è buono ma il rumore sale nelle ombre, quindi nr 25.
- **Foto già morbide (hero, bambino sui cubi)**: la nitidezza maschera il rumore ma non recupera il fuoco vero; il miglioramento è modesto. Per queste due la scelta onesta è lasciare l'originale o sostituirli.
- **Peso**: tutti i file scendono (−16% hero, −49% sala): a qualità 82 il JPEG riesportato è più leggero senza perdite visibili.

## LightCraft contro PhotoCraft

PhotoCraft: filtro Camera Raw (`filter.cameraRaw`) con gli stessi numeri della tabella. Temperatura convertita a occhio dalla scala in kelvin di LightCraft a quella −100…+100 di PhotoCraft (5700→−20, 5900→−15, 6000→−12, 7900→+35): è una corrispondenza stimata, non esatta. Giudizio visivo fatto sugli export, non su misure.

| Foto | Peso LC / PC | Vincitore | Perché |
|---|---|---|---|
| Hero | 239 / 191 KB | **LightCraft** (di poco) | Contrasto e pulizia della parete migliori; PhotoCraft quasi identico all'originale. Nessuno dei due recupera il fuoco: la foto resta morbida. |
| Istruttori | 360 / 295 KB | **LightCraft** | La dominante calda sui judogi resta con PhotoCraft; LightCraft la toglie. |
| Presa di judo | 271 / 207 KB | **LightCraft** | Judogi ancora giallini e colori più forti con PhotoCraft. |
| Bambino sui cubi | 196 / 162 KB | **LightCraft** (di poco) | La riduzione di saturazione si vede in LightCraft, quasi per niente in PhotoCraft. Nitidezza simile, il mosso resta in entrambi. |
| Lotta | 213 / 150 KB | **LightCraft** | PhotoCraft lascia la foto scura e verde-azzurra; LightCraft la schiarisce e la riscalda. |
| Sala preparazione | 318 / 221 KB | **LightCraft** | Con PhotoCraft le pareti restano bruciate, con aloni e colori forzati; LightCraft le recupera. |
| Lezione in fila | 317 / 235 KB | **LightCraft** | La dominante gialla sulla parete resta con PhotoCraft; LightCraft la corregge. |

**Esito 7 a 0 per LightCraft.** Le differenze vengono da due cose: la temperatura di PhotoCraft agisce molto meno a parità di valore (la dominante resta), e il recupero delle alte luci è più debole sulle pareti bruciate. I file PhotoCraft pesano il 20-30% in meno, ma anche perché correggono di meno. Con valori molto più spinti PhotoCraft potrebbe avvicinarsi: non l'ho provato, per restare sul confronto a regolazioni equivalenti.

## Strumento consigliato

**LightCraft per tutte e 7.** Le regolazioni sono ripetibili (i valori in tabella bastano per rifarle). Per hero e bambino sui cubi il vantaggio è piccolo e nessuno dei due strumenti risolve la morbidezza: lì conviene valutare se tenere l'originale o sostituire la foto.

## Da fare, se si vuole andare oltre

1. Per hero e bambino sui cubi, decidere tra versione v2 e originale guardando le due a schermo intero.
2. Se interessa PhotoCraft, rifare il test con valori di temperatura e alte luci più spinti.
