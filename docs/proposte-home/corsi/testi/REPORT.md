# I corsi (elenco): testi rivisti

Fonte: https://www.officinedellosport.it/corsi/ (letta il 18 ottobre 2026) e `docs/sito/corsi.md`.
Solo proposta: niente scritto su database o sito. Parole contate con uno script (spazi), ± 1.
Dove manca un dato c'è **[DA CONFERMARE]**, con la domanda in fondo (numero `C…`).

Regole: come in `docs/proposte-home/testi/REPORT.md`. Italiano parlato, frasi brevi, nessun fatto, numero o attribuzione nuovi. **Le descrizioni delle schede sono le stesse proposte per la home** (stesse parole per lo stesso corso in due pagine, e una sola fonte da aggiornare). Bersaglio: 12 parole ± 20 % = 10-14.

## 1. Apertura della pagina

Oggi ci sono due frasi che dicono lo stesso (18 e 24 parole, entrambe «bambini, ragazzi e adulti»).

| Dove | Testo attuale | Testo proposto | Perché |
|---|---|---|---|
| Titolo `h1` | I nostri corsi | invariato | È chiaro e corrisponde al menu. |
| Frase a destra del titolo (18) | Judo, lotta, aikido, pre pugilistica, autodifesa, preparazione atletica, pesi e psicomotricità per bambini, ragazzi e adulti a Collegno. | **Togliere dalla pagina.** Resta come descrizione per i motori di ricerca (`docs/sito/corsi.md`, «Descrizione»). | Elenca i corsi che si vedono subito sotto, e ripete «bambini, ragazzi e adulti». Non cambia il campo descrizione. |
| Frase grande (24) | Accompagniamo bambini, ragazzi e adulti in percorsi sportivi pensati per ogni età e livello, dove tecnica, benessere e relazione vanno nella stessa direzione. | Per bambini, ragazzi e adulti, a ogni età e livello: tecnica, benessere e relazione vanno nella stessa direzione. (18) | Stesso senso, più corta, senza il verbo «accompagniamo» a inizio. Nessun fatto nuovo. |

## 2. Schede (descrizione, età, fasce)

La descrizione di oggi va da **3** (Aikido) a **19** (Avviamento) parole. Età e fasce restano com'è, tranne dove segnalato.

| Corso | Attuale (parole) | Proposto (parole) | Perché |
|---|---|---|---|
| Judo | Tecnica, disciplina e rispetto per crescere sul tatami (9) | Tecnica, disciplina e rispetto per crescere sul tatami, dai primi passi fino alle gare. (14) | «Gare»: tag Agonisti già presente. |
| Lotta | Gioco, movimento e rispetto per crescere insieme (8) | Gioco, movimento e rispetto per crescere insieme, dalla prima prova alla gara. (12) | Stessa struttura del Judo. |
| Aikido | Armonia, equilibrio, difesa (3) | Armonia, equilibrio e difesa, in una disciplina adatta anche a chi ha più anni. (14) | Rende il tag Anziani **[DA CONFERMARE C2]**. |
| Pre pugilistica | Il primo passo nella boxe: tecnica, disciplina e coordinazione, per muovere i primi colpi in sicurezza (15) | Primi passi nella boxe: tecnica e coordinazione, per imparare i colpi in sicurezza. (13) | Più corta, stessi contenuti. |
| Metodo Globale di Autodifesa | Un sistema di autodifesa pratico e realistico, basato su situazioni reali (11) | Autodifesa pratica e realistica, basata su situazioni reali, spiegata passo dopo passo. (12) | «Passo dopo passo» è nelle FAQ. |
| Preparazione atletica | Allenamenti mirati per migliorare forza, resistenza, velocità e coordinazione (9) | Allenamenti mirati per migliorare forza, resistenza, velocità e coordinazione, anche per chi gareggia. (13) | Tag Agonisti presente. |
| Giocomotricità e psicomotricità | Percorsi motori per crescere giocando, migliorando coordinazione e fiducia (10) | Percorsi motori per crescere giocando e migliorare coordinazione e fiducia in sé. (12) | Più fluida. |
| Avviamento alle arti marziali | Un percorso di scoperta tra le diverse discipline, per aiutare i più piccoli a trovare la propria strada (19) | Si scoprono le discipline, per aiutare i più piccoli a trovare la propria strada. (14) | Era la più lunga. |
| Sollevamento pesi | Percorso dedicato all'apprendimento e al perfezionamento del sollevamento pesi (9) | Un percorso per imparare e perfezionare il sollevamento pesi, dai ragazzi agli adulti. (13) | «Dedicato all'apprendimento» è burocratico. |

