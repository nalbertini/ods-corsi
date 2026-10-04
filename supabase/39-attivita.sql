-- ---------------------------------------------------------------------------
-- ODS Corsi · l'«Attività» di ogni giorno dei corsi e di ogni lezione
--
-- Un elenco di attività (Sacco, Angoli, Sparring…) tenuto dalla segreteria.
-- Ogni giorno di un corso (`ricorrenze`) può averne una, e ogni lezione
-- (`sessioni`) parte da quella del suo giorno e può cambiarla: la segreteria
-- come vuole, l'istruttore solo per le sue lezioni. Il nome sta una volta
-- sola, nell'elenco: rinominare una voce la rinomina ovunque.
--
-- - Il nome non è vuoto, al massimo 40 caratteri, e vale una volta sola senza
--   badare a maiuscole e spazi ai bordi.
-- - Un'attività usata non si elimina (nessuna cascata): si mette fuori uso con
--   `attiva = false`, e resta dov'è.
-- - Cambiare l'attività di un giorno la cambia alle lezioni future che la
--   seguivano ancora (vuoto compreso), mai a quelle passate, con l'appello o
--   una prova, o cambiate a mano.
-- - Le lezioni nuove nascono con l'attività del loro giorno: lo fa un trigger,
--   così `materializza_sessioni` non cambia.
-- - Il tablet legge l'attività delle lezioni della sua sala con `attivita_sala`.
--
-- Si lancia dopo `05-segreteria.sql` e `24-kanji.sql`. Non chiede di
-- rilanciare `06-iscrizioni.sql`. Chi rilancia `03` o `05` rilancia poi anche
-- questo: rifà `sessione_solo_stato` e `ricorrenza_cambiata`. Finché non c'è,
-- l'app non offre l'attività e le lezioni restano com'erano.
-- ---------------------------------------------------------------------------

create table if not exists attivita (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null check (btrim(nome) <> '' and char_length(nome) <= 40),
  attiva boolean not null default true
);
-- «sacco » e «SACCO» sono la stessa voce.
create unique index if not exists attivita_nome_unico on attivita (lower(btrim(nome)));

alter table attivita enable row level security;
drop policy if exists attivita_legge on attivita;
drop policy if exists attivita_scrive on attivita;
drop policy if exists attivita_aggiorna on attivita;
drop policy if exists attivita_cancella on attivita;
-- Come `sale`: la legge chi ha un accesso (tablet compresi), la scrive la segreteria.
create policy attivita_legge on attivita for select to authenticated using (true);
create policy attivita_scrive on attivita for insert to authenticated with check (e_staff());
create policy attivita_aggiorna on attivita for update to authenticated using (e_staff()) with check (e_staff());
create policy attivita_cancella on attivita for delete to authenticated using (e_staff());
revoke all on attivita from anon, authenticated;
grant select, insert, update, delete on attivita to authenticated;

-- Senza `on delete`: una attività usata blocca l'eliminazione, non la sposta.
alter table ricorrenze add column if not exists attivita_id uuid references attivita;
alter table sessioni   add column if not exists attivita_id uuid references attivita;

-- ---------------------------------------------------------------------------
-- Una lezione nuova prende l'attività del suo giorno, se non gliene è stata
-- data una. Come `sessione_in_stagione` (12): un trigger prima dell'insert,
-- così il calendario che si allunga non va riscritto.
-- ---------------------------------------------------------------------------
create or replace function sessione_attivita_del_giorno() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.attivita_id is null and new.ricorrenza_id is not null then
    select attivita_id into new.attivita_id from ricorrenze where id = new.ricorrenza_id;
  end if;
  return new;
end $$;

drop trigger if exists sessioni_attivita_del_giorno on sessioni;
create trigger sessioni_attivita_del_giorno before insert on sessioni
  for each row execute function sessione_attivita_del_giorno();

revoke all on function sessione_attivita_del_giorno() from public, anon;

-- ---------------------------------------------------------------------------
-- Un giorno cambia sala o attività: le sue lezioni future lo seguono.
--
-- La sala come prima (05): segue chi era ancora nella sala di prima (quella
-- del giorno, o quella del corso se il giorno non ne aveva una), e una
-- lezione spostata a mano resta dov'è. L'attività uguale, ma più cauta: oltre
-- a essere futura e ancora uguale al valore vecchio del giorno (nessuna
-- compresa), non deve avere appello né prove, che sono lezioni già vissute.
-- ---------------------------------------------------------------------------
create or replace function ricorrenza_cambiata() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  del_corso uuid;
begin
  if new.sala_id is distinct from old.sala_id then
    select sala_id into del_corso from corsi where id = new.corso_id;
    update sessioni set sala_id = coalesce(new.sala_id, del_corso)
      where ricorrenza_id = new.id and inizio > now()
        and sala_id is not distinct from coalesce(old.sala_id, del_corso);
  end if;
  if new.attivita_id is distinct from old.attivita_id then
    update sessioni s set attivita_id = new.attivita_id
      where s.ricorrenza_id = new.id and s.inizio > now()
        and s.attivita_id is not distinct from old.attivita_id
        and not exists (select 1 from presenze p where p.sessione_id = s.id)
        and not exists (select 1 from prove p where p.sessione_id = s.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Cosa cambia un istruttore di una sua lezione: lo stato, la nota e, dal 39,
-- l'attività. Orario, sala, corso e istruttore restano alla segreteria. Senza
-- utente (un job, i trigger della segreteria) passa tutto.
-- ---------------------------------------------------------------------------
create or replace function sessione_solo_stato() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if persona_corrente() is not null and not e_staff()
     and (to_jsonb(new) - 'stato' - 'note' - 'attivita_id') is distinct from (to_jsonb(old) - 'stato' - 'note' - 'attivita_id') then
    raise exception 'di una lezione un istruttore cambia solo lo stato, la nota e l''attività: il resto lo fa la segreteria'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- L'attività delle lezioni del tablet: quelle di `lezioni_sala`, che controlla
-- anche che a chiedere sia un tablet. Come `kanji_sala` (24), senza cambiarla.
-- Una lezione senza attività non c'è.
-- ---------------------------------------------------------------------------
create or replace function attivita_sala(da_giorno date, a_giorno date)
  returns table (sessione_id uuid, attivita text)
  language sql stable security definer set search_path = public, extensions as $$
  select l.id, a.nome
  from lezioni_sala(da_giorno, a_giorno) l
  join sessioni s on s.id = l.id
  join attivita a on a.id = s.attivita_id
$$;

revoke all on function attivita_sala(date, date) from public, anon;
grant execute on function attivita_sala(date, date) to authenticated;

notify pgrst, 'reload schema';
