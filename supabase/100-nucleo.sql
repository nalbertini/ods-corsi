-- ---------------------------------------------------------------------------
-- ODS Corsi · il nucleo familiare sul database
--
-- Fin qui il nucleo (chi iscrive anche figli, coniuge o fratelli, e li vede con
-- un accesso solo) esisteva solo in modalità prova. Ora ha la sua colonna:
-- `persone.nucleo` è l'id del titolare, o niente. Le regole sono quelle di
-- `src/lib/nucleo.ts` (`cosaNonVaNucleo`, `nuovoTitolare`), con gli stessi
-- messaggi:
--   · due livelli: il titolare non è nel nucleo di nessuno;
--   · nessuno è titolare di sé stesso; nessun ciclo, nessuna catena;
--   · il titolare è maggiorenne (senza data di nascita passa);
--   · le schede disattivate non entrano; un titolare con altri dentro non si
--     disattiva («Prima cambia il titolare del nucleo»), un membro sì;
--   · se il titolare viene cancellato, i suoi tornano senza nucleo
--     (`on delete set null`): vale anche per `elimina_istruttore` e per UNISCI.
--
-- Le regole le tiene un trigger, quindi valgono anche per un `update` a mano;
-- le tre funzioni (`metti_nel_nucleo`, `togli_dal_nucleo`, `rendi_titolare`) le
-- dicono col messaggio giusto. Scrive solo la segreteria (`e_staff()`).
-- Leggere `nucleo` è come leggere le altre colonne di `persone`: le policy
-- sono quelle di prima.
--
-- Rifà, aggiungendo il nucleo: `unione_possibile` (da `45-certificati-online.sql`,
-- vale anche per `unisci_persone` e `anteprima_unione`), `accogli_iscrizione`
-- (da `95-certificato-piu-lontano.sql`) e `invia_iscrizione` (da
-- `84-avvisi-segreteria.sql`, che ora porta `nucleo_di`). Rilanciando uno di
-- quei file, va rilanciato anche questo.
-- Si lancia dopo `98-quote-persona.sql`. Si può rilanciare.
-- ---------------------------------------------------------------------------

alter table persone add column if not exists nucleo uuid references persone(id) on delete set null;
create index if not exists persone_nucleo on persone (nucleo) where nucleo is not null;
alter table richieste_iscrizione add column if not exists nucleo_di uuid references persone(id) on delete set null;

