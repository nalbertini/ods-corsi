-- «Importa dalla banca» (CONTABILITÀ → MOVIMENTI): i movimenti del conto letti dal CSV di BancoPosta
-- (src/lib/importaBanca.ts) si scrivono con `importa_prima_nota` (63), chiave `banca:aaaammgg:hash:n`,
-- cassa Conto Corrente, voce «Da classificare». Qui c'è solo l'annullo di un'intera importazione.
-- Si lancia dopo 59-contabilita.sql e 63-importa-prima-nota.sql, e si può rilanciare senza danni.
--
-- Un'importazione è una chiamata sola di `importa_prima_nota` (al massimo 1000 righe): le righe scritte
-- hanno tutte lo stesso `creato_il`, e quel momento è il lotto. `annulla_importazione_banca(creato)`
-- annulla i movimenti della banca di quel lotto non ancora annullati, e nient'altro: né quelli a mano,
-- né lo storico del vecchio programma, né un altro lotto. Il confronto è al millisecondo perché il
-- browser non conosce i microsecondi. Un movimento annullato non rientra rilanciando il file: la chiave
-- c'è ancora. Solo l'amministrazione.

create or replace function annulla_importazione_banca(creato timestamptz) returns integer
  language plpgsql security definer set search_path = public, extensions as $$
declare annullati integer;
begin
  perform contabilita_porta();
  -- Come `annulla_movimento`: la chiusura che si sta facendo adesso aspetta, e un giorno chiuso non si annulla.
  perform 1 from casse c where c.nome = 'Conto Corrente' for share;
  -- Un movimento della banca di un'altra cassa (la chiave la sceglie chi importa) resta com'è: lo annulla chi lo vede.
  update movimenti m set annullato_il = now(), annullato_da = persona_corrente()
    where m.origine_import like 'banca:%' and m.annullato_il is null
      and m.cassa_id = (select id from casse where nome = 'Conto Corrente')
      and not cassa_giorno_chiuso(m.cassa_id, m.data)
      and date_trunc('milliseconds', m.creato_il) = date_trunc('milliseconds', creato);
  get diagnostics annullati = row_count;
  return annullati;
end $$;

revoke all on function annulla_importazione_banca(timestamptz) from public, anon;
grant execute on function annulla_importazione_banca(timestamptz) to authenticated;

notify pgrst, 'reload schema';
