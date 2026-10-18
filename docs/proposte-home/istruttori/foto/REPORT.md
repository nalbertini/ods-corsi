# Foto della pagina Istruttori: ritratti

Solo proposta. Niente caricato su Supabase, niente committato, niente cambiato nel sito. Gli originali non sono stati toccati: ogni versione è una copia sviluppata con `lightcraft-cli render` (non scrive nella libreria) e confrontata con `photocraft-cli`.

## Come ho lavorato

- **Prima passata** (app LightCraft irraggiungibile, 127.0.0.1:7980 saturo di connessioni): lavorato dai file su disco in `~/Downloads/Officine dello Sport/` con gli ID di `docs/sito/foto.md`.
- **Seconda passata** (app di nuovo raggiungibile): solo lettura via MCP `lightcraft-app` (`faces.person`, `photo.inspect`, `render_photo`; nessun comando che scrive). Ho letto i **nomi che l'utente ha già assegnato ai volti in LightCraft** (`faces.person` con «Nome Cognome» per tutti e 13) e non ne ho assegnato nessuno. **Selezione, voti, flag, keyword e nomi sono intatti.**
- Sviluppo: sempre su copie con `lightcraft-cli render` (non scrive nella libreria), confronto con `photocraft-cli`. Ritagli quadrati 800×800, JPEG q85, ~120–190 KB.
- Cartelle: `approvate/` (usate nel canvas), `non-abbinate/` (bei ritratti di cui LightCraft non dice chi sono), `da-verificare/` (gruppo aikido 948, tre volti senza nome), `scartate/` (bambini sullo sfondo o ritratto debole), `candidate/`, `sviluppate/`, `neutri/`, `photocraft/`, `confronto/`.

## Chi ha un nome in LightCraft (letto, non deciso da me)

| Istruttore | Volti con nome | Ritratto utilizzabile |
|---|---|---|
| Maurizio Innella | 37 | **sì**: foto 42 |
| Maura Fornetti | 67 | **sì**: foto 200 (DSC_0210, singola, sguardo in camera) |
| Fabio Berta | 22 | **sì**: foto 948 (ritaglio sul quarto volto) e 914 (di profilo) |
| Federico Vuillermin | 1 | **sì, con riserva**: foto 199 (DSC_0208), gruppo con un bambino a destra: il ritaglio sul volto lo esclude, il ritaglio stretto esclude le altre persone |
| Katia Ballabio | 1 | no: foto 834, sguardo basso con un disco in primo piano |
| Serena Baravalle, Aldo Scollo, Manuel Tagini | 3, 1, 1 | no: solo in foto di gruppo da 1800 px (`sito-….jpg`, volti di ~60 px), troppo piccoli |
| Diana Ballabio, Tiziano Bartocci, Valerio Busa, Giulia De Chiara, Elena Merigo | 0 | nessun volto con nome |

**Ritratti utilizzabili con nome: 4 su 13** (Maurizio, Maura, Fabio, Federico). Gli altri nove restano con l'iniziale. Ritratti belli ma senza nome in LightCraft: 153 (uomo in ginocchio), 167 (coppia), 948 (altri tre volti): sono in `non-abbinate/` e `da-verificare/`; se la segreteria dice chi sono, si aggiungono in cinque minuti.

## Candidate guardate

