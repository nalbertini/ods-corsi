-- L'avviso dello scarico Satispay (97-satispay-scarico.sql e 84-avvisi-segreteria.sql): finito uno scarico vero (non l'anteprima), la
-- segreteria riceve un'email solo se lo scarico non è riuscito: da 132-satispay-solo-chi-ha-pagato.sql non scrive più
-- movimenti né lascia pagamenti da decidere, quindi un giro andato bene non ha niente da dire. Va agli indirizzi degli avvisi (`avvisi_indirizzi`) e parte con gli altri, dalla Edge Function
-- `avvisi-segreteria`. Il testo della mail, lato app, in scripts/prova-avvisi-segreteria.mjs.
--
-- I nomi che il file SQL deve avere:
--   • `satispay_scarico_avvisa(conti jsonb, errore text) returns void`: solo `service_role` (la Edge Function
--     `satispay-scarico`). `conti` è quel che dà `satispay_negozio_applica`, o null se lo scarico non è riuscito.
--     Mette in `avvisi_segreteria` un avviso `tipo = 'satispay_scarico'` solo se `errore` non è null; se no niente,
--     qualunque siano i conti. Ad avvisi spenti niente. Conta nel tetto dei 50.
--   • In `avvisi_da_mandare()` l'avviso ha la forma
--       {tipo:'satispay_scarico', quando, incassi, rimborsi, daDecidere, errore}
-- Si lancia dopo finto-supabase.sql e i file dello schema, fino a 132-satispay-solo-chi-ha-pagato.sql.
\set ON_ERROR_STOP on
set timezone = 'Europe/Rome';

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto and not (voluto like '%…' and avuto like replace(voluto, '…', '%')) then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;
select (to_regprocedure('public.satispay_scarico_avvisa(jsonb,text)') is not null)::text as c98 \gset
select atteso('lo schema è quello nuovo: c''è satispay_scarico_avvisa', :'c98', 'true');

-- Lancia come service_role (la Edge Function): «ok», o «codice messaggio».
create or replace function servizio(sql text) returns text language plpgsql as $$
begin
  set role service_role;
  begin execute sql;
  exception when others then reset role; return sqlstate || ' ' || sqlerrm; end;
  reset role;
  return 'ok';
end $$;
create or replace function come(ruolo text, sql text) returns text language plpgsql as $$
begin
  execute format('set role %I', ruolo);
  begin execute sql;
  exception when others then reset role; return sqlstate; end;
  reset role;
  return 'ok';
end $$;
-- Gli avvisi dello scarico che partirebbero adesso, come li vede la Edge Function.
create or replace function pronti() returns setof jsonb language plpgsql as $$
begin
  set role service_role;
  return query select avviso from avvisi_da_mandare() where avviso->>'tipo' = 'satispay_scarico';
  reset role;
end $$;
create or replace function conti(incassi int, rimborsi int, da_decidere int) returns jsonb language sql as $$
  select jsonb_build_object('incassi', incassi, 'rimborsi', rimborsi, 'modulo', 3, 'pagamenti', 1, 'a_mano', 2,
    'da_decidere', da_decidere, 'prima', 0, 'scritti', incassi + rimborsi, 'dal', '2026-09-01')
$$;
grant execute on function pronti(), conti(int, int, int) to service_role;

\echo ''
\echo '--- 1. chi può avvisare: solo la Edge Function ---'
select atteso('anon no', come('anon', $$select satispay_scarico_avvisa(conti(1, 0, 0), null)$$), '42501');
select atteso('un accesso no', come('authenticated', $$select satispay_scarico_avvisa(conti(1, 0, 0), null)$$), '42501');

\echo ''
\echo '--- 2. avvisi spenti: niente, nemmeno con un errore ---'
update avvisi_indirizzi set a = null;
select atteso('lo scarico avvisa', servizio($$select satispay_scarico_avvisa(null, 'Satispay non risponde')$$), 'ok');
select atteso('ma nel registro non entra', (select count(*)::text from avvisi_segreteria), '0');
update avvisi_indirizzi set a = 'segreteria@officinedellosport.it';

\echo ''
\echo '--- 3. scarico riuscito (errore null): niente mail, qualunque siano i conti ---'
select servizio($$select satispay_scarico_avvisa(conti(0, 0, 0), null)$$);
select atteso('niente di nuovo: nessun avviso', (select count(*)::text from avvisi_segreteria), '0');
select servizio($$select satispay_scarico_avvisa(conti(2, 1, 0), null)$$);
select atteso('incassi e rimborsi nel versamento: nessun avviso', (select count(*)::text from avvisi_segreteria), '0');
select servizio($$select satispay_scarico_avvisa(conti(0, 0, 2), null)$$);
select atteso('anche con un da decidere vecchio nei conti: nessun avviso', (select count(*)::text from avvisi_segreteria), '0');
select servizio($$select satispay_scarico_avvisa(null, null)$$);
select atteso('senza conti e senza errore: nessun avviso', (select count(*)::text from avvisi_segreteria) || ' ' || (select count(*)::text from pronti()), '0 0');

\echo ''
\echo '--- 4. lo scarico non riuscito: un avviso con l''errore ---'
select servizio($$select satispay_scarico_avvisa(null, 'Satispay non risponde: lo scarico riprova da solo stanotte')$$);
select atteso('uno in coda', (select count(*)::text from pronti()), '1');
select atteso('l''errore, i conti a zero', (select (a->>'incassi') || ',' || (a->>'daDecidere') || ',' || (a->>'errore') from pronti() a),
  '0,0,Satispay non risponde: lo scarico riprova da solo stanotte');
select atteso('e quando', (select ((a->>'quando')::timestamptz > now() - interval '1 minute')::text from pronti() a), 'true');
select atteso('agli indirizzi degli avvisi, con la copia',
  (select a || ' · ' || cc from (select * from avvisi_da_mandare() where avviso->>'tipo' = 'satispay_scarico') x),
  'segreteria@officinedellosport.it · asdilcentrojudo@gmail.com');
select atteso('nessuno da fuori legge il registro', come('authenticated', 'select 1 from avvisi_segreteria'), '42501');
delete from avvisi_segreteria;

\echo ''
\echo '--- 5. l''errore con i conti di un giro andato a metà: l''avviso li porta e dice l''errore ---'
select servizio($$select satispay_scarico_avvisa(conti(2, 1, 0), 'Non sono riuscito a scrivere')$$);
select atteso('incassi, rimborsi, errore', (select (a->>'incassi') || ',' || (a->>'rimborsi') || ',' || (a->>'errore') from pronti() a), '2,1,Non sono riuscito a scrivere');
delete from avvisi_segreteria;

\echo ''
\echo '--- 6. due scarichi falliti lo stesso giorno: due avvisi ---'
select servizio($$select satispay_scarico_avvisa(null, 'Primo errore')$$);
select servizio($$select satispay_scarico_avvisa(null, 'Secondo errore')$$);
select atteso('due in coda', (select count(*)::text from pronti()), '2');
delete from avvisi_segreteria;

\echo ''
\echo '--- 7. il tetto dei 50 vale anche qui ---'
insert into avvisi_segreteria (tipo, chiave) select 'richiesta', 'oggi:' || n from generate_series(1, 50) n;
select servizio($$select satispay_scarico_avvisa(null, 'Errore oltre il tetto')$$);
select atteso('oltre il tetto: segnato, non parte',
  (select coalesce(non_mandato, '-') from avvisi_segreteria where tipo = 'satispay_scarico'), 'tetto');
select atteso('e non è fra i pronti', (select count(*)::text from pronti()), '0');
