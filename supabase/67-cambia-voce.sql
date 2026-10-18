-- La contabilità: cambiare la voce di un movimento, uno o tanti insieme.
--
-- Fin qui un movimento non si cambiava: si annullava e si rifaceva. Per lo storico importato dal vecchio
-- programma (migliaia di righe in «Da classificare», 63-importa-prima-nota.sql) non si può. `cambia_voce_movimenti`
-- cambia SOLO la voce di una lista di movimenti: importo, data, cassa e testo restano come sono, quindi anche
-- il residuo di ogni cassa e il previsto di una chiusura. Per questo vale anche nei giorni chiusi (60-chiusura-cassa.sql).
--
-- Chi può cosa: solo chi ha il ruolo di amministrazione (`contabilita_porta()`, 59-contabilita.sql). La traccia
-- `cambi_voce` (chi, quando, la voce di prima e quella di dopo, per ogni movimento cambiato) la legge solo
-- l'amministrazione e non la scrive nessuno da fuori: si scrive solo da questa funzione e non si cancella.
--
-- Le regole: al massimo 500 movimenti per volta; o cambiano tutti o nessuno (un solo errore ferma il lotto e dice
-- quale movimento); la voce di arrivo esiste, è in uso, è del tipo dei movimenti e non è «Differenza di cassa»;
-- non si cambiano gli annullati, i giroconti (non hanno voce) e la differenza scritta da una chiusura di cassa.
-- Un movimento che ha già la voce di arrivo non è un errore e non lascia traccia. Gli incassi degli iscritti non
-- sono movimenti: non sono qui. Le stesse regole di src/lib/contabilita.ts (`cosaNonVaCambioVoce`) e della
-- modalità prova, provate da supabase/prova/cambia-voce.sql.
--
-- Si lancia dopo `59-contabilita.sql` e `60-chiusura-cassa.sql`. Non chiede di rilanciare `06-iscrizioni.sql` e non
-- tocca nessuna funzione dei file 59, 60 o 63: rilanciarli non perde niente. Finché non c'è, la schermata dice
-- di lanciare questo file e il resto della contabilità funziona.
-- ---------------------------------------------------------------------------

create table if not exists cambi_voce (
  id           uuid primary key default gen_random_uuid(),
  movimento_id uuid not null references movimenti,
  voce_prima_id uuid references voci_contabili,
  voce_dopo_id  uuid references voci_contabili,
  cambiato_il  timestamptz not null default now(),
  cambiato_da  uuid references persone on delete set null
);
create index if not exists cambi_voce_movimento on cambi_voce (movimento_id, cambiato_il);

alter table cambi_voce enable row level security;
revoke all on cambi_voce from anon, authenticated;
grant select on cambi_voce to authenticated;
drop policy if exists cambi_voce_legge on cambi_voce;
create policy cambi_voce_legge on cambi_voce for select to authenticated using (e_amministrazione());

create or replace function cambia_voce_movimenti(ids uuid[], voce uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  elenco uuid[];
  v voci_contabili;
  m movimenti;
  cambiati integer := 0;
  gia integer := 0;
begin
  perform contabilita_porta();
  -- lo stesso id due volte conta una
  select coalesce(array_agg(distinct x order by x), '{}') into elenco from unnest(ids) x where x is not null;
  if cardinality(elenco) = 0 then raise exception 'Scegli almeno un movimento' using errcode = '22023'; end if;
  if cardinality(elenco) > 500 then raise exception 'Troppi movimenti in una volta: al massimo 500' using errcode = '22023'; end if;
  select * into v from voci_contabili x where x.id = cambia_voce_movimenti.voce;
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
    if m.voce_id = v.id then
      gia := gia + 1;
    else
      insert into cambi_voce (movimento_id, voce_prima_id, voce_dopo_id, cambiato_da) values (m.id, m.voce_id, v.id, persona_corrente());
      update movimenti x set voce_id = v.id where x.id = m.id;
      cambiati := cambiati + 1;
    end if;
  end loop;
  return jsonb_build_object('cambiati', cambiati, 'gia_cosi', gia);
end $$;

revoke all on function cambia_voce_movimenti(uuid[], uuid) from public, anon;
grant execute on function cambia_voce_movimenti(uuid[], uuid) to authenticated;

-- Che l'API veda subito funzione e tabella nuove, senza aspettare.
notify pgrst, 'reload schema';
