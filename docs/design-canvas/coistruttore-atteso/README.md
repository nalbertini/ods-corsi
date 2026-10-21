# Manca la firma · proposta

Una lezione tenuta in due: se il secondo istruttore dimentica il PIN non ha la
presenza, non è pagato e COMPENSI non lo mostra. «+ Nome c'era» in PRESENZE
ISTRUTTORI vale solo per due settimane.

| Tavola | Cosa mostra |
|---|---|
| `CompensiOggi` | COMPENSI com'è (PR #556 e #557): Maura Neri non c'è |
| `CompensiProposta` | Il segno giallo MANCA LA FIRMA accanto allo stato (non blocca), a riga aperta le lezioni senza firma con C'ERA e «Non c'era», la riga di chi ha solo quelle, il filtro «Manca la firma» |
| `CorsoBastaUno` | Nella scheda del corso, con più istruttori, la spunta «Si alternano: a lezione basta uno»: se uno ha firmato, agli altri non si chiede |
| `CompensiPropostaTelefono` | La stessa sul telefono: le lezioni senza firma sempre aperte |

Decisioni dell'utente: non blocca la ricevuta; C'ERA e «Non c'era» da COMPENSI senza il limite dei 14 giorni; un mese già pagato si annulla e si rifà; i corsi alternati si segnano nel corso.

Libreria: `RigaCompenso` ha le prop `attese` e lo stato `solo-attese`.

COSTRUITA (ramo `coistruttore-atteso`): l'elenco è un dettaglio chiuso come «Per corso», aperto da sé per chi ha solo lezioni senza firma e col filtro; «Non c'era» è un `sg-link`; il giorno è «mer 7/10 · 17:00»; una lezione dove ha firmato solo chi non era previsto non conta (è una sostituzione). Quello che vale è `RigaCompenso` in libreria e DESIGN.md.
