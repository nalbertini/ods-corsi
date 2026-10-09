-- ---------------------------------------------------------------------------
-- ODS Corsi · il collega che insegnava con te
--
-- Chi fa l'appello si segna da solo (23-istruttori-dalle-lezioni.sql), ma il
-- collega che insegnava con lui e non ha messo il PIN restava fuori: la
-- lezione risultava coperta e non arrivava più alla segreteria. Qui due strade.
--
-- Dall'appello. Un istruttore previsto su una lezione vede gli altri previsti
-- (`istruttori_lezione`, che legge solo chi insegna la lezione o la segreteria)
-- e, fatto l'appello, ne segna uno presente (`segna_collega`): la
-- presenza è confermata da sola, come col PIN, con `come` = 'collega' e
-- `segnata_da` = chi l'ha segnata. Non si segna se stesso (lo fa l'appello),
-- né chi non è previsto, né su una lezione annullata. Chi una presenza ce
-- l'ha già (PIN, appello, rifiutata) resta com'è. Il segno lo toglie solo chi
-- l'ha messo (`togli_collega`), finché la segreteria non l'ha guardato: il
-- database non sa quando l'appello è chiuso, la segreteria sì.
--
-- Dalla segreteria. `segna_istruttore_previsto` segna «c'era» un previsto
-- anche su una lezione già coperta: confermata, `come` = 'segreteria'.
--
-- Si lancia dopo `23-istruttori-dalle-lezioni.sql`. Crea funzioni e dice lei a
-- chi: non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è,
-- l'appello non mostra gli istruttori e PRESENZE ISTRUTTORI non ha «c'era».
-- ---------------------------------------------------------------------------

alter table presenze_istruttori add column if not exists segnata_da uuid references persone on delete set null;
alter table presenze_istruttori drop constraint if exists presenze_istruttori_come;
alter table presenze_istruttori add constraint presenze_istruttori_come check (come in ('pin', 'appello', 'segreteria', 'collega'));

create or replace function istruttori_lezione(sessione uuid)
  returns table (persona_id uuid, nome text, cognome text, stato stato_presenza_istruttore, come text, segnata_da uuid)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  -- Solo chi insegna questa lezione, o la segreteria: un altro istruttore non legge le presenze dei colleghi.
  if not (e_staff() or coalesce(persona_corrente() = any (previsti_su(sessione)), false)) then
    raise exception 'gli istruttori della lezione li vede chi fa l''appello' using errcode = '42501'; end if;
  return query select pe.id, pe.nome, pe.cognome, pi.stato, pi.come, pi.segnata_da
    from unnest(previsti_su(sessione)) x join persone pe on pe.id = x
    left join presenze_istruttori pi on pi.sessione_id = sessione and pi.persona_id = x
    order by pe.nome, pe.cognome;
end $$;

create or replace function segna_collega(sessione uuid, persona uuid) returns text
  language plpgsql security definer set search_path = public, extensions as $$
declare io persone%rowtype; s sessioni%rowtype;
begin
  select * into io from persone where id = persona_corrente();
  select * into s from sessioni where id = sessione;
  -- 23503 e non P0002: dalla coda dell'app, un errore così non si riprova (come aggiungi_prova).
  if not found then raise exception 'lezione inesistente' using errcode = '23503'; end if;
  if io.id is null or io.ruolo = 'iscritto' or (io.ruolo = 'staff' and not io.anche_istruttore) or not io.id = any (previsti_su(sessione)) then
    raise exception 'segna un collega solo chi insegna questa lezione' using errcode = '42501'; end if;
  if s.stato = 'annullata' then raise exception 'la lezione è annullata' using errcode = '22023'; end if;
  if persona = io.id then raise exception 'te stesso ti segna l''appello' using errcode = '22023'; end if;
  if not persona = any (previsti_su(sessione)) then raise exception 'si segnano solo gli istruttori previsti' using errcode = '22023'; end if;
  -- Dall'appello: chi segna il collega ha già la sua presenza su questa lezione. Non su una lezione futura o di mesi fa a mano.
  if not exists (select 1 from presenze_istruttori pi where pi.sessione_id = sessione and pi.persona_id = io.id and pi.stato <> 'rifiutata') then
    raise exception 'prima fai l''appello: il collega si segna dopo' using errcode = '22023'; end if;
  insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come, segnata_da)
    values (sessione, persona, 'confermata', true, 'collega', io.id)
    on conflict on constraint presenze_istruttori_sessione_id_persona_id_key do nothing;
  return case when found then 'segnata' else 'gia' end;
end $$;

create or replace function togli_collega(sessione uuid, persona uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare r presenze_istruttori%rowtype;
begin
  -- Prima di guardare la riga: il tablet o un iscritto non scoprono nemmeno se c'è.
  if persona_corrente() is null or not e_personale() then
    raise exception 'si toglie solo un collega segnato da te' using errcode = '42501'; end if;
  select * into r from presenze_istruttori where sessione_id = sessione and persona_id = persona;
  if not found then return; end if;
  -- `coalesce`: con `segnata_da` nullo (chi l'ha segnata è stata eliminata) il confronto è nullo, e nessuno la toglie.
  if not coalesce(r.come = 'collega' and r.segnata_da = persona_corrente() and r.gestita_il is null, false) then
    raise exception 'si toglie solo un collega segnato da te' using errcode = '42501'; end if;
  delete from presenze_istruttori where id = r.id;
end $$;

create or replace function segna_istruttore_previsto(sessione uuid, persona uuid) returns text
  language plpgsql security definer set search_path = public, extensions as $$
declare s sessioni%rowtype;
begin
  if not e_staff() then raise exception 'la presenza la conferma la segreteria' using errcode = '42501'; end if;
  select * into s from sessioni where id = sessione;
  if not found then raise exception 'lezione inesistente' using errcode = 'P0002'; end if;
  if s.stato = 'annullata' then raise exception 'la lezione è annullata' using errcode = '22023'; end if;
  if not persona = any (previsti_su(sessione)) then raise exception 'si sceglie fra gli istruttori previsti' using errcode = '22023'; end if;
  insert into presenze_istruttori (sessione_id, persona_id, stato, prevista, come, gestita_da, gestita_il)
    values (sessione, persona, 'confermata', true, 'segreteria', persona_corrente(), now())
    on conflict on constraint presenze_istruttori_sessione_id_persona_id_key do nothing;
  return case when found then 'segnata' else 'gia' end;
end $$;

revoke all on function istruttori_lezione(uuid), segna_collega(uuid, uuid), togli_collega(uuid, uuid), segna_istruttore_previsto(uuid, uuid) from public, anon;
grant execute on function istruttori_lezione(uuid), segna_collega(uuid, uuid), togli_collega(uuid, uuid), segna_istruttore_previsto(uuid, uuid) to authenticated;

-- Che l'API veda subito colonne e funzioni nuove, senza aspettare.
notify pgrst, 'reload schema';
