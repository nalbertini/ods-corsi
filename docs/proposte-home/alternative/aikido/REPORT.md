# Aikido: foto alternative per la home

Cartella LightCraft `Aikido` (158 scatti, tutti Sony A7R IV, aprile 2025, evento Fijlkam con
tappeto giallo e rosso). Visti tutti a miniatura; le 9 candidate sono sviluppate qui.
Controllate anche «Foto dal sito» (22) e «Facebook» (98): la prima contiene la foto già
pubblicata, la seconda è quasi solo grafica (post), niente di nuovo per l'Aikido.
Libreria letta solo in lettura; sviluppo con `lightcraft-cli render` su copie dei file, senza
sidecar `.xmp`.

> **I minorenni e le liberatorie sono da decidere voi.** Qui sotto, foto per foto, dico solo
> cosa si vede. Dove scrivo «adulti» intendo istruttori: anche per loro serve il consenso.

## La baseline: fbfe492b è già pubblicata

Sì: `fbfe492b-1c27-400d-bd74-983f26de7ffe.jpg` è già sul sito, ma **non nella home**.
Sta in `docs/sito/aikido.html`, `corsi.html` e `chi-siamo.html` (alt «Un istruttore di
Aikido mostra una tecnica a una bambina»). La scheda Aikido della home oggi non ha foto.

Il file locale che le somiglia è `Foto dal sito/sito-0e7eb772….jpg` (1800×1349, copia in
`baseline-sito-0e7eb772.jpg`): istruttore in ginocchio e bambina con cintura gialla che si
fronteggiano, mani alzate, tappeto rosa. **Non ho potuto verificare che sia proprio la
fbfe492b** (il nome è un altro hash e non ho scaricato nulla dal sito): trattatela come
«molto probabile».

Cosa ha di buono: intimità, sguardi, un solo gesto leggibile. Cosa ha di meno: la bambina è
di profilo in primo piano (minore riconoscibile), taglio 4:3, colori molto spinti, nessun
movimento. Le mie alternative non la battono sull'intimità: la battono su movimento e su
rischio liberatorie (A3, B1, C2, C3 senza minori riconoscibili).

## Ipotesi e candidate

Sviluppo comune: ombre +20, alte luci −15, bianchi +10, neri −5, vibranza +8, nitidezza
45 (raggio 0,8, mascheratura 40), lato lungo 1800 px, JPEG q82, sRGB. Nessun ritocco di
esposizione: gli scatti erano già giusti. **Nitidezza verificata al 100% sui volti:
nessuna sfocata.** Dove c'è un limite lo scrivo.

Ritagli: `object-position` in % (x y) con `object-fit: cover`. Su 3:2 la x conta solo
per il telefono (343×240, rapporto 1,43), la y per scheda e striscia. Le anteprime
simulate sono in `ritagli-A|B|C.jpg` (per riga: scheda 676×240 · striscia 209×128 ·
telefono 343×240).

### A · La tecnica: proiezione e movimento (`contatto-A.jpg`, `ritagli-A.jpg`)

Idea: l'Aikido è il gesto che si vede, il corpo che cade e si rialza.

| # | File | Forza | Debolezza | Scheda 676×240 | Striscia 209×128 | Telefono 343×240 | Minori |
|---|---|---|---|---|---|---|---|
| A1 | `974-aikido-A.jpg` (id 974, DSC09696, pick) | Istruttore che ride, bambino proiettato in aria, sala viva. È la più «emozionante». | Scena affollata, molti volti sul fondo | `50% 30%` | `50% 30%` | `40% 50%` | **Sì**: il bambino proiettato (volto coperto), tre bambini riconoscibili dietro, a destra un adulto in ginocchio |
| A2 | `986-aikido-A.jpg` (id 986, DSC09777) | Proiezione pulita, sfondo vuoto, massimo gesto; stessa sequenza della 987 in bianco e nero già vagliata | Volto dell'istruttore tagliato in alto nella scheda (compromesso scelto: mano e viso più importanti) | `50% 20%` | `50% 30%` | `30% 50%` | **Da verificare**: chi viene proiettato ha un fisico piccolo e i capelli sciolti, volto coperto da braccio e capelli. `foto.md` dice per la 987 «adulti»: a me sembra una ragazza/bambina. Controllate voi |
| A3 | `874-aikido-A.jpg` (id 874, DSC08755, verticale) | Capovolta (ukemi) di un adulto in hakama, **nessun volto riconoscibile**, zero liberatorie sui minori | Verticale: sulla scheda 676×240 si taglia a una fascia (solo hakama e gambe), testa fuori. Funziona su striscia e telefono, non sulla scheda | `50% 53%` (debole) | `50% 58%` | `50% 57%` | No. Sullo sfondo persone sedute lontane, non riconoscibili |

Rischi di A: due su tre hanno minori (o forse); la A3 è la scelta «senza pensieri» ma è la
meno adatta alla scheda larga.

### B · Praticare insieme: adulti e ragazzi (`contatto-B.jpg`, `ritagli-B.jpg`)

