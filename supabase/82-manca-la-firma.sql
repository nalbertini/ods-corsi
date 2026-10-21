-- ---------------------------------------------------------------------------
-- ODS Corsi · manca la firma
--
-- In una lezione tenuta in due, chi dimentica il PIN non ha la presenza: non
-- è pagato e COMPENSI non lo vedeva. Ora COMPENSI mostra, per ogni tecnico,
-- le lezioni dove era previsto (`previsti_su`), un collega ha firmato e lui
-- no; la segreteria dice C'ERA (`segna_istruttore_previsto`, già nel 46) o
-- NON C'ERA, qui.
--
--   · `corsi.basta_uno`: nei corsi dove gli istruttori si alternano basta che
--     uno abbia firmato; agli altri non si chiede. La scrive chi scrive i
--     corsi (la segreteria, `02-policy.sql`).
--   · `segna_istruttore_assente(sessione, persona)`: solo la segreteria
--     (`e_staff()`), su una lezione non annullata e fra i previsti. Scrive
--     una presenza RIFIUTATA, `come` = 'segreteria': la firma non si chiede
--     più, e in PRESENZE ISTRUTTORI la rifiutata si toglie
--     (`65-elimina-presenza-rifiutata.sql`) se era uno sbaglio. Chi una
--     presenza ce l'ha già resta com'è.
--
-- Si lancia dopo `46-istruttore-collega.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, la spunta «basta uno» non si vede in
-- CORSI e «Non c'era» dice di lanciarlo.
-- ---------------------------------------------------------------------------

alter table corsi add column if not exists basta_uno boolean not null default false;

create or replace function segna_istruttore_assente(sessione uuid, persona uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare s sessioni%rowtype;
begin
  if not e_staff() then raise exception 'chi non c''era lo segna la segreteria' using errcode = '42501'; end if;
  select * into s from sessioni where id = sessione;
  if not found then raise exception 'lezione inesistente' using errcode = 'P0002'; end if;
  if s.stato = 'annullata' then raise exception 'la lezione è annullata' using errcode = '22023'; end if;
  if not persona = any (previsti_su(sessione)) then raise exception 'si sceglie fra gli istruttori previsti' using errcode = '22023'; end if;
  insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come, gestita_da, gestita_il)
    values (sessione, persona, 'rifiutata', true, 'segreteria', persona_corrente(), now())
    on conflict on constraint presenze_istruttori_sessione_id_persona_id_key do nothing;
  return case when found then 'segnata' else 'gia' end;
end $$;
revoke all on function segna_istruttore_assente(uuid, uuid) from public, anon;
grant execute on function segna_istruttore_assente(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
