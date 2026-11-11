-- ---------------------------------------------------------------------------
-- ODS Corsi · Un bonifico della banca coperto da una ricevuta intera pagata in più rate
--
-- Una ricevuta con quota 50,00 + trimestre 170,00 in due pagamenti «Bonifico» dello stesso giorno, pagata con
-- un bonifico solo da 220,00: col 134 nessun incasso da 220,00 copriva la riga, che entrava come movimento nuovo
-- mentre le due rate restavano nel Conto Corrente, e gli stessi soldi contavano due volte. Ora l'import della
-- banca può dire `conId: 'ricevuta:<id>'`: la riga è coperta dalla ricevuta intera.
--
-- Il database ricontrolla: la ricevuta c'è e non è annullata; le sue rate sul conto (non contanti, carta o
-- Satispay) sono almeno due, dello stesso giorno, e sommano l'importo; nessuna di quelle rate copre già un'altra
-- riga da sola, e la ricevuta non ne copre già un'altra. Simmetrico: una rata non copre una riga se la sua
-- ricevuta intera ne copre già una. Una ricevuta nata da un bonifico assegnato (`movimento_id`, 135) è già nel
-- movimento: né lei né le sue rate coprono una riga. Due import insieme sulla stessa ricevuta si mettono in fila. Se non regge, la riga entra «Da classificare», come prima. Su ricevute e
-- pagamenti non si scrive. «Non è questo» (`banca_non_e_questo`) non cambia: libera la riga e la ricevuta.
--
-- Chi può: come nel 114, solo l'amministrazione. Si lancia dopo `134-banca-coperti-incassi.sql` e `135-assegna-movimento.sql` e si può
-- rilanciare; rifà `banca_segna_coperti`: se si rilancia `114` o `134` dopo, va rilanciato anche questo
-- (`controllo.sql` lo dice). Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, l'import di un
-- file con un bonifico coperto da una ricevuta intera si ferma con «rileggi lo stesso file» e non scrive niente.
-- La stessa regola, per la modalità prova, è in src/lib/importaBanca.ts (segnaCoperti).
-- ---------------------------------------------------------------------------

-- Una ricevuta intera copre una riga sola, anche con due import insieme.
create unique index if not exists banca_coperti_una_ricevuta on banca_coperti (con_id) where con_id like 'ricevuta:%';

create or replace function banca_segna_coperti(righe jsonb) returns void
  language plpgsql security definer set search_path = public, extensions as $$
declare
  x jsonb;
  k text;
  con text;
  quanto integer;
  parti text[];
  regge boolean;
  uuid_re constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  perform contabilita_porta();
  if jsonb_typeof(righe) is distinct from 'array' then raise exception 'I movimenti già scritti non si capiscono' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(righe) loop
    k := x->>'chiave';
    if coalesce(k, '') !~ '^banca:' then raise exception 'Un movimento già scritto non ha la chiave della banca' using errcode = '22023'; end if;
    -- Rileggere lo stesso file non duplica: la chiave è quella dell'import.
    continue when exists (select 1 from banca_coperti b where b.chiave = k)
      or exists (select 1 from movimenti m where m.origine_import = k or m.banca_chiave = k);
    con := lower(coalesce(x->>'conId', ''));
    quanto := (x->>'importo')::integer;
    -- L'abbinamento lo fa l'app: qui si ricontrolla, perché un pagamento copre una riga sola e mai anche Satispay.
    if con ~ ('^' || uuid_re || '$') then
      update movimenti m set banca_chiave = k
        where m.id = con::uuid and m.tipo = x->>'tipo' and m.importo = quanto
          and m.cassa_id = (select c.id from casse c where c.nome = 'Conto Corrente')
          and m.annullato_il is null and m.satispay_id is null and m.banca_chiave is null;
      regge := found;
    elsif con ~ ('^incasso:diretto:' || uuid_re || '$') then
      regge := x->>'tipo' = 'entrata' and not exists (select 1 from banca_coperti b where b.con_id = con)
        and exists (select 1 from pagamenti_diretti p
                     where p.id = substr(con, 17)::uuid and p.annullato_il is null and p.importo = quanto
                       and lower(btrim(p.metodo)) not in ('contanti', 'carta', 'satispay'));
    elsif con ~ ('^incasso:' || uuid_re || ':[0-9]{1,2}:[0-9]{1,3}$') then
      -- `incasso:<ricevuta>:<voce>:<pagamento>`, come `righeDaRicevute` in src/lib/pagamenti.ts.
      parti := string_to_array(con, ':');
      -- In fila con la ricevuta intera della stessa ricevuta, se un altro import la sta coprendo ora.
      perform pg_advisory_xact_lock(hashtext('banca_ricevuta:' || parti[2]));
      regge := x->>'tipo' = 'entrata' and not exists (select 1 from banca_coperti b where b.con_id = con)
        and not exists (select 1 from banca_coperti b where b.con_id = 'ricevuta:' || parti[2])
        and exists (select 1 from ricevute r
                     cross join lateral (select r.voci -> parti[3]::int -> 'pagamenti' -> parti[4]::int as p) q
                     where r.id = parti[2]::uuid and r.annullata_il is null and r.movimento_id is null
                       and (q.p->>'importo')::integer = quanto
                       and lower(btrim(q.p->>'metodo')) not in ('contanti', 'carta', 'satispay'));
    elsif con ~ ('^ricevuta:' || uuid_re || '$') then
      -- La ricevuta intera: le rate sul conto (non contanti, carta o Satispay), almeno due, dello stesso giorno, che
      -- sommano l'importo. Nessuna rata già coperta da sola, e la ricevuta non copre già un'altra riga.
      perform pg_advisory_xact_lock(hashtext('banca_ricevuta:' || substr(con, 10)));
      regge := x->>'tipo' = 'entrata'
        and not exists (select 1 from banca_coperti b where b.con_id = con or b.con_id like 'incasso:' || substr(con, 10) || ':%')
        and exists (select 1 from ricevute r
                     cross join lateral (
                       select count(*) as quante, coalesce(sum((p->>'importo')::integer), 0) as tot, count(distinct p->>'data') as giorni, count(p->>'data') as con_data
                       from jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) p
                       where lower(btrim(p->>'metodo')) not in ('contanti', 'carta', 'satispay')) q
                     where r.id = substr(con, 10)::uuid and r.annullata_il is null and r.movimento_id is null
                       and q.quante >= 2 and q.giorni = 1 and q.con_data = q.quante and q.tot = quanto);
    else
      raise exception 'Un movimento già scritto non dice a cosa è collegato: rileggi lo stesso file' using errcode = '22023';
    end if;
    if regge then
      begin
        insert into banca_coperti (chiave, data, tipo, importo, descrizione, con_id, con_descrizione)
          values (k, (x->>'data')::date, x->>'tipo', quanto, x->>'descrizione', con, x->>'conDescrizione');
      exception when unique_violation then
        -- Due import insieme sullo stesso incasso: il primo lo copre, questa riga va «Da classificare».
        regge := false;
      end;
    end if;
    if not regge then
      perform importa_prima_nota(jsonb_build_array(jsonb_build_object('chiave', k, 'data', x->>'data', 'cassa', 'conto',
        'tipo', x->>'tipo', 'importo', quanto, 'descrizione', x->>'descrizione', 'voce', 'Da classificare')));
    end if;
  end loop;
end $$;

revoke all on function banca_segna_coperti(jsonb) from public, anon;
grant execute on function banca_segna_coperti(jsonb) to authenticated;

notify pgrst, 'reload schema';
