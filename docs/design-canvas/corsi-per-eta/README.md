# Corsi per età (Home del sito)

Proposta da approvare prima di toccare il sito. Nasce dalla critique della Home
mobile del 18 ottobre 2026 (problema P1: nove schede identiche, il 35% della
pagina, senza raggruppamento: un genitore deve leggerle tutte per trovare «dai 5
anni»). Niente è stato cambiato in `src/`.

| Tavola | Cosa è |
|---|---|
| 1 · Corsi oggi (375) | Le schede di oggi sul telefono: alte circa 500 px, nove una dopo l'altra |
| 2 · Corsi proposta telefono (375) | Tre gruppi, ancore in alto, scheda compatta da 104 px |
| 3 · Corsi proposta desktop (1440) | Le schede grandi di oggi, ma sotto lo stesso titolo di gruppo e con le stesse ancore |

Componenti nuovi in `../ods-design-system/`: `SitoRigaCorso` (la scheda compatta) e
`SitoAncoreCorsi` (la riga di ancore, link veri `#piccoli`, `#ragazzi`, `#adulti`, senza script).

## I gruppi proposti (ogni corso una volta, nel gruppo da cui si può cominciare)

| Gruppo | Corsi |
|---|---|
| **Piccoli 3-6 anni** (giallo) | Giocomotricità e psicomotricità (3-5), Avviamento alle arti marziali (5-6) |
| **Ragazzi 7-14 anni** (blu) | Judo, Lotta, Aikido (dai 7 agli adulti), Sollevamento pesi (dagli 11) |
| **Dai 14 anni** (inchiostro) | Preparazione atletica (14), Metodo globale di autodifesa (15), Pre pugilistica (18) |

I corsi per adulti e per chi gareggia restano segnati dall'età e dalle pastiglie sulla scheda
grande (desktop); «Agonisti» non è un'età, quindi non è un gruppo.

## Le foto

Sul sito ci sono oggi solo due foto per le schede (psicomotricità, sala attrezzata).
Le altre schede hanno la lettera: sulla scheda compatta diventa un quadrato azzurro con l'iniziale
da 48 px (non 96). Foto scelte ma da caricare: Judo (161), Lotta (446), Aikido (989); da `docs/sito/foto.md`
mancano del tutto foto per pugilistica, autodifesa e sollevamento pesi.

## Da decidere

- I gruppi e dove va ogni corso (Judo, Lotta e Aikido sono «dai 7 agli adulti»: stanno in Ragazzi; Preparazione atletica «dai 14» in fondo).
- Il nome dell'ultimo gruppo: «Dai 14 anni» o «Adulti».
- Le tre schede senza foto: iniziale azzurra (proposto) o un pittogramma.
