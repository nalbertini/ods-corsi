-- ---------------------------------------------------------------------------
-- ODS Corsi · Lo stesso bonifico non conta due volte: «Collegati prima» abbina anche la ricevuta di un familiare e i
-- bonifici Da classificare
--
-- Un bonifico arrivato in banca e la ricevuta in Bonifico fatta a parte contavano due volte nel Conto Corrente (il
-- movimento e l'incasso della ricevuta) quando `abbina_ricevuta_movimento` (135) non poteva legarli:
--   · il bonifico l'ha fatto il genitore e la ricevuta è del figlio: ora va bene una ricevuta del nucleo della persona
--     del bonifico, con la stessa regola di `assegna_movimento` (il titolare, o chi è attivo nel suo nucleo);
--   · il bonifico è ancora «Da classificare», senza persona: ora si abbina se è un'entrata attiva del Conto Corrente,
--     non di Satispay e non storico del vecchio programma di una stagione passata. Nella stessa transazione prende la
--     persona della ricevuta (se ne ha già una la tiene, e la ricevuta dev'essere del suo nucleo) e la voce: «Quota associativa» se la ricevuta è solo quota, se no «Corsi e altri pagamenti»
--     (come `voceDaRicevuta` in src/lib/assegna.ts). Chi lo propone e chi clicca è l'app: qui si ricontrolla tutto.
-- Il resto non cambia: stesso importo, tutta in Bonifico, entro 30 giorni, una ricevuta a un solo bonifico, un bonifico
-- con soldi già assegnati non si abbina; annullando la ricevuta il bonifico resta (con la persona e la voce prese) e
-- torna da assegnare (`annulla_ricevuta` del 135).
--
-- Chi può: solo l'amministrazione (`contabilita_porta`), come prima. Si lancia dopo `135-assegna-movimento.sql` e si
-- può rilanciare; non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, abbinare la ricevuta di un familiare o
-- un bonifico Da classificare dà il rifiuto del 135 («La ricevuta è di un’altra persona.» o «Collega prima il
-- movimento a una persona.»): non si scrive niente.
-- Le stesse regole in src/lib/assegna.ts (`cosaNonVaAbbinamento`, `movimentoDaClassificareAbbinabile`,
-- `voceDaRicevuta`) e nella modalità prova (segreteriaProva.ts).
-- ---------------------------------------------------------------------------

create or replace function abbina_ricevuta_movimento(movimento uuid, ricevuta uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  m movimenti;
  r ricevute;
  titolare persone;
  da_classificare boolean;
  voce text;
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
