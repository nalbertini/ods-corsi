# Sito · un editor solo

SCARTATA nell'aspetto: l'utente ha scelto l'aspetto di Puck così com'è, non questo disegno col look del sito. Le funzioni
(cosa sta in alto e nel pannello Pagina) sono quelle costruite; com'è adesso lo dice `PannelloPuck` della libreria.

Il nuovo editor delle pagine (`EditorPuck.tsx`) diventa l'unico: toccare una pagina in SITO → Pagine lo
apre sempre. Il vecchio (`EditorPezzi.tsx`, `EditorTesto.tsx` e la colonna destra di `Scrivi` in `Sito.tsx`) sparisce.
La cornice è quella delle tavole di `../sito-pulsanti-domande/`; stato e corso collegato sono `Badge` e `ChipCorso`.

| Tavola | Cosa è |
|---|---|
| 1 · Oggi | Il nuovo editor da provare: solo Chiudi, Com'è sul sito, Salva bozza; pannello Pagina con titolo e descrizione |
| 2 · Proposta | In alto anche lo stato e Pubblica; nel pannello Pagina tutto quello che oggi sta a destra nell'editor di sempre |
| 3 · Legge | Una pagina di legge: solo la parte Testo, indirizzo fisso, niente Nascondi, Cancella, Orario, Dividi |

## Scelte proposte

- **In alto**: ‹ Tutte le pagine (chiede se c'è da salvare), lo stato della pagina, «Collegata a N corsi», «Da salvare»,
  poi Annulla/Rifai, Com'è sul sito (la bozza com'è adesso, prima di pubblicare), Salva bozza, Pubblica.
- **Pannello Pagina** (nessuna parte scelta): titolo per Google e descrizione col conteggio 60/160; indirizzo e Cambia
  indirizzo; Orario dai corsi, che va subito sul sito; Dividi in parti (solo se un testo ha titoli o foto da dividere);
  Nascondi dal sito; Cancella la pagina.
- **Pagine col testo di prima**: si aprono già a parti; diventano a parti solo al primo salvataggio, dopo la conferma.
  Spariscono «Prova il nuovo editor», «Porta ai pezzi» e Anteprima.
- **Pagine di legge**: anche loro qui, ma con la sola parte Testo (domanda D1).
