# Segreteria · Vestiario

← [Torna alla segreteria](README.md)

Gli ordini di vestiario, judogi e costumini da lotta, al posto del modulo
Google. Le famiglie ordinano da un link; la segreteria tiene il catalogo,
segna chi ha pagato e, alla chiusura, scarica l'elenco per il fornitore. Al
fornitore va solo quello che è **saldato**.

## Aprire gli ordini

1. **VESTIARIO** nel menu, poi **CATALOGO E CHIUSURA**.
2. **CHIUDE IL**: l'ultimo giorno in cui le famiglie possono ordinare,
   compreso.
3. I capi, uno per voce:
   - **NOME**;
   - **PREZZO** in euro, uguale per tutte le taglie;
   - **TAGLIE** separate da virgola (`120, 130, 140`);
   - una **NOTA** per aiutare a scegliere la taglia («altezza del bambino
     + 10 cm, i campioni sono in segreteria»).
   Due prezzi per lo stesso capo, per esempio la felpa da bambino e da adulto,
   vogliono due capi con due nomi diversi.
   - il **TIPO**: **JUDOGI**, **COSTUMINI LOTTA** o **VESTIARIO LOGATO**. È il
     passo «che tipo di capi ti serve?» della pagina. Finché anche un solo
     capo è senza tipo, le famiglie vedono tutti i capi in una pagina sola:
     la riga del capo lo dice con **SENZA TIPO**, e prima di **SALVA** un
     avviso giallo elenca i capi senza tipo;
   - la **FOTO**, con **CARICA FOTO**: va bene anche quella del telefono,
     l'app la rimpicciolisce da sola. Solo il capo, niente persone: la foto è
     pubblica.
4. **LE TABELLE DELLE TAGLIE**: un'immagine per tipo, in cima alla pagina
   di quel tipo. Una tabella in PDF va prima fotografata o salvata come
   immagine.
5. **SALVA**. Come nel listino, i cambi restano in una bozza finché non si
   salva, e se qualcosa non va la barra lo dice in rosso. Le foto nuove vanno
   sulla pagina solo con **SALVA**; quelle sostituite o tolte si cancellano,
   e la barra lo dice prima. **VEDI LA PAGINA** apre la pagina come la vede
   la famiglia, con quello che è salvato.
6. **COPIA LINK ORDINI**, in fondo al menu, copia il link da mandare nel gruppo
   WhatsApp.

Senza data o senza capi, la pagina degli ordini è chiusa.

## Le raccolte

Una **raccolta** è un giro di ordini: quello di ottobre, quello di marzo. In
cima a VESTIARIO si sceglie quale guardare; la prima è quella di adesso.

- Cambiare **CHIUDE IL** quando la data non è ancora passata è una
  **proroga**: la raccolta resta la stessa, con i suoi ordini.
- Mettere una data nuova quando la raccolta è già chiusa apre una **raccolta
  nuova**, vuota. Gli ordini di prima restano nella loro.
- Salvare senza data, o con la stessa data, cambia solo i capi.

Sotto **CHIUDE IL** l'app dice cosa farà il salvataggio. Prima di salvare una
data già passata, o una che apre una raccolta nuova, chiede conferma: una data
sbagliata per errore dividerebbe gli ordini in due raccolte.

## Gli ordini

In cima ci sono cinque numeri della raccolta: gli ordini, quanti sono saldati,
quanti da saldare, quanto è incassato, quanto manca. Gli ordini annullati non
contano.

Sotto c'è l'elenco, dal più recente: ogni ordine dice quando è arrivato e da
dove, **dal link** o **dal banco**. Due ordini con lo stesso telefono nella
stessa raccolta hanno il bollino **STESSO TELEFONO**: spesso è un doppione, da
guardare prima di segnare il pagamento. L'elenco ha i filtri **TUTTI**, **DA SALDARE**, **SALDATI** e
**ANNULLATI**. **DA SALDARE** è in rosso: chi ordina ha lasciato il telefono,
per chiamarlo.

