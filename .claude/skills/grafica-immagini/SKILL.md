---
name: grafica-immagini
description: Use when a graphic for ODS Corsi needs raster generation or editing (AI illustration, photo cut-out, transparent PNG), or when asked whether ArtCraft/PhotoCraft can be driven from Claude Code.
---

# Immagini raster (ArtCraft, PhotoCraft)

Stato verificato (ottobre 2026, sul Mac dell'utente):
- **ArtCraft Launcher 0.3.2** è installato, ma è solo il launcher che scarica le app Craft. L'app ArtCraft
  (generazione) **non è installata** e non risulta alcuna API, CLI o server MCP documentati per pilotarla.
  Non si può generare immagini da Claude Code finché non c'è un'interfaccia verificata. Non fingere di averlo fatto.
- **PhotoCraft 0.9.0** è installato; il README di VectorCraft cita per PhotoCraft le stesse opzioni
  `--automation-*-root` di un `photocraft-cli mcp`, ma il binario CLI non è installato e non è stato provato.
  Non lanciare `PhotoCraft --help`: apre la finestra e non torna.
- LightCraft ha già un MCP (`mcp__lightcraft__*`), ma è per sviluppare foto, non per illustrare.

Procedura:
1. Verifica prima di promettere: `ls /Applications | grep -i craft`, e se esiste un `*-cli`, `<cli> --help`.
2. Se non c'è un'interfaccia verificata, dillo e passa a `grafica-vettoriale`; per forme organiche proponi
   all'utente di generare la bozza a mano in ArtCraft e di metterla in `graphica/lavoro/`.
3. Una bozza raster ricevuta si vettorializza in VectorCraft (traccia) e si consegna come SVG.
4. Mai credenziali o chiavi API nel repo o nei log.
