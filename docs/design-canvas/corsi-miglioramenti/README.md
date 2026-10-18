# I corsi (elenco): canvas di approvazione

Proposta da approvare prima di toccare il sito. Parte dai report di `docs/proposte-home/corsi/` (audit, foto, testi) e dal modello `../home-miglioramenti/`. Niente è stato cambiato in `src/`, `supabase/`, sul sito vero o sul database.

| Tavola | Cosa è |
|---|---|
| `CorsiAttuale` (1440) e `CorsiAttualeTelefono` (375) | La pagina com'è oggi: schermate intere del sito vero del 18 ottobre 2026 (`proposte-home/corsi/audit`), solo per confronto |
| `CorsiProposta` (1440) | La proposta, con i componenti `Sito*` della libreria `../ods-design-system/` |
| `CorsiPropostaTelefono` (375) | La stessa proposta sul telefono |

`verifica.mjs`: «tutto in regola». Anteprime statiche: `node docs/design-canvas/corsi-miglioramenti/rendi.mjs` → `anteprima-1440.html`, `anteprima-375.html`; screenshot in `shot/` (`f1440-N`, `f375-N`, pagina intera `p1440-full`, `p375-full`).
`foto.json` non è usato dal canvas: elenca foto e fuochi della proposta (vedi `foto/REPORT.md`).

## Cosa cambia (prima → dopo → perché)

| Cosa | Prima | Dopo | Perché |
|---|---|---|---|
| Titolo | 200 px su 2 righe, corsi che iniziano a y = 727 | 120 px su una riga (56 px sul telefono), corsi a y ≈ 430 | Audit 5 |
| Apertura | Due frasi che ripetono «bambini, ragazzi e adulti» (18 + 24 parole) | Una sola frase di 18 parole | Audit 6, testi §1 |
| Schede | Righe alte 384 e 452 px, foto 170 px che toccano il titolo, 5 schede senza foto come blocchi vuoti | Nove schede uguali: foto o fascia con iniziale da 240 px, titolo 24 px sotto, freccia da 48 px | Audit 1-3 |
| Testi | Da 3 a 19 parole | 12-14 parole, le stesse della home | Testi §2 |
| Foto | Judo 12e605fc, Lotta 9b15677c, Aikido fbfe492b… | Judo 161, Lotta 446, Aikido 989 (come home), Pesi 0066, Avviamento 0511; Pre pugilistica e Autodifesa senza foto | Foto/REPORT |
| Chiusura | Due foto (le stesse della home), una nascosta sul telefono; «PROVA» da 170 px che tocca la frase | Nessuna foto sua; chiamata finale a due colonne come la home | Audit 4, 9 |

Segnaposto: riquadro rosso tratteggiato = `[DA CONFERMARE]` o «DA DECIDERE» con numero della domanda (`proposte-home/corsi/testi/REPORT.md`).

## Decisioni dell'utente applicate (18 ottobre 2026)

- **Filtro per fascia: no per ora.** Tolto dalle tavole e dalla libreria (`SitoFiltro` cancellato); resta l'elenco di 9 schede.
- **9 attività** (D2 della home), nessun cartellino. **D9** (home): i pulsanti della chiamata finale sono due: «Prova una settimana a 5 €» → modulo online (`app.officinedellosport.it/iscrizioni`), «Scrivici» → pagina Contatti (nel canvas il collegamento non si vede: è da fare nel sito).
- **Liberatorie**: l'utente le ha per tutte le foto proposte; tolti i cartellini «liberatoria / minori». Nessun cognome leggibile sul dorso.
- **Pre pugilistica e Autodifesa senza foto** per ora (fascia con iniziale), nessuna foto di altri corsi. **Avviamento 0511**: resta da decidere (cartellino).
- **D12**: prova a 5 € per tutte le età (dai 3 anni), solo la settimana, nessuna lezione singola. «Vicino alla metro Fermi» confermata, senza minuti (C4 chiusa, C6 chiusa, C5 chiusa).

## Domande ancora aperte

1. **C1** età di Pre pugilistica e Autodifesa («Dai 18/15 anni» o «dal 2015 in poi»).
2. **C2** «Anziani» per Aikido e Preparazione atletica.
3. **C3** fascia «Bambini» per Sollevamento pesi (dagli 11 anni).
4. **Avviamento**: 0511 o foto online `6e742106`.
5. **Sollevamento pesi 0066**: marchi BLOR/FitRack sui dischi; manca una foto con ragazzi 11+.
6. **Telefono**: 5000 px contro 4945 di oggi.

## Revisione di design-reviewer-ods

Due giri. Primo: pagina «approvato con riserve», filtro «da rifare» (poi tolto per decisione dell'utente). Secondo, dopo le decisioni: BLOCCA = screenshot vecchi → rifatti con `rendi.mjs`; DA FARE = lettera della fascia tagliata sul telefono (80 px invece di 100 px, in `SitoSchedaCorso`), report con frasi superate → allineati.
Restano aperti: 768 px non guardato nel canvas (il sito non ha tema scuro); fuoco Sollevamento pesi 50% 45% (a 442×240 la x non cambia nulla); formato età «5-6 anni» contro «Da 3 a 5 anni» (di oggi).
