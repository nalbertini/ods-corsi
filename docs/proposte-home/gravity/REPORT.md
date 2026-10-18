# Punto di fuoco delle foto della home

Sito live guardato a 1440, 768 e 375 px. Nessun file del codice toccato: i valori sono provati con override CSS nel browser.

## 1. Com'è oggi

Il punto di fuoco per foto **esiste già**: `src/lib/sitoFoto.ts` (`FOCI_FOTO`, una riga `x% y%` per file) → `cssFoci()` scrive in fondo al CSS del sito `img[src$="nome.jpg"]{object-position:…!important}`, valido in ogni riquadro (`src/lib/sitoGenera.ts:620`). `scripts/prova-sito-foto.mjs` controlla la tabella. Sul sito live le 11 regole ci sono già.

Quello che manca:
- la tabella è **una per foto, uguale a ogni misura**; i riquadri però cambiano forma molto (da 317×530 a 676×150);
- un valore giusto per un riquadro è sbagliato per un altro;
- non c'è un campo nel pannello SITO → Immagini: cambiare un fuoco vuol dire cambiare il codice (una PR).

## 2. Riquadri trovati sulla home

| Riquadro | 1440 | 768 | 375 |
|---|---|---|---|
| Hero (`tessera foto grande`) | 317×530 (vede 34 % della larghezza) | 716×300 | 343×300 (64 %) |
| Fila di 3 piccole | 209×128 | — | — |
| Schede corso (`.corso-foto`) | — (nascoste) | 676×**150** | 303×150 |
| Galleria «Perché unirti» | 332×540 (×4), 640×540 | 355×220, 716×477 | 169×220, 343×229 |

Il caso peggiore è la scheda corso a 768: una striscia larga 676 px e alta 150 da una foto **verticale** mostra solo il 15 % dell'altezza.

## 3. Foto → ritaglio attuale → proposto

Soggetti misurati sugli originali (`docs/proposte-home/foto/originali`, stessi pixel del sito).

| Foto | Attuale | Proposto | Motivo |
|---|---|---|---|
| `46c39293` presa di judo (1201×1800) | `55% 40%` | **`70% 38%`** | Il maestro sta a destra (x 73–95 %): a 55 % la sua faccia esce sulle strisce. La testa dell'allieva sta a y 28–37 %, la sua a 38–50 %: `38%` tiene entrambe nella striscia da 150 px solo in parte, da 230 px del tutto. |
| `701a887f` lotta (1201×1800) | `50% 58%` | **`50% 45%`** | Le teste stanno a y 39–46 %. A 58 % le strisce mostrano torsi e gambe senza teste (visto a 768 e 375). |
| `1a03b6b2` preparazione atletica (1201×1800) | `50% 54%` | **`50% 50%`** | L'istruttore che ride ha la testa a y 44–49 %: a 54 % la striscia da 150 px gli taglia i capelli. Verificato col calcolo, non con lo screenshot. |
| `40ae8db3` bambino sui cubi (1800×1199) | `60% 40%` | **`75% 50%`** | Il corpo sta a x 47–88 %. Nel riquadro stretto 332×540 (vede il 41 % della larghezza) a 60 % la mano sinistra e metà busto escono. A 75 % c'è tutto. |
| `18c88f1d` gruppo, hero | `50% 40%` | invariato | Vedi §5: il fuoco non basta. |
| `814a717b` istruttori in fila | `50% 25%` | invariato | Teste a y 16–40 %, in ogni riquadro entrano. |
| `12e605fc` lezione di judo | `50% 56%` | invariato (`50% 65%` è più stretta, facoltativo) | Teste e istruttore dentro a ogni misura. |
| `6e742106`, `72d0e1bc`, `9b15677c`, `fbfe492b` | — | non guardate | Non sono sulla home: vanno viste nelle pagine corso. |

## 4. Prima / dopo

