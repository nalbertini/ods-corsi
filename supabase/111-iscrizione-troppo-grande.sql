-- ---------------------------------------------------------------------------
-- 111 · Una richiesta d'iscrizione enorme si rifiuta all'ingresso
--
-- L'audit RLS del 2026-10-24: `invia_iscrizione`, che chiunque (anche senza
-- accesso) può chiamare, non guardava la dimensione di `dati`: una chiave
-- sconosciuta da 5 MB veniva letta e poi scartata. `invia_ordine_vestiario`
-- (47) la guardia ce l'ha. Qui la stessa: oltre 64 kB (una richiesta vera ne
-- fa meno di 10) si risponde 22023 con un testo per chi usa il modulo, prima
-- di leggere altro. Il resto è la funzione di `100-nucleo.sql`, com'era.
--
-- Si lancia dopo `109-privilegi-e-certificati.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, il modulo funziona come prima.
-- Rilanciando `100-nucleo.sql` (o `06`, `74`, `83`, `84`) va rilanciato anche questo.
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
  -- Il pagamento Satispay fatto prima, in fondo al modulo (83-satispay-prima.sql): la richiesta lo prende con sé.
  pagato uuid;
  p pagamenti_satispay;
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

-- Come prima: la chiamano `anon` e `authenticated` (06-iscrizioni.sql dà il grant, `create or replace` lo tiene).
notify pgrst, 'reload schema';
