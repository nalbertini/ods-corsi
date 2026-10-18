# Sistema grafico — pittogrammi e illustrazioni

Complemento di `DESIGN.md` (colori, tipografia, componenti dell'app). Qui stanno solo le regole per gli
**asset grafici** (icone, pittogrammi, illustrazioni, marchio). Un valore di colore si prende da `DESIGN.md`,
non si ridefinisce qui.

## Cartelle (`graphica/`)

| Cartella | Contenuto | Si committa |
|---|---|---|
| `sorgenti/` | generatori e script (`figure.mjs`, `esporta.py`, `controlla-png.mjs`) | sì |
| `varianti/` | tutte le proposte, anche le scartate | sì |
| `lavoro/` | prove, render di confronto, file di lavoro | no (svuotabile) |
| `esportazioni/` | solo gli asset definitivi: `<nome>.svg` + `<nome>-<lato>.png` | sì |

Nulla di qui è collegato all'app: le icone in `public/icons/` non si toccano. L'integrazione in `src/` è un
passo a parte, dopo l'OK sulle immagini.

## 1. Icone funzionali (interfaccia: tasti, stati, menu)
- Griglia 24×24, tratto 2px, angoli e terminali arrotondati, nessun riempimento decorativo.
- Un solo colore, `currentColor`: prende quello del testo (`testo`, `tasto`, `su-colore` da `DESIGN.md`).
- Leggibili a 16px. Dove basta una parola in maiuscolo, niente icona (regola di `DESIGN.md`).
- Esportazione: SVG ottimizzato, `viewBox` senza `width`/`height` fissi.

## 2. Pittogrammi sportivi (una disciplina = un segno)
- Silhouette **nera piena**, monocroma, **sfondo trasparente** (nessun `<rect>` di fondo).
- `viewBox 0 0 128 128`, margine 6px, soggetto centrato sul peso visivo, non sul riquadro.
- Figura: testa tonda r=8.5, torso 16, arti 9 (stesse misure in `figure.mjs`). La testa sta sull'asse
  del torso con 3 unità di vuoto: a 32px non deve fondersi col busto.
- Pose: il gesto che identifica la disciplina (proiezione per il judo, conduzione circolare per l'aikido),
  non una posa in piedi generica. Arti sempre distinguibili: tra due arti o due figure serve un vuoto ≥ 4
  unità; se si toccano, solo nel punto del gesto.
- Due figure al massimo. Niente volti, mani, cinture, kimono, ombre, contorni sottili.
- Copertura del nero: 15–45% del riquadro (il controllo automatico accetta 8–70%).
- Leggibilità: deve riconoscersi a **32px**; si controlla a 32, 64, 128 prima di consegnare.
- Esportazione: `<nome>.svg` + PNG RGBA 32/64/128 in `esportazioni/`.
- Nell'app, al momento dell'integrazione, il `#000` diventa `currentColor` (un solo pittogramma, ogni tema).

## 3. Illustrazioni (foto-alternative, vuoti, guida)
- Palette solo da `DESIGN.md`: `nero-palestra`, `carta-chiara`, grigi e al massimo un colore
  d'ingranaggio per illustrazione (`rosso`, `verde`, `giallo`, `blu`, `viola-corso`).
- Forme piatte, nessun gradiente né ombra morbida (regola di `DESIGN.md`). Sfondo trasparente per default.
- Un'illustrazione AI si usa come bozza; il file consegnato è vettoriale quando la forma lo permette.
- Contrasto verificato su tema scuro e chiaro.

## 4. Marchio (logo, timbri, ricevute)
- Non si ridisegna senza richiesta esplicita. Si parte dall'esistente (`public/icons/icon.svg`).
- Versioni: positivo, negativo, monocromo nero. Area di rispetto = altezza della testa del segno.
- Mai su sfondi che abbassino il contrasto sotto 4,5:1.

## Trasparenza
Dichiarata e verificata, mai presunta: SVG senza fondo; PNG con canale alfa, angoli a alfa 0
(`controlla-png.mjs` lo controlla). I bordi sfumati (antialias) sono normali; i pixel semitrasparenti
non devono essere colorati: solo nero.

## Esportazione (requisiti)
SVG ben formato (`xmllint --noout`), con `<title>`; PNG 8 bit RGBA non interlacciato; nomi in italiano,
minuscolo, trattini: `judo.svg`, `judo-32.png`. Nessun dato personale nei metadati.

## Processo (10 passi)
1. **Analisi**: cosa rappresenta, dove sta (app, sito, ricevuta), a che misura minima.
2. **Direzione**: categoria (sopra), pose candidate, vincoli di palette.
3. **Strumento**: SVG a mano/generatore per pittogrammi geometrici (preciso e ripetibile); generazione
   AI solo se disponibile e se la forma è troppo organica da costruire; VectorCraft per rifinire,
   convertire ed esportare; PhotoCraft solo per raster.
4. **Proposte**: almeno 3 varianti in `varianti/`.
5. **Confronto**: render affiancati a 32/64/128, su chiaro e su scuro (`lavoro/`).
6. **Scelta**: la più leggibile a 32px, non la più dettagliata.
7. **Rifinitura**: vuoti tra gli arti, equilibrio, un solo gesto.
8. **Rendering**: export con VectorCraft (`esporta.py`).
9. **Controllo**: `xmllint`, `controlla-png.mjs`, guardare i PNG a 32px.
10. **Consegna**: solo i definitivi in `esportazioni/`; le scartate restano in `varianti/`.
Dichiarare nel resoconto solo i passi davvero eseguiti e con quale strumento.
