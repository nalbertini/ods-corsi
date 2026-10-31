-- ODS Corsi · Lo scarico Satispay dice solo chi ha pagato
-- Si lancia dopo 116-satispay-separato.sql, e si può rilanciare.
--
-- I soldi di Satispay arrivano in banca col versamento «Da Satispay Europe S.A.», che IMPORTA BANCA scrive in
-- Conto Corrente proponendo la voce «Incassi Satispay», al netto della commissione. Lo scarico che scriveva ogni
-- pagamento nella cassa Satispay li contava una seconda volta (ottobre 2026). Da adesso:
--   · lo scarico non scrive né collega movimenti: un pagamento è del modulo, è in PAGAMENTI, o è nel versamento
--     (esito `fuori`, motivo `nel_versamento`). Niente più «da decidere»;
--   · `satispay_decidi` e `satispay_decidi_gruppo` rifiutano; i «da decidere» aperti restano in tabella, non si
--     mostrano più. I collegamenti a mano già fatti restano, e «Non è questo» li scioglie ancora;
--   · la cassa Satispay non prende movimenti nuovi. Quelli che ha non si toccano qui: si tolgono a parte, con
--     l'elenco approvato dall'amministrazione;
--   · l'email dopo lo scarico parte solo se lo scarico non è riuscito.
-- La stessa regola, per la modalità prova, è in src/lib/satispayScarico.ts.
-- ---------------------------------------------------------------------------

alter table satispay_negozio drop constraint if exists satispay_negozio_motivo_check;
alter table satispay_negozio add constraint satispay_negozio_motivo_check
  check (motivo in ('giorno_chiuso', 'forse_doppione', 'prima_della_cassa', 'nel_versamento'));

insert into voci_contabili (nome, tipo, di_sistema) values ('Incassi Satispay', 'entrata', true) on conflict do nothing;
-- Una voce con quel nome fatta a mano prima del 132 diventa di sistema: non si spegne né si cancella.
update voci_contabili set di_sistema = true, attiva = true
  where tipo = 'entrata' and lower(btrim(nome)) = 'incassi satispay' and (not di_sistema or not attiva);

-- La cassa Satispay è chiusa: niente movimenti nuovi, né spostati dentro. Annullarli resta possibile.
-- security definer: chi scrive un movimento può non vedere le casse, e senza la cassa il controllo non scatterebbe.
create or replace function cassa_satispay_chiusa() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (select id from casse where nome = 'Satispay') in (new.cassa_id, new.cassa_a_id)
     and (tg_op = 'INSERT' or (old.cassa_id, old.cassa_a_id) is distinct from (new.cassa_id, new.cassa_a_id)) then
    raise exception 'La cassa Satispay è chiusa: i soldi di Satispay arrivano col versamento in Conto Corrente'
      using errcode = '22023';
  end if;
  return new;
end $$;

create or replace trigger movimenti_cassa_satispay_chiusa
  before insert or update of cassa_id, cassa_a_id on movimenti
  for each row execute function cassa_satispay_chiusa();

create or replace function satispay_negozio_applica(scrivi boolean) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  p satispay_negozio;
  giorno date;
  conti jsonb := jsonb_build_object('incassi', 0, 'rimborsi', 0, 'modulo', 0, 'pagamenti', 0, 'a_mano', 0, 'da_decidere', 0, 'prima', 0, 'scritti', 0);
  piu text := null;
begin
  begin
    for p in select * from satispay_negozio where esito is null and stato = 'ACCEPTED'
        and (quando at time zone 'Europe/Rome')::date < contabilita_oggi() order by quando, satispay_id for update loop
      giorno := (p.quando at time zone 'Europe/Rome')::date;
      if exists (select 1 from pagamenti_satispay s where s.satispay_id = p.satispay_id) then
        update satispay_negozio set esito = 'modulo' where satispay_id = p.satispay_id;
        piu := 'modulo';
      elsif p.tipo = 'TO_BUSINESS' and (
          -- Le righe di PAGAMENTI col metodo Satispay quel giorno con quell'importo, fuori dal modulo…
          (select count(*) from (
              select 1 from ricevute r, jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) x
              where r.annullata_il is null and lower(btrim(x->>'metodo')) = 'satispay'
                and coalesce((x->>'data')::date, r.data) = giorno and (x->>'importo')::int = p.importo
                and not exists (select 1 from pagamenti_satispay s where s.ricevuta_id = r.id)
              union all
              select 1 from pagamenti_diretti d
              where d.annullato_il is null and lower(btrim(d.metodo)) = 'satispay' and d.data = giorno and d.importo = p.importo
            ) righe)
          -- …meno quelle già prese da un altro pagamento.
          > (select count(*) from satispay_negozio n where n.esito = 'pagamenti' and n.importo = p.importo
              and (n.quando at time zone 'Europe/Rome')::date = giorno)) then
        update satispay_negozio set esito = 'pagamenti' where satispay_id = p.satispay_id;
        piu := 'pagamenti';
      else
        -- I soldi sono nel versamento in banca: il pagamento dice solo chi ha pagato.
        update satispay_negozio set esito = 'fuori', motivo = 'nel_versamento' where satispay_id = p.satispay_id;
        piu := case p.tipo when 'TO_BUSINESS' then 'incassi' else 'rimborsi' end;
      end if;
      conti := jsonb_set(conti, array[piu], to_jsonb((conti->>piu)::int + 1));
    end loop;
    conti := conti || jsonb_build_object('dal', (select min((quando at time zone 'Europe/Rome')::date) from satispay_negozio));
    if scrivi then
      update satispay_scarico set primo_fatto = true where id;
    else
      -- L'anteprima fa gli stessi passi e poi li disfa tutti: i conti sono quelli che darebbe davvero.
      raise exception using errcode = 'P0099';
    end if;
  exception when sqlstate 'P0099' then
    null;
  end;
  return conti;
