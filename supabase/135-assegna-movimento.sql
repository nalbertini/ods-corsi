-- ODS Corsi · il bonifico collegato a una persona diventa pagamento di quota e corsi
--
-- Un movimento di entrata in CONTABILITÀ, collegato a una persona, si assegna alle cose che deve pagare (la quota, un
-- corso, saldo o parziale), e da lì si fa la ricevuta, senza un secondo movimento e senza contare due volte i soldi:
--   · `assegna_movimento(movimento, righe)` scrive una riga di `pagamenti_diretti` per voce, con `movimento_id`, metodo
--     Bonifico e la data del movimento, o tutte o nessuna. Solo entrate attive su «Quota associativa» o «Corsi e altri
--     pagamenti», non in Cassa Contanti (i contanti passano da PAGAMENTI), solo a chi è nel nucleo della persona del
--     movimento, mai più di quel che resta da assegnare. Un bonifico del vecchio programma (`origine_import` che
--     comincia con `prima-nota:`) si assegna solo dall'inizio della stagione in corso (1 agosto, ora di Roma, come
--     in `71`): quelli prima restano storico, se no tornerebbero a contare pagamenti di anni chiusi. Le righe non toccano il previsto delle casse (conta solo i
--     contanti), per questo si assegna anche in un giorno chiuso;
--   · `emetti_ricevuta_da_movimento(dati, movimento)` fa la ricevuta di una persona con dentro i suoi soldi del bonifico,
--     così come sono, e nella stessa transazione le sue righe diventano della ricevuta (annullate, col `ricevuta_id`).
--     La ricevuta punta al movimento (`ricevute.movimento_id`). Con la chiave del modulo, ripetuta dà la stessa;
--   · `abbina_ricevuta_movimento(movimento, ricevuta)`, per «Collegati prima»: una ricevuta fatta a parte prima di questo
--     file si lega al suo bonifico (stessa persona, stesso importo, tutta in Bonifico, entro 30 giorni);
--   · `annulla_ricevuta`, rifatta: la ricevuta di un bonifico, annullata, non rimette attive le righe da cui viene: i
--     soldi tornano da assegnare. Nemmeno quella abbinata da «Collegati prima», che ha i soldi nel bonifico. Le altre
--     vanno come in `89`;
--   · `annulla_movimento`, rifatta: con una ricevuta attiva del movimento dice di annullare prima quella; senza, annulla
--     anche le righe assegnate;
--   · il trigger `assegnazione_solo_dal_movimento`: una riga assegnata da un bonifico non diventa ricevuta da FANNE LA
--     RICEVUTA (`emetti_ricevuta_da_pagamento`), che farebbe una ricevuta senza `movimento_id` e i soldi contati due
--     volte; la ricevuta si fa dal movimento;
--   · il trigger `movimento_assegnato_resta`: un movimento con soldi assegnati non cambia persona, non va su una voce che
--     non si assegna, e annullato da qualunque parte (anche `annulla_importazione_banca`) fa come `annulla_movimento`.
-- Quel che resta da assegnare di un movimento è l'importo, meno le righe attive, meno il pagato delle ricevute attive.
-- Chi può cosa: assegnare e abbinare solo l'amministrazione (è contabilità); la ricevuta segreteria e amministrazione,
-- come `emetti_ricevuta`. Il rifiuto del ruolo viene prima di tutto.
-- Le stesse regole stanno in `src/lib/assegna.ts` e nella modalità prova.
--
-- Si lancia dopo `60-chiusura-cassa.sql`, `89-pagamento-diventa-ricevuta.sql` e `128-ricevuta-pagamento-perso.sql`;
-- rifà `annulla_movimento` di `60` e `annulla_ricevuta` di `89`: se si rilancia uno di quei due, va rilanciato anche
-- questo (`controllo.sql` lo dice). Non chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, ASSEGNA dice di lanciare questo file, e il resto dell'app va come prima.
-- ---------------------------------------------------------------------------

