-- ---------------------------------------------------------------------------
-- ODS Corsi · il timer di una singola lezione
--
-- `corsi_timer` (08-timer.sql) lega un timer a un corso, e vale per tutte le
-- sue lezioni. Ma la lezione del giovedì prima della gara non è quella di
-- tutti i giovedì: qui si lega un timer a una lezione sola. Quella lezione
-- apre prima il suo timer, dall'appello e dal tablet di sala; le altre del
-- corso restano coi timer del corso.
--
-- Si sceglie da ODS Corsi, in I MIEI TIMER dell'area istruttori. Come per i
-- corsi, lo può fare qualunque istruttore, non solo chi tiene la lezione:
-- le sostituzioni si decidono dieci minuti prima. Chi l'ha collegato resta
-- scritto.
--
-- Si lancia dopo `10-timer-sale.sql`. Non crea funzioni, quindi non chiede
-- di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

create table if not exists sessioni_timer (
  sessione_id   uuid not null references sessioni on delete cascade,
  timer_id      uuid not null references timer on delete cascade,
  collegato_il  timestamptz not null default now(),
  collegato_da  uuid references persone on delete set null default persona_corrente(),
  primary key (sessione_id, timer_id)
);
create index if not exists sessioni_timer_timer on sessioni_timer (timer_id);

alter table sessioni_timer enable row level security;

drop policy if exists sessioni_timer_legge on sessioni_timer;
drop policy if exists sessioni_timer_scrive on sessioni_timer;
drop policy if exists sessioni_timer_cancella on sessioni_timer;

-- Lo legge chiunque abbia un accesso, tablet compresi: il tablet deve sapere
-- quale timer aprire con la lezione. Si collega solo un timer che si vede.
create policy sessioni_timer_legge on sessioni_timer for select to authenticated using (true);
create policy sessioni_timer_scrive on sessioni_timer for insert to authenticated
  with check (e_personale() and exists (select 1 from timer t where t.id = timer_id));
create policy sessioni_timer_cancella on sessioni_timer for delete to authenticated using (e_personale());

-- Un timer personale legato a una lezione lo deve vedere anche il tablet, e
-- il collega che fa quella lezione: come per i corsi.
drop policy if exists timer_legge on timer;
create policy timer_legge on timer for select to authenticated
  using (persona_id is null or persona_id = persona_corrente()
         or exists (select 1 from corsi_timer ct where ct.timer_id = timer.id)
         or exists (select 1 from sessioni_timer st where st.timer_id = timer.id));

revoke all on sessioni_timer from anon, authenticated;
grant select, insert, delete on sessioni_timer to authenticated;

-- Che l'API veda subito la tabella nuova, senza aspettare.
notify pgrst, 'reload schema';
