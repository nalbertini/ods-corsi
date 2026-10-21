-- ---------------------------------------------------------------------------
-- ODS Corsi · Satispay: prima paghi, poi mandi
--
-- Dal modulo pubblico si paga con Satispay in fondo al modulo, prima di
-- mandare la richiesta: la richiesta arriva in segreteria solo pagata. Il
-- pagamento nasce quindi senza richiesta, dal corso e dalla formula scelti
-- (`satispay_prepara_prima`), con nome, cognome ed email di chi paga: se poi
-- la richiesta non parte, la segreteria lo trova in PAGAMENTI come «Satispay
-- senza richiesta» e richiama o restituisce. L'importo lo calcola sempre il
-- database (`importo_corso`, la stessa regola di `importo_iscrizione`), mai il
-- telefono.
--
-- `invia_iscrizione` (quella di `74-provenienza-richieste.sql`, con le stesse
-- regole) riceve `pagamento_satispay` e lo prende con sé solo se è arrivato,
-- se nessuna richiesta l'ha mai preso (`preso_il`), se corso e formula sono
-- quelli della richiesta e se l'ha pagato la stessa persona (nome, cognome,
-- email). Lo stesso invio rimandato dopo una risposta persa ritrova la sua
-- richiesta. Senza la chiave fa quello di prima.
--
-- Chi può cosa: le funzioni nuove solo `service_role`, cioè la Edge Function
-- `satispay`, come quelle di `73-satispay.sql`; `pagamenti_satispay` la
-- leggono segreteria e amministrazione, nessuno la scrive direttamente.
--
-- Si lancia dopo `73-satispay.sql` e `74-provenienza-richieste.sql`, e non
-- chiede di rilanciarli. Rilanciare `06` o `74` rimette una
-- `invia_iscrizione` che ignora il pagamento: dopo va rilanciato anche questo
-- (`controllo.sql` lo dice). L'app di prima continua a funzionare: la
-- richiesta senza pagamento, `satispay_prepara(richiesta)` e la callback non
-- cambiano. Finché il file non c'è, la Edge Function risponde all'azione
-- `prepara` che il servizio non è attivo e il modulo propone il bonifico.
-- ---------------------------------------------------------------------------

-- Il pagamento senza richiesta: per che cosa e di chi, per prenderlo dopo e per richiamare.
alter table pagamenti_satispay add column if not exists corso_id uuid references corsi on delete set null;
alter table pagamenti_satispay add column if not exists formula text check (formula in ('annuale', 'trimestre'));
alter table pagamenti_satispay add column if not exists nome text check (char_length(nome) <= 80);
alter table pagamenti_satispay add column if not exists cognome text check (char_length(cognome) <= 80);
alter table pagamenti_satispay add column if not exists email text check (char_length(email) <= 254);
-- Quando una richiesta l'ha preso: non si azzera mai, nemmeno se la richiesta si cancella (`richiesta_id` sì,
-- `on delete set null`), così un pagamento già usato non torna libero per un'altra richiesta.
alter table pagamenti_satispay add column if not exists preso_il timestamptz;
update pagamenti_satispay set preso_il = creato_il where richiesta_id is not null and preso_il is null;

-- Quanto si paga per un corso con quella formula il giorno `giorno`: la quota e il corso, solo se il corso ha una
-- sola riga di prezzo. È la regola di `importo_iscrizione`, che da qui la riusa per la sua richiesta.
create or replace function importo_corso(corso uuid, formula text, giorno date) returns int
  language plpgsql stable security definer set search_path = public as $$
declare
  l jsonb;
  v jsonb;
  p int;
begin
  select listino into l from impostazioni limit 1;
  if l is null then return null; end if;
  select x into v from jsonb_array_elements(l->'corsi') x where x->>'corsoId' = corso::text limit 1;
  if jsonb_array_length(coalesce(v->'prezzi', '[]'::jsonb)) <> 1 then return null; end if;
  p := prezzo_dal_listino(v, formula, giorno, (l->>'saldoEntro')::date);
  if p is null then return null; end if;
  return round((l->>'quota')::numeric * 100)::int + p;
end $$;

create or replace function importo_iscrizione(richiesta uuid, giorno date) returns int
  language plpgsql stable security definer set search_path = public as $$
declare
  r richieste_iscrizione;
begin
  select * into r from richieste_iscrizione where id = richiesta;
  if r.id is null or cardinality(r.corsi) <> 1 then return null; end if;
  return importo_corso(r.corsi[1], r.formula, giorno);
end $$;

