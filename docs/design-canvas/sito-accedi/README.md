# Sito · pulsante «Accedi»

Proposta da approvare prima di toccare il sito. Niente è stato cambiato in `src/`.

| Tavola | Cosa è |
|---|---|
| 1 · Testata oggi | Solo «Iscriviti» |
| 2 · Testata proposta | «Accedi» a linea accanto a «Iscriviti», che resta l'unico pieno e giallo |
| 3 · Menu del telefono | In fondo al menu, «Iscriviti» giallo e «Accedi» a linea, 52px |

Componente: `SitoTestata` della libreria, con la prop nuova `conAccedi`.

## Regole

- «Accedi» porta alla radice dell'app (la porta unica): chi è già dentro va nella sua area, chi ne ha più d'una sceglie, gli iscritti trovano la loro scheda ISCRITTI. Nessun link a una singola area.
- Stesso stile e stessa struttura dei pulsanti di oggi (`.pulsante.secondario`), nella testata di ogni pagina e nel menu del telefono.
