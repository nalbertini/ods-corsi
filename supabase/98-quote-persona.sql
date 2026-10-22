-- La contabilità: le quote e i corsi scritti a mano hanno la persona che ha pagato.
--
-- Fin qui si collegava a una persona solo lo storico del vecchio programma (70-movimenti-persona.sql). Ora anche
-- un'entrata scritta a mano in CONTABILITÀ (Nuovo movimento, o spostata lì cambiando voce) su «Quota associativa» o «Corsi e
-- altri pagamenti» ha la sua persona, ed è obbligatoria: senza, non si registra (`registra_movimento`) e la voce non
-- si cambia in una di quelle due (`cambia_voce_movimenti`, una riga alla volta, con la persona). Lo storico del
-- vecchio programma resta com'era: il collegamento è facoltativo e la voce si cambia anche in blocco.
--
-- Come per lo storico la persona è un'etichetta: non cambia importo, saldi, bilancio né chiusure, e la quota non
-- conta come pagata (gli incassi degli iscritti restano ricevute e pagamenti). Nella scheda il movimento esce fra
-- i pagamenti, segnato «Scritto in contabilità» e mai sommato (`storico_persona` dice quali sono scritti a mano).
--
-- Chi può cosa: come nei file 60, 67 e 70. Registra, cambia voce e collega solo l'amministrazione
-- (`contabilita_porta()`); lo storico lo legge chi vede la scheda. Ogni collegamento lascia la sua traccia in
-- `collegamenti_persona`, anche quello scritto registrando il movimento.
--
-- Le regole sono quelle di src/lib/contabilita.ts (`cosaNonVaMovimento`, `cosaNonVaCambioVoce`),
-- src/lib/movimentiPersona.ts (`cosaNonVaCollegato`) e della modalità prova, provate da supabase/prova/quote-persona.sql.
--
-- Si lancia dopo `60-chiusura-cassa.sql`, `67-cambia-voce.sql` e `70-movimenti-persona.sql`, e cambia una funzione
-- di ognuno: chi rilancia uno di quei tre rilancia poi anche questo. Non chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, l'app registra le quote e i corsi senza persona (la persona scelta non si salva, senza avviso) e
-- il cambio voce con la persona dice di lanciare questo file.
-- ---------------------------------------------------------------------------

