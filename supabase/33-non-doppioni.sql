-- ---------------------------------------------------------------------------
-- ODS Corsi · due schede che non sono doppioni
--
-- In ISCRITTI la segreteria vede i possibili doppioni (`coppieDoppioni` in
-- src/lib/doppioni.ts): stesso nome scritto in un altro modo, o stesso codice
-- fiscale. Due omonimi veri senza codice fiscale resterebbero lì per sempre:
-- NON SONO DOPPIONI li toglie, e la coppia si scrive qui.
--
-- La legge, la scrive e la toglie solo la segreteria. Una coppia è una riga
-- sola, con la scheda più piccola in `a`: la mette in ordine il trigger, che
-- scrive anche chi l'ha segnata e quando. Se ne va con una delle due schede.
-- Quando `unisci_persone` (29-unisci-doppioni.sql) sposta le coppie della
-- scheda che se ne va, una coppia che diventerebbe di una scheda con sé
-- stessa, o una che c'è già, resta dov'è e se ne va con lei.
--
-- Si lancia dopo `29-unisci-doppioni.sql`. Non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, i possibili doppioni si vedono lo
-- stesso, e NON SONO DOPPIONI dice che va lanciato.
-- ---------------------------------------------------------------------------

create table if not exists non_doppioni (
  a          uuid not null references persone on delete cascade,
  b          uuid not null references persone on delete cascade,
  segnata_da uuid references persone on delete set null,
  segnata_il timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

alter table non_doppioni enable row level security;

drop policy if exists non_doppioni_legge on non_doppioni;
create policy non_doppioni_legge on non_doppioni for select to authenticated using (e_staff());
drop policy if exists non_doppioni_scrive on non_doppioni;
create policy non_doppioni_scrive on non_doppioni for insert to authenticated with check (e_staff());
drop policy if exists non_doppioni_toglie on non_doppioni;
create policy non_doppioni_toglie on non_doppioni for delete to authenticated using (e_staff());

revoke all on non_doppioni from anon, authenticated;
grant select, insert, delete on non_doppioni to authenticated;

create or replace function non_doppioni_in_ordine() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  x uuid;
begin
  if new.a > new.b then
    x := new.a;
    new.a := new.b;
    new.b := x;
  end if;
  if tg_op = 'INSERT' then
    if new.a = new.b then raise exception 'Scegli due schede diverse'; end if;
    -- Chi l'ha segnata lo dice il server, come per le presenze.
    new.segnata_da := coalesce(persona_corrente(), new.segnata_da);
    new.segnata_il := now();
    return new;
  end if;
  -- Un aggiornamento lo fa solo `unisci_persone`: una coppia che diventerebbe
  -- di una scheda con sé stessa, o che c'è già, non si sposta. Se la coppia
  -- non cambia (cambia solo chi l'ha segnata), passa.
  if (new.a, new.b) is distinct from (old.a, old.b)
     and (new.a = new.b or exists (select 1 from non_doppioni where a = new.a and b = new.b)) then
    return null;
  end if;
  return new;
end $$;

create or replace trigger non_doppioni_in_ordine
  before insert or update on non_doppioni
  for each row execute function non_doppioni_in_ordine();

revoke all on function non_doppioni_in_ordine() from public, anon, authenticated;

notify pgrst, 'reload schema';
