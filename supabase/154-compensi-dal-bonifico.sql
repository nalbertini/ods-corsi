-- ---------------------------------------------------------------------------
-- ODS Corsi · Il compenso pagato con un bonifico già in banca non conta due volte
--
-- `paga_compensi` (96) scrive sempre un'uscita nuova. Se il bonifico al tecnico è già arrivato dall'importazione della
-- banca, le uscite diventavano due. Con `abbina_compensi_movimento(ricevute, movimento)` COMPENSI › Segna pagato usa
-- quell'uscita: le ricevute prendono il suo `movimento_id` e il suo giorno (`pagata_il`), il movimento prende il tecnico
-- e la voce «Compensi istruttori» (la descrizione della banca resta), e non nasce un altro movimento.
-- Il movimento va bene se: è un'uscita non annullata del Conto Corrente, non Satispay, su «Compensi istruttori» o «Da
-- classificare», senza persona o con quel tecnico, non già il pagamento di altre ricevute, con lo stesso importo delle
-- ricevute e entro 45 giorni dalla fine del mese più recente che pagano, in un giorno non chiuso. Le ricevute come in
-- `paga_compensi`: almeno una, dello stesso tecnico, non annullate né pagate. Il nome del tecnico nella descrizione lo
-- guarda l'app, per dire quale proporre: qui no, perché si può scegliere anche un bonifico con una sigla.
-- Annullato il movimento in CONTABILITÀ, le ricevute tornano da pagare (trigger `compensi_tornano` dell'81); il
-- movimento annullato resta col tecnico e la voce.
--
-- Chi può: chi cura segreteria e contabilità insieme, come `paga_compensi` (`e_staff` e `contabilita_porta`). Si lancia
-- dopo `96-compensi-extra.sql` e si può rilanciare; non chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è,
-- scegliere un bonifico in Segna pagato dice di lanciare questo file, e Segna pagato senza bonifico va come prima.
-- Le stesse regole in src/lib/compensi.ts (`bonificiPerCompensi`) e nella modalità prova (segreteriaProva.ts).
-- ---------------------------------------------------------------------------

create or replace function abbina_compensi_movimento(ricevute uuid[], movimento uuid) returns movimenti
  language plpgsql security definer set search_path = public as $$
declare
  m movimenti;
  tecnico uuid;
  quante int;
  persone_diverse int;
  totale bigint;
  fine date;
  voce uuid;
begin
  if not e_staff() then raise exception 'I compensi li paga chi cura segreteria e contabilità' using errcode = '42501'; end if;
  perform contabilita_porta();
  -- Le ricevute come in `paga_compensi`: la stessa due volte conta una volta.
  ricevute := array(select distinct x from unnest(ricevute) x where x is not null);
  if coalesce(cardinality(ricevute), 0) = 0 then raise exception 'Scegli almeno una ricevuta da pagare' using errcode = '22023'; end if;
  perform 1 from ricevute_compensi x where x.id = any(ricevute) for update;
  select count(*), count(distinct x.persona_id), sum(x.importo), min(x.persona_id::text)::uuid,
         (max(x.mese) + interval '1 month' - interval '1 day')::date
    into quante, persone_diverse, totale, tecnico, fine
    from ricevute_compensi x where x.id = any(ricevute) and x.annullata_il is null and x.movimento_id is null;
  if quante <> cardinality(ricevute) then raise exception 'Una delle ricevute non c''è più, è annullata o è già pagata: ricarica la pagina' using errcode = '22023'; end if;
  if persone_diverse <> 1 then raise exception 'Si pagano insieme solo le ricevute dello stesso tecnico' using errcode = '22023'; end if;

  select * into m from movimenti x where x.id = movimento for update;
  if not found or m.annullato_il is not null then raise exception 'Il bonifico non c’è più o è annullato: ricarica la pagina' using errcode = '22023'; end if;
  -- Gli stessi controlli di `bonificiPerCompensi`, nome a parte.
  if m.tipo <> 'uscita' or m.satispay_id is not null or (select nome from casse where id = m.cassa_id) is distinct from 'Conto Corrente'
     -- `coalesce`: una voce che manca o non è d'uscita dà null, e `null not in (…)` non scatterebbe.
     or coalesce((select nome from voci_contabili where id = m.voce_id and tipo = 'uscita'), '') not in ('Compensi istruttori', 'Da classificare') then
    raise exception 'Si sceglie solo un’uscita del Conto Corrente su «Compensi istruttori» o «Da classificare»' using errcode = '22023';
  end if;
  if m.persona_id is not null and m.persona_id <> tecnico then raise exception 'Il bonifico è collegato a un’altra persona' using errcode = '22023'; end if;
  if exists (select 1 from ricevute_compensi x where x.movimento_id = m.id) then
    raise exception 'Il bonifico è già il pagamento di altre ricevute' using errcode = '22023';
  end if;
  if m.importo <> totale then raise exception 'Le ricevute e il bonifico non hanno lo stesso importo' using errcode = '22023'; end if;
  if abs(m.data - fine) > 45 then raise exception 'Il bonifico è a più di 45 giorni dalla fine del mese che paga' using errcode = '22023'; end if;
  if cassa_giorno_chiuso(m.cassa_id, m.data) then raise exception 'Quel giorno la cassa è già chiusa: scegli un altro giorno o annulla la chiusura' using errcode = '22023'; end if;

  voce := (select id from voci_contabili where tipo = 'uscita' and lower(trim(nome)) = 'compensi istruttori' and di_sistema);
  if voce is null then raise exception 'Manca la voce «Compensi istruttori»: va lanciato 81-compensi-pagati.sql' using errcode = '22023'; end if;
  update movimenti x set persona_id = tecnico, voce_id = voce where x.id = m.id returning * into m;
  update ricevute_compensi x set movimento_id = m.id, pagata_il = m.data where x.id = any(ricevute);
  return m;
end $$;
revoke all on function abbina_compensi_movimento(uuid[], uuid) from public, anon;
grant execute on function abbina_compensi_movimento(uuid[], uuid) to authenticated;

notify pgrst, 'reload schema';
