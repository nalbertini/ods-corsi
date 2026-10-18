-- La presenza di un istruttore rifiutata si può eliminare.
--
-- Una presenza rifiutata (15-presenze-istruttori.sql) resta in elenco per
-- sempre, in grigio. La segreteria la può eliminare con
-- `elimina_presenza_istruttore`: solo se è rifiutata (una confermata o da
-- confermare si rifiuta prima, così non si perde una presenza per sbaglio).
-- Se l'istruttore rimette il PIN dopo, la presenza si segna di nuovo da capo.
--
-- Si lancia dopo `15-presenze-istruttori.sql`, e si può rilanciare senza
-- danni. Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, in
-- PRESENZE ISTRUTTORI le rifiutate non hanno il tasto ELIMINA e provarci dice
-- di lanciare questo file.

create or replace function elimina_presenza_istruttore(presenza uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  stato_attuale stato_presenza_istruttore;
begin
  if not e_staff() then raise exception 'la presenza la elimina la segreteria' using errcode = '42501'; end if;
  select stato into stato_attuale from presenze_istruttori where id = presenza;
  if not found then raise exception 'presenza inesistente' using errcode = 'P0002'; end if;
  if stato_attuale <> 'rifiutata' then raise exception 'si elimina solo una presenza rifiutata' using errcode = '22023'; end if;
  delete from presenze_istruttori where id = presenza;
end $$;

revoke all on function elimina_presenza_istruttore(uuid) from public, anon;
grant execute on function elimina_presenza_istruttore(uuid) to authenticated;

-- Che l'API veda subito la funzione nuova, senza aspettare.
notify pgrst, 'reload schema';