-- Il pagamento da far fare prima della richiesta: quello vivo per la stessa scelta e la stessa persona (mai un
-- secondo; già pagato e non ancora preso, così chi ricarica la pagina non paga due volte), o uno nuovo con
-- l'importo di oggi. Un pagamento non andato non si riapre: se ne fa un altro.
create or replace function satispay_prepara_prima(corso uuid, formula text, nome text, cognome text, email text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p pagamenti_satispay;
  quanto int;
  n text := btrim(coalesce(nome, ''));
  c text := btrim(coalesce(cognome, ''));
  m text := lower(btrim(coalesce(email, '')));
begin
  if n = '' or c = '' or m = '' then
    raise exception 'Scrivi nome, cognome ed email prima di pagare' using errcode = '22023';
  end if;
  if char_length(n) > 80 or char_length(c) > 80 or char_length(m) > 254 then
    raise exception 'Un campo non va: nome e cognome hanno al massimo 80 caratteri' using errcode = '22023';
  end if;
  if formula is null or formula not in ('annuale', 'trimestre') then
    raise exception 'Un campo non va: si paga l''annuale o il trimestre' using errcode = '22023';
  end if;
  if not exists (select 1 from corsi x where x.id = corso and x.attivo) then
    raise exception 'Uno dei corsi scelti non c''è più: ricarica la pagina' using errcode = '22023';
  end if;
  -- Due tocchi insieme dallo stesso modulo trovano lo stesso pagamento.
  perform pg_advisory_xact_lock(hashtext('satispay_prepara_prima:' || corso || formula || m));
  select * into p from pagamenti_satispay x
    where x.richiesta_id is null and x.preso_il is null and x.stato in ('attesa', 'pagato') and x.corso_id = corso
      and x.formula = $2 and x.nome = n and x.cognome = c and x.email = m
    order by x.stato = 'pagato' desc, x.creato_il desc limit 1;
  if p.id is not null then
    return jsonb_build_object('stato', p.stato, 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link,
      'pagato_il', p.pagato_il);
  end if;
  quanto := importo_corso(corso, formula, (now() at time zone 'Europe/Rome')::date);
  if quanto is null then
    raise exception 'Un corso non ha ancora il prezzo: paga col bonifico' using errcode = '22023';
  end if;
  insert into pagamenti_satispay (chi, importo, stato, corso_id, formula, nome, cognome, email)
    values (c || ' ' || n, quanto, 'attesa', corso, $2, n, c, m)
    returning * into p;
  return jsonb_build_object('stato', 'attesa', 'id', p.id, 'importo', p.importo, 'satispay_id', null, 'link', null);
end $$;

-- Lo stato di un pagamento per il suo id: il modulo lo chiede mentre aspetta la conferma di Satispay, e la pagina di
-- ritorno per sapere se la richiesta è già partita (`collegato`).
create or replace function satispay_stato_pagamento(pagamento uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il, 'satispay_id', p.satispay_id,
    'collegato', p.preso_il is not null)
    from pagamenti_satispay p where p.id = pagamento
$$;

-- La richiesta: quella di `74-provenienza-richieste.sql`, col pagamento Satispay in più.
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
  -- Il pagamento Satispay fatto prima, in fondo al modulo (81-satispay-prima.sql): la richiesta lo prende con sé.
  pagato uuid;
  p pagamenti_satispay;
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
    provenienza, conosciuto
  ) values (
    trim(dati->>'nome'), trim(dati->>'cognome'), nato, coalesce(luogo_da_cf(cf, nato), trim(dati->>'nato_a')), cf,
    trim(dati->>'indirizzo'), trim(dati->>'cap'), trim(dati->>'comune'), mail, trim(dati->>'telefono'), tel_2,
    case when minore then trim(dati->>'genitore_nome') end,
    case when minore then trim(dati->>'genitore_cognome') end,
    case when minore then cf_gen end,
    scelti, dati->>'formula', nullif(trim(dati->>'note'), ''), true,
    pulisci_provenienza(dati->'provenienza'), pulisci_conosciuto(dati->'conosciuto')
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

revoke all on function importo_corso(uuid, text, date), satispay_prepara_prima(uuid, text, text, text, text),
  satispay_stato_pagamento(uuid) from public, anon, authenticated;
grant execute on function importo_corso(uuid, text, date), satispay_prepara_prima(uuid, text, text, text, text),
  satispay_stato_pagamento(uuid) to service_role;
-- `importo_iscrizione` è rifatta qui: tiene i permessi di 73.
revoke all on function importo_iscrizione(uuid, date) from public, anon, authenticated;
grant execute on function importo_iscrizione(uuid, date) to service_role;
grant execute on function invia_iscrizione(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
