# Audit visivo: Istruttori — officinedellosport.it/istruttori/

Data: 2026-10-18. Sito pubblico non toccato. Misure a 1440, 768 e 375 px (Chrome, tema chiaro), screenshot in `img/`: pagina intera `istruttori-1440-full.png`, `istruttori-768-full.png`, `istruttori-375-full.png`; fette da 1400 px `d-N` (1440), `t-N` (768), `m-N` (375).

**Stato della pagina oggi.** `/istruttori/` esiste (301 da `/istruttori`, 200): una testata, 13 tessere e il piede. **Non esiste nessuna scheda singola** (`/istruttori/maurizio/` e simili danno 404) e nessuna tessera è un link: la frase «Ogni istruttore ha la sua pagina» di `docs/sito/istruttori.md` non è sulla pagina pubblicata. Nessuna foto: il cerchio mostra l'iniziale. Perciò l'audit della «scheda singola» è sul solo canvas esistente (`sito-approvato/TatamiBlu-Istruttore.dc.html`), non sul sito.

## Cosa funziona (da non toccare)

- Un solo `h1`, `lang="it"`, landmark `header/nav/main/footer`, `title` e `description` propri, `canonical` giusto.
- Iniziali nel cerchio `aria-hidden`: i lettori di schermo leggono solo il nome (nessun «M» ripetuto).
- Contrasti buoni: inchiostro su giallo 8,95:1, bianco su blu 5,46:1, bianco su inchiostro 14,83:1, inchiostro sul chiaro 13,5:1.
- `:focus-visible` definito, colore per sfondo. Nessun overflow orizzontale a nessuna misura (`scrollWidth` = larghezza).
- Quattro colori a rotazione nelle tessere (giallo, blu, inchiostro) in accordo col resto del sito.

## Problemi, in ordine di priorità

### ALTA

**1. Nessun volto.** È una pagina di persone senza persone: 13 cerchi con una lettera. È il motivo per cui la pagina esiste (fiducia: chi tiene mio figlio sul tatami). Prova: `d-0.png`.
Proposta: foto per tutti (vedi `../foto/REPORT.md`: oggi i ritratti con nome e utilizzabili sono 4 su 13) e fascia azzurra con iniziale per chi non ce l'ha.

**2. Il cerchio da 140 px è troppo piccolo per un volto.** CSS di oggi: `.ritratto-foto{width:140px;height:140px;border-radius:50%}`, foto con `object-position:50% 40%`. A 140 px un viso di tre quarti non si riconosce, e un ritratto verticale (153, 914) ha la testa nel 40% in alto che il cerchio taglia. Un cerchio di 140 px su una tessera di 392×380 lascia l'85% della tessera vuoto (`d-0.png`).
Proposta: foto quadrata a tutta larghezza della tessera, 300 px di altezza.

**3. Le tessere «sbilanciano» da sole.** Il testo sta in basso (`justify-content:space-between`) e il cognome-più-corsi ha lunghezza da 3 a 12 parole: a 1440 il nome di Maurizio sta 26 px più in alto di quello di Diana e Katia nella stessa fila (`d-0`: «MAURIZIO» a y≈860, «DIANA» e «KATIA» a y≈886); a 375 Maurizio ha 4 righe di ruolo e Diana 2, e i nomi di una fila non sono allineati (`m-0`). Le tessere hanno la stessa altezza, i contenuti no. Misure (parole della riga «Cognome · ruolo · corsi», `testi/conta.mjs`): Maurizio 11, Giulia 6, Tiziano 5, Maura 5, Manuel 5, Katia 4, Federico 4, Diana 3, Aldo 3, Berta 2, Serena 2, Busa 2, Merigo 2; solo 2 tessere su 13 stanno entro ±20% della media (4,2).
Proposta: nome e pastiglie dei corsi in alto, vuoto in fondo, una sola regola per tutte; vedi `../testi/REPORT.md`.

**4. Tredici è un numero dispari: l'ultima tessera resta sola.** A 1440 (3 per riga) Federico è solo nella quinta fila con due tessere vuote; a 768 e 375 (2 per riga) è solo a mezza riga (`d-1`, `m-2`).
Proposta: 4 per riga a 1440, 13º posto = tessera «Vieni a conoscerli sul tatami» + pulsante di prova (la fila si chiude); a 375 una colonna di ritratti orizzontali.

### MEDIA

**5. Nessun nome è un link, nessuna tessera ha azione.** Ed è la sola pagina del sito con 13 persone e zero modi di arrivare a una di loro. Quando la scheda esiste la freccia ↗ è già prevista nel CSS (`.ritratto:has(h3 a)::after`); finché non esiste, meglio non promettere.
Proposta: la freccia compare solo se la scheda è scritta; vedi `IstruttoreMinima` nel canvas.

**6. Nome piccolo, cognome sepolto.** Il titolo `h3` è solo il nome di battesimo (54 px) e il cognome sta a 18 px dentro il ruolo («Innella · Maestro di Judo V Dan · …»). Due Ballabio (Diana, Katia) si distinguono solo leggendo la riga piccola. Per chi cerca «Vuillermin» non c'è un titolo con il cognome.
Proposta: nome grande, cognome in Inter 600 20 px subito sotto (come nella scheda: «Maurizio Innella»).

