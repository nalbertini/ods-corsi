-- Claude passa solo dalla sua porta. Quando una persona collega Claude a ODS Corsi (OAuth Server di Supabase, pagina
-- `collega/`), il token che Claude riceve porta tutti i diritti di quella persona: chi ha anche la segreteria gli
-- darebbe, via PostgREST, la lettura di persone, anagrafiche, certificati, ricevute, anche dei minori. Il server MCP
-- (supabase/functions/mcp) non le chiede mai, ma il token sì. Quei token portano il claim `client_id` (quelli
-- dell'app no): da qui
--   · `controlla_richiesta()`, che PostgREST chiama prima di ogni richiesta (`pgrst.db_pre_request`): col `client_id`
--     passano solo le funzioni del server MCP (`porta_di_claude()`), nessuna tabella; il resto è «Claude non può
--     leggere questa parte di ODS Corsi» (42501). Senza `client_id` ritorna subito: l'app, il sito e chi non ha fatto
--     l'accesso passano come prima. Niente tabelle, e solo funzioni che rispondono con righe senza nome di tabella
--     (`returns table`): su una tabella, o su una riga di tabella, PostgREST fa l'«embedding» (`?select=*,persone(*)`)
--     e la porta vede solo il percorso principale, non quello che la richiesta si porta dietro;
--   · i file dello Storage chiusi a quei token con una policy restrittiva (lo Storage non passa da PostgREST);
--   · le letture che il server faceva sulle tabelle diventano funzioni con le sole colonne che servono: quelle dei
--     conti della sola amministrazione (`chat_movimenti()`, `chat_movimenti_uguali(…)`, `chat_movimento_per_chiave(…)`,
--     `chat_ricevute()`, `chat_pagamenti_diretti()`), e `chat_voci()`, `chat_casse()`, `chat_chiusure()`,
--     `chat_corsi()` con l'RLS delle loro tabelle; e `chat_registra(dati)`, che registra con
--     `registra_movimento_dalla_chat` (72) e risponde con una riga senza nome di tabella.
--
-- Una funzione nuova del server MCP va aggiunta a `porta_di_claude()`, se no Claude riceve 42501; e deve rispondere
-- con `returns table`, mai con una tabella o il tipo di una sua riga (la prova lo controlla).
--
-- Le Edge Function che lavorano con la chiave `service_role` dopo aver letto chi chiama (backup, invita, sito,
-- conti-sito) non passano da PostgREST: rifiutano loro il token con `client_id`.
--
-- Si lancia dopo `75-chat-segreteria.sql` e `72-movimenti-dalla-chat.sql`. Rilanciarlo non perde niente. Da quando
-- c'è, la funzione `mcp` va ripubblicata (legge i conti da queste funzioni); prima di ripubblicarla, Claude legge i
-- voci e casse ma i conti e la registrazione dicono che non può.
-- ---------------------------------------------------------------------------

-- Il token è di un client OAuth (Claude): il claim `client_id` c'è, anche vuoto.
create or replace function da_claude() returns boolean
  language sql stable set search_path = public, extensions as $$
  select coalesce(auth.jwt() ? 'client_id', false)
$$;

-- Le funzioni che il server MCP chiama: le sole che il token di Claude raggiunge.
create or replace function porta_di_claude() returns text[]
  language sql immutable set search_path = public, extensions as $$
  select array[
    'e_amministrazione', 'e_staff',
    'chat_voci', 'chat_casse', 'chat_chiusure', 'movimenti_simili', 'chat_registra',
    'chat_movimenti', 'chat_movimenti_uguali', 'chat_movimento_per_chiave', 'chat_ricevute', 'chat_pagamenti_diretti',
    'chat_corsi', 'chat_iscritti', 'chat_registro', 'chat_prove']
$$;

create or replace function controlla_richiesta() returns void
  language plpgsql stable set search_path = public, extensions as $$
declare
  percorso text := regexp_replace(coalesce(current_setting('request.path', true), ''), '^/+', '');
begin
  if not da_claude() then return; end if;
  if percorso ~ '^rpc/[a-z_]+$' and substr(percorso, 5) = any (porta_di_claude()) then return; end if;
  raise exception 'Claude non può leggere questa parte di ODS Corsi' using errcode = '42501';
end $$;

grant execute on function da_claude(), porta_di_claude(), controlla_richiesta() to anon, authenticated, service_role;

do $$
begin
  alter role authenticator set pgrst.db_pre_request = 'public.controlla_richiesta';
exception when undefined_object then
  -- Un Postgres senza PostgREST: non c'è niente da proteggere davanti.
  null;
end $$;

drop policy if exists claude_fuori on storage.objects;
create policy claude_fuori on storage.objects as restrictive for all to authenticated
  using (not public.da_claude()) with check (not public.da_claude());

-- Le letture senza persone, con l'RLS delle tabelle (invoker): le stesse colonne che il server leggeva.
create or replace function chat_voci() returns table (id uuid, nome text, tipo text, di_sistema boolean, attiva boolean)
  language sql stable set search_path = public, extensions as $$
  select v.id, v.nome, v.tipo, v.di_sistema, v.attiva from voci_contabili v
$$;
create or replace function chat_casse() returns table (id uuid, nome text, saldo_iniziale integer, dal date)
  language sql stable set search_path = public, extensions as $$
  select c.id, c.nome, c.saldo_iniziale, c.dal from casse c order by c.nome
$$;
create or replace function chat_chiusure()
  returns table (id uuid, cassa_id uuid, dal date, data date, previsto integer, contato integer, differenza integer,
                 movimento_id uuid, chiusa_il timestamptz, annullata_il timestamptz)
  language sql stable set search_path = public, extensions as $$
  select c.id, c.cassa_id, c.dal, c.data, c.previsto, c.contato, c.differenza, c.movimento_id, c.chiusa_il, c.annullata_il
    from chiusure_cassa c
$$;
create or replace function chat_corsi() returns table (id uuid, nome text)
  language sql stable set search_path = public, extensions as $$
  select c.id, c.nome from corsi c where c.attivo order by c.nome
$$;

-- `registra_movimento_dalla_chat` risponde con una riga di `movimenti`, su cui PostgREST fa l'embedding: qui la
-- stessa registrazione, con una riga senza nome di tabella.
create or replace function chat_registra(dati jsonb)
  returns table (id uuid, tipo text, data date, importo integer, descrizione text, voce_id uuid, cassa_id uuid)
  language sql volatile set search_path = public, extensions as $$
  select r.id, r.tipo, r.data, r.importo, r.descrizione, r.voce_id, r.cassa_id from registra_movimento_dalla_chat(dati) r
$$;

create or replace function chat_movimenti()
  returns table (id uuid, tipo text, data date, importo integer, voce_id uuid, cassa_id uuid, cassa_a_id uuid, descrizione text,
                 creato_il timestamptz, annullato_il timestamptz, origine_import text, persona_id uuid)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform contabilita_porta();
  return query
    select m.id, m.tipo, m.data, m.importo, m.voce_id, m.cassa_id, m.cassa_a_id, m.descrizione, m.creato_il, m.annullato_il,
           m.origine_import, m.persona_id
      from movimenti m;
end $$;

-- I movimenti che possono essere la stessa fattura: tutti, anche annullati e collegati a una persona (li scarta
-- `doppioneDi`, che dice anche perché).
create or replace function chat_movimenti_uguali(cerca_tipo text, cerca_importo integer, dal date, al date)
  returns table (id uuid, tipo text, data date, importo integer, descrizione text, voce_id uuid, persona_id uuid, annullato_il timestamptz)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform contabilita_porta();
  return query
    select m.id, m.tipo, m.data, m.importo, m.descrizione, m.voce_id, m.persona_id, m.annullato_il
      from movimenti m
     where m.tipo = cerca_tipo and m.importo = cerca_importo
       and m.data between chat_movimenti_uguali.dal and chat_movimenti_uguali.al;
end $$;

-- La registrazione già fatta con questa chiave, da chi chiama e non annullata (vedi 72).
create or replace function chat_movimento_per_chiave(chiave text)
  returns table (id uuid, tipo text, data date, importo integer, descrizione text, voce_id uuid, cassa_id uuid)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform contabilita_porta();
  return query
    select m.id, m.tipo, m.data, m.importo, m.descrizione, m.voce_id, m.cassa_id
      from movimenti m
     where m.chiave_chat = chat_movimento_per_chiave.chiave and m.creato_da = persona_corrente() and m.annullato_il is null;
end $$;

-- Delle ricevute solo le voci coi loro pagamenti: mai intestatario, ente, persona o note.
create or replace function chat_ricevute()
  returns table (id uuid, voci jsonb, annullata_il timestamptz)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform contabilita_porta();
  return query select r.id, r.voci, r.annullata_il from ricevute r;
end $$;

-- Dei pagamenti a mano mai la persona né la nota.
create or replace function chat_pagamenti_diretti()
  returns table (id uuid, data date, importo integer, metodo text, voce text, annullato_il timestamptz)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform contabilita_porta();
  return query select p.id, p.data, p.importo, p.metodo, p.voce, p.annullato_il from pagamenti_diretti p;
end $$;

revoke all on function chat_movimenti(), chat_movimenti_uguali(text, integer, date, date), chat_movimento_per_chiave(text),
  chat_ricevute(), chat_pagamenti_diretti(), chat_voci(), chat_casse(), chat_chiusure(), chat_corsi(), chat_registra(jsonb)
  from public, anon;
grant execute on function chat_movimenti(), chat_movimenti_uguali(text, integer, date, date), chat_movimento_per_chiave(text),
  chat_ricevute(), chat_pagamenti_diretti(), chat_voci(), chat_casse(), chat_chiusure(), chat_corsi(), chat_registra(jsonb)
  to authenticated;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