-- Una quota o un corso: la voce che vuole la persona, se è un'entrata.
create or replace function voce_vuole_persona(tipo text, voce uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select tipo = 'entrata' and exists (
    select 1 from voci_contabili v where v.id = voce and v.di_sistema and v.nome in ('Quota associativa', 'Corsi e altri pagamenti')) $$;

-- Perché no: come in 70, ma ora si collegano anche le entrate scritte a mano.
create or replace function collegamento_perche(m movimenti) returns text
  language plpgsql stable security definer set search_path = public as $$
declare
  q text := 'Il movimento del ' || to_char(m.data, 'DD/MM/YYYY') || ' (' || m.descrizione || ')';
  v voci_contabili;
begin
  if m.annullato_il is not null then return q || ' è annullato: non si collega'; end if;
  if m.tipo = 'giroconto' then return 'Un giroconto non ha una persona'; end if;
  select * into v from voci_contabili where id = m.voce_id;
  if v.di_sistema and v.nome = 'Differenza di cassa' then return q || ' è scritto dalla chiusura di cassa: non si collega'; end if;
  if m.tipo = 'uscita' then return q || ' è un’uscita: si collegano solo le entrate'; end if;
  if v.nome not in ('Quota associativa', 'Corsi e altri pagamenti') then
    return q || ' è su «' || v.nome || '»: si collegano solo quelli su «Quota associativa» e «Corsi e altri pagamenti»';
  end if;
  return null;
end $$;

-- Come in 60, più la persona: obbligatoria per una quota o un corso, ignorata sulle altre voci.
create or replace function registra_movimento(dati jsonb) returns movimenti
  language plpgsql security definer set search_path = public as $$
declare
  c record;
  v voci_contabili;
  ca casse;
  r movimenti;
  t text := dati->>'tipo';
  d text := contabilita_testo(dati, 'descrizione');
  chi uuid;
begin
  perform contabilita_porta();
  if t is null or t not in ('entrata', 'uscita') then raise exception 'Scegli se è un’entrata o un’uscita' using errcode = '22023'; end if;
  select * into c from movimento_comune(dati);
  select * into v from voci_contabili where id = contabilita_id(dati, 'voce_id', 'Scegli la voce');
  if not found then raise exception 'Scegli la voce' using errcode = '22023'; end if;
  if v.tipo <> t then raise exception 'La voce scelta non va con questo tipo di movimento' using errcode = '22023'; end if;
  if not v.attiva then raise exception 'La voce non è più in uso: scegline un’altra' using errcode = '22023'; end if;
  if v.di_sistema and v.nome = 'Differenza di cassa' then raise exception 'La «Differenza di cassa» si scrive da sola chiudendo la cassa' using errcode = '22023'; end if;
  if voce_vuole_persona(t, v.id) then
    chi := contabilita_id(dati, 'persona_id', 'Scegli la persona');
    -- for share: chi cancella la scheda nello stesso momento aspetta, e il movimento non resta con una persona che non c'è
    perform 1 from persone p where p.id = chi for share;
    if not found then raise exception 'Scegli la persona' using errcode = '22023'; end if;
  end if;
  select * into ca from casse where id = contabilita_id(dati, 'cassa_id', 'Scegli la cassa') for share;
  if not found then raise exception 'Scegli la cassa' using errcode = '22023'; end if;
  if ca.dal is not null and c.giorno < ca.dal then raise exception 'La data è prima dell’inizio della cassa' using errcode = '22023'; end if;
  if cassa_giorno_chiuso(ca.id, c.giorno) then raise exception 'Quel giorno è già chiuso: per correggere scrivi il movimento con una data dopo la chiusura e una voce di rettifica (si crea in VOCI), oppure annulla la chiusura' using errcode = '22023'; end if;
  if d = '' then raise exception 'Scrivi una descrizione' using errcode = '22023'; end if;
  if char_length(d) > 200 then raise exception 'La descrizione è troppo lunga: al massimo 200 caratteri' using errcode = '22023'; end if;
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, nota, creato_da)
  values (t, c.giorno, c.importo, v.id, ca.id, d, c.nota, persona_corrente())
  returning * into r;
  if chi is not null then
    perform collegamento_scrivi(r, chi, null);
    r.persona_id := chi;
  end if;
  return r;
end $$;

