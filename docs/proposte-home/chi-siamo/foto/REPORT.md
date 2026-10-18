# Foto di Chi siamo: valutazione, alternative, fuochi

Solo proposta. Niente caricato su Supabase, sito e database non toccati, niente commit.

**LightCraft in sola lettura.** L'app (127.0.0.1:7980) era occupata dalle altre sessioni («too many control connections», poi connessione chiusa): non è stata toccata, nessuna selezione, voto, flag o keyword cambiato. Gli id sono quelli di `docs/sito/foto.md`; i file sono stati presi dalle cartelle su disco (`~/Downloads/Officine dello Sport/…`, abbinamento id → file dalla tabella di `foto.md` e da `proposte-home/alternative/judo/REPORT.md`) e sviluppati **come copie** con `lightcraft-cli render` (headless, nessun contatto con l'app). Gli originali (5-41 MB) non sono nel repo.
Sviluppo: lato lungo 1800 px (stessa misura delle foto già sul sito), JPEG q82. Confronto con `photocraft-cli run … --cmd filter.cameraRaw` con gli **stessi numeri** sulla stessa base ridotta; PhotoCraft quasi non cambia la foto (vedi `anteprime/conf-*.jpg`, originale | LightCraft | PhotoCraft): vince LightCraft di poco in tutte, come per la home. Versioni scelte in `approvate/`.

## 1. Le foto di oggi sulla pagina

| Foto (id sito) | Dove | Verdetto | Cosa non va | Cosa propongo |
|---|---|---|---|---|
| `18c88f1d` gruppo con maglia blu | in alto | **tenere** (v2 già fatta per la home: `approvate/18c88f1d-…-v2.jpg`) | Muro vuoto per metà foto; sul telefono tagliata a 343×300 (si perdono i bimbi ai lati); alt dice «judogi», in foto ci sono magliette blu | Riquadro più basso e largo (878×440), fuoco 50% 70%; sul telefono 16:9; alt corretto |
| `814a717b` istruttori con cinture nere | pannello «Gli istruttori» | **tenere** (v2 della home) | Nel pannello è una miniatura da 132 px (64 sul telefono) | Una sola foto grande nel pannello (520×390, 4:3) |
| `12e605fc` lezione in fila | miniatura pannello | **togliere dalla pagina** | Non è «gli istruttori»; ragazzi di spalle, un profilo, cognome leggibile sul dorso; miniatura da 64 px illeggibile | Resta documentata nella foto della home; non serve qui |
| `46c39293` presa di judo | miniatura pannello | **togliere** | Come sopra; due allievi, età da verificare | — |
| `fbfe492b` aikido con una bambina | miniatura **e** fila di quattro | **togliere (duplicata)** | Compare due volte in 800 px; bambina con volto in primo piano (liberatoria) | Sostituita da `987` (adulti, nessun minore) |
| `701a887f` lotta | fila di quattro | **tenere** (v2 della home) | Alt «gruppo in posa» ma è un incontro; due ragazzi + bambino seduto sullo sfondo | Fuoco 50% 62%; alt: «Due giovani lottatrici si fronteggiano sul tappeto giallo» |
| `1a03b6b2` sala attrezzata | fila di quattro | **tenere** (v2 della home) | Montante in primo piano; con fuoco 50% 54% il volto di chi si allena è al bordo | Fuoco 50% 90% nel riquadro 332×420 |
| `40ae8db3` bambino sui cubi | fila di quattro | **tenere** (v2 della home) | Volto fuori campo, mossa | Fuoco 60% 40% |

Sul telefono oggi la fila di quattro mostra solo 2 foto (le altre due sono `display:none` a 768 e 375).

## 2. Alternative cercate (nessuna sostituisce «a priori»: decide l'utente)

Candidate prese da `foto.md` («Chi siamo: gruppo», «Istruttori: ritratti») e guardate una a una (`anteprime/sheet-*.jpg`).

