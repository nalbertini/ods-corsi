# Chi siamo: la pagina come nel design

Testo da incollare nel pannello SITO (PAGINE › Chi siamo), per avere la pagina del design «tatami blu e giallo» (`TatamiBlu-ChiSiamo`, desktop, e `TatamiBluM-ChiSiamo`, telefono). Le regole del layout sono in `chi-siamo.md` del ramo `claude/sito-chi-siamo-abf4d2`.

Come si fa:

1. Apri **PAGINE › Chi siamo**.
2. Nei campi a destra: **titolo** e **descrizione** qui sotto.
3. Apri `docs/sito/chi-siamo.html` nel browser, seleziona tutto (Cmd+A), copia. Nel pannello clicca nel testo, cancella tutto e incolla (Cmd+V).
4. **ANTEPRIMA** per controllare, poi **PUBBLICA**.

## Titolo

Chi siamo

## Descrizione

Le Officine dello Sport di Collegno sono uno spazio dove allenarsi con metodo e passione, mettendosi alla prova ogni giorno.

## Testo

Il testo sta in [`chi-siamo.html`](chi-siamo.html): è quello che va incollato. Ordine: foto con la frase grande, due tessere («Chi siamo oggi», «Come tutto è iniziato»), i quattro numeri, il pannello «Gli istruttori» col pulsante, la fascia di quattro foto, il pannello della missione, poi «I nostri valori» con quattro tessere.

## Cosa cambia rispetto a oggi

- La frase sotto il titolo diventa più corta (oggi aggiunge «Arti marziali e preparazione atletica per ogni età e livello, tra crescita, disciplina e divertimento»).
- «Nasciamo dal judo e oggi siamo un Associazione Sportiva che mette al centro la persona, ad ogni età» diventa la frase grande sulla foto: «Nasciamo dal judo, mettiamo al centro la persona».
- In cima la foto del gruppo e i quattro numeri (300+ atleti, 13 tecnici, 8 attività, 35+ anni di sport), nuovi: oggi non ci sono.
- Nuovo pannello «Gli istruttori» col pulsante «Conosci gli istruttori» (porta a `/istruttori/`) e la fascia di quattro foto.
- Le tre frasi di «I nostri valori» sono quelle di oggi, con un «Accompagniamo» al posto di «Accompagna» (errore di oggi).
- Piccole correzioni di grammatica: «un’Associazione Sportiva», «un’associazione sportiva di judo, A.s.d. il Centro Judo».
- Il resto è identico al testo pubblicato.

## Da controllare prima di pubblicare

- **Tecnici: 13 o 9?** Il design di Chi siamo dice «9» nei numeri e «Tredici» nella frase sotto; la Home dice 13 (i tecnici nel database sono 13). Ho scritto 13 in tutti e due i punti.
- «35+ anni di sport», «300+ atleti», «8 attività»: numeri della Home, da confermare.
- «Nasciamo dal judo»: vero secondo il testo di oggi (A.s.d. il Centro Judo); il nome «Centro Judo» resta com’è.
- Le foto: gruppo di bambini, istruttori, lezione di judo, presa di judo, aikido con una bambina, lotta, preparazione atletica, psicomotricità. Alcune ritraggono minori: servono i permessi dei genitori. FOTO DA SCEGLIERE: la sessione «sito-foto» (`docs/sito/foto.md`) può proporne altre per la fascia di quattro.
- Nella fascia di quattro foto e nel pannello degli istruttori compare una foto già usata nella Home (aikido): se ne vuole una diversa, decide la segreteria.
