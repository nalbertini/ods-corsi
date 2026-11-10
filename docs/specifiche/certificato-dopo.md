# Il certificato portato dopo

Specifica del 2026-11-10. Chi si iscrive può dire «non ce l'ho ancora»: si
iscrive lo stesso e ha un termine, deciso in IMPOSTAZIONI, per caricarlo. Fino
al termine partono i solleciti per email, con un link che apre una pagina fatta
solo per caricare il certificato.

## Com'è oggi

- Nel modulo il certificato è già facoltativo (`FILE` in `src/lib/richieste.ts`,
  `seManca: 'PUOI PORTARLO DOPO'`); i testi dicono «portalo prima della prima
  lezione, senza non si partecipa». Non c'è un termine né un sollecito automatico.
- Dall'area iscritti il certificato si manda già (`iscritto_manda_certificato`,
  `102-certificato-iscritto.sql`): resta in attesa (`certificato_in_attesa`) finché
  la segreteria lo conferma con la scadenza (`conferma_certificato_iscritto`) o lo
  rifiuta. L'avviso alla segreteria parte (`139-avviso-certificato.sql`).
- Il sollecito è su WhatsApp, a mano (`src/lib/sollecito.ts`, tabella `solleciti`
  di `85-solleciti.sql`: solo data e chi).
- Le mail partono da `avvisi-segreteria` (pg_cron ogni 5 minuti, SMTP Register.it,
  registro `avvisi_segreteria` con `chiave` unica, `avvisi_da_mandare()` che
  restituisce `a`, `cc` e il contenuto).
- `impostazioni` è una riga sola, cambiata dalla segreteria da IMPOSTAZIONI.

## Le decisioni

| Tema | Scelta |
|---|---|
| Come lo dice | Scelta esplicita nel passo documenti: «Lo carico ora» / «Non ce l'ho ancora» |
| Dove | Iscrizione pubblica, «una persona in più», rinnovo (certificato scaduto o in scadenza) |
| Famiglie | Termine per persona; una mail sola al titolare con chi manca e un link per ciascuno |
| Da quando | Dall'accoglimento della richiesta. Rinnovo: dalla scadenza del certificato vecchio, più lo stesso termine |
| Termine | Un valore solo in IMPOSTAZIONI, uguale per normale e agonistico |
| Nel termine | Frequenta normalmente |
| Dopo il termine | Solo segnalazione: rosso in DA FARE e nella scheda, avviso al tablet; la presenza si segna |
| Solleciti | Momenti rispetto al termine (es. −7, 0, +7 giorni), aggiungibili e togliibili |
| Opzioni | Interruttore, oggetto e testo con segnaposto, copia alla segreteria |
| Senza email | In DA FARE «sollecito da mandare a mano», col WhatsApp di oggi e il link nel testo |
| Stop | Si fermano al caricamento, alla conferma, alla disattivazione; «Sospendi solleciti» dalla scheda |
| Storico | Nella scheda ogni sollecito: data, canale (email/WhatsApp), se il link è stato aperto |
| Link | Uno per persona, lo stesso in tutti i solleciti, valido finché il certificato non è confermato (tetto di sicurezza) |
| Uso del link | Più caricamenti finché la segreteria non conferma; dopo non vale più |
| Pagina | Nome abbreviato, tipo (normale/agonistico), data limite; chiede il file e la scadenza |
| Verifica | Il caricato resta da verificare (regola di CLAUDE.md); i solleciti si fermano già al caricamento |
| Chi ha l'account | Riceve lo stesso il link: un tocco, senza password |
| Posta | Stesso mittente e casella delle ricevute |
| Proroga | «Cambia la data» nella scheda sposta il termine di una persona sola (deciso il 2026-11-10) |
| Tablet | Nella PR1: «! CERTIFICATO NON ARRIVATO» sotto il nome per chi ha passato il termine; nel termine niente. Al tablet arriva solo un sì/no |
| Iscritti di prima | Senza termine: trattati come termine passato, rosso «Certificato non arrivato», niente più «non può entrare in sala» |
| «Entro» | Il giorno stesso è ancora nel termine: rosso dal giorno dopo |
| Gare | Nel termine il certificato non vale per la gara |

