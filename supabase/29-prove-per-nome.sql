-- ---------------------------------------------------------------------------
-- ODS Corsi · chi è già venuto a provare, sul tablet, si cerca per nome
--
-- Sul tablet, col PIN, il pannello PROVE propone chi è già venuto a provare
-- mentre si scrive il nome. Prima `provati_con_pin(pin)` dava l'elenco intero
-- degli ultimi novanta giorni, e la soglia delle tre lettere stava solo nel
-- browser: chi aveva un PIN poteva leggere tutti i nomi, spesso di bambini.
-- Ora il database restituisce solo chi somiglia a quel che si scrive, dalla
-- terza lettera di una parola, al massimo venti e i più recenti: la stessa
-- regola di `somiglianti` (src/lib/prove.ts), carattere per carattere. E al
-- massimo cento ricerche in dieci minuti e trecento in un giorno per tablet:
-- chi prova le combinazioni di tre lettere per ricostruire l'elenco ci mette
-- giorni.
--
-- Il tablet non legge `persone` né `prove`: questa è l'unica strada da cui
-- gli arrivano quei nomi. L'istruttore e la segreteria leggono già tutta
-- l'anagrafica, e `prove_recenti()` (21-prove.sql) resta com'è.
--
-- Si lancia dopo `21-prove.sql`, che non crea più `provati_con_pin`. Chiude
-- da sé le sue funzioni: non chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, sul tablet i già venuti non compaiono e il pannello dice
-- che non li vede; aggiungere funziona.
-- ---------------------------------------------------------------------------

-- La versione che dava tutti: se restasse, il confine si aggirerebbe.
drop function if exists provati_con_pin(text);

/** Senza accenti e in minuscolo, come `piano` in src/lib/prove.ts: `unaccent` cambierebbe anche ø e ß. */
create or replace function testo_piano(t text) returns text
  language sql immutable set search_path = pg_catalog as $$
  -- Lo spazio indivisibile e quello invisibile, che per JS sono spazi e per Postgres no.
  select lower(regexp_replace(regexp_replace(normalize(coalesce(t, ''), nfd), '[\u0300-\u036f]', '', 'g'), '[\u00a0\ufeff]', ' ', 'g'))
$$;

/**
 * `somiglianti` di src/lib/prove.ts per una persona: ogni parola scritta è
 * l'inizio di una parola del nome o del cognome (anche apostrofi e trattini
 * staccano), o del nome o del cognome attaccati; oppure tutto lo scritto
 * attaccato è l'inizio del nome o del cognome attaccati. Senza una parola di
 * almeno tre lettere, apostrofi e trattini tolti, nessuno (`bastaPerCercare`):
 * «d d d» troverebbe quasi tutti. `starts_with` e non
 * `like`: % e _ scritti nel campo sono lettere, non jolly.
 */
create or replace function somiglia(nome text, cognome text, scritto text) returns boolean
  language plpgsql immutable set search_path = pg_catalog, public as $$
declare
  stacca constant text := '[''’‘ʼ´-]';
  parole text[] := array(select w from regexp_split_to_table(regexp_replace(testo_piano(scritto), stacca, '', 'g'), '\s+') w where w <> '');
  nomi text[] := array[testo_piano(nome), testo_piano(cognome)];
  attaccati text[] := array(select regexp_replace(regexp_replace(n, stacca, '', 'g'), '\s', '', 'g') from unnest(nomi) n);
  sue text[] := array(select w from unnest(nomi) n, regexp_split_to_table(regexp_replace(n, stacca, ' ', 'g'), '\s+') w) || attaccati;
begin
  if coalesce((select max(length(w)) from unnest(parole) w), 0) < 3 then return false; end if;
  return (select bool_and(exists (select 1 from unnest(sue) s where starts_with(s, w))) from unnest(parole) w)
    or exists (select 1 from unnest(attaccati) a where starts_with(a, array_to_string(parole, '')));
end $$;

-- Quando ogni tablet ha cercato: per il tetto delle ricerche. La legge e la
-- scrive solo `provati_con_pin`.
create table if not exists ricerche_prove (
  postazione_id uuid not null references postazioni (id) on delete cascade,
  quando timestamptz not null default now()
);
create index if not exists ricerche_prove_postazione on ricerche_prove (postazione_id, quando);
alter table ricerche_prove enable row level security;
revoke all on ricerche_prove from anon, authenticated;

/** Chi è già venuto a provare e somiglia a `scritto`, per l'istruttore sul tablet: il telefono no, lo schermo è in sala. */
create or replace function provati_con_pin(pin text, scritto text)
  returns table (persona_id uuid, nome text, cognome text, telefono text, corso text, inizio timestamptz)
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if postazione_corrente() is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  -- Un PIN sbagliato non solleva, per la ragione scritta in `appello_con_pin`.
  if persona_da_pin(pin) is null then return; end if;
  -- `persona_da_pin` ha già messo in fila le chiamate di questo tablet: il
  -- conto non si scavalca con cento richieste insieme.
  -- Trecento al giorno: con i nomi più comuni, cento ogni dieci minuti
  -- darebbero quasi tutto l'elenco in un'ora.
  if (select count(*) filter (where r.quando > now() - interval '10 minutes') >= 100
             or count(*) filter (where r.quando > now() - interval '1 day') >= 300
      from ricerche_prove r where r.postazione_id = postazione_corrente()) then
    raise exception 'troppe ricerche: riprova fra qualche minuto' using errcode = '42501';
  end if;
  insert into ricerche_prove (postazione_id) values (postazione_corrente());
  delete from ricerche_prove where quando < now() - interval '1 day';
  -- Un nome sta in cento lettere; un testo più lungo occuperebbe solo il database.
  if length(scritto) > 100 then return; end if;
  -- Venti bastano a chi scrive un nome; a chi prova tutte le combinazioni di
  -- tre lettere costano di più.
  return query
    select g.* from gia_provati(false) g
    where somiglia(g.nome, g.cognome, scritto)
    order by g.inizio desc
    limit 20;
end $$;

revoke all on function testo_piano(text), somiglia(text, text, text) from public, anon, authenticated;
revoke all on function provati_con_pin(text, text) from public, anon;
grant execute on function provati_con_pin(text, text) to authenticated;

-- Che l'API veda subito la funzione nuova, senza aspettare.
notify pgrst, 'reload schema';
