-- ---------------------------------------------------------------------------
-- ODS Corsi · i corsi non sono più rossi
--
-- In segreteria il rosso vuol dire una cosa sola: qualcosa manca o non va
-- (un appello non fatto, un certificato scaduto, un errore). Un corso rosso
-- lo confondeva: nella settimana i SENZA APPELLO veri sparivano fra le
-- lezioni di Lotta. Il rosso non si sceglie più fra i colori dei corsi
-- (`COLORI` in src/lib/segreteria.ts), e i corsi che lo avevano passano al
-- viola.
--
-- Si lancia una volta, dopo `01-schema.sql`. Rilanciarlo non fa niente.
-- ---------------------------------------------------------------------------

update corsi set colore = '#8b5cc4' where lower(colore) = '#e4292a';
