-- ---------------------------------------------------------------------------
-- ODS Corsi · se ha pagato lo dicono le ricevute
--
-- Prima lo stato del pagamento era scritto a mano nella scheda (DA PAGARE,
-- IN PARTE, PAGATO e un «fino al»), e le ricevute stavano a parte: le due
-- cose potevano dire cose diverse, e annullare una ricevuta lasciava la
-- scheda PAGATO. Ora in regola vuol dire la quota associativa pagata: una
-- ricevuta non annullata con la voce QUOTA ASSOCIATIVA che vale oggi. I
-- corsi si guardano a parte.
--
-- Quello scritto a mano in `schede_iscritti` resta, e diventa l'eccezione
-- per chi ha pagato fuori dall'app (prima dell'app, con una ricevuta di
-- carta), fino alla sua data. Il conto lo fa `pagamentoDi` in
-- src/lib/segreteria.ts, sulle righe di `quote_ricevute`.
--
-- Si lancia dopo `16-ricevute.sql`. Rilanciarlo non fa niente di nuovo.
-- Finché non c'è, l'app ricava le stesse righe dalle ricevute da sola.
-- ---------------------------------------------------------------------------

-- Una riga per ogni quota associativa di una ricevuta non annullata: di chi,
-- da quando a quando vale, e quanti centesimi ne mancano. Di una voce manca
-- quello che non è stato pagato su di lei, ma mai più di quanto resta della
-- ricevuta: un anticipo dato prima la può aver già coperta. Come `quoteDi`
-- in src/lib/ricevute.ts.
--
-- `security_invoker`: chi la legge vede solo le ricevute che può vedere,
-- cioè la segreteria (16-ricevute.sql).
create or replace view quote_ricevute with (security_invoker = true) as
  select r.persona_id, r.anno, r.numero,
         (v->>'dal')::date as dal,
         (v->>'al')::date as al,
         least(
           greatest(0, coalesce((v->>'quantita')::int, 1) * (v->>'prezzo')::int
                       - coalesce((select sum((p->>'importo')::int) from jsonb_array_elements(v->'pagamenti') p), 0)),
           greatest(0, r.totale - r.pagato - r.anticipo)
         )::int as mancano
    from ricevute r
    cross join lateral jsonb_array_elements(r.voci) v
   where r.annullata_il is null
     and r.persona_id is not null
     and upper(trim(v->>'descrizione')) = 'QUOTA ASSOCIATIVA';

revoke all on quote_ricevute from anon, authenticated;
grant select on quote_ricevute to authenticated;

-- Chi ha già la quota pagata con una ricevuta che vale oggi non ha bisogno
-- dello stato scritto a mano: era la casella «Segna in scheda» della
-- ricevuta, che non c'è più. Lo si toglie, perché resterebbe come eccezione
-- e terrebbe PAGATO anche dopo l'annullamento della ricevuta. La nota resta.
update schede_iscritti s
   set pagamento = 'da_pagare', pagato_fino = null
 where s.pagamento <> 'da_pagare'
   and exists (
     select 1 from quote_ricevute q
      where q.persona_id = s.persona_id and q.mancano = 0
        and (q.dal is null or q.dal <= current_date)
        and (q.al is null or q.al >= current_date));
