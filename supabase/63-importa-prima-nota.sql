-- L'import dello storico dei movimenti: `importa_prima_nota` carica a pacchetti i movimenti letti dal
-- vecchio programma (src/lib/importaPrimaNota.ts, scripts/importa-prima-nota.mjs). Si lancia dopo
-- 59-contabilita.sql e 60-chiusura-cassa.sql, e si può rilanciare senza danni.
--
-- Solo l'amministrazione la chiama. Ogni riga porta una chiave (`origine_import`): rilanciare lo
-- stesso file non duplica niente (la chiave è la posizione della riga nel file: un export diverso la
-- sposta, e non si rilancia sopra un import fatto). Un pacchetto o entra tutto o niente, e un giorno già chiuso della
-- Cassa Contanti non si tocca. Le righe sono movimenti come gli altri (si annullano, si leggono)
-- ma senza `creato_da`: è storia, non l'ha scritta nessuno qui. Le voci sono le due di sistema degli
-- incassi e «Da classificare», che l'amministrazione sistema poi a mano.

alter table movimenti add column if not exists origine_import text;
-- La chiave è unica solo dove c'è: i movimenti scritti a mano non ce l'hanno.
create unique index if not exists movimenti_origine_import on movimenti (origine_import) where origine_import is not null;

create or replace function importa_prima_nota(dati jsonb) returns integer
  language plpgsql security definer set search_path = public as $$
declare
  riga jsonb;
  n integer := 0;
  fatte integer := 0;
  dentro integer;
  giorno date;
  importo numeric;
  cassa casse;
  voce voci_contabili;
  tipo_riga text;
  nome_voce text;
  descr text;
  chiave text;
begin
  perform contabilita_porta();
  if jsonb_typeof(dati) is distinct from 'array' then raise exception 'I dati dell’import non sono una lista' using errcode = '22023'; end if;
  if jsonb_array_length(dati) > 1000 then raise exception 'Troppe righe in una volta: al massimo 1000' using errcode = '22023'; end if;
  -- La voce da sistemare c'è sempre, di entrata e di uscita, non di sistema.
  insert into voci_contabili (nome, tipo) values ('Da classificare', 'entrata'), ('Da classificare', 'uscita') on conflict do nothing;

  for riga in select * from jsonb_array_elements(dati) loop
    n := n + 1;
    if jsonb_typeof(riga) is distinct from 'object' then raise exception 'La riga % non si capisce', n using errcode = '22023'; end if;
    chiave := case when jsonb_typeof(riga->'chiave') = 'string' then trim(riga->>'chiave') else '' end;
    if chiave = '' or char_length(chiave) > 100 then raise exception 'La riga % non ha la chiave', n using errcode = '22023'; end if;
    begin giorno := (riga->>'data')::date; exception when others then
      raise exception 'La riga %: la data non si capisce', n using errcode = '22023';
    end;
    if giorno is null or giorno < date '2000-01-01' then raise exception 'La riga %: la data non si capisce', n using errcode = '22023'; end if;
    if giorno > contabilita_oggi() then raise exception 'La riga %: la data è nel futuro', n using errcode = '22023'; end if;
    select * into cassa from casse c where c.nome = case riga->>'cassa' when 'contanti' then 'Cassa Contanti' when 'conto' then 'Conto Corrente' end;
    if not found then raise exception 'La riga %: la cassa non è quella dei contanti né quella del conto', n using errcode = '22023'; end if;
    tipo_riga := riga->>'tipo';
    if tipo_riga is null or tipo_riga not in ('entrata', 'uscita') then raise exception 'La riga %: scegli se è un’entrata o un’uscita', n using errcode = '22023'; end if;
    if jsonb_typeof(riga->'importo') is distinct from 'number' then raise exception 'La riga %: l’importo non si capisce', n using errcode = '22023'; end if;
    importo := (riga->>'importo')::numeric;
    if importo <> trunc(importo) then raise exception 'La riga %: l’importo non si capisce', n using errcode = '22023'; end if;
    if importo <= 0 then raise exception 'La riga %: l’importo deve essere più di zero', n using errcode = '22023'; end if;
    if importo > 10000000 then raise exception 'La riga %: l’importo è troppo alto', n using errcode = '22023'; end if;
    descr := case when jsonb_typeof(riga->'descrizione') = 'string' then trim(riga->>'descrizione') else '' end;
    if descr = '' then raise exception 'La riga %: scrivi una descrizione', n using errcode = '22023'; end if;
    if char_length(descr) > 200 then raise exception 'La riga %: la descrizione è troppo lunga', n using errcode = '22023'; end if;
    nome_voce := riga->>'voce';
    -- Le voci di sistema sono solo di entrata: un'uscita può andare solo su «Da classificare».
    select * into voce from voci_contabili v
      where v.nome = nome_voce and v.tipo = tipo_riga and v.nome in ('Quota associativa', 'Corsi e altri pagamenti', 'Da classificare');
    if not found then raise exception 'La riga %: la voce non va bene', n using errcode = '22023'; end if;
    if cassa_giorno_chiuso(cassa.id, giorno) then raise exception 'La riga %: quel giorno la cassa è già chiusa', n using errcode = '22023'; end if;

    insert into movimenti (tipo, data, importo, voce_id, cassa_id, descrizione, origine_import)
    values (tipo_riga, giorno, importo::integer, voce.id, cassa.id, descr, chiave)
    on conflict (origine_import) where origine_import is not null do nothing;
    get diagnostics dentro = row_count;
    fatte := fatte + dentro;
  end loop;
  return fatte;
end $$;

revoke all on function importa_prima_nota(jsonb) from public, anon;
grant execute on function importa_prima_nota(jsonb) to authenticated;

notify pgrst, 'reload schema';
