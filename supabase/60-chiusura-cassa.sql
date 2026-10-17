-- La contabilità, seconda parte: la chiusura di cassa.
-- Si lancia dopo 59-contabilita.sql, e si può rilanciare senza danni.
--
-- A fine settimana l'amministrazione conta i contanti e li confronta con quel che
-- c'è «secondo i conti» nella Cassa Contanti. Se non tornano, la differenza si
-- scrive da sola come movimento «Differenza di cassa», e da lì in poi quei giorni
-- sono chiusi: non si scrive né si annulla più nessun movimento a mano con una data
-- fino a quel giorno (si fa una rettifica di oggi, o si annulla la chiusura). Si annulla solo
-- l'ultima chiusura, col suo movimento. Le stesse regole di src/lib/contabilita.ts
-- e della modalità prova, provate da supabase/prova/chiusura-cassa.sql.
--
-- Il 59 non si tocca: le sue funzioni che ora sanno dei giorni chiusi sono
-- ridefinite qui sotto con `create or replace`. Rilanciare il 59 dopo il 60 rimette le
-- versioni vecchie: va rilanciato anche il 60 (controllo.sql lo dice).
-- Le ricevute e i pagamenti a mano in contanti non seguono i giorni chiusi (sono documenti):
-- se ne cambia uno di quei giorni, l'app avvisa che la chiusura non è più in regola.

create table if not exists chiusure_cassa (
  id          uuid primary key default gen_random_uuid(),
  cassa_id    uuid not null references casse,
  -- Il periodo chiuso: dal giorno dopo l'ultima chiusura (o dall'inizio della cassa) fino a `data`.
  dal         date not null,
  data        date not null,
  -- In centesimi. Il previsto si salva: il foglio PDF si ristampa sempre uguale.
  previsto    integer not null,
  contato     integer not null check (contato >= 0),
  differenza  integer not null,
  nota        text check (char_length(nota) <= 300),
  -- Il movimento «Differenza di cassa»; vuoto se i conti tornavano.
  movimento_id uuid references movimenti,
  chiusa_da   uuid references persone on delete set null,
  chiusa_il   timestamptz not null default now(),
  annullata_il timestamptz,
  annullata_da uuid references persone on delete set null
);
-- Una sola chiusura attiva per cassa e giorno.
create unique index if not exists chiusure_cassa_giorno on chiusure_cassa (cassa_id, data) where annullata_il is null;

-- Se qualcuno l'aveva già scritta a mano, diventa quella di sistema (il rilancio la rimette a posto).
update voci_contabili set di_sistema = true, attiva = true where nome = 'Differenza di cassa';
insert into voci_contabili (nome, tipo, di_sistema) values
  ('Differenza di cassa', 'entrata', true),
  ('Differenza di cassa', 'uscita', true)
on conflict do nothing;

alter table chiusure_cassa enable row level security;
revoke all on chiusure_cassa from anon, authenticated;
grant select on chiusure_cassa to authenticated;
drop policy if exists chiusure_cassa_legge on chiusure_cassa;
create policy chiusure_cassa_legge on chiusure_cassa for select to authenticated using (e_amministrazione());

-- Quel giorno è chiuso? (Interna: la chiamano le funzioni qui sotto.)
create or replace function cassa_giorno_chiuso(cassa uuid, giorno date) returns boolean
  language sql stable set search_path = public as $$
  select exists (select 1 from chiusure_cassa h where h.cassa_id = cassa and h.annullata_il is null and h.data >= giorno)
$$;

