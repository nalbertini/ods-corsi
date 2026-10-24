# Pagina del corso: testi rivisti

Fonte: i nove sorgenti `docs/sito/<corso>.html` (testo da incollare nel pannello SITO), `corso.md` (regole del template), le pagine online lette il 18 ottobre 2026 e `../../testi/REPORT.md` (home) per le descrizioni.
Solo proposta: niente scritto su database o sito. Dove un dato manca c'è **[DA CONFERMARE]** e la domanda è in fondo (Q1…). **Nessun fatto nuovo, con una eccezione dichiarata**: le descrizioni di Judo, Lotta, Aikido, Avviamento e Pre pugilistica sono ritoccate (non solo accorciate) e vanno confermate (**Q11**); ogni altra frase viene da un testo già pubblicato. Dove ho accorciato, nella riga «Tolto» c'è quel che esce, da far rileggere.

## La struttura comune (uguale per i nove corsi)

Oggi la pagina ha: foto, 4 dati, 3 tessere («Cos’è», «Cosa si fa», «Per chi è pensato»), orari, «Cosa può aspettarsi…» (3-4 tessere con titoli fino a 10 parole), «Perché sceglierlo». Le tre domande di un genitore (a chi è rivolto, cosa si fa, come provo) sono sparse: **come provare non c'è**, e il pulsante in testata è l'unico invito fino alla chiusura «PROVA».

| # | Blocco | Contenuto | Foto | Perché |
|---|---|---|---|---|
| 1 | **Testata** | titolo (nome del corso), descrizione di 12-14 parole, pulsante «Prova una settimana a 5 €» | A · apertura | il verbo e il prezzo dall'inizio |
| 2 | **In breve** | 4 tessere: Per chi · Quando (solo i giorni) · Dove · Per iniziare, ≤ 12 parole | | resta com'è: è la parte che funziona |
| 3 | **Orario** | una tessera per gruppo: nome · ora · giorni · anni di nascita | | l'ora è la seconda domanda; oggi sta 5 schermate sotto |
| 4 | **Cosa si fa** | una tessera larga (20-40 parole): cos'è + cosa si fa | B · interno, accanto al testo | tre tessere con 9-39 parole l'una diventano una |
| 5 | **A chi è rivolto** | una tessera (7-25 parole) con età e livello | | l'età è dove i genitori cercano il «posso portare mio figlio?» |
| 6 | **Cosa aspettarsi** | 3-4 tessere, titolo ≤ 5 parole, testo invariato | | titoli da 9 parole in 2-3 righe a 46 px oggi |
| 7 | **Come provare** | «Una settimana per scegliere.» + frase del corso + 2 pulsanti: «Prova una settimana a 5 €» (modulo online) e «Scrivici» (pagina Contatti) | C · chiusura | la chiamata finale della home, con la frase «Perché sceglierlo» del corso sotto il titolo |

Blocchi **solo di un corso**: «La storia» (Judo, Aikido e Lotta, dopo «A chi è rivolto»). I sorgenti la segnalano già come testo da far rileggere.

Cosa **non** c'è e si può solo chiedere (vedi domande): quota mensile o annuale, certificato medico, cosa portare la prima volta, il nome di chi insegna.

### «Come provare»: cosa dice, e da dove viene

> **Una settimana per scegliere.**
> <frase «Perché sceglierlo» del corso>
> 1 settimana di prova a 5 euro, per tutte le età dai 3 anni: solo la settimana, nessuna lezione singola. Scrivici sui nostri canali social o passa in sede, in via Sassi 26 a Collegno, vicino alla metro Fermi.
> [Prova una settimana a 5 €] [Scrivici]

Le tre frasi vengono dalla home (titolo della chiamata finale: `../../testi/REPORT.md` §8), dalle tessere «Per iniziare» e «Dove» delle pagine, dalle FAQ («Come mi iscrivo?») e dalle decisioni qui sotto. **Decisioni dell'utente**: il primo pulsante porta al modulo online (app.officinedellosport.it/iscrizioni), «Scrivici» alla pagina Contatti; la prova è di una settimana a 5 €, per tutte le età dai 3 anni, nessuna lezione singola; «vicino alla metro Fermi» è confermata, senza minuti.


