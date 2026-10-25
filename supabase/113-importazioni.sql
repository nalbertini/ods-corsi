-- IMPORTAZIONI (I CONTI → IMPORTAZIONI): quel che arriva da Satispay e dalla banca, da decidere a gruppi e da
-- ricontrollare in «Cosa è entrato». Si lancia dopo 97-satispay-scarico.sql e 104-importa-banca.sql, e si può
-- rilanciare senza danni; non chiede di rilanciare 06-iscrizioni.sql. Tutto solo per l'amministrazione
-- (`contabilita_porta`), come lo scarico e l'import.
--
-- Satispay:
-- - `satispay_scarico_stato` non propone più i movimenti presi nel frattempo da un altro pagamento o annullati:
--   scegliendoli si arrivava all'errore «già di un altro pagamento».
-- - `satispay_decidi_gruppo(scelte)`: le scelte di un gruppo (`[{satispayId, scelta, movimentoId}]`) tutte o
--   nessuna, e un movimento a mano vale per un pagamento solo.
-- - `satispay_scollega(satispay_id)`, «Non è questo»: il movimento a mano perde il segno e il pagamento torna da
--   decidere coi candidati di oggi. Nei giorni chiusi no: quel collegamento è nei conti della chiusura.
--
-- Banca: i movimenti del file abbinati da soli a uno già scritto a mano non si scrivevano e non restavano da
-- nessuna parte. Ora stanno in `banca_coperti` e il movimento a mano prende la chiave in `banca_chiave` (li
-- scrive `banca_segna_coperti` dopo l'import, che ricontrolla l'abbinamento: se non regge, la riga entra nuova),
-- e `banca_non_e_questo(chiave)` li fa entrare come un import normale (Conto Corrente, «Da classificare»).
--
-- Un movimento a mano è di Satispay o della banca, mai di tutti e due (`banca_chiave`, vincolo
-- `movimenti_un_solo_segno`): se no lo stesso incasso coprirebbe due soldi arrivati, e uno sparirebbe dai conti.
-- Per questo `satispay_negozio_applica` è ridefinita qui, uguale alla 97 salvo i candidati.
--
-- Finché questo file non c'è, l'app dice che serve aggiornare il database e IMPORTAZIONI non decide i gruppi.

alter table movimenti add column if not exists banca_chiave text;
create unique index if not exists movimenti_banca_chiave on movimenti (banca_chiave) where banca_chiave is not null;
alter table movimenti drop constraint if exists movimenti_un_solo_segno;
alter table movimenti add constraint movimenti_un_solo_segno check (satispay_id is null or banca_chiave is null);

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
            and m.importo = p.importo and m.cassa_id in (select id from casse where nome in ('Conto Corrente', 'Satispay'));
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

create or replace function satispay_scarico_stato() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  perform contabilita_porta();
  return (select jsonb_build_object('primo_fatto', s.primo_fatto, 'ultimo', s.ultimo, 'errore', s.errore,
    'da_decidere', coalesce((select jsonb_agg(jsonb_build_object(
        'satispay_id', n.satispay_id, 'tipo', n.tipo, 'importo', n.importo, 'chi', n.chi, 'motivo', n.motivo,
        'data', (n.quando at time zone 'Europe/Rome')::date,
        'candidati', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'descrizione', m.descrizione,
            'voce', v.nome, 'cassa', c.nome, 'importo', m.importo) order by m.creato_il)
          from movimenti m join voci_contabili v on v.id = m.voce_id join casse c on c.id = m.cassa_id
          -- Un movimento preso da un altro pagamento o dalla banca, o annullato, non è più una scelta possibile.
          where m.id = any (n.candidati) and m.satispay_id is null and m.banca_chiave is null and m.annullato_il is null), '[]'::jsonb)) order by n.quando)
      from satispay_negozio n where n.esito = 'da_decidere'), '[]'::jsonb))
    from satispay_scarico s);
end $$;

create or replace function satispay_decidi_gruppo(scelte jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
  presi text[] := '{}';
begin
  perform contabilita_porta();
  if jsonb_typeof(scelte) is distinct from 'array' then raise exception 'Le scelte non si capiscono: ricarica la pagina' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(scelte) loop
    if x->>'scelta' = 'a_mano' and x->>'movimentoId' is not null then
      if x->>'movimentoId' = any (presi) then raise exception 'Lo stesso movimento è scelto per due pagamenti' using errcode = '22023'; end if;
      presi := presi || (x->>'movimentoId');
      -- Il vincolo lo fermerebbe lo stesso, ma con un errore che non dice cosa fare.
      if exists (select 1 from movimenti m where m.id = (x->>'movimentoId')::uuid and m.banca_chiave is not null) then
        raise exception 'Quel movimento è già coperto da un movimento della banca: ricarica la pagina' using errcode = '22023';
      end if;
    end if;
  end loop;
  -- Una funzione sola, una transazione sola: se una scelta lancia, anche quelle prima tornano indietro.
  for x in select * from jsonb_array_elements(scelte) loop
    perform satispay_decidi(x->>'satispayId', x->>'scelta', (x->>'movimentoId')::uuid);
  end loop;
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
        and x.cassa_id in (select c.id from casse c where c.nome in ('Conto Corrente', 'Satispay')))
    where s.satispay_id = p.satispay_id;
