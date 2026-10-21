# Manca la firma · proposta

Una lezione tenuta in due: se il secondo istruttore dimentica il PIN non ha la
presenza, non è pagato e COMPENSI non lo mostra. «+ Nome c'era» in PRESENZE
ISTRUTTORI vale solo per due settimane.

| Tavola | Cosa mostra |
|---|---|
| `CompensiOggi` | COMPENSI com'è (PR #556 e #557): Maura Neri non c'è |
| `CompensiProposta` | Il segno giallo MANCA LA FIRMA accanto allo stato (non blocca), a riga aperta le lezioni senza firma con C'ERA e «Non c'era», la riga di chi ha solo quelle, il filtro «Manca la firma» |
| `CompensiPropostaTelefono` | La stessa sul telefono: le lezioni senza firma sempre aperte |

Libreria: `RigaCompenso` ha le prop `attese` e lo stato `solo-attese`.