Override provati nel browser (`object-position:…!important`, e per l'ultimo `.corso-foto{height:clamp(150px,30vw,240px)}`).

- **375 px, schede corso** — prima: ![](img/375-corsi-prima.jpg) dopo: ![](img/375-corsi-dopo.jpg)  
  Lotta: le teste erano tagliate in alto, ora ci sono. Judo: la faccia del maestro è intera.
- **768 px, schede corso** — prima: ![](img/768-corsi-prima.jpg)  
  dopo, solo fuoco: ![](img/768-corsi-dopo-fuoco.jpg)  
  dopo, fuoco + striscia più alta (230 px): ![](img/768-corsi-dopo-fuoco-altezza.jpg)  
  Lotta si corregge col solo fuoco. Judo no: con 150 px entra una sola delle due facce; con 230 px entrano entrambe.
- **1440 px, galleria «Perché unirti»** — prima: ![](img/1440-galleria-prima.jpg) dopo: ![](img/1440-galleria-dopo.jpg)  
  Cubi: ora la mano e il busto sono interi. Judo: la faccia dell'allieva entra.
- **1440 px, hero (invariato)**: ![](img/1440-hero-prima.jpg)

## 5. Cosa il fuoco non può fare

1. **Hero a 1440** (317×530 da una foto 1800×1012): vede il 34 % della larghezza, il gruppo ne occupa il 75 % (x 15–90 %). Qualunque `x%` taglia gente su un lato; `50%` tiene i bambini al centro ed è già il meno peggio. Per mostrarli tutti serve un riquadro più largo (circa 4:3, cioè ~317×240) o una foto ritagliata a parte: è una decisione di design della home, non di fuoco.
2. **Judo nella striscia da 150 px** (768–900): due facce a 21 % di altezza non entrano in una finestra del 15 %. Serve alzare la striscia.

## 6. Proposta tecnica (non implementata)

**Scelta consigliata: niente campo nuovo, si corregge la tabella che c'è.** Il diff più corto:

1. `scripts/prova-sito-foto.mjs`: nella tabella `FOTO` le 4 righe nuove (la prova fallisce per il motivo giusto).
2. `src/lib/sitoFoto.ts`: stesse 4 righe in `FOCI_FOTO`.
3. `src/lib/sitoGenera.ts:440`: `.corso-foto{height:150px}` → `height:clamp(150px,30vw,240px)` (a 375 resta 150, a 768 diventa 230). Una prova che lo legge nel CSS.

Nessuna dipendenza, nessun file in `supabase/`. Cambia come si vede il sito, quindi va comunque in `guida/` solo se la segreteria nota qualcosa: qui no.

**Alternativa, se si vuole poter cambiare il fuoco dal pannello** (passo di design della skill `nuova-funzione`, da discutere prima di scrivere codice):
- *Campo nell'editor Immagini* (consigliato tra i due): un punto da trascinare sull'anteprima, salvato per foto e letto da `cssFoci()`. Vale in tutte le pagine e le misure. Costa una colonna o una tabella in `supabase/` (oggi `sito_immagini` non c'è: le immagini sono solo file nel contenitore `sito`), quindi una migrazione, il giro di `rls-reviewer` e un sì dell'utente prima di lanciarla; la prova SQL e la modalità prova (`sitoProva.ts`) devono dire la stessa cosa.
- *`object-position` nel blocco immagine di una pagina*: nessuna migrazione, ma il valore va rifatto in ogni pagina in cui la foto compare, e la segreteria deve scrivere CSS a mano nel testo. Non lo consiglio.

Il canvas da cui partire sarebbe `docs/design-canvas/sito-pannello/Immagini.dc.html` (libreria `ods-design-system`); non l'ho toccato.

## 7. Limiti

- Gli screenshot sono del browser integrato (pane piccolo, scalati): bastano per vedere teste dentro/fuori, non per giudicare la resa fine.
- `1a03b6b2`, `12e605fc` e le 4 foto non sulla home: valutate col calcolo sugli originali, non con screenshot.
- Il grafo `graphify-out/` non c'è in questa cartella di lavoro: ho cercato con grep.