## Lunghezze: prima e dopo

Parole per tessera. «Cosa si fa» = «Cos’è il corso» + «Cosa si fa durante le lezioni» uniti. Contate con lo script `genera.py` (spazio = separatore; i segnaposto [DA CONFERMARE] non contano).

| Corso | Cos’è + Cosa si fa (prima → dopo) | A chi è rivolto (prima → dopo) | Descrizione (parole) | Tessere «Cosa aspettarsi» |
|---|---|---|---|---|
| Judo | 55 → **41** | 13 → **13** | 14 | 4 |
| Lotta | 36 → **33** | 12 → **12** | 12 | 4 |
| Aikido | 23 → **23** | 10 → **10** | 14 | 3 |
| Pre pugilistica | 54 → **35** | 22 → **23** | 13 | 4 |
| Metodo Globale di Autodifesa | 21 → **21** | 10 → **10** | 12 | 3 |
| Preparazione atletica | 22 → **22** | 13 → **13** | 13 | 3 |
| Giocomotricità e psicomotricità | 71 → **36** | 35 → **21** | 12 | 4 |
| Avviamento alle arti marziali | 77 → **39** | 21 → **21** | 14 | 4 |
| Sollevamento pesi | 25 → **25** | 7 → **7** | 13 | 3 |

Prima: «Cos’è + Cosa si fa» da **21 a 77** parole (3,7 volte tra la più corta e la più lunga) e «Per chi è pensato» da 7 a 35. Dopo: **21-41** e **7-23**; i casi lunghi (Avviamento 77, Giocomotricità 71, Judo 55, Pre pugilistica 54) scendono a 35-41; le pagine corte restano corte perché non si inventano fatti: la domanda è in fondo.

## Judo

- **Descrizione** (14): Tecnica, disciplina e rispetto per crescere sul tatami, dai primi passi fino alle gare.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Lunedì, mercoledì e venerdì; martedì e giovedì per gli agonisti»
- **Cosa si fa** (41): Un percorso educativo e sportivo che unisce tecnica, disciplina e relazione, per conoscere il proprio corpo e confrontarsi con gli altri in modo costruttivo. Si lavora su movimenti, cadute, prese e controllo del corpo, con esercizi adattati all’età e al livello.
- **A chi è rivolto** (13): Per bambini, ragazzi e adulti, sia principianti sia agonisti, divisi in gruppi omogenei.
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Ambiente educativo e regolato (4) (invariato)
  - Istruttori esperti e presenti (4) (invariato)
  - Percorsi progressivi e sicuri (4) (invariato)
  - Crescita personale, non solo sportiva (5) ← era «Attenzione alla crescita personale, non solo sportiva» (7)
- **Frase del «Perché sceglierlo»** (74 caratteri) → va sotto il titolo della chiamata finale: Per imparare rispetto, autocontrollo e fiducia, dentro e fuori dal tatami.
- **Tolto** (da far rileggere): «Le lezioni sono strutturate per sviluppare coordinazione, forza e attenzione» (il fatto che si lavori su coordinazione, forza e attenzione esce: da far rileggere a chi insegna); «il judo insegna a…» è stato fuso nella prima frase.

## Lotta

- **Descrizione** (12): Gioco, movimento e rispetto per crescere insieme, dalla prima prova alla gara.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Lunedì, mercoledì e venerdì; il martedì allenamento di preparazione atletica e pesistica»
- **Cosa si fa** (33): Uno sport completo che sviluppa forza, tecnica e strategia, basato sul confronto fisico controllato e guidato. Allenamenti che combinano esercizi tecnici, preparazione fisica e lavoro sul corpo a corpo, adattati all’età e all’esperienza.
- **A chi è rivolto** (12): Per bambini, ragazzi e adulti, in gruppi divisi per anno di nascita.
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Regole chiare e sicurezza (4) (invariato)
  - Allenamenti supervisionati (2) (invariato)
  - Controllo e tecnica (3) ← era «Attenzione al controllo e alla tecnica» (6)
  - Ambiente educativo e sportivo (4) ← era «Un ambiente educativo e sportivo» (5)
