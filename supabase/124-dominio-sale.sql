-- ---------------------------------------------------------------------------
-- ODS Corsi · gli account dei tablet su un dominio nostro
--
-- L'email di un tablet era `nome@sale.ods-corsi.it`, ma `ods-corsi.it` non è
-- registrato: chi lo comprava poteva ricevere il codice di accesso o il
-- recupero password di un tablet e entrare come lui. Ora è
-- `nome@sale.officinedellosport.it`, sotto il dominio dell'associazione, e
-- `sale.` non ha una casella: la posta lì non arriva a nessuno.
--
-- Cambia solo l'email degli utenti che sono un tablet (`postazioni`); l'utente,
-- la password e le sessioni restano, quindi i tablet già collegati non se ne
-- accorgono. Chi scrive il nome utente sul tablet entra col dominio nuovo
-- (`DOMINIO_SALE` in `src/lib/tablet.ts`). Va lanciato prima di pubblicare
-- l'app, se no un tablet che si ricollega cerca l'indirizzo nuovo e non lo
-- trova. Non chiede di rilanciare `06-iscrizioni.sql`. Si può rilanciare.
-- ---------------------------------------------------------------------------
update auth.users u
   set email = regexp_replace(u.email, '@sale\.ods-corsi\.it$', '@sale.officinedellosport.it', 'i')
 where u.email ~* '@sale\.ods-corsi\.it$'
   and exists (select 1 from postazioni p where p.utente_id = u.id);

-- Supabase tiene l'email anche nell'identità: se no «Cambia password» e il
-- login cercano ancora quella vecchia.
do $$
begin
  if to_regclass('auth.identities') is not null then
    update auth.identities i
       set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(u.email)),
           updated_at = now()
      from auth.users u
     where i.user_id = u.id and i.provider = 'email'
       and exists (select 1 from postazioni p where p.utente_id = u.id)
       and i.identity_data->>'email' is distinct from u.email;
  end if;
end $$;

notify pgrst, 'reload schema';
