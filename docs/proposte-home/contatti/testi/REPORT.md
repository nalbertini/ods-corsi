# Testi di Contatti: proposta

> **Decisioni dell'utente (18 ottobre 2026), già nelle tavole:** C1 nessuna riga orari finché non ci sono; C2 il 346 329 2786 risponde su WhatsApp; D9 due pulsanti («Prova una settimana a 5 €» → modulo online, «Scrivici» → WhatsApp); D12 prova per tutte le età dai 3 anni, solo la settimana, nessuna lezione singola; C4 «vicino alla metro Fermi» confermato, senza minuti a piedi; liberatorie ok per tutte le foto; nessuna foto di ingresso (due foto). Restano aperte C3, C5, C6, C7. Le sezioni sotto sono la proposta *prima* di queste decisioni: dove contraddicono, vale questo riquadro e il `README.md` del canvas.

Testi effettivi ora in tavola: hero «Chiamaci, scrivici o passa in sede…» + «Prova una settimana a 5 €» e «Scrivici»; telefono «Chiama o scrivi su WhatsApp →»; metro «La sede è vicino alla metro Fermi, Linea 1.»; prova «Una settimana a 5 €, per tutte le età dai 3 anni: provi tutte le discipline e scegli. Tre modi per cominciare.» con «Prenota online» / «Scrivici o chiamaci» («Al 346 329 2786, anche su WhatsApp…») / «Passa in sede»; FAQ 1 «…una settimana di prova a 5 €, per tutte le età dai 3 anni…», FAQ 2 «Compila il modulo online, chiamaci o scrivici su WhatsApp, oppure passa in sede…», FAQ 3 «…vicino alla metro Fermi (Linea 1)…», FAQ 4 nuova «Posso provare una sola lezione? No: la prova è di una settimana, a 5 €, per tutte le età dai 3 anni…».

Sorgente: `docs/sito/contatti.html` / `.md` e la pagina live del 18 ottobre 2026. Niente è scritto sul sito. Dove un dato manca c'è **[DA CONFERMARE]** con la sigla della domanda (C1-C7 nuove; D9 e D10 sono quelle della home in `proposte-home/testi/REPORT.md`). Parole: ±20 % tra schede della stessa fila.

## 1. Testa