end $$;

create table if not exists banca_coperti (
  chiave text primary key,
  data date not null,
  tipo text not null check (tipo in ('entrata', 'uscita')),
  importo integer not null check (importo > 0),
  descrizione text not null,
  con_id uuid,
  con_descrizione text,
  creato_il timestamptz not null default now()
);
alter table banca_coperti enable row level security;
revoke all on banca_coperti from public, anon, authenticated;
grant select on banca_coperti to authenticated;
drop policy if exists banca_coperti_amministrazione on banca_coperti;
create policy banca_coperti_amministrazione on banca_coperti for select to authenticated using (e_amministrazione());

create or replace function banca_segna_coperti(righe jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
  k text;
begin
  perform contabilita_porta();
  if jsonb_typeof(righe) is distinct from 'array' then raise exception 'I movimenti già scritti non si capiscono' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(righe) loop
    k := x->>'chiave';
    if coalesce(k, '') !~ '^banca:' then raise exception 'Un movimento già scritto non ha la chiave della banca' using errcode = '22023'; end if;
    -- Rileggere lo stesso file non duplica: la chiave è quella dell'import.
    continue when exists (select 1 from banca_coperti b where b.chiave = k)
      or exists (select 1 from movimenti m where m.origine_import = k or m.banca_chiave = k);
    -- L'abbinamento lo fa l'app: qui si ricontrolla, perché un movimento copre una riga sola e mai anche Satispay.
    update movimenti m set banca_chiave = k
      where m.id = (x->>'conId')::uuid and m.tipo = x->>'tipo' and m.importo = (x->>'importo')::integer
        and m.cassa_id = (select c.id from casse c where c.nome = 'Conto Corrente')
        and m.annullato_il is null and m.satispay_id is null and m.banca_chiave is null;
    if found then
      insert into banca_coperti (chiave, data, tipo, importo, descrizione, con_id, con_descrizione)
        values (k, (x->>'data')::date, x->>'tipo', (x->>'importo')::integer, x->>'descrizione', (x->>'conId')::uuid, x->>'conDescrizione');
    else
      perform importa_prima_nota(jsonb_build_array(jsonb_build_object('chiave', k, 'data', x->>'data', 'cassa', 'conto',
        'tipo', x->>'tipo', 'importo', (x->>'importo')::integer, 'descrizione', x->>'descrizione', 'voce', 'Da classificare')));
    end if;
  end loop;
end $$;

create or replace function banca_non_e_questo(chiave text) returns void
  language plpgsql security definer set search_path = public as $$
declare r banca_coperti;
begin
  perform contabilita_porta();
  select * into r from banca_coperti b where b.chiave = banca_non_e_questo.chiave for update;
  if not found then raise exception 'Questo movimento non è fra quelli già scritti' using errcode = '22023'; end if;
  perform 1 from casse c where c.nome = 'Conto Corrente' for share;
  if cassa_giorno_chiuso((select c.id from casse c where c.nome = 'Conto Corrente'), r.data) then
    raise exception 'Quel giorno la cassa è chiusa: il collegamento resta' using errcode = '22023';
  end if;
  update movimenti m set banca_chiave = null where m.banca_chiave = r.chiave;
  perform importa_prima_nota(jsonb_build_array(jsonb_build_object('chiave', r.chiave, 'data', r.data, 'cassa', 'conto',
    'tipo', r.tipo, 'importo', r.importo, 'descrizione', r.descrizione, 'voce', 'Da classificare')));
  delete from banca_coperti b where b.chiave = r.chiave;
end $$;

revoke all on function satispay_decidi_gruppo(jsonb), satispay_scollega(text), banca_segna_coperti(jsonb), banca_non_e_questo(text) from public, anon;
grant execute on function satispay_decidi_gruppo(jsonb), satispay_scollega(text), banca_segna_coperti(jsonb), banca_non_e_questo(text) to authenticated;

revoke all on function satispay_negozio_applica(boolean) from public, anon, authenticated;
grant execute on function satispay_negozio_applica(boolean) to service_role;

notify pgrst, 'reload schema';
