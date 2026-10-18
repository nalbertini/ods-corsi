# Segreteria · Corsi

← [Torna alla segreteria](README.md)

Un **corso** è cosa si fa (Judo 2, Lotta adulti…), dove, con chi e per quanti
posti. Le **ricorrenze** dicono quando: «lunedì alle 17:00 per 60 minuti», e
dove, se quel giorno si fa in un'altra sala. Le lezioni del calendario si
generano da quelle.

## L'elenco

Per ogni corso: nome, sala e istruttori, **QUANDO** («lun mer ven 17:00») e
**ISCRITTI** (`14/20` su posti; in giallo quando è pieno). Se un giorno si fa
in un'altra sala lo si vede sotto il nome: «Motricità · gio Tatami». Un clic
apre la scheda: sul computer accanto all'elenco, sul tablet e sul telefono al
suo posto. Indietro torna all'elenco, anche dal nuovo corso; un corso
archiviato, aperto da un link vecchio, non si apre e lo si dice.

I dati che mancano sono in **rosso**, perché vanno completati: un corso senza
istruttore («istruttore da assegnare»), senza sala o senza giorni ha il bordo
sinistro rosso, e sopra l'elenco si legge quanti sono. Nella scheda il campo da
riempire ha l'etichetta rossa. Anche nella **SETTIMANA** una lezione senza
istruttore o senza sala lo dice in rosso («istruttore?»).

I corsi archiviati stanno in fondo: «N corsi archiviati · mostra», e
**Ripristina** li rimette in calendario.

## Nuovo corso, o cambiare un corso

**NUOVO CORSO**, o un clic su un corso esistente:

- **NOME**, **SALA**, **POSTI** — il prezzo del corso sta in [LISTINO](listino.md) e
  segue il corso se ne cambi il nome (vedi lì); la sala è quella di tutti i giorni che non
  ne hanno una loro (vedi sotto);
- **TESSERA RICHIESTA** — l'ente della tessera che chi si iscrive deve avere (**FIJLKAM**, **FIPE**…),
  in maiuscolo; vuoto se il corso non la chiede (psicomotricità, giocomotricità…). Serve a [TESSERE](tessere.md):
  senza, l'app non sa a chi chiederla. Il campo c'è solo se il database ha le tessere;
- **ISTRUTTORI** — anche più d'uno: il primo che scegli è quello di
  riferimento;
- **COLORE** — segue la disciplina (blu judo, rosso lotta, giallo pesi, verde
  motricità), così da lontano si capisce cos'è.

**Salva** per confermare, **Lascia stare** per non cambiare niente. Se hai
cambiato qualcosa e non l'hai salvato (anche un giorno nuovo a metà, o qualcuno
scelto in «Iscrivi qualcuno…»), aprendo un altro corso l'app chiede prima:
**Torna a finire** o **Esci senza salvare**.

## Le ricorrenze (i giorni)

Nella scheda, sotto **RICORRENZE**:

- **+ Aggiungi un giorno** → giorno, ora, minuti, sala → **Aggiungi**;
- la ✕ accanto a un giorno lo toglie (chiede conferma).

Cambiare i giorni tocca **solo le lezioni future**: quelle con un appello
restano come sono, il passato è già nel registro. Un corso senza giorni non
genera lezioni.

## Un'attività per giorno