-- Quanto c'è in Cassa Contanti «secondo i conti» fino a un giorno compreso: saldo iniziale, movimenti
-- non annullati (le differenze delle chiusure di prima comprese: a fine giorno in cassa c'è il contato)
-- e i contanti incassati dagli iscritti (ricevute e pagamenti a mano non annullati). Dal giorno di
-- partenza della cassa. Esclusi POS e altri metodi, l'anticipo e «pagato fino al».
-- La stessa regola è `previstoCassa` in src/lib/contabilita.ts: le prove le confrontano su un dataset.
create or replace function previsto_cassa(cassa uuid, giorno date) returns bigint
  language sql stable security definer set search_path = public as $$
  with c as (select id, nome, saldo_iniziale, dal from casse where id = cassa)
  select (select saldo_iniziale from c)::bigint
    + coalesce((select sum(case
        when m.tipo = 'giroconto' then case when m.cassa_id = cassa then -m.importo else m.importo end
        when m.tipo = 'entrata' then m.importo
        else -m.importo end)
      from movimenti m, c
      where m.annullato_il is null and cassa in (m.cassa_id, m.cassa_a_id) and m.data <= giorno
        and (c.dal is null or m.data >= c.dal)), 0)
    + case when (select nome from c) = 'Cassa Contanti' then
        coalesce((select sum((p->>'importo')::bigint)
          from ricevute r, c, jsonb_array_elements(r.voci) v, jsonb_array_elements(coalesce(v->'pagamenti', '[]'::jsonb)) p
          where r.annullata_il is null and lower(btrim(p->>'metodo')) = 'contanti'
            and coalesce((p->>'data')::date, r.data) <= giorno and (c.dal is null or coalesce((p->>'data')::date, r.data) >= c.dal)), 0)
        + coalesce((select sum(d.importo)::bigint from pagamenti_diretti d, c
          where d.annullato_il is null and lower(btrim(d.metodo)) = 'contanti'
            and d.data <= giorno and (c.dal is null or d.data >= c.dal)), 0)
      else 0 end
$$;

create or replace function chiudi_cassa(dati jsonb) returns chiusure_cassa
  language plpgsql security definer set search_path = public as $$
declare
  ca casse;
  ultima date;
  giorno date;
  cont integer;
  nt text;
  prev bigint;
  dif bigint;
  mid uuid;
  r chiusure_cassa;
begin
  perform contabilita_porta();
  -- for update: due che chiudono insieme (telefono e computer) fanno la fila, e la seconda trova la prima.
  select * into ca from casse where id = contabilita_id(dati, 'cassa_id', 'Scegli la cassa') for update;
  if not found then raise exception 'Scegli la cassa' using errcode = '22023'; end if;
  if ca.nome <> 'Cassa Contanti' then raise exception 'Si chiude solo la Cassa Contanti' using errcode = '22023'; end if;
  -- senza giorno di partenza il previsto conterebbe tutti i contanti di sempre, mai contati: prima si imposta la cassa
  if ca.dal is null then raise exception 'Imposta prima il saldo iniziale e il giorno di partenza della Cassa Contanti' using errcode = '22023'; end if;
  begin giorno := (dati->>'data')::date; exception when others then
    raise exception 'La data non si capisce' using errcode = '22023';
  end;
  if giorno is null or giorno < date '2000-01-01' then raise exception 'La data non si capisce' using errcode = '22023'; end if;
  if giorno > contabilita_oggi() then raise exception 'La data è nel futuro: si chiude quel che è già successo' using errcode = '22023'; end if;
  select max(h.data) into ultima from chiusure_cassa h where h.cassa_id = ca.id and h.annullata_il is null;
  if ultima is not null and giorno <= ultima then
    raise exception 'Quel giorno è già chiuso: scegli un giorno dopo il %', to_char(ultima, 'DD/MM/YYYY') using errcode = '22023';
  end if;
  if ca.dal is not null and giorno < ca.dal then raise exception 'La data è prima dell’inizio della cassa' using errcode = '22023'; end if;
  begin cont := (dati->>'contato')::integer; exception when others then
    raise exception 'I contanti contati non si capiscono' using errcode = '22023';
  end;
  if cont is null then raise exception 'I contanti contati non si capiscono' using errcode = '22023'; end if;
  if cont < 0 then raise exception 'I contanti contati non possono essere negativi' using errcode = '22023'; end if;
  if cont > 100000000 then raise exception 'I contanti contati sono troppi: controlla le cifre' using errcode = '22023'; end if;
  if coalesce(jsonb_typeof(dati->'nota'), 'string') not in ('string', 'null') then raise exception 'La nota non si capisce' using errcode = '22023'; end if;
  nt := nullif(trim(coalesce(dati->>'nota', '')), '');
  if char_length(coalesce(nt, '')) > 300 then raise exception 'La nota è troppo lunga: al massimo 300 caratteri' using errcode = '22023'; end if;

  prev := previsto_cassa(ca.id, giorno);
  dif := cont - prev;
  -- ricevute da cifre assurde: il rifiuto è per chi usa l'app, non un «integer out of range»
  if abs(dif) > 100000000 or abs(prev) > 1000000000 then
    raise exception 'Il previsto della Cassa Contanti non torna: controlla le ricevute in contanti' using errcode = '22023';
  end if;
  if dif <> 0 then
    insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, nota, creato_da)
    values (case when dif > 0 then 'entrata' else 'uscita' end, giorno, abs(dif),
      (select v.id from voci_contabili v where v.nome = 'Differenza di cassa' and v.di_sistema and v.tipo = case when dif > 0 then 'entrata' else 'uscita' end),
      ca.id, 'Differenza di cassa', nt, persona_corrente())
    returning id into mid;
  end if;
  insert into chiusure_cassa (cassa_id, dal, data, previsto, contato, differenza, nota, movimento_id, chiusa_da)
  values (ca.id, coalesce(ultima + 1, ca.dal, date '2000-01-01'), giorno, prev, cont, dif, nt, mid, persona_corrente())
  returning * into r;
  return r;
