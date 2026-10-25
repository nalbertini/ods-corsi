-- ODS Corsi · Satispay e Conto Corrente si gestiscono separati
-- Si lancia dopo 97-satispay-scarico.sql e 114-importazioni.sql, e si può rilanciare.
--
-- Un pagamento Satispay non è un incasso della banca: le quote scritte a mano in Conto Corrente con lo stesso
-- importo non sono doppioni da proporre (31/08/2026: un Satispay da 50 € contro 4 quote associative in banca).
--   · ogni pagamento dello scarico entra nella cassa Satispay, di qualunque data: non più Conto Corrente prima
--     del 1° ottobre 2026. La cassa Satispay parte dal 1° gennaio 2025, come le altre;
--   · i «forse già scritti a mano» sono solo le entrate a mano della cassa Satispay, nello scarico e in «Non è questo».
--   · i pagamenti già scritti dallo scarico in Conto Corrente restano lì (deciso dall'amministrazione): i saldi
--     passati non cambiano. Quelli collegati da soli a un movimento a mano del Conto Corrente si scollegano, e
--     tornano senza esito coi «forse doppione»: il prossimo scarico li rivaluta con la regola nuova.
-- `satispay_negozio_applica` e `satispay_scollega` sono quelle del 114, salvo i candidati.
-- La stessa regola, per la modalità prova, è in src/lib/satispayScarico.ts.
-- ---------------------------------------------------------------------------

update casse set dal = date '2025-01-01' where nome = 'Satispay';

-- La cassa dello scarico: Satispay, sempre. È `cassaSatispay` in src/lib/satispayScarico.ts.
create or replace function satispay_cassa(giorno date) returns casse
  language sql stable set search_path = public as $$
  select * from casse where nome = 'Satispay'
$$;

create or replace function satispay_negozio_applica(scrivi boolean) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p satispay_negozio;
  giorno date;
  ca casse;
  cand uuid[];
  conti jsonb := jsonb_build_object('incassi', 0, 'rimborsi', 0, 'modulo', 0, 'pagamenti', 0, 'a_mano', 0, 'da_decidere', 0, 'prima', 0, 'scritti', 0);
  piu text := null;
begin
  begin
    for p in select * from satispay_negozio where esito is null and stato = 'ACCEPTED'
        and (quando at time zone 'Europe/Rome')::date < contabilita_oggi() order by quando, satispay_id for update loop
      giorno := (p.quando at time zone 'Europe/Rome')::date;
      piu := null;
      ca := satispay_cassa(giorno);
      cand := null;
      if exists (select 1 from pagamenti_satispay s where s.satispay_id = p.satispay_id) then
        update satispay_negozio set esito = 'modulo' where satispay_id = p.satispay_id;
        piu := 'modulo';
      elsif ca.dal is not null and giorno < ca.dal then
        update satispay_negozio set esito = 'fuori', motivo = 'prima_della_cassa' where satispay_id = p.satispay_id;
        piu := 'prima';
      elsif p.tipo = 'TO_BUSINESS' and (
          -- Le righe di PAGAMENTI col metodo Satispay quel giorno con quell'importo, fuori dal modulo…
          (select count(*) from (
              select 1 from ricevute r, jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) x
              where r.annullata_il is null and lower(btrim(x->>'metodo')) = 'satispay'
                and coalesce((x->>'data')::date, r.data) = giorno and (x->>'importo')::int = p.importo
                and not exists (select 1 from pagamenti_satispay s where s.ricevuta_id = r.id)
              union all
              select 1 from pagamenti_diretti d
              where d.annullato_il is null and lower(btrim(d.metodo)) = 'satispay' and d.data = giorno and d.importo = p.importo
            ) righe)
          -- …meno quelle già prese da un altro pagamento.
          > (select count(*) from satispay_negozio n where n.esito = 'pagamenti' and n.importo = p.importo
              and (n.quando at time zone 'Europe/Rome')::date = giorno)) then
        update satispay_negozio set esito = 'pagamenti' where satispay_id = p.satispay_id;
        piu := 'pagamenti';
      else
        if p.tipo = 'TO_BUSINESS' then
          select array_agg(m.id order by m.creato_il) into cand from movimenti m
          where m.tipo = 'entrata' and m.annullato_il is null and m.satispay_id is null and m.banca_chiave is null and m.data = giorno
            and m.importo = p.importo and m.cassa_id = (select id from casse where nome = 'Satispay');
        end if;
        if cardinality(cand) = 1 then
          update movimenti set satispay_id = p.satispay_id where id = cand[1];
          update satispay_negozio set esito = 'a_mano', movimento_id = cand[1] where satispay_id = p.satispay_id;
          piu := 'a_mano';
        elsif cardinality(cand) > 1 then
          update satispay_negozio set esito = 'da_decidere', motivo = 'forse_doppione', candidati = cand where satispay_id = p.satispay_id;
          piu := 'da_decidere';
        elsif cassa_giorno_chiuso(ca.id, giorno) then
          update satispay_negozio set esito = 'da_decidere', motivo = 'giorno_chiuso' where satispay_id = p.satispay_id;
          piu := 'da_decidere';
        else
          update satispay_negozio set esito = 'scritto', movimento_id = satispay_scrivi(p, giorno, ca) where satispay_id = p.satispay_id;
          piu := case p.tipo when 'TO_BUSINESS' then 'incassi' else 'rimborsi' end;
          conti := jsonb_set(conti, '{scritti}', to_jsonb((conti->>'scritti')::int + 1));
        end if;
      end if;
      conti := jsonb_set(conti, array[piu], to_jsonb((conti->>piu)::int + 1));
    end loop;
    conti := conti || jsonb_build_object('dal', (select min((quando at time zone 'Europe/Rome')::date) from satispay_negozio));
    if scrivi then
      update satispay_scarico set primo_fatto = true where id;
    else
      -- L'anteprima fa gli stessi passi e poi li disfa tutti: i conti sono quelli che scriverebbe davvero.
      raise exception using errcode = 'P0099';
    end if;
  exception when sqlstate 'P0099' then
    null;
  end;
  return conti;
