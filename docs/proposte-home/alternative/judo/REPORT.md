# Judo: tre ipotesi per la home

Sola lettura sulla libreria LightCraft (nessun voto, flag, keyword o sviluppo
toccato). Sfogliate le cartelle judo su disco: Araimondo Cup (484 foto),
esame cinture 6 giugno 2026 (223), Facebook (grafiche, scartate), Foto dal
sito (già pubblicate, scartate). Le foto sono state sviluppate da **copie** con
`lightcraft-cli render`; gli originali non sono stati toccati. Niente su
Supabase, sito o database.

Gli `<idfoto>` sono gli id della libreria LightCraft (stessi di `docs/sito/foto.md`).
Foto già in home (46c39293, 692, 726…) **non** usate.

## Ipotesi → foto

| Ipotesi | Idea | Foto candidate (file sviluppato) | Origine |
|---|---|---|---|
| **A** | Azione / presa: il judo che si vede in un colpo d'occhio | `725-judo-A.jpg`, `690-judo-A.jpg`, `698-judo-A.jpg` | Araimondo Cup, mar 2025 (DSC_0945, 0860, 0873) |
| **B** | Gruppo sul tatami: la cerimonia delle cinture, la fila, i ragazzi | `108-judo-B.jpg`, `141-judo-B.jpg`, `164-judo-B.jpg` | Esame cinture, giu 2026 (DSC_0102, 0136, 0168) |
| **C** | Istruttore e allievi: la lezione, il gesto, il sorriso | `159-judo-C.jpg`, `161-judo-C.jpg`, `26-judo-C.jpg` | Esame cinture, giu 2026 (DSC_0162, 0164, 0002) |

Contact sheet (foto intera + i tre ritagli ai formati reali, con l'`object-position`
usato): `contact-sheet-A.jpg`, `contact-sheet-B.jpg`, `contact-sheet-C.jpg`.

Riserva non sviluppata per A: **723** (DSC_0942, proiezione verticale, volti
visibili, cinture marroni: ragazzi, età da verificare).

## Punti di forza, debolezze, ritagli

`object-position` = `x% y%` con `object-fit: cover`. Scheda 676×240, hero 317×530,
telefono 343×240.

