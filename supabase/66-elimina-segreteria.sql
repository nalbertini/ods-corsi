-- Si elimina anche chi è solo di segreteria.
--
-- Finora `elimina_istruttore()` (28, 55) diceva di no a chi non insegna: a lui
-- si toglieva l'accesso e la scheda restava per sempre. Ora si elimina anche
-- lui, ma solo se non ha storia: nessuna riga dei registri (ricevute,
-- pagamenti, cassa, tessere, sito, segnalazioni…) lo nomina come autore.
-- Quei riferimenti sono `on delete set null`: eliminarlo farebbe sparire
-- «chi l'ha fatto». Si guardano tutti insieme dal catalogo, così una tabella
-- nuova con il suo `…_da` è coperta senza toccare questo file. Chi ha storia
-- si lascia com'è: TOGLI L'ACCESSO.
--
-- Chi è solo di amministrazione, e un iscritto, restano fuori: a loro si toglie
-- l'accesso, come prima. Il resto è come prima (non si elimina se stessi, né
-- chi è anche allievo, né l'account di un tablet).
--
-- La funzione ora è `security definer`: il controllo dei registri deve vedere
-- tutte le righe, non solo quelle che la policy di chi chiama lascia leggere.
-- Il permesso si controlla per primo, con `e_staff()`.
--
-- Si lancia dopo `55-amministrazione.sql`, e si può rilanciare senza danni. Non
-- chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, il tasto ELIMINA
-- c'è già ma il database dice che si eliminano solo gli istruttori.

create or replace function elimina_istruttore(persona uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p persone;
  allievo boolean := false;
  r record;
  usata boolean;
begin
  if not e_staff() then
    raise exception 'Non hai il permesso: serve un accesso da segreteria' using errcode = '42501';
  end if;
  select * into p from persone where id = persona;
  if not found then
    raise exception 'Questa persona non c''è più';
  end if;
  if p.id = persona_corrente() then
    raise exception 'Non ci si elimina da soli: lo fa un''altra persona di segreteria';
  end if;
  if not (p.ruolo::text in ('istruttore', 'staff') or (p.ruolo::text = 'amministrazione' and p.anche_istruttore)) then
    raise exception 'Si eliminano solo gli istruttori e la segreteria: a % si toglie l''accesso', p.nome;
  end if;
  -- Qui e non nel trigger: un iscritto la segreteria lo cancella come prima.
  if exists (select 1 from iscrizioni where persona_id = persona)
     or exists (select 1 from presenze where persona_id = persona) then
    allievo := true;
  elsif to_regclass('public.ricevute') is not null then
    -- Le ricevute ci sono solo con 16-ricevute.sql.
    execute 'select exists (select 1 from ricevute where persona_id = $1)' into allievo using persona;
  end if;
  if allievo then
    raise exception '% è anche allievo: non si elimina, gli si toglie l''accesso', btrim(p.nome || ' ' || p.cognome);
  end if;
  if p.utente_id is not null and exists (select 1 from postazioni where utente_id = p.utente_id) then
    raise exception 'L''account di % è quello di un tablet: non si toglie da qui', p.nome;
  end if;
  -- Chi ha firmato qualcosa nei registri, o ha un pagamento a suo nome
  -- (`restrict`: senza questo dice il testo grezzo di Postgres), non sparisce da lì. Solo vincoli a una
  -- colonna: oggi sono tutti così; uno composto andrebbe aggiunto qui.
  for r in
    select c.conrelid::regclass as tabella, a.attname as colonna
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'public.persone'::regclass
       and c.confdeltype in ('n', 'r') and cardinality(c.conkey) = 1
       -- Corsi e lezioni le guarda il trigger, con un messaggio suo.
       and c.conrelid not in ('public.persone'::regclass, 'public.corsi'::regclass, 'public.sessioni'::regclass)
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tabella, r.colonna) into usata using persona;
    if usata then
      raise exception '% ha già lavorato nei registri: non si elimina, gli si toglie l''accesso',
        btrim(p.nome || ' ' || p.cognome);
    end if;
  end loop;
  -- Il trigger `persone_non_si_elimina` dice di no a chi ha insegnato.
  delete from persone where id = persona;
  return p.utente_id;
end $$;

revoke all on function elimina_istruttore(uuid) from public, anon;
grant execute on function elimina_istruttore(uuid) to authenticated;

notify pgrst, 'reload schema';
