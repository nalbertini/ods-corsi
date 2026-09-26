-- ---------------------------------------------------------------------------
-- Un account per il tablet di ogni sala, in un colpo solo.
--
-- Si lancia nel SQL Editor di Supabase, dopo gli script numerati. Per ogni
-- sala che non ha ancora un tablet crea l'utente, con nome utente e password,
-- e la sua riga in `postazioni`. Alla fine mostra la tabella da copiare:
--
--   sala | nome utente | password
--
-- Le password si vedono solo qui, una volta: nel database restano in bcrypt
-- come tutte le altre, e nessuno le può rileggere. Vanno scritte da qualche
-- parte subito. Una password persa si cambia da Authentication → Users.
--
-- Il nome utente è il nome della sala in minuscolo, senza accenti e con i
-- trattini al posto degli spazi («Sala grande» → `sala-grande`). Supabase
-- vuole un'email, e l'email è il nome utente più `@sale.ods-corsi.it`, lo
-- stesso dominio che il tablet aggiunge da sé (`DOMINIO_SALE` in
-- `src/lib/tablet.ts`): a quell'indirizzo non arriva mai niente.
--
-- Si rilancia senza danni: una sala che ha già un tablet attivo si salta, e
-- se l'utente c'è già (fatto a mano, o da un giro prima) si usa quello e la
-- password resta la sua.
-- ---------------------------------------------------------------------------
set search_path = public, extensions;

create temp table if not exists account_nuovi (sala text, nome_utente text, password text) on commit preserve rows;
truncate account_nuovi;

do $$
declare
  s          record;
  utente     text;
  indirizzo  text;
  parola     text;
  uid        uuid;
  lettere    constant text := 'abcdefghjkmnpqrstuvwxyz23456789';   -- niente l/1, o/0: si scrive a mano
begin
  for s in
    select sa.id, sa.nome from sale sa
    where not exists (select 1 from postazioni po where po.sala_id = sa.id and po.attiva)
    order by sa.nome
  loop
    utente := trim(both '-' from regexp_replace(
      translate(lower(s.nome), 'àáâäèéêëìíîïòóôöùúûüç', 'aaaaeeeeiiiioooouuuuc'),
      '[^a-z0-9]+', '-', 'g'));
    indirizzo := utente || '@sale.ods-corsi.it';

    select u.id into uid from auth.users u where lower(u.email) = indirizzo;
    if uid is null then
      parola := (select string_agg(substr(lettere, 1 + get_byte(b, i) % length(lettere), 1), '')
                 from (select gen_random_bytes(14) as b) x, generate_series(0, 13) as i);
      uid := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', indirizzo,
        crypt(parola, gen_salt('bf')), now(),
        '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, 'email',
              jsonb_build_object('sub', uid::text, 'email', indirizzo, 'email_verified', true), now(), now(), now());
    elsif exists (select 1 from postazioni po where po.utente_id = uid and not po.attiva) then
      -- Un tablet spento è quasi sempre un tablet perso: riaccenderlo con la
      -- password di prima rimetterebbe in funzione anche quello. Password
      -- nuova, e fuori chi era dentro.
      parola := (select string_agg(substr(lettere, 1 + get_byte(b, i) % length(lettere), 1), '')
                 from (select gen_random_bytes(14) as b) x, generate_series(0, 13) as i);
      update auth.users set encrypted_password = crypt(parola, gen_salt('bf')), updated_at = now() where id = uid;
      delete from auth.sessions where user_id = uid;
    else
      parola := '(utente già presente: password invariata)';
    end if;

    -- Un tablet spento della stessa sala, o lo stesso utente in un'altra, si riaccende qui.
    insert into postazioni (nome, sala_id, utente_id)
    values ('Tablet ' || s.nome, s.id, uid)
    on conflict (utente_id) do update set sala_id = excluded.sala_id, nome = excluded.nome, attiva = true;

    insert into account_nuovi values (s.nome, utente, parola);
  end loop;
end $$;

select sala, nome_utente as "nome utente", password from account_nuovi order by sala;
