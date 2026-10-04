-- ---------------------------------------------------------------------------
-- ODS Corsi · le radio nelle liste della musica delle sale
--
-- Una lista della musica può essere anche una radio: un nome e l'indirizzo
-- della radio, che deve cominciare con https (l'app è su https e il browser
-- non suona un indirizzo http). Le liste di YouTube e di Spotify restano
-- valide com'erano. Chi può scriverle e leggerle non cambia.
--
-- Si lancia dopo `09-musica.sql`. Non crea funzioni: non chiede di rilanciare
-- `06-iscrizioni.sql`. Finché non c'è, il database rifiuta un indirizzo di
-- radio e la segreteria dice di lanciarlo. Rilanciare il 09 non toglie il
-- vincolo nuovo (la tabella c'è già); su un database nuovo il 09 lo crea
-- com'era, e il 39 va lanciato dopo.
--
-- La regola dell'indirizzo è la stessa di `leggiRadio` in
-- `timer/src/lib/link.ts`: se cambia una, cambia l'altra.
-- ---------------------------------------------------------------------------

-- Le righe già scritte sono tutte di YouTube o di Spotify, che il vincolo
-- nuovo accetta ancora: niente da sistemare prima.
alter table musica_sale drop constraint if exists musica_sale_link_check;
alter table musica_sale add constraint musica_sale_link_check
  check (length(link) <= 500
         and (link ~* '^(https?://)?([a-z]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|open\.spotify\.com)/|^spotify:'
              or link ~* '^https://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]+)?(/[^[:space:]"<>\\]*)?$'));

notify pgrst, 'reload schema';
