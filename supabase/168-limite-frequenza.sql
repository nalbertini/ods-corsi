-- ---------------------------------------------------------------------------
-- 168 · Un limite alle richieste a raffica sui pagamenti online
--
-- Le funzioni `satispay` e `paypal` sono aperte (`--no-verify-jwt`): il
-- modulo di iscrizione le chiama senza accesso. Ogni chiamata di `prepara`,
-- `paga`, `stato`, `stato_pagamento`, `cattura` e la callback di Satispay
-- costa una o più chiamate al provider e spesso una riga scritta: chi le
-- chiamasse a raffica caricherebbe Satispay e PayPal a nome della palestra
-- (e potrebbe farsi bloccare le chiavi). Un limite in memoria non regge:
-- ogni istanza della funzione ha la sua. Il conto sta qui.
--
--   - `limite_frequenza_conti`: una riga per ambito e chiave, col conto e la
--     fine della finestra. La chiave è un'impronta (HMAC) dell'IP o l'id di
--     un pagamento, mai l'IP in chiaro: l'IP è un dato personale e qui non
--     serve saperlo, basta riconoscere le richieste uguali. Le righe vivono
--     al più la loro finestra (minuti), poi la prossima chiamata le cancella.
--   - `limite_frequenza(ambito, chiave, massimo, secondi)`: conta la
--     richiesta e dice se passa (vero fino a `massimo` nella finestra).
--     Con parametri senza senso dice sempre di sì: il limite protegge il
--     provider, non deve mai fermare chi paga per un errore nostro.
--
-- Chi può cosa: la tabella non la legge né la scrive nessuno da fuori (RLS
-- accesa, nessuna policy, nessun grant); la funzione la chiama solo
-- service_role, cioè le Edge Function.
-- Si lancia dopo `167-accogli-senza-presa-account.sql`; non chiede di
-- rilanciare `06-iscrizioni.sql`. Finché non c'è, le funzioni dei pagamenti
-- lavorano come prima, senza limite. Si può rilanciare.
-- ---------------------------------------------------------------------------

create table if not exists limite_frequenza_conti (
  ambito text not null,
  chiave text not null,
  conto integer not null default 1,
  scade timestamptz not null default now(),
  primary key (ambito, chiave)
);
-- La pulizia a ogni chiamata cerca le righe scadute: senza indice leggerebbe tutta la tabella.
create index if not exists limite_frequenza_conti_scade on limite_frequenza_conti (scade);

alter table limite_frequenza_conti enable row level security;
-- Su Supabase le tabelle nuove di public nascono con i grant ad anon e
-- authenticated: si tolgono tutti. Ci scrive solo la funzione qui sotto.
revoke all on table limite_frequenza_conti from public, anon, authenticated, service_role;

create or replace function limite_frequenza(ambito text, chiave text, massimo integer, secondi integer)
  returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  n integer;
begin
  if coalesce(ambito, '') = '' or coalesce(chiave, '') = '' or coalesce(massimo, 0) < 1 or coalesce(secondi, 0) < 1 then
    return true;
  end if;
  -- Le finestre finite se ne vanno: così la tabella resta di poche righe e
  -- nessuna impronta resta più dei suoi minuti.
  delete from limite_frequenza_conti c where c.scade <= now();
  insert into limite_frequenza_conti as c (ambito, chiave, conto, scade)
    values (limite_frequenza.ambito, limite_frequenza.chiave, 1, now() + make_interval(secs => limite_frequenza.secondi))
    on conflict on constraint limite_frequenza_conti_pkey do update set conto = c.conto + 1
    returning c.conto into n;
  return n <= limite_frequenza.massimo;
end $$;

revoke all on function limite_frequenza(text, text, integer, integer) from public, anon, authenticated;
grant execute on function limite_frequenza(text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
