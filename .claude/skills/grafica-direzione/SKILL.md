---
name: grafica-direzione
description: Use when asked to create or revise an icon, pictogram, illustration or brand element for ODS Corsi (new sport pictogram, empty-state illustration, logo variant), before drawing anything.
---

# Direzione grafica

Regole complete: `graphica/DESIGN_SYSTEM.md` (leggerlo, non riassumerlo a memoria). Colori: `DESIGN.md`.

1. Classifica la richiesta: icona funzionale, pittogramma sportivo, illustrazione o marchio. Ogni classe ha regole diverse.
2. Scrivi in due righe: cosa mostra, misura minima (di norma 32px), sfondo (di norma trasparente).
3. Scegli lo strumento con `grafica-vettoriale` (forme geometriche, pittogrammi) o `grafica-immagini` (forme organiche).
4. Crea almeno 3 varianti in `graphica/varianti/`, mai sopra file esistenti (`public/icons/` e `esportazioni/` non si sovrascrivono: usa un nome nuovo).
5. Confrontale a 32/64/128, scegli la più leggibile, poi `grafica-controllo` prima di consegnare.
6. Non toccare `src/`, `supabase/` né le icone dell'app per un lavoro solo grafico.

Errori: se manca una regola per il caso, chiedi all'utente invece di inventarla.
