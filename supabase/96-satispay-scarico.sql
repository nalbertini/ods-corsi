-- ODS Corsi · i pagamenti Satispay del negozio entrano da soli in CONTABILITÀ
-- Si lancia dopo 60-chiusura-cassa.sql, 63-importa-prima-nota.sql e 73-satispay.sql, e si può rilanciare.
--
-- La Edge Function `satispay-scarico` legge l'elenco dei pagamenti da Satispay e lo copia così com'è in
-- `satispay_negozio` (`satispay_negozio_salva`); le regole stanno tutte qui, in `satispay_negozio_applica`.
-- Così, se un giorno l'elenco si legge da un'altra parte (i report di Satispay), cambia solo la funzione.
--
-- Le regole, per ogni pagamento non ancora deciso, dal più vecchio:
--   · conta solo ACCEPTED: uno in attesa si riguarda al giro dopo;
--   · si guarda solo fino a ieri: oggi la palestra può ancora scriverlo in PAGAMENTI;
--   · uno del modulo di iscrizione (stesso id in `pagamenti_satispay`) è già in PAGAMENTI o in una ricevuta: niente;
--   · un incasso con una riga di PAGAMENTI col metodo Satispay (stesso giorno e importo, non del modulo) è stato
--     fatto in palestra col QR, ed entra già da lì: niente. Le righe uguali sono intercambiabili, ognuna vale una volta;
--   · un incasso con un solo movimento a mano uguale (entrata, stesso giorno e importo, Conto Corrente o Satispay)
--     era già scritto: resta quello a mano, che prende il segno (`movimenti.satispay_id`); con due o più resta
--     da decidere;
--   · la cassa è Satispay dal 1° ottobre 2026, prima Conto Corrente (come si faceva a mano): i saldi passati non
--     cambiano. Prima dell'inizio della cassa non entra. In un giorno chiuso resta da decidere;
--   · se no un movimento nuovo su «Da classificare», entrata o uscita per un rimborso.
-- Il segno vale anche da annullato: lo stesso pagamento non torna. La stessa regola, per la modalità prova, è
-- `applicaScarico` in src/lib/satispayScarico.ts. Le prove: supabase/prova/satispay-scarico.sql.
-- ---------------------------------------------------------------------------

-- Dal 1° ottobre 2026 Satispay è una cassa a sé: il versamento in banca diventa un giroconto, con la commissione.
insert into casse (nome, dal) values ('Satispay', date '2026-10-01') on conflict do nothing;
insert into voci_contabili (nome, tipo) values
  ('Da classificare', 'entrata'), ('Da classificare', 'uscita'), ('Commissioni bancarie', 'uscita')
on conflict do nothing;

alter table movimenti add column if not exists satispay_id text;
create unique index if not exists movimenti_satispay on movimenti (satispay_id) where satispay_id is not null;

-- I pagamenti come li dà Satispay, e cosa ne è stato.
create table if not exists satispay_negozio (
  satispay_id  text primary key,
  tipo         text not null check (tipo in ('TO_BUSINESS', 'REFUND_TO_BUSINESS')),
  stato        text not null,
  importo      int not null check (importo > 0),
  quando       timestamptz not null,
  chi          text check (char_length(chi) <= 80),
  esito        text check (esito in ('scritto', 'modulo', 'pagamenti', 'a_mano', 'da_decidere', 'fuori')),
  motivo       text check (motivo in ('giorno_chiuso', 'forse_doppione', 'prima_della_cassa')),
  candidati    uuid[],
  movimento_id uuid references movimenti
);

-- Una riga sola: a che punto è lo scarico.
create table if not exists satispay_scarico (
  id              boolean primary key default true check (id),
  primo_fatto     boolean not null default false,
  ultimo          timestamptz,
  errore          text,
  -- L'id dell'ultimo pagamento salvato dello storico: uno scarico interrotto riparte da lì.
  ripresa         text,
  storia_completa boolean not null default false
);
insert into satispay_scarico default values on conflict do nothing;
-- Per chi l'ha già lanciato: il check di prima non conosceva 'pagamenti'.
alter table satispay_negozio drop constraint if exists satispay_negozio_esito_check;
alter table satispay_negozio add constraint satispay_negozio_esito_check
  check (esito in ('scritto', 'modulo', 'pagamenti', 'a_mano', 'da_decidere', 'fuori'));

