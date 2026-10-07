# Percorsi critici

Cosa deve funzionare sempre, e cosa lo protegge. Lo tiene `garante-qualita`
(`.claude/agents/garante-qualita.md`). Un percorso è critico se, cadendo, si
perde o si sbaglia un dato, o la segreteria non riesce a lavorare.

**Prove** = script `prova:*` (app) e file di `supabase/prova/` (database).
**Collaudo** = va passato anche a mano con `collaudatore` quando cambia.

Audit completo: 2026-10-07, secondo giro dopo le prove di `costi.ts`, `contiReport`, `creaRichiesteSupabase`, `unisciSessioni` e allegati (25 `prova:*` e 31 file SQL verdi). Dove
la colonna Prove dice **SCOPERTO** non c'è una prova che cada se la regola si
rompe.

| Percorso | Chi | Se cade | Prove | Collaudo |
|---|---|---|---|---|
| Iscrizione a passi (famiglia, minori, sconto, corsi senza prezzo) | genitore, segreteria | iscrizione persa o quota sbagliata | `prova:iscrizione-passi`, `prova:campi`, `prova:listino`, `supabase/prova/iscrizioni.sql`, `listino.sql` | sì |
| Richieste e coda di approvazione | segreteria | richiesta persa | `prova:richieste` (la finta e `creaRichiesteSupabase`, la metà vera, con un client finto), `prova:coda` | sì |
| Appello e presenze (anche senza rete) | istruttore | presenze perse | `prova:coda`, `prova:appello-cerca`, `prova:tablet`, `supabase/prova/presenze-istruttori.sql`, `istruttori-dalle-lezioni.sql`, `tablet-conto-prove.sql` | sì |
| Ore degli istruttori | segreteria | compenso sbagliato | `prova:ore` (anche `contiReport`), `prova:timer-istruttori`, `supabase/prova/presenze-istruttori.sql`; il disegno del PDF non è provato | no |
| Certificati medici (carica, archivia, non archiviato) | segreteria, iscritto | certificato perso o visibile a chi non deve | `prova:certificati`, `supabase/prova/certificati.sql` | sì |
| Ricevute e pagamenti | segreteria | quota o ricevuta sbagliata | `prova:ricevuta`, `supabase/prova/ricevute.sql` (netto e quota con anticipo: stessi casi nelle due metà) | sì |
| Firma e informativa | iscritto | consenso non valido | `prova:firma`, `prova:firma-tratti`, `prova:informativa`, `supabase/prova/informativa-mesi.sql` | sì |
| Importazione persone da CSV | segreteria | persona persa, duplicata o scritta male | `prova:importa` (lettura del CSV, `leggiFogli`, `controllaRighe`, `righeBuone`, le risposte del modulo); la scrittura sul database (`importa()`) in `prova:email-contatto` e `prova:segreteria` | no |
| Anagrafiche, nuclei, doppioni | segreteria | persone duplicate o unite male | `prova:iscritti`, `prova:cerca-persone`, `prova:email-contatto`, `supabase/prova/anagrafiche.sql`, `non-doppioni.sql`, `unisci-doppioni.sql`, `cerca-persone.sql`, `email-contatto.sql`; `unisciSessioni`/`chiaveSessione` (`sessioni.ts`) in `prova:iscritti` | no |
| Accesso e ruoli (PIN, RLS) | tutti | dati visti da chi non deve | `supabase/prova/rls.sql`, `segreteria.sql`, `elimina-istruttore.sql`, `prova:segreteria` (ruoli e accessi di `segreteria.ts`) | no |
| Calendario e date dei corsi | segreteria, tablet | lezione che non compare | `supabase/prova/calendario*.sql`, `date-corsi.sql`, `prova:indirizzi` (indirizzi della segreteria) | no |
| Prove (modalità prova) e statistiche | segreteria | numeri sbagliati | `prova:prove`, `prova:segreteria` (`fuoriRegola`, il bottone CHI NON È IN REGOLA), `supabase/prova/prove.sql`, `prove-per-nome.sql`, `statistiche.sql` | no |
| Segnalazioni | tutti | problema segnalato che sparisce | `supabase/prova/segnalazioni.sql` (anche gli allegati), `attivita.sql` | no |
| Backup del database | utente | niente da ripristinare | `.github/workflows/backup.yml` (ultimo run verde 2026-10-06, 3 su 3 verdi), `.github/workflows/ripristino.yml` (ogni lunedì rimette l'ultima copia in un Postgres usa e getta e conta le righe: `scripts/ripristina.sh`, provato in locale su una copia finta; il primo giro sul backup vero può chiedere un aggiustamento) | no |
| Musica, timer, tablet di sala | istruttore, sala | lezione senza timer/musica | `prova:musica`, `prova:musica-file`, `prova:tablet`, `prova:scaletta`, `prova:strumenti`, `prova:anteprima`, `prova:discipline`, `supabase/prova/musica.sql`, `categorie-esercizi.sql`, `discipline.sql`, `timer.sql`, `timer-lezioni.sql`, `tablet.sql` | no |

## Come si aggiorna

- Funzione nuova o percorso nuovo: una riga, nello stesso PR.
- Problema corretto: la prova che lo teneva fuori entra nella colonna Prove.
- Prova rimossa o rinominata: la riga si corregge.
