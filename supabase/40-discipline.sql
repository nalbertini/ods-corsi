-- ---------------------------------------------------------------------------
-- ODS Corsi · le discipline della palestra
--
-- Esercizi, timer e liste di musica si dividono per disciplina (Judo, Lotta,
-- Pilates, Yoga…), oltre che per tipo. La lista delle discipline la tiene la
-- segreteria, ed è una sola per tutte le sale. Sta in una colonna della riga
-- delle impostazioni, come il catalogo degli esercizi (13-voce-esercizi.sql):
-- chi la legge e chi la cambia è già deciso da 05-segreteria.sql, la legge
-- chiunque abbia un accesso, tablet compresi, la cambia la segreteria. È un
-- array di `{id, nome}`; la ripulisce l'app (`timer/src/lib/discipline.ts`).
--
-- Una voce — un esercizio, un timer, una lista di musica — ha una disciplina
-- sola, o nessuna. Esercizi e timer la tengono dentro il loro JSON (il catalogo
-- e lo schema), che il database non interpreta; le liste di musica in una
-- colonna. Non è una chiave esterna di proposito: togliere una disciplina dalla
-- lista non cancella né blocca niente, e le voci che la nominavano tornano
-- senza disciplina (l'app lo capisce e lo ripulisce al salvataggio). Per
-- «tutte» si scrive `tutte`, che non è nella lista.
--
-- Si lancia dopo `13-voce-esercizi.sql` e dopo `09-musica.sql`. La funzione
-- del tablet non va ad `anon`, quindi non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, l'app funziona come prima, senza
-- filtri per disciplina.
-- ---------------------------------------------------------------------------

alter table impostazioni add column if not exists discipline jsonb
  default '[{"id":"judo","nome":"Judo"},{"id":"lotta","nome":"Lotta"},{"id":"pilates","nome":"Pilates"},{"id":"yoga","nome":"Yoga"}]'::jsonb;

alter table impostazioni drop constraint if exists impostazioni_discipline_check;
alter table impostazioni add constraint impostazioni_discipline_check
  check (discipline is null or (jsonb_typeof(discipline) = 'array' and octet_length(discipline::text) <= 4000
                                         and jsonb_array_length(discipline) <= 50));

alter table musica_sale add column if not exists disciplina text;
alter table musica_sale drop constraint if exists musica_sale_disciplina_check;
alter table musica_sale add constraint musica_sale_disciplina_check
  check (disciplina is null or disciplina ~ '^[a-z0-9-]{1,30}$');

-- Il tablet riceve la disciplina insieme alle liste. Cambiano le colonne
-- restituite, quindi la funzione si toglie e si rifà.
drop function if exists musica_sala();
create function musica_sala()
  returns table (id uuid, nome text, link text, sala_id uuid, disciplina text)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  p uuid := postazione_corrente();
  sala uuid;
begin
  if p is null then raise exception 'solo un tablet di sala' using errcode = '42501'; end if;
  select postazioni.sala_id into sala from postazioni where postazioni.id = p;
  return query
    select m.id, m.nome, m.link, m.sala_id, m.disciplina from musica_sale m
    where m.sala_id is null or m.sala_id = sala
    order by m.sala_id nulls last, m.ordine, m.nome;
end $$;

revoke all on function musica_sala() from public, anon;
grant execute on function musica_sala() to authenticated;

-- Che l'API veda subito colonne e funzioni nuove, senza aspettare.
notify pgrst, 'reload schema';
