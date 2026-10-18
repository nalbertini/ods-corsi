# Foto e mappa di Contatti

Sola lettura sulla libreria LightCraft. Niente su Supabase, niente sul sito.

## Cosa ho potuto consultare

- **App LightCraft (127.0.0.1:7980): non raggiungibile.** Le query hanno risposto «too many control connections» (le altre sessioni la usano) e poi «connection reset»; le ho interrotte per non appesantirla. Il server `lightcraft` senza app ha una libreria vuota.
- Ho quindi letto in sola lettura `~/Pictures/LightCraft Library/catalog.snap` (il catalogo, 984 foto vere) e le **cartelle su disco** da cui sono importate. Nessuna parola chiave né titolo nel catalogo: la ricerca per «ingresso», «via Sassi», «palestra» non può dare risultati. Voti, flag e parole chiave: non toccati.
- Cartelle: `2025 2 febbraio 20 officine` (54), `2025 2 febbraio 22 avviam-prep-lotta-calist` (55), le 9 `IMG_*`/`DSC_0166` sciolte; già vagliate dalle altre sessioni: Araimondo Cup (484), esame cinture (223), Aikido (158), `docs/sito/foto.md`.

**Esito: nella libreria non c'è nessuna foto dell'ingresso, della facciata, dell'insegna, di Via Sassi o dell'esterno.** Sono tutte interni a lezione (pesi, tatami, lotta) o gare/podi.

## La mappa (`sito/risorse/mappa.webp`)

1344×520, 85 KB, OpenStreetMap zoom 17 (`img/mappa-attuale.jpg`). Va bene come base: nitida, centrata sulla sede, credito presente. Limiti:
- **Non mostra la stazione Fermi**: la frase «a pochi metri dalla metropolitana» non si può controllare guardando la mappa. Un ritaglio a zoom 16 con stazione e sede insieme dimostrerebbe la distanza (coordinate della stazione da confermare: C4). Non l'ho generato.
- Sul sito vero segnaposto e targhetta sono livelli HTML sopra l'immagine; nel canvas sono ricreati in `SitoMappa`.
- La pillola sull'immagine copre etichette: nella proposta la frase passa nel testo («In metro: scendi a Fermi…»).

## Le tre foto di oggi

| Foto | Dove è già | Giudizio |
|---|---|---|
| 12e605fc lezione in fila | scheda Judo / recensioni (home) | tatami e sala si vedono, minorenni di spalle; versione migliorata in `foto/approvate` |
| 40ae8db3 bambino sui cubi | home | morbida, minore (volto fuori campo): **tolta** da Contatti |
| 1a03b6b2 sala pesi | home | sala vera, nessun volto: tenuta |

## Candidati nuovi (sviluppati da copie, LightCraft vs PhotoCraft)

Cinque scatti, sviluppo con le stesse regolazioni (temperatura 5400-5800 K / −17…−26 in PhotoCraft, esposizione +0,2, contrasto +10, alte luci −20, ombre +20, bianchi +15, neri −8, vibranza +5, nitidezza 45/40, rumore 15/20), 1800 px q82: `sviluppate/` (LightCraft) e `photocraft/`. Confronto originale | LightCraft | PhotoCraft in `img/confronto.jpg`. Gli originali (4496×3000) non sono nel repository.

| Scatto | Cosa mostra | Esito |
|---|---|---|
| `avv-0042` (DSC_0042, 22/2/2025) | tatami giallo-blu, adulti in piedi, nessun volto in primo piano | **non adatta**: troppo gialla e morbida; LightCraft toglie parte del giallo, PhotoCraft quasi no |
| `avv-0044` (DSC_0044) | sala larga con scaffali e striscione | non adatta: figure piccole e mosse, riflessi |
| `avv-0018` (DSC_0018) | sala con anelli e rack, ragazzi | **minorenni riconoscibili**: da escludere senza liberatorie |
| `off-0021` (DSC_0021, 20/2/2025) | sala pesi, istruttrice e allieva | bella ma il volto è in primo piano: liberatoria adulti; già «sala» in home |
| `avv-0073` (DSC_0073) | bacheca «A.S.D. Il Centro Judo» con foto storiche di maestri | utile per Chi siamo (storia, e spiega il nome Facebook): volti di terzi, da autorizzare |

**Vince LightCraft 5 a 0** (stesso esito della home: tiene meglio la dominante gialla dei neon); ma nessuno scatto supera le due foto già approvate. Nessuna è proposta per Contatti.

## Proposta

1. Due foto: lezione (12e605fc-v2) e sala (1a03b6b2-v2), `loading="lazy"`, `width`/`height` dichiarati, ritaglio 3:2 (focus `50% 70%` e `50% 55%`), niente foto nascosta sul telefono.
2. Il terzo posto è **«L'ingresso di Via Sassi»**: da scattare, 10 minuti, di giorno, porta e insegna, senza persone (niente liberatorie). Chi la scatta: C6. Finché non c'è, la pagina ha solo due foto.
3. Minorenni e liberatorie: **segnalati, non decisi**. 12e605fc ha ragazzi di spalle con un nome «…ITA» leggibile sul dorso (vedi `foto/REPORT.md` della home): decidono l'utente e la segreteria.

## Da fare, se si va avanti

- Mappa a zoom 16 con stazione Fermi (serve l'indirizzo esatto della stazione e il sì a usare OSM così).
- Esportare l'ingresso in WebP/JPG 1800 px, 3:2.
