---
target: sala
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/impeccable-critique-sala-407a10/src/components/tablet"
timestamp: 2026-10-03T08-01-49Z
slug: src-components-tablet
---
# Critique: tablet di sala (src/components/tablet)
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 26/40 (Acceptable)
| # | Euristica | Voto | Problema chiave |
|---|---|---|---|
| 1 | Stato del sistema | 3 | Piede «0/10 SEGNATI» e chip «SI SEGNA ORA» seguono sempre la prima lezione aperta (Tablet.tsx:250) |
| 2 | Mondo reale | 3 | Voce di palestra; «I TUOI TIMER» su tablet condiviso, «COUNTDOWN» inglese |
| 3 | Controllo e libertà | 2 | ANNULLA vive 6s (server 2 min); ritocco del nome non offre annullo |
| 4 | Coerenza | 2 | Nero su rosso in .tb-btn-rosso/.tb-btn-timer (styles.css:735,771); colori dei tipi di timer violano il Segnale Unico |
| 5 | Prevenzione errori | 2 | Area istruttore apre sulla lezione sbagliata; due SEGNA verdi uguali nel cambio lezione |
| 6 | Riconoscimento | 3 | Tessere coi nomi, recupero dal corso |
| 7 | Efficienza | 3 | ▶ AVVIA, GLI ALTRI ASSENTI |
| 8 | Estetica minimale | 3 | Riposo pulito; testata affollata col timer |
| 9 | Recupero errori | 2 | «NON È ANDATA» 6s; blocco PIN con testo server minuscolo |
| 10 | Aiuto | 3 | Note utili ma 15px grigie, illeggibili a 2m |

## Specificità: autoriale, non intercambiabile. Eccezione: lista timer incorporata (6 chip filtro, tipi colorati rosso/verde/giallo/blu).
Detector CLI: 0 finding. Overlay: 26 finding su 6 viste, quasi tutti falsi positivi pinnati da DESIGN.md (tracking, barra tinta, 11px nastro). Reale: chip timer taglia il conteggio (Tablet.tsx:368, max-width 240px vs 304px).

## Priority issues
- [P0] Area istruttore apre sulla lezione sbagliata (TabletIstruttore.tsx:58 primaDiOggi = prima aperta; lista 129px nasconde Judo; TIMER e ritorno resetta la scelta). Fix: partire da presenze[0].sessioneId, scelta in TabletSala, lista con altezza minima. → /impeccable harden
- [P1] Lezioni sovrapposte trattate come una (Tablet.tsx:250 find). Fix: preferire quella che inizia; chip con scelta. → /impeccable harden
- [P1] Segno ottimista senza coda, poco segnale. Fix: coda + spia gialla IN ATTESA DI RETE sulla tessera. → /impeccable harden
- [P1] Riposo vuoto quando la prossima lezione è più tardi. Fix: riquadro PROSSIMA LEZIONE con ora apertura. → /impeccable onboard
- [P2] Annullo corto e nascosto; fascia copre ultima riga e chip conta tagliato. → /impeccable clarify + layout
- [P3] Nero su rosso, testi secondari 10–15px, tinta verde accanto a verde «aperta», colori tipi timer. → /impeccable polish

## Persona: iscritto al muro, istruttore col PIN, Sam, Riley — vedi report in chat.
