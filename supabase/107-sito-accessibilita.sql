-- ---------------------------------------------------------------------------
-- ODS Corsi · la Dichiarazione di accessibilità del sito
--
-- Una quarta pagina di legge (come privacy, cookie e contributi pubblici): non si
-- nasconde, non si cancella, non cambia indirizzo. Nasce come BOZZA mai pubblicata,
-- con un testo-traccia a segnaposto «[DA COMPILARE …]»: la segreteria lo compila e
-- preme PUBBLICA solo dopo aver verificato davvero l'accessibilità. Finché non è
-- pubblicata non compare sul sito, né la voce «Accessibilità» nel footer
-- (`sito_pagine_pubbliche()` e `sito_menu_pubblico()` mostrano solo il pubblicato).
--
--   · lo slug `dichiarazione-accessibilita` è riservato: una pagina normale non lo
--     prende (vincolo `slug`). Una pagina normale che lo avesse già diventa di legge,
--     senza perdere testo né stato (e, se era nascosta, torna visibile);
--   · `salva_menu_sito` lascia nel footer una pagina di LEGGE anche se non è ancora
--     pubblicata (le altre pagine mai pubblicate restano rifiutate), così il footer
--     si può salvare mentre la dichiarazione è in bozza;
--   · la voce «Accessibilità» entra in coda al footer, una volta sola.
--
-- Il testo-traccia è lo stesso di `src/lib/sitoAccessibilita.ts` (la prova li tiene uguali).
-- Chi può cosa: come per le altre pagine del sito (la scrive la segreteria, il pubblico
-- vede solo il pubblicato).
--
-- Si lancia dopo `56-sito.sql`. Non chiede di rilanciare `06-iscrizioni.sql`. Dopo ogni
-- rilancio del `56` va rilanciato anche questo (il `56` rifà `salva_menu_sito`).
-- Finché non c'è, la pagina non compare nell'editor del sito e tutto il resto va come prima.
-- ---------------------------------------------------------------------------

-- Prima le righe, poi il vincolo: se no un rilancio su una pagina già presente lo romperebbe.
update sito_pagine set di_legge = true, nascosta = false where slug = 'dichiarazione-accessibilita';

alter table sito_pagine drop constraint if exists sito_pagine_slug_check;
alter table sito_pagine add constraint sito_pagine_slug_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80
         and slug not in ('contact', 'contattaci', 'privacy', 'cookie', 'admin', 'api', 'app', 'sitemap', 'robots', 'dichiarazione-accessibilita')
         or slug in ('privacy', 'cookie')
         or (slug = 'dichiarazione-accessibilita' and di_legge));

-- Come `cambia_indirizzo_sito`: un vecchio rinvio da questo indirizzo non deve battere la pagina.
delete from sito_redirect where da = 'dichiarazione-accessibilita';

insert into sito_pagine (slug, titolo, di_legge, bozza)
values ('dichiarazione-accessibilita', 'Dichiarazione di accessibilità', true, '<h2>Quale sito riguarda</h2><p>Questa dichiarazione riguarda il sito pubblico di [DA COMPILARE: nome di chi gestisce la palestra], raggiungibile all’indirizzo www.officinedellosport.it. L’app per gli iscritti, la segreteria e gli istruttori non rientra in questa dichiarazione.</p><h2>Stato di conformità</h2><p>Regole di accessibilità WCAG 2.1 livello AA: [DA COMPILARE: stato di conformità, «conforme», «parzialmente conforme» o «non conforme»; scrivilo solo dopo la verifica].</p><h2>Contenuti non accessibili</h2><p>[DA COMPILARE: contenuti non accessibili e perché, oppure «nessuno noto»; per ognuno scrivi quando sarà sistemato].</p><h2>Come e quando è stato verificato</h2><p>Data dell’ultima verifica: [DA COMPILARE: data, ad esempio 3 novembre 2026]. Metodo: [DA COMPILARE: metodo usato, ad esempio prova da tastiera, lettore di schermo e controllo automatico, e chi l’ha fatta].</p><h2>Segnalare un problema</h2><p>Se trovi qualcosa che non riesci a usare, scrivici: [DA COMPILARE: contatto per le segnalazioni, un indirizzo email o un telefono a cui risponde davvero qualcuno].</p>')
on conflict (slug) do nothing;

-- In coda al footer, una volta sola: se la segreteria l'ha già riordinato, le altre voci restano dove sono.
insert into sito_menu (dove, etichetta, pagina_id, ordine)
select 'footer', 'Accessibilità', p.id, coalesce((select max(m.ordine) from sito_menu m where m.dove = 'footer'), 0) + 1
  from sito_pagine p
 where p.slug = 'dichiarazione-accessibilita'
   and not exists (select 1 from sito_menu m where m.pagina_id = p.id and m.dove = 'footer');

-- Come nel 56, con una sola differenza: una pagina di legge può stare nel footer anche mai pubblicata.
create or replace function salva_menu_sito(p_dove text, p_voci jsonb)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  pos integer := 0;
  pag sito_pagine;
begin
  if not e_staff() then
    raise exception 'Serve un accesso da segreteria' using errcode = '42501';
  end if;
  if p_dove not in ('menu', 'footer') then
    raise exception 'Il menu può essere solo quello in alto o il footer' using errcode = 'P0001';
  end if;
  -- Due salvataggi insieme non devono lasciare le voci doppie.
  perform pg_advisory_xact_lock(hashtext('sito_menu_' || p_dove));
  for v in select * from jsonb_array_elements(coalesce(p_voci, '[]'::jsonb)) loop
    if nullif(btrim(v->>'etichetta'), '') is null then
      raise exception 'Ogni voce ha bisogno di un nome' using errcode = 'P0001';
    end if;
    if (nullif(v->>'pagina_id', '') is null) = (nullif(v->>'indirizzo', '') is null) then
      raise exception 'La voce «%» deve portare a una pagina oppure a un indirizzo, non a tutti e due né a nessuno', v->>'etichetta' using errcode = 'P0001';
    end if;
    if nullif(v->>'pagina_id', '') is not null then
      select * into pag from sito_pagine where id = (v->>'pagina_id')::uuid;
      if pag.id is null or pag.nascosta or (pag.pubblicato is null and not (p_dove = 'footer' and pag.di_legge)) then
        raise exception 'La voce «%» porta a una pagina nascosta o non ancora pubblicata: pubblicala o togli la voce', v->>'etichetta' using errcode = 'P0001';
      end if;
    end if;
  end loop;
  if p_dove = 'footer' then
    select * into pag from sito_pagine l
     where l.di_legge and not exists (
       select 1 from jsonb_array_elements(coalesce(p_voci, '[]'::jsonb)) e where nullif(e->>'pagina_id', '')::uuid = l.id)
     limit 1;
    if pag.id is not null then
      raise exception 'Nel footer deve esserci «%»: è una pagina di legge', pag.titolo using errcode = 'P0001';
    end if;
  end if;
  delete from sito_menu where dove = p_dove;
  for v in select * from jsonb_array_elements(coalesce(p_voci, '[]'::jsonb)) loop
    pos := pos + 1;
    insert into sito_menu (dove, etichetta, pagina_id, indirizzo, ordine)
    values (p_dove, btrim(v->>'etichetta'), nullif(v->>'pagina_id', '')::uuid, nullif(v->>'indirizzo', ''), pos);
  end loop;
end $$;

revoke all on function salva_menu_sito(text, jsonb) from public, anon;
grant execute on function salva_menu_sito(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
