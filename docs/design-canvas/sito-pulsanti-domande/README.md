# Sito · parti Pulsanti e Domande

COSTRUITA (`src/lib/sitoPezzi.ts`, `conPartiPulsanti` e `parteSulSito` di `src/lib/sitoGenera.ts`, `EditorPuck.tsx`). Le tavole sono la
proposta approvata; com'è adesso lo dicono `PannelloPuck`, `SitoPulsante` e `SitoDomanda` della libreria.

Due parti nuove nel nuovo editor delle pagine (`EditorPuck.tsx`). La cornice è quella vera, letta dal browser in modalità prova
(1440×900, la pagina sul tablet a 768px); i pulsanti, i titoli e le domande della pagina sono `SitoPulsante`, `SitoTitolo` e
`SitoDomanda` della libreria. Domande scrive l'HTML nella forma che il generatore riconosce già (`domande()` in
`src/lib/sitoDati.ts`). Pulsanti esce in un riquadro suo (`div.pulsanti`, come `div.iscriviti`), che il generatore disegna
sempre con `pulsanti()` di `src/lib/sitoHome.ts`: è l'unico cambio al generatore.

| Tavola | Cosa è |
|---|---|
| 1 · Oggi | Le cinque parti di oggi. Pulsanti e domande si scrivono dentro TESTO |
| 2 · Pulsanti | La parte scelta: da 1 a 3 pulsanti, ognuno con DOVE PORTA e TESTO |
| 3 · Domande | Titolo della parte, coppie domanda e risposta, una domanda senza «?» con l'avviso giallo |

## Scelte proposte

- **Pulsanti**: da 1 a 3. DOVE PORTA è una scelta: Modulo di iscrizione, Telefono, WhatsApp (il numero del sito), Una pagina
  del sito (solo le pubblicate, senza Contatti, che sul sito non esce come pulsante), Altro indirizzo (come il tasto PULSANTE
  di oggi). Il pulsante del modulo è sempre «Iscriviti», giallo e per primo: il testo non si scrive.
- **Impaginazione**: la parte Pulsanti non la cambia mai, neanche in cima alla Home o a un corso. Il cambio di impaginazione
  resta legato ai pulsanti scritti dentro TESTO, come oggi. (Prima c'era una tavola con un avviso giallo per questo: tolta,
  perché non serve più.)
- **Domande**: una parte con un titolo suo («Domande frequenti», si cambia) e le coppie. La risposta ha grassetto, corsivo,
  link ed elenchi. Una domanda senza «?» si salva, ma il pannello avvisa: sul sito tutte le domande della parte escono come tessere colorate e Google non legge quella. Niente «?» messo da solo.
- **Solo nel nuovo editor**. Le pagine con pulsanti e domande scritti in TESTO restano come sono.
- I tocchi sui pulsanti verso il modulo, il telefono e WhatsApp contano già nelle Statistiche: li riconosce dall'indirizzo.

## Differenze del costruito

- Il titolo delle Domande nasce vuoto, con «(vuoto = «Domande frequenti»)» nell'etichetta, come la parte ISCRIVITI.
- Le righe dell'elenco sono corte («1 · Iscriviti», «2 · Scrivici»): dove porta lo dice il pulsante aperto.
- Col modulo non c'è la nota sotto DOVE PORTA: basta quella al posto del testo.
- La fila sul sito ha regole sue (`.pulsanti .pulsante.primario` e `.secondario` in `CSS_SITO`), più forti di `.testo a.pulsante`.
- Cambiando DOVE PORTA l'indirizzo di prima si svuota (`conIndirizziGiusti`).
- Aggiungere un pulsante o una domanda è il «+» di Puck, senza parole.
- Nel vecchio editor le due parti si vedono e si spostano; si cambiano nel nuovo.