| ID (`foto.md`) | Sorgente | Cosa mostra | Verdetto | Minori | Note |
|---|---|---|---|---|---|
| **42** | esame cinture / DSC_0023 | Maurizio Innella (nome in LightCraft): sorridente in judogi, libreria dietro | **ok** → usata | nessuno | Sfondo con libreria e locandine: caldo, più «sala riunioni» che tatami. Sguardo in camera. |
| **153** | esame cinture / DSC_0153 (vert.) | Uomo in ginocchio, si volta verso la camera, cintura nera (senza nome in LightCraft) | **bella, non usata**: `non-abbinate/` | una persona sfocata alle spalle (capelli, di spalle) | Judogi con un riverbero giallo del tatami: corretto. Parete grigia neutra: lo sfondo più pulito. |
| **914** | Aikido / DSC09196 (vert.) | Fabio Berta (nome in LightCraft): in hakama, di profilo, sorride | **alternativa** a 948 (in `approvate/`, non nel canvas) | alle spalle due adulti sfocati | Volto di profilo e piccolo nel riquadro: meno «ritratto» degli altri. Sfondo di palasport (gradinate). |
| **948** | Aikido / DSC09375 | Quattro istruttori di Aikido in hakama, in posa; **il quarto è Fabio Berta** (nome in LightCraft) | **948-4 usato per Fabio**; gli altri tre in `da-verificare/` | nessuno | Ritratti molto belli, sfondo sfocato e uniforme. Gli altri tre volti non hanno nome in LightCraft e l'Aikido nell'elenco ha solo Fabio: potrebbero non essere dell'ODS (evento Fijlkam). |
| **167** | esame cinture / DSC_0171 (vert.) | Due istruttori in posa, cinture nere, spalla a spalla (senza nome in LightCraft) | **bella come doppio, non usata** | nessuno | I due volti si toccano: un ritaglio singolo taglia l'altro. Si usa solo come ritratto doppio (nell'elenco non ha un posto: sono due tessere). |
| **308** | araimondo cup / DSC_0125 | Uomo con felpa grigia in primo piano, bambini sullo sfondo | **scartata** (in `scartate/`) | **sì**: almeno 3 bambini riconoscibili, uno di fronte | Da usare solo con liberatorie, o ritagliata sul solo volto (resta una testa di bambino a sinistra). Il volto è bello. |
| **422 / 475** | araimondo cup / DSC_0323, DSC_0410 | Uomo con felpa grigia: seduto di profilo / che legge un foglio con gli occhiali | **da scartare per un ritratto** | un bambino sullo sfondo (475) | Occhiali sul naso e foglio in mano; 422 ha ventilatore e impianto elettrico alle spalle. |
| **1100** | Facebook / `facebook_1188033673327241` | Allenamento con le funi, tre persone, logo ODS in sovrimpressione | **no** | nessuno | Foto d'azione, non un ritratto; ha già il logo sovrapposto. |
| **200** | esame cinture / DSC_0210 (6000×4000) | **Maura Fornetti** (nome in LightCraft): singola, in judogi, sguardo in camera, parete chiara | **ok** → usata | nessuno (sullo sfondo, lontano, una donna e una persona di spalle) | La più «da documento» del gruppo: sguardo fermo, nessuna distrazione. Esposizione +0,33 già applicata dall'utente in LightCraft: non riportata, ho sviluppato dall'originale. |
| **199** | esame cinture / DSC_0208 (6000×4000) | **Federico Vuillermin** (nome in LightCraft): giovane in judogi, in un gruppo | **ok con riserva** → usata | **un bambino** nel gruppo, fuori dal ritaglio | Ritaglio stretto sul solo volto; il ritaglio finale è stretto (660 px) e non contiene più altre persone. Sguardo un po' in tralice; risoluzione al limite (volto di ~330 px sull'originale). |
| **834** | esame cinture / DSC_0255 circa | Katia Ballabio (nome in LightCraft) al rack, sguardo basso | **no** | nessuno | Disco da bilanciere in primo piano, occhi bassi. |
| 1030, 1033, 1038 | Foto dal sito (`sito-….jpg`, 1800 px) | Gruppi di istruttori con Serena Baravalle, Aldo Scollo, Manuel Tagini | **no per il ritratto** | nessuno | Volti da ~60 px: non reggono 331 px. Servirebbero gli originali. |
| 386, 95 | araimondo cup | — | **scartate** (già «da scartare» in `foto.md`) | | |

## Coerenza di luce e sfondo

Non si può avere coerenza vera tra queste foto: sono scattate in **quattro posti diversi** (libreria del club, parete del palazzetto, palasport di Aikido, gruppo su tatami) con luci diverse. Quello che si può fare in sviluppo, e ho fatto:

