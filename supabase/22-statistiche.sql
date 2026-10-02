-- ---------------------------------------------------------------------------
-- ODS Corsi · le statistiche della segreteria
--
-- STATISTICHE guarda mesi interi, fino a un anno: migliaia di lezioni, e per
-- ognuna l'appello. Leggerle come fa PRESENZE (le lezioni, poi gli iscritti e
-- i segni di tutte) vorrebbe dire scaricare decine di migliaia di righe, e
-- l'API ne dà al più mille per volta. Qui i conti li fa il database, e
-- all'app arriva una riga per lezione con i suoi numeri, in un solo valore
-- (un `jsonb`, che il limite delle righe non tocca).
--
-- I conti sono quelli di PRESENZE (src/components/segreteria/Presenze.tsx):
-- l'appello di una lezione sono gli iscritti di quel giorno, attivi; una
-- lezione senza nemmeno un segno fra loro non ha l'appello. In più qui si
-- contano le prove: chi è segnato presente senza essere iscritto quel giorno
-- (21-prove.sql), che in sala c'era.
--
-- Solo la segreteria: dentro ci sono gli incassi.
--
-- Si lancia quando si vuole, dopo `05-segreteria.sql`. Crea una funzione e
-- dice lei a chi: non chiede di rilanciare `06-iscrizioni.sql`. Finché non
-- c'è, STATISTICHE dice che va lanciato.
-- ---------------------------------------------------------------------------

/**
 * Le lezioni già cominciate fra `da` e `a`, e le ricevute di quei giorni mese
 * per mese:
 *
 *   { lezioni: [{ id, corso_id, corso, colore, capienza, sala, inizio, stato,
 *                 istruttori: [nome], sostituto, iscritti, presenti, assenti,
 *                 giustificati, prove }],
 *     incassi: [{ mese: 'AAAA-MM', ricevute, totale, pagato }] | null }
 *
 * `incassi` è nullo senza 16-ricevute.sql. Gli importi sono in centesimi, e
 * le ricevute annullate non contano.
 */
create or replace function statistiche(da timestamptz, a timestamptz) returns jsonb
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  fino timestamptz := least(a, now());
  lezioni jsonb;
  incassi jsonb;
begin
  if not e_staff() then raise exception 'le statistiche sono della segreteria' using errcode = '42501'; end if;
  if da is null or a is null or a < da then raise exception 'il periodo è al contrario' using errcode = '22023'; end if;
  if a - da > interval '800 days' then raise exception 'al massimo due anni per volta' using errcode = '22023'; end if;

  with s as (
    select s.id, s.corso_id, s.inizio, s.stato, s.istruttore_id, c.istruttore_id as titolare,
           c.nome as corso, c.colore, c.capienza, sa.nome as sala,
           (s.inizio at time zone 'Europe/Rome')::date as giorno
      from sessioni s
      join corsi c on c.id = s.corso_id
      left join sale sa on sa.id = s.sala_id
     where s.inizio >= da and s.inizio <= fino
  ),
  appello as (
    select s.id,
           count(i.persona_id) as iscritti,
           count(p.id) filter (where p.stato = 'presente') as presenti,
           count(p.id) filter (where p.stato = 'assente') as assenti,
           count(p.id) filter (where p.stato = 'giustificato') as giustificati
      from s
      join iscrizioni i on i.corso_id = s.corso_id and i.dal <= s.giorno and (i.al is null or i.al >= s.giorno)
      join persone pe on pe.id = i.persona_id and pe.attiva
      left join presenze p on p.sessione_id = s.id and p.persona_id = i.persona_id
     group by s.id
  ),
  fuori as (
    -- Presenti senza essere iscritti quel giorno: le prove.
    select s.id, count(*) as prove
      from s
      join presenze p on p.sessione_id = s.id and p.stato = 'presente'
     where not exists (
       select 1 from iscrizioni i
        where i.corso_id = s.corso_id and i.persona_id = p.persona_id
          and i.dal <= s.giorno and (i.al is null or i.al >= s.giorno)
     )
     group by s.id
  ),
  chi as (
    -- Chi l'ha fatta: il sostituto, o chi insegna il corso, come in PRESENZE.
    select s.id,
           case
             when s.istruttore_id is not null and s.istruttore_id is distinct from s.titolare
               then (select jsonb_build_array(pe.nome || ' ' || pe.cognome) from persone pe where pe.id = s.istruttore_id)
             else coalesce(
               (select jsonb_agg(pe.nome || ' ' || pe.cognome order by pe.cognome, pe.nome)
                  from corsi_istruttori ci join persone pe on pe.id = ci.persona_id
                 where ci.corso_id = s.corso_id),
               (select jsonb_build_array(pe.nome || ' ' || pe.cognome) from persone pe where pe.id = coalesce(s.istruttore_id, s.titolare)))
           end as istruttori,
           (s.istruttore_id is not null and s.istruttore_id is distinct from s.titolare) as sostituto
      from s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'corso_id', s.corso_id, 'corso', s.corso, 'colore', s.colore, 'capienza', s.capienza,
           'sala', s.sala, 'inizio', s.inizio, 'stato', s.stato,
           'istruttori', coalesce(chi.istruttori, '[]'::jsonb), 'sostituto', chi.sostituto,
           'iscritti', coalesce(ap.iscritti, 0), 'presenti', coalesce(ap.presenti, 0),
           'assenti', coalesce(ap.assenti, 0), 'giustificati', coalesce(ap.giustificati, 0),
           'prove', coalesce(f.prove, 0)
         ) order by s.inizio), '[]'::jsonb)
    into lezioni
    from s
    left join appello ap on ap.id = s.id
    left join fuori f on f.id = s.id
    left join chi on chi.id = s.id;

  -- Le ricevute ci sono solo con 16-ricevute.sql.
  if to_regclass('public.ricevute') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('mese', m.mese, 'ricevute', m.ricevute, 'totale', m.totale, 'pagato', m.pagato) order by m.mese), '[]'::jsonb)
        from (
          select to_char(r.data, 'YYYY-MM') as mese, count(*) as ricevute, sum(r.totale) as totale, sum(r.pagato) as pagato
            from ricevute r
           where r.annullata_il is null
             and r.data >= ($1 at time zone 'Europe/Rome')::date
             and r.data <= ($2 at time zone 'Europe/Rome')::date
           group by 1
        ) m
    $q$ into incassi using da, a;
  end if;

  return jsonb_build_object('lezioni', lezioni, 'incassi', incassi);
end $$;

revoke all on function statistiche(timestamptz, timestamptz) from public, anon;
grant execute on function statistiche(timestamptz, timestamptz) to authenticated;

-- Che l'API veda subito la funzione nuova, senza aspettare.
notify pgrst, 'reload schema';
