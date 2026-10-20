-- La contabilità dalla chat: chi cura i conti fotografa a Claude la fattura o lo scontrino di un fornitore, e il
-- server MCP (supabase/functions/mcp) registra il movimento col token di quella persona, dopo il suo «ok».
--
-- Due colonne su `movimenti`: `chiave_chat`, che Claude manda con ogni registrazione (unica dove c'è: se la risposta si
-- perde e Claude riprova, il movimento resta uno), e `dalla_chat`, il segno DALLA CHAT nel movimento aperto. Due
-- funzioni:
--   · `registra_movimento_dalla_chat(dati)`: le stesse regole di `registra_movimento` (59, rifatta dal 60), che
--     chiama, e in più niente incassi degli iscritti (si registrano in PAGAMENTI). La stessa chiave una seconda
--     volta restituisce il movimento della prima, senza controllare di nuovo;
--   · `movimenti_simili(testo)`: al più cinque movimenti non annullati con quel testo nella descrizione, per
--     proporre la voce dell'ultima volta. Mai quelli collegati a una persona, quelli su una voce di sistema
--     (incassi degli iscritti, differenze di cassa), né chi li ha scritti: escono verso Claude.
--
-- Chi può cosa: solo chi ha il ruolo di amministrazione (`contabilita_porta()`, 59-contabilita.sql), come il resto
-- della contabilità; la tabella resta senza grant di scrittura. Il doppione e il codice fiscale nella descrizione
-- li ferma il server prima di chiamare (src/lib/movimentiDallaChat.ts): sono avvisi per chi registra, non regole.
--
-- Si lancia dopo `60-chiusura-cassa.sql` e `70-movimenti-persona.sql`. Non chiede di rilanciare `06-iscrizioni.sql`
-- e non tocca nessuna funzione di prima: rilanciarle non perde niente. Finché non c'è, la chat può leggere voci e
-- casse ma non registra, e dice di chiedere a chi cura l'app; l'app non cambia.
-- ---------------------------------------------------------------------------

-- `chiave_chat` e non `chiave`: `importa_prima_nota` (63) ha una variabile `chiave`, e in plpgsql si confonderebbero.
alter table movimenti add column if not exists chiave_chat text;
alter table movimenti add column if not exists dalla_chat boolean not null default false;
create unique index if not exists movimenti_chiave_chat on movimenti (chiave_chat) where chiave_chat is not null;

create or replace function registra_movimento_dalla_chat(dati jsonb) returns movimenti
  language plpgsql security definer set search_path = public as $$
declare
  k text := contabilita_testo(dati, 'chiave');
  v voci_contabili;
  r movimenti;
begin
  perform contabilita_porta();
  if k = '' then raise exception 'Manca la chiave della registrazione: riprova dalla chat' using errcode = '22023'; end if;
  select * into r from movimenti m where m.chiave_chat = k;
  if found then return r; end if;
  select * into v from voci_contabili where id = contabilita_id(dati, 'voce_id', 'Scegli la voce');
  if found and v.di_sistema and v.nome <> 'Differenza di cassa' then
    raise exception 'Gli incassi degli iscritti si registrano in PAGAMENTI' using errcode = '22023';
  end if;
  begin
    r := registra_movimento(dati - 'chiave');
    update movimenti m set chiave_chat = k, dalla_chat = true where m.id = r.id returning * into r;
  exception when unique_violation then
    -- La stessa chiave scritta nello stesso momento da un'altra chiamata: vale la sua.
    select * into r from movimenti m where m.chiave_chat = k;
  end;
  return r;
end $$;

create or replace function movimenti_simili(testo text)
  returns table (id uuid, data date, tipo text, importo integer, descrizione text, voce text, voce_id uuid, voce_attiva boolean, cassa text)
  language plpgsql stable security definer set search_path = public as $$
declare
  t text := trim(coalesce(testo, ''));
begin
  perform contabilita_porta();
  if char_length(t) < 2 then return; end if;
  return query
    select m.id, m.data, m.tipo, m.importo, m.descrizione, v.nome, v.id, v.attiva, c.nome
      from movimenti m
      join voci_contabili v on v.id = m.voce_id
      join casse c on c.id = m.cassa_id
     where m.annullato_il is null
       and m.persona_id is null
       and not v.di_sistema
       -- Il testo si cerca com'è scritto: % e _ non sono jolly.
       and strpos(lower(m.descrizione), lower(t)) > 0
     order by m.data desc, m.creato_il desc
     limit 5;
end $$;

revoke all on function registra_movimento_dalla_chat(jsonb), movimenti_simili(text) from public, anon;
grant execute on function registra_movimento_dalla_chat(jsonb), movimenti_simili(text) to authenticated;

notify pgrst, 'reload schema';