end $$;

-- Non c'è più niente da decidere: un'app vecchia aperta riceve un errore che dice cosa fare.
create or replace function satispay_decidi(satispay_id text, scelta text, movimento uuid default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform contabilita_porta();
  raise exception 'Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina' using errcode = '22023';
end $$;

create or replace function satispay_decidi_gruppo(scelte jsonb) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform contabilita_porta();
  raise exception 'Satispay non si decide più: i soldi arrivano col versamento in banca. Ricarica la pagina' using errcode = '22023';
end $$;

-- Come nel 116, ma il pagamento scollegato non torna da decidere: è nel versamento.
create or replace function satispay_scollega(satispay_id text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  p satispay_negozio;
  m movimenti;
begin
  perform contabilita_porta();
  select * into p from satispay_negozio s where s.satispay_id = satispay_scollega.satispay_id for update;
  if not found then raise exception 'Il pagamento non c’è' using errcode = 'P0002'; end if;
  select * into m from movimenti x where x.id = p.movimento_id;
  if p.esito is distinct from 'a_mano' or m.id is null then
    raise exception 'Questo pagamento non è collegato a un movimento a mano' using errcode = '22023';
  end if;
  -- La chiusura che si sta facendo adesso aspetta.
  perform 1 from casse c where c.id = m.cassa_id for share;
  if cassa_giorno_chiuso(m.cassa_id, m.data) then
    raise exception 'Quel giorno la cassa è chiusa: il collegamento resta' using errcode = '22023';
  end if;
  update movimenti x set satispay_id = null where x.id = m.id;
  update satispay_negozio s set esito = 'fuori', motivo = 'nel_versamento', movimento_id = null, candidati = null
    where s.satispay_id = p.satispay_id;
end $$;

-- `da_decidere` resta, sempre vuoto: l'app di prima lo legge.
create or replace function satispay_scarico_stato() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  perform contabilita_porta();
  return (select jsonb_build_object('primo_fatto', s.primo_fatto, 'ultimo', s.ultimo, 'errore', s.errore,
    'da_decidere', '[]'::jsonb) from satispay_scarico s);
end $$;

-- Lo scarico non scrive più niente: l'email parte solo se non è riuscito. Il resto come nel 97.
create or replace function satispay_scarico_avvisa(conti jsonb, errore text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  contati int;
begin
  if (select a from avvisi_indirizzi limit 1) is null or errore is null then return; end if;
  -- Lo stesso lucchetto di `avvisi_da_mandare`: il tetto si conta una volta sola.
  perform pg_advisory_xact_lock(hashtext('avvisi_da_mandare'));
  select count(*) into contati from avvisi_segreteria v
   where v.non_mandato is null
     and (coalesce(v.mandato_il, v.creato_il) at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date;
  insert into avvisi_segreteria (tipo, chiave, dati, non_mandato)
    values ('satispay_scarico', 'scarico:' || gen_random_uuid(),
            coalesce(conti, '{}'::jsonb) || jsonb_build_object('errore', errore),
            case when contati >= 50 then 'tetto' end);
end $$;

revoke all on function cassa_satispay_chiusa() from public, anon, authenticated;
revoke all on function satispay_negozio_applica(boolean), satispay_scarico_avvisa(jsonb, text) from public, anon, authenticated;
grant execute on function satispay_negozio_applica(boolean), satispay_scarico_avvisa(jsonb, text) to service_role;
revoke all on function satispay_decidi(text, text, uuid), satispay_decidi_gruppo(jsonb), satispay_scollega(text),
  satispay_scarico_stato() from public, anon;
grant execute on function satispay_decidi(text, text, uuid), satispay_decidi_gruppo(jsonb), satispay_scollega(text),
  satispay_scarico_stato() to authenticated;

notify pgrst, 'reload schema';