alter table satispay_negozio enable row level security;
alter table satispay_scarico enable row level security;
revoke all on satispay_negozio, satispay_scarico from public, anon, authenticated, service_role;
grant select on satispay_negozio, satispay_scarico to authenticated;
-- La Edge Function legge a che punto è prima di scaricare; scrive solo dalle funzioni.
grant select on satispay_scarico to service_role;
drop policy if exists satispay_negozio_legge on satispay_negozio;
create policy satispay_negozio_legge on satispay_negozio for select to authenticated using (e_amministrazione());
drop policy if exists satispay_scarico_legge on satispay_scarico;
create policy satispay_scarico_legge on satispay_scarico for select to authenticated using (e_amministrazione());

-- La cassa di un giorno: Satispay dal cambio, prima Conto Corrente. È `cassaSatispay` in src/lib/satispayScarico.ts.
create or replace function satispay_cassa(giorno date) returns casse
  language sql stable set search_path = public as $$
  select * from casse where nome = case when giorno >= date '2026-10-01' then 'Satispay' else 'Conto Corrente' end
$$;

-- Il movimento nuovo di un pagamento, nel giorno e nella cassa date; `chi` è chi l'ha deciso (lo scarico di notte: nessuno).
drop function if exists satispay_scrivi(satispay_negozio, date, casse);
create or replace function satispay_scrivi(p satispay_negozio, giorno date, ca casse, chi uuid default null) returns uuid
  language plpgsql set search_path = public as $$
declare
  t text := case p.tipo when 'TO_BUSINESS' then 'entrata' else 'uscita' end;
  voce uuid;
  m uuid;
begin
  select id into voce from voci_contabili v where v.tipo = t and lower(trim(v.nome)) = 'da classificare';
  -- La voce non è di sistema (la chat la usa): se qualcuno la rinomina lo scarico si ferma e lo dice.
  if voce is null then
    raise exception 'Manca la voce «Da classificare» di %: rimettila in CONTABILITÀ → VOCI', t using errcode = 'P0001';
  end if;
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, satispay_id, creato_da)
  values (t, giorno, p.importo, voce, ca.id,
    case t when 'entrata' then 'Satispay' else 'Rimborso Satispay' end || coalesce(' · ' || nullif(trim(p.chi), ''), ''),
    p.satispay_id, chi)
  returning id into m;
  return m;
end $$;

create or replace function satispay_negozio_salva(pagamenti jsonb) returns int
  language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
  quanti int := 0;
  n int;
begin
  if jsonb_typeof(pagamenti) <> 'array' then raise exception 'pagamenti: serve una lista' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(pagamenti) loop
    -- Un tipo che non conosciamo (un domani Satispay ne aggiunge) non entra: non si sa di che segno sia.
    continue when coalesce(x->>'id', '') = '' or x->>'type' not in ('TO_BUSINESS', 'REFUND_TO_BUSINESS')
      or coalesce((x->>'amount_unit')::int, 0) <= 0;
    insert into satispay_negozio as s (satispay_id, tipo, stato, importo, quando, chi)
    values (x->>'id', x->>'type', coalesce(x->>'status', ''), (x->>'amount_unit')::int, (x->>'insert_date')::timestamptz,
      left(x->'sender'->>'name', 80))
    on conflict (satispay_id) do update set stato = excluded.stato, importo = excluded.importo, quando = excluded.quando
      -- Uno già deciso non cambia più: il movimento è quello.
      where s.esito is null and (s.stato, s.importo, s.quando) is distinct from (excluded.stato, excluded.importo, excluded.quando);
    get diagnostics n = row_count;
    quanti := quanti + n;
  end loop;
  return quanti;
end $$;

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
          where m.tipo = 'entrata' and m.annullato_il is null and m.satispay_id is null and m.data = giorno
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
      update satispay_scarico set primo_fatto = true;
    else
      -- L'anteprima fa gli stessi passi e poi li disfa tutti: i conti sono quelli che scriverebbe davvero.
      raise exception using errcode = 'P0099';
    end if;
  exception when sqlstate 'P0099' then
    null;
  end;
  return conti;
end $$;

create or replace function satispay_decidi(satispay_id text, scelta text, movimento uuid default null) returns void
  language plpgsql security definer set search_path = public as $$
declare
  p satispay_negozio;
  giorno date;
  ca casse;