- **Frase del «Perché sceglierlo»** (65 caratteri) → va sotto il titolo della chiamata finale: Per crescere forti, consapevoli e capaci di gestire il confronto.
- **Tolto** (da far rileggere): Niente.

## Aikido

- **Descrizione** (14): Armonia, equilibrio e difesa, in una disciplina adatta anche a chi ha più anni.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Lunedì e giovedì»
- **Cosa si fa** (23): Un’arte marziale basata sull’armonia del movimento e sulla gestione dell’energia. Si lavora su posture, spostamenti, tecniche fluide e coordinazione, migliorando equilibrio e concentrazione.
- **A chi è rivolto** (10): Per ragazzi e adulti che cercano un’attività marziale non competitiva. [DA CONFERMARE Q8: la tessera dice «dai 7 anni»]
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Ritmi progressivi (2) (invariato)
  - Clima calmo e concentrato (4) (invariato)
  - Postura e controllo (3) ← era «Attenzione alla postura e al controllo» (6)
- **Frase del «Perché sceglierlo»** (62 caratteri) → va sotto il titolo della chiamata finale: Per migliorare corpo e mente attraverso movimenti consapevoli.
- **Tolto** (da far rileggere): Niente.

## Pre pugilistica

- **Descrizione** (13): Primi passi nella boxe: tecnica e coordinazione, per imparare i colpi in sicurezza.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Mercoledì, dalle 19:00 alle 20:00»
- **Cosa si fa** (35): Un percorso propedeutico alla boxe che introduce ai fondamentali in un ambiente sicuro e strutturato, per sviluppare coordinazione, reattività e disciplina. Si lavora su schemi motori, guardia, spostamenti e colpi base, con carichi calibrati sull’età.
- **A chi è rivolto** (23): Per ragazzi e ragazze nati dal 2015 in poi, che vogliono avvicinarsi alla boxe partendo dalle basi, in un gruppo omogeneo per età.
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Sicuro, senza contatto pieno (4) ← era «Approccio propedeutico e sicuro, senza contatto pieno» (7)
  - Istruttori qualificati nella boxe giovanile (5) (invariato)
  - Percorso graduale (2) ← era «Percorso graduale verso le discipline pugilistiche» (6)
  - Crescita fisica e mentale (4) ← era «Attenzione allo sviluppo fisico e mentale, non solo tecnico» (9)
- **Frase del «Perché sceglierlo»** (104 caratteri) → va sotto il titolo della chiamata finale: Per scoprire la boxe nel modo giusto: disciplina, controllo e rispetto, prima ancora della tecnica pura.
- **Tolto** (da far rileggere): «preparando fisico e mente al lavoro sul ring» e «alternano condizionamento fisico e tecnica» (stessa idea in «Crescita fisica e mentale»). Refuso corretto: «dai 2015» → «nati dal 2015».

## Metodo Globale di Autodifesa

- **Descrizione** (12): Autodifesa pratica e realistica, basata su situazioni reali, spiegata passo dopo passo.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Venerdì, dalle 19:00 alle 20:00»
- **Cosa si fa** (21): Un sistema di autodifesa pratico e realistico, basato su situazioni reali. Tecniche semplici, lavoro sulla consapevolezza e sulla gestione dello stress.
- **A chi è rivolto** (10): Per adulti che vogliono sentirsi più sicuri nella vita quotidiana. [DA CONFERMARE Q6: l’orario dice «da 2015 in poi»]
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Approccio progressivo (2) (invariato)
  - Ambiente rispettoso (2) (invariato)
  - Nessuna esperienza richiesta (3) (invariato)
- **Frase del «Perché sceglierlo»** (53 caratteri) → va sotto il titolo della chiamata finale: Per acquisire sicurezza e lucidità, non aggressività.
- **Tolto** (da far rileggere): Niente.

## Preparazione atletica