| Elemento | Oggi | Proposta | Perché |
|---|---|---|---|
| H1 | Contattaci | Contattaci | invariato |
| Frase (28 parole) | Siamo qui per accompagnarti nella scelta giusta. Scrivici senza impegno: ti aiutiamo a capire quale percorso è più adatto a te o alla tua famiglia. | Chiamaci, scrivici o passa in sede. Ti aiutiamo a scegliere il corso più adatto a te o alla tua famiglia. (20) | Dice i tre modi, come la FAQ «Come mi iscrivo?» |
| Pulsante | (non c'è; in testata «Prova una settimana · 5 €») | Prova una settimana a 5 € | Stesso testo della home. Dove porta: **D9** |

La `description` della pagina (meta) è la frase di oggi: se cambia la frase, cambia anche lei (conferma di chi cura il sito).

## 2. Recapiti (tutte le tessere con un'azione)

| Tessera | Oggi | Proposta | Note |
|---|---|---|---|
| Telefono | 346 329 2786 (link `tel:`) | **346 329 2786** · «Chiama ora →» | **[C2]** il numero risponde anche su WhatsApp? Se sì, «Scrivici su WhatsApp →» come secondo recapito |
| Instagram | officine.dellosport | **@officine.dellosport** · «Scrivici su Instagram →» | stesso indirizzo |
| Facebook | Officine dello Sport (`ilCentroJudo`) | **Officine dello Sport** · «Scrivici su Facebook →» | **[C3]** la pagina `ilCentroJudo` è quella giusta? L'etichetta e l'indirizzo non coincidono |
| Indirizzo | Via Sassi 26, Collegno + «A pochi metri dalla metropolitana Fermi» | **Via Sassi 26, Collegno** · «Ottieni indicazioni →» | La frase sulla metro passa in «Come arrivare». **[C7]** «Via Sassi» o «Via Vittorio Sassi» (JSON-LD, Google e mappa dicono la seconda)? |

## 3. Orari

Oggi nessuno. Proposta, riga «Quando trovarci»:

> Segreteria: **[C1: giorni e orari]**. Gli orari delle lezioni cambiano da corso a corso: te li diciamo quando ci chiami o passi in sede.

Non invento orari. Se la segreteria li dà, vanno anche nel JSON-LD (`openingHours`). **[C1]** Quando si può passare in sede, e serve un appuntamento?

## 4. Come arrivare

Titolo «Come arrivare», sotto «Via Sassi 26, a Collegno.»

| Riga | Testo proposto | Stato |
|---|---|---|
| In metro | Scendi alla fermata Fermi, Linea 1. A piedi servono **[C4: N minuti]**. | «Fermata Fermi, Linea 1»: fatto pubblico (GTT). Non scrivo «capolinea» (può cambiare se la linea viene prolungata); «a pochi metri» **non è verificato** e non lo ripeto |
| In auto | **[C5: dove si parcheggia]** | dato mancante |
| Col navigatore | Tocca «Ottieni indicazioni»: si apre il percorso fino a Via Sassi 26. | vero: il pulsante apre Google Maps con l'indirizzo (`maps/dir/?api=1&destination=Via+Vittorio+Sassi+26,+10093+Collegno+TO`) |

La frase della home («vicino alla metro Fermi», testo CTA) resta coerente con questa pagina solo se C4 la conferma.

## 5. «Una settimana per scegliere»: il percorso della prova

Coerente con il pulsante della home e con D9. Tre modi, tutti da testi che esistono già (FAQ):

| N. | Titolo | Testo (parole) | Stato |
|---|---|---|---|
| 1 | Prenota online | Compili il modulo di iscrizione online, da telefono o da computer. (11) | **Solo come opzione, da decidere (D9/D10).** Il modulo di ODS Corsi (iscrizione-sito) è acceso dal 2 ottobre 2026 e il pulsante in testata punta già a `app.officinedellosport.it/iscrizioni/`: va confermato che sia il percorso giusto per la prova. Se no: togliere la scheda |
| 2 | Chiamaci | Al 346 329 2786. Ti aiutiamo a scegliere il corso più adatto a te. (13) | da FAQ «Come faccio a iscrivermi» |
| 3 | Passa in sede | In Via Sassi 26, a Collegno. Ti spieghiamo modalità, orari e disponibilità. (12) | da FAQ; **[C1]** quando |

Sopra, la frase: «5 € e provi tutte le discipline. Tre modi per cominciare.» (stessa promessa della CTA della home). **[D9]** vale anche una lezione singola? **[D12]** vale per tutte le fasce, anche 3-5 anni?

Il pulsante «Prova una settimana a 5 €» della testa e della testata porta alla stessa destinazione scelta per D9: oggi punta al modulo online; se invece si decide per la telefonata, il pulsante diventa «Chiama per prenotare».

## 6. FAQ: da 6 a 5

| N. | Domanda | Risposta (parole) | Note |
|---|---|---|---|
| 1 | Posso provare prima di iscrivermi? | Sì: una settimana di prova a 5 €. In quei giorni provi tutte le discipline, conosci l'ambiente e gli istruttori e scegli quella che fa per te, senza impegno. (28) | fonde le due doppie, stessa di home; **D9** |
| 2 | Come mi iscrivo? | Scrivici sui nostri canali social, chiamaci o passa in sede. Ti aiutiamo a scegliere il corso più adatto e ti spieghiamo modalità, orari e disponibilità. (25) | stessa di home; **D10** |
| 3 | Dove siete e come arrivo? | In Via Sassi 26, a Collegno. In metro scendi alla fermata Fermi, Linea 1; col navigatore tocca «Ottieni indicazioni» qui sopra. (23) | nuova; **C4** |
| 4 | Quando posso passare in sede? | Chiamaci al 346 329 2786 o scrivici sui social: ti diciamo quando trovi la segreteria e a che ora è la lezione che ti interessa. (25) | nuova; **C1** |
| 5 | I bambini sono divisi per età e livello? | Sì. I gruppi sono organizzati per fasce d'età e competenze: ogni bambino vive un'esperienza equilibrata, sicura e stimolante, in un gruppo adatto a lui. (24) | stessa di home |

Fuori da questa pagina (stanno già in home): «Che tipo di associazione è…?» e «Va bene anche se non ho mai fatto sport?».
Il JSON-LD `FAQPage` va riallineato alle cinque domande.

## 7. Foto e alt

- Lezione: «Una lezione di judo: gli allievi in fila sul tatami» (invariato).
- Sala: «La sala attrezzata per la preparazione atletica» (invariato).
- Ingresso: alt da scrivere quando la foto c'è («L'ingresso di Officine dello Sport in Via Sassi, a Collegno» come proposta; **C6**).
- Mappa: «Mappa: Officine dello Sport, Via Sassi 26, Collegno» (invariato).

## Domande per chi decide

1. **C1.** Orari della segreteria (giorni, ore) e se serve appuntamento per passare in sede.
2. **C2.** Il 346 329 2786 risponde anche su WhatsApp?
3. **C3.** La pagina Facebook `ilCentroJudo` è quella giusta per «Officine dello Sport»?
4. **C4.** A quanti minuti a piedi è la metro Fermi da Via Sassi 26? («A pochi metri» è vero?)
5. **C5.** Dove si parcheggia?
6. **C6.** Chi scatta la foto dell'ingresso, e quando?
7. **C7.** «Via Sassi 26» o «Via Vittorio Sassi 26» ovunque?
8. **D9, D10, D12** (home): dove porta il pulsante di prova; si cita il modulo online; fasce d'età della settimana a 5 €.
