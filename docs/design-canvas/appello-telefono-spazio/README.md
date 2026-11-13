# Appello sul telefono: più nomi a schermo

Proposta, non costruita. Judo 3, 16 iscritti, nessuno segnato, telefono 390×760,
senza il nastro DATI DI PROVA (c'è solo in prova e pesa 22px in più).

| Tavola | Cosa | Nomi interi |
|---|---|---|
| `Main.dc.html` | Oggi: testata del marchio, testa dell'appello, ricerca, frase d'aiuto, nomi, CHIUDI con la nota sopra, barra delle pagine | 4 |
| `Proposta.dc.html` | A: ad appello aperto via testata del marchio e barra delle pagine, frase d'aiuto solo alle prime 3 aperture (già così), nota dei non segnati dentro CHIUDI (`BarraChiudiAppello corta`). Righe da 56 | circa 7 |
| `PropostaFitta.dc.html` | B: come A con righe da 48 (`RigaAppello fitta`) | circa 9 |

I componenti vengono da `../ods-design-system/`; `fitta` e `corta` sono props
segnate PROPOSTA in libreria. Le domande aperte sono nella conversazione della
funzione (righe da 48 sì o no, barra delle pagine nell'appello, testa più bassa).
