-- ---------------------------------------------------------------------------
-- ODS Corsi · «Aggiungi chi prova» cerca fra tutte le persone della palestra
--
-- Il tasto dell'appello apre una pagina che cerca per nome e cognome fra
-- tutte le persone iscritte e attive, non solo fra chi ha già provato negli
-- ultimi novanta giorni (`prove_recenti`, 21-prove.sql): così chi è iscritto a
-- un altro corso e viene a provare questo si trova, e si aggiunge con un
-- tocco. Se la persona non c'è, l'app fa scrivere il nome a mano (e
-- `aggiungi_prova` crea la persona, com'è sempre stato).
--
-- Chi può cosa:
--   · la legge il personale (istruttori e segreteria), come l'appello;
--   · mai il telefono, nemmeno alla segreteria: per richiamare c'è già
--     `prove_recenti`, e qui serve solo riconoscere una persona. Per
--     distinguere due omonimi si dicono i corsi a cui è iscritta oggi;
--   · il tablet no: il tablet non legge `persone`, e questa funzione non ha
--     una versione col PIN;
--   · non compaiono il personale né le persone disattivate: non sono prove.
--
-- Tre cose contro chi la usa per scaricare l'elenco: la stessa soglia di
-- `provati_con_pin` (una parola di almeno tre lettere, `somiglia` di
-- 34-prove-per-nome.sql), l'ordine per cognome e al massimo ventuno righe,
-- una più dei venti che l'app mostra: serve a dire «ce ne sono altri» senza
-- dare l'elenco intero. Non c'è un tetto di richieste, come per
-- `prove_recenti`: chi chiama ha già accesso a tutta l'anagrafica
-- (`persone_legge`, 02-policy.sql).
--
-- Si lancia dopo `34-prove-per-nome.sql`, da cui prende `somiglia`. Crea una
-- funzione e dice lei a chi: non chiede di rilanciare `06-iscrizioni.sql`.
-- Finché non c'è, l'app dice che manca l'aggiornamento e lascia aggiungere
-- il nome a mano; l'appello degli iscritti non cambia.
-- ---------------------------------------------------------------------------

create or replace function cerca_persone(scritto text)
  returns table (persona_id uuid, nome text, cognome text, corsi text[])
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_personale() then raise exception 'la ricerca è di chi fa l''appello' using errcode = '42501'; end if;
  -- Un nome sta in cento lettere; un testo più lungo occuperebbe solo il database.
  if length(coalesce(scritto, '')) > 100 then return; end if;
  return query
    select p.id, p.nome, p.cognome,
           coalesce(array(
             select c.nome from iscrizioni i join corsi c on c.id = i.corso_id
             where i.persona_id = p.id
               and i.dal <= (now() at time zone 'Europe/Rome')::date
               and (i.al is null or i.al >= (now() at time zone 'Europe/Rome')::date)
             order by c.nome
           ), '{}')
    from persone p
    where p.ruolo = 'iscritto' and p.attiva and somiglia(p.nome, p.cognome, scritto)
    order by p.cognome, p.nome, p.id
    limit 21;
end $$;

revoke all on function cerca_persone(text) from public, anon;
grant execute on function cerca_persone(text) to authenticated;

-- Che l'API veda subito la funzione nuova, senza aspettare.
notify pgrst, 'reload schema';
