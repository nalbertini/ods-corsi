-- ---------------------------------------------------------------------------
-- ODS Corsi · gli avvisi alla segreteria
--
-- Quando arriva una richiesta di iscrizione o un pagamento Satispay, parte
-- un'email alla segreteria (vedi «Gli avvisi alla segreteria» in LEGGIMI).
-- Il database decide cosa avvisare e quando; la Edge Function
-- `avvisi-segreteria` scrive la mail e la manda, chiamata da pg_cron ogni
-- cinque minuti (con pg_net). Gli avvisi:
--   · una richiesta: un avviso per invio (la famiglia mandata insieme è uno,
--     `richieste_iscrizione.invio`), cinque minuti dopo l'ultima arrivata,
--     così le altre della famiglia e la ricevuta del bonifico ci sono già;
--   · un pagamento Satispay arrivato dopo l'avviso della sua richiesta;
--   · un pagamento Satispay senza richiesta, dopo un'ora;
--   · uno scarico Satispay in CONTABILITÀ con qualcosa da dire (lo mette
--     `satispay_scarico_avvisa` di 97-satispay-scarico.sql, coi conti in `dati`).
-- Mai due volte (`chiave` unica; la Edge Function prende ogni avviso con
-- `avviso_preso` prima di mandarlo), mai quel che è arrivato prima di
-- `avvisi_indirizzi.dal` (che riparte quando si mette l'indirizzo), al più 50
-- al giorno (quelli in più sono segnati `non_mandato = 'tetto'` e li conta
-- RICHIESTE ONLINE, con quelli che la posta rifiuta dodici volte, `guasto`).
-- Un avviso che non ha più niente da dire (richieste eliminate) si chiude
-- `vuoto`. Nell'avviso solo nomi, corsi e importi: mai note, codice fiscale,
-- nascita, file.
--
-- Chi può cosa: `avvisi_indirizzi` (a chi va, in copia a chi) la legge e la
-- cambia solo la segreteria (`e_staff()`); `avvisi_segreteria`, il registro,
-- nessuno da fuori. `avvisi_da_mandare()` e `avviso_mandato(id)` solo
-- `service_role`, cioè la Edge Function, come `avviso_preso(id)`; `avvisi_non_mandati_oggi()` solo la
-- segreteria. `invia_iscrizione` resta per `anon`.
--
-- Si lancia dopo `83-satispay-prima.sql`, e non chiede di rilanciare
-- `06-iscrizioni.sql`. Rilanciare `06`, `74` o `83` rimette una
-- `invia_iscrizione` che ignora la chiave `invio`: dopo va rilanciato anche
-- questo (`controllo.sql` lo dice). Finché il file non c'è, l'app mostra gli
-- avvisi spenti e la funzione non manda niente.
-- ---------------------------------------------------------------------------

alter table richieste_iscrizione add column if not exists invio uuid;

-- A chi vanno gli avvisi: una riga. Senza `a` sono spenti. `dal` la mette il file la prima volta: niente arretrati.
create table if not exists avvisi_indirizzi (
  id  boolean primary key default true check (id),
  a   text check (a ~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$'),
  cc  text check (cc ~ '^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$'),
  dal timestamptz not null default now()
);
insert into avvisi_indirizzi (cc) values ('asdilcentrojudo@gmail.com') on conflict do nothing;

alter table avvisi_indirizzi enable row level security;
revoke all on avvisi_indirizzi from anon, authenticated;
grant select, update (a, cc) on avvisi_indirizzi to authenticated;
drop policy if exists avvisi_indirizzi_legge on avvisi_indirizzi;
drop policy if exists avvisi_indirizzi_cambia on avvisi_indirizzi;
create policy avvisi_indirizzi_legge on avvisi_indirizzi for select to authenticated using (e_staff());
create policy avvisi_indirizzi_cambia on avvisi_indirizzi for update to authenticated using (e_staff()) with check (e_staff());

-- Messo l'indirizzo dove non c'era (la prima volta, o riaccesi): gli avvisi partono da adesso, niente arretrati.
create or replace function avvisi_riaccesi() returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if old.a is null and new.a is not null then new.dal := now(); end if;
  return new;
end $$;
create or replace trigger avvisi_riaccesi before update on avvisi_indirizzi for each row execute function avvisi_riaccesi();

-- Il registro: un avviso per riga, solo i riferimenti. Il testo si fa quando parte, dai dati di quel momento.
create table if not exists avvisi_segreteria (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,
  chiave       text not null unique,
  richieste    uuid[] not null default '{}',
  pagamento_id uuid,
  creato_il    timestamptz not null default now(),
  mandato_il   timestamptz,
  -- Quante volte la Edge Function l'ha preso (`avviso_preso`), e quando l'ultima: la posta che non risponde.
  tentativi    int not null default 0,
  preso_il     timestamptz,
  non_mandato  text,
  -- Quel che l'avviso dice quando non c'è un dato vivo da cui rifarlo: i conti di uno scarico Satispay.
  dati         jsonb
);
alter table avvisi_segreteria add column if not exists preso_il timestamptz;
alter table avvisi_segreteria add column if not exists dati jsonb;
alter table avvisi_segreteria drop constraint if exists avvisi_segreteria_tipo_check;
alter table avvisi_segreteria add constraint avvisi_segreteria_tipo_check
  check (tipo in ('richiesta', 'pagamento', 'pagamento_senza_richiesta', 'satispay_scarico'));
alter table avvisi_segreteria drop constraint if exists avvisi_segreteria_non_mandato_check;
alter table avvisi_segreteria add constraint avvisi_segreteria_non_mandato_check check (non_mandato in ('tetto', 'vuoto', 'guasto'));
alter table avvisi_segreteria enable row level security;
revoke all on avvisi_segreteria from anon, authenticated;

-- Il testo dell'avviso, dai dati di adesso; null se non c'è più niente da dire (richieste eliminate).
create or replace function avviso_da_registro(v avvisi_segreteria) returns jsonb
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  l jsonb := (select listino from impostazioni limit 1);
  persone jsonb;
  pagamento jsonb;
  r richieste_iscrizione;
  p pagamenti_satispay;
begin
  -- Lo scarico Satispay (`satispay_scarico_avvisa`, 97-satispay-scarico.sql): i conti sono quelli di quel giro.
  if v.tipo = 'satispay_scarico' then
    return jsonb_build_object('tipo', 'satispay_scarico', 'quando', v.creato_il,
      'incassi', coalesce((v.dati->>'incassi')::int, 0), 'rimborsi', coalesce((v.dati->>'rimborsi')::int, 0),
      'daDecidere', coalesce((v.dati->>'da_decidere')::int, 0), 'errore', v.dati->>'errore');
  end if;
  if v.tipo = 'richiesta' then
    select jsonb_agg(jsonb_build_object(
             'richiestaId', x.id, 'nome', x.nome, 'cognome', x.cognome,
             'corsi', coalesce((select jsonb_agg(c.nome order by c.nome) from corsi c where c.id = any(x.corsi)), '[]'::jsonb),
             -- Gli anni di nascita del listino (`natiDal`, `natiAl`) coi sei mesi di tolleranza, come `fuoriEta` di
             -- src/lib/listino.ts: la voce per id, o per nome se non ne ha. Un anno scritto male non conta.
             'fuoriEta', coalesce((select jsonb_agg(c.nome order by c.nome) from corsi c
                                     join jsonb_array_elements(coalesce(l->'corsi', '[]'::jsonb)) e
                                       on e->>'corsoId' = c.id::text or (coalesce(e->>'corsoId', '') = '' and lower(btrim(e->>'corso')) = lower(btrim(c.nome)))
                                    where c.id = any(x.corsi)
                                      and (extract(year from x.nato_il) * 12 + extract(month from x.nato_il) - 1
                                             < case when e->>'natiDal' ~ '^\d{4}$' then (e->>'natiDal')::int * 12 - 6 end
                                        or extract(year from x.nato_il) * 12 + extract(month from x.nato_il) - 1
                                             > case when e->>'natiAl' ~ '^\d{4}$' then (e->>'natiAl')::int * 12 + 11 + 6 end)),
                                  '[]'::jsonb))
             order by x.creata_il, x.id)
      into persone from richieste_iscrizione x where x.id = any(v.richieste);
    if persone is null then return null; end if;
    select jsonb_build_object('come', 'satispay', 'importo', sum(s.importo), 'pagatoIl', max(s.pagato_il))
      into pagamento from pagamenti_satispay s where s.richiesta_id = any(v.richieste) and s.stato = 'pagato' having count(*) > 0;
    -- Il bonifico: c'è la ricevuta caricata o no. Il nome del file non esce.
    pagamento := coalesce(pagamento, jsonb_build_object('come', 'bonifico', 'ricevuta',
      exists (select 1 from storage.objects o where o.bucket_id = 'iscrizioni'
                and split_part(o.name, '/', 1) = any(select x::text from unnest(v.richieste) x) and split_part(o.name, '/', 2) like 'ricevuta.%')));
    return jsonb_build_object('tipo', 'richiesta', 'persone', persone, 'pagamento', pagamento,
      'arrivataIl', (select min(x.creata_il) from richieste_iscrizione x where x.id = any(v.richieste)));
  end if;
  select * into p from pagamenti_satispay s where s.id = v.pagamento_id;
  if p.id is null then return null; end if;
  if v.tipo = 'pagamento' then
    select * into r from richieste_iscrizione x where x.id = p.richiesta_id;
    if r.id is null then return null; end if;
    return jsonb_build_object('tipo', 'pagamento', 'richiestaId', r.id, 'nome', r.nome, 'cognome', r.cognome,
      'corso', (select string_agg(c.nome, ', ' order by c.nome) from corsi c where c.id = any(r.corsi)),
      'importo', p.importo, 'pagatoIl', p.pagato_il, 'arrivataIl', r.creata_il);
  end if;
  return jsonb_build_object('tipo', 'pagamento_senza_richiesta', 'nome', p.nome, 'cognome', p.cognome, 'email', p.email,
    'corso', (select c.nome from corsi c where c.id = p.corso_id), 'importo', p.importo, 'pagatoIl', p.pagato_il);
end $$;

-- Gli avvisi da mandare adesso: prima scrive nel registro quelli nuovi, poi dà quelli non ancora partiti.
-- Chiamata di nuovo ridà gli stessi finché `avviso_mandato` non li segna: se la funzione cade, niente si perde.
create or replace function avvisi_da_mandare() returns table (id uuid, a text, cc text, avviso jsonb)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  ind avvisi_indirizzi;
  c record;
  contati int;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into ind from avvisi_indirizzi limit 1;
  if ind.a is null then return; end if;
  -- Due chiamate insieme non contano il tetto ognuna per sé.
  perform pg_advisory_xact_lock(hashtext('avvisi_da_mandare'));
  for c in
    -- Solo quelle che nessun avviso ha ancora: chi della famiglia arriva dopo (un «riprova») ne ha uno suo.
    select 'richiesta' as tipo, 'richiesta:' || (array_agg(x.id order by x.creata_il, x.id))[1] as chiave,
           array_agg(x.id order by x.creata_il, x.id) as richieste, null::uuid as pagamento
      from richieste_iscrizione x
     where x.creata_il >= ind.dal and x.stato <> 'rifiutata'
       and not exists (select 1 from avvisi_segreteria v where v.tipo = 'richiesta' and x.id = any(v.richieste))
     group by coalesce(x.invio, x.id)
    having max(x.creata_il) <= now() - interval '5 minutes'
    union all
    -- Pagato dopo l'avviso della sua richiesta: quello prima di pagare diceva «da pagare».
    select 'pagamento', 'pagamento:' || s.id, array[s.richiesta_id], s.id
      from pagamenti_satispay s
     where s.stato = 'pagato' and s.richiesta_id is not null and s.pagato_il >= ind.dal
       and exists (select 1 from avvisi_segreteria v where v.tipo = 'richiesta' and s.richiesta_id = any(v.richieste) and v.creato_il < s.pagato_il)
    union all
    -- Pagato in fondo al modulo e la richiesta non è arrivata: soldi da restituire o persona da chiamare.
    select 'pagamento_senza_richiesta', 'senza-richiesta:' || s.id, '{}'::uuid[], s.id
      from pagamenti_satispay s
     where s.stato = 'pagato' and s.richiesta_id is null and s.preso_il is null
       and s.pagato_il >= ind.dal and s.pagato_il <= now() - interval '1 hour'
  loop
    continue when exists (select 1 from avvisi_segreteria v where v.chiave = c.chiave);
    -- Il tetto: mandati oggi più quelli di oggi in coda.
    select count(*) into contati from avvisi_segreteria v
     where v.non_mandato is null and (coalesce(v.mandato_il, v.creato_il) at time zone 'Europe/Rome')::date = oggi;
    insert into avvisi_segreteria (tipo, chiave, richieste, pagamento_id, non_mandato)
      values (c.tipo, c.chiave, c.richieste, c.pagamento, case when contati >= 50 then 'tetto' end);
  end loop;
  -- Niente più da dire (le richieste eliminate prima di partire): si chiude, e non pesa sul tetto.
  update avvisi_segreteria v set non_mandato = 'vuoto' where v.mandato_il is null and v.non_mandato is null and avviso_da_registro(v) is null;
  return query
    select v.id, ind.a, ind.cc, x.avviso
      from avvisi_segreteria v, lateral (select avviso_da_registro(v) as avviso) x
     where v.mandato_il is null and v.non_mandato is null and x.avviso is not null
     order by v.creato_il, v.id;
end $$;

-- La Edge Function prende l'avviso prima di mandarlo: vero solo a chi lo prende. Un'altra chiamata nei dieci minuti
-- dopo non lo riprende (niente mail doppie); dopo, se non è partito, sì. Dodici volte senza partire: chiuso `guasto`.
create or replace function avviso_preso(avviso uuid) returns boolean
  language plpgsql security definer set search_path = public, extensions as $$
declare
  n int;
begin
  update avvisi_segreteria set non_mandato = 'guasto'
   where id = avviso and mandato_il is null and non_mandato is null and tentativi >= 12;
  update avvisi_segreteria set preso_il = now(), tentativi = tentativi + 1
   where id = avviso and mandato_il is null and non_mandato is null and (preso_il is null or preso_il < now() - interval '10 minutes');
  get diagnostics n = row_count;
  return n = 1;
end $$;

create or replace function avviso_mandato(avviso uuid) returns void
  language sql security definer set search_path = public, extensions as $$
  update avvisi_segreteria set mandato_il = now() where id = avviso and mandato_il is null
$$;

-- Per RICHIESTE ONLINE: quanti avvisi di oggi non sono partiti (il tetto, o la posta che li rifiuta).
create or replace function avvisi_non_mandati_oggi() returns int
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  return (select count(*) from avvisi_segreteria
           where non_mandato in ('tetto', 'guasto') and (creato_il at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date);
end $$;

-- La richiesta: quella di `83-satispay-prima.sql`, con la chiave dell'invio in più.
create or replace function invia_iscrizione(dati jsonb)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  regole jsonb := iscrizioni_regole();
  t text := '';
  nato date;
  minore boolean;
  scelti uuid[];
  mail citext := lower(trim(dati->>'email'));
  nuova uuid;
  cf text := upper(regexp_replace(coalesce(dati->>'codice_fiscale', ''), '\s', '', 'g'));
  cf_gen text := nullif(upper(regexp_replace(coalesce(dati->>'genitore_codice_fiscale', ''), '\s', '', 'g')), '');
  tel_2 text := nullif(trim(coalesce(dati->>'telefono_2', '')), '');
  testo text;
  -- Il pagamento Satispay fatto prima, in fondo al modulo (83-satispay-prima.sql): la richiesta lo prende con sé.
  pagato uuid;
  p pagamenti_satispay;
  -- Le richieste mandate insieme dallo stesso modulo (una famiglia): un avviso solo alla segreteria.
  inv uuid;
begin
  -- I campi di testo obbligatori, detti per nome se mancano.
  foreach testo in array array['nome:nome', 'cognome:cognome', 'nato_il:data di nascita', 'nato_a:luogo di nascita',
                               'codice_fiscale:codice fiscale', 'indirizzo:indirizzo', 'cap:CAP',
                               'comune:comune', 'email:email', 'telefono:telefono', 'formula:formula di pagamento'] loop
    if coalesce(trim(dati->>split_part(testo, ':', 1)), '') = '' then t := t || split_part(testo, ':', 2) || ', '; end if;
  end loop;
  if t <> '' then raise exception 'Mancano: %', rtrim(t, ', ') using errcode = '22023'; end if;

  begin
    nato := (dati->>'nato_il')::date;
  exception when others then
    raise exception 'La data di nascita non si capisce' using errcode = '22023';
  end;
  if nato is null or nato > current_date or nato < current_date - interval '100 years' then
    raise exception 'La data di nascita non torna' using errcode = '22023';
  end if;
  minore := nato > current_date - interval '18 years';
  if minore and (coalesce(trim(dati->>'genitore_nome'), '') = '' or coalesce(trim(dati->>'genitore_cognome'), '') = '' or cf_gen is null) then
    raise exception 'Per un minore servono nome, cognome e codice fiscale del genitore' using errcode = '22023';
  end if;
  if concat(dati->>'nome', dati->>'cognome', case when minore then concat(dati->>'genitore_nome', dati->>'genitore_cognome') end) ~ '[0-9]' then
    raise exception 'Un campo non va: nome e cognome non hanno numeri' using errcode = '22023';
  end if;

  -- Il codice fiscale: scritto giusto, e di chi deve essere.
  if cf !~ '^[A-Z0-9]{16}$' then
    raise exception 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri' using errcode = '22023';
  end if;
  if not cf_valido(cf) then
    raise exception 'Il codice fiscale non torna: controlla di averlo copiato giusto' using errcode = '22023';
  end if;
  if to_char(cf_nato_il(cf), 'YYMMDD') is distinct from to_char(nato, 'YYMMDD') then
    raise exception 'Il codice fiscale e la data di nascita non dicono lo stesso giorno: controlla l’uno e l’altra' using errcode = '22023';
  end if;
  if substr(cf, 1, 6) <> cf_lettere(dati->>'nome', dati->>'cognome') then
    raise exception 'Il codice fiscale non torna con nome e cognome: scrivili tutti, come sul documento' using errcode = '22023';
  end if;
  if minore then
    if cf_gen !~ '^[A-Z0-9]{16}$' then
      raise exception 'Un campo non va: il codice fiscale ha 16 caratteri, lettere e numeri' using errcode = '22023';
    end if;
    if not cf_valido(cf_gen) then
      raise exception 'Il codice fiscale del genitore non torna: controlla di averlo copiato giusto' using errcode = '22023';
    end if;
    if cf_gen = cf then
      raise exception 'Il codice fiscale del genitore è lo stesso di chi si iscrive' using errcode = '22023';
    end if;
    if cf_nato_il(cf_gen) > current_date - interval '18 years' then
      raise exception 'Il codice fiscale del genitore è di un minorenne' using errcode = '22023';
    end if;
    if substr(cf_gen, 1, 6) <> cf_lettere(dati->>'genitore_nome', dati->>'genitore_cognome') then
      raise exception 'Il codice fiscale del genitore non torna con il suo nome e cognome: scrivili tutti, come sul documento' using errcode = '22023';
    end if;
  end if;

  begin
    select array_agg(distinct x::uuid) into scelti from jsonb_array_elements_text(coalesce(dati->'corsi', '[]')) x;
  exception when others then
    raise exception 'I corsi scelti non si capiscono' using errcode = '22023';
  end;
  if scelti is null then raise exception 'Scegli almeno un corso' using errcode = '22023'; end if;
  if cardinality(scelti) > 6 then
    raise exception 'Un campo non va: si possono scegliere al massimo sei corsi' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(scelti) s where not exists (select 1 from corsi c where c.id = s and c.attivo)) then
    raise exception 'Uno dei corsi scelti non c''è più: ricarica la pagina' using errcode = '22023';
  end if;

  -- Gli altri campi, nell'ordine del modulo. I vincoli della tabella dicono
  -- le stesse cose, ma qui l'ordine è quello del browser.
  if trim(dati->>'cap') !~ '^[0-9]{5}$' then
    raise exception 'Un campo non va: il CAP ha 5 cifre' using errcode = '22023';
  end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Un campo non va: l''email non sembra giusta' using errcode = '22023';
  end if;
  if trim(dati->>'telefono') !~ '^\+?[0-9 ./()-]+$' or length(regexp_replace(dati->>'telefono', '\D', '', 'g')) not between 6 and 15 then
    raise exception 'Un campo non va: il telefono non sembra giusto' using errcode = '22023';
  end if;
  if tel_2 is not null and (tel_2 !~ '^\+?[0-9 ./()-]+$' or length(regexp_replace(tel_2, '\D', '', 'g')) not between 6 and 15) then
    raise exception 'Un campo non va: il secondo telefono non sembra giusto' using errcode = '22023';
  end if;
  if dati->>'formula' not in ('annuale', 'trimestre') then
    raise exception 'Un campo non va: si paga l''annuale o il trimestre' using errcode = '22023';
  end if;
  if coalesce(dati->>'regolamento', '') <> 'true' then
    raise exception 'Serve accettare il Regolamento Sociale' using errcode = '22023';
  end if;
  if coalesce(dati->>'pagamento_satispay', '') <> '' then
    begin
      pagato := (dati->>'pagamento_satispay')::uuid;
    exception when others then
      raise exception 'Questo pagamento Satispay non vale più: paga di nuovo in fondo al modulo' using errcode = '22023';
    end;
  end if;

  -- La chiave dell'invio non ferma mai la richiesta: se non si capisce, la richiesta avvisa da sola.
  begin
    inv := nullif(dati->>'invio', '')::uuid;
  exception when others then
    inv := null;
  end;

  -- La porta, una richiesta alla volta: senza, quelle mandate insieme vedono
  -- tutte lo stesso conteggio e passano oltre il limite. Il turno dura fino
  -- alla fine della transazione, cioè fino all'insert. Si prende solo qui,
  -- dopo i controlli: una richiesta enorme e sbagliata non lo tiene mentre
  -- la si legge, fermando il modulo per tutti.
  perform pg_advisory_xact_lock(hashtext('invia_iscrizione'));
  -- Lo stesso invio rimandato perché la risposta si è persa (rete del telefono): il pagamento è già della sua
  -- richiesta, con lo stesso codice fiscale, la stessa email e la stessa scelta. Si ritrova quella, senza farne un'altra né
  -- contarla nei limiti: chi paga va avanti a caricare i file. Bloccato fino alla fine: due invii insieme non
  -- prendono lo stesso pagamento.
  if pagato is not null then
    select * into p from pagamenti_satispay where id = pagato for update;
    if p.richiesta_id is not null and exists (
      select 1 from richieste_iscrizione r where r.id = p.richiesta_id and r.codice_fiscale = cf and r.email = mail
        and r.corsi = scelti and r.formula = dati->>'formula'
    ) then
      return p.richiesta_id;
    end if;
  end if;
  if (select count(*) from richieste_iscrizione where email = mail and creata_il > now() - interval '1 day')
     >= (regole->>'per_email_al_giorno')::int then
    raise exception 'Da questa email sono già arrivate % richieste oggi: se serve, scrivi alla segreteria', regole->>'per_email_al_giorno' using errcode = '54000';
  end if;
  -- Le rifiutate non contano, e le eliminate non ci sono più: chi riempie il
  -- modulo di richieste finte per chiuderlo agli altri, la segreteria lo
  -- sblocca togliendole.
  if (select count(*) from richieste_iscrizione where creata_il > now() - interval '1 hour' and stato <> 'rifiutata')
     >= (regole->>'in_tutto_all_ora')::int then
    raise exception 'In questo momento arrivano troppe richieste: riprova fra un po''' using errcode = '54000';
  end if;

  -- Il pagamento si prende solo se è arrivato, se nessuna richiesta l'ha mai preso, se è per questa scelta (un
  -- corso e la sua formula) e se l'ha pagato chi si iscrive: chi conosce l'id di un altro non ci fa la sua richiesta.
  if pagato is not null then
    if p.id is null or p.richiesta_id is not null or p.preso_il is not null or p.corso_id is null then
      raise exception 'Questo pagamento Satispay non vale più: paga di nuovo in fondo al modulo' using errcode = '22023';
    end if;
    if p.stato <> 'pagato' then
      raise exception 'Il pagamento Satispay non è ancora arrivato: conferma in Satispay e riprova' using errcode = '22023';
    end if;
    if scelti is distinct from array[p.corso_id] or dati->>'formula' is distinct from p.formula then
      raise exception 'Il pagamento Satispay era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria'
        using errcode = '22023';
    end if;
    if p.email is distinct from mail::text or lower(p.nome) is distinct from lower(trim(dati->>'nome'))
       or lower(p.cognome) is distinct from lower(trim(dati->>'cognome')) then
      raise exception 'Il pagamento Satispay è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria'
        using errcode = '22023';
    end if;
  end if;

  -- L'etichetta del link e la scelta passano da `pulisci_*`: quel che non va
  -- diventa null qui, e il vincolo della colonna non scatta mai per loro.
  insert into richieste_iscrizione (
    nome, cognome, nato_il, nato_a, codice_fiscale, indirizzo, cap, comune, email, telefono, telefono_2,
    genitore_nome, genitore_cognome, genitore_codice_fiscale, corsi, formula, note, regolamento,
    provenienza, conosciuto, invio
  ) values (
    trim(dati->>'nome'), trim(dati->>'cognome'), nato, coalesce(luogo_da_cf(cf, nato), trim(dati->>'nato_a')), cf,
    trim(dati->>'indirizzo'), trim(dati->>'cap'), trim(dati->>'comune'), mail, trim(dati->>'telefono'), tel_2,
    case when minore then trim(dati->>'genitore_nome') end,
    case when minore then trim(dati->>'genitore_cognome') end,
    case when minore then cf_gen end,
    scelti, dati->>'formula', nullif(trim(dati->>'note'), ''), true,
    pulisci_provenienza(dati->'provenienza'), pulisci_conosciuto(dati->'conosciuto'), inv
  ) returning id into nuova;
  if pagato is not null then
    update pagamenti_satispay set richiesta_id = nuova, preso_il = now() where id = pagato;
  end if;
  return nuova;
exception
  -- Un vincolo della tabella (un CAP di quattro cifre, un codice fiscale corto)
  -- detto in chiaro invece che col nome del vincolo.
  when check_violation then
    raise exception 'Un campo non va: %', case
      when sqlerrm like '%codice_fiscale%' then 'il codice fiscale ha 16 caratteri, lettere e numeri'
      when sqlerrm like '%cap%' then 'il CAP ha 5 cifre'
      when sqlerrm like '%email%' then 'l''email non sembra giusta'
      when sqlerrm like '%telefono_2%' then 'il secondo telefono non sembra giusto'
      when sqlerrm like '%telefono%' then 'il telefono non sembra giusto'
      when sqlerrm like '%corsi%' then 'si possono scegliere al massimo sei corsi'
      when sqlerrm like '%formula%' then 'si paga l''annuale o il trimestre'
      else 'un testo è troppo lungo' end
      using errcode = '22023';
end $$;

revoke all on function avviso_da_registro(avvisi_segreteria), avvisi_da_mandare(), avviso_preso(uuid), avviso_mandato(uuid),
  avvisi_non_mandati_oggi(), avvisi_riaccesi() from public, anon, authenticated;
grant execute on function avvisi_da_mandare(), avviso_preso(uuid), avviso_mandato(uuid) to service_role;
grant execute on function avvisi_non_mandati_oggi() to authenticated;
grant execute on function invia_iscrizione(jsonb) to anon, authenticated;

-- Ogni cinque minuti pg_cron chiama la Edge Function con pg_net. Senza (o su un Postgres di prova) il file si lancia
-- lo stesso, e gli avvisi partono solo chiamando la funzione a mano.
do $$
begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'avvisi-segreteria';
  perform cron.schedule('avvisi-segreteria', '*/5 * * * *',
    $c$select net.http_post(url := 'https://qfejpnkryrvjubcxvuco.supabase.co/functions/v1/avvisi-segreteria', body := '{}'::jsonb)$c$);
exception when others then
  raise notice 'pg_cron o pg_net non ci sono: la funzione avvisi-segreteria si chiama a mano';
end $$;

notify pgrst, 'reload schema';
