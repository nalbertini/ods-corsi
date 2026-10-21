-- ---------------------------------------------------------------------------
-- «Pagato nel vecchio programma»: gli incassi dello storico importato nella stagione di oggi, e di chi sono.
--
-- `incassi_vecchio_programma()` rende (persona_id, data, importo, voce) per ogni entrata dello storico importato
-- (`origine_import like 'prima-nota:%'`, 63-importa-prima-nota.sql) non annullata, sulle voci «Quota associativa»
-- e «Corsi e altri pagamenti», con data dal 1 agosto al 31 luglio della stagione di oggi (a Roma): agosto è già della
-- stagione che inizia, chi paga ad agosto paga quella (`stagioneDi` di src/lib/costi.ts). `persona_id` è
-- la persona a cui il movimento è collegato (70-movimenti-persona.sql), vuoto se non lo è ancora: le righe senza
-- persona ci sono, servono all'app per dire quanti incassi restano da collegare. SOLO LETTURA: non scrive niente,
-- e lo storico non diventa un incasso (saldi, voci e chiusure non cambiano).
-- Se l'importo valga «quota» o resti «da guardare a mano» lo decide l'app (src/lib/pagatoPrima.ts).
--
-- Chi può cosa: la segreteria (ruolo staff). Amministrazione senza segreteria, istruttori, tablet, iscritti e anon
-- no: qui si mostra l'elenco di tutte le persone.
--
-- Le stesse regole di src/lib/pagatoPrima.ts e della modalità prova, provate da
-- supabase/prova/pagato-vecchio-programma.sql e da scripts/prova-pagato-prima.mjs.
--
-- Si lancia dopo `70-movimenti-persona.sql`. Non chiede di rilanciare `06-iscrizioni.sql` e non tocca nessuna
-- funzione degli altri file. Finché non c'è, il filtro «Pagato nel vecchio programma» non compare nell'elenco
-- ISCRITTI e il resto funziona. Su un database dove c'è già, rilanciarlo porta agosto nella stagione che inizia: finché
-- non si rilancia, gli incassi di agosto non entrano in nessuna stagione.
-- ---------------------------------------------------------------------------

create or replace function incassi_vecchio_programma()
  returns table (persona_id uuid, data date, importo integer, voce text)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  inizio date := make_date(
    extract(year from (now() at time zone 'Europe/Rome'))::int
      - case when extract(month from (now() at time zone 'Europe/Rome')) >= 8 then 0 else 1 end, 8, 1);
begin
  if not e_staff() then
    raise exception 'gli incassi del vecchio programma li vede la segreteria' using errcode = '42501';
  end if;
  return query
    select m.persona_id, m.data, m.importo, v.nome
    from movimenti m join voci_contabili v on v.id = m.voce_id
    where m.tipo = 'entrata' and m.annullato_il is null and m.origine_import like 'prima-nota:%'
      and v.nome in ('Quota associativa', 'Corsi e altri pagamenti')
      and m.data between inizio and (inizio + interval '12 months' - interval '1 day')::date
    order by m.data, m.id;
end $$;

revoke all on function incassi_vecchio_programma() from public, anon;
grant execute on function incassi_vecchio_programma() to authenticated;

notify pgrst, 'reload schema';
