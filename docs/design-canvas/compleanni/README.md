# Compleanni · proposta

Il compleanno di un iscritto compare come avviso, senza cambiare presenze, ordine o passi.
Sul tablet di sala il nome resta «Giulia F.» (sigla del cognome): il segno non dice mai l'età né il cognome intero.

| Tavola | Cosa mostra |
|---|---|
| `SalaTessereStati` | `TabletTessera` oggi e con `compleanno`: da segnare, presente, IN ATTESA DI RETE |
| `SalaNomiOggi`, `SalaNomiProposta` | La schermata dei nomi (8 tessere), con il segno su due |
| `SalaAreaIstruttore` | `TabletRigaAppello` col PIN: segno sotto il nome, cognome intero, niente età |
| `TelefonoAppelloOggi`, `TelefonoAppelloA`, `TelefonoAppelloB` | Appello sul telefono: A = solo il segno sulla riga, B = anche la riga «1 COMPLEANNO OGGI: Giulia R.» sotto la testa |
| `CalendarioCompleanno` | Opzionale: la torta da 24px sotto l'ora della lezione (`RigaCalendario`) |

Libreria: nuovo `SegnoCompleanno` (forme `etichetta`, `icona`, `riga`); prop `compleanno` su `TabletTessera`, `TabletRigaAppello`, `RigaAppello` (tema sito) e `RigaCalendario` (tema sito).
Token: `giallo` #f4c31b per il fondo, `su-colore` #121212 per testo e torta (come `.sg-bollino`), `text` #0d2a3d, `surface` #ffffff, `line`/`surface-2` #cfe6f4 della tessera.
