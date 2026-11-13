-- ---------------------------------------------------------------------------
-- ODS Corsi · i candidati di «Chi ha pagato e per cosa?» dal testo del bonifico
--
-- `candidati_persona_movimento` (70, cambiata dal 98) leggeva solo il nome di
-- «Cliente NOME per …», la causale del vecchio programma, e rifiutava le entrate
-- «Da classificare». Un bonifico della banca («DA MATERA ELISA PER SALDO …
-- DIEGO ORRU») è proprio un'entrata da classificare, e nella finestra non
-- usciva nessuno: c'era solo la ricerca a mano. Ora sono candidate anche le
-- schede il cui nome e cognome interi, in un ordine o nell'altro, stanno nel
-- testo (senza accenti, punteggiatura e maiuscole), e un'entrata da
-- classificare ha i suoi candidati. Il collegamento automatico (`collegamento_candidati`,
-- i sicuri, i punteggi del 119 e del 121) non cambia: questi sono solo suggerimenti.
--
-- Chi può: come prima, l'amministrazione (`contabilita_porta`), che già cerca
-- chiunque per nome (`cerca_pagatori`).
--
-- Si lancia dopo `98-quote-persona.sql`. Rifà `candidati_persona_movimento`: se
-- si rilancia il 70 dopo, va rilanciato anche questo (`controllo.sql` lo dice).
-- Non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, la finestra
-- aperta su un bonifico della banca non suggerisce nessuno, come prima.
-- ---------------------------------------------------------------------------

-- Il testo in parole intere, con uno spazio ai bordi: come `collegamento_token` (accenti, apostrofi, l'apostrofo
-- che fa da accento) ma senza mettere le parole in ordine, e la punteggiatura diventa spazio.
create or replace function collegamento_testo(t text) returns text language sql immutable set search_path = public as $$
  select ' ' || btrim(regexp_replace(regexp_replace(
    regexp_replace(normalize(translate(lower(coalesce(t, '')), '‘’`', repeat(chr(39), 3)), NFD), '[̀-ͯ]', '', 'g'),
    '[^[:alnum:]'']+', ' ', 'g'), '([aeiou])''(?= |$)', '\1', 'g')) || ' ' $$;

create or replace function candidati_persona_movimento(movimento uuid)
  returns table (id uuid, nome text, cognome text, anno_nascita integer, corsi text[], iscritto_dal date)
  language plpgsql security definer set search_path = public as $$
declare
  mv movimenti;
  no text;
  testo text;
begin
  perform contabilita_porta();
  select * into mv from movimenti x where x.id = movimento;
  if not found then raise exception 'Il movimento non c’è' using errcode = 'P0002'; end if;
  no := collegamento_perche(mv);
  -- Un'entrata da classificare è proprio quella da decidere: per i suggerimenti va bene.
  if no is not null and not (mv.tipo = 'entrata' and mv.annullato_il is null
      and exists (select 1 from voci_contabili v where v.id = mv.voce_id and v.nome = 'Da classificare')) then
    raise exception '%', no using errcode = '22023';
  end if;
  testo := collegamento_testo(mv.descrizione);
  return query
    -- `q`: gli omonimi veri (lo stesso nome), non tutti i candidati: anno, corsi e iscrizione servono solo a distinguere
    -- loro, e con due nomi diversi nel testo resterebbero visibili a chi non legge le anagrafiche.
    with c as (
      select p.id, p.nome, p.cognome, count(*) over (partition by collegamento_token(p.nome || ' ' || p.cognome)) as q
      from persone p
      where p.id in (select collegamento_candidati(mv.descrizione))
         or (btrim(collegamento_testo(p.nome || ' ' || p.cognome)) <> ''
             and (position(collegamento_testo(p.nome || ' ' || p.cognome) in testo) > 0
                  or position(collegamento_testo(p.cognome || ' ' || p.nome) in testo) > 0)))
    select c.id, c.nome, c.cognome,
           case when c.q > 1 then extract(year from a.nato_il)::integer end,
           case when c.q > 1
             then coalesce((select array_agg(k.nome order by k.nome) from iscrizioni i join corsi k on k.id = i.corso_id where i.persona_id = c.id), '{}')
             else '{}'::text[] end,
           case when c.q > 1 then (select min(i.dal) from iscrizioni i where i.persona_id = c.id) end
    from c left join anagrafiche a on a.persona_id = c.id
    order by c.cognome, c.nome, c.id;
end $$;

-- `collegamento_testo` come le altre di appoggio: nessuno la chiama da fuori.
revoke all on function collegamento_testo(text) from public, anon, authenticated;
revoke all on function candidati_persona_movimento(uuid) from public, anon;
grant execute on function candidati_persona_movimento(uuid) to authenticated;

notify pgrst, 'reload schema';
