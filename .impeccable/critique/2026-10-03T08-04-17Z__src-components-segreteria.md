---
target: segreteria
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/upbeat-ptolemy-e6c8dc/src/components/segreteria"
timestamp: 2026-10-03T08-04-17Z
slug: src-components-segreteria
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score — 26/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Status | 3 | Errors persist; mobile MENU badge 12 sums different things than DA FARE |
| 2 | Real world | 3 | Gym words; but RIGENERA / "generate dalle ricorrenze"; "NETTO A PAGARE 0,00 €" ambiguous |
| 3 | Control | 2 | Lesson ANNULLATA one click, no confirm; half-filled receipt lost on menu change |
| 4 | Consistency | 2 | DA FARE 14 appelli (30d) -> Presenze month shows 1; 48 certificati vs Iscritti header 37 |
| 5 | Error prevention | 3 | Good consequence copy, PRIMA DI ACCOGLIERE; but native window.confirm everywhere |
| 6 | Recognition | 3 | DA FARE good; attendance squares meaning only in title |
| 7 | Efficiency | 1 | No shortcuts, bulk, global search |
| 8 | Minimalist | 3 | Wall of red numbers in DA FARE; Settimana at 1024 ~3 rows visible |
| 9 | Recovery | 3 | Clear errors, RIPROVA / Riconta |
| 10 | Help | 3 | GUIDA per section in new tab |

Note: different reviewer, stricter; previous issues fixed, new ones found. Not like-for-like with 27/40.

## Specificity
~7/10. Generic: tables + sort headers, Statistiche tiles, light theme loses "tabellone" punch at 1440.
Detector: CLI 0; browser 6 screens @1024, no overflow. Real: search placeholder #757575 on #f4f4f1 4.2:1 (no ::placeholder rule). Doubtful: striped in-progress month in Statistiche (styles.css ~1335). FP: wide tracking (mandated), clipped container (inner scroll), em-dash empty cells.

## Priority issues
- [P1] DA FARE numbers don't survive the jump: 14 (30d) -> Presenze month 1; 48 certificati (incl. in scadenza) vs Iscritti header 37. Fix: TUTTE IN PRESENZE opens 30-day missing view; split certificati red (manca/scaduto) vs yellow (in scadenza); same numbers/words. -> clarify + logic
- [P1] Red lost hierarchy in DA FARE: all numbers red incl. stampare. Fix: red blocking/overdue, yellow soon/awaiting reply, neutral chores in one line; order by tier. -> colorize, distill
- [P1] Native window.confirm (~20 sites); "Annullare la ricevuta?" + [Annulla] inverted (Ricevute.tsx:40). Fix: <Conferma> on useDialogo with verb buttons; also for lesson ANNULLATA (Settimana.tsx:364). -> harden
- [P2] Interrupted work lost (receipt/new member drafts on menu change); no global search / "/" shortcut / skip link. -> harden
- [P2] A11y: Iscritti <button role="row">; scheda without headings; attendance squares colour+title only; default focus ring on .sg-btn; placeholder 4.2:1. -> audit

## Persona red flags
Alex: no shortcuts/bulk; requests one by one; names wrap with detail open even @1440.
Sam: role=row buttons, no headings, colour-only squares, "NOME↕".
Segretaria: morning red wall; numbers change between screens; RIGENERA; one-click lesson cancel; NETTO 0,00; 11px text in Settimana; lost receipt on interruption.

## Minor
PRESENZE ISTRUTTORI wraps with floating badge; Presenze tabs above H1; annulled receipt red strikethrough (should be grey); RIGENERA before + LEZIONE STRAORDINARIA; menu 1242px tall @1024x700 (IMPOSTAZIONI/SEGNALAZIONI/GUIDA below fold); weekend columns clipped @1024; DESIGN.md Navigation still says red bar on active item.

## Questions
1. 8 red numbers every morning: show only today's 3?
2. Why is cancelling a lesson easier than archiving a course?
3. Why does "person at the desk" start with menu + 198-row scroll instead of an always-visible name field?
