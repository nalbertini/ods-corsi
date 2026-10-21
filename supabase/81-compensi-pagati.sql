-- ---------------------------------------------------------------------------
-- ODS Corsi · il compenso pagato finisce in CONTABILITÀ
--
-- Quando un tecnico è pagato, le sue ricevute dei compensi
-- (`80-ricevute-compensi.sql`) diventano un'uscita in CONTABILITÀ: un
-- movimento solo, anche per più mesi pagati con un bonifico, con la voce di
-- sistema «Compensi istruttori», collegato al tecnico (`movimenti.persona_id`,
-- `70-movimenti-persona.sql`), e la descrizione «Compenso · Nome Cognome ·
-- set, ott 2026» (mai codice fiscale né IBAN).
--
--   · `ricevute_compensi.movimento_id` e `pagata_il`: il pagamento della
--     ricevuta. Li scrive solo `paga_compensi`; null = da pagare.
--   · `paga_compensi(ricevute, data, cassa)`: solo chi ha la segreteria E
--     l'amministrazione (`e_staff()` e `contabilita_porta()`). Le ricevute
--     sono della stessa persona, non annullate, non già pagate; la data non è
--     nel futuro, non prima del `dal` della cassa, non in un giorno chiuso.
--     Tutto o niente.
--   · Una ricevuta pagata non si annulla: prima si annulla il movimento. Il
--     movimento annullato (`annulla_movimento`) rimette le sue ricevute da
--     pagare (trigger `compensi_tornano`), e si possono ripagare.
--
-- Si lancia dopo `80-ricevute-compensi.sql`, `60-chiusura-cassa.sql` e
-- `70-movimenti-persona.sql`. Non chiede di rilanciare `06-iscrizioni.sql`; rifà
-- `annulla_ricevuta_compenso` dell'80, quindi se si rilancia l'80 va
-- rilanciato anche questo (`controllo.sql` lo dice). Finché non c'è, COMPENSI
-- dice di lanciarlo quando si prova a pagare.
-- ---------------------------------------------------------------------------

insert into voci_contabili (nome, tipo, di_sistema) values ('Compensi istruttori', 'uscita', true) on conflict do nothing;

alter table ricevute_compensi add column if not exists movimento_id uuid references movimenti on delete restrict;
alter table ricevute_compensi add column if not exists pagata_il date;

-- «Compenso · Anna Gialli · set, ott 2026»; anni diversi: «dic 2026, gen 2027».
create or replace function descrizione_pagamento(nome text, cognome text, mesi date[]) returns text
language sql immutable set search_path = public as $$
  select 'Compenso · ' || trim(nome || ' ' || cognome) || ' · ' || string_agg(per_anno, ', ' order by anno)
  from (
    select anno, string_agg((array['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'])[extract(month from m)::int], ', ' order by m) || ' ' || anno as per_anno
    from (select distinct m, extract(year from m)::int as anno from unnest(mesi) m) x
    group by anno
  ) y
$$;
revoke all on function descrizione_pagamento(text, text, date[]) from public, anon;

create or replace function paga_compensi(ricevute uuid[], data date, cassa uuid) returns movimenti
language plpgsql security definer set search_path = public as $$
declare
  r movimenti;
  ca casse;
  chi persone;
  quante int;
  persone_diverse int;
  totale int;
  mesi date[];
begin
  if not e_staff() then raise exception 'I compensi li paga chi cura segreteria e contabilità' using errcode = '42501'; end if;
  perform contabilita_porta();
  -- La stessa ricevuta due volte conta una volta.
  ricevute := array(select distinct x from unnest(ricevute) x where x is not null);
  if coalesce(cardinality(ricevute), 0) = 0 then raise exception 'Scegli almeno una ricevuta da pagare' using errcode = '22023'; end if;
  perform 1 from ricevute_compensi x where x.id = any(ricevute) for update;
  select count(*), count(distinct x.persona_id), sum(x.importo), array_agg(x.mese) into quante, persone_diverse, totale, mesi
    from ricevute_compensi x where x.id = any(ricevute) and x.annullata_il is null and x.movimento_id is null;
  if quante <> cardinality(ricevute) then raise exception 'Una delle ricevute non c''è più, è annullata o è già pagata: ricarica la pagina' using errcode = '22023'; end if;
  if persone_diverse <> 1 then raise exception 'Si pagano insieme solo le ricevute dello stesso tecnico' using errcode = '22023'; end if;
  if paga_compensi.data is null or paga_compensi.data > contabilita_oggi() then raise exception 'La data del pagamento non può essere nel futuro' using errcode = '22023'; end if;
  select * into ca from casse where id = cassa for share;
  if not found then raise exception 'Scegli la cassa' using errcode = '22023'; end if;
  if ca.dal is not null and paga_compensi.data < ca.dal then raise exception 'La data è prima dell’inizio della cassa' using errcode = '22023'; end if;
  if cassa_giorno_chiuso(ca.id, paga_compensi.data) then raise exception 'Quel giorno la cassa è già chiusa: scegli un altro giorno o annulla la chiusura' using errcode = '22023'; end if;
  select p.* into chi from persone p join ricevute_compensi x on x.persona_id = p.id where x.id = ricevute[1];
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, creato_da, persona_id)
  values ('uscita', paga_compensi.data, totale, (select id from voci_contabili where nome = 'Compensi istruttori' and tipo = 'uscita' and di_sistema), ca.id,
          descrizione_pagamento(chi.nome, chi.cognome, mesi), persona_corrente(), chi.id)
  returning * into r;
  update ricevute_compensi x set movimento_id = r.id, pagata_il = paga_compensi.data where x.id = any(ricevute);
  return r;
end $$;
revoke all on function paga_compensi(uuid[], date, uuid) from public, anon;
grant execute on function paga_compensi(uuid[], date, uuid) to authenticated;

-- Come nell'80, più il rifiuto della pagata.
create or replace function annulla_ricevuta_compenso(id uuid) returns ricevute_compensi language plpgsql security definer set search_path = public as $$
declare r ricevute_compensi;
begin
  if not e_staff() then raise exception 'Le ricevute dei compensi le annulla la segreteria' using errcode = '42501'; end if;
  if exists (select 1 from ricevute_compensi x where x.id = annulla_ricevuta_compenso.id and x.movimento_id is not null) then
    raise exception 'È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI' using errcode = '22023';
  end if;
  update ricevute_compensi x set annullata_il = now() where x.id = annulla_ricevuta_compenso.id and x.annullata_il is null returning * into r;
  if not found then raise exception 'Questa ricevuta non c''è o è già annullata' using errcode = '22023'; end if;
  return r;
end $$;
revoke all on function annulla_ricevuta_compenso(uuid) from public, anon;
grant execute on function annulla_ricevuta_compenso(uuid) to authenticated;

-- Il pagamento annullato in CONTABILITÀ: le sue ricevute tornano da pagare.
create or replace function compensi_tornano() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update ricevute_compensi set movimento_id = null, pagata_il = null where movimento_id = new.id;
  return new;
end $$;
revoke all on function compensi_tornano() from public, anon, authenticated;
drop trigger if exists compensi_tornano on movimenti;
create trigger compensi_tornano after update of annullato_il on movimenti
  for each row when (new.annullato_il is not null and old.annullato_il is null) execute function compensi_tornano();

notify pgrst, 'reload schema';
