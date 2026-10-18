-- ---------------------------------------------------------------------------
-- ODS Corsi · i pagamenti fatti a mano
--
-- Non tutto passa da una ricevuta: si paga in palestra, in contanti, o si è
-- pagato prima dell'app. La segreteria registra quel pagamento nella scheda
-- (data, importo, come, a cosa serve, una nota) e compare nello storico dei
-- pagamenti accanto a quelli delle ricevute, segnato SENZA RICEVUTA.
--
-- Come una ricevuta, un pagamento registrato non si cambia e non si cancella:
-- si annulla, e resta in elenco. Solo la segreteria (`e_staff()`) li legge e
-- li scrive, dalle due funzioni qui sotto. Non cambia se uno è in regola: la
-- quota si guarda dalle ricevute o dall'eccezione scritta a mano
-- (`27-pagamento-dalle-ricevute.sql`).
--
-- Una persona che ha pagamenti non si cancella (`on delete restrict`): è storia
-- contabile, come le ricevute. Si disattiva, o si unisce a un'altra scheda:
-- `unisci_persone` sposta già ogni tabella che punta a `persone`.
--
-- Si lancia dopo `16-ricevute.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, l'app dice che i pagamenti a mano non
-- sono ancora attivi e lo storico mostra solo le ricevute.
-- ---------------------------------------------------------------------------

create table if not exists pagamenti_diretti (
  id            uuid primary key default gen_random_uuid(),
  persona_id    uuid not null references persone on delete restrict,
  data          date not null check (data between date '2000-01-01' and date '2100-12-31'),
  -- In centesimi.
  importo       int not null check (importo > 0 and importo <= 10000000),
  metodo        text not null check (char_length(btrim(metodo)) between 1 and 40),
  -- A cosa serve: QUOTA ASSOCIATIVA, un corso, ALTRO.
  voce          text not null check (char_length(btrim(voce)) between 1 and 120),
  nota          text check (char_length(nota) <= 300),
  creato_il     timestamptz not null default now(),
  creato_da     uuid references persone on delete set null,
  annullato_il  timestamptz,
  annullato_da  uuid references persone on delete set null
);
create index if not exists pagamenti_diretti_persona on pagamenti_diretti (persona_id, data desc);
create index if not exists pagamenti_diretti_data on pagamenti_diretti (data desc);

-- Solo la segreteria li legge; si scrivono solo dalle due funzioni qui sotto.
alter table pagamenti_diretti enable row level security;
drop policy if exists pagamenti_diretti_legge on pagamenti_diretti;
create policy pagamenti_diretti_legge on pagamenti_diretti for select to authenticated using (e_staff());
revoke all on pagamenti_diretti from anon, authenticated;
grant select on pagamenti_diretti to authenticated;

/**
 * Registra un pagamento fatto a mano. `dati`:
 *   { persona_id, data, importo, metodo, voce, nota? }
 * Importo in centesimi. Ritorna la riga.
 */
create or replace function registra_pagamento_diretto(dati jsonb) returns jsonb
  language plpgsql security definer set search_path = public, extensions as $$
declare
  giorno date;
  quanto int;
  persona uuid;
  nuovo pagamenti_diretti;
begin
  if not e_staff() then raise exception 'il pagamento lo registra la segreteria' using errcode = '42501'; end if;
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

  insert into pagamenti_diretti (persona_id, data, importo, metodo, voce, nota, creato_da)
  values (persona, giorno, quanto, btrim(dati->>'metodo'), btrim(dati->>'voce'), nullif(btrim(coalesce(dati->>'nota', '')), ''), persona_corrente())
  returning * into nuovo;
  return to_jsonb(nuovo);
end $$;

/** Annulla un pagamento: resta, segnato come annullato. */
create or replace function annulla_pagamento_diretto(pagamento uuid) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'il pagamento lo annulla la segreteria' using errcode = '42501'; end if;
  update pagamenti_diretti set annullato_il = now(), annullato_da = persona_corrente()
    where id = pagamento and annullato_il is null;
  if not found then raise exception 'Pagamento inesistente o già annullato' using errcode = 'P0002'; end if;
end $$;

revoke all on function registra_pagamento_diretto(jsonb), annulla_pagamento_diretto(uuid) from public, anon;
grant execute on function registra_pagamento_diretto(jsonb), annulla_pagamento_diretto(uuid) to authenticated;

notify pgrst, 'reload schema';
