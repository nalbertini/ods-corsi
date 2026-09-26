# ODS Timer

Interval timer di **Officine Dello Sport** — Collegno (TO).

Una sola applicazione per telefono, tablet e web: è una PWA, quindi si installa
dal browser («Aggiungi alla schermata Home») e da quel momento funziona anche
senza rete, senza passare da App Store o Play Store.

## Schemi di allenamento

| Schema | Come funziona | Parametri |
| --- | --- | --- |
| **Intervalli** | Lavoro e recupero che si alternano (Tabata, HIIT…) | preparazione, lavoro, recupero, round, serie, riposo serie, defaticamento |
| **Circuito** | Stazioni in sequenza, ognuna con la sua durata, ripetute a giri | preparazione, recupero, giri, serie, riposo serie + durata per stazione |
| **EMOM** | Un esercizio all'inizio di ogni slot: quel che avanza è recupero | preparazione, durata slot, numero di slot, serie |
| **AMRAP** | Un solo conto alla rovescia, più giri possibili nel tempo dato | preparazione, durata, serie |
| **For Time** | Cronometro che sale, con un tempo limite oltre cui si ferma | preparazione, tempo limite |

Ogni schema accetta una lista di esercizi: nei circuiti sono le stazioni, negli
altri i nomi si alternano a ogni round e vengono annunciati dalla voce.

## Durante l'allenamento

- **I colori del marchio sono gli stati**: giallo preparati, rosso lavoro, verde
  recupero, blu riposo tra le serie. Il bordo dello schermo prende il colore
  dello stato, così si legge da tutta la sala senza mettere a fuoco i numeri.
- Tre bip sugli ultimi 3 secondi, tono diverso all'inizio di lavoro e recupero,
  voce italiana che annuncia stato ed esercizio, vibrazione sul telefono.
- Lo schermo resta acceso (Wake Lock) e si riaggancia da solo al rientro.
- Da tastiera: `spazio` pausa, `←` `→` intervallo precedente e successivo,
  `Esc` esce.
- Il tempo è ricavato dall'orologio a ogni tick, non accumulato: un tab in
  background messo in pausa dal sistema si riallinea da solo invece di restare
  indietro.

I timer, le impostazioni e lo storico stanno nel browser del dispositivo
(`localStorage`), senza account e senza server.