- **Descrizione** (13): Allenamenti mirati per migliorare forza, resistenza, velocità e coordinazione, anche per chi gareggia.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Martedì e giovedì»
- **Cosa si fa** (22): Allenamenti mirati per migliorare forza, resistenza, velocità e coordinazione. Esercizi funzionali, lavoro a corpo libero e con attrezzi, adattati agli obiettivi individuali.
- **A chi è rivolto** (13): Per ragazzi e adulti, sportivi e non, come percorso autonomo o di supporto.
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Programmi strutturati (2) (invariato)
  - Progressioni controllate (2) (invariato)
  - Attenzione alla corretta esecuzione (4) (invariato)
- **Frase del «Perché sceglierlo»** (53 caratteri) → va sotto il titolo della chiamata finale: Per allenarsi in modo efficace, sicuro e consapevole.
- **Tolto** (da far rileggere): Niente.

## Giocomotricità e psicomotricità

- **Descrizione** (12): Percorsi motori per crescere giocando e migliorare coordinazione e fiducia in sé.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Martedì e giovedì (giocomotricità), venerdì (psicomotricità)»
- **Cosa si fa** (36): Un percorso per accompagnare i bambini nello sviluppo motorio ed emotivo, con attività guidate che uniscono gioco, movimento e relazione. I bambini corrono, saltano, rotolano e interagiscono con gli altri, in un clima sereno e stimolante.
- **A chi è rivolto** (21): Per bambini in età prescolare [DA CONFERMARE Q7: 3-5 anni o fino ai primi anni della primaria?], sia alla prima esperienza di movimento sia bisognosi di rinforzare sicurezza e consapevolezza del corpo.
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Un ambiente accogliente e protetto (5) (invariato)
  - Istruttori attenti a ogni bambino (5) ← era «Istruttori qualificati e attenti ai singoli bambini» (7)
  - Attività strutturate ma mai competitive (5) (invariato)
  - Si cresce giocando (3) ← era «Un percorso che valorizza il gioco come strumento di crescita» (10)
- **Frase del «Perché sceglierlo»** (109 caratteri) → va sotto il titolo della chiamata finale: Qui il movimento non è prestazione, ma esperienza: un primo passo nello sport che mette al centro il bambino.
- **Tolto** (da far rileggere): «nel rispetto dei tempi di crescita di ciascuno» (c’è già in «Istruttori attenti»: «ogni bambino ha i suoi tempi»); «orientarsi nello spazio… migliorare coordinazione, equilibrio, percezione del corpo e attenzione» (restano coordinazione ed equilibrio nella descrizione).

## Avviamento alle arti marziali

- **Descrizione** (14): Si scoprono le discipline, per aiutare i più piccoli a trovare la propria strada.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Martedì e giovedì, dalle 17:00 alle 18:00»
- **Cosa si fa** (39): Un percorso introduttivo per i più piccoli: gioco e movimento per avvicinarsi alle arti marziali, senza legarsi a una disciplina. Si alternano esercizi di base delle diverse discipline, giochi di equilibrio e coordinazione e prime forme di contatto controllato.
- **A chi è rivolto** (21): Per bambini e bambine nati tra il 2020 e il 2021, alle prime esperienze sportive, in un gruppo omogeneo per età.
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Giocoso, sicuro, su misura (4) ← era «Un ambiente giocoso, sicuro e su misura per l’età» (9)
  - Istruttori che osservano ogni bambino (5) ← era «Istruttori che osservano attitudini e inclinazioni di ogni bambino» (9)
  - Aiuta a scegliere la disciplina (5) ← era «Un percorso che aiuta a scegliere la disciplina successiva» (9)
  - Sviluppo, non prestazione (3) ← era «Attenzione allo sviluppo motorio e sociale, non alla prestazione» (9)
- **Frase del «Perché sceglierlo»** (114 caratteri) → va sotto il titolo della chiamata finale: Per scoprire, provando, quale arte marziale appassiona davvero il proprio bambino, prima di scegliere un percorso.
- **Tolto** (da far rileggere): «L’obiettivo è far provare approcci diversi, in modo ludico e sicuro, prima di scegliere un percorso specifico» (già in «Aiuta a scegliere la disciplina» e nella frase finale).

