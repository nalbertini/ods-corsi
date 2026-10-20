-- ---------------------------------------------------------------------------
-- ODS Corsi · da dove arrivano le richieste di iscrizione
--
-- Il link al modulo porta un'etichetta (`iscrizioni/?da=home`,
-- `?da=corso-karate`, `?da=segreteria`…) e il modulo chiede, facoltativo,
-- «Come ci hai conosciuto?» con otto scelte chiuse. La richiesta le tiene in
-- due colonne, `provenienza` e `conosciuto`, che vede solo la segreteria
-- (come il resto della richiesta) e che non passano alla scheda della persona.
--
-- Un'etichetta sbagliata non ferma mai una richiesta: `invia_iscrizione`
-- (rifatta qui, con le regole di `06-iscrizioni.sql` e in più le due chiavi)
-- toglie gli spazi ai lati, mette in minuscolo, e se quel che resta non è una
-- parola di minuscole, cifre e trattini fino a 90 caratteri lo scarta senza
-- dire niente. Lo stesso per una scelta che non è delle otto. I vincoli delle
-- colonne dicono le stesse cose a chi scrive a mano.
--
-- I numeri per STATISTICHE stanno in `richieste_contate`: giorno, etichetta,
-- scelta, corsi e stato, nessun dato personale. La scrive solo il trigger
-- della richiesta (nessun grant di scrittura), la legge solo la segreteria,
-- e resta quando la richiesta si elimina (`on delete set null`: il legame
-- serve solo a seguirne lo stato). Si conta da quando questo file c'è: le
-- richieste di prima non hanno etichetta. `richieste_da_dove(da, a)` dà le
-- righe del periodo, raggruppate, al riquadro DA DOVE ARRIVANO LE RICHIESTE.
--
-- Si lancia dopo `06-iscrizioni.sql` e `49-richieste-per-email.sql`, e non
-- chiede di rilanciarli. Rilanciare `06` rimette la `invia_iscrizione` di
-- prima (che ignora le due chiavi): dopo va rilanciato anche questo. Finché
-- non c'è, il modulo manda le chiavi e il database le ignora; il dettaglio
-- della richiesta dice «Non si sa» alle due righe e il riquadro di STATISTICHE dice di
-- lanciare questo file.
-- ---------------------------------------------------------------------------

alter table richieste_iscrizione add column if not exists provenienza text
  check (provenienza ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(provenienza) <= 90);
alter table richieste_iscrizione add column if not exists conosciuto text
  check (conosciuto in ('amici-parenti', 'sito', 'instagram', 'facebook', 'google', 'volantino', 'passando-davanti', 'altro'));

