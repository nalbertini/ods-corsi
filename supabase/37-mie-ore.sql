-- ---------------------------------------------------------------------------
-- ODS Corsi · LE MIE ORE: l'istruttore vede le sue lezioni tenute senza segno
--
-- In LE MIE ORE l'istruttore vede le lezioni del mese che in segreteria
-- risultano sue. Le sue presenze le legge già (`presenze_istruttori_legge`,
-- 15-presenze-istruttori.sql); mancano le lezioni tenute in cui era previsto
-- e nessun istruttore si è segnato: sono quelle che a fine mese non gli
-- tornano, e la segreteria le conta fra le DA CONFERMARE nella sua scheda.
--
-- `lezioni_senza_istruttore` (23-istruttori-dalle-lezioni.sql) le dava solo
-- alla segreteria. Ora la segreteria le vede tutte, come prima; un istruttore
-- solo quelle in cui è fra i previsti; un iscritto, o chi non ha una scheda,
-- niente. Restano in sola lettura: sceglie chi c'era sempre la segreteria
-- (`segna_istruttori_lezione`). Nei previsti ci sono anche i colleghi della
-- stessa lezione, che il personale vede già in anagrafica.
--
-- Si lancia dopo `23-istruttori-dalle-lezioni.sql`, e chi rilancia il 23
-- rilancia poi anche questo. Cambia una funzione, ma dice lei a chi: non
-- chiede di rilanciare `06-iscrizioni.sql`. Finché non c'è, in LE MIE ORE le
-- lezioni senza segno non compaiono, e il DA CONFERMARE dell'istruttore può
-- essere più basso di quello della segreteria.
-- ---------------------------------------------------------------------------

create or replace function lezioni_senza_istruttore()
  returns table (sessione_id uuid, corso text, colore text, inizio timestamptz, fine timestamptz, sala text, presenti int, previsti jsonb)
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  staff boolean := e_staff();
  io uuid := persona_corrente();
begin
  if not e_personale() then raise exception 'le lezioni da confermare le vede la segreteria' using errcode = '42501'; end if;
  return query
    with tenute as (
      select s.id, c.nome, c.colore, s.inizio, s.fine, sa.nome as sala, previsti_su(s.id) as chi,
        (select count(*)::int from presenze p where p.sessione_id = s.id and p.stato = 'presente') as presenti
      from sessioni s join corsi c on c.id = s.corso_id
      left join ricorrenze ri on ri.id = s.ricorrenza_id
      left join sale sa on sa.id = coalesce(s.sala_id, ri.sala_id, c.sala_id)
      where s.stato <> 'annullata' and s.fine < now()
        and s.inizio >= (select proposte_istruttori_dal from impostazioni)
        and exists (select 1 from presenze p where p.sessione_id = s.id and p.stato = 'presente')
    )
    select t.id, t.nome, t.colore, t.inizio, t.fine, t.sala, t.presenti,
      (select jsonb_agg(jsonb_build_object('id', pe.id, 'nome', pe.nome, 'cognome', pe.cognome, 'stato', pi.stato) order by pe.nome, pe.cognome)
         from unnest(t.chi) x join persone pe on pe.id = x
         left join presenze_istruttori pi on pi.sessione_id = t.id and pi.persona_id = x)
    from tenute t
    where cardinality(t.chi) > 0
      and (staff or io = any (t.chi))
      and not exists (select 1 from presenze_istruttori pi where pi.sessione_id = t.id)
    order by t.inizio desc;
end $$;

revoke all on function lezioni_senza_istruttore() from public, anon;
grant execute on function lezioni_senza_istruttore() to authenticated;

notify pgrst, 'reload schema';