end $$;

create or replace function annulla_chiusura_cassa(id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare h chiusure_cassa;
begin
  perform contabilita_porta();
  select * into h from chiusure_cassa x where x.id = annulla_chiusura_cassa.id;
  if not found then raise exception 'La chiusura non c’è' using errcode = 'P0002'; end if;
  -- la riga della cassa in fila con chi chiude nello stesso momento, poi si rilegge la chiusura
  perform 1 from casse c where c.id = h.cassa_id for update;
  select * into h from chiusure_cassa x where x.id = annulla_chiusura_cassa.id for update;
  if h.annullata_il is not null then raise exception 'La chiusura è già annullata' using errcode = 'P0002'; end if;
  if exists (select 1 from chiusure_cassa x where x.cassa_id = h.cassa_id and x.annullata_il is null and x.data > h.data) then
    raise exception 'Si annulla solo l’ultima chiusura della cassa' using errcode = '22023';
  end if;
  update chiusure_cassa x set annullata_il = now(), annullata_da = persona_corrente() where x.id = h.id;
  if h.movimento_id is not null then
    update movimenti m set annullato_il = now(), annullato_da = persona_corrente() where m.id = h.movimento_id and m.annullato_il is null;
  end if;
end $$;

-- Le funzioni del 59 che ora sanno dei giorni chiusi ----------------------------
create or replace function registra_movimento(dati jsonb) returns movimenti
  language plpgsql security definer set search_path = public as $$
declare
  c record;
  v voci_contabili;
  ca casse;
  r movimenti;
  t text := dati->>'tipo';
  d text := contabilita_testo(dati, 'descrizione');
begin
  perform contabilita_porta();
  if t is null or t not in ('entrata', 'uscita') then raise exception 'Scegli se è un’entrata o un’uscita' using errcode = '22023'; end if;
  select * into c from movimento_comune(dati);
  select * into v from voci_contabili where id = contabilita_id(dati, 'voce_id', 'Scegli la voce');
  if not found then raise exception 'Scegli la voce' using errcode = '22023'; end if;
  if v.tipo <> t then raise exception 'La voce scelta non va con questo tipo di movimento' using errcode = '22023'; end if;
  if not v.attiva then raise exception 'La voce non è più in uso: scegline un’altra' using errcode = '22023'; end if;
  if v.di_sistema and v.nome = 'Differenza di cassa' then raise exception 'La «Differenza di cassa» si scrive da sola chiudendo la cassa' using errcode = '22023'; end if;
  select * into ca from casse where id = contabilita_id(dati, 'cassa_id', 'Scegli la cassa') for share;
  if not found then raise exception 'Scegli la cassa' using errcode = '22023'; end if;
  if ca.dal is not null and c.giorno < ca.dal then raise exception 'La data è prima dell’inizio della cassa' using errcode = '22023'; end if;
  if cassa_giorno_chiuso(ca.id, c.giorno) then raise exception 'Quel giorno è già chiuso: scrivi il movimento con la data di oggi e una voce di rettifica (si crea in VOCI)' using errcode = '22023'; end if;
  if d = '' then raise exception 'Scrivi una descrizione' using errcode = '22023'; end if;
  if char_length(d) > 200 then raise exception 'La descrizione è troppo lunga: al massimo 200 caratteri' using errcode = '22023'; end if;
  insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, nota, creato_da)
  values (t, c.giorno, c.importo, v.id, ca.id, d, c.nota, persona_corrente())
  returning * into r;
  return r;
end $$;

create or replace function registra_giroconto(dati jsonb) returns movimenti
  language plpgsql security definer set search_path = public as $$
declare
  c record;
  da casse;
  a casse;
  r movimenti;
