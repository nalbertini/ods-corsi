-- ---------------------------------------------------------------------------
-- ODS Corsi · il timer delle sale si cambia dal tablet
--
-- Maurizio, i segnali, il volume, lo schermo e la musica durante il timer
-- sono uguali su tutti i tablet di sala (la colonna `impostazioni.timer` di
-- 10-timer-sale.sql), ma si scelgono nel timer, dalle sue impostazioni, su un
-- tablet qualunque: quello che si sceglie su uno lo prendono tutti.
--
-- La riga delle impostazioni la cambia solo la segreteria (05-segreteria.sql),
-- e un tablet non deve poter toccare il resto (per quanto si tengono le
-- presenze, la voce, gli esercizi). Allora il tablet passa da qui: questa
-- funzione cambia il timer e basta. La chiama anche la segreteria, se entra
-- col suo accesso nel timer di un tablet. Il contenuto lo controlla l'app
-- (`timer/src/lib/impostazioniSala.ts`); il database vuole un oggetto piccolo,
-- come per la segreteria.
--
-- Si lancia dopo `13-voce-esercizi.sql`, e dopo `10-timer-sale.sql`. Crea una
-- funzione, ma dice lei a chi: non chiede di rilanciare `06-iscrizioni.sql`.
-- ---------------------------------------------------------------------------

create or replace function salva_timer_sala(timer jsonb) returns void
  language plpgsql security definer set search_path = public, extensions as $$
begin
  if postazione_corrente() is null and not e_staff() then
    raise exception 'solo un tablet di sala o la segreteria' using errcode = '42501';
  end if;
  if timer is null or jsonb_typeof(timer) <> 'object' then
    raise exception 'il timer è un oggetto' using errcode = '22023';
  end if;
  update impostazioni set timer = salva_timer_sala.timer where id;
end $$;

revoke all on function salva_timer_sala(jsonb) from public, anon;
grant execute on function salva_timer_sala(jsonb) to authenticated;

-- Che l'API veda subito la funzione nuova, senza aspettare.
notify pgrst, 'reload schema';