| Foto | Difetto | Impostazioni LightCraft |
|---|---|---|
| 153 | riverbero giallo del tatami sul judogi, ombre chiuse | temperatura 6000, esposizione +0,15, ombre +15, alte luci −10, nitidezza 40, nr 10/15 |
| 42 | dominante calda/verdastra sulla parete | temperatura 5800, tinta +12, esposizione +0,1, alte luci −10, ombre +10 (poi vedi confronto) |
| 914 | luci del palasport bruciate, dominante calda | temperatura 6000, alte luci −25, contrasto +8, ombre +12, nitidezza 35, nr 8 |
| 167 (doppio) | judogi leggermente giallini, tatami blu saturo | esposizione +0,1, alte luci −12, bianchi −5, saturazione −6 |
| 200 | parete chiara fredda, leggero giallo del muro | temperatura 6200, esposizione +0,2, alte luci −15, ombre +10, nitidezza 40, nr 10/15 |
| 199 | judogi con riflesso giallo del tatami | temperatura 6000, esposizione +0,1, alte luci −10, ombre +10, nitidezza 40, nr 10/15 |
| 948 (×4) | dominante calda sui kimono, palasport sfocato | temperatura 6200, alte luci −10, ombre +10, nitidezza 35, nr 8 |
| 308 | pavimento blu saturo | saturazione −8, alte luci −10 |

**Cosa ho reso uguale:** inquadratura (volto a ~40% dell'altezza del quadrato, testa 40-45% del lato), formato (quadrato 800 px), bianco dei judogi, pelle naturale. **Cosa non posso rendere uguale:** lo sfondo. Una foto con la libreria e una con il palasport accostate in una griglia non sembrano della stessa sessione. È un limite del materiale, non dello sviluppo: l'unica soluzione vera è una **sessione ritratti**: l'utente ha deciso di non farla per ora, resta come opzione futura (vedi sotto).

## LightCraft contro PhotoCraft (153, 42, 914, 200, 199)

PhotoCraft: `filter.cameraRaw` con gli stessi numeri (temperatura convertita a stima: 5800→−12, 6000→−8). Giudizio sugli export (`confronto/lc-pc.png`).

| Foto | Vincitore | Perché |
|---|---|---|
| 153 | **LightCraft** (con temperatura 6000) | Corregge il riverbero giallo del judogi; PhotoCraft lo lascia quasi com'era. |
| 42 | **PhotoCraft** | LightCraft con gli stessi numeri alza troppo contrasto: capelli bloccati, pelle più scura, effetto «filtro». PhotoCraft resta naturale. |
| 914 | **LightCraft** | Recupera le luci del soffitto e dà più separazione dallo sfondo; la pelle è identica. |
| 200 | **LightCraft** (di poco) | Pelle più calda e naturale, parete meno grigia; PhotoCraft è più piatto (`confronto/lc-pc2.png`). |
| 199 | **LightCraft** (di poco) | Toglie il riflesso giallo dal judogi; PhotoCraft quasi uguale all'originale. |

File in `approvate/`: `42-maurizio-photocraft`, `200-maura-lightcraft`, `948-4-fabio-lightcraft`, `199-federico-lightcraft` (le quattro usate), `914-fabio-lightcraft` (alternativa). In `non-abbinate/`: `153-lightcraft`, `167-doppio-lightcraft`. In `da-verificare/`: `948-1…3-lightcraft`. In `scartate/`: 308, 422, 475.

## Fuoco per ogni riquadro (object-position)

I ritagli sono già quadrati e centrati sul volto: nel riquadro dell'elenco (331 × 300 a 1440, 112 × 136 a 375) basta `50% 30%`, come nel canvas. Dettaglio dei ritagli:

| Foto | Ritaglio sul sorgente sviluppato | Volto nel quadrato |
|---|---|---|
| 153 (non usata) | 1150 px da (233, 139) di 1600×2400 | centro a ~46% dall'alto |
| 200 | 1950 px da (1360, 0) di 4500×3000 | testa a ~38% dall'alto, ~40% del lato |
| 199 | 660 px da (650, 860) di 6000×4000 | testa a ~40% dall'alto, ~50% del lato (stretto: esclude la donna con gli occhiali e il braccio che c'erano nel ritaglio da 1000 px) |
| 948-4 (Fabio) | 1000 px da (3075, 0) di 4800×3200; sviluppo più morbido (contrasto −8, saturazione −10, nitidezza 10) perché la prima versione aveva un effetto «HDR» | ~46% |
| 42 | 1600 px da (444, 0) di 2400×1600 | ~44% |
| 914 | 1200 px da (400, 0) di 1600×2400 | ~33% (testa vicina al bordo alto) |
| 948-1…3 (da verificare) | 1000 / 880 / 800 px su 4800×3200 | ~42-46%; 948-3 ha i capelli al bordo alto, 948-1 e 948-2 una spalla altrui al bordo |
| 167 doppio | 1100 px da (290, 324) di 1600×2400 | ~40%, i due volti | 