end $$;


create or replace function satispay_scollega(satispay_id text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  p satispay_negozio;
  m movimenti;
begin
  perform contabilita_porta();
  select * into p from satispay_negozio s where s.satispay_id = satispay_scollega.satispay_id for update;
  if not found then raise exception 'Il pagamento non c’è' using errcode = 'P0002'; end if;
  select * into m from movimenti x where x.id = p.movimento_id;
  if p.esito is distinct from 'a_mano' or m.id is null then
    raise exception 'Questo pagamento non è collegato a un movimento a mano' using errcode = '22023';
  end if;
  -- Come `satispay_decidi`: la chiusura che si sta facendo adesso aspetta.
  perform 1 from casse c where c.id = m.cassa_id for share;
  if cassa_giorno_chiuso(m.cassa_id, m.data) then
    raise exception 'Quel giorno la cassa è chiusa: il collegamento resta' using errcode = '22023';
  end if;
  update movimenti x set satispay_id = null where x.id = m.id;
  -- I candidati come in `satispay_negozio_applica`: il movimento appena scollegato torna fra loro.
  update satispay_negozio s set esito = 'da_decidere', motivo = 'forse_doppione', movimento_id = null,
    candidati = (select array_agg(x.id order by x.creato_il) from movimenti x
      where x.tipo = 'entrata' and x.annullato_il is null and x.satispay_id is null and x.banca_chiave is null
        and x.data = (p.quando at time zone 'Europe/Rome')::date and x.importo = p.importo
        and x.cassa_id = (select c.id from casse c where c.nome = 'Satispay'))
    where s.satispay_id = p.satispay_id;
end $$;

-- I pagamenti collegati o da decidere col Conto Corrente tornano allo scarico. Prima il movimento perde il segno,
-- poi il pagamento il suo esito: se no il collegamento si perde.
update movimenti m set satispay_id = null
from satispay_negozio n
where n.esito = 'a_mano' and n.movimento_id = m.id and m.satispay_id = n.satispay_id
  and m.cassa_id = (select c.id from casse c where c.nome = 'Conto Corrente');
update satispay_negozio n set esito = null, motivo = null, candidati = null, movimento_id = null
where (n.esito = 'a_mano' and not exists (select 1 from movimenti m where m.satispay_id = n.satispay_id))
   -- Solo i dubbi con un candidato fuori dalla cassa Satispay: un «Non è questo» deciso in Satispay resta deciso.
   or (n.esito = 'da_decidere' and n.motivo = 'forse_doppione' and exists (select 1 from movimenti m where m.id = any (n.candidati)
         and m.cassa_id is distinct from (select c.id from casse c where c.nome = 'Satispay')));

revoke all on function satispay_cassa(date) from public, anon, authenticated;
revoke all on function satispay_scollega(text) from public, anon;
grant execute on function satispay_scollega(text) to authenticated;
revoke all on function satispay_negozio_applica(boolean) from public, anon, authenticated;
grant execute on function satispay_negozio_applica(boolean) to service_role;