| id | File | Cosa è | Verdetto | Uso proposto | Presenti |
|---|---|---|---|---|---|
| **205** | DSC_0216 | Otto-dieci judoka in judogi sollevano un compagno, tutti ridono; parete verde, tatami blu | **da pulire → fatto**, più nome ricamato coperto (esposizione +0,2, ombre +15, alte luci −10, contrasto +6, vibranza +8, nitidezza 35, nr 10/15; 286 KB) | **Missione** («Alleniamo il corpo…»): comunità e allegria, senza bambini | Sembrano tutti adulti: **età da confermare** |
| **987** | DSC09778 | Aikido in bianco e nero, istruttore proietta una compagna | **ok → pulita** (contrasto +5, ombre +8, nitidezza 30, nr 8; 221 KB) | **Fila di quattro**, al posto di `fbfe492b` | Adulti. In bianco e nero, unica della fila: tenere solo se piace |
| **948** | DSC09375 | Quattro istruttori di aikido in hakama, sorridenti, sfondo sfocato | **da pulire → fatta** (alte luci −10, ombre +10, vibranza +5, nitidezza 35; 345 KB) | Alternativa per il pannello istruttori o per la pagina Istruttori | Adulti |
| **1033** | IMG_4605 | Staff in maglia blu sul podio sotto il cartellone «Officine dello Sport» (13 persone circa) | **da pulire → fatta** (esposizione +0,2, alte luci −15, ombre +15, nr 20/20; 409 KB, da telefono) | Alternativa per il pannello istruttori: stesse magliette del gruppo in alto, logo visibile, il numero (13) torna | Adulti. **Da confermare**: sono tutti tecnici? c'è chi è fuori campo? Qualità media (telefono) |
| **167** | DSC_0171 | Due istruttori in piedi, cintura nera, verticale | **da pulire → fatta** (247 KB) | Pagina Istruttori / ritratto | Adulti |
| **42** | DSC_0023 | Ritratto di un istruttore sorridente | **ok → pulita** (190 KB) | Pagina Istruttori / ritratto | Adulto |
| 190 | DSC_0199 | Gruppo in posa, un ragazzo a destra | **non sviluppata** | — | Minore in primo piano (cintura gialla); sfondo con altre persone |
| 676 | DSC_0827 | Squadra con la coppa | **non sviluppata** | — | Minorenni in primo piano; non proposta |
| 199, 1032 | — | Gruppo con bambino / doppione di 1033 | scartate | — | 199 minore in primo piano |

Per il pannello «Gli istruttori» la scelta è fra `814a717b` (judo, cinture nere, già pubblicata, v2 pronta) e `1033` (staff intero col cartellone). **Il canvas usa `814a717b`** (nessun dubbio su chi è nella foto); `1033` è l'alternativa se la segreteria conferma che sono tutti i tecnici.

## 3. Fuochi e ritagli (`object-fit: cover`, `object-position` in %)

Verificati su ritagli reali (`anteprime/g/`) ai riquadri del canvas.

| Riquadro | Misura 1440 | Misura 375 | Foto | Fuoco 1440 | Fuoco 375 | Nota |
|---|---|---|---|---|---|---|
| Hero | 878×440 | 343×210 | `18c88f1d` | 50% 70% | 50% 75% | Gruppo intero, il muro vuoto sopra viene tagliato |
| Pannello istruttori | 520×390 (4:3) | 343×257 | `814a717b` | 50% 25% | 50% 25% | Teste a ~30%, nessun taglio |
| Missione | 560×420 | 343×257 | `205` | 50% 50% | 50% 50% | Il gruppo sta tra il 15% e l'86% della larghezza: nessun volto tagliato |
| Fila 1 (lotta) | 332×420 | 168×210 | `701a887f` | 50% 62% | 50% 62% | Due lottatrici intere; bambino sullo sfondo a sinistra |
| Fila 2 (aikido) | 332×420 | 168×210 | `987` | 40% 50% | 40% 50% | Mano della compagna a ridosso del bordo destro |
| Fila 3 (sala) | 332×420 | 168×210 | `1a03b6b2` | 50% 90% | 50% 90% | Volto di chi si allena dentro il riquadro |
| Fila 4 (cubi) | 332×420 | 168×210 | `40ae8db3` | 60% 40% | 60% 40% | Volto fuori campo |

## 4. Liberatorie e minorenni

L'utente (18 ottobre) ha le liberatorie per **tutte le foto proposte**: nessuna segnalazione da fare. Resta la regola: **nessun cognome leggibile sul dorso** (controllato sulle foto proposte a 1800 px: l'unico leggibile era un nome ricamato sulla giacca di una judoka in `205`, **coperto con `delogo` di ffmpeg** (macchia grigia di ~50×40 px, non visibile al formato di pagina); nelle altre nessuno. Da evitare `692` e `699`, `12e605fc` ha un «…ITA» sul dorso). Le foto `190`, `199`, `676` non sono proposte e non sono state sviluppate.

## 5. Da rimpiazzare / da scattare

- **Gruppo senza bambini** per il primo piano della pagina: `205` è l'unica adulta e allegra, ma è solo judo e fa pensare «corso adulti». Se la liberatoria dei bambini manca, servirebbe un gruppo adulti+istruttori in maglia blu (come `1033`) scattato con una macchina vera.
- **Ritratti singoli** per «Gli istruttori»: ne esistono 3-4 buoni (`42`, `167`, `914`, `153`); mancano ritratti di lotta, preparazione atletica e psicomotricità.
- **Foto del posto** (ingresso, spogliatoio, tatami vuoto): nessuna nel catalogo: servirebbe per «dove ci alleniamo».

## File

`approvate/` (11 JPEG q82, 190-409 KB): le 5 v2 della home riusate + 6 nuove (205, 987, 948, 1033, 167, 42). `migliorate/` LightCraft, `photocraft/` PhotoCraft, `anteprime/` originali ridotti, confronti e ritagli.