Risultato: tutte tra **12 e 14** parole (prima 3-19). Età: invariate, formato di oggi («5-6 anni», «Da 3 a 5 anni»); uniformarle («Da 5 a 6 anni») è una scelta da fare, non fatta (il reviewer nota che «da 5 a 6» si legge come due soli anni).

Età e fasce da **controllare prima di pubblicare** (non cambiate nel mockup, tutte [DA CONFERMARE]):

| Corso | Oggi in scheda | Problema |
|---|---|---|
| Pre pugilistica | Dai 18 anni · Adulti | La pagina del corso dice «dal 2015 in poi» **[C1]** |
| Autodifesa | Dai 15 anni · Adulti | Idem (2015) **[C1]** |
| Aikido | Dai 7 anni agli adulti · Bambini, Adulti, Anziani | «Anziani» non è scritto nella pagina **[C2]** |
| Preparazione atletica | Dai 14 anni · Adulti, Anziani, Agonisti | «Anziani» non è scritto nella pagina **[C2]** |
| Sollevamento pesi | Dagli 11 anni · Bambini, Adulti, Agonisti | «Bambini» con «dagli 11 anni»: va bene? **[C3]** |

## 3. Chiamata finale

Come in `docs/proposte-home/testi/REPORT.md` §8, per avere un solo messaggio in tutto il sito.

| Dove | Attuale | Proposto | Perché |
|---|---|---|---|
| Titolo | (non c'è) | **Una settimana per scegliere.** | Dice il beneficio. |
| Testo | Vieni a provare: ti aspettiamo in Via Sassi 26, Collegno. Una settimana a 5 euro: provi tutte le discipline e scegli. (21) | 5 € e provi tutte le discipline. Ti aspettiamo in Via Sassi 26, Collegno, vicino alla metro Fermi. (18) | Prezzo in apertura. «Vicino alla metro Fermi»: **confermato dall'utente**, senza minuti. |
| Bottone | Prova | **Prova una settimana a 5 €** | Dice cosa succede. Dove porta: «Prova una settimana a 5 €» → modulo online (`app.officinedellosport.it/iscrizioni`); secondo bottone «Scrivici» → pagina Contatti (**deciso**). |

## 4. Filtro e ordine

**Deciso: niente filtro per ora.** Resta l'elenco di nove schede, con le fasce dentro ogni scheda.

## 5. Testi alternativi (alt)

Le foto cambiano (vedi `foto/REPORT.md`): gli alt devono descrivere la foto scelta, non il corso. Sono nel mockup; da rifare se si cambia foto. La chiusura ha una sola foto, quella degli istruttori nella chiamata finale (la stessa della home): «Gli istruttori e le istruttrici con la cintura nera in posa sul tatami».

## Domande

Chiuse dall'utente (18 ottobre 2026): **C4** metro Fermi confermata; **C5** le attività sono 9; **C6** la prova a 5 € vale per tutte le età (dai 3 anni), solo la settimana, nessuna lezione singola.
Ancora aperte:

1. **C1.** Pre pugilistica e Autodifesa: «Dai 18 / Dai 15 anni» in scheda o «dal 2015 in poi» nella pagina? Qual è l'età vera?
2. **C2.** «Anziani» per Aikido e Preparazione atletica: confermato? (C'è un limite d'età?)
3. **C3.** Sollevamento pesi: fascia «Bambini» con «dagli 11 anni»: va bene?
