-- ---------------------------------------------------------------------------
-- ODS Corsi · sul tablet chi prova si conta a parte
--
-- Il tablet di sala scriveva «11 presenti su 10» quando nell'appello c'era
-- chi veniva a provare: `presenti` di `lezioni_sala` (04-tablet.sql) conta
-- tutti i presenti, `iscritti` solo gli iscritti. L'app degli istruttori le
-- prove le toglie e le dice a parte («+1 PROVA»); il tablet fa lo stesso con
-- `prove_sala`, che dice quante di quelle presenti sono prove.
--
-- Prove sono i presenti non iscritti quel giorno, come nell'app e nelle
-- statistiche (22-statistiche.sql), non le righe di `prove`: chi ha provato
-- e da oggi è iscritto è un iscritto, e chi ha l'iscrizione finita ieri non è
-- fra gli `iscritti`. Così presenti meno prove non supera mai gli iscritti.
--
-- Accanto a `lezioni_sala` senza cambiarla, come `kanji_sala` (24-kanji.sql):
-- cambiarne le colonne vorrebbe dire toglierla e rifarla, e chi rilancia
-- `04-tablet.sql` dopo questo file la romperebbe. Le lezioni sono quelle di
-- `lezioni_sala`, che controlla anche che a chiedere sia un tablet. Una
-- lezione senza prove presenti non c'è.
--
-- Si lancia dopo `04-tablet.sql`. Crea una funzione, ma dice lei a chi: non
-- chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, il tablet conta
-- come prima, prove comprese.
-- ---------------------------------------------------------------------------

create or replace function prove_sala(da_giorno date, a_giorno date)
  returns table (sessione_id uuid, prove int)
  language sql stable security definer set search_path = public, extensions as $$
  select l.id, count(*)::int
  from lezioni_sala(da_giorno, a_giorno) l
  join presenze pr on pr.sessione_id = l.id and pr.stato = 'presente'
  -- Lo stesso giorno e la stessa regola con cui `lezioni_sala` conta gli iscritti.
  where not exists (select 1 from iscrizioni i where i.corso_id = l.corso_id and i.persona_id = pr.persona_id
    and i.dal <= (l.inizio at time zone 'Europe/Rome')::date and (i.al is null or i.al >= (l.inizio at time zone 'Europe/Rome')::date))
  group by l.id
$$;

revoke all on function prove_sala(date, date) from public, anon;
grant execute on function prove_sala(date, date) to authenticated;

notify pgrst, 'reload schema';
