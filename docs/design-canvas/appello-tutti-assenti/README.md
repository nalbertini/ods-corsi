# Appello sul telefono: rimediare a «tutti assenti»

Proposta, non costruita. Judo 3, 16 iscritti, telefono 390×760. Dopo la PR #873 sul
telefono TUTTI PRESENTI non c'è più: chi chiude l'appello senza segnare nessuno
(due tocchi su CHIUDI) li trova tutti assenti, e per rimediare tocca ogni nome o
fa AZZERA dal menu ⋯.

| Tavola | Cosa |
|---|---|
| `Main.dc.html` | Oggi: appello riaperto, tutti assenti, nessun rimedio veloce |
| `PropostaA.dc.html` | A: solo con tutti assenti, la striscia `RimediaAssenti` sotto la testa, col tasto TUTTI PRESENTI a un tocco |
| `PropostaB.dc.html` | B: solo con tutti assenti, TUTTI PRESENTI nella riga del conto (`TestaAppelloCorta rimedia`) |
| `PropostaC.dc.html` | C: prevenire; al secondo tocco di CHIUDI con nessuno segnato, TUTTI PRESENTI al posto di + PROVA (`BarraChiudiAppello rimedia`) |

I componenti vengono da `../ods-design-system/`; `RimediaAssenti` e le props
`rimedia` sono segnate PROPOSTA in libreria.