begin
  perform contabilita_porta();
  select * into p from satispay_negozio s where s.satispay_id = satispay_decidi.satispay_id for update;
  if not found then raise exception 'Il pagamento non c’è' using errcode = 'P0002'; end if;
  if p.esito is distinct from 'da_decidere' then raise exception 'Questo pagamento è già deciso' using errcode = '22023'; end if;
  if scelta = 'fuori' then
    update satispay_negozio s set esito = 'fuori' where s.satispay_id = p.satispay_id;
  elsif scelta = 'a_mano' then
    if movimento is null or not (movimento = any (coalesce(p.candidati, '{}'))) then
      raise exception 'Scegli uno dei movimenti proposti' using errcode = '22023';
    end if;
    update movimenti m set satispay_id = p.satispay_id where m.id = movimento and m.satispay_id is null and m.annullato_il is null;
    if not found then raise exception 'Quel movimento non c’è più o è già di un altro pagamento: ricarica la pagina' using errcode = '22023'; end if;
    update satispay_negozio s set esito = 'a_mano', movimento_id = movimento where s.satispay_id = p.satispay_id;
  elsif scelta in ('oggi', 'scrivi') then
    giorno := case scelta when 'oggi' then contabilita_oggi() else (p.quando at time zone 'Europe/Rome')::date end;
    ca := satispay_cassa(giorno);
    perform 1 from casse c where c.id = ca.id for share;
    if ca.dal is not null and giorno < ca.dal then
      raise exception 'Quel giorno la cassa non c’era ancora: scrivilo oggi' using errcode = '22023';
    end if;
    if cassa_giorno_chiuso(ca.id, giorno) then
      raise exception 'Quel giorno la cassa è chiusa: scrivilo oggi' using errcode = '22023';
    end if;
    update satispay_negozio s set esito = 'scritto', movimento_id = satispay_scrivi(p, giorno, ca, persona_corrente()) where s.satispay_id = p.satispay_id;
  else
    raise exception 'Scegli cosa fare del pagamento' using errcode = '22023';
  end if;
end $$;

-- Per la striscia in MOVIMENTI: quando ha girato, se c'è un guaio, e i pagamenti da decidere coi movimenti proposti.
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
          where m.id = any (n.candidati)), '[]'::jsonb)) order by n.quando)
      from satispay_negozio n where n.esito = 'da_decidere'), '[]'::jsonb))
    from satispay_scarico s);
end $$;

create or replace function satispay_scarico_segna(errore text) returns void
  language sql security definer set search_path = public as $$
  update satispay_scarico set ultimo = now(), errore = satispay_scarico_segna.errore
$$;

create or replace function satispay_scarico_ripresa(ripresa text, completa boolean) returns void
  language sql security definer set search_path = public as $$
  update satispay_scarico set ripresa = satispay_scarico_ripresa.ripresa, storia_completa = completa
$$;

revoke all on function satispay_cassa(date), satispay_scrivi(satispay_negozio, date, casse, uuid) from public, anon, authenticated;
revoke all on function satispay_negozio_salva(jsonb), satispay_negozio_applica(boolean), satispay_scarico_segna(text),
  satispay_scarico_ripresa(text, boolean) from public, anon, authenticated;
grant execute on function satispay_negozio_salva(jsonb), satispay_negozio_applica(boolean), satispay_scarico_segna(text),
  satispay_scarico_ripresa(text, boolean) to service_role;
revoke all on function satispay_decidi(text, text, uuid), satispay_scarico_stato() from public, anon;
grant execute on function satispay_decidi(text, text, uuid), satispay_scarico_stato() to authenticated;

-- Ogni notte alle 3:10 pg_cron chiama la Edge Function con pg_net; finché il primo scarico non è fatto non scrive
-- niente. Senza pg_cron (o su un Postgres di prova) il file si lancia lo stesso, e lo scarico parte da «Scarica ora».
-- La funzione è aperta (`--no-verify-jwt`): la notte si riconosce dal segreto `satispay_scarico_segreto` nel Vault,
-- lo stesso di SATISPAY_SCARICO_SEGRETO nei secret delle funzioni (supabase/LEGGIMI.md). Senza, risponde 403.
do $$
begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'satispay-scarico';
  -- 3:10 a Roma: pg_cron conta in UTC, e d'estate sarebbe un'ora dopo; basta che sia di notte.
  perform cron.schedule('satispay-scarico', '10 2 * * *',
    $c$select net.http_post(url := 'https://qfejpnkryrvjubcxvuco.supabase.co/functions/v1/satispay-scarico', body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-scarico',
        (select decrypted_secret from vault.decrypted_secrets where name = 'satispay_scarico_segreto')))$c$);
exception when others then
  raise notice 'pg_cron o pg_net non ci sono: lo scarico Satispay si fa da «Scarica ora»';
end $$;

notify pgrst, 'reload schema';