Il tasto **SALA** riporta al tablet di sala di ODS Corsi
([nalbertini/ods-corsi](https://github.com/nalbertini/ods-corsi)), il calendario
e l'appello: è un'app a sé, che sul tablet ha il tasto TIMER. È grosso come i
tasti del tablet: in fondo alla barra laterale, in alto sui tablet in verticale,
nella barra in basso sui telefoni. Apre la radice di ODS Corsi, che su un tablet
di sala riapre il tablet della sua sala.

Il **tema** è nero o bianco, e lo stesso di ODS Corsi: le due app stanno sullo
stesso dominio e usano la stessa chiave (`ods-tema`), quindi scelto in una vale
anche nell'altra. Si sceglie da Impostazioni; finché nessuno sceglie, segue il
dispositivo.

## La libreria di esercizi

`src/lib/esercizi.ts` tiene un catalogo di 52 esercizi di partenza, pensati per
una palestra di judo e divisi in sei categorie: judo, a corpo libero, attrezzi,
core, cardio, mobilità. Sta in `localStorage` come i timer, quindi si cura
liberamente: quelli aggiunti a mano si possono togliere, quelli di partenza no.

Nell'editor, «aggiungi esercizio» apre il catalogo: si cerca (senza badare ad
accenti e maiuscole), si filtra per categoria, si scelgono più esercizi in un
colpo solo — un circuito si costruisce in blocco — e se un nome non c'è lo si
crea scrivendolo, così il catalogo non diventa mai una gabbia.

Il motivo vero per cui esiste, però, è un altro: la clip della voce di un
esercizio si chiama come il suo nome (`esercizi/<nome>.mp3`). Finché i nomi si
scrivevano a mano erano infiniti e non si potevano incidere; con un catalogo
diventano un elenco finito, e il timer può arrivare ad annunciare anche gli
esercizi.

## Modalità Maurizio

Come l'allenatore che «perde il conto» per farti lavorare qualche secondo in
più. **Attiva di partenza** al livello *classico*; gli altri due sono
**distratto** e **spietato**, e da Impostazioni si può spegnere.

All'avvio, per ogni intervallo di lavoro, si genera la **sequenza completa dei
numeri da mostrare**, un elemento per secondo. Le esitazioni cadono in punti a
caso e sono di due tipi: si inceppa su un numero, oppure torna indietro e
riscende — «dodici… tredici? dodici… undici». La durata dell'intervallo è
semplicemente la lunghezza della sequenza, quindi offset, barra di avanzamento
e durata totale restano coerenti e il motore del timer non sa nulla della cosa.

Generare la sequenza invece di applicare una formula è ciò che rende la gag
imprevedibile: il punto cambia ogni volta, il numero di esitazioni pure, e su
mille intervalli le sequenze osservate sono quasi tutte diverse fra loro. Il
recupero non si tocca mai: quando sei fermo Maurizio conta benissimo.

Due vincoli, entrambi per non sembrare un difetto invece di uno scherzo:
lo stesso numero non resta fermo più di due secondi, e bip e voce seguono il
numero **mostrato**, non quello vero, altrimenti tradirebbero il trucco un
attimo prima che si veda.

Quanto succede, per livello:

| Livello | Intervalli toccati | Secondi in più, quando succede |
| --- | --- | --- |
| Distratto | ~30% | ~1,7" |
| Classico | ~55% | ~3,3" |
| Spietato | ~85% | ~5,2" |

### Le illustrazioni

Quando Maurizio si tradisce, al centro dello schermo compaiono per qualche
secondo un'illustrazione e la frase che gli sta scappando. Lo sfondo si scurisce
ma non si annulla: dietro deve restare leggibile il numero che sta tornando
indietro, che è poi il senso della gag. Un'altra illustrazione chiude
l'allenamento. Stanno in `public/adesivi/` e sono
**fuori dalla precache**: mezzo mega non va scaricato da chi la modalità non la
usa. Alla prima richiesta entrano nella cache di runtime e da lì funzionano
anche offline.

## La voce

L'app usa la sintesi vocale del dispositivo (`speechSynthesis`): le voci le
mette il sistema operativo, non l'app, e cambiano fra telefono, tablet e
computer.

In Impostazioni › Voce c'è l'elenco delle voci italiane disponibili, ordinate
dalla più naturale alla più sintetica, ognuna con un tasto di prova. Il
criterio: premia le versioni *enhanced*, *premium* e *neural* e quelle servite
dalla rete, penalizza le *compact* installate di serie — che sono quelle che
suonano metalliche, ed erano quelle che l'app pescava prima.

Su iPhone e iPad le voci di qualità vanno scaricate una volta da
Impostazioni › Accessibilità › Contenuto letto › Voci.

Due difese contro un difetto noto di `speechSynthesis`: `cancel()` viene
chiamato solo se c'è davvero qualcosa da fermare — a vuoto, seguito subito da
`speak()`, su Safari e su alcune build Android fa pronunciare la frase due volte
— e una stessa frase ripetuta entro un secondo viene scartata, perché non è mai
voluta.

### Voce incisa

Per una voce davvero umana l'app preferisce, quando ci sono, delle **frasi
registrate**. L'elenco è chiuso e corto — gli stati, i numeri da 3 a 1, le
battute di Maurizio — più, facoltativi, i nomi degli esercizi.

L'ordine è: registrazione fatta su quel dispositivo → file pubblicato in
`public/voce/` → sintesi vocale. Quindi si può incidere un pezzo per volta, e
dove manca la clip il timer torna da solo alla voce di sistema senza che nessuno
debba configurare niente.

In `public/voce/` ci sono **15 clip**: il saluto iniziale, cinque stati, i tre
numeri e le sei battute di Maurizio. «Preparati» non c'è e non serve: quel
momento è del saluto, e se il saluto non è ancora pronto resta silenzio invece
di una voce sintetica.

Il saluto (`stato/intro`) si sente una volta sola, all'avvio, e **prende il
posto** di «preparati» invece di precederlo: dice già lui che si comincia, e
incatenati i due sforavano nel conto alla rovescia, che li tagliava. Vale
comunque la regola della sintesi — l'ultimo annuncio vince e taglia quello
prima, invece di accavallarsi — quando la preparazione è corta o si salta
subito al lavoro.

**Un annuncio non aspetta mai la rete.** Usa la clip solo se è già decodificata
in memoria; altrimenti parla la sintesi, subito. Aspettare il download
significa che l'annuncio arriva quando il momento è passato, e se ne accumulano
diversi escono tutti insieme appena la rete consegna. Per questo le clip si
scaldano all'apertura dell'**app**, non del timer: il tempo utile è quello in
cui si sceglie l'allenamento, non il mezzo secondo fra «apri» e «avvia».

In riproduzione il silenzio iniziale di ogni clip viene saltato. Le
registrazioni ne hanno quantità diverse — fra i tre numeri si andava da 0,02 a
0,22 secondi — e in un conto alla rovescia si sentiva: «tre» sul tempo e «due»
un quinto di secondo dopo. L'attacco si calcola una volta sola alla
decodifica, quindi vale anche per le clip che aggiungerai, e i file non
vengono toccati.

**Impostazioni › Voce incisa › Incidi la voce** apre un registratore: ogni frase
ha REGISTRA / FERMA, si riascolta e si rifà. Le clip restano su quel dispositivo
e si sentono subito — si può incidere sul tablet in sala e sentirlo funzionare
all'istante. Il tasto ESPORTA scarica uno zip da scompattare in `public/voce/`
per darle a tutta la palestra; dentro c'è anche l'`index.json` che l'app usa per
sapere cosa esiste senza tentare richieste a vuoto.

Le clip non stanno nella precache: entrano nella cache di runtime alla prima
richiesta e da lì valgono anche senza rete. Chi tiene la voce spenta non se le
scarica, e alla primissima apertura offline si ricade sulla sintesi.

Il dettaglio di nomi, formati e conversioni sta in
[`public/voce/README.md`](public/voce/README.md).

## Sviluppo

```bash
npm install
npm run dev        # server di sviluppo
npm run build      # bundle di produzione in dist/
npm run preview    # prova il bundle di produzione
npm run typecheck  # solo controllo dei tipi
npm run icons      # rigenera le icone PWA dal marchio
```

`dist/` è statico: si pubblica su qualsiasi hosting (Netlify, Vercel, GitHub
Pages, un nginx). Serve **HTTPS** perché service worker, Wake Lock e
installazione funzionino.

## Pubblicazione

`.github/workflows/pubblica.yml` compila e pubblica su **GitHub Pages** a ogni
push. L'indirizzo è `https://<utente>.github.io/<repository>/`, quindi l'app
vive in una sottocartella: per questo `vite.config.ts` usa `base: './'` e tutti
i percorsi — icone, manifest, `start_url`, `scope` — sono relativi.

Due condizioni. Il repository deve essere **pubblico**: su uno privato Pages
richiede un piano a pagamento. E Pages va acceso a mano, una volta sola, da
**Settings › Pages › Source: GitHub Actions** — non è automatizzabile, il token
del workflow non può creare il sito (`Resource not accessible by integration`,
sia da privato sia da pubblico).

Finché non è acceso, il job di compilazione passa lo stesso: il controllo sul
codice non dipende dalla configurazione di Pages.

`dist/` resta comunque una cartella statica: funziona su qualsiasi hosting con
**HTTPS**, che non è opzionale — senza, service worker, Wake Lock e
installazione non funzionano.

Dal telefono, aperto l'indirizzo: **Aggiungi alla schermata Home**. Da lì in poi
è un'app a tutti gli effetti — schermo intero, offline, schermo sempre acceso.

## Da sistemare prima di andare in produzione

- **Il logo** in `src/components/Logo.tsx` è un SVG ridisegnato a partire dal
  marchio, senza i pittogrammi degli sport: sotto i 60px sarebbero macchie. Va
  sostituito con il file originale, e poi va rilanciato `npm run icons`.
- L'indirizzo della palestra in `src/components/SettingsScreen.tsx` è un
  segnaposto.
- Mancano, facoltative, le clip dei nomi degli esercizi (`esercizi/<nome>.mp3`).
- I timer sono locali al dispositivo. Per la libreria condivisa della palestra
  (istruttori che creano, soci che avviano) e per mandare un allenamento al
  tablet in sala serve un backend: non c'è ancora.
