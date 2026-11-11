-- ---------------------------------------------------------------------------
-- 143 · I solleciti del certificato partono da soli per email
--
-- A chi deve ancora portare il certificato e ha un termine (141), la mail col
-- link per caricarlo (142) parte da sola nei giorni scelti dalla segreteria,
-- rispetto al termine (di default 7 giorni prima, il giorno, 7 giorni dopo).
--
--   · `impostazioni`: l'interruttore (spento di default: si accende dopo aver
--     letto il testo), i momenti, oggetto e testo con {nome} {entro} {link},
--     la copia alla segreteria sull'ultimo. Le cambia la segreteria, come il resto.
--   · `solleciti_certificato_dovuti()` (pg_cron, ogni mattina alle 8 UTC: le 9
--     di Roma, le 10 con l'ora legale): scrive in `avvisi_segreteria` una riga per
--     mail di nucleo, al titolare. Un sollecito è dovuto solo il giorno esatto
--     `termine + momento`: un momento già passato non si recupera, e chi non ha
--     un termine (gli iscritti di prima) non ne riceve. Mai due volte lo stesso
--     momento della stessa persona (la chiave è in `dati.persone`). Senza
--     indirizzo la riga resta `a_mano`: la vede DA FARE (`solleciti_a_mano()`).
--   · Prima di partire e alla partenza si ricontrolla: un caricamento, la
--     conferma, la sospensione, la disattivazione, un termine spostato o un
--     WhatsApp segnato dopo la riga tolgono la persona dalla mail.
--   · `avvisi_da_mandare()` dà i solleciti anche senza l'indirizzo degli avvisi
--     (che serve solo per la copia), al più 100 al giorno, i più vecchi prima:
--     quelli in più partono il giorno dopo. Il tetto di 50 degli avvisi alla
--     segreteria non li conta.
--   · `avviso_mandato()` segna nei `solleciti` (canale `email`, momento, link).
--   · Spegnere i solleciti chiude quelli in coda: riaccesi, ripartono dal momento dopo.
--   · `sospendi_solleciti(persona, sospesi)` e `solleciti_email_di(persona)` (a chi
--     va la mail, se sono sospesi) per la segreteria, dalla scheda.
--   Nella mail solo nomi, la data e i link: mai cognome, nascita, codice fiscale.
--
-- Chi può cosa: `solleciti_certificato_dovuti` solo `service_role` (e pg_cron),
-- `solleciti_a_mano`, `sospendi_solleciti` e `solleciti_email_di` solo la
-- segreteria (`e_staff()`).
--
-- Rifà per intero `avviso_da_registro`, `avvisi_da_mandare` (da 139) e
-- `avviso_mandato` (da 84). Si lancia dopo `139-avviso-certificato.sql` e
-- `142-certificato-link.sql`, e solo dopo aver pubblicato la Edge Function
-- `avvisi-segreteria` che conosce il tipo `sollecito_certificato` (col
-- segreto `LINK_SEGRETO`). Non chiede di rilanciare `06-iscrizioni.sql`.
-- Rilanciando `84`, `122` o `139` va rilanciato anche questo (`controllo.sql`
-- lo dice). Finché non c'è, IMPOSTAZIONI non mostra i solleciti e i
-- solleciti si mandano a mano su WhatsApp, come prima.
-- ---------------------------------------------------------------------------

-- --- le impostazioni --------------------------------------------------------------
alter table impostazioni
  add column if not exists solleciti_certificato boolean not null default false,
  add column if not exists solleciti_momenti int[] not null default '{-7,0,7}',
  add column if not exists sollecito_oggetto text not null default 'Il certificato medico di {nome}',
  add column if not exists sollecito_testo text not null default E'Buongiorno,\nper {nome} ci manca ancora il certificato medico, da portare entro il {entro}.\nPuoi caricarlo da qui, senza password: basta una foto o il PDF.\n{link}\nSe l’hai già portato in segreteria, non serve fare altro.\nA presto in palestra,\nOfficine Dello Sport',
  add column if not exists sollecito_copia boolean not null default true;
-- Le stesse regole di `cosaNonVaMomenti`, `cosaNonVaOggetto`, `cosaNonVaTesto` (src/lib/sollecitiCertificato.ts).
-- Un check non può avere una sottoquery: i doppioni li conta una funzione.
create or replace function senza_doppioni(x int[]) returns boolean language sql immutable set search_path = public as $$
  select cardinality(x) = (select count(distinct y) from unnest(x) y)
$$;
alter table impostazioni drop constraint if exists solleciti_momenti_va;
alter table impostazioni add constraint solleciti_momenti_va check (
  cardinality(solleciti_momenti) between 1 and 6
  and array_position(solleciti_momenti, null) is null
  and -60 <= all(solleciti_momenti) and 60 >= all(solleciti_momenti)
  and senza_doppioni(solleciti_momenti));
alter table impostazioni drop constraint if exists sollecito_oggetto_va;
alter table impostazioni add constraint sollecito_oggetto_va check (
  length(btrim(sollecito_oggetto)) between 1 and 200 and sollecito_oggetto !~ '[\r\n]'
  and regexp_replace(sollecito_oggetto, '\{(nome|entro)\}', '', 'g') !~ '\{[^{}]*\}');
alter table impostazioni drop constraint if exists sollecito_testo_va;
alter table impostazioni add constraint sollecito_testo_va check (
  length(btrim(sollecito_testo)) between 1 and 4000 and strpos(sollecito_testo, '{link}') > 0
  and regexp_replace(sollecito_testo, '\{(nome|entro|link)\}', '', 'g') !~ '\{[^{}]*\}');

alter table schede_iscritti add column if not exists solleciti_sospesi boolean not null default false;
alter table solleciti add column if not exists momento int;

alter table avvisi_segreteria drop constraint if exists avvisi_segreteria_tipo_check;
alter table avvisi_segreteria add constraint avvisi_segreteria_tipo_check
  check (tipo in ('richiesta', 'pagamento', 'pagamento_senza_richiesta', 'satispay_scarico', 'certificato', 'sollecito_certificato'));
alter table avvisi_segreteria drop constraint if exists avvisi_segreteria_non_mandato_check;
alter table avvisi_segreteria add constraint avvisi_segreteria_non_mandato_check check (non_mandato in ('tetto', 'vuoto', 'guasto', 'a_mano'));

-- --- chi aspetta ancora il sollecito --------------------------------------------
-- Una persona di una riga di sollecito lo aspetta ancora se: i solleciti sono accesi, è attiva, il termine è
-- quello della riga, il certificato non è valido né da confermare, non li ha sospesi, il link vale, e nessuno
-- l'ha sollecitata (WhatsApp o email) dopo la riga.
create or replace function sollecito_ancora_dovuto(persona uuid, entro date, link uuid, dal timestamptz)
  returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select i.solleciti_certificato from impostazioni i limit 1), false)
     and exists (select 1 from persone p where p.id = persona and p.attiva)
     and certificato_termine(persona) is not distinct from entro
     and not exists (select 1 from schede_iscritti s where s.persona_id = persona
                       and (s.certificato_scade >= (now() at time zone 'Europe/Rome')::date
                            or s.certificato_in_attesa is not null or s.solleciti_sospesi))
     and exists (select 1 from link_certificato k where k.id = link and k.persona_id = persona and link_vale(k))
     and not exists (select 1 from solleciti x where x.persona_id = persona and x.creato_il >= dal)
