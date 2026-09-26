-- ---------------------------------------------------------------------------
-- Quali file sono stati lanciati su questo database.
--
-- Supabase non tiene il conto di quali file sono stati lanciati: ci sono solo
-- le tabelle e le funzioni che hanno creato. Qui, per ogni file, si cerca
-- qualcosa che fa solo quel file, e anche le cose aggiunte dopo, perché un
-- file lanciato mesi fa può essere una versione vecchia. Si incolla nel SQL
-- Editor: legge soltanto, non cambia niente.
--
-- Una riga DA LANCIARE vuol dire: si rilancia quel file, e poi quelli che
-- vengono dopo di lui fino a `06-iscrizioni.sql` compreso, che rimette i
-- permessi giusti alle funzioni. Rilanciare non distrugge niente.
--
-- Va tenuto al passo: chi cambia uno dei file numerati aggiunge qui una riga
-- per quello che ha aggiunto.
-- ---------------------------------------------------------------------------

-- `dentro` sono le funzioni con il loro corpo: una versione vecchia di un
-- file lascia la funzione, ma con dentro quello che faceva prima.
with dentro(nome, corpo) as (
  select p.proname::text, p.prosrc from pg_proc p where p.pronamespace = 'public'::regnamespace
)
select file, cosa, case when c then 'ok' else 'DA LANCIARE' end as stato from (values
  ('01-schema.sql', 'le tabelle',
    to_regclass('public.ricorrenze') is not null),
  ('01-schema.sql', 'la sala dei singoli giorni',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ricorrenze' and column_name = 'sala_id')),
  ('02-policy.sql', 'le policy',
    exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'sessioni_legge')),
  ('03-funzioni.sql', 'il calendario',
    exists (select 1 from dentro where nome = 'materializza_sessioni')),
  ('03-funzioni.sql', 'il calendario con la sala del giorno',
    exists (select 1 from dentro where nome = 'materializza_sessioni' and corpo like '%coalesce(r.sala_id, c.sala_id)%')),
  ('04-tablet.sql', 'il tablet di sala',
    exists (select 1 from dentro where nome = 'lezioni_sala')),
  ('04-tablet.sql', 'il tablet con la sala del giorno',
    exists (select 1 from dentro where nome = 'lezioni_sala' and corpo like '%r.sala_id%')),
  ('05-segreteria.sql', 'la segreteria',
    exists (select 1 from dentro where nome = 'corso_cambiato')),
  ('05-segreteria.sql', 'la sala dei giorni che si sposta',
    exists (select 1 from pg_trigger where tgname = 'ricorrenze_cambiate' and not tgisinternal)),
  ('06-iscrizioni.sql', 'il modulo di iscrizione',
    exists (select 1 from dentro where nome = 'corsi_aperti')),
  ('06-iscrizioni.sql', 'il codice fiscale controllato',
    exists (select 1 from dentro where nome = 'cf_controllo')),
  -- Chi non ha un accesso chiama solo le funzioni del modulo. Se ce n'è
  -- un'altra, è stato rilanciato uno dei primi cinque file senza il 06 dopo.
  -- Non contano le funzioni dei trigger, che non si possono chiamare da
  -- fuori, e quelle delle estensioni: su Supabase `citext` sta in `public`,
  -- è di `supabase_admin` e il SQL Editor non può toglierle i permessi, ma
  -- sono le funzioni del tipo delle email e non toccano nessuna tabella.
  ('06-iscrizioni.sql', 'i permessi, dopo gli altri file',
    not exists (
      select 1 from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.prorettype <> 'trigger'::regtype
        and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege('anon', p.oid, 'execute')
        and p.proname not in ('corsi_aperti', 'invia_iscrizione', 'puo_caricare', 'iscrizioni_regole'))),
  ('07-certificati-pagamenti.sql', 'certificati e pagamenti',
    to_regclass('public.schede_iscritti') is not null)
) as x(file, cosa, c)
order by file, cosa;
