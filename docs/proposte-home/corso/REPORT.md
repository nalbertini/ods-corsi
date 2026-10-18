# Pagina del corso: audit, foto, testi, mockup

Solo proposta, 18 ottobre 2026. Niente toccato in `src/`, `supabase/`, sul sito vero o sul database; niente commit, PR o upload su Supabase. Stesso metodo della home (`../audit`, `../foto`, `../testi`, `../../design-canvas/home-miglioramenti`).

| Cosa | Dove |
|---|---|
| Audit visivo (Judo, Lotta, Aikido, Pre pugilistica a 1440/768/375; 14 problemi C1…C14) | [`audit/REPORT.md`](audit/REPORT.md), screenshot in `audit/img/`, script `audit/misura.mjs` |
| Foto: ruoli A/B/C e fuochi per riquadro; libreria cercata per i sei corsi senza foto scelta; 13 copie sviluppate con LightCraft, confronto PhotoCraft | [`foto/REPORT.md`](foto/REPORT.md), `foto/approvate/` (21 file), `sviluppa.sh`, `sviluppo.txt`, `photocraft.py`, `confronto-1…3.png` |
| Testi: struttura comune (7 blocchi), lunghezze prima/dopo, 14 domande Q1…Q14 (Q1, Q2, Q13 chiuse dall'utente) | [`testi/REPORT.md`](testi/REPORT.md) (generato da `testi/genera.py`) |
| Mockup: 4 tavole proposta + 4 «com'è oggi», Judo e Pre pugilistica (senza foto), desktop e telefono | `../../design-canvas/corso-miglioramenti/` (README, `rendi.mjs`, `anteprima-*.html`, `shot/`); 4 componenti nuovi nella libreria (`SitoCorsoTitolo`, `SitoOrarioGruppo`, `SitoCorsoFascia`, `SitoCorsoCta`) |

## Risultati in breve

- **Audit.** Alta: la foto di testata è una verticale tagliata a 1344×619 e ingrandita del 15 % (Judo, Lotta); Pre pugilistica e Autodifesa mostrano gli istruttori di judo; la chiusura «PROVA» a 200 px non ha verbo né prezzo. Il resto: 7 titoli alti uguali, orari a 5 schermate dai dati, tessere col buco in mezzo, bersagli 20-38 px.
- **Foto.** Judo 690/164/26, Lotta 418/394/546, Aikido 949/974/874 come foto di pagina (apertura/interno/chiusura). Per gli altri sei: nella cartella «2025 2 febbraio 20 officine» (mai usata) ci sono foto di sala pesi con adulti; Preparazione atletica e Sollevamento pesi hanno tre e due foto, Giocomotricità e Avviamento ne hanno ma da premiazione/foto morbide; **Pre pugilistica e Autodifesa nessuna**.
- **Testi.** «Cosa si fa» da 21-77 parole a 21-41, «A chi è rivolto» 7-23; nuovo blocco «Come provare» (dalla chiusura della home); nessun fatto nuovo salvo le descrizioni (Q11).
- **Mockup.** Judo 1440: 5655 → 4621 px (−18 %); telefono 6237 → 6739 (+8 %). `verifica.mjs`: «tutto in regola».

## Decisioni dell'utente applicate (18/10)

Pulsanti: «Prova una settimana a 5 €» → modulo online, «Scrivici» → Contatti (cartellino D9/Q1 tolto). Liberatorie per tutte le foto (cartellini tolti). Prova a 5 € per tutte le età dai 3 anni, solo la settimana, nessuna lezione singola. Pre pugilistica e Autodifesa senza foto, versione con fascia blu. Q1, Q2, Q13 chiuse.

## Revisione del design reviewer e correzioni

Il subagent `design-reviewer-ods` non è registrato in questa sessione (file `.claude/agents/` non tracciato): la revisione l'ha fatta un subagent generico che ha letto `design-reviewer-ods.md` e ne ha applicato criteri e formato. Verdetto: audit approvato; foto e canvas «approvati con riserve».

| Voce | Esito |
|---|---|
| **BLOCCA** GPS nel file di `preparazione-atletica-A` (iPhone) | Corretto: `--opt metadata=none` in `sviluppa.sh`, tutte le foto rifatte; verificato che nessun JPEG di `approvate/`, `migliorate/`, `originali/`, `photocraft/`, `img/` e `alternative/` ha il blocco GPS |
| **BLOCCA** minori senza cartellino in Judo B | Superato dalla decisione dell'utente: liberatorie per tutte le foto, cartellino tolto |
| **BLOCCA** fuochi che tagliano un volto (Giocomotricità B, Avviamento B) | Corretto: Giocomotricità senza foto B (resta A e C); Avviamento B a `92% 50%` (desktop) e `90% 50%` (telefono) |
| DA FARE Aikido A con alone | Era nel file della macchina (sfocatura da ritratto), non nello sviluppo: rifatta con sviluppo più leggero, dichiarato |
| DA FARE foto morbide (Avviamento A/B, Pesi A) | Pesi: apertura = DSC_0066 (a fuoco), DSC_0061 in riserva; Avviamento A/B restano ma dichiarate deboli |
| DA FARE Giocomotricità da premiazione | Dichiarato; domanda Q14 |
| DA FARE `senzaFoto` con metà vuota | Corretto: testo a sinistra, pulsanti a destra in basso. Nota: `SitoCta` è condivisa con altre sessioni che la riscrivono; la variante vive ora in `SitoCorsoCta` |
| DA FARE telefono lungo e con vuoti | Corretto in parte: tessere della storia alte quanto il testo (6935 → 6739 px); resta più lungo di oggi (+8 %), domanda 3 del README |
| DA FARE «nessun fatto nuovo» non vero | Corretto: eccezione dichiarata, Pre pugilistica aggiunta a Q11, cartellino Q11 sulla testata |
| DA FARE «Tolto» di Judo sbagliato | Corretto: «confrontarsi con gli altri» rientra nel testo, esce «coordinazione, forza e attenzione» (dichiarato) |
| DA FARE Prep. atletica A a 7 px dai capelli | Corretto: `50% 60%` |
| DA FARE Menu a 375 senza «Prova» fisso | Dichiarato come scelta nel README del canvas |
| SUGGERIMENTI 13-18 | 15 e 18 recepiti (nota su `srcset`/`lazy`, frase sulle foto Facebook); 13 (regola sulla lunghezza del nome), 14 («Prova» corto in testata), 16 (equilibrio dei box), 17: non fatti, da decidere |

## Cose che non ho potuto fare

- Nessuna tavola Lotta o Aikido, né 768 px; Pre pugilistica e Judo bastano per i due casi (con foto, senza foto).
- Foto dell'anteprima `file://`: le foto nel riquadro le ho viste da `shot/`.
- Id di libreria dei file nuovi: l'app su 127.0.0.1:7980 non rispondeva (troppe connessioni); i sorgenti sono letti da disco, gli id noti sono quelli di `docs/sito/foto.md`.
- Liberatorie e consensi: segnalati foto per foto, nessuna decisione.
