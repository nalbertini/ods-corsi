-- ---------------------------------------------------------------------------
-- ODS Corsi · il saldo dell'estratto BancoPosta, mese per mese
--
-- Per vedere ogni mese se il Conto Corrente dell'app torna con la banca, chi
-- amministra copia dall'estratto i quattro numeri del riepilogo: saldo
-- iniziale, entrate, uscite, saldo finale. Il database tiene i conti
-- dell'estratto (iniziale + entrate − uscite = finale) e un mese una volta
-- sola. Un mese che torna si può segnare verificato: chi, quando e l'impronta
-- dei movimenti di quel momento, così l'app vede se poi una riga è cambiata.
-- Il confronto con i movimenti lo fa l'app (src/lib/quadraturaBanca.ts).
--
-- Chi può cosa:
--   amministrazione (anche il ruolo doppio)   legge e scrive, come movimenti e casse
--   gli altri                                 niente (anon compreso)
--
-- Si lancia dopo `59-contabilita.sql`. Si può rilanciare. Non chiede di
-- rilanciare `06-iscrizioni.sql`. Finché non c'è, in CONTABILITÀ → Casse il
-- riquadro «Il conto con la banca» dice quale file lanciare e il resto
-- dell'app non cambia.
-- ---------------------------------------------------------------------------

create table if not exists saldo_banca (
  mese              text primary key check (mese ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  saldo_iniziale    integer not null,
  entrate           integer not null check (entrate >= 0),
  uscite            integer not null check (uscite >= 0),
  saldo_finale      integer not null,
  verificato_il     timestamptz,
  verificato_da     uuid references persone on delete set null,
  impronta_verifica text,
  constraint saldo_banca_torna check (saldo_iniziale + entrate - uscite = saldo_finale),
  constraint saldo_banca_verifica check ((verificato_il is null) = (impronta_verifica is null))
);

-- Chi ha verificato e quando lo scrive il database, dalla sessione: l'app non
-- può dichiarare un altro. Senza sessione (un file lanciato a mano) resta il
-- dato. Numeri cambiati senza una verifica nuova: il mese torna da verificare.
create or replace function saldo_banca_chi_verifica() returns trigger
  language plpgsql set search_path = public, extensions as $$
begin
  if tg_op = 'UPDATE'
     and (new.saldo_iniziale, new.entrate, new.uscite, new.saldo_finale)
         is distinct from (old.saldo_iniziale, old.entrate, old.uscite, old.saldo_finale)
     and new.verificato_il is not distinct from old.verificato_il
     and new.impronta_verifica is not distinct from old.impronta_verifica then
    new.verificato_il := null;
    new.impronta_verifica := null;
  end if;
  if new.verificato_il is null then
    new.verificato_da := null;
  elsif tg_op = 'UPDATE'
        and new.verificato_il is not distinct from old.verificato_il
        and new.impronta_verifica is not distinct from old.impronta_verifica then
    -- Nessuna verifica nuova: resta chi c'era, o nessuno se la persona è stata tolta.
    if new.verificato_da is not null then
      new.verificato_da := old.verificato_da;
    end if;
  elsif persona_corrente() is not null then
    new.verificato_da := persona_corrente();
    new.verificato_il := now();
  end if;
  return new;
end $$;
drop trigger if exists saldo_banca_chi_verifica on saldo_banca;
create trigger saldo_banca_chi_verifica before insert or update on saldo_banca
  for each row execute function saldo_banca_chi_verifica();
-- Gira solo come trigger: il permesso si controlla quando si crea il trigger, non a ogni riga.
revoke all on function saldo_banca_chi_verifica() from public, anon, authenticated;

alter table saldo_banca enable row level security;

drop policy if exists saldo_banca_legge on saldo_banca;
create policy saldo_banca_legge on saldo_banca for select to authenticated using (e_amministrazione());
drop policy if exists saldo_banca_scrive on saldo_banca;
create policy saldo_banca_scrive on saldo_banca for insert to authenticated with check (e_amministrazione());
drop policy if exists saldo_banca_cambia on saldo_banca;
create policy saldo_banca_cambia on saldo_banca for update to authenticated using (e_amministrazione()) with check (e_amministrazione());
drop policy if exists saldo_banca_toglie on saldo_banca;
create policy saldo_banca_toglie on saldo_banca for delete to authenticated using (e_amministrazione());
revoke all on saldo_banca from anon, authenticated;
grant select, insert, update, delete on saldo_banca to authenticated;

notify pgrst, 'reload schema';
