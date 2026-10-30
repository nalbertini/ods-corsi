-- ---------------------------------------------------------------------------
-- 125 · Satispay col suo browser: la chiave del pagamento
--
-- Un pagamento Satispay fatto prima di mandare il modulo si ritrovava con
-- nome, cognome, email e scelta: chi li conosceva di un altro riceveva l'id del
-- suo pagamento già fatto (che in `invia_iscrizione` vale come prova) e lo
-- consumava con una richiesta sua. Per la carta (115) lo ferma la chiave del
-- browser; qui la stessa chiave vale anche per Satispay.
--
-- Cosa cambia:
--   · `pagamento_prima` vuole la chiave per ogni circuito e ritrova solo il
--     pagamento di quella chiave;
--   · `satispay_prepara_prima(corso, formula, nome, cognome, email, chiave)`:
--     la chiave è obbligatoria (senza, «Ricarica la pagina e riprova a pagare»);
--     la versione senza chiave sparisce;
--   · `invia_iscrizione` (115): con `chiave_pagamento` nei dati. Un pagamento
--     che ha una chiave si prende solo con quella; senza o con un'altra,
--     «è stato fatto da un altro browser». Vale per Satispay e per la carta.
--
-- I pagamenti Satispay già in corso al rilascio hanno la chiave null: non si
-- ritrovano più con `prepara` (chi ricarica la pagina ne prepara uno nuovo; un
-- vecchio in attesa che poi viene pagato resta senza richiesta, in PAGAMENTI) e
-- `invia_iscrizione` li prende come prima, con l'id che chi ha pagato ha già
-- nel modulo. Nessuno li può più scoprire da fuori.
--
-- Chi può fare cosa: come prima; `satispay_prepara_prima` solo `service_role`.
-- Si lancia dopo `123-quadratura-banca.sql` (e `115-carta.sql`). Non chiede di
-- rilanciare `06-iscrizioni.sql`; rilanciando `115` va rilanciato anche questo.
-- Prima che la Edge Function `satispay` sia ripubblicata, `prepara` risponde
-- «Ricarica la pagina e riprova a pagare»: va ripubblicata subito dopo.
-- ---------------------------------------------------------------------------

create or replace function pagamento_prima(circuito text, corso uuid, formula text, nome text, cognome text, email text,
    chiave uuid default null)
  returns pagamenti_satispay language plpgsql security definer set search_path = public as $$
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
  if $7 is null then
    raise exception 'Ricarica la pagina e riprova a pagare' using errcode = '22023';
  end if;
  if not exists (select 1 from corsi x where x.id = corso and x.attivo) then
    raise exception 'Uno dei corsi scelti non c''è più: ricarica la pagina' using errcode = '22023';
  end if;
  -- Due tocchi insieme dallo stesso modulo trovano lo stesso pagamento.
  perform pg_advisory_xact_lock(hashtext('pagamento_prima:' || $1 || corso || formula || m));
  -- Con la carta un ordine lasciato a metà da più di 30 minuti non si riprende: PayPal lo fa scadere.
  if $1 = 'carta' then
    update pagamenti_satispay x set stato = 'non-andato'
      where x.circuito = 'carta' and x.stato = 'attesa' and x.richiesta_id is null and x.corso_id = corso
        and x.formula = $3 and x.nome = n and x.cognome = c and x.email = m and x.chiave = $7
        and x.creato_il < now() - interval '30 minutes';
  end if;
  select * into p from pagamenti_satispay x
    where x.circuito = $1 and x.richiesta_id is null and x.preso_il is null and x.stato in ('attesa', 'pagato') and x.corso_id = corso
      and x.formula = $3 and x.nome = n and x.cognome = c and x.email = m and x.chiave is not distinct from $7
    order by x.stato = 'pagato' desc, x.creato_il desc limit 1;
  if p.id is not null then return p; end if;
  quanto := importo_corso(corso, formula, (now() at time zone 'Europe/Rome')::date);
  if quanto is null then
    raise exception 'Un corso non ha ancora il prezzo: paga col bonifico' using errcode = '22023';
  end if;
  insert into pagamenti_satispay (chi, importo, stato, corso_id, formula, nome, cognome, email, circuito, chiave)
    values (c || ' ' || n, quanto, 'attesa', corso, $3, n, c, m, $1, $7)
    returning * into p;
  return p;
end $$;

drop function if exists satispay_prepara_prima(uuid, text, text, text, text);
create or replace function satispay_prepara_prima(corso uuid, formula text, nome text, cognome text, email text,
    chiave uuid default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p pagamenti_satispay := pagamento_prima('satispay', corso, formula, nome, cognome, email, chiave);
begin
  return jsonb_build_object('stato', p.stato, 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link,
    'pagato_il', p.pagato_il);
end $$;
revoke all on function satispay_prepara_prima(uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function satispay_prepara_prima(uuid, text, text, text, text, uuid) to service_role;

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
  -- La chiave del browser che ha pagato (125): senza, l'id del pagamento da solo non basta.
  chiave_pag uuid;
  p pagamenti_satispay;
  -- «Satispay» o «con la carta» nei testi, dal circuito del pagamento (115-carta.sql). Un id che non c'è resta Satispay.
  via text;
  -- Le richieste mandate insieme dallo stesso modulo (una famiglia): un avviso solo alla segreteria.
  inv uuid;
begin
  -- Prima di tutto, quello che costa poco: una richiesta enorme (fatta apposta, non dal modulo) si rifiuta qui,
  -- senza leggerla. Le richieste vere stanno sotto i 10 kB; pg_column_size non la legge tutta.
  if pg_column_size(dati) > 65536 then
    raise exception 'La richiesta è troppo grande: ricarica la pagina e rifalla' using errcode = '22023';
  end if;
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

  begin
    chiave_pag := nullif(dati->>'chiave_pagamento', '')::uuid;
  exception when others then
    chiave_pag := null;
  end;

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
    ) and (p.chiave is null or p.chiave is not distinct from chiave_pag) then
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
    via := case when p.circuito = 'carta' then 'con la carta' else 'Satispay' end;
    if p.id is null or p.richiesta_id is not null or p.preso_il is not null or p.corso_id is null then
      raise exception 'Questo pagamento % non vale più: paga di nuovo in fondo al modulo', via using errcode = '22023';
    end if;
    -- Un pagamento fatto da un browser con la sua chiave si prende solo da quel browser (i pagamenti di prima di
    -- 125 non ce l'hanno: restano come erano).
    if p.chiave is not null and p.chiave is distinct from chiave_pag then
      raise exception 'Il pagamento % è stato fatto da un altro browser: apri il modulo da dove hai pagato, o chiama la segreteria', via
        using errcode = '22023';
    end if;
    if p.stato <> 'pagato' then
      raise exception 'Il pagamento % non è ancora arrivato: %', via,
        case when p.circuito = 'carta' then 'aspetta la conferma e riprova' else 'conferma in Satispay e riprova' end using errcode = '22023';
    end if;
    if scelti is distinct from array[p.corso_id] or dati->>'formula' is distinct from p.formula then
      raise exception 'Il pagamento % era per un altro corso o un’altra formula: rimetti la scelta di prima, o chiama la segreteria', via
        using errcode = '22023';
    end if;
    if p.email is distinct from mail::text or lower(p.nome) is distinct from lower(trim(dati->>'nome'))
       or lower(p.cognome) is distinct from lower(trim(dati->>'cognome')) then
      raise exception 'Il pagamento % è a un altro nome o un’altra email: rimetti quelli di prima, o chiama la segreteria', via
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

notify pgrst, 'reload schema';
