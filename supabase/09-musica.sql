-- ---------------------------------------------------------------------------
-- ODS Corsi · la musica delle sale
--
-- Il tablet di sala ha la musica nella barra in basso, sempre allo stesso
-- posto: presenze e timer sono due schede della stessa pagina, e passando
-- dall'una all'altra la musica non si ferma. Cosa far partire lo prepara la
-- segreteria: qualche lista per sala («Riscaldamento», «Randori»,
-- «Defaticamento»), ognuna un nome e un link a una playlist di YouTube o di
-- Spotify. Il tablet le sceglie, non le cambia.
--
-- `sala_id` nullo vuol dire «per tutte le sale».
--
-- Il link il database non lo interpreta: se è YouTube o Spotify lo capisce
-- l'app (`src/lib/musica.ts`), che lo controlla anche prima di salvarlo. Qui
-- solo che sia un indirizzo di uno dei due, e non troppo lungo.
--
-- Si lancia dopo `08-timer.sql`. La funzione del tablet non va ad `anon`,
-- quindi non chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

create table if not exists musica_sale (
  id        uuid primary key default gen_random_uuid(),
  sala_id   uuid references sale on delete cascade,
  nome      text not null check (length(trim(nome)) between 1 and 40),
  link      text not null check (length(link) <= 500
                                 and link ~* '^(https?://)?([a-z]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|open\.spotify\.com)/|^spotify:'),
  ordine    int not null default 0,
  creata_il timestamptz not null default now()
);
create index if not exists musica_sale_sala on musica_sale (sala_id);

-- La segreteria le cura; il resto del personale le vede, per sapere cosa c'è.
-- Il tablet non legge la tabella: passa da `musica_sala()`, che gli dà solo
-- quelle della sua sala.
alter table musica_sale enable row level security;
drop policy if exists musica_sale_legge on musica_sale;
drop policy if exists musica_sale_scrive on musica_sale;
drop policy if exists musica_sale_aggiorna on musica_sale;
drop policy if exists musica_sale_cancella on musica_sale;
create policy musica_sale_legge on musica_sale for select to authenticated using (e_personale());
create policy musica_sale_scrive on musica_sale for insert to authenticated with check (e_staff());
create policy musica_sale_aggiorna on musica_sale for update to authenticated using (e_staff()) with check (e_staff());
create policy musica_sale_cancella on musica_sale for delete to authenticated using (e_staff());

revoke all on musica_sale from anon, authenticated;
grant select, insert, update, delete on musica_sale to authenticated;

/** Le liste del tablet che chiama: quelle della sua sala e quelle di tutte. */
create or replace function musica_sala()
  returns table (id uuid, nome text, link text, sala_id uuid)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  p uuid := postazione_corrente();
  sala uuid;
begin
  if p is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  select postazioni.sala_id into sala from postazioni where postazioni.id = p;
  return query
    select m.id, m.nome, m.link, m.sala_id from musica_sale m
    where m.sala_id is null or m.sala_id = sala
    order by m.sala_id nulls last, m.ordine, m.nome;
end $$;

revoke all on function musica_sala() from public, anon;
grant execute on function musica_sala() to authenticated;

-- Che l'API veda subito funzioni e tabelle nuove, senza aspettare.
notify pgrst, 'reload schema';
