# Compensi · revisione del design

Oggi COMPENSI mette tutti i tecnici in ordine di nome: i fermi, quelli da fare
e quelli che aspettano una firma sono mescolati, ogni riga ripete il motivo in
segno, frase e link, e sopra ci sono quattro riquadri e sei filtri.

| Tavola | Cosa mostra |
|---|---|
| `CompensiOggi` | COMPENSI com'è (settembre, dallo screenshot) |
| `CompensiProposta` | I gruppi nell'ordine del lavoro: DA SISTEMARE PRIMA, DA FARE (con l'unico tasto giallo), DA FAR FIRMARE, DA PAGARE (col totale), ASPETTANO UNA FIRMA (le lezioni in due, con C’ERA / Non c’era), PAGATE chiuse; un riepilogo in una riga; due filtri, «Manca la firma» ed «Extra» |
| `CompensiPropostaTelefono` | Gli stessi gruppi sul telefono |

Libreria (PROPOSTA): `GruppoCompensi`, `RigaCompensoCorta`, `RigaSenzaFirma`.