**7. Corsi come frase, non come cosa da scorrere.** «Bartocci · Body functional, pesistica, prepugilistica» è una riga di testo; i corsi sono il motivo per cui un genitore arriva qui. Le pastiglie dei corsi sono già un componente del sito (schede corso).
Proposta: pastiglie, stesso stile delle schede corso; il ruolo (se confermato) sta nella scheda.

**8. Bersagli sotto i 44 px.** Voci di menu 38 px di altezza a 1440 (81×38, 112×38…); a 768 e 375 sono 44 px ma a 375 vanno a capo su due righe e «Istruttori» resta orfano sotto (`m-0`); nel piede i link sono alti 20–30 px (1440) e 20 px (768, 375): Instagram 75×20, Facebook 74×20, Privacy 105×20. Il pulsante «Prova una settimana · 5 €» è 48 px: ok.
Proposta: voci da 48 px (come la home proposta), tasto MENU a 375, link del piede da 48 px.

**9. Corpo del testo piccolo sul telefono.** Il ruolo sotto il nome è 14 px a 768 e 375 (18 px a 1440). Sotto il minimo di 16 px per testo corrente e per chi legge con occhiali (genitori).
Proposta: 15 px sul telefono per le pastiglie (sono etichette), 16 px per il testo.

**10. Titolo della pagina da 200 px su due righe: 560 px di altezza prima delle tessere.** A 1440 «GLI / ISTRUTTORI» occupa y 185–520 e le tessere cominciano a y 594; la descrizione sta a destra in alto con 400 px di vuoto sotto (`d-0.png`). A 375 il titolo è 84 px e la frase sotto è lunga 4 righe (`m-0`).
Proposta: titolo a 156 px su una riga (come la home), descrizione a destra allineata in basso: tessere da y≈290.

**11. Spazio sotto l'ultima tessera e invito finale.** Dopo l'ultima fila c'è la CTA gialla «Vieni a provare: ti aspettiamo in Via Sassi 26, Collegno» alta 300 px con la parola «PROVA» enorme che non sembra un pulsante (stesso problema del punto 3 dell'audit home); tra CTA e piede 6 px.
Proposta: l'invito diventa il 13º posto della griglia; niente seconda CTA.

### BASSA

**12. CLS misurato: 0,070 a 1440 e 0,082 a 375 (0,00003 a 768).** Sotto la soglia di 0,1 («buono») ma non nullo: la pagina non ha immagini di contenuto (il logo ha `width`/`height` dichiarati), quindi lo scatto viene dal cambio del carattere (Big Shoulders Display) con il cerchio e il titolo. Quando arriveranno le foto, ogni `<img>` deve avere `width`/`height` e il riquadro altezza fissa, altrimenti il valore sale.
Proposta: `width`/`height` su ogni foto di ritratto; il riquadro foto con altezza fissa (nel canvas: 300 px).

**13. Foto e testo alternativo: da decidere prima di caricare.** Quando i ritratti ci saranno, l'`alt` deve essere «Ritratto di Nome Cognome» (come nel canvas) e non «Foto». Le iniziali restano `aria-hidden`.

**14. Tema scuro: non esiste** (nessun `prefers-color-scheme: dark`): non c'è niente da verificare.

**15. Ordine delle tessere.** Cognome in ordine alfabetico, ma Innella (Maurizio, presidente e direttore tecnico secondo il canvas) è per primo prima di Ballabio. Non è scritto da nessuna parte: se è una scelta, va detta; se no è un ordine «storico» da confermare.

## Scheda singola (solo canvas, non sul sito)

Dal canvas `TatamiBlu-Istruttore` (e `TatamiBluM-Istruttore`):

- **Titoli delle tre tessere di testo che non descrivono il testo.** «Come ha iniziato» contiene la presidenza dal 1989 e gli studi (non l'inizio); «Come insegna» contiene i progetti nelle scuole (non il metodo). Ora è l'etichetta a essere sbagliata, non il testo.
- **Tre tessere di testo di 36 / 32 / 25 parole** (Chi è, Come ha iniziato, Come insegna; media 31): sono già dentro il ±20% (24,8–37,2). Resta il problema dei titoli, sopra.
- **Quattro tessere dati** (Ruolo, Corsi, Quando, Titoli) di 9, 9, 10, 10 parole: già bilanciate.
- **«Il percorso»**: tre colonne di 7, 5 e 6 voci: altezze diverse, ma sono elenchi veri, non si accorciano.
- **Dati personali**: «Fuori dal tatami» (servizio militare nei paracadutisti, nuoto, montagna) è un dato personale di Maurizio: serve il suo sì a pubblicarlo.
- **Contenuto non verificabile da qui**: tutto quello che il canvas dice di Maurizio (anni, cariche, titoli, orari) è nel canvas, non nel database né sul sito. In questa proposta sta tutto in cartellini «DA CONFERMARE».
- **«Quando»** («Lun, mer e ven; mar e gio con gli agonisti»): è un orario, deve venire dal calendario dell'app, non scritto a mano due volte.
- **Segnaposto «Foto» e «[Nome Cognome]»** nella riga degli altri istruttori: nel mockup non servono più, si usano tessere vere.