## Le regole

### Il termine

- `entro` di una persona:
  - nuova iscrizione con «non ce l'ho ancora»: giorno dell'accoglimento + `certificato_giorni`;
  - rinnovo: `certificato_scade` + `certificato_giorni`.
- Il termine conta solo se il certificato serve (`serveCertificato`, dai 6 anni).
  Chi compie 6 anni dopo l'iscrizione resta nel giro di oggi (`in_arrivo`) e,
  compiuti, ha come termine il compleanno + `certificato_giorni`.
- Cambiare `certificato_giorni` in IMPOSTAZIONI vale per le iscrizioni accolte da
  quel momento: chi ha già un `entro` scritto lo tiene. Il rinnovo, che si calcola,
  segue il valore nuovo.

### Lo stato del certificato

`statoCertificato` (in `src/lib/segreteria.ts`) guadagna uno stato:

| Stato | Quando | Colore |
|---|---|---|
| `atteso` | serve, non c'è, oggi ≤ `entro` | giallo |
| `manca` | serve, non c'è, oggi > `entro` (o nessun `entro`) | rosso |
| `scaduto` | scaduto e oggi > `certificato_scade` + giorni | rosso |
| `in_scadenza`, `valido`, `non_serve`, `in_arrivo` | come oggi | |

Il certificato da verificare (`certificato_in_attesa`) non cambia lo stato: resta
non valido finché non è confermato, ma ferma i solleciti. Le caselle in cima e
DA FARE contano `atteso` a parte da `manca`.

### I solleciti

- Un sollecito è dovuto il giorno `entro + momento` (momento in giorni, negativo = prima)
  se: i solleciti sono accesi, la persona è attiva, il certificato serve e non è né
  valido né da verificare, i solleciti della persona non sono sospesi, e quel
  momento non è già stato mandato (`chiave`).
- Mail per nucleo: lo stesso giorno, le persone dello stesso nucleo con un
  sollecito dovuto vanno in una mail sola. A: `email_contatto` del titolare, se no
  la sua email d'accesso. In copia la segreteria (`avvisi_indirizzi`) solo
  sull'ultimo momento, se `copia` è accesa.
- Un momento già passato quando la persona entra nel giro (es. termine corto) non
  si recupera: parte solo il primo momento non passato. Così una scheda vecchia
  non riceve tre mail insieme il giorno dell'aggiornamento.
- Senza indirizzo: il sollecito dovuto finisce in DA FARE come «da mandare a mano».
  Premendo WhatsApp si segna (`canale = 'whatsapp'`) e la riga sparisce.
- Il tetto di 50 mail al giorno di `avvisi-segreteria` vale per gli avvisi alla
  segreteria; i solleciti ne hanno uno loro (proposta: 100 al giorno), quelli in
  più ripartono il giorno dopo.

### Il link

- Una riga per persona in `link_certificato`. Il link è
  `…/certificato/?l=<id>.<firma>`, con `firma` = HMAC-SHA256 dell'`id` con un
  segreto della Edge Function (`LINK_SEGRETO`). Nel database c'è solo l'`id`: un
  backup o una lettura della tabella non danno link validi.
- Vale finché: la persona è attiva, il certificato non è stato confermato, e non
  è passato il tetto (`creato_il` + 120 giorni). Un sollecito dopo il tetto crea
  una riga nuova; la vecchia non vale più.
- Si può caricare più volte: ogni caricamento sostituisce il file in attesa, come
  fa già `iscritto_manda_certificato`. Dopo la conferma il link apre una pagina che
  dice «Il certificato è già arrivato, grazie».
- Il rifiuto della segreteria riapre il giro: i solleciti ripartono dal momento
  successivo, lo stesso link vale ancora.
