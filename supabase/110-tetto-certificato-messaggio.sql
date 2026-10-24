-- Il tetto ai file del certificato dice all'iscritto cosa fare (110-tetto-certificato-messaggio.sql).
--
-- Il tetto di 3 file `attesa-N` per persona (109) scattava con 42501, e Storage
-- trasforma ogni 42501 in «new row violates row-level security policy»: il
-- testo «aspetta che la segreteria li guardi» non arrivava all'app. Ora scatta
-- con 54000 (program_limit_exceeded), che Storage lascia passare col suo testo.
--
-- In più il trigger scatta prima della policy, quindi chi non è titolare di una
-- cartella piena vedeva l'errore del tetto e capiva che lì c'erano 3 file.
-- Ora il tetto conta solo se la policy lascerebbe caricare (stessa condizione
-- di `certificati_iscritto_carica`, 102): gli altri ricevono l'errore della
-- policy, uguale a quello di una cartella vuota.
--
-- Si lancia dopo `109-privilegi-e-certificati.sql`; rilanciare il 109 dopo il
-- 110 riporta la funzione al vecchio comportamento (42501, senza filtro): se
-- succede, rilanciare anche il 110. Finché non c'è, l'app
-- mostra il messaggio generico «riprova fra poco».
-- ---------------------------------------------------------------------------

create or replace function limita_file_certificato() returns trigger
  language plpgsql security definer set search_path = public, extensions as $$
declare
  cartella text := split_part(new.name, '/', 1);
begin
  if cartella !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or not public.iscritto_puo_mandare(cartella::uuid) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('certificati:' || cartella));
  if (select count(*) from storage.objects o where o.bucket_id = 'certificati' and o.name like cartella || '/attesa-%') >= 3 then
    raise exception 'Hai già mandato troppi file: aspetta che la segreteria li guardi' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function limita_file_certificato() from public, anon, authenticated;

notify pgrst, 'reload schema';
