# Contatti del sito: canvas di approvazione

Proposta da approvare prima di toccare il sito. Parte dai report di
`docs/proposte-home/contatti/` (audit, foto, testi). Niente è stato cambiato in
`src/`, `supabase/`, sul sito vero o sul database.

## Cosa c'è

| Tavola | Cosa è |
|---|---|
| `ContattiAttuale` (1440) e `ContattiAttualeTelefono` (375) | La pagina com'è oggi: schermate intere del sito vero del 18 ottobre 2026 (da `proposte-home/contatti/audit`), solo per confronto |
| `ContattiProposta` (1440) | La proposta, disegnata con i componenti `Sito*` della libreria |
| `ContattiPropostaTelefono` (375) | La stessa proposta sul telefono |

Componenti nuovi in `../ods-design-system/`: `SitoRecapito`, `SitoMappa`, `SitoArrivo`
(righe nel README della libreria). Gli altri (`SitoTestata`, `SitoPulsante`, `SitoTitolo`,
`SitoPerche`, `SitoDomanda`, `SitoPiede`) sono quelli della home. `verifica.mjs`: «tutto in regola».

**Segnaposto:** dove il report ha un `[DA CONFERMARE]` la tavola ha il contorno rosso
tratteggiato e il cartellino con la sigla (C1-C6 sono nuove di questa pagina, D9 e D10 sono quelle della home).

## Decisioni dell'utente applicate (18 ottobre 2026)

- **Orari (C1):** nessuna riga «Quando trovarci» finché non ci sono gli orari.
- **WhatsApp (C2):** il 346 329 2786 risponde su WhatsApp: tessera «Chiama ora →» (il tocco apre la chiamata), pulsante «Scrivici» su WhatsApp.
- **Prova (D9, D10, D12):** due pulsanti, «Prova una settimana a 5 €» → modulo online (`app.officinedellosport.it/iscrizioni`) e «Scrivici» → WhatsApp. La prova vale per tutte le età dai 3 anni, solo la settimana, nessuna lezione singola (FAQ «Posso provare una sola lezione?»).
- **Metro (C4):** «vicino alla metro Fermi» confermato, senza minuti a piedi.
- **Liberatorie:** l'utente le ha per tutte le foto proposte; nessuna foto di ingresso per ora: layout a due foto.

## Prima → dopo

| Sezione | Prima | Dopo | Perché |
|---|---|---|---|
| **Testa** | Titolo da 200 px, frase senza pulsante | Titolo da 140 px, frase coi tre modi, due pulsanti (prova, Scrivici) | Audit 2 |
| **Recapiti** | 4 tessere, solo il testo sottolineato è un link (39 px) | 4 tessere uguali con azione da 48 px: «Chiama ora →», «Scrivici su…», «Ottieni indicazioni →» | Audit 3, 8 |
| **Orari** | Non ci sono | Non si mostra niente finché non ci sono | C1 deciso |
| **Come arrivare** | Una frase ripetuta due volte, sulla mappa | Mappa con segnaposto e targhetta; In metro / In auto / Col navigatore | Audit 4-5 |
| **Prova** | Pulsante in testata e «PROVA» enorme | «Una settimana per scegliere»: online, scrivici o chiamaci, passa in sede | Audit 2, testi §5 |
| **Foto** | Tre foto della home, la terza nascosta sul telefono | Due foto (lezione, sala), larghe, con `width`/`height` | Audit 6, foto/REPORT |
| **FAQ** | 6 domande, due doppie | 5: prova, iscrizione, dove siete, una sola lezione, età e livello | Audit 7, testi §6 |
| **Ritmo** | Spazi da 6 a 190 px | Un solo passo: 96 px (64 sul telefono) | come la home |

## Domande ancora aperte (cartellino rosso sulla tavola)

**C3** la pagina Facebook `ilCentroJudo` è quella giusta · **C5** dove si parcheggia · **C7** «Via Sassi» o «Via Vittorio Sassi» (la mappa dice la seconda). Fuori tavola: **C6** chi scatta la foto dell'ingresso (non c'è, per ora due foto).

## Come si guarda

`canvas.json` elenca le quattro tavole; `rendi.mjs` genera `anteprima-1440.html` e
`anteprima-375.html` (pagine autonome); `shot/` ha gli screenshot a fette (`f1440-N`, `f375-N`).
Le `.dc.html` si aprono col canvas, non nel browser da sole.