$$;

-- Il link che vale della persona, se no uno nuovo: come `link_certificato_per` (142), senza la segreteria.
create or replace function link_certificato_valido(persona uuid) returns uuid
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare l uuid;
begin
  select k.id into l from link_certificato k where k.persona_id = persona and link_vale(k) order by k.creato_il desc limit 1;
  if l is null then insert into link_certificato (persona_id) values (persona) returning id into l; end if;
  return l;
end $$;

-- --- il giro del mattino ------------------------------------------------------------
create or replace function solleciti_certificato_dovuti() returns int
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  imp impostazioni;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  ultimo int;
  c record;
  k int;
  a_chi text;
  persone_r jsonb;
  scritte int := 0;
begin
  select * into imp from impostazioni limit 1;
  if not coalesce(imp.solleciti_certificato, false) then return 0; end if;
  -- Due giri insieme non scrivono la stessa riga due volte.
  perform pg_advisory_xact_lock(hashtext('solleciti_certificato_dovuti'));
  ultimo := (select max(x) from unnest(imp.solleciti_momenti) x);
  for c in
    with dovuti as (
      select p.id, coalesce(p.nucleo, p.id) as titolare, t.entro, m.m,
             'cert:' || p.id || ':' || t.entro || ':' || m.m as chiave
        from persone p
        cross join lateral (select certificato_termine(p.id) as entro, chat_nato_il(p.id) as nato) t
        cross join lateral unnest(imp.solleciti_momenti) m(m)
        left join schede_iscritti s on s.persona_id = p.id
       where p.attiva and p.ruolo::text = 'iscritto' and t.entro is not null and t.entro + m.m = oggi
         -- Serve: età sconosciuta o 6 anni compiuti, come `certificato_non_arrivato` (141).
         and (t.nato is null or chat_sei_anni(t.nato) <= oggi)
         and (s.certificato_scade is null or s.certificato_scade < oggi)
         and s.certificato_in_attesa is null and not coalesce(s.solleciti_sospesi, false)
         -- Sollecitata oggi a mano: la mail non parte.
         and not exists (select 1 from solleciti x where x.persona_id = p.id and (x.creato_il at time zone 'Europe/Rome')::date = oggi)
    )
    select d.titolare, array_agg(d.id order by d.id) as ids, array_agg(d.entro order by d.id) as entri,
           array_agg(d.m order by d.id) as momenti, array_agg(d.chiave order by d.id) as chiavi
      from dovuti d
     where not exists (select 1 from avvisi_segreteria v where v.tipo = 'sollecito_certificato'
                         and v.dati->'persone' @> jsonb_build_array(jsonb_build_object('chiave', d.chiave)))
     group by d.titolare
  loop
    select coalesce(nullif(btrim(t.email_contatto::text), ''), nullif(btrim(t.email::text), '')) into a_chi
      from persone t where t.id = c.titolare;
    persone_r := '[]'::jsonb;
    for k in 1 .. cardinality(c.ids) loop
      persone_r := persone_r || jsonb_build_object('persona', c.ids[k], 'chiave', c.chiavi[k],
        'link', link_certificato_valido(c.ids[k]), 'momento', c.momenti[k], 'entro', c.entri[k]);
    end loop;
    insert into avvisi_segreteria (tipo, chiave, dati, non_mandato)
      values ('sollecito_certificato', c.chiavi[1],
              jsonb_build_object('a', a_chi, 'copia', imp.sollecito_copia and ultimo = any(c.momenti), 'persone', persone_r),
              case when a_chi is null then 'a_mano' end);
    scritte := scritte + 1;
  end loop;
  return scritte;