-- Da quale bonifico vengono i soldi: la riga assegnata e la ricevuta che li contiene.
alter table pagamenti_diretti add column if not exists movimento_id uuid references movimenti on delete restrict;
alter table ricevute add column if not exists movimento_id uuid references movimenti on delete restrict;
create index if not exists pagamenti_diretti_movimento on pagamenti_diretti (movimento_id) where movimento_id is not null;
create index if not exists ricevute_movimento on ricevute (movimento_id) where movimento_id is not null;

-- Gli euro come li scrive l'app nei messaggi (`euroAssegna`): «1.234,50 €».
create or replace function euro_assegna(cent int) returns text language sql immutable set search_path = public as $$
  select replace(replace(replace(to_char(cent / 100.0, 'FM999,999,990.00'), ',', '#'), '.', ','), '#', '.') || ' €'
$$;

-- Il movimento, bloccato, se si può assegnare; se no il perché, con le parole di `cosaNonVaMovimentoDaAssegnare`.
create or replace function movimento_da_assegnare(movimento uuid) returns movimenti
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  voce text;
begin
  select * into m from movimenti where id = movimento for update;
  if m.id is null then raise exception 'Il movimento non c’è più: ricarica la pagina.' using errcode = '22023'; end if;
  if m.annullato_il is not null then raise exception 'Il movimento è annullato: non si assegna.' using errcode = '22023'; end if;
  if m.tipo::text <> 'entrata' then raise exception 'Un’uscita non si assegna: si assegnano solo le entrate.' using errcode = '22023'; end if;
  if m.persona_id is null then raise exception 'Collega prima il movimento a una persona.' using errcode = '22023'; end if;
  select nome into voce from voci_contabili where id = m.voce_id;
  if voce is distinct from 'Quota associativa' and voce is distinct from 'Corsi e altri pagamenti' then
    raise exception 'Si assegnano solo le entrate su «Quota associativa» e «Corsi e altri pagamenti».' using errcode = '22023';
  end if;
  if (select nome from casse where id = m.cassa_id) = 'Cassa Contanti' then
    raise exception 'I contanti non si assegnano da qui: registra il pagamento in PAGAMENTI.' using errcode = '22023';
  end if;
  -- Lo storico del vecchio programma solo dalla stagione di oggi, dal 1° agosto a Roma (lo stesso confine di 71):
  -- quello delle stagioni passate non ha niente da pagare a cui andare.
  if m.origine_import like 'prima-nota:%' and m.data < make_date(extract(year from (now() at time zone 'Europe/Rome'))::int
       - case when extract(month from (now() at time zone 'Europe/Rome')) >= 8 then 0 else 1 end, 8, 1) then
    raise exception 'Questo bonifico è del vecchio programma, di una stagione passata: resta nello storico, non si assegna.' using errcode = '22023';
  end if;
  return m;
end $$;

-- Quanto del movimento è già di qualcuno: le righe attive più il pagato delle ricevute attive.
create or replace function movimento_assegnato(movimento uuid) returns int
  language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(importo) from pagamenti_diretti where movimento_id = movimento and annullato_il is null), 0)
        + coalesce((select sum(pagato) from ricevute where movimento_id = movimento and annullata_il is null), 0))::int
$$;

create or replace function assegna_movimento(movimento uuid, righe jsonb) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  titolare persone;
  r jsonb;
  chi persone;
  totale int := 0;
  quanto int;