- Apertura: si segna `aperto_il` (l'ultima), per lo storico.

### La pagina del link

- Area nuova `certificato` (come le altre di `src/lib/aree.ts`), senza login.
- Mostra: «Certificato medico di Marco R.» (nome e iniziale del cognome), il tipo
  richiesto (normale/agonistico), «entro il 12 dicembre». Nient'altro della scheda.
- Chiede: il file (foto o PDF, gli stessi tipi e limiti di oggi) e la data di
  scadenza scritta sul certificato (non nel passato, non oltre 3 anni, come
  `conferma_certificato_iscritto`).
- Dopo l'invio: «Ricevuto: la segreteria lo controlla. Non ti scriviamo più».
- Link non valido o scaduto: «Questo link non vale più: scrivi alla segreteria o
  passa in palestra», senza dire perché (non si conferma che la persona esiste).
- `noindex`, nessun dato nella cache del service worker.

### IMPOSTAZIONI

Riquadro «Certificato medico»:

- Giorni per portarlo (1–120, proposta 30).
- Solleciti per email: interruttore.
- Momenti: elenco di righe «N giorni prima / il giorno della scadenza / N giorni
  dopo», da −60 a +60, al massimo 6. Proposta iniziale: −7, 0, +7.
- Oggetto e testo, con segnaposto `{nome}` (le persone dell'elenco), `{entro}`,
  `{link}` (un link per persona, uno per riga). Anteprima sotto, con dati finti.
  Il testo non può contenere altri segnaposto; `{link}` è obbligatorio.
- Copia alla segreteria sull'ultimo sollecito: interruttore.

### Scheda dell'iscritto (segreteria)

- Riga certificato: «Da portare entro il 12/12/2026» (giallo) o «Doveva portarlo
  entro il 12/12/2026» (rosso).
- Tasto «Sospendi solleciti» / «Riattiva solleciti».
- Storico: «Sollecito per email il 5/12/2026 · link aperto il 6/12/2026»,
  «Sollecito su WhatsApp il … da Laura».

### I testi che cambiano

Da «portalo prima della prima lezione: senza non si partecipa» a qualcosa come
«Se non ce l'hai ancora, puoi iscriverti lo stesso: hai 30 giorni per caricarlo,
ti mandiamo un link per email». Punti: `FILE` e `avvisoCertificato` in
`richieste.ts`, `IscrizioneAPassi.tsx` (185, 734, 1255, 1389, 1414),
`ModuloIscrizione.tsx` (481). Il numero di giorni la pagina pubblica lo legge da
`iscrizioni_regole()` (anon non legge `impostazioni`).

## Il database (una migrazione, `141-certificato-dopo.sql`)

- `impostazioni`: `certificato_giorni int not null default 30 check (1..120)`,
  `solleciti_certificato boolean not null default false`,
  `solleciti_momenti int[] not null default '{-7,0,7}'` (check: da 1 a 6 valori,
  ognuno fra −60 e 60), `sollecito_oggetto text`, `sollecito_testo text` (check
  di lunghezza e `{link}` presente), `sollecito_copia boolean not null default true`.
  Accesi spenti di default: si accendono dopo aver controllato il testo.
- `richieste_iscrizione`: `certificato_dopo boolean not null default false`
  (scritto da `invia_iscrizione` dalla scelta del modulo).
- `schede_iscritti`: `certificato_entro date`, `solleciti_sospesi boolean not null
  default false`, `certificato_in_attesa_scade date` (la data scritta da chi carica,
  la segreteria la vede precompilata quando conferma).
- `accogli_iscrizione`: se `certificato_dopo` e serve il certificato, scrive
  `certificato_entro`. `conferma_certificato_iscritto` e `salva_certificato` lo
  azzerano.
- `solleciti`: `canale text not null default 'whatsapp' check in ('whatsapp',
  'email')`, `momento int`, `link_id uuid`. `creato_da` resta null per quelli
  automatici. `ultimi_solleciti` e `ultimo_sollecito` restano compatibili.
- `link_certificato (id uuid pk, persona_id uuid references persone on delete
  cascade, creato_il, aperto_il, chiuso_il)`: RLS accesa, nessun grant; la toccano
  solo funzioni `security definer` per `service_role`.
- `avvisi_segreteria`: nuovo `tipo = 'sollecito_certificato'`, `chiave =
  'cert:<persona>:<entro>:<momento>'` (una per persona e momento, così la mail di
  famiglia non blocca quella di un fratello con un altro termine), `dati` con le
  persone e i link_id. `avvisi_da_mandare()` li restituisce con `a` = famiglia.
- `solleciti_certificato_dovuti()` (service_role, chiamata da pg_cron una volta al
  giorno alle 9): scrive gli avvisi del giorno, rispettando il tetto.
- Funzioni per la Edge Function del link (service_role): `link_certificato_info(id)`
  → nome abbreviato, tipo, entro, valido; `link_certificato_aperto(id)`;
  `link_manda_certificato(id, file, scade)` → come `iscritto_manda_certificato`
  (file `attesa-N`, sostituisce il precedente) più la scadenza dichiarata.
- Funzioni per la segreteria (`e_staff()`): `sospendi_solleciti(persona, bool)`,
  `link_certificato_per(persona)` per il WhatsApp a mano.

## Le Edge Function

- `avvisi-segreteria`: il tipo nuovo in `mail.ts` (copia di
  `src/lib/avvisoSegreteria.ts`): testo dalle impostazioni, segnaposto sostituiti,
  link firmati con `LINK_SEGRETO`. Dopo l'invio segna i `solleciti` con canale
  `email`.
- `certificato` (nuova, `--no-verify-jwt`): `GET ?l=` → info per la pagina e
  `aperto_il`; `POST` multipart → controlla firma, tipo e dimensione del file,
  lo mette in `certificati/<persona>/attesa-N.ext` con service role, chiama
  `link_manda_certificato`. Firma controllata in tempo costante; al più 10
  richieste al minuto per link. Nei log mai id di persona né nomi.
- Per il WhatsApp a mano la segreteria chiede il link firmato a `certificato`
  con il suo JWT (`e_staff()`), così il segreto resta nella funzione.

## Sicurezza e privacy

- Il link è un accesso senza password a un dato sanitario: la pagina non mostra
  dati della scheda oltre a nome abbreviato e data, non mostra il file caricato,
  e il file entra solo come «in attesa».
- Il segreto della firma sta solo nella Edge Function; cambiarlo invalida tutti i
  link (si dice nel LEGGIMI).
- La mail contiene solo nomi, data e link: mai codice fiscale, nascita, patologie.
- Passa dall'agente `rls-reviewer` (skill `nuova-migrazione`).

## Le prove

- `supabase/prova`: termine scritto all'accoglimento solo con `certificato_dopo` e
  certificato che serve; azzerato alla conferma; solleciti dovuti (momenti, sospesi,
  da verificare, disattivati, momento passato non recuperato, chiave unica, tetto);
  mail di nucleo; link non valido dopo conferma, disattivazione, tetto; anon e
  authenticated non toccano `link_certificato` né le funzioni service_role.
- `scripts/prova-*.mjs`: `statoCertificato` con `atteso`; testo del sollecito coi
  segnaposto; validazione dei momenti; testi del modulo con i giorni.
- `docs/qa/percorsi-critici.md`: il percorso «certificato portato dopo».

## Il piano

Tre PR, una cosa ciascuna (skill `nuova-funzione`, prima il canvas di design):

1. **`Nuovo: ci si iscrive anche senza certificato, con un termine per portarlo`**
   Migrazione (impostazioni giorni, `certificato_dopo`, `certificato_entro`),
   scelta nel modulo e in «una persona in più», testi, stato `atteso`, riga nella
   scheda, caselle e DA FARE, giorni in IMPOSTAZIONI, guida.
2. **`Nuovo: il certificato si carica da un link, senza password`**
   `link_certificato`, Edge Function `certificato`, area `certificato`, WhatsApp a
   mano col link, storico con canale e apertura.
3. **`Nuovo: i solleciti per il certificato partono da soli per email`**
   Impostazioni dei solleciti, `solleciti_certificato_dovuti` con pg_cron, tipo
   nuovo in `avvisi-segreteria`, sospendi dalla scheda, «da mandare a mano» in DA
   FARE, guida.

## Da controllare prima di cominciare

- Cosa mostra oggi il tablet per un certificato mancante: l'avviso «dopo il
  termine» deve usare lo stesso segno.
- Che `iscrizioni_regole()` si possa estendere senza rompere la pagina pubblica
  pubblicata (è `immutable`: con un valore letto dalle impostazioni diventa `stable`).