-- Le stesse regole di `pulisciProvenienza` e `pulisciConosciuto` in
-- src/lib/provenienza.ts: solo un testo, spazi ai lati via, minuscolo; quello
-- che non va diventa null, mai un errore.
create or replace function pulisci_provenienza(x jsonb) returns text
  language sql immutable set search_path = public as $$
  select case when jsonb_typeof(x) = 'string'
              and lower(btrim(x #>> '{}', E' \t\r\n')) ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
              and length(btrim(x #>> '{}', E' \t\r\n')) <= 90
         then lower(btrim(x #>> '{}', E' \t\r\n')) end
$$;
create or replace function pulisci_conosciuto(x jsonb) returns text
  language sql immutable set search_path = public as $$
  select case when jsonb_typeof(x) = 'string'
              and lower(btrim(x #>> '{}', E' \t\r\n')) in ('amici-parenti', 'sito', 'instagram', 'facebook', 'google', 'volantino', 'passando-davanti', 'altro')
         then lower(btrim(x #>> '{}', E' \t\r\n')) end
$$;

-- ---------------------------------------------------------------------------
-- I conteggi, senza dati personali.
-- ---------------------------------------------------------------------------
create table if not exists richieste_contate (
  id           uuid primary key default gen_random_uuid(),
  -- Solo per seguire lo stato della richiesta: eliminata, il conteggio resta.
  richiesta_id uuid unique references richieste_iscrizione on delete set null,
  giorno       date not null,
  provenienza  text check (provenienza ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(provenienza) <= 90),
  conosciuto   text check (conosciuto in ('amici-parenti', 'sito', 'instagram', 'facebook', 'google', 'volantino', 'passando-davanti', 'altro')),
  corsi        uuid[] not null default '{}',
  stato        stato_richiesta not null default 'nuova'
);
create index if not exists richieste_contate_giorno on richieste_contate (giorno);

-- La legge la segreteria, nessun altro; nessuna policy di scrittura e nessun
-- grant: la scrive solo il trigger qui sotto.
alter table richieste_contate enable row level security;
drop policy if exists richieste_contate_legge on richieste_contate;
create policy richieste_contate_legge on richieste_contate for select to authenticated using (e_staff());
revoke all on richieste_contate from anon, authenticated;
grant select on richieste_contate to authenticated;

create or replace function conta_richiesta() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    insert into richieste_contate (richiesta_id, giorno, provenienza, conosciuto, corsi, stato)
    values (new.id, (new.creata_il at time zone 'Europe/Rome')::date, new.provenienza, new.conosciuto, new.corsi, new.stato)
    on conflict (richiesta_id) do nothing;
  else
    update richieste_contate
      set provenienza = new.provenienza, conosciuto = new.conosciuto, corsi = new.corsi, stato = new.stato
      where richiesta_id = new.id;
  end if;
  return null;
end $$;
revoke all on function conta_richiesta() from public, anon, authenticated;
create or replace trigger richieste_contate_nuova after insert on richieste_iscrizione
  for each row execute function conta_richiesta();
create or replace trigger richieste_contate_cambia after update of stato, provenienza, conosciuto, corsi on richieste_iscrizione
  for each row execute function conta_richiesta();

/**
 * Le richieste arrivate fra `da` e `a` (giorni, compresi), raggruppate:
 *
 *   { dal: 'AAAA-MM-GG' | null,      -- il primo giorno contato, di sempre
 *     righe: [{ provenienza, conosciuto, corsi: [uuid], stato, n }] }
 *
 * Per persona: una famiglia di tre sono tre richieste. Lo stato è quello di
 * oggi. Il filtro per corso e i nomi leggibili li fa l'app
 * (`contaDaDove` in src/lib/provenienza.ts).
 */
create or replace function richieste_da_dove(da date, a date) returns jsonb
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'i conteggi delle richieste sono della segreteria' using errcode = '42501'; end if;
  if da is null or a is null or a < da then raise exception 'il periodo è al contrario' using errcode = '22023'; end if;
  return jsonb_build_object(
    'dal', (select min(giorno) from richieste_contate),
    'righe', coalesce((
      select jsonb_agg(jsonb_build_object('provenienza', provenienza, 'conosciuto', conosciuto, 'corsi', corsi, 'stato', stato, 'n', n)
                       order by provenienza nulls last, conosciuto nulls last, stato)
      from (select provenienza, conosciuto, corsi, stato, count(*) as n
              from richieste_contate where giorno between da and a
             group by provenienza, conosciuto, corsi, stato) g), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- La richiesta: quella di `06-iscrizioni.sql`, con le due chiavi in più.
-- ---------------------------------------------------------------------------
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

  -- La porta, una richiesta alla volta: senza, quelle mandate insieme vedono
  -- tutte lo stesso conteggio e passano oltre il limite. Il turno dura fino
  -- alla fine della transazione, cioè fino all'insert. Si prende solo qui,
  -- dopo i controlli: una richiesta enorme e sbagliata non lo tiene mentre
  -- la si legge, fermando il modulo per tutti.
  perform pg_advisory_xact_lock(hashtext('invia_iscrizione'));
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

-- Chi può chiamare cosa: `invia_iscrizione` come in `06-iscrizioni.sql`, i
-- conteggi solo con un accesso (e dentro, solo la segreteria).
revoke all on function pulisci_provenienza(jsonb), pulisci_conosciuto(jsonb), richieste_da_dove(date, date) from public, anon;
grant execute on function pulisci_provenienza(jsonb), pulisci_conosciuto(jsonb), richieste_da_dove(date, date) to authenticated;
grant execute on function invia_iscrizione(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
