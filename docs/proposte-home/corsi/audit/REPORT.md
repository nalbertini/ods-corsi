# Audit visivo di I CORSI (elenco) — officinedellosport.it/corsi

Data: 2026-10-18. Sito e database non toccati. Misure: 1440, 768, 375 px, tema chiaro (il tema scuro non esiste, come nella home).
Metodo: misure con il browser integrato (`getBoundingClientRect`, `scrollWidth`), screenshot di pagina intera con Chrome headless (il 375 dentro un iframe da 375 px, perché la finestra headless non scende sotto ~500).
Screenshot in `img/`: pagina intera `corsi-1440-full.png`, `corsi-768-full.png`, `corsi-375-full.png`; fette leggibili `d-0…d-2` (1440), `t-0…t-2` (768), `m-0…m-2` (375).
Altezze di pagina: 3425 px (1440) · 4343 (768) · 4945 (375). Nessun overflow orizzontale (`scrollWidth` = larghezza).

## Cosa funziona (da non toccare)

- Un solo `h1`, `lang="it"`, un solo `main`, font caricati (Big Shoulders Display, Inter), `:focus-visible` definito.
- Ogni scheda è un solo link (`/judo/`, …) con nome corso, età, descrizione e fasce: chiaro cosa si clicca.
- Età in grassetto prima della descrizione: la prima cosa che serve a un genitore.
- Fasce (Bambini, Adulti, Agonisti, Anziani) con icona e testo: non solo colore.
- A 375 e 768 una colonna, nessun taglio di testo.

## Problemi, in ordine di priorità

### ALTA

**1. Cinque schede su nove senza foto o con foto sbilanciata → righe di altezze diverse.** A 1440 la prima riga (con foto) è alta 384 px, la seconda e la terza 452 px; Pre pugilistica, Autodifesa e Sollevamento pesi sono blocchi di colore con 130 px di vuoto sopra il titolo (`d-0`, `d-1`). A 768 le schede vanno da 200 a 376 px, a 375 da 237 a 431 px. Il vuoto sembra «foto mancante», non una scelta. Prova: `d-1.png`, `t-1.png`.
Proposta: stesso riquadro foto (442×240 desktop, 343×220 telefono) in tutte e nove; dove la foto non c'è, una fascia con l'iniziale (come nella home proposta) finché non c'è una foto vera. Altezza scheda uguale per riga.

**2. La foto tocca il titolo.** In Preparazione atletica, Giocomotricità e Avviamento il titolo parte a 0 px sotto la foto (`d-1`: «PREPARAZIONE ATLETICA» schiacciato sul bordo della foto), mentre in Judo/Lotta c'è ~16 px. Titoli su due righe con `line-height` ≈ 0,9 si appoggiano alla foto. Prova: `d-1.png`.
Proposta: 16–24 px tra foto e titolo, sempre; titolo a 40 px max (oggi 46) per stare in una riga dove possibile.

**3. Foto con fuoco sbagliato o a verticale ritagliata a striscia.** Il riquadro è 384×170 (2,25:1) con foto a verticale 1201×1800 (Preparazione, Giocomotricità, Avviamento): resta una fascia (`pos` 50% 54%, 50% 42%, 45% 68%). In Preparazione atletica si vede una persona tagliata a metà a destra e tre teste; in Giocomotricità solo schiene di bambini (nessun volto, ok per i minori, ma non racconta il corso); in Avviamento due bambini di cui uno a metà. Il Judo (12e605fc) mostra 5 persone di spalle in fila. Prova: `d-0.png`, `t-1.png`.
Proposta: riquadro più alto (240 px a desktop, 220 a telefono), fuochi per foto (vedi `foto/REPORT.md`), foto scelte coerenti con la home (Judo 161, Lotta 446, Aikido 989).

**4. Foto ripetute tra pagine.** Le due foto in fondo (istruttori in judogi `814a717b`, gruppo bambini `18c88f1d`) sono le stesse della home (hero e fascia istruttori). A 375 e 768 la seconda sparisce del tutto (`img` 0×0), a 1440 le due foto sono 918×620 e 420×620: la seconda è ritagliata a verticale e perde il lato destro (`d-1`, `d-2`). Preparazione atletica e Giocomotricità compaiono anche in home. Proposta: tenere una sola foto di chiusura e non la stessa della home, oppure toglierla (la chiusura è già la chiamata a «Prova»).

### MEDIA

**5. L'`h1` da 200 px su due righe occupa metà della prima schermata.** A 1440 il titolo è alto 328 px e riempie il quadrante a sinistra mentre a destra c'è una frase piccola; i corsi (il motivo per cui si è lì) iniziano a y = 727, sotto la piega (a 900 px di altezza se ne vede solo una riga). A 375 va bene (84 px). Proposta: 112–128 px a 1440, su una riga sola «I NOSTRI CORSI» se entra; schede che iniziano sopra i 560 px.

