-- ---------------------------------------------------------------------------
-- ODS Corsi · «Collegati prima»: un bonifico Da classificare si abbina solo alla ricevuta di chi la causale nomina
--
-- Con il 151 un bonifico Da classificare, senza persona, si abbinava a qualunque ricevuta in Bonifico dello stesso
-- importo entro 30 giorni: l'app proponeva la ricevuta di una famiglia che non c'entrava (un bonifico «DA ALLISIO
-- STEFANIA … Edoardo» con la ricevuta di un'altra persona, 19 giorni dopo). Ora, se il bonifico non ha persona, la
-- causale deve nominare con nome e cognome interi la persona della ricevuta, qualcuno del suo nucleo (il titolare, o chi
-- è attivo nel nucleo) o il genitore della loro anagrafica o richiesta accolta. Le parole sono quelle di
-- `abbina_testo_banca` (`parole_pagatori`, 121). Un bonifico che ha già una persona non cambia: vale il nucleo, come nel 151.
--
-- Chi può: solo l'amministrazione (`contabilita_porta`), come prima. Si lancia dopo `151-abbina-famiglia-da-classificare.sql`
-- e `121-punteggio-movimenti.sql`, e si può rilanciare; non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è,
-- l'app non propone più quelle ricevute, ma il database ne accetterebbe ancora una abbinata a mano.
-- La stessa regola in src/lib/assegna.ts (`cosaNonVaAbbinamento`) e nella modalità prova (segreteriaProva.ts).
-- ---------------------------------------------------------------------------

create or replace function abbina_ricevuta_movimento(movimento uuid, ricevuta uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  r ricevute;
  titolare persone;
  da_classificare boolean;
  voce text;
  t text[];
begin
  perform contabilita_porta();
  select * into m from movimenti where id = movimento for update;
  -- Da classificare: entrata attiva del Conto Corrente, non Satispay, non storico di una stagione passata (come 71 e 135).
  da_classificare := m.id is not null and m.annullato_il is null and m.tipo::text = 'entrata' and m.satispay_id is null
    and (select nome from voci_contabili where id = m.voce_id) = 'Da classificare'
    and (select nome from casse where id = m.cassa_id) = 'Conto Corrente'
    and not (coalesce(m.origine_import, '') like 'prima-nota:%' and m.data < make_date(extract(year from (now() at time zone 'Europe/Rome'))::int
      - case when extract(month from (now() at time zone 'Europe/Rome')) >= 8 then 0 else 1 end, 8, 1));
  if not da_classificare then m := movimento_da_assegnare(movimento); end if;
  select * into r from ricevute where id = ricevuta for update;
  if r.id is null then raise exception 'La ricevuta non c’è più: ricarica la pagina.' using errcode = '22023'; end if;
  -- Gli stessi controlli, nello stesso ordine, di `cosaNonVaAbbinamento`.
  if r.annullata_il is not null then raise exception 'La ricevuta è annullata.' using errcode = '22023'; end if;
  if r.movimento_id is not null and r.movimento_id <> m.id then
    raise exception 'La ricevuta n. %/% è già abbinata a un altro bonifico.', r.numero, r.anno using errcode = '22023';
  end if;
  if m.persona_id is not null and r.persona_id is distinct from m.persona_id then
    -- Il nucleo come `personeDelNucleo` e `assegna_movimento`: il titolare, o chi è attivo nel suo nucleo.
    select * into titolare from persone where id = (select coalesce(nucleo, id) from persone where id = m.persona_id);
    if not exists (select 1 from persone p where p.id = r.persona_id
                     and (p.id = titolare.id or (p.attiva and p.nucleo is not distinct from titolare.id))) then
      raise exception 'La ricevuta è di un’altra persona.' using errcode = '22023';
    end if;
  end if;
  -- Un bonifico senza persona la prende dalla ricevuta: una ricevuta senza persona non gliela può dare.
  if m.persona_id is null and r.persona_id is null then raise exception 'La ricevuta non ha una persona.' using errcode = '22023'; end if;
  -- Senza persona, la causale deve nominare (nome e cognome interi, in qualunque ordine) qualcuno del nucleo della ricevuta
  -- o il suo genitore: le parole di `abbina_testo_banca` (121), il nucleo di `personeDelNucleo`. Il genitore anche dalla
  -- richiesta accolta, come `genitori()` dell'app, così quel che l'app propone qui passa.
  if m.persona_id is null then
    t := parole_pagatori(m.descrizione);
    if not exists (
      select 1 from persone p
      where (p.id = (select coalesce(nucleo, id) from persone where id = r.persona_id)
             or (p.attiva and p.nucleo = (select coalesce(nucleo, id) from persone where id = r.persona_id)))
        and ((cardinality(parole_pagatori(p.nome || ' ' || p.cognome)) > 0 and parole_pagatori(p.nome || ' ' || p.cognome) <@ t)
        or exists (select 1 from (select a.genitore_nome g, a.genitore_cognome c from anagrafiche a where a.persona_id = p.id
                                  union all
                                  select q.genitore_nome, q.genitore_cognome from richieste_iscrizione q where q.persona_id = p.id and q.stato = 'accolta') x
                   where nullif(btrim(x.g), '') is not null and nullif(btrim(x.c), '') is not null and parole_pagatori(x.g || ' ' || x.c) <@ t))
    ) then
      raise exception 'La causale del bonifico non nomina la persona della ricevuta, il suo genitore o qualcuno della sua famiglia.' using errcode = '22023';
    end if;
  end if;
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
  if da_classificare then
    -- Come `voceDaRicevuta`: solo quota → «Quota associativa», se no «Corsi e altri pagamenti».
    voce := case when jsonb_array_length(r.voci) > 0
                  and not exists (select 1 from jsonb_array_elements(r.voci) v where lower(btrim(v->>'descrizione')) <> 'quota associativa')
                 then 'Quota associativa' else 'Corsi e altri pagamenti' end;
    -- Prima persona e voce, poi la ricevuta: `movimento_assegnato_resta` (135) guarda i soldi già assegnati, che qui sono zero.
    if not exists (select 1 from voci_contabili where nome = voce and tipo::text = 'entrata') then
      raise exception 'Manca la voce «%»: ricarica la pagina.', voce using errcode = '22023';
    end if;
    update movimenti set persona_id = coalesce(persona_id, r.persona_id), voce_id = (select id from voci_contabili where nome = voce and tipo::text = 'entrata')
      where id = m.id;
  end if;
  update ricevute set movimento_id = m.id where id = r.id;
end $$;

revoke all on function abbina_ricevuta_movimento(uuid, uuid) from public, anon;
grant execute on function abbina_ricevuta_movimento(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
