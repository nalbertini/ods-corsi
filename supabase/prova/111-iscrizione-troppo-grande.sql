-- Una richiesta d'iscrizione enorme (fatta apposta, non dal modulo) si rifiuta all'ingresso (111-iscrizione-troppo-grande.sql).
-- Prima `invia_iscrizione` la leggeva tutta, anche con 5 MB in una chiave che poi scartava; ora, come
-- `invia_ordine_vestiario` (47), la ferma subito. Le richieste giuste (prova/iscrizioni.sql) passano come prima.
-- Si lancia dopo `iscrizioni` (ne usa gli helper `chi`, `tenta`, `atteso`, `adulto`).
\set ON_ERROR_STOP on

\echo ''
\echo '--- una richiesta di 5 MB si ferma subito ---'
select chi('');
set role anon;
select atteso('5 MB in una chiave sconosciuta: rifiutata, con un testo per chi usa il modulo',
  tenta($$select invia_iscrizione(adulto(jsonb_build_object('zz', repeat('a', 5000000))))::text$$),
  'NEGATO: La richiesta è troppo grande: ricarica la pagina e rifalla');
select atteso('5 MB in una nota: rifiutata prima dei controlli sul resto',
  tenta($$select invia_iscrizione(adulto(jsonb_build_object('note', repeat('a', 5000000), 'nome', '')))::text$$),
  'NEGATO: La richiesta è troppo grande: ricarica la pagina e rifalla');
reset role;

\echo ''
\echo 'TUTTO A POSTO'