end $$;

-- --- gli avvisi: `avviso_da_registro` e `avvisi_da_mandare` di 139, coi solleciti ---------
create or replace function avviso_da_registro(v avvisi_segreteria) returns jsonb
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  l jsonb := (select listino from impostazioni limit 1);
  persone jsonb;
  pagamento jsonb;
  r richieste_iscrizione;
  p pagamenti_satispay;
  cert record;
  persone_s jsonb;
begin
  -- Il sollecito del certificato: le persone della riga che lo aspettano ancora, solo il nome. Nessuna: niente da dire.
  if v.tipo = 'sollecito_certificato' then
    select jsonb_agg(jsonb_build_object('nome', pe.nome, 'entro', e->>'entro', 'linkId', e->>'link') order by pe.nome)
      into persone_s
      from jsonb_array_elements(coalesce(v.dati->'persone', '[]'::jsonb)) e
      join persone pe on pe.id = (e->>'persona')::uuid
     where sollecito_ancora_dovuto(pe.id, (e->>'entro')::date, (e->>'link')::uuid, v.creato_il)
       -- L'indirizzo è quello del titolare di adesso: cambiato il nucleo o corretta l'email, la riga non vale più.
       and (select coalesce(nullif(btrim(t.email_contatto::text), ''), nullif(btrim(t.email::text), ''))
              from persone t where t.id = coalesce(pe.nucleo, pe.id)) is not distinct from v.dati->>'a';
    if persone_s is null then return null; end if;
    return (select jsonb_build_object('tipo', 'sollecito_certificato', 'oggetto', i.sollecito_oggetto, 'testo', i.sollecito_testo, 'persone', persone_s)
              from impostazioni i limit 1);
  end if;
  -- Lo scarico Satispay (`satispay_scarico_avvisa`, 97-satispay-scarico.sql): i conti sono quelli di quel giro.
  if v.tipo = 'satispay_scarico' then
    return jsonb_build_object('tipo', 'satispay_scarico', 'quando', v.creato_il,
      'incassi', coalesce((v.dati->>'incassi')::int, 0), 'rimborsi', coalesce((v.dati->>'rimborsi')::int, 0),
      'daDecidere', coalesce((v.dati->>'da_decidere')::int, 0), 'errore', v.dati->>'errore');
  end if;
  -- Il certificato è ancora quello dell'invio e aspetta la segreteria: se no non c'è più niente da dire.
  if v.tipo = 'certificato' then
    select pe.id, pe.nome, pe.cognome, s.certificato_in_attesa_il into cert
      from schede_iscritti s join persone pe on pe.id = s.persona_id
     where s.certificato_in_attesa is not null and pe.attiva
       and s.certificato_in_attesa_il = (v.dati->>'inviato_il')::timestamptz
     limit 1;
    if cert.id is null then return null; end if;
    return jsonb_build_object('tipo', 'certificato', 'personaId', cert.id, 'nome', cert.nome, 'cognome', cert.cognome,
      'inviatoIl', cert.certificato_in_attesa_il);
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