-- Come in 67, più la persona: un movimento a mano che va su una quota o un corso ci va da solo, con la persona.
-- La versione a due argomenti se ne va: una chiamata a due argomenti trova questa, con la persona vuota.
drop function if exists cambia_voce_movimenti(uuid[], uuid);
create or replace function cambia_voce_movimenti(ids uuid[], voce uuid, persona uuid default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  elenco uuid[];
  v voci_contabili;
  m movimenti;
  cambiati integer := 0;
  gia integer := 0;
  a_mano integer := 0;
begin
  perform contabilita_porta();
  -- lo stesso id due volte conta una
  select coalesce(array_agg(distinct x order by x), '{}') into elenco from unnest(ids) x where x is not null;
  if cardinality(elenco) = 0 then raise exception 'Scegli almeno un movimento' using errcode = '22023'; end if;
  if cardinality(elenco) > 500 then raise exception 'Troppi movimenti in una volta: al massimo 500' using errcode = '22023'; end if;
  -- for share: chi spegne la voce nello stesso momento aspetta, e una voce appena spenta non riceve movimenti
  select * into v from voci_contabili x where x.id = cambia_voce_movimenti.voce for share;
  if not found then raise exception 'Scegli la voce' using errcode = '22023'; end if;
  if not v.attiva then raise exception 'La voce non è più in uso: scegline un’altra' using errcode = '22023'; end if;
  if v.di_sistema and v.nome = 'Differenza di cassa' then raise exception 'La «Differenza di cassa» si scrive da sola chiudendo la cassa' using errcode = '22023'; end if;
  if (select count(*) from movimenti x where x.id = any(elenco)) <> cardinality(elenco) then
    raise exception 'Il movimento non c’è' using errcode = 'P0002';
  end if;
  -- le righe in ordine di id: due lotti insieme non si incrociano; e si rilegge lo stato dopo il blocco, come `annulla_movimento`
  for m in select * from movimenti x where x.id = any(elenco) order by x.id for update loop
    if m.annullato_il is not null then
      raise exception 'Il movimento del % (%) è annullato: non si cambia', to_char(m.data, 'DD/MM/YYYY'), m.descrizione using errcode = '22023';
    end if;
    if m.tipo = 'giroconto' then raise exception 'Un giroconto non ha voce' using errcode = '22023'; end if;
    if exists (select 1 from voci_contabili x where x.id = m.voce_id and x.di_sistema and x.nome = 'Differenza di cassa') then
      raise exception 'Il movimento del % (%) è scritto dalla chiusura di cassa: non si cambia', to_char(m.data, 'DD/MM/YYYY'), m.descrizione using errcode = '22023';
    end if;
    if m.tipo <> v.tipo then raise exception 'La voce scelta non va con questo tipo di movimento' using errcode = '22023'; end if;
    if m.voce_id <> v.id and voce_vuole_persona(m.tipo, v.id) and (m.origine_import is null or m.origine_import not like 'prima-nota:%') then
      a_mano := a_mano + 1;
    end if;
  end loop;
  if a_mano > 0 and cardinality(elenco) > 1 then
    raise exception 'Una quota o un corso si sposta una riga alla volta, con la persona: apri il movimento dall’elenco e cambia la voce lì.' using errcode = '22023';
  end if;
  if a_mano > 0 then
    -- for share: come in `registra_movimento`, la scheda non sparisce mentre si collega
    perform 1 from persone p where p.id = persona for share;
    if not found then raise exception 'Scegli la persona' using errcode = '22023'; end if;
  end if;
  for m in select * from movimenti x where x.id = any(elenco) order by x.id loop
    if m.voce_id = v.id then
      gia := gia + 1;
    else
      insert into cambi_voce (movimento_id, voce_prima_id, voce_dopo_id, cambiato_da) values (m.id, m.voce_id, v.id, persona_corrente());
      update movimenti x set voce_id = v.id where x.id = m.id;
      if a_mano > 0 and m.persona_id is distinct from persona then perform collegamento_scrivi(m, persona, null); end if;
      cambiati := cambiati + 1;
    end if;
  end loop;
  return jsonb_build_object('cambiati', cambiati, 'gia_cosi', gia);
end $$;

-- Come in 70, più `a_mano`: la scheda mette fra i pagamenti quelli scritti in CONTABILITÀ, a parte lo storico.
-- Cambia cosa rende: si toglie e si rifà.
drop function if exists storico_persona(uuid);
create or replace function storico_persona(persona uuid)
  returns table (id uuid, data date, descrizione text, importo integer, voce text, cassa text, a_mano boolean)
  language plpgsql security definer set search_path = public as $$
begin
  if not (e_staff() or e_amministrazione()) then
    raise exception 'lo storico lo vedono segreteria e amministrazione' using errcode = '42501';
  end if;
  return query
    select m.id, m.data, m.descrizione, m.importo, v.nome, c.nome,
           m.origine_import is null or m.origine_import not like 'prima-nota:%'
    from movimenti m join voci_contabili v on v.id = m.voce_id join casse c on c.id = m.cassa_id
    where m.persona_id = storico_persona.persona and m.annullato_il is null
    order by m.data desc, m.id;
end $$;

revoke all on function voce_vuole_persona(text, uuid), collegamento_perche(movimenti) from public, anon, authenticated;
revoke all on function registra_movimento(jsonb), cambia_voce_movimenti(uuid[], uuid, uuid), storico_persona(uuid) from public, anon;
grant execute on function registra_movimento(jsonb), cambia_voce_movimenti(uuid[], uuid, uuid), storico_persona(uuid) to authenticated;

-- Che l'API veda subito le funzioni nuove, senza aspettare.
notify pgrst, 'reload schema';