**6. Due frasi che dicono lo stesso nel preambolo.** Sotto il titolo c'è una frase a destra («Judo, lotta, aikido… per bambini, ragazzi e adulti a Collegno», 18 parole) e sotto, in grande, un'altra («Accompagniamo bambini, ragazzi e adulti in percorsi… stessa direzione», 24 parole): entrambe elencano «bambini, ragazzi e adulti». A 375 c'è un buco di ~100 px tra le due (`m-0`). Proposta: tenerne una sola, vedi `testi/REPORT.md`.

**7. Manca un modo per scegliere.** Nove schede in elenco, ordine fisso (Judo, Lotta, Aikido, Pre pugilistica, Autodifesa, Preparazione, Giocomotricità, Avviamento, Sollevamento). Chi cerca «un corso per mio figlio di 4 anni» deve leggere nove schede; le fasce sono in fondo a ogni scheda ma non sono filtri. Proposta (da approvare): un filtro per fascia a pastiglie (Tutti · Bambini · Adulti · Agonisti · Anziani) con bersagli da 48 px, e ordine per età crescente dentro la fascia; in alternativa lasciare l'elenco com'è e mettere in cima una riga «Per i più piccoli: Giocomotricità (3-5), Avviamento (5-6)». Il filtro è una funzione nuova: **deciso dall'utente: no per ora**.

**8. Fasce e età che non coincidono con le pagine dei corsi** (già annotato in `docs/sito/corsi.md`): Pre pugilistica «Dai 18 anni» contro «dal 2015 in poi» nella pagina; Autodifesa «Dai 15 anni»; «Anziani» per Aikido e Preparazione atletica non è scritto nelle pagine; Sollevamento pesi mostra «Bambini» con «dagli 11 anni»; Aikido «Dai 7 anni agli adulti» ma Judo e Lotta identici. Dati da confermare, non da cambiare: vedi `testi/REPORT.md`.

**9. Chiamata finale «PROVA»**: stessa parola gigante (170 px) senza verbo né prezzo, frase che tocca la parola (0 px), metà destra vuota, 6 px tra chiamata e piede (`d-2`); a 375 la frase sta sopra la parola, ma i due blocchi si toccano. Come problema 3 della home. Proposta: titolo «Una settimana per scegliere.», pulsante pieno «Prova una settimana a 5 €», 24 px sopra il piede.

### BASSA

**10. Bersagli sotto i 44 px.** Menu a 1440: Home, I corsi, Chi siamo, Istruttori hanno 39 px di altezza (a 768/375: 44); link del piede 20 px a 768/375, 30 px a 1440 (`Home`, `I corsi`, `Privacy policy`…). Bottoni «Contattaci» e «Prova una settimana» sono 48 px (ok). Le fasce nelle schede (≈ 32 px) non sono bersagli: sono dentro il link della scheda.
**11. Immagini senza `width`/`height`.** Tutte e otto le `img` non hanno attributi di dimensione né `loading="lazy"` (anche quelle sotto la piega): rischio CLS in caricamento; la home proposta usa riquadri a proporzioni fisse (`aspect-ratio`), qui si propone lo stesso.
**12. Gerarchia dei titoli.** `h1` poi nove `h3`, senza `h2` (salto di livello). Proposta: i corsi sono `h2`.
**13. Telefono: navigazione a due righe** (Home, I corsi, Chi siamo / Istruttori) con il pulsante «Prova» troncato (la parola «una settimana · 5 €» è nascosta): la proposta della home usa un tasto MENU e il pulsante intero.
**14. Link senza nome accessibile oltre al testo**: la scheda ha come nome «Judo Dai 7 anni agli adulti Tecnica… Bambini Adulti Agonisti» (letta tutta da uno screen reader); va bene, ma `aria-label="Judo: scopri il corso"` sarebbe più corto. Da valutare, non urgente.
**15. Tema scuro: non esiste** (come in home).

## Misure di riferimento

| Cosa | 1440 | 768 | 375 |
|---|---|---|---|
| `h1` | 200 px, 328 px alto | 84 px, 71 | 84 px, 141 |
| Prima scheda parte a | y = 727 | y = 513 | y = 735 |
| Altezza schede | 384 / 452 | 200–376 | 237–431 |
| Foto nel riquadro | 384×170 | 676×150 | 303×150 |
| Foto di chiusura | 918×620 + 420×620 | 716×212 + nascosta | 343×212 + nascosta |
| Voci di menu | 39 px alte | 44 | 44 |

## Sintesi per il canvas (corsi-miglioramenti)

1. Titolo a 1 riga o 128 px, una sola frase di apertura.
2. Nove schede uguali: foto/fascia 240 px, 16–24 px sotto la foto, tag in fondo.
3. Filtro per fascia (da decidere) e ordine per età.
4. Foto coerenti con la home; fascia con iniziale dove manca la foto.
5. Chiusura: una sola foto o nessuna; chiamata finale come nella home.
6. Bersagli a 48 px, menu a tasto sul telefono.
