---
target: sala
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/impeccable-critique-sala-407a10/src/components/tablet"
timestamp: 2026-10-03T10-58-03Z
slug: src-components-tablet
---
# Critique 4: tablet di sala (src/components/tablet)
Method: dual-agent (A: design review · B: detector + browser), entrambi su v0.8.3 (4962bcb), server del worktree su :5198.

## Design Health Score — 29/40 (Good) · 26 → 29 → 29 → 29
| # | Euristica | Voto | Problema chiave |
|---|---|---|---|
| 1 | Stato | 3 | Dopo 90s il timer in corso si riduce al chip in testata |
| 2 | Mondo reale | 3 | «non è segnato» al maschile per tutti; «I TUOI TIMER» |
| 3 | Controllo | 3 | Fascia «già» con ANNULLA dura 6s |
| 4 | Coerenza | 2 | Guida e app discordano (chi chiamare, timer modificabili); testi 13–14px sotto il minimo |
| 5 | Prevenzione | 3 | Ritocco legittimo invitato ad annullare; X del timer senza conferma |
| 6 | Riconoscimento | 3 | Due SEGNA LA PRESENZA uguali al cambio |
| 7 | Efficienza | 3 | Scorciatoie buone |
| 8 | Estetica | 3 | In verticale la giornata ripete le lezioni |
| 9 | Recupero errori | 3 | Fasce chiare |
| 10 | Aiuto | 3 | Note in pagina sufficienti |

Detector: 0 sui componenti; su styles.css 37 in tb-* quasi tutti falsi positivi (tinta 6–8px, scala tipografica in prosa). Reale: .tb-quando 0.10em su testo misto. Timer non scansionato (shadow DOM).

## Priority issues
- [P1] Inattività: torna alla home anche col timer in corso (Tablet.tsx:336). Fix: se inCorso(timer) setScheda('timer'). → harden
- [P1] Area istruttore in verticale: righe a metà altezza, Scollega sotto l'intestazione, appello in 320px. → adapt
- [P2] Sessione istruttore invisibile sotto TIMER (bollino solo su presenze). → harden
- [P2] Lezioni senza appello in PER CORSO non segnalate (SENZA APPELLO rosso). → colorize
- [P2] TUTTI PRESENTI e GLI ALTRI ASSENTI su righe diverse dell'intestazione. → layout
