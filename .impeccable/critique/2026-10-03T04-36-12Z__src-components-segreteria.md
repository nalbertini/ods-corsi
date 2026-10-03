---
target: segreteria
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/upbeat-ptolemy-e6c8dc/src/components/segreteria"
timestamp: 2026-10-03T04-36-12Z
slug: src-components-segreteria
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 27/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Menu badges only for PRESENZE SEGNALATE/ISTRUTTORI; RICHIESTE ONLINE has none (Segreteria.tsx:181-190) |
| 2 | Real world | 4 | Gym language throughout; confirms speak of the paper folder |
| 3 | Control | 3 | Ricevuta annulla+rifai honest; ACCOGLI has no undo |
| 4 | Consistency | 2 | Red = course tint, primary CTA, and missing |
| 5 | Error prevention | 2 | ACCOGLI one green click without regolamento; empty CF not flagged before receipt |
| 6 | Recognition | 3 | Native selects with ~198 people / ~40 listino voci |
| 7 | Efficiency | 2 | No shortcuts, no batch (7 instructor confirms one by one) |
| 8 | Minimalist | 3 | Prose openers in Impostazioni / Presenze istruttori |
| 9 | Error recovery | 3 | Guaio+RIPROVA good; toasts vanish in 3-6s |
| 10 | Help | 2 | GUIDA per section good; in-page help is prose |

## Design specificity
~70% authored; identity carried by copy. Generic: 13-item flat rail, KPI tiles, filter bars.
Detector: CLI 0 (styles in styles.css). Browser 108 flags/5 sections: low-contrast 36 (#121212 on #e4292a 4.1:1; heatmap white on blue 3.8/2.8:1 styles.css:1264-1265; placeholder 4.2:1), undersized 10px .sg-tag (styles.css:1075, DESIGN.md says 11px) + inline SEGRETERIA label (Segreteria.tsx:174). False positives: wide-tracking, side-tab on .sg-scheda, overflow hidden. Doubtful: striped "in corso" bar vs no-gradients rule; em-dash = empty cells.

## Priority issues
- [P1] Red no longer means missing: Rosso in course palette (segreteria.ts:602, Lotta #e4292a), red primary CTAs, ~15 red "istruttore?". Fix: remove red from palette, neutral primaries, dim "istruttore?" unless past lesson. → colorize, quieter
- [P1] No "DA FARE" home; RICHIESTE ONLINE without badge; missing items spread across 5 places. Fix: badge now, then DA FARE first view. → distill, layout
- [P1] Inverted safeguards: ACCOGLI green one-click even with missing regolamento/files; receipt warning 12px grey (Ricevute.tsx:490), CF not flagged. Fix: red checklist + "ACCOGLI LO STESSO"; data-manca on CF; summary confirm. → harden, clarify
- [P2] Nav overload: 13 flat items, three Presenze. Fix: 4 groups; Segnalate as tab. → layout
- [P2] Payment in two places (manual toggle vs receipts). Fix: derive from receipts, manual as exception; prefill course voce. → shape

## Persona red flags
Alex: no / search, no batch confirm, no multi-select pagato, unfilterable long selects.
Sam: drawer role=dialog w/o aria-modal or focus trap (Settimana.tsx:297); .sg-campo:focus border only (styles.css:1044); default focus on .sg-voce/.sg-btn; course color-only; toasts vanish.
Segretaria al banco: toasts vanish during calls; ACCOGLI looks safe; requests invisible from menu; prose in Impostazioni.

## Minor
Touch copy on desktop; missing year "30 giugno"; month filter hides cross-month missing appelli; no ricevute register; 9-row menu at 375px; PROVA chip in nucleo.

## Questions
1. What would "4 cose da fare" count, and why isn't it home?
2. Should a minor's request without regolamento be acceptable in one green click?
3. Is the DA PAGARE/PAGATO toggle an Excel legacy receipts already replaced?