-- Senza data di nascita il titolare passa: la segreteria non sa, e non si blocca per questo.
-- La data è quella della scheda, se no quella dell'ultimo modulo accolto.
create or replace function nucleo_maggiorenne(persona uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(n.nato_il <= ((now() at time zone 'Europe/Rome')::date - interval '18 years')::date, true)
    from (select coalesce(
            (select a.nato_il from anagrafiche a where a.persona_id = persona),
            (select q.nato_il from richieste_iscrizione q where q.persona_id = persona and q.stato = 'accolta'
              order by q.gestita_il desc nulls last limit 1)) as nato_il) n
$$;

-- Perché `p` non può entrare nel nucleo di `t`, o null se può: `cosaNonVaNucleo`, riga per riga.
create or replace function nucleo_non_va(p uuid, t uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  a persone;
  b persone;
begin
  select * into a from persone where id = p and ruolo = 'iscritto';
  select * into b from persone where id = t and ruolo = 'iscritto';
  if a.id is null or b.id is null then return 'Persona inesistente'; end if;
  if a.id = b.id then return 'Una persona non entra nel suo stesso nucleo'; end if;
  if not a.attiva or not b.attiva then return 'Le schede disattivate non entrano in un nucleo'; end if;
  if b.nucleo is not null then return 'È già nel nucleo di un altro: scegli il titolare'; end if;
  if not nucleo_maggiorenne(b.id) then return 'Il titolare deve essere maggiorenne: scegli un adulto'; end if;
  if a.nucleo = b.id then return 'È già in questo nucleo'; end if;
  if a.nucleo is not null then return 'È già nel nucleo di un altro: prima toglilo da lì'; end if;
  if exists (select 1 from persone where nucleo = a.id) then
    return 'Ha un nucleo suo, con altri dentro: prima toglili, o fai titolare un altro';
  end if;
  return null;
end $$;

-- Le regole che valgono sempre, anche per un `update` a mano. Dopo la riga e
-- non prima: con due righe cambiate in una volta si guarda il risultato, non
-- lo stato a metà (una catena di due righe in un colpo solo non passa).
create or replace function persone_nucleo_regole() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.nucleo = new.id then
    raise exception 'Una persona non entra nel suo stesso nucleo';
  end if;
  if exists (select 1 from persone where id = new.nucleo and nucleo is not null) then
    raise exception 'È già nel nucleo di un altro: scegli il titolare';
  end if;
  if exists (select 1 from persone where nucleo = new.id) then
    raise exception 'Ha un nucleo suo, con altri dentro: prima toglili, o fai titolare un altro';
  end if;
  if not exists (select 1 from persone where id = new.nucleo and ruolo = 'iscritto') or new.ruolo <> 'iscritto' then
    raise exception 'Persona inesistente';
  end if;
  if not new.attiva or not exists (select 1 from persone where id = new.nucleo and attiva) then
    raise exception 'Le schede disattivate non entrano in un nucleo';
  end if;
  if not nucleo_maggiorenne(new.nucleo) then
    raise exception 'Il titolare deve essere maggiorenne: scegli un adulto';
  end if;
  return null;
end $$;

drop trigger if exists persone_nucleo_regole_nuova on persone;
create trigger persone_nucleo_regole_nuova after insert on persone
  for each row when (new.nucleo is not null) execute function persone_nucleo_regole();
drop trigger if exists persone_nucleo_regole_cambiata on persone;
create trigger persone_nucleo_regole_cambiata after update of nucleo on persone
  for each row when (new.nucleo is not null and new.nucleo is distinct from old.nucleo) execute function persone_nucleo_regole();

-- Un titolare con gente nel nucleo non si disattiva: prima si cambia titolare.
create or replace function persone_titolare_non_si_disattiva() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from persone where nucleo = old.id) then
    raise exception 'Prima cambia il titolare del nucleo';
  end if;
  return new;
end $$;

drop trigger if exists persone_titolare_non_si_disattiva on persone;
create trigger persone_titolare_non_si_disattiva before update of attiva on persone
  for each row when (old.attiva and not new.attiva) execute function persone_titolare_non_si_disattiva();

create or replace function metti_nel_nucleo(persona uuid, titolare uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  no text;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  -- Le due schede si bloccano prima dei controlli: due scritture insieme non
  -- fanno una catena.
  perform 1 from persone where id in (persona, titolare) order by id for update;
  no := nucleo_non_va(persona, titolare);
  if no is not null then raise exception '%', no; end if;
  update persone set nucleo = titolare where id = persona;
end $$;

create or replace function togli_dal_nucleo(persona uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p persone;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  select * into p from persone where id = persona and ruolo = 'iscritto' for update;
  if p.id is null then raise exception 'Persona inesistente'; end if;
  if p.nucleo is null then raise exception 'Non è nel nucleo di nessuno'; end if;
  update persone set nucleo = null where id = persona;
end $$;

-- `persona` esce dal nucleo e ne diventa titolare: il titolare di prima e gli altri passano a lei.
create or replace function rendi_titolare(persona uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p persone;
  vecchio uuid;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  select * into p from persone where id = persona and ruolo = 'iscritto';
  if p.id is null then raise exception 'Persona inesistente'; end if;
  if p.nucleo is null then raise exception 'Non è nel nucleo di nessuno'; end if;
  if not p.attiva then raise exception 'Le schede disattivate non entrano in un nucleo'; end if;
  vecchio := p.nucleo;
  perform 1 from persone where id in (persona, vecchio) or nucleo = vecchio order by id for update;
  if not nucleo_maggiorenne(persona) then
    raise exception 'Il titolare deve essere maggiorenne: scegli un adulto';
  end if;
  -- In tre passi, ognuno valido da sé: prima lei esce, poi gli altri passano
  -- a lei, per ultimo il titolare di prima (ormai senza nessuno dentro).
  update persone set nucleo = null where id = persona;
  update persone set nucleo = persona where nucleo = vecchio;
  update persone set nucleo = persona where id = vecchio;
end $$;

-- unione_possibile: quella di 45, col nucleo.
create or replace function unione_possibile(resta uuid, via uuid) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  a persone;
  b persone;
  cf_a text;
  cf_b text;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  if resta = via then raise exception 'Scegli due schede diverse'; end if;
  select * into a from persone where id = resta;
  select * into b from persone where id = via;
  if a.id is null or b.id is null then raise exception 'Una delle due schede non c''è più: ricarica la pagina'; end if;
  if a.ruolo <> 'iscritto' or b.ruolo <> 'iscritto' then
    raise exception 'Si uniscono solo le schede degli iscritti, non quelle del personale';
  end if;
  if a.utente_id is not null or b.utente_id is not null then
    raise exception 'Una delle due schede ha un accesso all''app: non si unisce. Se è un doppione, disattiva quella senza accesso';
  end if;
  -- Il nucleo familiare: chi se ne va non può restare appeso a un titolare che
  -- non c'è più. Chi resta invece può avere un nucleo suo, o essere in uno.
  if b.nucleo is not null then
    raise exception '% è nel nucleo familiare di un''altra persona: prima toglila dal nucleo', btrim(b.nome || ' ' || b.cognome);
  end if;
  if exists (select 1 from persone where nucleo = b.id) then
    raise exception '% è titolare di un nucleo familiare: prima rendi titolare qualcun altro o togli gli altri dal nucleo', btrim(b.nome || ' ' || b.cognome);
  end if;
  -- Il codice fiscale scritto in segreteria, se no quello del modulo accolto.
  select coalesce((select codice_fiscale from anagrafiche where persona_id = resta),
                  (select codice_fiscale from richieste_iscrizione where persona_id = resta and stato = 'accolta' order by gestita_il desc nulls last limit 1))
    into cf_a;
  select coalesce((select codice_fiscale from anagrafiche where persona_id = via),
                  (select codice_fiscale from richieste_iscrizione where persona_id = via and stato = 'accolta' order by gestita_il desc nulls last limit 1))
    into cf_b;
  if cf_a is not null and cf_b is not null and cf_a <> cf_b then
    raise exception 'Hanno due codici fiscali diversi: non sono la stessa persona. Se uno è sbagliato, correggilo nella scheda e riprova';
  end if;
end $$;

-- accogli_iscrizione: quella di 99-email-unica, col nucleo.
create or replace function accogli_iscrizione(richiesta uuid, persona uuid default null, scade date default null)
  returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  r richieste_iscrizione;
  chi uuid;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  -- Le ultime dieci cifre: «+39 347 791 7462» e «3477917462» sono lo stesso numero.
  tel text;
  -- Il certificato arrivato con la richiesta.
  cert text;
  nuovo text;
  nuova_scheda boolean := false;
begin
  if not e_staff() then raise exception 'solo la segreteria' using errcode = '42501'; end if;
  select * into r from richieste_iscrizione where id = richiesta for update;
  if r.id is null then raise exception 'richiesta inesistente' using errcode = 'P0002'; end if;
  if r.stato <> 'nuova' then raise exception 'Questa richiesta è già stata %', r.stato using errcode = '22023'; end if;
  -- Più di tre anni avanti è quasi sempre l'anno sbagliato, come in `salva_certificato`.
  if scade > oggi + interval '3 years' then
    raise exception 'La data è troppo lontana: controlla l''anno.' using errcode = '22023';
  end if;

  if persona is not null then
    select id into chi from persone where id = persona;
    if chi is null then raise exception 'Questa scheda non c''è più' using errcode = 'P0002'; end if;
  end if;

  -- Il codice fiscale è la cosa più sicura: una richiesta già accolta con lo
  -- stesso porta alla stessa persona, anche se stavolta l'ha mandata l'altro
  -- genitore con la sua email. Ma solo se anche nome e cognome tornano: il
  -- codice lo conoscono in tanti, e un nome diverso è un'altra persona (o un
  -- errore) che la segreteria deve scegliere a mano.
  if chi is null then
    select q.persona_id into chi from richieste_iscrizione q
      join persone p on p.id = q.persona_id and p.ruolo = 'iscritto'
      where q.codice_fiscale = r.codice_fiscale and q.id <> r.id
        and lower(p.nome) = lower(r.nome) and lower(p.cognome) = lower(r.cognome)
      order by q.gestita_il desc nulls last
      limit 1;
  end if;
  -- O quello dei dati anagrafici, per chi è arrivato dalle risposte del
  -- modulo Google (se `18-anagrafiche.sql` c'è già).
  if chi is null and to_regclass('public.anagrafiche') is not null then
    execute 'select a.persona_id from anagrafiche a join persone p on p.id = a.persona_id and p.ruolo = ''iscritto'' where a.codice_fiscale = $1 and lower(p.nome) = lower($2) and lower(p.cognome) = lower($3) limit 1' into chi using r.codice_fiscale, r.nome, r.cognome;
  end if;
  if chi is null then
    tel := right(regexp_replace(coalesce(r.telefono, ''), '\D', '', 'g'), 10);
    select p.id into chi from persone p
      where p.ruolo = 'iscritto' and lower(p.nome) = lower(r.nome) and lower(p.cognome) = lower(r.cognome)
        and (p.email is null or p.email = r.email
             or (length(tel) >= 9 and right(regexp_replace(coalesce(p.telefono, ''), '\D', '', 'g'), 10) = tel))
        -- Un codice fiscale già noto e diverso è un'altra persona con lo stesso
        -- nome. Uno uguale l'hanno già trovato le due ricerche qui sopra.
        and not exists (select 1 from richieste_iscrizione q
                         where q.persona_id = p.id and q.stato = 'accolta' and q.codice_fiscale <> r.codice_fiscale)
        and not exists (select 1 from anagrafiche a where a.persona_id = p.id and a.codice_fiscale <> r.codice_fiscale)
      order by (p.email = r.email) desc nulls last, p.creata_il
      limit 1;
  end if;
  if chi is null then
    nuova_scheda := true;
    -- Gli iscritti possono dividere l'email (un genitore e i figli): è sempre la sua.
    insert into persone (nome, cognome, email, telefono, ruolo)
    values (r.nome, r.cognome, r.email, r.telefono, 'iscritto')
    returning id into chi;
  else
    update persone set attiva = true,
      telefono = coalesce(telefono, r.telefono),
      email = coalesce(email, r.email)
    where id = chi;
  end if;

  -- Chi è già iscritto resta com'è; chi aveva una fine segnata la perde, e
  -- chi aveva già smesso riparte da oggi.
  insert into iscrizioni (corso_id, persona_id, dal)
    select c.id, chi, oggi from corsi c where c.id = any (r.corsi) and c.attivo
  on conflict (corso_id, persona_id) do update
    set dal = case when iscrizioni.al < oggi then oggi else iscrizioni.dal end, al = null
    where iscrizioni.al is not null;

  -- Il certificato allegato passa alla scheda, nel contenitore dei
  -- certificati e non più nella cartella della richiesta. Prende il posto di
  -- quello che la scheda aveva, con la data che la segreteria ha letto sul
  -- foglio (senza, la data della scheda non si tocca). Se ce n'è più d'uno
  -- vale l'ultimo; uno sbagliato la segreteria lo toglie prima di accogliere.
  select o.name into cert from storage.objects o
    where o.bucket_id = 'iscrizioni' and o.name ~ ('^' || richiesta::text || '/certificato\.(jpg|jpeg|png|webp|heic|heif|pdf)$')
    order by o.created_at desc, o.name limit 1;
  -- Se la scheda ha già un certificato ancora valido che non scade prima di quello nuovo, il file della
  -- richiesta non lo sostituisce: resta fra i file della richiesta, per la segreteria. Senza data non
  -- si sa quale scade dopo, e vince quello che c'è.
  if cert is not null and not exists (
       select 1 from schede_iscritti where persona_id = chi and certificato_file is not null and certificato_scade >= oggi
         and (scade is null or certificato_scade >= scade)) then
    nuovo := chi::text || '/certificato-' || (extract(epoch from clock_timestamp()) * 1000)::bigint || '.' || substring(cert from '\.([a-z]+)$');
    perform togli_file_certificato(chi);
    update storage.objects set bucket_id = 'certificati', name = nuovo where bucket_id = 'iscrizioni' and name = cert;
    insert into schede_iscritti (persona_id, certificato_file, certificato_caricato_il, certificato_scade) values (chi, nuovo, now(), scade)
      on conflict (persona_id) do update set certificato_file = excluded.certificato_file, certificato_caricato_il = excluded.certificato_caricato_il,
        certificato_scade = coalesce(excluded.certificato_scade, schede_iscritti.certificato_scade);
    -- Gli altri certificato.* della richiesta, se ce n'erano.
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'iscrizioni' and name ~ ('^' || richiesta::text || '/certificato\.');
  end if;

  -- Una persona aggiunta «per il nucleo di» entra nel nucleo solo se le regole
  -- del nucleo lo permettono ora (il titolare può essere cambiato nel frattempo,
  -- o la scheda trovata avere già un nucleo suo): se no l'iscrizione si accoglie
  -- lo stesso, senza nucleo, e la segreteria lo sistema dalla scheda.
  -- Solo a una scheda appena creata: il modulo lo manda anche chi non ha fatto
  -- l'accesso, e una scheda che c'era già non si sposta con una richiesta.
  if r.nucleo_di is not null and nuova_scheda and nucleo_non_va(chi, r.nucleo_di) is null then
    update persone set nucleo = r.nucleo_di where id = chi;
  end if;

  update richieste_iscrizione
    set stato = 'accolta', persona_id = chi, gestita_da = persona_corrente(), gestita_il = now()
    where id = richiesta;
  return chi;
end $$;

-- invia_iscrizione: quella di 84, con `nucleo_di`.
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
    provenienza, conosciuto, invio, nucleo_di
  ) values (
    trim(dati->>'nome'), trim(dati->>'cognome'), nato, coalesce(luogo_da_cf(cf, nato), trim(dati->>'nato_a')), cf,
    trim(dati->>'indirizzo'), trim(dati->>'cap'), trim(dati->>'comune'), mail, trim(dati->>'telefono'), tel_2,
    case when minore then trim(dati->>'genitore_nome') end,
    case when minore then trim(dati->>'genitore_cognome') end,
    case when minore then cf_gen end,
    scelti, dati->>'formula', nullif(trim(dati->>'note'), ''), true,
    pulisci_provenienza(dati->'provenienza'), pulisci_conosciuto(dati->'conosciuto'), inv,
    -- Solo se è chi manda il modulo, con l'accesso fatto: nessuno mette altri nel proprio nucleo.
    (select tit.id from persone tit where tit.ruolo = 'iscritto' and tit.id = persona_corrente() and tit.id::text = dati->>'nucleo_di')
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

revoke all on function nucleo_maggiorenne(uuid), nucleo_non_va(uuid, uuid), persone_nucleo_regole(), persone_titolare_non_si_disattiva() from public, anon, authenticated;
revoke all on function metti_nel_nucleo(uuid, uuid), togli_dal_nucleo(uuid), rendi_titolare(uuid) from public, anon;
grant execute on function metti_nel_nucleo(uuid, uuid), togli_dal_nucleo(uuid), rendi_titolare(uuid) to authenticated;
revoke all on function accogli_iscrizione(uuid, uuid, date) from public, anon;
grant execute on function accogli_iscrizione(uuid, uuid, date) to authenticated;
revoke all on function unione_possibile(uuid, uuid) from public, anon, authenticated;
grant execute on function invia_iscrizione(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
