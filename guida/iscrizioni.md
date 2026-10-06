# Iscrizioni

*Indirizzo: `iscrizioni/` · Per: chi vuole iscriversi · Senza accesso*

← [Torna alla guida generale](README.md)

È la pagina pubblica da mandare a chi chiede come ci si iscrive, al posto della
lista di passi scritta ogni volta su WhatsApp. Non chiede nessun accesso.

L'indirizzo è <https://nalbertini.github.io/ods-corsi/iscrizioni/>. In
segreteria si copia al volo con **COPIA LINK ISCRIZIONI**, in fondo al menu.

## Cosa c'è nella pagina

- **Prima di iscriverti**: le **prove**, una lezione (3 €) o una settimana
  (10 €), per chi non ha ancora deciso, con il tasto CHIAMA.
- **I passi, in ordine**, ognuno col suo tasto:
  1. **Leggi il modulo** — per maggiorenni, o per minori (firmato dal
     genitore). Col modulo dell'app si firma col dito nell'ultimo passo; chi
     preferisce lo stampa, lo firma a mano e ne carica la foto.
  2. **Il pagamento** — la quota associativa e il trimestre, oppure l'annuale,
     con l'IBAN da copiare con un tocco e il tasto **PAGA CON SATISPAY**, che
     apre l'app sul negozio dell'associazione (il link è
     `PAGAMENTO.satispay` in `src/lib/iscrizione.ts`). Oppure in contanti in
     segreteria.
  3. **La richiesta** — con il modulo dell'app (**COMPILA LA RICHIESTA**)
     oppure, finché quello non è acceso, con il modulo Google (**APRI IL
     MODULO**), che ha i suoi passi: scaricare il modulo, firmarlo e caricarlo.
- **I costi** della stagione, quelli del [listino](segreteria/listino.md)
  della segreteria, e il foglio in PDF finché il listino non è stato
  cambiato. Passata la data del saldo (il 31 agosto) la colonna **SALDO 31/8**
  sparisce: quel prezzo non vale più.
- **I contatti**: CHIAMA, MAPPA, INSTAGRAM, FACEBOOK, IL SITO.

## Il modulo di iscrizione dell'app

Chi si iscrive risponde alle domande dal telefono:

- **Chi si iscrive**: nome, cognome, codice fiscale, data e luogo di nascita.
  Scritto il codice fiscale, data e luogo si riempiono da soli e non si
  cambiano (si corregge il codice); accanto alla data c'è quanti anni ha, così
  il codice del genitore al posto di quello del figlio si vede subito. Se il
  codice non è valido, la data si scrive a mano.
  Se dalla data di nascita risulta **minorenne**, il modulo chiede anche i dati
  del **genitore** e il modulo per minori, che firma il genitore.
- **Residenza**, e **come raggiungerti** (email, telefono e, se si vuole, un
  **telefono 2**; per un minore, quelli del genitore).
- **I corsi** a cui iscriversi e **come paghi** (trimestre o annuale). Sotto
  ogni corso ci sono età e orari del listino. Scritta la data di nascita, i
  corsi giusti per quell'anno vengono per primi, sotto **PER LA SUA ETÀ** (anche se si è nati nei sei
  mesi prima o dopo gli anni del corso); sotto **SENZA FASCIA D'ETÀ**
  quelli per cui il listino non dice gli anni, e sotto **ALTRI CORSI** quelli
  di un'altra età: si possono scegliere lo stesso, e un avviso giallo dice
  quali sono e che la segreteria richiama. Un corso che il listino non ha
  ancora (senza prezzo) si sceglie lo stesso, e sotto il nome c'è scritto
  «prezzo da confermare».
- **Il modulo**: le autorizzazioni si firmano **qui, col dito** (o col mouse
  dal computer). Si sceglie come sul foglio se si acconsente al
  **tesseramento** alla FIJLKAM e/o FIPE e se si autorizzano le **foto**; per
  un minore si scrive anche dove è nato il genitore, e firma il genitore.
  **GUARDA IL MODULO** mostra il PDF com'è venuto: il foglio della palestra
  con i dati delle domande, le crocette, la data e la firma su ogni riga dove
  serve, e in fondo, in piccolo, che è stato firmato dal telefono e quando.
  È quello che parte come modulo firmato. Chi ha già il foglio firmato a mano
  sceglie **Ho il foglio firmato** e ne carica la foto.
  Se si cambia la data di nascita e chi si iscrive diventa minore (o non lo è
  più), il foglio è un altro: firma, crocette e foto del foglio si azzerano, e
  un avviso giallo dice «Firma e autorizzazioni vanno rifatte».
- **I file**: la foto della **carta d'identità** (per un minore, quella del
  genitore; non si chiede per un minore aggiunto dal nucleo, perché la
  segreteria ha già quella del genitore), il retro se serve, il **certificato
  medico** se ce l'ha già (lo vede solo la segreteria), e la **ricevuta del pagamento** se ha già pagato:
  chi paga in contanti al banco la lascia vuota (accanto c'è **PUOI PAGARE IN
  SEGRETERIA**). Il certificato si
  chiede solo quando serve: dai 6 anni quello normale, dai 12 quello
  agonistico se tra i corsi scelti c'è judo, aikido o lotta (lo dice il nome
  del corso). Si può anche portare dopo in segreteria (accanto al nome
  c'è **PUOI PORTARLO DOPO**), ma senza non si
  partecipa alle lezioni: se non è stato caricato, lo ricorda **RICHIESTA
  ARRIVATA**. Il documento la segreteria lo stampa, lo tiene su carta e lo
  cancella dall'app; il certificato resta nell'app e lo vede solo la
  segreteria.
- **Altro**: le note per la segreteria (facoltative, e **mai dati sulla
  salute**: quelli si portano in segreteria), la casella obbligatoria
  «Accetto il Regolamento Sociale» (col link al regolamento, quando c'è:
  `REGOLAMENTO` in `src/lib/iscrizione.ts`) e la casella «Ho letto
  l'informativa privacy».

Nel modulo non resta niente sul telefono: chiuso, si riparte da capo. Per
questo **← INDIETRO**, se c'è già qualcosa di scritto, firmato o scelto, al
primo tocco chiede «LE RISPOSTE SI PERDONO · ESCI?» e esce solo al secondo;
senza il secondo tocco, dopo qualche secondo torna com'era.

Premuto **MANDA LA RICHIESTA**, compare **RICHIESTA ARRIVATA**. Se un file non
è partito compare **MANCA QUALCHE FILE**, con il tasto per riprovare (per
un'ora); altrimenti i fogli si portano in segreteria.

La richiesta **non è ancora un'iscrizione**: arriva in segreteria, in
[RICHIESTE ONLINE](segreteria/richieste.md), dove qualcuno guarda i file e la
accoglie.

## Cosa dire a chi chiede

- «Ti mando il link: ci sono i passi, i costi e il modulo.»
- «Quando hai mandato la richiesta la guardiamo noi e ti iscriviamo ai corsi
  che hai scelto.»
- Per i dubbi: telefono o passare in palestra, come dice il fondo della
  pagina.
