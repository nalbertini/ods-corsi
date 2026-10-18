---
name: grafica-controllo
description: Use before delivering any SVG or PNG asset for ODS Corsi, to check validity, transparency, black-only pixels, coverage and legibility at 32/64/128.
---

# Controllo qualità visivo

Un asset non è consegnato finché non passa tutto questo.

1. **SVG valido**: `xmllint --noout graphica/esportazioni/*.svg`.
2. **PNG**: `node graphica/sorgenti/controlla-png.mjs graphica/esportazioni/*.png` — RGBA, quadrato, angoli
   a alfa 0, solo pixel neri, copertura 8–70% (la regola di stile è 15–45%). Esce con codice 1 se qualcosa non va.
3. **Vista**: apri con Read i PNG a 32px e a 128px. Chiediti: si riconosce la disciplina? Le teste si
   staccano dal busto? Gli arti si distinguono? Le due figure si leggono come due?
4. **Confronto**: affianca le varianti scartate; la scelta si motiva con la leggibilità a 32px.
5. **Nessuna sovrascrittura**: `git status` deve mostrare solo file nuovi in `graphica/` e `.claude/skills/`.
6. **Resoconto onesto**: scrivi cosa hai davvero eseguito e con quale strumento; un controllo non fatto va dichiarato.

Un guasto si corregge nella sorgente (`figure.mjs`) e si riesporta; non si ritocca il PNG a mano.
