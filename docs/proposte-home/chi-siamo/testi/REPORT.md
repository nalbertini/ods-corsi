# Chi siamo: testi rivisti

Fonte: pagina pubblicata https://www.officinedellosport.it/chi-siamo/ (letta il 18 ottobre 2026) e bozza `docs/sito/chi-siamo.html`.
Solo proposta: niente scritto su database o sito. Parole contate a mano (± 1). Dove manca un dato c'è **[DA CONFERMARE]** e la domanda è nella lista in fondo (C6-C10 ancora aperte; D1-D3, D9, D12, C4, C5 chiuse dall'utente il 18 ottobre).

Regole: italiano parlato, frasi brevi (PRODUCT.md, «Voce»); **nessun fatto, numero o attribuzione nuovi**: ogni frase viene da un testo già pubblicato o dalla bozza in repo, e il «perché» dice quale. Si **toglie e si accorcia**, non si aggiunge.

## 1. Testata e frase grande

| Dove | Prima | Dopo | Perché |
|---|---|---|---|
| Frase sotto «Chi siamo» (21 parole) | Le Officine dello Sport di Collegno sono uno spazio dove allenarsi con metodo e passione, mettendosi alla prova ogni giorno. | invariata | È la descrizione già pubblicata (meta description). Corta e concreta. |
| Frase sulla foto (7) | Nasciamo dal judo, mettiamo al centro la persona | invariata | Il testo è già nella bozza; è la frase migliore della pagina. Cambia solo la misura (56 px, 3 righe, vedi audit 2). |

## 2. Le due tessere «oggi» e «iniziato»: stesso peso

Oggi 38 contro 50 parole, titoli da 30 contro 64 px. Obiettivo: 38 e 44 (entro ±20 %), stessa misura di titolo e testo.

| Dove | Prima | Dopo | Perché |
|---|---|---|---|
| Titolo | Chi siamo oggi / Come tutto è iniziato | invariati | |
| Chi siamo oggi (38) | Officine dello Sport è un’Associazione Sportiva dove allenarsi significa crescere insieme. Ogni persona trova il proprio spazio, il proprio ritmo e il proprio percorso, sostenuta da istruttori preparati. Qui lo sport unisce disciplina, rispetto e senso di comunità. | invariato | Già equilibrato; correzione grammaticale della bozza («un’Associazione») mantenuta. |
| Come tutto è iniziato (50 → 44) | Officine dello Sport nasce da un’associazione sportiva di judo, A.s.d. il Centro Judo, dove abbiamo imparato che lo sport è crescita, relazione e rispetto. Oggi portiamo questi valori **in tutte le nostre attività, creando un ambiente in cui** chiunque, a qualsiasi età, può allenarsi e sentirsi parte di una comunità. | …Oggi portiamo questi valori **in ogni attività, in un ambiente dove** chiunque può allenarsi e sentirsi parte di una comunità. | «A qualsiasi età» ripeteva «chiunque»: 6 parole in meno, stesso significato. Nome «A.s.d. il Centro Judo»: **[DA CONFERMARE C6]**. |

«Comunità» compare in tutte e due le tessere (e nei valori): lasciato com'era (è il testo pubblicato); vedi C8.

## 3. Numeri

| Dove | Prima | Dopo | Perché |
|---|---|---|---|
| Tessera 1 | 300+ atleti | **300+** atleti | Confermato dall'utente (C4). |
| Tessera 2 | 13 tecnici sportivi | **13** tecnici | Confermato dall'utente (D3). |
| Tessera 3 | 8 attività | **9** attività | Confermato dall'utente (D2): le attività sono 9, come le schede corso. |
| Tessera 4 | 35+ anni di sport | **35+** anni di sport | Confermato dall'utente (D1): resta «35+», non «dal 19xx». |
| Ordine | atleti, tecnici, attività, anni | invariato | È l'ordine della bozza e della pagina pubblicata. (La home usa un altro ordine: 35+, 8, 300+, 13. Scelta da fare: C9.) |

