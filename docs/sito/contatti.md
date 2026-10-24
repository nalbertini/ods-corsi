# Contatti: la pagina rivista

Testo da incollare nel pannello SITO (PAGINE › Contatti) per avere la pagina Contatti del design
(`docs/design-canvas/contatti-miglioramenti/`): due pulsanti in cima, quattro recapiti, «Come arrivare»
con la mappa, «Una settimana per scegliere» in tre passi, due foto, cinque domande.
**Finché non si incolla il testo nuovo la pagina resta com'è oggi**: il sito riconosce quella nuova da un
pulsante verso il modulo online prima del primo titolo grande (come la Home).

## Prima di incollare: i segnaposto

Nel testo ci sono due cose da decidere. Finché non sono risolte, vanno scelte a mano:

| Dove | Oggi nel testo | Cosa serve |
|---|---|---|
| **C5**, «In auto» | `[C5: dove si parcheggia]` | Dove si parcheggia. Se non si sa, togli tutto il blocco «In auto» (titolo e riga): le altre due righe restano. Se lo lasci, il segnaposto si vede sul sito |
| **C3**, Facebook | `facebook.com/ilCentroJudo` | La pagina è quella giusta? Il nome è «Officine dello Sport» ma l'indirizzo è del Centro Judo |
| **C7**, via | «Via Vittorio Sassi 26» | Deciso il 18 ottobre 2026: sempre «Via Vittorio Sassi», come il navigatore (Google Maps). Se cambia, cambia anche in `src/lib/sito.ts` (`CONTATTI.indirizzo`) |

## Prima di incollare: le foto

Nella libreria IMMAGINI vanno caricate due foto (versioni sviluppate: `lezione.jpg` e `sala.jpg` in
`docs/design-canvas/contatti-miglioramenti/img/`, non nel repository):

| Foto | Segnaposto nel testo |
|---|---|
| Lezione di judo, gli allievi in fila | `DA-CARICARE-contatti-lezione.jpg` |
| Sala della preparazione atletica | `DA-CARICARE-contatti-sala.jpg` |

Dopo il caricamento sostituisci i due segnaposto in `contatti.html` con i nomi veri, prima di copiare.
La mappa è `sito/risorse/mappa.webp`: c'è già, non va caricata. **Non c'è la foto dell'ingresso** (C6): il layout è a due foto;
se ne metti una o tre, la fila si adatta.

## Come si fa

1. Apri **PAGINE › Contatti**.
2. Nei campi a destra: **titolo** e **descrizione** qui sotto.
3. Apri `docs/sito/contatti.html` nel browser, seleziona tutto (Cmd+A), copia. Nel pannello clicca nel testo, cancella **tutto** e incolla (Cmd+V).
4. **ANTEPRIMA** per controllare, poi **PUBBLICA**. L'anteprima del pannello mostra solo il testo: i riquadri si vedono sul sito pubblicato.

## Titolo

Contattaci

## Descrizione

Chiamaci, scrivici o passa in sede. Ti aiutiamo a scegliere il corso più adatto a te o alla tua famiglia.

## Come è scritto il testo (per chi lo modifica)

Il sito legge la forma, non i titoli: si possono cambiare le parole, non l'ordine.

- **Pulsanti** (prima dei recapiti): un paragrafo con «Prova una settimana a 5 €» → `https://app.officinedellosport.it/iscrizioni/`
  e «Scrivici» → `https://wa.me/393463292786` (WhatsApp). Il pulsante del modulo online fa riconoscere la pagina nuova: se lo togli,
  la pagina torna come prima. Il primo è sempre il giallo. L'indirizzo di WhatsApp si scrive **con `https://`**: senza, il sito toglie il link.
- **Recapiti**: quattro titoli piccoli (Telefono, Instagram, Facebook, Indirizzo), ognuno con il valore e, in un paragrafo che è solo un link,
  l'azione («Chiama ora →», …). La tessera intera è un bersaglio da toccare. Il telefono usa `tel:`.
  Sopra il titolo sta una piccola icona decorativa, scelta dal link dell'azione (`tel:`, Instagram, Facebook, mappe): un link che non si riconosce resta senza.
- **Come arrivare**: un paragrafo, la **mappa** (immagine), il pulsante «Ottieni indicazioni» e tre titoli piccoli con una riga ciascuno
  (In metro, In auto, Col navigatore). La lettera nel quadratino è l'iniziale dell'ultima parola del titolo.
- **Una settimana per scegliere**: un paragrafo e **tre** titoli piccoli, ognuno con un paragrafo (numerati 1-2-3). Con due o quattro, o con un titolo che finisce con «?», diventano tessere come le altre. Le **foto** subito dopo l'ultimo passo escono in fila sotto la sezione (una, due o tre).
- **Domande**: titoli piccoli che finiscono con «?», ognuno col suo paragrafo (sono anche i dati per Google).
- **Orari**: nessuno in pagina. Quando ci sono, aggiungili con la segreteria (e ai dati per Google).

## Cosa cambia rispetto a oggi

- Titolo da 140 px (era 200), con due pulsanti: prova una settimana a 5 € e Scrivici su WhatsApp.
- Quattro recapiti tutti toccabili per intero (prima solo il testo sottolineato, 39 px), con l'azione scritta.
- «Come arrivare»: mappa con segnaposto e tre modi; sparisce «A pochi metri dalla metropolitana Fermi» (ripetuta due volte), resta «vicino alla metro Fermi, Linea 1», senza minuti.
- «Una settimana per scegliere»: i tre modi per cominciare; la prova vale per tutte le età dai 3 anni, solo la settimana.
- Due foto invece di tre, più larghe; sul telefono si vedono tutte.
- Cinque domande al posto di sei (le due sulla prova diventano una; nuova «Posso provare una sola lezione?», risposta «No»).
- Un solo passo tra le sezioni: 96 px sul computer, 64 sul telefono.
- Il telefono dice «Chiama ora →» (il design diceva «Chiama o scrivi su WhatsApp →», ma il tocco apre la chiamata: WhatsApp è il pulsante «Scrivici»).

## Da chiedere alla segreteria (la lista che il cliente si aspetta)

- Quando si può passare in sede senza appuntamento? (Oggi la pagina dice «chiamaci e ti diciamo quando».)
- Dopo il modulo online: chi richiama, entro quando?
- Per la settimana di prova serve il certificato medico? Cosa portare? Si sceglie una disciplina o si provano tutte (anche a 3-5 anni)?
- Quanti minuti a piedi dalla metro Fermi? (Si scrive solo se arriva un numero.)
- Il numero risponde su WhatsApp a tutte le ore?
