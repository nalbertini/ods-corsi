-- Un certificato medico mandato dall'area iscritti (`iscritto_manda_certificato`, 102) fa partire un avviso alla
-- segreteria, come una richiesta di iscrizione: prima lo si scopriva solo aprendo DA FARE o la scheda.
-- Un avviso per invio, dopo 5 minuti (chi sbaglia foto e rimanda subito dà una mail sola) e con lo stesso tetto
-- degli altri. La chiave è l'istante dell'invio, non il file: il nome del file porta l'id della persona, e
-- `unisci_persone` lo rinomina tenendo l'istante, così un'unione non rimanda la mail. Se prima di partire il
-- certificato è confermato, rifiutato, sostituito da un altro file o la persona è disattivata, l'avviso si chiude
-- `vuoto`. Nella mail solo nome, cognome e quando: mai il file né la scadenza.
-- Chi può fare cosa non cambia: le funzioni degli avvisi le chiama solo `service_role`.
-- Si lancia dopo `138-sito-punti.sql`, e solo dopo aver pubblicato la Edge Function `avvisi-segreteria` che
-- conosce il tipo `certificato` (una vecchia lo leggerebbe come un pagamento e si fermerebbe). Non chiede di
-- rilanciare `06-iscrizioni.sql`. Rilanciando `84` o `122` va rilanciato anche questo. Finché non c'è, i
-- certificati si vedono in DA FARE e nella scheda come prima.

alter table avvisi_segreteria drop constraint if exists avvisi_segreteria_tipo_check;
alter table avvisi_segreteria add constraint avvisi_segreteria_tipo_check
  check (tipo in ('richiesta', 'pagamento', 'pagamento_senza_richiesta', 'satispay_scarico', 'certificato'));

create or replace function avviso_da_registro(v avvisi_segreteria) returns jsonb
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  l jsonb := (select listino from impostazioni limit 1);
  persone jsonb;
  pagamento jsonb;
  r richieste_iscrizione;
  p pagamenti_satispay;
  cert record;
begin
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

-- `avvisi_da_mandare()` com'era in `122`, col ramo del certificato e `dati` nell'insert.
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
    -- Il tetto: mandati oggi più quelli di oggi in coda.
    select count(*) into contati from avvisi_segreteria v
     where v.non_mandato is null and (coalesce(v.mandato_il, v.creato_il) at time zone 'Europe/Rome')::date = oggi;
    insert into avvisi_segreteria (tipo, chiave, richieste, pagamento_id, dati, non_mandato)
      values (c.tipo, c.chiave, c.richieste, c.pagamento, c.dati, case when contati >= 50 then 'tetto' end);
  end loop;
  -- Niente più da dire (le richieste eliminate prima di partire): si chiude, e non pesa sul tetto.
  update avvisi_segreteria v set non_mandato = 'vuoto' where v.mandato_il is null and v.non_mandato is null and avviso_da_registro(v) is null;
  return query
    select v.id, ind.a, ind.cc, x.avviso
      from avvisi_segreteria v, lateral (select avviso_da_registro(v) as avviso) x
     where v.mandato_il is null and v.non_mandato is null and x.avviso is not null
     order by v.creato_il, v.id;
end $$;

-- I certificati già in attesa quando si lancia questo file la segreteria li ha già davanti in DA FARE: non mandano
-- la mail. Restano fuori quelli degli ultimi 5 minuti, che a un rilancio sarebbero già avvisati: così rilanciare
-- non chiude un certificato appena arrivato.
insert into avvisi_segreteria (tipo, chiave, richieste, dati, non_mandato)
  select 'certificato', 'certificato:' || (extract(epoch from s.certificato_in_attesa_il) * 1000000)::bigint,
         '{}'::uuid[], jsonb_build_object('inviato_il', s.certificato_in_attesa_il), 'vuoto'
    from schede_iscritti s
   where s.certificato_in_attesa is not null and s.certificato_in_attesa_il <= now() - interval '5 minutes'
  on conflict (chiave) do nothing;

revoke all on function avviso_da_registro(avvisi_segreteria), avvisi_da_mandare() from public, anon, authenticated;
grant execute on function avvisi_da_mandare() to service_role;

notify pgrst, 'reload schema';
