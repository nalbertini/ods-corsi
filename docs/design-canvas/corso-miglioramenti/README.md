# Pagina del corso: canvas di approvazione

Proposta da approvare prima di toccare il sito. Parte dai quattro report di
`docs/proposte-home/corso/` (audit, foto, testi). Niente è stato cambiato in
`src/`, `supabase/`, sul sito vero o sul database.

## Cosa c'è

| Tavola | Cosa è |
|---|---|
| `CorsoJudoAttuale` (1440) e `CorsoJudoAttualeTelefono` (375) | La pagina Judo com'è oggi: schermate intere del sito vero del 18 ottobre 2026 (da `proposte-home/corso/audit`), solo per confronto |
| `CorsoJudo` (1440) e `CorsoJudoTelefono` (375) | La proposta per Judo, il corso con tre foto |
| `CorsoPrePugilisticaAttuale`, `…AttualeTelefono` | Pre pugilistica com'è oggi (con la foto di judo prestata dagli istruttori) |
| `CorsoPrePugilistica` (1440) e `CorsoPrePugilisticaTelefono` (375) | La proposta per un corso **senza foto**: la fascia blu con giorno, ora ed età prende il posto della foto di apertura |

Si compongono con i componenti della libreria `../ods-design-system/`: `SitoTestata`, `SitoTitolo`, `SitoDatoPersona` (i quattro dati), `SitoBloccoPersona` («Cosa si fa», «A chi è rivolto», «La storia del judo»), `SitoPerche` («Cosa aspettarsi»), `SitoPiede`; nuovi: `SitoCorsoTitolo` (testata con nome, descrizione e pulsante), `SitoOrarioGruppo` (una tessera dell'orario), `SitoCorsoFascia` (apertura senza foto), `SitoCorsoCta` (chiusura: copia di `SitoCta` con `alt` e `senzaFoto`, tenuta a parte perché `SitoCta` è condivisa con le altre pagine proposte). `verifica.mjs`: «tutto in regola».

Anteprime statiche e autonome (`node docs/design-canvas/corso-miglioramenti/rendi.mjs`): `anteprima-judo-1440.html`, `anteprima-judo-375.html`, `anteprima-prepug-1440.html`, `anteprima-prepug-375.html`; screenshot in `shot/`. Foto in `img/`: `judo-A/B/C.jpg` (690, 164, 26 da `proposte-home/alternative/judo`); le altre foto proposte sono in `proposte-home/corso/foto/approvate/`.

**Segnaposto:** dove il report dei testi ha un `[DA CONFERMARE]` la tavola ha il cartellino rosso «DA CONFERMARE Qn» (Q come in `proposte-home/corso/testi/REPORT.md`).

## Cosa cambia, blocco per blocco (prima → dopo → perché)

| Blocco | Prima | Dopo | Perché |
|---|---|---|---|
| **Testata** | Titolo da 200 px (175 px su 2 righe), descrizione a destra, nessun invito fino alla chiusura | Titolo da 160 px, descrizione di 12-14 parole, pulsante giallo «Prova una settimana a 5 €» | Audit C3, C5; testi §1 |
| **Foto di apertura** | Verticale tagliata a 1344×619 e ingrandita del 15 % (Judo, Lotta); foto prestata da un'altra disciplina (Pre pugilistica, Autodifesa) | Foto orizzontale di 1800 px nel riquadro 1344×619 (240 px sul telefono, fuoco per riquadro); senza foto, la fascia blu con giorno, ora ed età | Audit C1, C2; foto/REPORT |
| **Dati** | Quattro tessere con titolo da 52 px e il testo in fondo | Quattro tessere con etichetta piccola e valore (`SitoDatoPersona`), alte quanto serve | Audit C4 |
| **Orario** | A 5 schermate dai dati, ultima riga con la tessera sola e metà vuota | Subito dopo i dati; tessere uguali, le due dell'ultima riga larghe 3 colonne su 6 (nessun buco) | Audit C6, C7 |
| **Cosa si fa / A chi è rivolto** | Tre tessere («Cos'è», «Cosa si fa», «Per chi è pensato») con 9-39 parole | Due tessere (20-40 e 7-23 parole), la foto B accanto a «Cosa si fa» | Testi: lunghezze equilibrate |
| **Cosa aspettarsi** | H2 di 2 righe a 120 px, titoli fino a 10 parole | Titolo «Cosa aspettarsi» a 80 px, tessere numerate con titolo ≤ 5 parole, testo invariato | Audit C5; testi |
| **Chiusura** | «PROVA» a 200 px, senza verbo né prezzo, metà vuota | «Una settimana per scegliere.», frase del corso, come provare, pulsante «Prova una settimana a 5 €» (modulo online) e «Scrivici» (Contatti), foto C a destra | Audit C3; testi, «Come provare» |
| **Testata sul telefono** | Logo, «Contattaci», «Prova» e 4 voci su due righe (190 px) | Logo + «Menu» (48 px); il pulsante giallo «Prova una settimana a 5 €» sta sotto la descrizione, nella prima schermata (scelta: non resta fisso allo scorrere) | Audit C9 |
| **Storia del judo** (solo Judo) | quattro tessere | invariate, sotto «Cosa si fa» e l'orario | testo da far rileggere (Q12) |
| **Ritmo** | spazi tra sezioni irregolari | un solo passo: 96 px a desktop, 64 px sul telefono | stessa regola della home |

Misure (Judo): desktop 5655 px → **4621** (−18 %); telefono 6237 px → **6739** (+8 %): sul telefono le tessere una sotto l'altra pesano; vedi la domanda 3.

## Domande aperte

Le Q1…Q14 (Q1, Q2, Q13 chiuse) stanno in `proposte-home/corso/testi/REPORT.md` (dove porta il pulsante, quota, certificato, istruttori, età in contraddizione, foto). Nate dal disegno (numerate 1-8, diverse dalle Q):

1. **Foto mancanti (deciso).** Pre pugilistica e Autodifesa restano senza foto per ora: la tavola con la fascia blu è la versione da usare. Con la fascia la pagina perde la sezione «Orario» (un gruppo solo, già nella fascia) e le tessere «Quando» e «Per chi».
2. **Liberatorie (chiuso).** L'utente le ha per tutte le foto proposte: nessun cartellino sulle foto.
3. **Lunghezza sul telefono.** 6739 px per Judo (la storia del judo e le quattro tessere «Cosa aspettarsi» sono 2100 px). Alternativa: «Cosa aspettarsi» e «La storia del judo» in due colonne a 375 px o in carosello con pallini da 48 px.
4. **Foto sempre 3?** Il template funziona con 1, 2 o 3 foto: senza la B la tessera «Cosa si fa» va a tutta larghezza; senza la C la chiusura è a una colonna (`senzaFoto`).
5. **Pulsanti (deciso, D9).** «Prova una settimana a 5 €» → modulo online (app.officinedellosport.it/iscrizioni); «Scrivici» → pagina Contatti.
6. **Foto prestate.** Le vecchie foto (`814a717b`, `1a03b6b2` e le altre) escono dalle pagine corso: cancellarle dal bucket o lasciarle?
7. **Foto in pagina.** Il canvas mostra solo i riquadri: nel sito vero le foto vanno con `width`/`height`, `srcset` 720/1440/1800, `loading=lazy` sotto la piega e `fetchpriority=high` sulla testata (audit C12; `foto/REPORT.md` nota 5).
8. **Judo B.** Se la foto 164 non va, la tessera «Cosa si fa» va a tutta larghezza.
