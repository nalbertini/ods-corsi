# Le clip della voce

Qui vanno i file audio delle frasi incise con una voce vera. Il timer li
preferisce sempre alla sintesi vocale; dove una clip manca, torna da solo alla
voce di sistema — quindi si può incidere un pezzo per volta.

## Ordine di ricerca

Per ogni frase l'app prova, in quest'ordine:

1. una registrazione fatta **su quel dispositivo** dal registratore interno
   (Impostazioni › Voce incisa › Incidi la voce), che vale subito senza
   ripubblicare nulla;
2. il file pubblicato **qui dentro**, che vale per tutti;
3. la sintesi vocale del sistema.

## `index.json`, obbligatorio

Accanto ai file serve un `index.json` che dice quali clip ci sono e con che
estensione:

```json
{
  "ext": "m4a",
  "clips": ["stato/lavoro", "stato/recupero", "numeri/tre", "maurizio/1"]
}
```

Senza, l'app considera che qui non ci sia nulla e non tenta nemmeno di
scaricare: è quello che le evita di sparare un centinaio di richieste a vuoto
a ogni apertura del timer, una per ogni combinazione di frase ed estensione.
Lo zip esportato dal registratore lo contiene già; se aggiungi file a mano,
aggiorna l'elenco.

## Nomi dei file

Il nome del file è la chiave della frase più l'estensione. Le sottocartelle
contano:

```
public/voce/
├── stato/
│   ├── preparati.m4a        «Preparati»
│   ├── lavoro.m4a           «Lavoro»
│   ├── recupero.m4a         «Recupero»
│   ├── riposo.m4a           «Riposo»
│   ├── defaticamento.m4a    «Defaticamento»
│   └── completato.m4a       «Allenamento completato»
├── numeri/
│   ├── tre.m4a              «Tre»
│   ├── due.m4a              «Due»
│   └── uno.m4a              «Uno»
├── maurizio/
│   ├── 1.m4a                «Ho perso il conto, ricominciamo»
│   ├── 2.m4a                «No aspetta, tre»
│   ├── 3.m4a                «Ancora un attimo»
│   ├── 4.m4a                «Eh no, quello non valeva»
│   ├── 5.m4a                «Dai che è quasi finita»
│   └── 6.m4a                «Scusate, mi sono distratto»
└── esercizi/
    ├── burpee-salto.m4a     «Burpee + salto»
    └── ...
```

Le frasi di stato e i numeri sono l'elenco completo e chiuso: sono sempre le
stesse. Gli esercizi invece li scrive chi crea i timer, quindi sono facoltativi
e il nome del file si ricava dal nome dell'esercizio — minuscolo, senza accenti,
con i trattini al posto degli spazi (`Burpee + salto` → `burpee-salto`). Il
registratore interno elenca già gli esercizi che compaiono nei timer salvati.

Quando c'è la clip dello stato ma manca quella dell'esercizio, il timer dice
solo lo stato: mescolare una voce umana e una sintetica nella stessa frase
suona peggio che dire meno.

## Formato

Estensioni accettate, provate in quest'ordine: `.m4a`, `.mp3`, `.webm`, `.ogg`,
`.wav`.

**`.m4a` o `.mp3` sono le scelte sicure**: si sentono ovunque. Il registratore
interno usa il formato che il browser gli permette, e su Android o Chrome è
`.webm`, che Safari più vecchi non decodificano. Se le clip vengono da lì,
conviene convertirle una volta sola:

```bash
for f in $(find public/voce -name '*.webm'); do
  ffmpeg -i "$f" -c:a aac -b:a 96k "${f%.webm}.m4a" && rm "$f"
done
```

Dopo la conversione cambia anche `"ext"` dentro `index.json`.

## Come si incide

Dal registratore interno (Impostazioni › Voce incisa), anche dal telefono in
palestra: ogni frase ha REGISTRA / FERMA, si riascolta, si rifà. Restano su quel
dispositivo e si sentono subito. Il tasto **ESPORTA** scarica `voce-ods.zip`: va
scompattato qui dentro e l'app ripubblicata perché le sentano tutti.

Consigli pratici: stanza silenziosa, telefono a un palmo dalla bocca, tono da
sala pesi — le frasi vanno ascoltate a dieci metri sopra la musica. Lascia mezzo
secondo scarso di silenzio prima e dopo, non di più: il conto alla rovescia le
incatena una dietro l'altra.

Le battute di Maurizio hanno senso solo se le dice Maurizio.
