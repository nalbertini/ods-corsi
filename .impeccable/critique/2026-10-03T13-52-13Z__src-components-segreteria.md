---
target: Segreteria
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/nicola/Automation/ods-corsi/.claude/worktrees/segreteria-critique-950cdd/src/components/segreteria"
timestamp: 2026-10-03T13-52-13Z
slug: src-components-segreteria
---
# Critique: Segreteria (src/components/segreteria), dopo #195 #196 #199 #201 #202 #206 — 28/40 Buono

| # | Euristica | Voto | Problema chiave |
|---|---|---|---|
| 1 | Visibilità stato | 3 | Lezione passata senza appello apre con STATO PREVISTA; CORSI senza «modifiche non salvate» |
| 2 | Mondo reale | 3 | «FUORI APP», «toglila», «Riparti dall'orario vero» |
| 3 | Controllo | 3 | Indietro/Avanti ok; CORSI e PERSONALE senza useBozza: modifiche perse |
| 4 | Coerenza | 2 | Due «Cerca»; IMPOSTAZIONI icona sul computer; Rifiuta link/tasto; 12 lezioni = 9 caselle |
| 5 | Prevenzione | 3 | Ricevuta bloccata bene; manca bozza in CORSI/PERSONALE |
| 6 | Riconoscere | 3 | Sottotitolo SETTIMANA cita IMPOSTAZIONI che sul computer non c'è come parola |
| 7 | Efficienza | 2 | Niente azioni in blocco; filtri fuori dall'indirizzo |
| 8 | Minimalismo | 3 | Stato ripetuto 3 volte nella scheda |
| 9 | Errori | 3 | Motivo blocco in fondo al modulo lungo |
| 10 | Aiuto | 3 | ? in cima; niente aiuto nel modulo ricevuta |

Specificità: lessico e segni molto ODS; struttura «titolo+riga+tabella» generica. Rilevatore: CLI pulita; browser quasi tutti falsi positivi (wide-tracking, side-tab tinta, disabled, skip link); reali: tiny-text 11px .sg-segno-regola, line-length ~132 in PRESENZE ISTRUTTORI, colonna 167% in CORSI, 0.10em sotto il minimo DESIGN.md.

## Problemi prioritari
- [P1] CORSI e PERSONALE perdono le modifiche senza avviso (useBozza) — harden
- [P1] IMPOSTAZIONI solo icona sul computer — clarify
- [P2] var(--rosso) come testo piccolo in 9 punti (4,1:1) — polish
- [P2] Gerarchia tasti pieni (LEZIONE STRAORDINARIA; tre pieni nella scheda) — layout
- [P2] DA FARE mai a «tutto a posto»: separare oggi da arretrati di stagione — distill

## Persone
Rita: due Cerca; IMPOSTAZIONI introvabile; modifica corso persa; SETTIMANA 1366 stretta; 37 rossi fissi; ricerca vuota senza + NUOVO. Alex: niente bulk, filtri non nell'indirizzo. Sam: rosso 4,1:1; 11px; link 18px; intestazioni 21px.

## Minori
Menu istruttore lezione tagliato; nomi corsi troncati; schede sopra titolo in PRESENZE; STATISTICHE trattino e frecce in mappa; «nessuna email» rosso; SETTIMANA telefono su sabato vuoto; nomi corsi prova vs listino.

## Domande
DA FARE sempre rosso? Ricerca al centro? Voci mai aperte dietro IMPOSTAZIONI?
