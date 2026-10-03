-- ---------------------------------------------------------------------------
-- ODS Corsi · nomi e cognomi scritti tutti allo stesso modo
--
-- La prima lettera di ogni parola maiuscola, il resto minuscolo, gli spazi in
-- più via: «MARIA GRAZIA» e «maria grazia» diventano «Maria Grazia»,
-- «d'amico» «D'Amico», «rossi-bianchi» «Rossi-Bianchi». L'app lo fa già prima
-- di salvare (`src/lib/nomi.ts`); qui lo fa il database da sé, così vale
-- anche per il modulo di iscrizione, per l'import e per quello che si scrive
-- a mano dal SQL Editor.
--
-- Vale per `persone`, per le richieste di iscrizione e per le anagrafiche
-- (anche il nome del genitore), e per l'intestatario delle ricevute nuove.
-- Le ricevute già emesse restano com'erano: sono documenti dati al socio.
--
-- In fondo sistema i nomi già salvati. Si lancia dopo `18-anagrafiche.sql`,
-- e si può rilanciare quante volte si vuole. Non chiede di rilanciare
-- `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

-- Non `initcap`: sul database di Supabase lascia minuscola la lettera dopo
-- l'apostrofo, «D'amico». Qui, come nell'app, la maiuscola va dopo qualunque
-- cosa non sia una lettera o una cifra.
create or replace function nome_proprio(x text) returns text
  language sql immutable parallel safe set search_path = public as $$
  select coalesce(string_agg(case when i = 1 or substr(s, i - 1, 1) !~ '[[:alpha:][:digit:]]' then upper(substr(s, i, 1)) else substr(s, i, 1) end, '' order by i), s)
  from (select lower(regexp_replace(btrim(x), '\s+', ' ', 'g')) as s) t left join generate_series(1, length(s)) i on true
  group by s
$$;

create or replace function persona_nomi() returns trigger language plpgsql set search_path = public as $$
begin
  new.nome := nome_proprio(new.nome);
  new.cognome := nome_proprio(new.cognome);
  return new;
end $$;
create or replace trigger persone_nomi before insert or update of nome, cognome on persone
  for each row execute function persona_nomi();

create or replace function richiesta_nomi() returns trigger language plpgsql set search_path = public as $$
begin
  new.nome := nome_proprio(new.nome);
  new.cognome := nome_proprio(new.cognome);
  new.genitore_nome := nome_proprio(new.genitore_nome);
  new.genitore_cognome := nome_proprio(new.genitore_cognome);
  return new;
end $$;
create or replace trigger richieste_nomi before insert or update of nome, cognome, genitore_nome, genitore_cognome on richieste_iscrizione
  for each row execute function richiesta_nomi();

create or replace function anagrafica_nomi() returns trigger language plpgsql set search_path = public as $$
begin
  new.genitore_nome := nome_proprio(new.genitore_nome);
  new.genitore_cognome := nome_proprio(new.genitore_cognome);
  return new;
end $$;
create or replace trigger anagrafiche_nomi before insert or update of genitore_nome, genitore_cognome on anagrafiche
  for each row execute function anagrafica_nomi();

-- Solo all'emissione: dopo, la ricevuta è quella che ha il socio.
create or replace function ricevuta_nomi() returns trigger language plpgsql set search_path = public as $$
declare
  k text;
begin
  foreach k in array array['nome', 'cognome', 'genitore'] loop
    if jsonb_typeof(new.intestatario->k) = 'string' then
      new.intestatario := jsonb_set(new.intestatario, array[k], to_jsonb(nome_proprio(new.intestatario->>k)));
    end if;
  end loop;
  return new;
end $$;
create or replace trigger ricevute_nomi before insert on ricevute
  for each row execute function ricevuta_nomi();

-- I nomi già salvati. Le anagrafiche senza toccare chi le ha cambiate e
-- quando: non le ha cambiate nessuno, si è solo sistemato come sono scritte.
update persone set nome = nome, cognome = cognome
  where nome is distinct from nome_proprio(nome) or cognome is distinct from nome_proprio(cognome);

update richieste_iscrizione set nome = nome
  where nome is distinct from nome_proprio(nome) or cognome is distinct from nome_proprio(cognome)
     or genitore_nome is distinct from nome_proprio(genitore_nome) or genitore_cognome is distinct from nome_proprio(genitore_cognome);

alter table anagrafiche disable trigger anagrafiche_cambiata;
update anagrafiche set genitore_nome = genitore_nome
  where genitore_nome is distinct from nome_proprio(genitore_nome) or genitore_cognome is distinct from nome_proprio(genitore_cognome);
alter table anagrafiche enable trigger anagrafiche_cambiata;

-- Le funzioni nascono eseguibili da tutti, `anon` compreso: si chiudono qui.
revoke all on function nome_proprio(text), persona_nomi(), richiesta_nomi(), anagrafica_nomi(), ricevuta_nomi() from public, anon;
grant execute on function nome_proprio(text), persona_nomi(), richiesta_nomi(), anagrafica_nomi(), ricevuta_nomi() to authenticated;

notify pgrst, 'reload schema';
