-- ---------------------------------------------------------------------------
-- ODS Corsi · il kanji degli istruttori
--
-- Ogni istruttore (e chi fa segreteria) può avere un kanji: un segno solo,
-- scelto dalla segreteria in ISTRUTTORI E ACCESSI, che lo fa riconoscere a
-- colpo d'occhio accanto al nome, nel calendario e nell'appello. Due persone
-- non possono avere lo stesso: servirebbe a poco.
--
-- Si scrive come il resto di `persone`, dalla segreteria (02-policy.sql), e
-- si legge con la persona. Non crea funzioni: non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, l'app funziona come prima, senza kanji.
-- ---------------------------------------------------------------------------

alter table persone add column if not exists kanji text;

-- Un ideogramma solo, CJK (vedi `eKanji` in src/lib/kanji.ts).
do $$ begin
  alter table persone add constraint persone_kanji_uno
    check (kanji is null or kanji ~ '^[㐀-䶿一-鿿豈-﫿]$');
exception when duplicate_object then null; end $$;

create unique index if not exists persone_kanji_unico on persone (kanji) where kanji is not null;
