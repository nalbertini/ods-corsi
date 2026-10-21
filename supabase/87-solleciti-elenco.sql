-- ---------------------------------------------------------------------------
-- ODS Corsi · i solleciti su WhatsApp nell'elenco ISCRITTI
--
-- Con un filtro del sollecito acceso (senza certificato, da pagare, non in
-- regola…) l'elenco ha il tasto WhatsApp su ogni riga, e ogni riga dice
-- l'ultimo sollecito: si legge in un colpo, non una persona alla volta.
-- Dopo il tasto, «Annulla» toglie il segno se il messaggio non è partito.
--
--   · `ultimi_solleciti()`: per ogni persona sollecitata l'ultimo sollecito,
--     col nome e cognome di chi l'ha segnato (vuoto se quella scheda non c'è
--     più). Solo la segreteria (`e_staff()`).
--   · `togli_sollecito(persona)`: solo la segreteria. Toglie l'ultimo
--     sollecito di quella persona solo se l'ha segnato chi è collegato
--     (`persona_corrente()`) negli ultimi 15 minuti: è un tasto premuto per
--     sbaglio, non un modo di riscrivere la storia. Rende vero se l'ha tolto.
-- La tabella `solleciti` resta chiusa a tutti (85-solleciti.sql).
--
-- Le stesse regole della modalità prova (src/lib/segreteriaProva.ts), provate
-- da supabase/prova/solleciti.sql e da scripts/prova-sollecito.mjs.
--
-- Si lancia dopo `85-solleciti.sql` (e dopo `86-ricevuta-una-volta.sql`, che non tocca). Non chiede di rilanciare
-- `06-iscrizioni.sql` e non tocca nessuna funzione di prima. Finché non c'è,
-- il tasto nell'elenco c'è lo stesso, senza la riga «Sollecitato il …», e
-- «Annulla» dice di lanciare questo file.
-- ---------------------------------------------------------------------------

create or replace function ultimi_solleciti() returns table (persona_id uuid, creato_il timestamptz, da text)
  language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not e_staff() then raise exception 'i solleciti li vede la segreteria' using errcode = '42501'; end if;
  return query
    select distinct on (s.persona_id) s.persona_id, s.creato_il, coalesce(trim(p.nome || ' ' || p.cognome), '')
      from solleciti s left join persone p on p.id = s.creato_da
     order by s.persona_id, s.creato_il desc, s.id desc;
end $$;

create or replace function togli_sollecito(persona uuid) returns boolean
  language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  ultimo solleciti;
begin
  if not e_staff() then raise exception 'i solleciti li toglie la segreteria' using errcode = '42501'; end if;
  select * into ultimo from solleciti where persona_id = togli_sollecito.persona order by creato_il desc, id desc limit 1;
  if not found or ultimo.creato_da is distinct from persona_corrente() or ultimo.creato_il < now() - interval '15 minutes' then
    return false;
  end if;
  delete from solleciti where id = ultimo.id;
  return true;
end $$;

revoke all on function ultimi_solleciti() from public, anon;
revoke all on function togli_sollecito(uuid) from public, anon;
grant execute on function ultimi_solleciti() to authenticated;
grant execute on function togli_sollecito(uuid) to authenticated;

notify pgrst, 'reload schema';