Le quattro tessere stesse: numero + etichetta di 1-2 parole. «tecnici sportivi» → «tecnici» come in home, per avere la stessa parola ovunque.

## 4. Pannello «Gli istruttori»

| Dove | Prima (parole) | Dopo (parole) | Perché |
|---|---|---|---|
| Titolo | Gli istruttori | Gli istruttori | Titolo da 80 px come gli altri (audit 6). |
| Testo | Tredici tecnici sportivi: chi sono, come sono arrivati al tatami e in quali gruppi li trovi. (16) | Chi sono, come sono arrivati al tatami e in quali gruppi li trovi. (13) | «Tredici» ripeteva la tessera appena sopra e con parole invece di cifre: oggi il numero è scritto due volte e può contraddirsi (D3). Una sola fonte. |
| Pulsante | (assente sul sito pubblicato) / «Conosci gli istruttori» nella bozza | «Conosci gli istruttori» → `/istruttori/` | Il pannello oggi non porta da nessuna parte. **[DA CONFERMARE C10]** se la pagina Istruttori è già pubblicata. |

## 5. Fila di foto (oggi senza titolo né didascalia)

Oggi quattro foto di discipline senza una parola. Proposta: ogni foto ha come didascalia il **nome del corso** (da `docs/sito/foto.md` e dalle schede corso), più un link «Vedi tutti i corsi» → `/corsi/`.

| Foto | Didascalia | Perché |
|---|---|---|
| Lotta | Lotta | Nome del corso. |
| Aikido | Aikido | Nome del corso. |
| Sala attrezzata | Preparazione atletica | Nome del corso. |
| Bambino sui cubi | Giocomotricità e psicomotricità | Nome esatto del corso. |

Titolo di sezione: nessuno (le quattro parole bastano). Se serve un titolo, solo «I nostri corsi» (nome già del menu). **[DA CONFERMARE C7]** se le didascalie devono essere link alle singole pagine corso.

## 6. Missione

| Dove | Prima | Dopo | Perché |
|---|---|---|---|
| Titolo | Alleniamo il corpo. Coltiviamo il carattere. | invariato | Tre parole per frase, ritmo. Cambia solo la misura (80 px). |
| Testo (30) | La nostra missione è accompagnare ogni persona in un percorso di crescita personale e sportiva, offrendo strumenti concreti per affrontare le sfide della vita con forza, determinazione, serenità e coraggio. | invariato | Già corto. |

## 7. «I nostri valori»

| Dove | Prima (parole) | Dopo (parole) | Perché |
|---|---|---|---|
| Introduzione | Crediamo in uno sport che insegna tecnica, ma soprattutto costruisce il carattere: educa al rispetto, alla disciplina e alla costanza, e insegna ad affrontare ogni ostacolo con impegno e responsabilità. (31) | Crediamo in uno sport che insegna tecnica, ma soprattutto costruisce il carattere: educa al rispetto, alla disciplina e alla costanza. (21) | Il pezzo tolto («affrontare ogni ostacolo… responsabilità») dice la stessa cosa della missione («affrontare le sfide della vita»): la pagina lo diceva due volte di fila. |
| Centralità della persona | Mettiamo le persone al centro, prima delle prestazioni (8) | invariato | |
| Rispetto e condivisione | Crescere nel rispetto e nella condivisione (6) | Cresciamo nel rispetto e nella condivisione (6) | Stessa persona verbale delle altre tre («Mettiamo», «Accompagniamo», «Creiamo»). |
| Percorsi che durano nel tempo | Accompagniamo i percorsi nel tempo, senza scorciatoie (7) | invariato | Correzione già presente nella bozza («Accompagniamo»). |
| Senso di comunità | Creare comunità, non solo allenamenti (5) | Creiamo comunità, non solo allenamenti (5) | Come sopra. |

Titoli delle tessere: 4 da 3-5 parole, uno («Percorsi che durano nel tempo») va a capo a 40 px: accettato, tessere alte uguali. Le frasi ripetono quasi il titolo (6 su 8 parole in comune per «Rispetto e condivisione»): non si inventa un'altra frase, ma si chiede un dato concreto, vedi C8.

