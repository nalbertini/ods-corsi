-- ---------------------------------------------------------------------------
-- ODS Corsi · la pagina «Orari» del sito pubblico
--
-- Il generatore del sito (scripts/genera-sito.mjs) mette gli orari dei corsi
-- nella pagina «orari» e li legge da `orari_sito()`, con la chiave anon.
--
-- Chi può cosa:
--   · `anon` (e chiunque) chiama `orari_sito()`: di ogni corso attivo, le
--     ricorrenze non finite, solo nome del corso, giorno, ora, durata e quando
--     quell'orario è cambiato l'ultima volta. Niente sala, istruttore,
--     capienza, id, date, lezioni o iscritti; le tabelle restano chiuse.
--   · `ricorrenze.modificata_il` la scrive sempre il database (trigger, a ogni
--     inserimento e a ogni cambio di giorno, ora, durata, fine o corso):
--     nessuno la sposta a mano. Da lì viene
--     «Aggiornato al…» della pagina.
--   · `orari_aperti()` (48-orari-aperti.sql) resta com'è: dà gli id dei corsi,
--     serve al modulo di iscrizione.
--
-- Si lancia dopo `06-iscrizioni.sql`, e non chiede di rilanciarlo. Se lo si
-- rilancia dopo, è `06` a rimettere il permesso ad `anon` su `orari_sito()`.
-- Finché non c'è, il giro che genera il sito si ferma e dice di lanciare
-- questo file: il sito di prima resta com'è.
-- ---------------------------------------------------------------------------

alter table ricorrenze add column if not exists modificata_il timestamptz not null default now();

-- Adesso, quando la ricorrenza nasce o cambia l'orario (giorno, ora, durata,
-- fine, corso); altrimenti resta quella di prima, anche se chi modifica ne
-- scrive un'altra. Una data portata a mano farebbe dire alla pagina
-- «Aggiornato al» il falso, e un cambio di sala non è un cambio di orario.
create or replace function ricorrenza_modificata() returns trigger
  language plpgsql set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT'
     or (new.giorno, new.ora, new.durata_min, new.al, new.corso_id)
        is distinct from (old.giorno, old.ora, old.durata_min, old.al, old.corso_id) then
    new.modificata_il := now();
  else
    new.modificata_il := old.modificata_il;
  end if;
  return new;
end $$;

revoke all on function ricorrenza_modificata() from public;

create or replace trigger ricorrenza_modificata
  before insert or update on ricorrenze
  for each row execute function ricorrenza_modificata();

create or replace function orari_sito()
  returns table (corso text, giorno int, ora time, durata_min int, modificata_il timestamptz)
  language sql stable security definer set search_path = public, extensions as $$
  select c.nome, r.giorno, r.ora, r.durata_min, r.modificata_il
  from ricorrenze r
  join corsi c on c.id = r.corso_id
  where c.attivo and (r.al is null or r.al >= current_date)
  order by r.giorno, r.ora, c.nome
$$;

revoke all on function orari_sito() from public;
grant execute on function orari_sito() to anon, authenticated;

notify pgrst, 'reload schema';
