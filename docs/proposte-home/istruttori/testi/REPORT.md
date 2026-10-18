# Testi della pagina Istruttori: schede bilanciate

Solo proposta. Niente scritto sul sito, nel database o in `src/`. Misure con `conta.mjs` (stessa cartella: `node docs/proposte-home/istruttori/testi/conta.mjs`).

## Cosa so e cosa no

- **Dal database** (`docs/sito/istruttori.html`): nome, cognome e corsi di 13 persone. Nient'altro.
- **Da un canvas** (`sito-approvato/TatamiBlu-Istruttore`): una scheda completa per Maurizio Innella (ruolo, titoli, orari, studi, cariche, vita fuori dal tatami). Non è nel database né sul sito: è un testo del design, tutto da riconfermare con lui.
- **Per gli altri dodici non esiste nient'altro.** Non ho scritto qualifiche, cinture, anni di esperienza, brevetti o «storie» per nessuno: sarebbero fatti su persone vere.

## 1. Elenco: la lunghezza non si pareggia con le parole, si pareggia con la forma

| | Parole per tessera | Entro ±20% della media |
|---|---|---|
| **Oggi** («Cognome · ruolo · corsi») | da 2 a 11, media 4,2 | **2 su 13** |
| **Proposta** (solo corsi, in pastiglie) | da 1 a 5, media 2,7 | **2 su 13** |

Una persona insegna **un** corso, un'altra **tre**: con i soli dati veri la differenza è strutturale. Gonfiare le tessere corte con frasi generiche («Insegna con passione…») sarebbe inventare.

Cosa fa la proposta (opzione A, quella disegnata nel canvas):

1. **Stessa forma per tutti**: foto quadrata, nome (Big Shoulders 48 px), cognome (Inter 600 20 px), pastiglie dei corsi. Altezza identica (500 px); nome sempre in alto e alla stessa quota; il vuoto sta in fondo, non in mezzo (oggi i nomi di una fila sono a quote diverse: audit 3).
2. **Il ruolo esce dalla tessera.** «Maestro di Judo V Dan» è l'unico ruolo scritto e sbilanciava la prima tessera da sola (11 parole contro 2). Va nella scheda.
3. **Cognome accanto al nome**, non sepolto nella riga piccola (audit 6).
4. Lo spazio in più nelle tessere con un solo corso resta bianco: è onesto e non si nota perché le tessere sono dello stesso colore pieno.

Alternative per arrivare davvero a ±20%:

| Opzione | Come | Pro | Contro |
|---|---|---|---|
| **B. Descrizione del corso principale** (12-14 parole, già nei testi della home) sotto i corsi | 13/13 entro ±20% per costruzione | Nessun dato nuovo | Sceglie un «corso principale» per chi ne ha tre e fa sembrare la frase di uno slogan di corso detta dall'istruttore. **Non consigliata.** |
| **C. Una frase in prima persona di 10-14 parole** scritta da ogni istruttore | 13/13 entro ±20% se rispettano la misura | Dà volto e voce, è quello che i genitori cercano | Servono 13 testi e 13 sì; dipende dalla segreteria (domanda I7) |

Consiglio: **A adesso, C quando i testi arrivano** (la tessera ha già lo spazio per due righe).

## 2. Scheda singola: tre blocchi e quattro dati

**Quattro tessere dati** (Ruolo, Corsi, Quando, Titoli): 9 / 9 / 10 / 10 parole. Già bilanciate, riscritto solo «Lun, mer e ven» in «Lunedì, mercoledì e venerdì».

**Tre blocchi di testo**: 36 / 32 / 25 parole, media 31: intervallo ±20% = 24,8–37,2 → **tutti dentro**. Nessuna parola aggiunta o tolta rispetto al canvas; ho cambiato solo un titolo:

| Titolo nel canvas | Cosa contiene il testo | Titolo proposto |
|---|---|---|
| Chi è | professione e collaborazioni con le scuole | Chi è (invariato) |
| Come ha iniziato | presidenza dal 1989, diploma ISEF 1997, lauree | Come ha iniziato (invariato; vedi I2) |
| ~~Come insegna~~ | progetti di educazione motoria nelle scuole | **A scuola** — il testo non dice come insegna, dice dove (domanda I3) |

