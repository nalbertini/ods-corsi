# La Home del sito, nella nuova veste

Testo da incollare nel pannello SITO (PAGINE › Home) per avere la Home rivista:
hero con i due pulsanti, quattro numeri, schede dei corsi con foto, citazioni
con «Leggi tutto», recensioni, domande e chiamata finale a due colonne.
**Finché non si incolla il testo nuovo la Home resta com'è oggi**: il sito
riconosce quella nuova da un pulsante verso il modulo online nella parte
iniziale del testo. Il testo di prima è in [`home-precedente.html`](home-precedente.html).

## Prima di incollare: le foto

Nella libreria IMMAGINI vanno caricate tre foto nuove (il sito le chiama con il
nome che l'app dà al caricamento):

| Foto | File | Dove |
|---|---|---|
| Judo | `161-judo-C` | scheda Judo |
| Lotta | `446-lotta-A` | scheda Lotta |
| Aikido | `989-aikido-B` | scheda Aikido |

In `home.html` i loro nomi sono segnaposto (`DA-CARICARE-judo-161.jpg`,
`DA-CARICARE-lotta-446.jpg`, `DA-CARICARE-aikido-989.jpg`): dopo il caricamento
si sostituiscono con i nomi veri prima di copiare. Il punto in cui ritagliare
ogni foto lo sceglie il sito dal corso (Judo, Lotta, Aikido, Preparazione
atletica, Giocomotricità), non dal nome del file: cambiare foto non obbliga a
rifarlo. Le altre foto sono già nella libreria; le versioni migliorate di
gruppo, istruttori, sala e cubi (`docs/proposte-home/foto/approvate/`, non nel
repository) si caricano allo stesso modo e si mettono al posto dei nomi attuali.

## Come si fa

1. Apri **PAGINE › Home**.
2. Nei campi a destra: **titolo** e **descrizione** qui sotto.
3. Apri `docs/sito/home.html` nel browser, seleziona tutto (Cmd+A), copia. Nel
   pannello clicca nel testo, cancella **tutto** (anche il vecchio elenco da 9
   voci, se resta, appare come elenco semplice) e incolla (Cmd+V).
4. **ANTEPRIMA** per controllare, poi **PUBBLICA**. Il sito si aggiorna dopo
   una decina di minuti. L'anteprima del pannello mostra solo il testo: i
   riquadri si vedono sul sito pubblicato.

## Titolo

Si cresce sul tatami.

## Descrizione

Arti marziali e preparazione atletica a Collegno, dai 3 anni in su. Prova una settimana a 5 €.

## Come è scritto il testo (per chi lo modifica)

Il sito legge la forma, non i titoli: si possono cambiare le parole, non l'ordine.

- **Pulsanti** (prima del primo titolo grande): un paragrafo con due pulsanti,
  «Prova una settimana a 5 €» → `https://app.officinedellosport.it/iscrizioni/`
  e «Scrivici» → `/contatti/`. Il pulsante del modulo online è quello che fa
  riconoscere la Home nuova (anche scritto con `http` o senza «/» finale): se lo
  togli, la Home torna come prima. Il primo è sempre il giallo. «Scrivici» solo
  se la pagina Contatti è pubblicata.
- Una **foto** (il gruppo): sta accanto al titolo.
- Un **elenco di 2-6 voci** col numero in grassetto: sono le tessere dei numeri
  (qui 4: 35+, 9, 300+, 13).
- Un **titolo piccolo** seguito da due paragrafi: la fascia «Il corso giusto,
  il gruppo giusto» (titolo a sinistra, frasi a destra).
- **I nostri corsi**: per ogni corso un titolo piccolo con il link alla pagina, una
  foto (facoltativa: senza foto la scheda ha una fascia con l'iniziale), un
  paragrafo con l'età, uno con la descrizione e un ultimo tutto in corsivo con
  le fasce separate da « · » (Bambini · Adulti · Anziani · Agonisti). Solo la
  prima foto di una scheda conta.
  Il sito li divide da solo in tre gruppi per età, dal primo numero del paragrafo
  dell'età: fino a 6 «Piccoli 3-6 anni», da 7 a 13 «Ragazzi 7-14 anni», da 14 «Dai
  14 anni», con una riga di link ai gruppi in cima. Un corso sta in un gruppo solo, quello da cui si
  può cominciare, e dentro il gruppo va dal più piccolo al più grande. Se un corso non ha il
  paragrafo dell'età con un numero, o i corsi cadono in un gruppo solo, restano in un elenco unico.

- **Perché unirti a noi?** (facoltativa, oggi non c'è): quattro titoli piccoli, ognuno col suo paragrafo.
- **Citazioni** (oggi stanno in Chi siamo, non nella Home; la forma è la stessa): più citazioni di fila. In ognuna: l'estratto (le virgolette le
  mette il sito, non scriverle), poi il testo intero, poi la firma in corsivo.
  «Leggi tutto» apre il testo intero nella carta; senza il testo intero la
  citazione resta com'è. Il sito non accorcia mai un testo: l'estratto lo scrive chi pubblica, uguale alle parole dell'autore, con «[…]» dove si salta.
- **Recensioni**: due citazioni (testo e firma in corsivo), poi un titolo
  piccolo «In breve» con un elenco di frasi brevi, ognuna col nome in corsivo.
  Senza il titolo e l'elenco le recensioni sono carte uguali.
- **Domande**: titoli piccoli che finiscono con «?», ognuno col suo paragrafo.
- **Chiamata finale** (l'ultima sezione): titolo, paragrafo con l'indirizzo e
  «vicino alla metro Fermi», i due pulsanti, la foto degli istruttori. Senza,
  il sito mette l'invito giallo di sempre.

## Cosa cambia rispetto a oggi

- Titolo da 156 px su tre righe, due pulsanti, foto di gruppo orizzontale; quattro numeri uguali; «Prova una settimana a 5 €» non è più un numero ma un pulsante.
- Nove schede con foto (Judo, Lotta, Aikido, Preparazione atletica, Giocomotricità) o con l'iniziale, con testi di 12-14 parole.
- «Perché unirti a noi?» e «Lo sport secondo chi lo studia» non stanno più nella Home: i fatti sono nei quattro numeri sotto il titolo, le citazioni sono in Chi siamo (prima della chiamata finale). Il testo di questi due blocchi non è perso: i quattro punti non hanno un dato che li provi (i «podi» non hanno un numero), le citazioni sono in `chi-siamo.html`.
- «Lo sport secondo chi lo studia» al posto di «Cosa dicono gli esperti»; «Cosa dicono di noi» al posto di «Cosa dicono i nostri clienti» (recensioni uguali a prima, refusi compresi).
- Cinque domande al posto di sei (le due sulla prova sono una).
- Menu: sul telefono un tasto MENU; in testata e nel piede «vicino alla metro Fermi».

## Da controllare prima di pubblicare

- Le liberatorie delle foto con minori (le ha l'utente per tutte quelle proposte).
- «Nicola A.» ha dato il permesso a comparire col nome? La recensione di Nando nomina «Maurizio»: va bene?
- Le tre citazioni: l'estratto è letterale (con «[…]»), il testo intero è quello di oggi.
