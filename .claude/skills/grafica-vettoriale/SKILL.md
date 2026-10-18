---
name: grafica-vettoriale
description: Use when creating, editing or exporting SVG pictograms or vector illustrations for ODS Corsi, or when exporting SVG to transparent PNG at 32/64/128 with VectorCraft.
---

# Illustrazione vettoriale (SVG + VectorCraft)

Verificato: VectorCraft 0.12.0 si pilota in due modi.
- **MCP** `vectorcraft` (32 strumenti, handshake provato): `~/.local/bin/vectorcraft-cli mcp`, registrato in scope locale con
  lettura/scrittura confinate a `graphica/` di questa copia del repo. Dopo un riavvio di Claude Code i suoi
  strumenti compaiono come `mcp__vectorcraft__*`; l'uso reale (disegno, export) via MCP non è ancora stato provato.
  Se si lavora da un'altra copia del repo, ri-registra con le radici su quella `graphica/`.
- **Canale di controllo** dell'app (`--control`), provato davvero: è quello usato da `esporta.py` qui sotto.

## Disegnare
- I pittogrammi sportivi si generano da `graphica/sorgenti/figure.mjs` (giunture di testa, torso, arti):
  modifica i punti, `node graphica/sorgenti/figure.mjs graphica/varianti`.
- Solo nero, nessun `<rect>` di fondo, `viewBox 0 0 128 128`, `<title>` presente.

## Renderizzare ed esportare
1. Lancia l'app confinata in una cartella di lavoro:
   `/Applications/VectorCraft.app/Contents/MacOS/VectorCraft --control 7979 --automation-read-root DIR --automation-write-root DIR &`
   (`DIR` esistente; di default `/private/tmp/claude-501/vc`, o la variabile `VC_RADICE`).
2. `python3 graphica/sorgenti/esporta.py <svg> <nome> graphica/esportazioni` → PNG RGBA 32/64/128 trasparenti.
3. Altre operazioni: JSON a righe `{"id":1,"method":"app.open","params":{"path":…}}`; metodi in
   `docs/control-protocol.md` del repo `storytold/vectorcraft` (`app.export`, `ui.render`, `engine.execute`).
   Non indovinare i nomi dei metodi: leggili da quel file o da `engine.commands`.
4. A fine lavoro chiudi l'app: `{"method":"app.quit"}`. La porta non ha autenticazione.

Errori: `unknown method` = nome sbagliato; `not a control request` chiude la connessione, riconnetti;
export in background: attendi che il file esista prima di copiarlo; percorsi fuori dalla radice sono rifiutati.