| Foto | Punti di forza | Debolezze | Scheda | Hero | Telefono |
|---|---|---|---|---|---|
| **725** (A) | Proiezione a mezz'aria, blu e bianco, volti non visibili, nitida | In 676×240 resta solo una fascia di anca e schiena (l'azione è alta e stretta); spettatrice sullo sfondo a sinistra | `50% 42%` (debole) | `40% 50%` (ottima) | `50% 40%` |
| **690** (A) | Presa chiusa, due teste e le mani sul bavero nel riquadro stretto, sfondo pulito, nitida | Un volto in parte coperto, l'altro chinato; niente scritte | `50% 10%` | `48% 50%` (teste a ridosso del bordo alto) | `50% 50%` |
| **698** (A) | Presa frontale, due volti e cinture nere, la più «da copertina» di A, nitida | **Sul dorso della giacca si legge un cognome** («…DI LORENZO», ITA): il ritaglio non lo nasconde in nessun formato | `50% 10%` | `42% 50%` (la coppia sta a stento nei 40% di larghezza visibile) | `50% 50%` |
| **108** (B) | Fila di ragazzi in ginocchio, cinture sul tatami, istruttore a destra: racconta il passaggio di cintura | Molti volti piccoli, pubblico sullo sfondo, luce mista | `50% 25%` | `100% 40%` (solo istruttore, nessun minore in primo piano) | `50% 40%` |
| **141** (B) | Tre ragazzi sorridenti in fila, cinture blu, sfondo ordinato | Soggetti bassi nell'inquadratura: la scheda 676×240 li mostra piccoli | `50% 75%` (debole) | `80% 60%` | `50% 60%` |
| **164** (B) | Tre ragazzi abbracciati, sorrisi veri, colori puliti: la più calda di B | Verticale: nella scheda resta una striscia di volti e spalle (funziona) | `50% 22%` | `50% 50%` | `50% 20%` |
| **159** (C) | Istruttore che parla, due allievi che si allacciano la cintura: la lezione | Volto del ragazzo a sinistra a filo del bordo alto: nella scheda va tenuto `0%` | `50% 0%` | `62% 40%` (un solo allievo intero, l'altro tagliato) | `50% 30%` |
| **161** (C) | Istruttore sorridente, due allievi, uno guarda in camera: **ci sono le due facce, istruttore e allievo, anche nel riquadro stretto** | Un ragazzo guarda in basso (volto in parte coperto dai capelli) | `50% 0%` | `75% 30%` (due allievi, istruttore fuori) | `50% 30%` |
| **26** (C) | Ritratto dell'istruttore, sorriso, sfondo pulito; regge hero e scheda | Luce a flash, sfondo beige un po' piatto; risoluzione 4496×3000 (ok a 1800) | `50% 55%` | `50% 50%` (ottima) | `50% 50%` |

Nitidezza: controllata a 100% sui volti e sui dettagli di tutte e 9 le foto. Nessuna
è mossa. Lo spoglio è stato fatto su miniature (300 px) e poi sui finalisti a
schermo pieno: nelle cartelle ci sono molte foto di gara con soggetti piccoli o
mossi, non elencate una per una.

## Sviluppo (riproducibile)

Da copia, `lightcraft-cli render <IN> -o <OUT> --size 1800 --quality 82` più:

- **Cup** (A): esposizione +0,25, temp 6150, contrasto +12, alte luci −20, ombre +25, bianchi +25, neri −10, vibranza +6, nitidezza 55 (mascheratura 50), riduzione rumore 8.
- **Esame, ampie** (108, 141, 164): esposizione +0,3, temp 6300, contrasto +10, alte luci −20, ombre +25, bianchi +20, neri −8, vibranza +4, nitidezza 50 (45), rumore 10.
- **Esame, primi piani** (159, 161): come sopra con temp 6000 (bianchi che virano al giallo per il tatami), alte luci −15, ombre +20, nitidezza 55.
- **26** (flash): esposizione +0,1, temp 5800, contrasto +8, alte luci −10, ombre +15, bianchi +15, nitidezza 40.

Ritocco onesto: pelle e colori delle cinture invariati. Lato lungo 1800 px, JPEG q82,
130-320 KB.

## Minorenni e liberatorie (da decidere voi, foto per foto)

| Foto | Persone riconoscibili | Da verificare |
|---|---|---|
| 725 | Volti dei due atleti non visibili; una spettatrice adulta sullo sfondo a sinistra | Età degli atleti (gara Araimondo Cup); basta il ritaglio hero a `40% 50%` a toglierla? sì in hero e telefono, no in scheda |
| 690 | Due atleti cintura nera, un volto visibile | Età (probabili adulti/ragazzi grandi): liberatoria |
| 698 | Due atleti, volti visibili, cognome sul dorso | Età, liberatoria **e** cognome (da cancellare con il timbro di LightCraft prima di usarla) |
| 108 | **Almeno 6 ragazzi/e riconoscibili**, istruttore, pubblico (adulti e bambini piccoli sullo sfondo) | Liberatoria dei minori; l'hero `100% 40%` li evita |
| 141 | **3 ragazzi riconoscibili** in primo piano, un bambino e adulti più indietro | Liberatoria dei minori |
| 164 | **3 ragazzi riconoscibili in primo piano** | Liberatoria dei minori (la foto non si può ritagliare senza i volti) |
| 159 | **2 ragazzi riconoscibili**, istruttore adulto | Liberatoria dei minori |
| 161 | **2 ragazzi riconoscibili** (uno in camera), istruttore adulto | Liberatoria dei minori. Già nel catalogo (`foto.md`, id 161) con lo stesso avviso |
| 26 | Istruttore adulto in primo piano; una bambina di spalle sullo sfondo, non riconoscibile | Consenso dell'istruttore |

Nessuna decisione presa: tutte le foto con minori restano «da verificare».

## Rischi

- **Scheda 676×240 su foto verticale** (725, 164): resta una fascia; in 164 sono i
  volti (buono), in 725 è un'anca (cattivo). Vedi contact sheet.
- **A** è l'idea più «judo» ma nel riquadro stretto perde il volto o una delle due facce;
  **698** ha il cognome leggibile.
- **B** e **C** dipendono dalle liberatorie dei minori.
- Le foto di giugno 2026 hanno sorgente 6000×4000; quelle della Cup 4496×3000. A 1800 px
  vanno bene tutte.
- Le foto già in home non sono state confrontate: non ho il file della 46c39293 in
  libreria (gli id pubblicati sono hash). Confrontare a occhio con le 8 pubblicate
  prima di scegliere.
- Per la scheda Judo con fuoco a `70% 38%` proposto dal report gravity: le nuove foto
  hanno ognuna il suo valore nella tabella, non vanno ereditati.

## Raccomandazione

**C, con 161** (scheda `50% 0%`, hero `75% 30%`, telefono `50% 30%`). È l'unica ipotesi
in cui nel riquadro stretto restano entrambe le facce, istruttore e allievo, che era il
difetto segnalato; 26 come hero o ritratto istruttore senza minori. Se non arrivano le
liberatorie dei due ragazzi: **A con 690** (adulti, scheda `50% 10%`) e **26** per l'hero.
