-- ---------------------------------------------------------------------------
-- 113 · La carta di credito o di debito nel modulo di iscrizione
--
-- Accanto a Satispay, in fondo al modulo si paga anche con la carta (o Apple
-- Pay / Google Pay). Incassa PayPal, con i suoi campi carta ospitati: nessun
-- dato della carta passa da qui né si salva. Il pagamento sta nella stessa
-- tabella di Satispay, `pagamenti_satispay` (il nome resta), con
-- `circuito = 'carta'` e l'id dell'ordine PayPal in `paypal_id`. L'importo lo
-- calcola il database dal listino, mai il telefono.
--
-- Chi può fare cosa: come Satispay (73, 83). La tabella la leggono solo
-- segreteria e amministrazione; scrivono solo queste funzioni. Le quattro
-- della carta (`carta_prepara_prima`, `carta_creato`, `carta_esito`,
-- `carta_stato_pagamento`) le chiama solo la Edge Function `paypal`
-- (service_role).
--
-- Un pagamento con la carta in attesa da più di 30 minuti, quando chi si
-- iscrive torna a pagare, non va più: se ne fa uno nuovo. Se la conferma di un
-- ordine ancora in attesa arriva tardi, resta pagato (in PAGAMENTI: «Carta
-- senza richiesta»).
--
-- Rifà anche, coi testi del circuito giusto:
--   · `satispay_prepara_prima` (83): ritrova solo i pagamenti Satispay;
--   · `satispay_creato` (73) e `satispay_stato_pagamento` (83): solo i
--     pagamenti Satispay, anche se alla Edge Function arriva l'id di una carta;
--   · `invia_iscrizione` (111): prende anche un pagamento con la carta;
--   · `emetti_ricevuta_satispay` (86): con la carta vuole il metodo «Carta»;
--   · `registra_pagamento_diretto` (88): «Carta» a mano no, se dal modulo sono
--     arrivati soldi con la carta non ancora in una ricevuta.
-- Aggiunge la cassa «Carta».
--
-- Si lancia dopo `112-sito-accessibilita-agid.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, la Edge Function `paypal` risponde che
-- la carta è spenta e il modulo mostra solo Satispay e bonifico.
-- Rilanciando `73`, `83`, `86`, `88`, `100` o `111` va rilanciato anche questo.
-- ---------------------------------------------------------------------------

alter table pagamenti_satispay add column if not exists circuito text not null default 'satispay'
  check (circuito in ('satispay', 'carta'));
alter table pagamenti_satispay add column if not exists paypal_id text unique;
-- La chiave del browser che ha fatto il pagamento con la carta: chi conosce nome, email e scelta di un altro
-- non ritrova il suo pagamento (e il suo id, che vale come prova in `invia_iscrizione`).
alter table pagamenti_satispay add column if not exists chiave uuid;

-- Da subito una cassa sua: i soldi arrivano sul conto PayPal, e da lì al conto con un giroconto.
insert into casse (nome) values ('Carta') on conflict do nothing;

-- Il pagamento fatto prima di mandare il modulo, per un circuito: ritrova quello vivo della stessa scelta e
-- persona (il pagato prima), se no ne fa uno nuovo. La usano solo le due funzioni qui sotto.
drop function if exists pagamento_prima(text, uuid, text, text, text, text);
-- Satispay non ha ancora la chiave (null): ritrova come prima.
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
  if $1 = 'carta' and $7 is null then
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

create or replace function satispay_prepara_prima(corso uuid, formula text, nome text, cognome text, email text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p pagamenti_satispay := pagamento_prima('satispay', corso, formula, nome, cognome, email);
begin
  return jsonb_build_object('stato', p.stato, 'id', p.id, 'importo', p.importo, 'satispay_id', p.satispay_id, 'link', p.link,
    'pagato_il', p.pagato_il);
end $$;

-- dati = {corso, formula, nome, cognome, email, chiave}, come li manda la Edge Function.
create or replace function carta_prepara_prima(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  corso uuid;
  chiave uuid;
  p pagamenti_satispay;
begin
  begin
    corso := (dati->>'corso')::uuid;
  exception when others then
    raise exception 'Uno dei corsi scelti non c''è più: ricarica la pagina' using errcode = '22023';
  end;
  begin
    chiave := (dati->>'chiave')::uuid;
  exception when others then
    raise exception 'Ricarica la pagina e riprova a pagare' using errcode = '22023';
  end;
  p := pagamento_prima('carta', corso, dati->>'formula', dati->>'nome', dati->>'cognome', dati->>'email', chiave);
  -- creato_il: la Edge Function rilegge l'ordine e lo giudica coi 30 minuti (`statoCarta`).
  return jsonb_build_object('stato', p.stato, 'id', p.id, 'importo', p.importo, 'paypal_id', p.paypal_id, 'pagato_il', p.pagato_il, 'creato_il', p.creato_il);
end $$;

-- L'id dell'ordine PayPal, scritto una volta sola. Un id già di un altro pagamento lo rifiuta `unique`.
create or replace function carta_creato(id uuid, paypal_id text) returns void
  language sql security definer set search_path = public as $$
  update pagamenti_satispay p set paypal_id = $2
    where p.id = $1 and p.circuito = 'carta' and p.stato = 'attesa' and p.paypal_id is null
$$;

-- Lo stato dell'ordine, come lo calcola la Edge Function: 'attesa', 'pagato' o 'non-andato'.
create or replace function carta_esito(paypal_id text, stato text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p pagamenti_satispay;
begin
  if stato is null or stato not in ('attesa', 'pagato', 'non-andato') then
    raise exception 'Stato della carta sconosciuto: %', stato using errcode = '22023';
  end if;
  select * into p from pagamenti_satispay x where x.paypal_id = $1 and x.circuito = 'carta' for update;
  if p.id is null then raise exception 'Pagamento con la carta sconosciuto' using errcode = 'P0002'; end if;
  -- Pagato un ordine che avevamo dato per non andato: l'errore resta nel log della Edge Function invece di
  -- sparire, e quei soldi si restituiscono dal conto PayPal.
  if stato = 'pagato' and p.stato = 'non-andato' then
    raise exception 'PayPal dà pagato un pagamento non andato (%): va restituito dal conto PayPal', p.paypal_id using errcode = '22023';
  end if;
  if stato = 'pagato' and p.stato = 'attesa' then
    update pagamenti_satispay set stato = 'pagato', pagato_il = now() where id = p.id returning * into p;
  elsif stato = 'non-andato' and p.stato = 'attesa' then
    update pagamenti_satispay set stato = 'non-andato' where id = p.id returning * into p;
  end if;
  return jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il);
end $$;

-- Lo stato per l'id: il modulo lo chiede mentre aspetta la conferma, e per sapere se la richiesta è già partita.
-- L'ordine e quando è nato servono alla Edge Function per rileggerlo da PayPal: al browser non li passa.
create or replace function carta_stato_pagamento(pagamento uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il, 'collegato', p.preso_il is not null,
      'paypal_id', p.paypal_id, 'creato_il', p.creato_il)
    from pagamenti_satispay p where p.id = pagamento and p.circuito = 'carta'
$$;

revoke all on function pagamento_prima(text, uuid, text, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function satispay_prepara_prima(uuid, text, text, text, text), carta_prepara_prima(jsonb), carta_creato(uuid, text),
  carta_esito(text, text), carta_stato_pagamento(uuid) from public, anon, authenticated;
grant execute on function satispay_prepara_prima(uuid, text, text, text, text), carta_prepara_prima(jsonb), carta_creato(uuid, text),
  carta_esito(text, text), carta_stato_pagamento(uuid) to service_role;

-- La richiesta: quella di `111-iscrizione-troppo-grande.sql`, che prende anche un pagamento con la carta.
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
  -- «Satispay» o «con la carta» nei testi, dal circuito del pagamento (113-carta.sql). Un id che non c'è resta Satispay.
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
    via := case when p.circuito = 'carta' then 'con la carta' else 'Satispay' end;
    if p.id is null or p.richiesta_id is not null or p.preso_il is not null or p.corso_id is null then
      raise exception 'Questo pagamento % non vale più: paga di nuovo in fondo al modulo', via using errcode = '22023';
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

-- Come in `86-ricevuta-una-volta.sql`, col metodo e i testi del circuito.
create or replace function emetti_ricevuta_satispay(dati jsonb, pagamento uuid) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  p pagamenti_satispay;
  somma int;
  nuova jsonb;
  gia ricevute;
  metodo text;
  via text;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la fa la segreteria' using errcode = '42501'; end if;
  select * into p from pagamenti_satispay where id = pagamento for update;
  -- Un id che non c'è non dice di che circuito era: il testo resta quello di Satispay.
  metodo := case when p.circuito = 'carta' then 'Carta' else 'Satispay' end;
  via := case when p.circuito = 'carta' then 'con la carta' else 'Satispay' end;
  if p.id is null or p.stato <> 'pagato' then
    raise exception 'Questo pagamento % non è arrivato', via using errcode = '22023';
  end if;
  gia := ricevuta_gia_fatta(chiave_ricevuta(dati), nullif(dati->>'persona_id', '')::uuid);
  if gia.id is not null and gia.id = p.ricevuta_id then return to_jsonb(gia); end if;
  -- Il modulo ha già fatto una ricevuta senza questo pagamento: legarlo a quella la farebbe dire il falso.
  if gia.id is not null then
    raise exception 'La ricevuta n. %/% fatta da questo modulo non ha dentro questo pagamento %: chiudi il modulo e riaprilo', gia.numero, gia.anno, via
      using errcode = '22023';
  end if;
  -- In una ricevuta annullata i soldi non contano più: possono entrare in quella giusta.
  if exists (select 1 from ricevute r where r.id = p.ricevuta_id and r.annullata_il is null) then
    raise exception 'Questo pagamento % è già in una ricevuta', via using errcode = '22023';
  end if;
  if p.persona_id is null or p.persona_id is distinct from nullif(dati->>'persona_id', '')::uuid then
    raise exception 'Il pagamento % è di un’altra persona: accogli prima la sua richiesta', via using errcode = '22023';
  end if;
  select coalesce(sum((pg->>'importo')::int), 0) into somma
    from jsonb_array_elements(coalesce(dati->'voci', '[]'::jsonb)) v,
         jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) pg
    where pg->>'metodo' = metodo;
  if somma <> p.importo then
    -- Lo stesso testo di `cosaNonVaSatispay` (src/lib/satispay.ts): i centesimi solo se ci sono.
    raise exception '% sono arrivati % €: nel pagato di questa ricevuta ce ne sono % €',
      case when p.circuito = 'carta' then 'Con la carta' else 'Con Satispay' end, soldi_sql(p.importo), soldi_sql(somma)
      using errcode = '22023';
  end if;
  nuova := emetti_ricevuta(dati);
  update pagamenti_satispay set ricevuta_id = (nuova->>'id')::uuid where id = p.id;
  return nuova;
end $$;

-- Come in `88-pagamento-una-volta.sql`, con la carta accanto a Satispay.
create or replace function registra_pagamento_diretto(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorno date;
  quanto int;
  persona uuid;
  nuovo pagamenti_diretti;
  k uuid;
  r ricevute;
  libero int;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'il pagamento lo registra la segreteria' using errcode = '42501'; end if;
  begin
    persona := (dati->>'persona_id')::uuid;
  exception when others then
    raise exception 'Manca la persona' using errcode = '22023';
  end;
  if persona is null or not exists (select 1 from persone where id = persona) then
    raise exception 'Questa scheda non c’è più' using errcode = '22023';
  end if;
  begin
    giorno := (dati->>'data')::date;
  exception when others then
    raise exception 'La data del pagamento non si capisce' using errcode = '22023';
  end;
  if giorno is null then raise exception 'Serve la data del pagamento' using errcode = '22023'; end if;
  if giorno not between date '2000-01-01' and date '2100-12-31' then raise exception 'La data del pagamento non torna' using errcode = '22023'; end if;
  if giorno > contabilita_oggi() then raise exception 'La data è nel futuro: si registra quel che è già successo' using errcode = '22023'; end if;
  begin
    quanto := (dati->>'importo')::int;
  exception when others then
    raise exception 'L’importo non si capisce' using errcode = '22023';
  end;
  if quanto is null or quanto <= 0 then raise exception 'L’importo deve essere più di zero' using errcode = '22023'; end if;
  if quanto > 10000000 then raise exception 'L’importo è troppo alto: controlla le cifre' using errcode = '22023'; end if;
  -- `->>` farebbe testo anche di un oggetto o di una lista: metodo e voce devono essere testo.
  if jsonb_typeof(dati->'metodo') is distinct from 'string' then raise exception 'Scegli come ha pagato' using errcode = '22023'; end if;
  if jsonb_typeof(dati->'voce') is distinct from 'string' then raise exception 'Scrivi a cosa serve il pagamento' using errcode = '22023'; end if;
  if coalesce(btrim(dati->>'metodo'), '') = '' then raise exception 'Scegli come ha pagato' using errcode = '22023'; end if;
  if char_length(btrim(dati->>'metodo')) > 40 then raise exception 'Il modo di pagamento è troppo lungo' using errcode = '22023'; end if;
  if coalesce(btrim(dati->>'voce'), '') = '' then raise exception 'Scrivi a cosa serve il pagamento' using errcode = '22023'; end if;
  if char_length(btrim(dati->>'voce')) > 120 then raise exception 'La voce è troppo lunga' using errcode = '22023'; end if;
  if char_length(coalesce(dati->>'nota', '')) > 300 then raise exception 'La nota è troppo lunga: al massimo 300 caratteri' using errcode = '22023'; end if;
  -- I contanti entrano nella Cassa Contanti: in un giorno già chiuso romperebbero la chiusura. Carta e bonifico non la toccano.
  if lower(btrim(dati->>'metodo')) = 'contanti' and cassa_giorno_chiuso((select id from casse where nome = 'Cassa Contanti'), giorno) then
    raise exception 'Quel giorno la cassa è già chiusa: scegli una data dopo la chiusura' using errcode = '22023';
  end if;

  -- Ripreso dopo «Lascia stare»: se la ricevuta di quel modulo è stata fatta (la risposta persa con la rete), i soldi sono già lì.
  k := chiave_ricevuta(dati);
  select * into r from ricevute where chiave = k and persona_id = persona and annullata_il is null;
  if r.id is not null then
    raise exception 'Questo pagamento è già nella ricevuta n. %/%: non va registrato di nuovo', r.numero, r.anno using errcode = '22023';
  end if;
  -- Un Satispay arrivato dal modulo e non ancora in una ricevuta: va fatta la ricevuta con quelli, non un pagamento a mano sopra.
  -- Lo stesso con la carta: ogni circuito guarda solo i suoi soldi.
  if lower(btrim(dati->>'metodo')) in ('satispay', 'carta') then
    select sum(s.importo) into libero from pagamenti_satispay s
      where s.persona_id = persona and s.stato = 'pagato' and s.circuito = lower(btrim(dati->>'metodo'))
        and not exists (select 1 from ricevute x where x.id = s.ricevuta_id and x.annullata_il is null);
    if libero > 0 then
      raise exception '% sono già arrivati % € dal modulo: fai la ricevuta con quelli',
        case when lower(btrim(dati->>'metodo')) = 'carta' then 'Con la carta' else 'Con Satispay' end, soldi_sql(libero)
        using errcode = '22023';
    end if;
  end if;

  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, nota, creato_da)
  values (persona, giorno, quanto, btrim(dati->>'metodo'), btrim(dati->>'voce'), nullif(btrim(coalesce(dati->>'nota', '')), ''), persona_corrente())
  returning * into nuovo;
  return to_jsonb(nuovo);
end $$;

-- La Edge Function di Satispay prende l'id del pagamento da chi la chiama: con quello di una carta non vede e non scrive.
create or replace function satispay_creato(id uuid, satispay_id text, link text) returns void
  language sql security definer set search_path = public as $$
  update pagamenti_satispay p set satispay_id = $2, link = $3
    where p.id = $1 and p.circuito = 'satispay' and p.stato = 'attesa' and p.satispay_id is null
$$;
create or replace function satispay_stato_pagamento(pagamento uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('stato', p.stato, 'importo', p.importo, 'pagato_il', p.pagato_il, 'satispay_id', p.satispay_id,
    'collegato', p.preso_il is not null)
    from pagamenti_satispay p where p.id = pagamento and p.circuito = 'satispay'
$$;

-- `invia_iscrizione` la chiamano `anon` e `authenticated` (06-iscrizioni.sql dà il grant, `create or replace` lo tiene).
revoke all on function emetti_ricevuta_satispay(jsonb, uuid), registra_pagamento_diretto(jsonb) from public, anon;
grant execute on function emetti_ricevuta_satispay(jsonb, uuid), registra_pagamento_diretto(jsonb) to authenticated;

notify pgrst, 'reload schema';
