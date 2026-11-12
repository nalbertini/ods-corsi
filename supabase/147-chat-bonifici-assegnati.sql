-- ---------------------------------------------------------------------------
-- 147 · Nei conti della chat un bonifico assegnato conta una volta sola
--
-- Un bonifico assegnato a un iscritto (135) è un movimento di banca, e il
-- pagamento a mano o la ricevuta che ne nascono lo puntano (`movimento_id`).
-- BILANCIO lo sa e quei soldi li conta una volta, nel movimento
-- (`incassiDerivati`, src/lib/contabilita.ts). La chat (server MCP, strumenti
-- `conti` e `saldi_casse`) legge gli incassi da `chat_ricevute()` e
-- `chat_pagamenti_diretti()` (77), che il movimento non lo davano: li contava
-- due volte. Da qui le due funzioni rendono anche `movimento_id`, e la chat
-- applica la stessa regola dell'app (`incassiDaRighe`).
--
-- Chi può cosa: come nel 77. Solo l'amministrazione (`contabilita_porta()`),
-- e delle righe solo le colonne dei conti: `movimento_id` è l'id di un
-- movimento che la chat legge già da `chat_movimenti()`; mai persona,
-- intestatario, ente o note.
--
-- Si lancia dopo `77-claude-dalla-porta.sql` e `135-assegna-movimento.sql`.
-- Rifà `chat_ricevute` e `chat_pagamenti_diretti` del 77, togliendole prima
-- (il tipo che rendono cambia): chi rilancia il 77 toglie prima queste due
-- (`drop function chat_ricevute(), chat_pagamenti_diretti();`) e rilancia poi
-- questo (`controllo.sql` lo dice). Non chiede di rilanciare
-- `06-iscrizioni.sql`. Poi va ripubblicata la Edge Function `mcp`. Finché non
-- c'è, la chat conta i bonifici assegnati due volte, come prima; finché la
-- funzione `mcp` non è ripubblicata, la colonna in più non la legge nessuno.
-- ---------------------------------------------------------------------------

drop function if exists chat_ricevute();
create function chat_ricevute()
  returns table (id uuid, voci jsonb, annullata_il timestamptz, movimento_id uuid)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform contabilita_porta();
  return query select r.id, r.voci, r.annullata_il, r.movimento_id from ricevute r;
end $$;

drop function if exists chat_pagamenti_diretti();
create function chat_pagamenti_diretti()
  returns table (id uuid, data date, importo integer, metodo text, voce text, annullato_il timestamptz, movimento_id uuid)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform contabilita_porta();
  return query select p.id, p.data, p.importo, p.metodo, p.voce, p.annullato_il, p.movimento_id from pagamenti_diretti p;
end $$;

revoke all on function chat_ricevute(), chat_pagamenti_diretti() from public, anon;
grant execute on function chat_ricevute(), chat_pagamenti_diretti() to authenticated;

notify pgrst, 'reload schema';
