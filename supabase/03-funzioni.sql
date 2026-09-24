-- ---------------------------------------------------------------------------
-- ODS Timer · sala corsi — funzioni
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Dal «martedì alle 19» alle lezioni vere.
--
-- Si chiama periodicamente (un job settimanale che copre il mese successivo) e
-- si può richiamare quante volte si vuole: l'indice unico su (corso, inizio)
-- fa sì che rigenerare non duplichi. Restituisce quante lezioni ha creato.
--
-- L'ora della ricorrenza è ora di Collegno, non UTC: `at time zone` converte
-- un orario locale in un istante, ed è il motivo per cui il cambio di ora
-- legale non sposta lo spinning delle 19.
-- ---------------------------------------------------------------------------
-- I parametri NON si chiamano `dal` e `al`: sono anche i nomi delle colonne di
-- `ricorrenze`, e dentro la funzione Postgres non saprebbe a quale dei due ci
-- si riferisce. Sbaglia a favore dell'errore, per fortuna, invece che a favore
-- di un calendario silenziosamente sbagliato.
-- `create or replace` non sa rinominare un parametro, quindi rilanciare questo
-- file dopo averne cambiato uno fallirebbe. Si butta giù prima: è il prezzo di
-- poter riapplicare il file senza pensarci.
drop function if exists materializza_sessioni(date, date);
create or replace function materializza_sessioni(da_giorno date, a_giorno date)
  returns int language plpgsql security definer set search_path = public as $$
declare
  creati int;
begin
  -- Gira con i privilegi del proprietario, quindi chi la chiama va controllato
  -- a mano: o è la segreteria, o non è un utente del browser (un job, l'import).
  if auth.uid() is not null and not e_staff() then
    raise exception 'solo la segreteria può rigenerare il calendario';
  end if;
  if a_giorno < da_giorno then raise exception 'intervallo al contrario: % → %', da_giorno, a_giorno; end if;
  if a_giorno - da_giorno > 400 then raise exception 'intervallo troppo lungo: % giorni', a_giorno - da_giorno; end if;

  with giorni as (
    select r.*, c.sala_id, c.istruttore_id, g::date as giorno_vero
    from ricorrenze r
    join corsi c on c.id = r.corso_id and c.attivo
    cross join lateral generate_series(
      greatest(da_giorno, r.dal)::timestamp,
      least(a_giorno, coalesce(r.al, a_giorno))::timestamp,
      interval '1 day'
    ) g
    where extract(dow from g) = r.giorno
  ),
  nuove as (
    insert into sessioni (corso_id, ricorrenza_id, inizio, fine, sala_id, istruttore_id)
    select
      corso_id,
      id,
      (giorno_vero + ora) at time zone 'Europe/Rome',
      (giorno_vero + ora) at time zone 'Europe/Rome' + make_interval(mins => durata_min),
      sala_id,
      istruttore_id
    from giorni
    on conflict (corso_id, inizio) do nothing
    returning 1
  )
  select count(*) into creati from nuove;

  return creati;
end $$;

-- ---------------------------------------------------------------------------
-- Chi ha segnato la presenza lo decide il server.
--
-- Senza questo, `segnata_da` è un campo che il client riempie come gli pare, e
-- la tracciabilità su cui si regge la policy delle presenze non varrebbe
-- niente. Quando non c'è un utente collegato — l'import, un job — resta quello
-- che è stato passato, così uno script può attribuire correttamente.
-- ---------------------------------------------------------------------------
create or replace function imposta_segnata_da() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  new.segnata_da := coalesce(persona_corrente(), new.segnata_da);
  new.segnata_il := now();
  return new;
end $$;

drop trigger if exists presenze_chi_segna on presenze;
create trigger presenze_chi_segna before insert or update on presenze
  for each row execute function imposta_segnata_da();

-- ---------------------------------------------------------------------------
-- Conservazione: le presenze non si tengono per sempre.
--
-- Da chiamare con un job. Il periodo sta in `presenze_scadute` (01-schema.sql)
-- ed è una scelta della palestra da mettere per iscritto nell'informativa, non
-- un numero che decide il codice.
-- ---------------------------------------------------------------------------
create or replace function pulisci_presenze()
  returns int language plpgsql security definer set search_path = public as $$
declare tolte int;
begin
  if auth.uid() is not null and not e_staff() then
    raise exception 'solo la segreteria può cancellare lo storico presenze';
  end if;
  with andate as (delete from presenze where id in (select id from presenze_scadute) returning 1)
  select count(*) into tolte from andate;
  return tolte;
end $$;