create or replace function avvisi_da_mandare() returns table (id uuid, a text, cc text, avviso jsonb)
  language plpgsql security definer set search_path = public, extensions as $$
declare
  ind avvisi_indirizzi;
  c record;
  contati int;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  mandati_oggi int;
begin
  select * into ind from avvisi_indirizzi limit 1;
  -- Due chiamate insieme non contano il tetto ognuna per sé.
  perform pg_advisory_xact_lock(hashtext('avvisi_da_mandare'));
  -- Gli avvisi alla segreteria: solo con il suo indirizzo. I solleciti alle famiglie partono anche senza.
  if ind.a is not null then
  for c in
    -- Solo quelle che nessun avviso ha ancora: chi della famiglia arriva dopo (un «riprova») ne ha uno suo.
    select 'richiesta' as tipo, 'richiesta:' || (array_agg(x.id order by x.creata_il, x.id))[1] as chiave,
           array_agg(x.id order by x.creata_il, x.id) as richieste, null::uuid as pagamento, null::jsonb as dati
      from richieste_iscrizione x
     where x.creata_il >= ind.dal and x.stato <> 'rifiutata'
       and not exists (select 1 from avvisi_segreteria v where v.tipo = 'richiesta' and x.id = any(v.richieste))
     group by coalesce(x.invio, x.id)
    having max(x.creata_il) <= now() - interval '5 minutes'
    union all
    -- Pagato dopo l'avviso della sua richiesta: quello prima di pagare diceva «da pagare».
    select 'pagamento', 'pagamento:' || s.id, array[s.richiesta_id], s.id, null
      from pagamenti_satispay s
     where s.stato = 'pagato' and s.richiesta_id is not null and s.pagato_il >= ind.dal
       and exists (select 1 from avvisi_segreteria v where v.tipo = 'richiesta' and s.richiesta_id = any(v.richieste) and v.creato_il < s.pagato_il)
    union all
    -- Pagato in fondo al modulo e la richiesta non è arrivata: soldi da restituire o persona da chiamare.
    select 'pagamento_senza_richiesta', 'senza-richiesta:' || s.id, '{}'::uuid[], s.id, null
      from pagamenti_satispay s
     where s.stato = 'pagato' and s.richiesta_id is null and s.preso_il is null
       and s.persona_id is null
       and s.pagato_il >= ind.dal and s.pagato_il <= now() - interval '1 hour'
    union all
    -- Un certificato mandato dall'iscritto, cinque minuti dopo: un file rimandato subito prende il posto del primo.
    select 'certificato', 'certificato:' || (extract(epoch from s.certificato_in_attesa_il) * 1000000)::bigint,
           '{}'::uuid[], null, jsonb_build_object('inviato_il', s.certificato_in_attesa_il)
      from schede_iscritti s join persone pe on pe.id = s.persona_id
     where s.certificato_in_attesa is not null and pe.attiva
       and s.certificato_in_attesa_il >= ind.dal and s.certificato_in_attesa_il <= now() - interval '5 minutes'
  loop
    continue when exists (select 1 from avvisi_segreteria v where v.chiave = c.chiave);
    -- Il tetto: mandati oggi più quelli di oggi in coda. I solleciti hanno il loro.
    select count(*) into contati from avvisi_segreteria v
     where v.tipo <> 'sollecito_certificato' and v.non_mandato is null and (coalesce(v.mandato_il, v.creato_il) at time zone 'Europe/Rome')::date = oggi;
    insert into avvisi_segreteria (tipo, chiave, richieste, pagamento_id, dati, non_mandato)
      values (c.tipo, c.chiave, c.richieste, c.pagamento, c.dati, case when contati >= 50 then 'tetto' end);
  end loop;
  end if;
  -- Niente più da dire (le richieste eliminate prima di partire): si chiude, e non pesa sul tetto.
  update avvisi_segreteria v set non_mandato = 'vuoto' where v.mandato_il is null and v.non_mandato is null and avviso_da_registro(v) is null;
  return query
    select v.id, ind.a, ind.cc, x.avviso
      from avvisi_segreteria v, lateral (select avviso_da_registro(v) as avviso) x
     where ind.a is not null and v.tipo <> 'sollecito_certificato'
       and v.mandato_il is null and v.non_mandato is null and x.avviso is not null
     order by v.creato_il, v.id;
  -- I solleciti: alla famiglia, la segreteria in copia sull'ultimo. Al più 100 al giorno, i più vecchi prima:
  -- quelli in più restano in coda e partono domani. Al più 25 per chiamata: la Edge Function le manda una per una,
  -- e un giro troppo lungo che si ferma a metà rimanderebbe dieci minuti dopo quelle già partite.
  select count(*) into mandati_oggi from avvisi_segreteria v
   where v.tipo = 'sollecito_certificato' and (v.mandato_il at time zone 'Europe/Rome')::date = oggi;
  return query
    select v.id, v.dati->>'a', case when (v.dati->>'copia')::boolean then ind.a end, x.avviso
      from avvisi_segreteria v, lateral (select avviso_da_registro(v) as avviso) x
     where v.tipo = 'sollecito_certificato' and v.mandato_il is null and v.non_mandato is null and x.avviso is not null
     order by v.creato_il, v.id
     limit least(25, greatest(0, 100 - mandati_oggi));
