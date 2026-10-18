# Istruttori: canvas di approvazione

Proposta da approvare prima di toccare il sito. Parte da `docs/proposte-home/istruttori/` (audit, foto, testi). Niente è stato cambiato in `src/`, `supabase/`, sul sito vero o sul database.

## Cosa c'è

| Tavola | Cosa è |
|---|---|
| `IstruttoriAttuale` (1440) e `IstruttoriAttualeTelefono` (375) | L'elenco com'è oggi: schermate intere di `https://www.officinedellosport.it/istruttori/` del 18 ottobre 2026, solo per confronto |
| `IstruttoriProposta` (1440) | L'elenco proposto |
| `IstruttoriPropostaTelefono` (375) | Lo stesso sul telefono |
| `IstruttoreMinima` (1440) e `IstruttoreMinimaTelefono` (375) | **La scheda di default** (decisione dell'utente): nome, foto se c'è, corsi dal database, due pulsanti, invito. Esempio Fabio Berta. Senza foto: fascia azzurra con l'iniziale. Niente tessere vuote |
| `IstruttoreProposta` (1440) e `IstruttoreTelefono` (375) | **La scheda completa**, per quando i dati arrivano (esempio: Maurizio Innella, con i dati del canvas `sito-approvato/TatamiBlu-Istruttore`) |

La scheda singola **oggi non esiste sul sito** (`/istruttori/<nome>/` dà 404): le tavole 5-7 sono una proposta, non un confronto.

I pezzi nuovi stanno in `../ods-design-system/`: `SitoRitratto`, `SitoDatoPersona`, `SitoBloccoPersona`, `SitoElencoPercorso` (righe nel README della libreria). Il resto è della libreria: `SitoTestata`, `SitoPulsante`, `SitoTitolo`, `SitoPiede`. Valori e colori sono quelli di `sito-approvato/TatamiBlu.dc.html` (A2). `node docs/design-canvas/ods-design-system/verifica.mjs`: «tutto in regola».

`canvas.json` elenca le otto tavole. `rendi.mjs` genera le anteprime statiche `anteprima-elenco-1440.html`, `anteprima-elenco-375.html`, `anteprima-scheda-1440.html`, `anteprima-scheda-375.html`, `anteprima-scheda-minima-1440.html`, `anteprima-scheda-minima-375.html` (pagine autonome, foto da `img/`); `shot/` ha gli screenshot a pagina intera. I `.dc.html` si aprono col canvas.

## Cosa cambia, elemento per elemento (prima → dopo → perché)

| Elemento | Prima | Dopo | Perché |
|---|---|---|---|
| **Titolo** | 200 px su due righe, 560 px di altezza prima delle tessere | 156 px su una riga; tessere da y≈290 | Audit 10 |
| **Ritratto** | Cerchio da 140 px con iniziale o foto, nome in basso | Foto quadrata a tutta larghezza (300 px) o fascia azzurra con iniziale; nome, cognome, pastiglie in alto | Audit 2, 3, 6, 7; testi §1 |
| **Altezza delle tessere** | Uguale, ma il contenuto cambia da 2 a 11 parole e i nomi di una riga non sono allineati | Uguale, e nome e cognome alla stessa quota | Audit 3 |
| **Griglia** | 3 colonne a 1440, la tredicesima sola; a 375 due colonne alte 270 px | 4 colonne a 1440 con la tredicesima = invito a provare; a 375 una colonna, ritratti da 136 px | Audit 4 |
| **Corsi** | Frase «Cognome · Judo, preparazione atletica, pesi» | Pastiglie dei corsi (come nelle schede corso) | Audit 7 |
| **Ruolo di Maurizio** | In prima tessera, sbilancia | Nella scheda | Testi §1 |
| **Bersagli** | Menu 38 px, link del piede 20-30 px | 48 px (come la home proposta) | Audit 8 |
| **Freccia ↗** e link | Mai (nessuna scheda) | I nomi diventano link **solo se la scheda è scritta**: nella tavola hanno la freccia Maurizio (scheda completa) e Fabio (scheda di default), le altre no | Audit 5; decisione dell'utente |
| **Scheda** | Non c'è | 4 dati da 9-10 parole, 3 blocchi da 25-36 parole (entro il 20% della media), «Il percorso» in 3 colonne, altri istruttori dello stesso corso | Testi §2 |
| **Scheda di default** | — | Nome, foto se c'è, corsi, due pulsanti, invito; niente tessere vuote | Testi §2; decisione dell'utente |
| **Pulsanti** | «Prova una settimana · 5 €» e «Contattaci» | «Prova una settimana a 5 €» → modulo online; «Scrivici» → Contatti | Decisione dell'utente (D9) |
| **Piede** | Indirizzo e link | Indirizzo con «vicino alla metro Fermi» (senza minuti), telefono, Instagram, Facebook (`SitoPiedeContatti`) | Decisione dell'utente |
| **Cartellini** | — | Rossi tratteggiati sulle sole domande ancora aperte (I2-I11) | Testi §3 |

## Le foto

4 volti su 13: **Maurizio Innella** (foto 42), **Maura Fornetti** (200), **Fabio Berta** (948, quarto volto) e **Federico Vuillermin** (199). Il nome è quello che l'utente ha già assegnato al volto in LightCraft (letto con `faces.person`, nessun nome assegnato da me); l'`alt` è «Ritratto di Nome Cognome». L'utente ha dichiarato di avere le liberatorie: nessun cartellino sui ritratti usati. Le altre nove tessere hanno la fascia con l'iniziale. Ritratti belli ma senza nome in LightCraft (153, 167, 948-1…3) non sono nel mockup: se la segreteria dice chi sono, si aggiungono; per 948 va anche verificato che siano istruttori ODS. Il ritaglio di Federico (199) è stretto per escludere le altre persone.

## Domande aperte

Numerate come in `../../proposte-home/istruttori/testi/REPORT.md`. **Chiuse dall'utente:** tredici tecnici (I1), pulsanti e destinazioni (D9), scheda di default scarna con link solo a scheda scritta, liberatorie, piede con «vicino alla metro Fermi», telefono e social. **Ancora aperte:** ruolo e titoli di Maurizio (I2, I7), titolo «A scuola» (I3), orari dal calendario (I4), «Fuori dal tatami» (I5), la frase (I6), nomi dei corsi (I8), ordine (I9), anni (I10), menu (I11). Sessione ritratti: opzione futura, non ora.