Idea: nel dojo si impara insieme; l'Aikido è per tutte le età (coerente col testo proposto
«adatta anche a chi ha più anni»). Attenzione: nel repertorio **non esiste una vera foto di
adulti che praticano in gruppo** (l'evento era giovanile): ho preso la coppia di adulti e
due scene con ragazzi.

| # | File | Forza | Debolezza | Scheda | Striscia | Telefono | Minori |
|---|---|---|---|---|---|---|---|
| B1 | `989-aikido-B.jpg` (id 989, DSC09790) | **Due adulti in pratica, sorridono**, gesto leggibile, sfondo pulito, è la più bella di tutte per scheda 676×240 | Il volto dell'uomo è leggermente morbido (movimento); tablet in mano alla donna; sponsor Fijlkam nello sfondo | `50% 5%` | `50% 10%` | `35% 50%` | **No** |
| B2 | `995-aikido-B.jpg` (id 995, DSC09824) | Istruttrice, ragazza in rotolo, ragazzi in fila: la lezione com'è | Troppa cosa nel quadro; la ragazza che rotola è tagliata in scheda | `50% 40%` | `50% 40%` | `60% 50%` | **Sì**: ragazza a terra (volto coperto dai capelli), 4–5 ragazzi in piedi con volto riconoscibile |
| B3 | `998-aikido-B.jpg` (id 998, DSC09878) | Sala intera in pratica, tappeto giallo e rosso, energia | Volti piccoli (non riconoscibili a dimensione scheda); sponsor «Illiria» e Fijlkam leggibili; molta confusione | `50% 61%` | `50% 55%` | `70% 50%` | **Sì**: una decina di bambini in campo, un'altra decina in fondo, di taglia piccola |

Rischi di B: la B1 è l'unica «pulita»; B2 e B3 chiedono le liberatorie di molti.

### C · Armonia: saluto, hakama, dojo (`contatto-C.jpg`, `ritagli-C.jpg`)

Idea: calma, rispetto, tradizione. Lo stesso tono del testo «armonia, equilibrio».

| # | File | Forza | Debolezza | Scheda | Striscia | Telefono | Minori |
|---|---|---|---|---|---|---|---|
| C1 | `857-aikido-C.jpg` (id 857, DSC00033) | Saluto in seiza, fila di allievi che si perde in prospettiva, ottima per scheda larga | I tre adulti in primo piano hanno gli occhi chiusi/bassi (giusto per il saluto, ma poco «accogliente»); molto tappeto rosso | `50% 28%` | `50% 30%` | `90% 50%` | **Sì**: fila di ragazzi inginocchiati sul fondo, volti piccoli, in parte di profilo |
| C2 | `877-aikido-C.jpg` (id 877, 4419×2946, più bassa risoluzione) | Due istruttori seduti, sereni, sguardo laterale: il momento «prima della lezione» | Dietro hanno banner Fijlkam e «Gruppo Illiria – Pausa Sedia» (sponsor) molto grandi; bella ma «da pausa», non da lezione | `50% 35%` | `50% 35%` | `85% 50%` | **No** |
| C3 | `949-aikido-C.jpg` (id 949, pick) | **Quattro istruttori in hakama, sorridono**, sfondo sfocato, la più «di famiglia». Pronta per la home e per Chi siamo | Non è azione: è una posa. Sfondo con sedie blu e un bambino sfocato sulla destra | `50% 8%` | `50% 10%` | `50% 50%` | No in primo piano; sul fondo un bambino sfocato, non riconoscibile |

Rischi di C: pochissimi minori, ma è il ramo meno «Aikido» da vedere. Alternativa nel
repertorio: la 948 (stessa posa, già vagliata in `foto.md` per le pagine corso e Chi siamo).

## Rischi comuni

- **Sponsor e marchi** in sfondo (Fijlkam, Illiria): 857, 877, 989, 995, 998. Non sono un
  ostacolo di per sé, ma sulla scheda 676×240 Fijlkam resta leggibile.
- **Un solo evento**: tutte le foto vengono dalla stessa mattina (6 aprile 2025, palestra
  coi banner Fijlkam), non dalla palestra di via Sassi: le 9 candidate sono omogenee tra loro,
  ma diverse dalle foto già in home (palestra ODS).
- **Liberatorie**: nessuna foto qui assume che la liberatoria ci sia. Le «No» sopra sono
  «nessun minore riconoscibile», non «tutti i consensi ci sono».
- **A2/987**: se la persona proiettata fosse minorenne, `foto.md` va corretto (oggi dice
  «adulti» per la 987).

## La mia raccomandazione

**B, con la B1 (989) come prima scelta.** È l'unica foto con movimento, sorriso e gesto che
regge la scheda larga senza nessun minore riconoscibile, e dice «anche per adulti».
Seconda scelta: **C3 (949)**, la foto di famiglia, sicura per liberatorie. Se si vuole il
colpo d'occhio dell'azione e le liberatorie ci sono: **A1 (974)**.

## File in questa cartella

- `974-aikido-A.jpg` · `986-aikido-A.jpg` · `874-aikido-A.jpg`
- `989-aikido-B.jpg` · `995-aikido-B.jpg` · `998-aikido-B.jpg`
- `857-aikido-C.jpg` · `877-aikido-C.jpg` · `949-aikido-C.jpg`
- `contatto-A|B|C.jpg`, `ritagli-A|B|C.jpg`, `baseline-sito-0e7eb772.jpg`