begin
  perform contabilita_porta();
  m := movimento_da_assegnare(movimento);
  -- Il nucleo come `personeDelNucleo`: il titolare (o la persona stessa) e chi è attivo nel suo nucleo.
  select * into titolare from persone where id = (select coalesce(nucleo, id) from persone where id = m.persona_id);
  if jsonb_typeof(righe) is distinct from 'array' or jsonb_array_length(righe) = 0 then
    raise exception 'Metti almeno un importo su una voce.' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(righe) loop
    begin
      chi := null;
      select * into chi from persone where id = (r->>'persona_id')::uuid;
    exception when others then chi := null;
    end;
    if chi.id is null or not (chi.id = titolare.id or (chi.attiva and chi.nucleo is not distinct from titolare.id)) then
      raise exception '% non è nella famiglia di % %: il bonifico si assegna solo a chi è nel suo nucleo.',
        coalesce(chi.cognome || ' ' || chi.nome, 'Questa persona'), titolare.cognome, titolare.nome using errcode = '22023';
    end if;
  end loop;
  for r in select * from jsonb_array_elements(righe) loop
    begin
      quanto := (r->>'importo')::int;
    exception when others then quanto := null;
    end;
    if quanto is null or quanto <= 0 then raise exception 'Metti su ogni voce un importo maggiore di zero.' using errcode = '22023'; end if;
    if jsonb_typeof(r->'voce') is distinct from 'string' or btrim(r->>'voce') = '' then
      raise exception 'Scrivi a cosa serve ogni importo.' using errcode = '22023';
    end if;
    totale := totale + quanto;
  end loop;
  if totale > m.importo - movimento_assegnato(m.id) then
    raise exception 'Hai assegnato % più del bonifico: togli da una voce.', euro_assegna(totale - (m.importo - movimento_assegnato(m.id))) using errcode = '22023';
  end if;
  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, creato_da, movimento_id)
    select (x->>'persona_id')::uuid, m.data, (x->>'importo')::int, 'Bonifico', btrim(x->>'voce'), persona_corrente(), m.id
    from jsonb_array_elements(righe) x;
end $$;

create or replace function emetti_ricevuta_da_movimento(dati jsonb, movimento uuid) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  gia ricevute;
  persona uuid;
  sua int;
  somma int;
  fuori int;
  nuova jsonb;
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la fa la segreteria' using errcode = '42501'; end if;
  persona := nullif(dati->>'persona_id', '')::uuid;
  -- Prima la chiave: ripetuta dopo una rete caduta, la stessa chiamata dà la ricevuta già fatta.
  gia := ricevuta_gia_fatta(chiave_ricevuta(dati), persona);
  if gia.id is not null and gia.movimento_id = movimento then return to_jsonb(gia); end if;
  if gia.id is not null then
    raise exception 'La ricevuta n. %/% fatta da questo modulo non è di questo bonifico: chiudi il modulo e riaprilo', gia.numero, gia.anno using errcode = '22023';
  end if;
  m := movimento_da_assegnare(movimento);
  select coalesce(sum(importo), 0)::int into sua from pagamenti_diretti
    where movimento_id = m.id and persona_id = persona and annullato_il is null;
  perform 1 from pagamenti_diretti where movimento_id = m.id and persona_id = persona and annullato_il is null for update;
  if sua = 0 then raise exception 'Non c’è niente di assegnato a questa persona su questo bonifico.' using errcode = '22023'; end if;
  nuova := emetti_ricevuta(dati);
  -- Si guarda la ricevuta come l'ha scritta `emetti_ricevuta`: tutto Bonifico, alla data del movimento, per quel che è
  -- assegnato a lei. Il rifiuto disfa anche la ricevuta.
  select coalesce(sum((pg->>'importo')::int), 0),
         count(*) filter (where lower(btrim(pg->>'metodo')) <> 'bonifico' or (pg->>'data')::date is distinct from m.data)
    into somma, fuori
    from jsonb_array_elements(nuova->'voci') v, jsonb_array_elements(coalesce(v->'pagamenti', '[]')) pg
    where (pg->>'importo')::int > 0;
  if fuori > 0 or somma <> sua then
    raise exception 'Il bonifico va nella ricevuta così com’è: rimettilo, o torna ad «Assegna» per cambiare gli importi.' using errcode = '22023';
  end if;
  update ricevute set movimento_id = m.id where id = (nuova->>'id')::uuid;
  update pagamenti_diretti set annullato_il = now(), annullato_da = persona_corrente(), ricevuta_id = (nuova->>'id')::uuid
    where movimento_id = m.id and persona_id = persona and annullato_il is null;
  return nuova || jsonb_build_object('movimento_id', m.id);
end $$;

