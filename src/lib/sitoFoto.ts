/**
 * Dove stanno le persone in ogni foto del sito, come `x% y%` (come `object-position`).
 *
 * Le foto sono ritagliate (`object-fit:cover`) in riquadri di forme diverse, sul computer e sul telefono:
 * senza un punto da tenere al centro si perdono teste e mani. Il punto è per foto, non per riquadro, così
 * vale in ogni pagina. `y` è alta se le persone stanno in alto e bassa se stanno in basso; per una foto
 * d'insieme larga basta `50% 40%`. Una foto nuova non è qui: resta col ritaglio del suo riquadro, finché
 * non si guarda dove stanno le teste e si aggiunge la riga (scripts/prova-sito-foto.mjs la controlla).
 */
export const FOCI_FOTO: Record<string, string> = {
  '12e605fc-cd00-47b8-b15d-4eb2443c3f21.jpg': '50% 56%', // lezione di judo: il maestro e gli allievi, di spalle
  '18c88f1d-5cea-4284-b45a-cc8fabd1a645.jpg': '50% 40%', // il gruppo dei bambini con gli istruttori
  '1a03b6b2-3311-441f-b35d-bd7a8e2471cb.jpg': '50% 54%', // sala di preparazione atletica
  '40ae8db3-5d53-4075-a708-134f0cef6e81.jpg': '60% 40%', // il bambino che salta tra i cubi
  '46c39293-7092-49c1-bf6f-36927c36ecd1.jpg': '55% 40%', // presa di judo, l'allieva in piedi dietro
  '6e742106-7c45-452a-b698-257bbf9309b0.jpg': '45% 68%', // due bambini a terra sul tatami giallo
  '701a887f-9ed5-4a9d-9637-bc8e54f45e6c.jpg': '50% 58%', // due atleti di lotta
  '72d0e1bc-70a3-4407-9215-5c64ee721624.jpg': '50% 42%', // psicomotricità: adulta e bambini
  '814a717b-91a2-441c-b34c-ef376d4781c6.jpg': '50% 25%', // gli istruttori con la cintura nera, in fila
  '9b15677c-7a5f-431b-ac7a-f5ae0994e8bf.jpg': '50% 25%', // il gruppo di lotta
  'fbfe492b-1c27-400d-bd74-983f26de7ffe.jpg': '45% 35%', // aikido: maestro e allieva
}

/**
 * Le regole CSS del fuoco, una per foto. `!important` perché i riquadri hanno il loro ritaglio per posto
 * (testata, fila, ritratto) e il fuoco della foto deve vincere su tutti. Un nome o un fuoco strani si saltano.
 */
export function cssFoci(foci: Record<string, string> = FOCI_FOTO): string {
  return Object.entries(foci)
    .filter(([nome, foco]) => /^[A-Za-z0-9._-]+\.(jpg|webp)$/.test(nome) && /^\d{1,3}% \d{1,3}%$/.test(foco))
    .map(([nome, foco]) => `img[src$="${nome}"]{object-position:${foco}!important}`)
    .join('\n')
}
