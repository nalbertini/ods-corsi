-- ---------------------------------------------------------------------------
-- ODS Corsi · il kanji degli istruttori
--
-- Ogni istruttore (e chi fa segreteria) può avere un kanji: un segno solo,
-- scelto dalla segreteria in ISTRUTTORI E ACCESSI, che lo fa riconoscere a
-- colpo d'occhio accanto al nome, nel calendario e nell'appello. Due persone
-- non possono avere lo stesso: servirebbe a poco.
--
-- Si scrive come il resto di `persone`, dalla segreteria (02-policy.sql), e
-- si legge con la persona. Il tablet di sala, che `persone` non la legge, li
-- prende da `kanji_sala`, accanto a `lezioni_sala` (04-tablet.sql) senza
-- cambiarla: un tablet non ancora aggiornato continua a funzionare.
--
-- Si lancia dopo `04-tablet.sql`. Crea una funzione, ma dice lei a chi: non
-- chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, l'app funziona
-- come prima, senza kanji.
-- ---------------------------------------------------------------------------

alter table persone add column if not exists kanji text;

-- Un ideogramma solo, CJK (vedi `eKanji` in src/lib/kanji.ts).
do $$ begin
  alter table persone add constraint persone_kanji_uno
    check (kanji is null or kanji ~ '^[㐀-䶿一-鿿豈-﫿]$');
exception when duplicate_object then null; end $$;

create unique index if not exists persone_kanji_unico on persone (kanji) where kanji is not null;

-- ---------------------------------------------------------------------------
-- I kanji delle lezioni del tablet: di chi le fa, con la regola di
-- `lezioni_sala` (il sostituto se c'è, altrimenti chi insegna il corso) e
-- nello stesso ordine dei nomi. Le lezioni sono quelle di `lezioni_sala`,
-- che controlla anche che a chiedere sia un tablet. Una lezione senza kanji
-- non c'è.
-- ---------------------------------------------------------------------------
create or replace function kanji_sala(da_giorno date, a_giorno date)
  returns table (sessione_id uuid, kanji text)
  language sql stable security definer set search_path = public, extensions as $$
  select * from (
    select l.id,
      coalesce(
        case when s.istruttore_id is distinct from c.istruttore_id then (select pe.kanji from persone pe where pe.id = s.istruttore_id) end,
        (select string_agg(pe.kanji, '' order by pe.nome) from corsi_istruttori ci join persone pe on pe.id = ci.persona_id where ci.corso_id = c.id),
        (select pe.kanji from persone pe where pe.id = c.istruttore_id)
      ) as kanji
    from lezioni_sala(da_giorno, a_giorno) l
    join sessioni s on s.id = l.id
    join corsi c on c.id = s.corso_id
  ) x where x.kanji is not null
$$;

revoke all on function kanji_sala(date, date) from public, anon;
grant execute on function kanji_sala(date, date) to authenticated;

notify pgrst, 'reload schema';
