# Segreteria · Listino

← [Torna alla segreteria](README.md)

I costi della stagione: la quota associativa, fino a quando vale il prezzo a
saldo, i corsi coi loro prezzi e le offerte. Sono quelli che legge chi apre la
pagina di iscrizione, e quelli che la ricevuta propone quando si registra un
pagamento. Si cambiano da qui, senza aspettare un aggiornamento dell'app.

Si parte col listino del foglio della segreteria (`costi-2026-27.pdf`), finché
non si cambia qualcosa.

## Cambiare i prezzi

1. **LISTINO** nel menu.
2. Si cambia quello che serve. I cambi restano in una bozza: in fondo compare
   una barra gialla con **LASCIA STARE** e **SALVA**, e fino a **SALVA** la
   pagina di iscrizione mostra ancora quello di prima. Uscendo dal listino con
   la barra aperta l'app chiede: **TORNA A FINIRE** o **ESCI SENZA SALVARE**.
3. **SALVA**. Se qualcosa non va (un prezzo che non si capisce, due corsi con lo
   stesso nome), la barra lo dice in rosso e **SALVA** resta spento.

**VEDI LA PAGINA ↗** apre la pagina di iscrizione in un'altra scheda, per
controllare com'è venuta.

## La stagione

- **QUOTA ASSOCIATIVA** — in euro. Va nella pagina di iscrizione e nella voce
  della quota delle ricevute.
- **SALDO FINO AL** — l'ultimo giorno del prezzo a saldo, compreso. Fino ad
  allora la pagina di iscrizione mostra la colonna **SALDO** (col giorno
  scritto in testa, per esempio **SALDO 31/8**) e la ricevuta propone
  l'annuale a saldo; dopo, sparisce da tutte e due.

## I corsi

Ogni corso è una riga col nome e i prezzi; **CAMBIA** la apre:

- **NOME DEL CORSO** — lo stesso di **CORSI**. È così che la ricevuta trova i
  prezzi dei corsi che fa l'iscritto: se il nome qui è diverso, la ricevuta
  non propone quel corso da solo (si trova comunque in «Aggiungi una voce…»
  se il nome c'è, o si scrive a mano).
- **ETÀ** e **ORARI**, un orario per riga: sono solo testo per la pagina di
  iscrizione, il calendario non li guarda.
- **PREZZI** — **A SALDO**, **ANNUALE** e **TRIMESTRE**, in euro, anche coi
  centesimi (`12,50`). Un prezzo lasciato vuoto non c'è: la pagina scrive un
  trattino e la ricevuta non lo propone. Un corso con più prezzi (la
  Preparazione atletica: 1 giorno, 2 giorni…) ha più righe, e ognuna vuole il
  suo nome: **+ Un'altra riga di prezzi**.
- **COSA COPRE IL TRIMESTRE** — quando il trimestre non è un trimestre intero,
  per esempio «10 lezioni».
- **NOTA** — in rosso sotto i prezzi: «Solo in aggiunta a Judo 3».

**↑ SU** e **↓ GIÙ** cambiano l'ordine della pagina di iscrizione, **Togli dal
listino** toglie il corso (dal listino, non da **CORSI**), **CHIUDI** richiude
la riga. **+ AGGIUNGI UN CORSO** in fondo ne aggiunge uno nuovo.

## Le offerte

Titolo e testo, sotto i corsi nella pagina di iscrizione: lo sconto famiglia,
il prezzo per più corsi. Sono solo da leggere: cambiare il testo non cambia i
conti. La ricevuta calcola da sé solo lo **sconto famiglia**, sempre del 20%
(vedi [Iscritti](iscritti.md)); le altre offerte si scrivono nel prezzo della
voce.

## Tornare al foglio

Quando il listino è stato cambiato, sotto **LA STAGIONE** c'è **Rimetti il
listino del foglio originale**: chiede conferma, e toglie tutti i cambi.

Finché il listino è quello del foglio, la pagina di iscrizione offre anche il
PDF (**IL FOGLIO ORIGINALE**); dopo un cambio non lo offre più, perché direbbe
prezzi vecchi.

## Le ricevute già fatte

Non cambiano: ogni ricevuta ha le sue voci scritte dentro, coi prezzi di quando
è stata fatta.

## Se dice che manca 19-listino.sql

Sul database non è ancora stato lanciato `supabase/19-listino.sql` (vedi
`supabase/LEGGIMI.md`). Finché non c'è, il listino si legge ma non si salva, e
la pagina di iscrizione mostra quello del foglio.