Un ordine si apre a tutta pagina:

- **IL PAGAMENTO** — quando la famiglia ha pagato si sceglie come:
  **BONIFICO**, **SATISPAY** o **CONTANTI**. L'ordine diventa saldato e dice
  come e quando («Saldato con bonifico il 3 ottobre»). Se una parte era già
  stata pagata, resta scritto solo l'ultimo modo e l'ultimo giorno. **Togli il segno** lo
  rimette da saldare, senza niente di pagato.
- **Le righe** — per chi è il capo, capo, taglia e quantità. Si correggono
  quando una famiglia chiama per cambiare una taglia; il totale si ricalcola.
  Una riga che c'era tiene il suo prezzo, una nuova prende quello di adesso.
  Fino a **SALVA** è una bozza. Se l'ordine è già saldato e il totale sale,
  prima di salvare l'app lo dice e chiede: **RESTA SALDATO** (la differenza
  è già sistemata) o **TOGLI IL SEGNO** (la famiglia deve ancora pagare la
  differenza). Se il totale scende, l'ordine resta saldato: un rimborso si fa
  a parte. Con **TOGLI IL SEGNO** l'app ricorda quanto era già stato
  pagato: l'ordine dice «Pagati 63 € · mancano 7 €», e nei numeri in cima
  manca solo la differenza.
  Un ordine annullato non si corregge: prima si rimette.
- **SPOSTA** — porta l'ordine in un'altra raccolta, per esempio chi ha pagato
  dopo la chiusura e va nel giro dopo.
- **ANNULLA L'ORDINE** — per un doppione o un ripensamento. Chiede conferma.
  L'ordine resta nell'elenco come ANNULLATO e non va al fornitore; si rimette
  con **RIMETTI L'ORDINE**. Se la famiglia aveva già pagato, il rimborso si fa
  a parte.

Gli ordini già arrivati non cambiano se cambia il catalogo: ogni riga tiene il
prezzo di quando è arrivata.

## Un ordine dal banco

**NUOVO ORDINE** scrive un ordine per chi telefona o passa in segreteria, anche
a raccolta chiusa. **SALVA, GIÀ SALDATO** è per chi paga subito: si sceglie
come (contanti, se non si cambia). Se c'è già un ordine con lo stesso telefono,
prima di salvare l'app lo dice e propone di aprire quello.

## Alla chiusura

In fondo a VESTIARIO ci sono due scarichi, che si aprono con Excel:

- **ELENCO PER IL FORNITORE** — capo, taglia e quantità, solo degli ordini
  saldati e non annullati.
- **ELENCO PER PERSONA** — per chi è ogni capo, con chi ha ordinato e il
  telefono: serve a distribuire quando arriva il pacco.

Un nome che comincia con `=`, `+`, `-` o `@` esce nel file con un apostrofo
davanti, così Excel lo legge come testo e non come formula.

Chi non ha pagato entro la data non entra nell'elenco del fornitore. Lo decide
la segreteria caso per caso: si sposta nella raccolta dopo, oppure si annulla.

## Chi vede gli ordini

Solo la segreteria, e chi è segreteria e istruttore. Gli istruttori e il tablet
di sala no.

## Se dice che manca 47-vestiario.sql

Sul database non è ancora stato lanciato `supabase/47-vestiario.sql` (vedi
`supabase/LEGGIMI.md`). Finché non c'è, la pagina degli ordini dice che non sono
ancora aperti: nell'avviso su WhatsApp si continua col modulo Google.

## Se dice che manca 51-vestiario-foto.sql

Sul database non è ancora stato lanciato `supabase/51-vestiario-foto.sql`.
Finché non c'è, il catalogo si salva senza tipi e foto e la pagina mostra
tutti i capi in una pagina sola. Se si rilancia `47-vestiario.sql`, va
rilanciato anche il 51.
