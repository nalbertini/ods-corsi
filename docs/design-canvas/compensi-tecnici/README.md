# Compensi dei tecnici · proposta

Lettera d'incarico una volta l'anno, ricevuta del compenso ogni mese dalle
lezioni confermate, pagamento che finisce in CONTABILITÀ. Le bozze di partenza
sono il Word della palestra (co.co.co sportiva) e l'autocertificazione mensile,
senza la riga del progetto «spazi civici / CUP».

| Tavola | Cosa mostra |
|---|---|
| `SchedaOggi` | La scheda di un istruttore com'è (`Personale.tsx`, `Scheda` in `SchedaPiena`) |
| `SchedaProposta` | La stessa con DATI PER LETTERA E RICEVUTE (anche IBAN), TARIFFE per corso, LETTERA D'INCARICO con «Firmata» e PRESENZE E COMPENSO (per corso, ricevuta del mese, ricevute dell'anno, preso da noi nell'anno per data di pagamento) |
| `PreparaLettera` | La finestra della lettera: periodo, qualifica, giorni, data; il compenso sono le tariffe orarie della scheda, in cifre e in lettere |
| `CompensiMese` | La pagina nuova COMPENSI (segreteria e amministrazione insieme): un tecnico per riga, aperta per corso, i filtri, il tasto che stampa le pronte e dice chi salta, e il pannello SEGNA PAGATO per una o più ricevute dello stesso tecnico |
| `CompensiMeseTelefono` | La stessa sul telefono |
| `FogliPdf` | I due PDF: in inchiostro quel che stampa l'app (anche IBAN, «Collegno» e la data di stampa), tratteggiato quel che si scrive a mano |

Decisioni dell'utente: tariffa a ora per tecnico e per corso, anche da
sostituto; la lettera ha solo le tariffe orarie, punti rinumerati; tutto lo fa
chi ha segreteria e amministrazione, e il pagamento si segna da COMPENSI;
bonifico o contanti, anche più mesi in un movimento; voce di sistema
«Compensi istruttori»; IBAN e province salvati e stampati; niente avvisi sulle
soglie, solo il totale dell'anno per cassa; spunta «Firmata» per lettera e
ricevute. I rimborsi spese sono fuori. Componenti nuovi della libreria:
`RigaCompenso`, e la prop `compensi` di `Menu` (voce COMPENSI in ISTRUTTORI).