## Sollevamento pesi

- **Descrizione** (13): Un percorso per imparare e perfezionare il sollevamento pesi, dai ragazzi agli adulti.
- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «Dal lunedì al venerdì, secondo il gruppo»
- **Cosa si fa** (25): Un percorso dedicato all’apprendimento e al perfezionamento della tecnica di sollevamento. Si lavora sulla corretta esecuzione dei gesti, sulla forza e sulla consapevolezza del corpo.
- **A chi è rivolto** (7): Per ragazzi e adulti, principianti o avanzati.
- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):
  - Supervisione costante (2) (invariato)
  - Attenzione alla tecnica (3) (invariato)
  - Progressioni sicure (2) (invariato)
- **Frase del «Perché sceglierlo»** (44 caratteri) → va sotto il titolo della chiamata finale: Per costruire forza partendo da basi solide.
- **Tolto** (da far rileggere): Niente.

## Domande aperte (numeri Q)

Sulle tavole sono i cartellini rossi **DA CONFERMARE Qn** (solo per le aperte). Liberatorie: l'utente le ha per tutte le foto proposte.

1. **Q1. CHIUSA** (D9): «Prova una settimana a 5 €» porta al modulo online (app.officinedellosport.it/iscrizioni), «Scrivici» alla pagina Contatti.
2. **Q2. CHIUSA** (D12): la prova a 5 € vale per tutte le età (dai 3 anni), è solo la settimana, nessuna lezione singola. Resta da dire se vale per tutte le discipline.
3. **Q3.** Quota mensile/annuale: va nella pagina? Oggi l'unico prezzo è «5 euro» della prova; la tessera «Per iniziare» non dice cosa succede dopo.
4. **Q4.** Certificato medico e cosa portare la prima volta (kimono, scarpe, borraccia…): lo scriviamo in «Come provare»? Non c'è in nessun testo di oggi, quindi non l'ho scritto.
5. **Q5.** Chi insegna: nome e cognome degli istruttori del corso, con link alla pagina Istruttori? Nelle pagine oggi non compare nessun nome.
6. **Q6.** Autodifesa: la tessera dice «Adulti», l'orario «da 2015 in poi» (ragazzi). Quali sono le età giuste?
7. **Q7.** Giocomotricità: la tessera dice «3-5 anni», il testo «età prescolare e primi anni della primaria», l'orario «nati 2023-2022» (3-4 anni). Quale vale? Avviamento: «5-6 anni, nati 2020 e 2021» è giusto per la stagione in corso?
8. **Q8.** Aikido: «Per ragazzi e adulti» (testo) o «dai 7 anni» (tessera)? Sono la stessa cosa?
9. **Q9.** Le età sull'anno 2026 («7-9 anni · nati 2019-2017») invecchiano ogni settembre: mostrare solo gli anni di nascita?
10. **Q10.** Judo agonisti: «judo 3 / adulti» vuol dire che si entra da Judo 3 in su? Va scritto per esteso.
11. **Q11.** Descrizioni di Judo, Lotta, Aikido, Avviamento e Pre pugilistica: «fino alle gare», «dalla prima prova alla gara», «adatta anche a chi ha più anni» sono dedotte dai tag della home (testi/REPORT §3), non dai sorgenti della pagina; Pre pugilistica passa da «per muovere i primi colpi» a «per imparare i colpi»: vanno bene?
12. **Q12.** Le frasi nuove sotto «Cosa aspettarsi» (già segnalate in `docs/sito/judo.md`, e nelle altre pagine) e le storie di Judo, Aikido e Lotta restano da far rileggere a chi insegna.
13. **Q13. CHIUSA**: Pre pugilistica e Autodifesa restano senza foto per ora, con la fascia blu; nessuna foto presa da altri corsi.
14. **Q14.** Giocomotricità: le foto trovate (Cup 23/03/2025) sono bambini con la medaglia di 5-7 anni circa, il corso è 3-5: c'è una foto di una lezione vera?

