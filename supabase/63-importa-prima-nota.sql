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
--
-- Come un movimento a mano, una riga non può essere prima dell'inizio della cassa (`dal`): si importa con
-- la cassa ancora senza data di partenza, e si imposta dopo. Una riga importata e poi annullata non torna
-- rilanciando il file: la chiave c'è ancora, e un annullo voluto non si disfa da solo.

alter table movimenti add column if not exists origine_import text;
-- La chiave è unica solo dove c'è: i movimenti scritti a mano non ce l'hanno.
create unique index if not exists movimenti_origine_import on movimenti (origine_import) where origine_import is not null;

create or replace function importa_prima_nota(dati jsonb) returns integer
  language plpgsql security definer set search_path = public as $$
declare
  riga jsonb;
  n integer := 0;
  fatte integer := 0;
  viste text[] := '{}';
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
  -- Se qualcuno l'ha spenta, per l'import si riaccende: è la voce di arrivo di tutto lo storico.
  update voci_contabili v set attiva = true where lower(trim(v.nome)) = 'da classificare' and not v.attiva;

  for riga in select * from jsonb_array_elements(dati) loop
    n := n + 1;
    if jsonb_typeof(riga) is distinct from 'object' then raise exception 'La riga % non si capisce', n using errcode = '22023'; end if;
    chiave := case when jsonb_typeof(riga->'chiave') = 'string' then riga->>'chiave' else '' end;
    if chiave !~ '^[A-Za-z0-9:_.-]{1,100}$' then raise exception 'La riga % non ha la chiave', n using errcode = '22023'; end if;
    if chiave = any(viste) then raise exception 'La riga %: la chiave è già nel pacchetto', n using errcode = '22023'; end if;
    viste := viste || chiave;
    if jsonb_typeof(riga->'data') is distinct from 'string' or riga->>'data' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'La riga %: la data non si capisce', n using errcode = '22023'; end if;
    begin giorno := (riga->>'data')::date; exception when others then
      raise exception 'La riga %: la data non si capisce', n using errcode = '22023';
    end;
    if giorno is null or giorno < date '2000-01-01' then raise exception 'La riga %: la data non si capisce', n using errcode = '22023'; end if;
    if giorno > contabilita_oggi() then raise exception 'La riga %: la data è nel futuro', n using errcode = '22023'; end if;
    select * into cassa from casse c where c.nome = case riga->>'cassa' when 'contanti' then 'Cassa Contanti' when 'conto' then 'Conto Corrente' end
      for share;  -- come `registra_movimento`: una chiusura che si sta facendo in questo momento aspetta, o ci fa aspettare
    if not found then raise exception 'La riga %: la cassa non è quella dei contanti né quella del conto', n using errcode = '22023'; end if;
    tipo_riga := riga->>'tipo';
    if tipo_riga is null or tipo_riga not in ('entrata', 'uscita') then raise exception 'La riga %: scegli se è un’entrata o un’uscita', n using errcode = '22023'; end if;
    if jsonb_typeof(riga->'importo') is distinct from 'number' then raise exception 'La riga %: l’importo non si capisce', n using errcode = '22023'; end if;
    importo := (riga->>'importo')::numeric;
    if importo <> trunc(importo) then raise exception 'La riga %: l’importo non si capisce', n using errcode = '22023'; end if;
    if importo <= 0 then raise exception 'La riga %: l’importo deve essere più di zero', n using errcode = '22023'; end if;
    if importo > 10000000 then raise exception 'La riga %: l’importo è troppo alto', n using errcode = '22023'; end if;
    -- Anche gli spazi che non si vedono (a-capo, spazio unificatore, spazio largo zero) contano come spazi.
    descr := case when jsonb_typeof(riga->'descrizione') = 'string' then btrim(regexp_replace(riga->>'descrizione', '[\s\u00a0\u200b]+', ' ', 'g')) else '' end;
    if descr = '' then raise exception 'La riga %: scrivi una descrizione', n using errcode = '22023'; end if;
    if char_length(descr) > 200 then raise exception 'La riga %: la descrizione è troppo lunga', n using errcode = '22023'; end if;
    nome_voce := riga->>'voce';
    -- Le voci di sistema sono solo di entrata: un'uscita può andare solo su «Da classificare».
    -- Il nome si confronta come l'indice unico delle voci (senza maiuscole né spazi ai bordi): «Da classificare» scritta a mano va bene.
    select * into voce from voci_contabili v
      where lower(trim(v.nome)) = lower(trim(nome_voce)) and v.tipo = tipo_riga
        and lower(trim(v.nome)) in ('quota associativa', 'corsi e altri pagamenti', 'da classificare');
    if not found then raise exception 'La riga %: la voce non va bene', n using errcode = '22023'; end if;
    if cassa.dal is not null and giorno < cassa.dal then raise exception 'La riga %: la data è prima dell’inizio della cassa', n using errcode = '22023'; end if;
    -- Una riga già importata prima della chiusura non è un errore se si rilancia il pacchetto: non si riscrive.
    if cassa_giorno_chiuso(cassa.id, giorno) and not exists (select 1 from movimenti m where m.origine_import = chiave) then raise exception 'La riga %: quel giorno la cassa è già chiusa', n using errcode = '22023'; end if;

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
