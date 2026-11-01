-- ---------------------------------------------------------------------------
-- ODS Corsi · Un bonifico della banca coperto da una ricevuta o da un pagamento a mano
--
-- Un bonifico o un POS già in una ricevuta o in un pagamento a mano è in CONTABILITÀ come riga
-- `incasso:` (la scrive l'app da ricevute e pagamenti, non sta in `movimenti`). L'import della banca
-- lo riconosce e lo segna coperto, ma `banca_segna_coperti` del 114 voleva un movimento: con
-- `incasso:` il conto dell'id falliva e l'import si fermava. Ora `banca_coperti.con_id` è testo e
-- tiene anche `incasso:<ricevuta>:<voce>:<pagamento>` o `incasso:diretto:<pagamento>`: la riga della
-- banca resta coperta da quell'incasso, che non conta due volte. Su ricevute e pagamenti non si scrive.
--
-- Il database ricontrolla l'incasso come fa coi movimenti: c'è, non è annullato, ha lo stesso importo,
-- va sul Conto Corrente (non contanti, carta o Satispay) e non copre già un'altra riga. Se non regge, la
-- riga entra «Da classificare», come prima. «Non è questo» (`banca_non_e_questo`) non cambia.
--
-- Chi può: come nel 114, solo l'amministrazione. Si lancia dopo `114-importazioni.sql` e si può
-- rilanciare. Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, l'import di un file con un
-- bonifico già in ricevuta si ferma con «rileggi lo stesso file».
-- La stessa regola, per la modalità prova, è in src/lib/importaBanca.ts (segnaCoperti).
-- ---------------------------------------------------------------------------

alter table banca_coperti alter column con_id type text using con_id::text;
-- Un incasso copre una riga sola, anche con due import insieme.
create unique index if not exists banca_coperti_un_incasso on banca_coperti (con_id) where con_id like 'incasso:%';

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
      regge := x->>'tipo' = 'entrata' and not exists (select 1 from banca_coperti b where b.con_id = con)
        and exists (select 1 from ricevute r
                     cross join lateral (select r.voci -> parti[3]::int -> 'pagamenti' -> parti[4]::int as p) q
                     where r.id = parti[2]::uuid and r.annullata_il is null
                       and (q.p->>'importo')::integer = quanto
                       and lower(btrim(q.p->>'metodo')) not in ('contanti', 'carta', 'satispay'));
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