end $$;

-- Partito: per un sollecito, la riga nei `solleciti` di chi era nella mail (lo storico della scheda).
create or replace function avviso_mandato(avviso uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare v avvisi_segreteria;
begin
  update avvisi_segreteria set mandato_il = now() where id = avviso and mandato_il is null returning * into v;
  if v.id is null or v.tipo <> 'sollecito_certificato' then return; end if;
  insert into solleciti (persona_id, canale, momento, link_id)
    select (e->>'persona')::uuid, 'email', (e->>'momento')::int, (e->>'link')::uuid
      from jsonb_array_elements(coalesce(v.dati->'persone', '[]'::jsonb)) e
     where sollecito_ancora_dovuto((e->>'persona')::uuid, (e->>'entro')::date, (e->>'link')::uuid, v.creato_il);
end $$;

-- --- la segreteria ------------------------------------------------------------------
-- DA FARE: chi aspetta un sollecito ma non ha un'email. Una volta per persona, col momento più recente.
create or replace function solleciti_a_mano()
  returns table (persona_id uuid, nome text, cognome text, entro date, momento int, dovuto_il date)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'i solleciti li vede la segreteria' using errcode = '42501'; end if;
  return query
    select x.id, x.nome, x.cognome, x.entro, x.momento, x.entro + x.momento
      from (select distinct on (pe.id) pe.id, pe.nome::text as nome, pe.cognome::text as cognome,
                   (e->>'entro')::date as entro, (e->>'momento')::int as momento
              from avvisi_segreteria v
              cross join lateral jsonb_array_elements(coalesce(v.dati->'persone', '[]'::jsonb)) e
              join persone pe on pe.id = (e->>'persona')::uuid
             where v.tipo = 'sollecito_certificato' and v.non_mandato = 'a_mano'
               and sollecito_ancora_dovuto(pe.id, (e->>'entro')::date, (e->>'link')::uuid, v.creato_il)
             order by pe.id, v.creato_il desc) x
     order by x.entro + x.momento, x.cognome, x.nome;
end $$;

create or replace function sospendi_solleciti(persona uuid, sospesi boolean) returns void
  language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'i solleciti li sospende la segreteria' using errcode = '42501'; end if;
  if not exists (select 1 from persone where id = persona and ruolo::text = 'iscritto' and attiva) then
    raise exception 'la scheda non c''è o è disattivata' using errcode = 'P0002';
  end if;
  insert into schede_iscritti (persona_id, solleciti_sospesi) values (persona, coalesce(sospesi, false))
    on conflict (persona_id) do update set solleciti_sospesi = excluded.solleciti_sospesi;
end $$;

-- La scheda: a chi va la mail (il titolare del nucleo) e se sono sospesi.
create or replace function solleciti_email_di(persona uuid) returns table (a text, sospesi boolean)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'i solleciti li vede la segreteria' using errcode = '42501'; end if;
  return query
    select coalesce(nullif(btrim(t.email_contatto::text), ''), nullif(btrim(t.email::text), '')),
           coalesce((select s.solleciti_sospesi from schede_iscritti s where s.persona_id = p.id), false)
      from persone p join persone t on t.id = coalesce(p.nucleo, p.id)
     where p.id = solleciti_email_di.persona;
end $$;

revoke all on function sollecito_ancora_dovuto(uuid, date, uuid, timestamptz), link_certificato_valido(uuid),
  solleciti_certificato_dovuti(), avviso_da_registro(avvisi_segreteria), avvisi_da_mandare(), avviso_mandato(uuid)
  from public, anon, authenticated;
grant execute on function solleciti_certificato_dovuti(), avvisi_da_mandare(), avviso_mandato(uuid) to service_role;
-- Il check di `impostazioni` gira con chi salva: la segreteria deve poterla chiamare.
revoke all on function senza_doppioni(int[]) from public, anon;
grant execute on function senza_doppioni(int[]) to authenticated;
revoke all on function solleciti_a_mano(), sospendi_solleciti(uuid, boolean), solleciti_email_di(uuid) from public, anon;
grant execute on function solleciti_a_mano(), sospendi_solleciti(uuid, boolean), solleciti_email_di(uuid) to authenticated;

-- Ogni mattina alle 8 UTC il giro scrive i solleciti; li manda `avvisi-segreteria`, ogni cinque minuti (84).
-- Senza pg_cron (un Postgres di prova) il file si lancia lo stesso, e il giro si chiama a mano.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'solleciti-certificato';
  perform cron.schedule('solleciti-certificato', '0 8 * * *', 'select public.solleciti_certificato_dovuti()');
exception when others then
  raise notice 'pg_cron non c''è: solleciti_certificato_dovuti() si chiama a mano';
end $$;

notify pgrst, 'reload schema';