Se il sito mantiene il cerchio da 140 px di oggi, il ritaglio quadrato regge (la testa sta nel cerchio), ma a 140 px un volto è troppo piccolo: vedi `audit/REPORT.md`, punto 2.

## Consensi e minorenni (segnalati, non decisi)

| Foto | Segnalazione |
|---|---|
| 42, 200, 948-4, 199 (usate) | Adulti, volti riconoscibili, **nome assegnato dall'utente in LightCraft**. L'utente ha dichiarato di avere le liberatorie per tutte le foto proposte: nessun cartellino di consenso sulle tessere. |
| 199 | Nel gruppo d'origine c'è un **bambino**: fuori dal ritaglio; l'originale non va pubblicato intero senza liberatoria. |
| 948-1…3, 153, 167 | Senza nome in LightCraft: prima di usarli serve sapere chi sono (e, per 948, che siano istruttori ODS). Cartellino «nome da abbinare» se compaiono. |
| 308, 475 | **Minorenni riconoscibili** sullo sfondo (308: tre, uno di fronte): non usare senza liberatorie dei genitori o ritaglio; la foto è marcata «sconsigliata». |
| Tutte | Sul retro dei judogi si vede il simbolo del Centro Judo (ASD): è il logo dell'associazione, non un dato personale. |

## Opzione futura: la sessione ritratti (non ora)

Per avere 13 ritratti coerenti: **30 minuti in palestra, una parete, una luce**.

1. Parete neutra grigia chiara (quella di 153 va benissimo) o tatami giallo a metà fila; luce naturale o neon spenti a favore di una luce bianca fissa.
2. Tredici persone, una alla volta, in piedi o in ginocchio, in judogi/hakama o tuta del club, sguardo in camera, 3 scatti a testa.
3. Formato verticale, volto a metà altezza del fotogramma, 4000 px sul lato corto almeno (oggi i ritagli arrivano a 800 px; il sito ne mostra 331).
4. Liberatoria per persona (l'utente ha dichiarato di averle per le foto proposte; per le nuove va rifatta).

Senza quella sessione, la pagina mostra **foto per 4 su 13** (Maurizio, Maura, Fabio, Federico) e l'iniziale per gli altri nove, come nel canvas. Altri ritratti belli (153, la coppia 167 e i tre volti 948-1…3) aspettano solo un nome.

## File

- `candidate/`: anteprime neutre dei sorgenti guardati.
- `sviluppate/`: copie sviluppate a 2400/4800 px e `ritagli/` quadrati.
- `photocraft/`, `neutri/`, `confronto/` (`lc-pc.png`, `lc-pc2.png`, `ritagli.png`): il confronto.
- `non-abbinate/`, `da-verificare/`, `scartate/`: come sopra.
- `approvate/`: le versioni usate nel canvas (`docs/design-canvas/istruttori-miglioramenti/img/`); `da-verificare/` e `scartate/` come sopra.
