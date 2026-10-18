-- ---------------------------------------------------------------------------
-- ODS Corsi · gli accessi, più stretti
--
-- Da una revisione di sicurezza dello schema. Niente che si veda in app:
-- restano fuori solo gli account che non sono di lavoro.
--
--   · `sessioni` e `impostazioni` le leggeva ogni account con un accesso, anche
--     un iscritto o uno che si fosse registrato da solo. Ora le legge chi
--     lavora: istruttori e segreteria (`e_personale()`), l'amministrazione
--     (`e_amministrazione()`, che il listino lo cambia da lì) e i tablet di sala.
--   · `allunga_calendario()` la poteva chiamare ogni account con un accesso, e
--     scrive nelle sessioni. Ora solo chi lavora, tablet compresi.
--   · `materializza_sessioni`, `pulisci_presenze`, `imposta_pin`,
--     `chiudi_ricorrenza` e `salva_date_corsi` lasciavano passare chi non ha un
--     utente (`auth.uid() is not null and not e_staff()`), perché è così che le
--     chiama un job o il SQL Editor. Reggeva solo il `revoke` ad `anon`: uno
--     dimenticato in un file futuro le avrebbe aperte a tutti. Ora passa la
--     segreteria o il database stesso (`e_di_sistema()`), non una chiamata
--     dall'API senza accesso.
--
-- Le funzioni non si riscrivono: si cambia solo la riga del controllo nella
-- definizione che c'è nel database, e se la riga non c'è più il file si ferma.
--
-- Si lancia dopo `56-sito.sql`. Non chiede di rilanciare `06-iscrizioni.sql`.
-- Se si rilancia dopo di lui `02`, `03`, `04`, `05`, `12`, `35` o `55`, va
-- rilanciato anche lui.
-- ---------------------------------------------------------------------------

-- Chi chiama non passa dall'API: il SQL Editor, un job, o la chiave di servizio.
-- `session_user` resta chi si è collegato anche dentro una funzione `security
-- definer`; dall'API è `authenticator`, mai `postgres`.
create or replace function e_di_sistema() returns boolean
  language sql stable set search_path = public as $$
  -- `coalesce`: mai nulla, o un controllo `not e_di_sistema()` lascerebbe passare.
  select coalesce(auth.uid() is null and (
    session_user in ('postgres', 'supabase_admin')
    or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role') = 'service_role'), false)
$$;
revoke all on function e_di_sistema() from public, anon;
grant execute on function e_di_sistema() to authenticated;

-- --- chi legge sessioni e impostazioni ---------------------------------------
drop policy if exists sessioni_legge on sessioni;
create policy sessioni_legge on sessioni for select to authenticated
  using (e_personale() or e_amministrazione() or postazione_corrente() is not null);

drop policy if exists impostazioni_legge on impostazioni;
create policy impostazioni_legge on impostazioni for select to authenticated
  using (e_personale() or e_amministrazione() or postazione_corrente() is not null);

-- --- i controlli nelle funzioni ------------------------------------------------
do $$
declare
  f record;
  def text;
begin
  for f in
    select * from (values
      ('materializza_sessioni', 'auth.uid() is not null and not e_staff()', 'not e_staff() and not e_di_sistema()'),
      ('pulisci_presenze',      'auth.uid() is not null and not e_staff()', 'not e_staff() and not e_di_sistema()'),
      ('imposta_pin',           'auth.uid() is not null and not e_staff()', 'not e_staff() and not e_di_sistema()'),
      ('chiudi_ricorrenza',     'auth.uid() is not null and not e_staff()', 'not e_staff() and not e_di_sistema()'),
      ('salva_date_corsi',      'auth.uid() is not null and not e_staff()', 'not e_staff() and not e_di_sistema()'),
      ('allunga_calendario',    'if auth.uid() is null then raise exception ''serve un accesso''; end if;',
                                'if not (e_personale() or postazione_corrente() is not null) then raise exception ''serve un accesso di lavoro'' using errcode = ''42501''; end if;')
    ) as v(nome, vecchio, nuovo)
  loop
    -- Se un giorno una funzione avesse due firme, ognuna ha il suo controllo.
    for def in select pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = f.nome
    loop
      if position(f.nuovo in def) = 0 then
        if position(f.vecchio in def) = 0 then
          raise exception 'il controllo di %() non è più quello atteso: va guardata a mano', f.nome;
        end if;
        execute replace(def, f.vecchio, f.nuovo);
      end if;
    end loop;
  end loop;
end $$;

-- `create or replace` tiene i permessi di prima, ma si dicono qui lo stesso.
revoke all on function materializza_sessioni(date, date), pulisci_presenze(), imposta_pin(uuid, text),
  chiudi_ricorrenza(uuid), salva_date_corsi(date, date, boolean), allunga_calendario() from public, anon;
grant execute on function materializza_sessioni(date, date), pulisci_presenze(), imposta_pin(uuid, text),
  chiudi_ricorrenza(uuid), salva_date_corsi(date, date, boolean), allunga_calendario() to authenticated;

notify pgrst, 'reload schema';