## 8. Chiamata finale

| Dove | Prima | Dopo | Perché |
|---|---|---|---|
| Parola | PROVA (da 170 px) | **Vieni a provare.** (3 parole) | Verbo vero, ripreso dal testo di oggi («Vieni a provare»). |
| Testo (22) | Vieni a provare: ti aspettiamo in Via Sassi 26, Collegno. Una settimana a 5 euro: provi tutte le discipline e scegli. | Una settimana a 5 €: provi tutte le discipline e scegli. (11) | L'offerta nella riga sotto il titolo; l'indirizzo in riga a parte. |
| Indirizzo | (dentro il testo) | Ti aspettiamo in Via Sassi 26, Collegno. (7) | Stesso indirizzo di oggi. Nel piede «vicino alla metro Fermi» (senza minuti a piedi): confermato dall'utente. |
| Pulsanti | nessuno | «Prova una settimana a 5 €» → modulo online (`app.officinedellosport.it/iscrizioni`) · «Scrivici» → pagina Contatti | Decisione dell'utente (D9): due pulsanti. La prova è di 5 € per tutte le età (dai 3 anni), solo la settimana, nessuna lezione singola (D12). |

## 9. Alt delle foto (testi alternativi)

| Foto | Alt pubblicato | Alt proposto | Perché |
|---|---|---|---|
| Hero (`18c88f1d`) | Un gruppo di atleti in judogi in posa sul tatami | Bambini, ragazzi e istruttori con la maglia blu delle Officine in posa sul tatami giallo | In foto non ci sono judogi. |
| Istruttori (`814a717b`) | Gli istruttori e le istruttrici con la cintura nera in posa sul tatami | invariato | |
| Missione (`205`) | — | Un gruppo di judoka ride mentre solleva un compagno nella palestra | Foto nuova. |
| Lotta (`701a887f`) | Il gruppo di lotta in posa sul materasso, con le tute rosse e blu | Due giovani lottatrici si fronteggiano sul tappeto giallo | È un incontro, non una posa. |
| Aikido (`987`) | Una dimostrazione di aikido tra un maestro e una giovane allieva | Un istruttore di aikido proietta una compagna durante una dimostrazione, in bianco e nero | Foto nuova. |
| Sala (`1a03b6b2`) | La sala attrezzata per la preparazione atletica, con una persona che si allena | invariato | |
| Chiamata finale (`948`) | — | Quattro istruttori di aikido in hakama sorridono in palestra | Foto nuova; che siano tutti istruttori viene da `foto.md` |
| Cubi (`40ae8db3`) | Bambini che giocano tra i cubi colorati nella sala di psicomotricità | Un bambino salta sui materassi colorati nella sala di psicomotricità | In foto c'è un solo bambino (come nell'alt della home). |

## Domande aperte (per la segreteria)

Chiuse dall'utente: D1 (resta «35+»), D2 (9 attività), D3 (13 tecnici), D9 (due pulsanti: modulo online e Contatti), D12 (prova 5 € per tutte le età, solo la settimana), C4 (300+), C5 (liberatorie per tutte le foto proposte; resta la regola: nessun cognome leggibile sul dorso), metro Fermi (confermata).

| # | Domanda | Dove nella proposta |
|---|---|---|
| **C6** | Nome ufficiale: «A.s.d. il Centro Judo» o «A.S.D. Il Centro Judo»? Esiste ancora come nome? | Tessera «Come tutto è iniziato» |
| **C7** | Le didascalie della fila di foto portano alle pagine dei singoli corsi? | Fila di foto |
| **C8** | Per i valori: c'è un dato concreto per ognuno (es. quanti gruppi per età, da quanti anni)? Oggi la frase ripete il titolo | Valori |
| **C9** | Ordine dei numeri: come la home (35+, 8, 300+, 13) o come oggi (300+, 13, 8, 35+)? | Numeri |
| **C10** | La pagina Istruttori è già pubblicata (il pulsante «Conosci gli istruttori» deve portare lì)? | Pannello istruttori |
