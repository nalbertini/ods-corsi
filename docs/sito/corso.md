# La pagina di un corso

Design: `docs/design-canvas/sito-approvato/TatamiBlu-Corso.dc.html` (desktop) e `TatamiBluM-Corso.dc.html` (telefono).
Prova: `npm run prova:sito-corso`. Tutto lo stile sta dentro `main.corso`: le altre pagine non cambiano.

## Come si scrive nel pannello SITO

Una pagina è «di un corso» se il testo **prima del primo titolo grande (`h2`)** ha, in quest'ordine:

1. una **foto** (la foto grande, a tutta larghezza, 620px sul computer, 360px sul telefono);
2. un **elenco** di 2–6 voci che cominciano col grassetto (`**Per chi** Dai 7 anni…`): sono le tessere dei dati, quattro in riga sul computer, due per riga sul telefono;
3. uno o più **sottotitoli (`h3`)** col loro testo: le tessere di presentazione (tre in riga sul computer, una sotto l'altra sul telefono).

Il titolo della pagina e la descrizione sono la testata (titolo enorme a sinistra, descrizione a destra; «Contattaci» sta in testata). Se la forma non è questa la pagina resta com'era.

Dopo la testata, ogni `h2` è una sezione:

| Cosa si scrive | Come esce |
| --- | --- |
| `h3` + paragrafi | tessere a due colonne, titolo grande (64px), colori giallo → blu → inchiostro → giallo… |
| `h3` senza testo | tessere più basse, con il titolo in alto |
| `h3` + un paragrafo che è solo grassetto (l'ora) + paragrafi (giorni, età) | **orario**: titolo e ora sulla stessa riga, giorni a sinistra ed età a destra; l'ultima tessera è gialla, le altre azzurre |
| 2–3 foto di fila | fila di foto alte 516px (sul telefono: la prima a tutta larghezza, le altre due affiancate) |
| un solo paragrafo, al massimo 160 caratteri | **banda blu** con il titolo enorme e la frase grande |

## Regole che vengono dal design

- Un `h2` **vuoto** apre una sezione senza titolo: serve per la fila di foto, che nel design non ha titolo. Vale per ogni pagina con titoli.
- Foto di testata tagliata al 58% dall'alto; in una fila la prima al 30% e le altre al 55%.
- Colori: giallo → blu → inchiostro; la quarta tessera è azzurra se ha testo, gialla se ha solo il titolo.
- Un titolo di sezione oltre 30 caratteri è a 22px dalle tessere sul computer e a 48px (invece di 56) sul telefono.
- Testata, invito «Prova» e piede hanno le misure del design solo nelle pagine di un corso (`body.pagina-corso`, nello stesso `<style>` a parte). Nel menu è segnata la voce con indirizzo `/corsi/`; il pulsante in testata sul telefono dice «Prova».
- Il piede del corso ha tre colonne: recapiti, menu principale ripetuto, link legali (il menu «footer»); sul telefono menu e link legali sono due righe con «·».

## Cosa resta diverso dal design

Solo ciò che il testo di una pagina non può avere:

- Il design del telefono usa testi accorciati («Dai 7 anni (nati dal 2019) agli adulti», «Lun, mer e ven…») e di conseguenza qualche altezza: la pagina ha un testo solo, uguale su computer e telefono, quindi le tessere crescono col testo intero.
- «I nostri corsi» è segnato nel menu solo se esiste una voce con indirizzo `/corsi/`.
- A 375px il titolo di un orario è a 31,5px (8,4vw) per non spezzare «principianti»; a 390px, la misura del design, arriva a 34px.

## La pagina nuova (design `docs/design-canvas/corso-miglioramenti/`)

Codice: `src/lib/sitoCorso.ts`. Prova: `npm run prova:sito-corso-nuovo`. Testi pronti: `docs/sito/<corso>.html` (quelli di prima: `<corso>-precedente.html`).

La pagina è nuova se prima del primo `h2` c'è un paragrafo di soli pulsanti con uno verso il modulo online (`https://app.officinedellosport.it/iscrizioni/`, anche con `http`, `www` o senza «/» finale); senza, vale tutto quello sopra. Il giallo viene sempre per primo. Ogni sezione si riconosce dalla forma, mai dal titolo; una forma che non torna si impagina come le altre pagine e nessuna parola si perde.

| Nel testo | Come esce |
| --- | --- |
| prima del primo `h2`: una foto (A) | foto di apertura, poi i dati come tessere (colori giallo, blu, inchiostro) |
| senza foto A: un elenco di 4-6 voci | fascia blu con le prime 3 voci; le altre sono tessere. Nessuna sezione orario |
| `h2` i cui `h3` hanno come primo paragrafo solo l'ora in grassetto (con foto A) | orario a tessere, l'ultima gialla, righe da 6 colonne senza buchi. **Se la pagina è collegata a uno o più corsi** (SITO → ORARIO DAI CORSI) queste tessere non si mostrano: al loro posto ci sono le righe di CORSI («Lunedì e mercoledì · 17:00–18:00», `riga-orario`), o «Orario in arrivo»; con la fascia blu spariscono le voci giorno e ora e resta l'età |
| un `h2` (anche vuoto) con esattamente 2 `h3` di soli paragrafi | «Cosa si fa» (giallo) e «A chi è rivolto» (inchiostro); una foto nel primo gruppo (B) sta accanto, a destra |
| ogni altra sezione con `h3` | come sempre (la storia del judo: quattro tessere) |
| la sezione subito prima della chiusura, con 3 o 4 `h3` e un solo paragrafo ciascuno | «Cosa aspettarsi», tessere numerate |
| l'ultima sezione con un pulsante verso il modulo | chiusura gialla: titolo, frasi, pulsanti, foto C a destra (senza, a una colonna); l'invito «PROVA» del piede non si ripete |

Il punto da tenere al centro delle foto è per corso e ruolo (`FUOCHI_CORSO`), non per file: le foto nuove hanno il nome che dà la libreria IMMAGINI. Un corso senza foto approvate non ha regole di fuoco.