begin
  perform contabilita_porta();
  select * into da from casse where id = contabilita_id(dati, 'da', 'Scegli le due casse') for share;
  select * into a from casse where id = contabilita_id(dati, 'a', 'Scegli le due casse') for share;
  if da.id is null or a.id is null then raise exception 'Scegli le due casse' using errcode = '22023'; end if;
  if da.id = a.id then raise exception 'Scegli due casse diverse' using errcode = '22023'; end if;
  select * into c from movimento_comune(dati);
  if (da.dal is not null and c.giorno < da.dal) or (a.dal is not null and c.giorno < a.dal) then
    raise exception 'La data è prima dell’inizio della cassa' using errcode = '22023';
  end if;
  if cassa_giorno_chiuso(da.id, c.giorno) or cassa_giorno_chiuso(a.id, c.giorno) then
    raise exception 'Quel giorno è già chiuso: scrivi il movimento con la data di oggi e una voce di rettifica (si crea in VOCI)' using errcode = '22023';
  end if;
  insert into movimenti (tipo, data, importo, cassa_id, cassa_a_id, descrizione, nota, creato_da)
  values ('giroconto', c.giorno, c.importo, da.id, a.id, 'Giroconto da ' || da.nome || ' a ' || a.nome, c.nota, persona_corrente())
  returning * into r;
  return r;
end $$;

create or replace function annulla_movimento(id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare m movimenti;
begin
  perform contabilita_porta();
  select * into m from movimenti x where x.id = annulla_movimento.id;
  if not found then raise exception 'Il movimento non c’è' using errcode = 'P0002'; end if;
  -- le casse in fila con chi chiude nello stesso momento (come `registra_movimento`), poi si rilegge il movimento
  perform 1 from casse c where c.id in (m.cassa_id, m.cassa_a_id) order by c.id for share;
  select * into m from movimenti x where x.id = annulla_movimento.id for update;
  if m.annullato_il is not null then raise exception 'Il movimento è già annullato' using errcode = 'P0002'; end if;
  if cassa_giorno_chiuso(m.cassa_id, m.data) or (m.cassa_a_id is not null and cassa_giorno_chiuso(m.cassa_a_id, m.data)) then
    raise exception 'Quel giorno è già chiuso: annulla prima la chiusura, o scrivi una rettifica di oggi' using errcode = '22023';
  end if;
  update movimenti x set annullato_il = now(), annullato_da = persona_corrente() where x.id = m.id;
end $$;

create or replace function imposta_saldo_cassa(id uuid, saldo integer, dal date) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform contabilita_porta();
  -- for update: chi registra un movimento sulla cassa nello stesso momento aspetta e vede la data nuova
  perform 1 from casse c where c.id = imposta_saldo_cassa.id for update;
  if not found then raise exception 'La cassa non c’è' using errcode = 'P0002'; end if;
  if exists (select 1 from chiusure_cassa h where h.cassa_id = imposta_saldo_cassa.id and h.annullata_il is null) then
    raise exception 'La cassa ha una chiusura: annullala prima di cambiare il saldo iniziale' using errcode = '22023';
  end if;
  if saldo is null or saldo < 0 then raise exception 'Il saldo iniziale non può essere negativo' using errcode = '22023'; end if;
  if saldo > 100000000 then raise exception 'Il saldo iniziale è troppo alto: controlla le cifre' using errcode = '22023'; end if;
  if dal is not null and dal < date '2000-01-01' then raise exception 'La data non si capisce' using errcode = '22023'; end if;
  if dal is not null and dal > contabilita_oggi() then raise exception 'L’inizio della cassa non può essere nel futuro' using errcode = '22023'; end if;
  -- i movimenti prima di quella data il saldo li ignorerebbe in silenzio
  if dal is not null and exists (select 1 from movimenti m where (m.cassa_id = imposta_saldo_cassa.id or m.cassa_a_id = imposta_saldo_cassa.id)
      and m.annullato_il is null and m.data < dal) then
    raise exception 'Ci sono movimenti prima di quella data: annullali o scegli una data più vecchia' using errcode = '22023';
  end if;
  update casse c set saldo_iniziale = saldo, dal = imposta_saldo_cassa.dal where c.id = imposta_saldo_cassa.id;
end $$;

-- Chi può chiamare cosa: le funzioni interne nessuno da fuori, le due nuove solo chi ha fatto l'accesso
-- (poi la porta dice se è amministrazione). Le ridefinizioni tengono i permessi del 59.
revoke all on function cassa_giorno_chiuso(uuid, date), previsto_cassa(uuid, date) from public, anon, authenticated;
revoke all on function chiudi_cassa(jsonb), annulla_chiusura_cassa(uuid) from public, anon;
grant execute on function chiudi_cassa(jsonb), annulla_chiusura_cassa(uuid) to authenticated;

notify pgrst, 'reload schema';