Sotto ogni giorno, accanto alla sala, c'è **ATTIVITÀ**: cosa si fa quel giorno
(«Karate» il lunedì, «Open mat» il giovedì), scelta fra l'elenco di
[Impostazioni](regole.md#le-attività). **Nessuna attività** è la scelta di
partenza. Anche **+ Aggiungi un giorno** la chiede.

Vale **da oggi in poi**: le lezioni future la seguono da sole. Le lezioni già
fatte e quelle con l'appello restano com'erano; anche quelle che hai cambiato a
mano dalla [settimana](settimana.md#aprire-una-lezione). Sul tablet di sala e
nell'app degli istruttori l'attività si legge accanto all'orario.

## Un giorno in un'altra sala

Un corso può fare il lunedì in Motricità e il giovedì in Tatami. Sotto ogni
giorno c'è **SALA**:

- **Sala del corso** (quella di partenza): il giorno segue la sala del corso,
  e se il corso cambia sala cambia anche lui;
- un'altra sala: quel giorno si fa lì, e resta lì anche se il corso cambia
  sala. Il riquadro si colora di giallo, per vederlo a colpo d'occhio.

Il cambio si salva subito e vale **dalle lezioni future**: quelle già fatte
restano dov'erano. Le lezioni di quel giorno compaiono sul tablet della sala
nuova, e nella **SETTIMANA** col filtro di quella sala.

Per una volta sola (una gara, un tatami occupato) non serve toccare il corso:
si sposta la lezione dalla [settimana](settimana.md), e «Come da corso» la
rimette nella sala del suo giorno.

## Gli iscritti del corso

Nella scheda di un corso ci sono due schede: **DATI** (nome, sala, istruttori,
ricorrenze: si apre questa) e **ISCRITTI**, col conto `14/20` scritto anche da
chiusa. Il conto diventa giallo quando il corso è pieno e rosso quando gli
iscritti sono più dei posti. Un corso nuovo ha solo DATI. Se hai modifiche non
salvate, su DATI compare un **●** giallo, anche mentre guardi ISCRITTI.

In **ISCRITTI** c'è una persona per riga: cognome, nome, **ISCRITTO DAL**,
certificato e quota, a parole (come in [Iscritti](iscritti.md)), così si vede
subito chi ha qualcosa che non va.

Sopra l'elenco una riga dice come sta il corso: `16/20 · 3 SENZA CERTIFICATO ·
4 DA PAGARE`, oppure `TUTTO IN REGOLA`. Conta tutto il corso, anche mentre
cerchi o filtri. «Senza certificato» è chi non ce l'ha o ce l'ha scaduto; «da
pagare» è chi non ha pagato tutto, anche a metà: sono gli stessi conti della
pagina [Iscritti](iscritti.md). Il certificato in scadenza non è un guaio: lo
vedi nella colonna. A corso pieno la riga dice `CORSO PIENO` (giallo), oltre i
posti `2 IN PIÙ DEI POSTI` (rosso); senza posti indicati, `16 ISCRITTI`.

- **Cerca** per nome o cognome: maiuscole, accenti, apostrofi e trattini non
  contano («dangelo» trova D'Angelo). Se non trova nessuno lo dice. Con una
  ricerca accesa si legge quanti sono, «3 DI 22».
- **Non in regola** mostra solo chi ha il certificato scaduto o mancante, o la
  quota da pagare (anche a metà): come il tasto della pagina Iscritti. Va
  insieme alla ricerca. Se non c'è nessuno, l'elenco dice «Tutti in regola.» e
  il tasto resta premuto: toccalo di nuovo per spegnerlo.
- **Ordina** toccando l'intestazione di una colonna: un secondo tocco rovescia,
  un terzo torna all'ordine per cognome. Con CERTIFICATO o QUOTA in cima ci
  sono quelli che hanno il guaio.
- Un clic su un iscritto apre **la sua scheda** in ISCRITTI. **Indietro** torna
  al corso, sulla scheda ISCRITTI, con la ricerca, il filtro e l'ordine che
  avevi. Lo stesso fa **CORSO** in alto nella scheda della persona (se la
  apri da un altro posto, dice ISCRITTI e torna all'elenco). Se nel corso hai
  modifiche non salvate l'app chiede prima.
- Il menu «Iscrivi qualcuno…» con **Iscrivi** sta in questa
  scheda. A corso pieno lo dice, ma si può iscrivere lo stesso.
- Se l'app non riesce a leggere le persone lo dice, invece di mostrare zero
  iscritti.

## Archiviare

**Archivia** toglie il corso dal calendario: le lezioni future senza appello
spariscono, il registro resta. Si ripristina quando si vuole.