create or replace function abbina_ricevuta_movimento(movimento uuid, ricevuta uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  r ricevute;
begin
  perform contabilita_porta();
  m := movimento_da_assegnare(movimento);
  select * into r from ricevute where id = ricevuta for update;
  if r.id is null then raise exception 'La ricevuta non c’è più: ricarica la pagina.' using errcode = '22023'; end if;
  -- Gli stessi controlli, nello stesso ordine, di `cosaNonVaAbbinamento`.
  if r.annullata_il is not null then raise exception 'La ricevuta è annullata.' using errcode = '22023'; end if;
  if r.movimento_id is not null and r.movimento_id <> m.id then
    raise exception 'La ricevuta n. %/% è già abbinata a un altro bonifico.', r.numero, r.anno using errcode = '22023';
  end if;
  if r.persona_id is distinct from m.persona_id then raise exception 'La ricevuta è di un’altra persona.' using errcode = '22023'; end if;
  if r.pagato <> m.importo then raise exception 'La ricevuta e il bonifico non hanno lo stesso importo.' using errcode = '22023'; end if;
  if not exists (select 1 from jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]')) pg)
     or exists (select 1 from jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]')) pg
                where lower(btrim(pg->>'metodo')) <> 'bonifico') then
    raise exception 'La ricevuta non è tutta pagata con bonifico.' using errcode = '22023';
  end if;
  if abs(r.data - m.data) > 30 then raise exception 'La ricevuta e il bonifico distano più di 30 giorni.' using errcode = '22023'; end if;
  if r.movimento_id = m.id then return; end if;
  if movimento_assegnato(m.id) > 0 then
    raise exception 'Il bonifico ha già dei soldi assegnati: annulla prima le ricevute e le assegnazioni.' using errcode = '22023';
  end if;
  update ricevute set movimento_id = m.id where id = r.id;
end $$;

