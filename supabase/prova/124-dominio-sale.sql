-- Gli account dei tablet (124-dominio-sale.sql): l'email passa da
-- `@sale.ods-corsi.it` (dominio non nostro: chi lo registrava riceveva i codici
-- e i recuperi password) a `@sale.officinedellosport.it`. Cambia solo l'email
-- dei tablet, l'utente resta lo stesso e il file si può rilanciare.
-- Si lancia dopo finto-supabase.sql e i file dello schema.
\set ON_ERROR_STOP on

create or replace function atteso(cosa text, avuto text, voluto text) returns text language plpgsql as $$
begin
  if avuto is distinct from voluto then
    raise exception '% · atteso «%», avuto «%»', cosa, voluto, avuto;
  end if;
  return 'ok  ' || cosa || ' → ' || avuto;
end $$;

insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'lotta@sale.ods-corsi.it'),
  ('67676767-6767-6767-6767-676767676767', 'sala-grande@Sale.ods-corsi.it'),
  ('11111111-1111-1111-1111-111111111111', 'anna@sale.ods-corsi.it'),   -- non è un tablet: non si tocca
  ('22222222-2222-2222-2222-222222222222', 'mamma@esempio.it');
insert into sale (id, nome) values
  ('88888888-8888-8888-8888-888888888888', 'Lotta'),
  ('89898989-8989-8989-8989-898989898989', 'Sala grande');
insert into postazioni (nome, sala_id, utente_id) values
  ('Tablet Lotta', '88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666'),
  ('Tablet grande', '89898989-8989-8989-8989-898989898989', '67676767-6767-6767-6767-676767676767');

\i supabase/124-dominio-sale.sql

select atteso('il tablet della Lotta', (select email from auth.users where id = '66666666-6666-6666-6666-666666666666'), 'lotta@sale.officinedellosport.it');
select atteso('anche scritto con le maiuscole', (select email from auth.users where id = '67676767-6767-6767-6767-676767676767'), 'sala-grande@sale.officinedellosport.it');
select atteso('chi non è un tablet resta com''è', (select email from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'anna@sale.ods-corsi.it');
select atteso('un''altra email resta com''è', (select email from auth.users where id = '22222222-2222-2222-2222-222222222222'), 'mamma@esempio.it');
select atteso('nessun tablet sul dominio vecchio', (select count(*)::text from auth.users u join postazioni p on p.utente_id = u.id where u.email ilike '%@sale.ods-corsi.it'), '0');

-- Rilanciato, non cambia più niente.
\i supabase/124-dominio-sale.sql
select atteso('rilanciato: lo stesso indirizzo', (select email from auth.users where id = '66666666-6666-6666-6666-666666666666'), 'lotta@sale.officinedellosport.it');
