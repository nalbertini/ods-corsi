# Appello istruttore · proposta

La pagina dove l'istruttore segna le presenze (`src/components/AppelloScreen.tsx`), rivista per il telefono con tanti nomi. Proposta in discussione: i componenti nuovi stanno in libreria marcati PROPOSTA.

| Tavola | Cosa mostra |
|---|---|
| 1 · Oggi | La pagina com'è costruita: testa da 224px, ATTIVITÀ, ChiSei, ISCRITTI, ricerca con etichetta, CHIUDI in fondo all'elenco |
| 2 · Inizio | Nessuno segnato: testa da 140px, ricerca compatta, frase d'aiuto solo le prime volte, barra CHIUDI ferma in fondo |
| 3 · A metà | Righe `marcato`, l'attività solo nel menu ⋯, coda «NON ANCORA INVIATE» |
| 4 · Tutti segnati | Il giallo passa da TUTTI PRESENTI a CHIUDI L'APPELLO |
| 5 · Lezione passata | Non segnati in cima, CHIUDI chiede il secondo tocco, mai rosso |
| 6 · Sola lettura | Senza tasto giallo, menu e barra CHIUDI, testa alta uguale |
| 7 · Menu ⋯ | Cambio di attività e AZZERA L'APPELLO, fuori dalla testa |

**Libreria.** Nuovi: `TestaAppelloCorta`, `BarraChiudiAppello`, `CercaAppello`, `FoglioAppello`. Cambiato: `RigaAppello` con la prop `marcato`.

**Token.** Nessun colore nuovo: solo la palette di `src/styles.css`.