-- La stessa di `89`, ma le righe che vengono da un bonifico restano annullate: i soldi tornano da assegnare, non
-- diventano un pagamento a mano.
create or replace function annulla_ricevuta(ricevuta uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (e_staff() or e_amministrazione()) then raise exception 'la ricevuta la annulla la segreteria' using errcode = '42501'; end if;
  update ricevute set annullata_il = now(), annullata_da = persona_corrente() where id = ricevuta and annullata_il is null;
  if not found then raise exception 'ricevuta inesistente o già annullata' using errcode = 'P0002'; end if;
  -- Una ricevuta abbinata a un bonifico («Collegati prima») ha i soldi nel bonifico: annullata, quei soldi tornano da
  -- assegnare lì. Rimettere attivo anche il suo pagamento a mano li conterebbe due volte.
  if (select x.movimento_id from ricevute x where x.id = ricevuta) is not null then return; end if;
  update pagamenti_diretti set annullato_il = null, annullato_da = null, ricevuta_id = null
    where ricevuta_id = ricevuta and movimento_id is null;
end $$;

-- La stessa di `60`, più le ricevute e le righe del movimento.
create or replace function annulla_movimento(id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  r ricevute;
begin
  perform contabilita_porta();
  select * into m from movimenti x where x.id = annulla_movimento.id;
  if not found then raise exception 'Il movimento non c’è' using errcode = 'P0002'; end if;
  -- le casse in fila con chi chiude nello stesso momento (come `registra_movimento`), poi si rilegge il movimento
  perform 1 from casse c where c.id in (m.cassa_id, m.cassa_a_id) order by c.id for share;
  select * into m from movimenti x where x.id = annulla_movimento.id for update;
  if m.annullato_il is not null then raise exception 'Il movimento è già annullato' using errcode = 'P0002'; end if;
  -- Una ricevuta del bonifico ha dentro questi soldi: annullato il movimento, conterebbe soldi che non ci sono.
  select * into r from ricevute x where x.movimento_id = m.id and x.annullata_il is null order by x.anno, x.numero limit 1;
  if r.id is not null then raise exception 'Annulla prima la ricevuta n. %/%', r.numero, r.anno using errcode = '22023'; end if;
  if cassa_giorno_chiuso(m.cassa_id, m.data) or (m.cassa_a_id is not null and cassa_giorno_chiuso(m.cassa_a_id, m.data)) then
    raise exception 'Quel giorno è già chiuso: annulla prima la chiusura, o scrivi una rettifica con una data dopo la chiusura' using errcode = '22023';
  end if;
  update movimenti x set annullato_il = now(), annullato_da = persona_corrente() where x.id = m.id;
  update pagamenti_diretti x set annullato_il = now(), annullato_da = persona_corrente() where x.movimento_id = m.id and x.annullato_il is null;
end $$;

-- Un'assegnazione diventa ricevuta solo dal movimento: da FANNE LA RICEVUTA (`emetti_ricevuta_da_pagamento`) la
-- ricevuta non punterebbe al movimento e in CONTABILITÀ quei soldi conterebbero due volte. `emetti_ricevuta_da_movimento`
-- lega prima la ricevuta al movimento, poi le righe: qui passa.
create or replace function assegnazione_solo_dal_movimento() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.movimento_id is not null and new.ricevuta_id is not null and new.ricevuta_id is distinct from old.ricevuta_id
     and (select movimento_id from ricevute where id = new.ricevuta_id) is distinct from new.movimento_id then
    raise exception 'Questi soldi vengono da un bonifico: la ricevuta si fa dal movimento, in CONTABILITÀ.' using errcode = '22023';
  end if;
  return new;
end $$;
create or replace trigger assegnazione_solo_dal_movimento before update of ricevuta_id on pagamenti_diretti
  for each row execute function assegnazione_solo_dal_movimento();
revoke all on function assegnazione_solo_dal_movimento() from public, anon, authenticated;

-- Un bonifico con soldi assegnati (righe attive o ricevute) resta com'è, da qualunque parte arrivi il cambio:
--   · annullato (anche da `annulla_importazione_banca`, che non passa da `annulla_movimento`): con una ricevuta attiva
--     no, se no la ricevuta conterebbe soldi che non ci sono; senza, si annullano anche le assegnazioni;
--   · un'altra persona, o nessuna (collega, scollega, togli il lotto, cambia voce): i soldi assegnati sono di chi è nel
--     nucleo della persona di prima;
--   · un'altra voce, se non è più una che si assegna: i soldi resterebbero assegnati da un movimento che non si assegna.
create or replace function movimento_assegnato_resta() returns trigger
  language plpgsql security definer set search_path = public as $$
declare r ricevute;
begin
  if new.annullato_il is not null and old.annullato_il is null then
    select * into r from ricevute x where x.movimento_id = old.id and x.annullata_il is null order by x.anno, x.numero limit 1;
    if r.id is not null then raise exception 'Annulla prima la ricevuta n. %/%', r.numero, r.anno using errcode = '22023'; end if;
    update pagamenti_diretti x set annullato_il = now(), annullato_da = persona_corrente() where x.movimento_id = old.id and x.annullato_il is null;
    return new;
  end if;
  if (new.persona_id is distinct from old.persona_id
      or (new.voce_id is distinct from old.voce_id
          and not exists (select 1 from voci_contabili v where v.id = new.voce_id and v.tipo = 'entrata'
                            and v.nome in ('Quota associativa', 'Corsi e altri pagamenti'))))
     and movimento_assegnato(old.id) > 0 then
    raise exception 'Il movimento ha dei soldi assegnati: annulla prima ricevute e assegnazioni.' using errcode = '22023';
  end if;
  return new;
end $$;
create or replace trigger movimento_assegnato_resta before update of annullato_il, persona_id, voce_id on movimenti
  for each row execute function movimento_assegnato_resta();
revoke all on function movimento_assegnato_resta() from public, anon, authenticated;

revoke all on function euro_assegna(int), movimento_da_assegnare(uuid), movimento_assegnato(uuid) from public, anon, authenticated;
revoke all on function assegna_movimento(uuid, jsonb), emetti_ricevuta_da_movimento(jsonb, uuid), abbina_ricevuta_movimento(uuid, uuid),
  annulla_ricevuta(uuid), annulla_movimento(uuid) from public, anon;
grant execute on function assegna_movimento(uuid, jsonb), emetti_ricevuta_da_movimento(jsonb, uuid), abbina_ricevuta_movimento(uuid, uuid),
  annulla_ricevuta(uuid), annulla_movimento(uuid) to authenticated;

notify pgrst, 'reload schema';
