-- ---------------------------------------------------------------------------
-- ODS Corsi · fin dove è pronto il calendario, dalle lezioni dell'orario
--
-- `calendario_pronto_fino()` (05-segreteria.sql) guardava la lezione più
-- lontana di tutte, straordinarie comprese. Una straordinaria fissata fra
-- quattro mesi diceva «pronto fino» a quel giorno: `allunga_calendario`
-- (12-calendario-da-se.sql) trovava il calendario già lungo abbastanza e non
-- creava più le lezioni dell'orario, e le settimane in mezzo restavano vuote.
-- Qui contano solo le lezioni nate da una ricorrenza: anche la modalità prova
-- (`prontoFino` in src/lib/segreteriaProva.ts) non guarda le straordinarie.
-- Le straordinarie restano dove sono: allungare non cancella niente.
--
-- Chi può: come prima, chiunque abbia un accesso; `anon` no.
-- Si lancia dopo `05-segreteria.sql` e non chiede di rilanciare
-- `06-iscrizioni.sql`: i permessi li rimette lui. Finché non c'è, l'app
-- funziona come prima, e una straordinaria lontana ferma il calendario.
-- ---------------------------------------------------------------------------

create or replace function calendario_pronto_fino() returns date
  language sql stable set search_path = public, extensions as $$
  select (max(inizio) at time zone 'Europe/Rome')::date from sessioni where ricorrenza_id is not null
$$;

revoke all on function calendario_pronto_fino() from public, anon;
grant execute on function calendario_pronto_fino() to authenticated;

notify pgrst, 'reload schema';
