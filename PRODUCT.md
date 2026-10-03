# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

ODS Corsi è lo strumento interno di **Officine Dello Sport**, palestra di Collegno. Lo usano cinque pubblici, ciascuno dal suo indirizzo:

- **Segreteria** (`segreteria/`), l'utente primo: la reception, dal computer al banco, tra una telefonata e una persona davanti. Tiene in piedi la settimana delle lezioni, corsi, iscritti, certificati medici, pagamenti e ricevute, richieste online, presenze, statistiche, istruttori e impostazioni. Quando le esigenze si scontrano, vince la sua.
- **Istruttori** (`istruttori/`): dal telefono, in piedi, a lezione che parte. Guardano il calendario, fanno l'appello, aggiungono chi viene a provare, scelgono i timer.
- **Tablet di sala** (`sala/`): appeso al muro di ogni sala, guardato da due metri. Chi arriva tocca il suo nome; l'istruttore col PIN apre l'appello completo e segna la sua presenza; parte il timer, suona la musica della sala.
- **Chi vuole iscriversi** (`iscrizioni/`): dal telefono, senza accesso. Compila il modulo, firma col dito, carica la ricevuta.
- **Iscritti** (`iscritti/`): pilota, per ora solo in prova. Leggono le proprie lezioni, presenze, certificato, quota e ricevute, anche per il nucleo familiare.

Nessuno di loro è tecnico né ha ricevuto formazione: istruttori e segreteria sono di ogni età.

## Product Purpose

Sostituire fogli Excel, Google Form e registri cartacei con un'unica app che tiene calendario, presenze, iscrizioni e pagamenti della palestra. Ha successo quando la segreteria trova a colpo d'occhio cosa manca (appelli non fatti, certificati scaduti, pagamenti non in regola, richieste da accogliere), l'appello si fa in pochi secondi e nessun dato deve essere riscritto due volte.

## Positioning

Non è un gestionale per palestre generico: è fatto su misura per le abitudini di ODS. Le sale con la loro musica, il kanji di ogni istruttore come timbro, la «ricevuta semplice» dell'associazione con il suo numero che va avanti da sé, il modulo delle autorizzazioni della palestra firmato col dito, il certificato e il documento che restano su carta in segreteria. I dati restano in casa (nessun servizio esterno vede gli iscritti, font serviti in locale, backup cifrato) e il costo è quasi zero (GitHub Pages + Supabase, nessun abbonamento).

## Operating Context

- Reception con un computer, spesso in una stanza illuminata (per questo esiste il tema chiaro).
- Sale (Tatami, Lotta…) con un tablet al muro per sala; la palestra può avere poco segnale.
- Istruttori col proprio telefono durante la lezione.
- Carta che resta carta: certificato medico e copia del documento in segreteria.
- Import da fogli Excel e dalle risposte del modulo Google storico.
- Timer delle lezioni (app gemella in `timer/`, pubblicata nello stesso sito).

## Capabilities and Constraints

- PWA installabile, con coda delle scritture offline e spia di ciò che non è ancora arrivato al server.
- Supabase (Postgres, RLS, funzioni) come unico backend; ogni area vede solo ciò che il suo ruolo consente. Ruolo doppio segreteria + istruttore possibile.
- Pubblicazione su GitHub Pages: una sola app, una pagina per area con `<base href="../">`.
- Modalità di prova con dati inventati per ogni area.
- **Solo italiano**: nessuna traduzione prevista; la terminologia è quella della palestra (appello, prove, sostituto, ricevuta, quota, nucleo).
- **Iscritti minori**: molti corsi sono per bambini; per un minore si chiedono i dati del genitore e il codice fiscale del genitore deve essere di un adulto. La privacy di questi dati è più stretta.
- Informativa privacy approvata dalla palestra il 2 ottobre 2026 (`informativa.html`); il modulo online con database vero è acceso da allora.
- Aperto: cosa può leggere di sé un iscritto e come accede (l'area iscritti esiste solo in prova).

## Brand Commitments

- Nome: **Officine Dello Sport**, Collegno; l'app si chiama **ODS Corsi**.
- Marchio a cinque ingranaggi; quello in `src/components/Logo.tsx` è un ridisegno SVG provvisorio, da sostituire col file originale.
- Voce: italiano parlato e concreto, frasi brevi, maiuscolo per tasti ed etichette («TUTTI PRESENTI», «SEGNA LA PRESENZA»).

## Evidence on Hand

- Guide d'uso per area in `guida/` (istruttori, sala, segreteria, iscrizioni, iscritti).
- PDF del modulo autorizzazioni della palestra (compilato da `src/lib/firma.ts`) e modello della ricevuta semplice (`src/lib/ricevutaPdf.ts`).
- Listino dei costi gestito dalla segreteria (`supabase/19-listino.sql`).
- Nessuna testimonianza, recensione o dato di uso pubblicabile: non inventarli.

## Product Principles

1. **La segreteria prima.** Ciò che manca o non è in regola si vede subito, in rosso, senza cercarlo.
2. **Si spiega da sé.** Nessuno ha formazione: ogni schermata dice cosa fare con parole della palestra, non dell'informatica.
3. **Il gesto più frequente è il più corto.** «TUTTI PRESENTI» e due assenze invece di venti presenze; un tocco sul nome al tablet.
4. **I dati restano in casa.** Ogni nuova funzione rispetta privacy e minori prima della comodità; niente servizi esterni sui dati degli iscritti.
5. **Calza ODS, non un'altra palestra.** Si modella sulle abitudini vere (carta, sale, ricevuta) invece di imporne di nuove.

## Accessibility & Inclusion

Utenti di ogni età e senza formazione: bersagli grandi (almeno 44px, di più dove si tocca in piedi o da lontano), contrasto alto in entrambi i temi, stati leggibili senza affidarsi solo al colore (segno e testo accanto al colore), fuoco da tastiera visibile.