**«Il percorso»**: tre elenchi di 7, 5 e 6 voci. Sono elenchi di fatti, non si accorciano: le colonne hanno altezza uguale e quella con meno voci resta più vuota (come nel canvas).

**Per gli altri dodici istruttori** la regola, confermata dall'utente, è **la tessera senza dato non si mostra** e la scheda di default è quella scarna: nessun «da scrivere» a vista nel sito vero. Con solo nome e corsi la scheda è quella disegnata in `IstruttoreMinima` (esempio Fabio Berta: iniziale grande, nome, una tessera «Corsi», invito a provare). Niente promesse vuote.

## 3. Domande (cartellini «DA CONFERMARE» sul canvas)

**Chiuse dall'utente:** I1 (sono tredici: cartellino tolto), D9 (due pulsanti: «Prova una settimana a 5 €» → modulo online, «Scrivici» → Contatti), scheda singola sì in forma scarna come default (i nomi diventano link solo se la scheda è scritta), liberatorie delle foto, piede con «vicino alla metro Fermi» (senza minuti) e telefono e social come in Contatti. **Ancora aperte:** le righe senza «chiusa».

| # | Domanda | Chi risponde | Dove si vede |
|---|---|---|---|
| I1 — *chiusa: sì, 13* | Sono davvero **tredici**? (Home D3.) L'elenco viene dal database a oggi; se cambia, cambiano pagina, Chi siamo e Home. | segreteria | elenco, sotto la descrizione |
| I2 | **«Maestro di Judo V Dan»** e «Maestro di Judo IV livello FIJLKAM (2017), V Dan»: livello e Dan sono due scale diverse. Qual è la formula giusta? | Maurizio | scheda, sotto il nome e in «Titoli» |
| I3 | Il titolo **«A scuola»** (era «Come insegna»): va bene? Se Maurizio vuole davvero un «Come insegna», il testo lo scrive lui. | Maurizio | scheda, terzo blocco |
| I4 | **«Quando»** (lunedì, mercoledì, venerdì; martedì e giovedì con gli agonisti): deve venire dal calendario dell'app, non da un testo scritto a mano. | segreteria | scheda, tessera dati |
| I5 | **«Fuori dal tatami»** (nuoto, montagna, servizio militare): dato personale. Lo vuole pubblicare? | Maurizio | scheda, fondo del percorso |
| I6 | **La frase in prima persona** (segnaposto nel canvas). La scrive lui. | Maurizio | scheda, sotto il nome |
| I7 | **Gli altri dodici**: ruolo, titoli, frase, foto e consenso a pubblicarli. Chi li raccoglie e quando? | segreteria | schede, tessere |
| I8 | **Nomi dei corsi** nell'elenco: nel database Tiziano ha «Body functional, pesistica, prepugilistica» e Manuel «pesi, Mobility»; il sito ha «Pre pugilistica», «Sollevamento pesi», «Preparazione atletica». Quali nomi si mostrano? Stessa domanda per «MGA» (sigla) contro «Metodo Globale di Autodifesa». | segreteria | pastiglie |
| I9 | **Ordine**: alfabetico per cognome ma Innella per primo. Scelta voluta? | segreteria | elenco |
| I10 | **Anni**: «dal 1989» (presidente) e «35+ anni di sport» (Home D1) vanno d'accordo (37 anni nel 2026) solo se «35+» è corretto; da allineare alla risposta a D1. | segreteria | scheda e Home |
| I11 | **Menu**: oggi «Istruttori» ha una voce propria; il canvas la mette sotto «Chi siamo». Quale? | utente | testata |
| I12 — *chiusa per le foto proposte (liberatorie dichiarate)* | **Nome e cognome pubblici** per tutti e tredici (oggi sono già sull'elenco). Le liberatorie delle foto proposte sono dichiarate dall'utente: nessun cartellino sulle foto. Per gli istruttori senza foto restano da avere quando arrivano. | segreteria | elenco (non più un cartellino) |

## 4. Cosa è marcato nel canvas

Cartellini rossi tratteggiati (come nella home): I2/I4/I5/I6 dove il dato di Maurizio compare, I3 sul titolo del blocco. Il resto dei dati di Maurizio ha il cartellino «dato del canvas, da riconfermare».
