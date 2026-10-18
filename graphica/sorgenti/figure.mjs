// Pittogrammi sportivi: figure a scheletro (teste, torsi e arti a capsula) su viewBox 128.
// Il file SVG è solo nero su sfondo trasparente: niente <rect> di fondo.
// Uso: node graphica/sorgenti/figure.mjs <cartella-uscita>
import { writeFileSync, mkdirSync } from 'node:fs'

const TORSO = 16
const ARTO = 9
const TESTA = 8.5

const linea = (pts, w) =>
  `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`

/** Una figura: spalla→anca (torso, la testa ne segue l'asse) e gli arti come catene di punti. */
function figura({ spalla, anca, arti }) {
  const dx = spalla[0] - anca[0], dy = spalla[1] - anca[1], l = Math.hypot(dx, dy)
  const d = TORSO / 2 + TESTA + 3 // 3 di vuoto: la testa non si fonde col torso a 32px
  const testa = [Math.round(spalla[0] + (dx / l) * d), Math.round(spalla[1] + (dy / l) * d)]
  return [
    `<circle cx="${testa[0]}" cy="${testa[1]}" r="${TESTA}" fill="#000"/>`,
    linea([spalla, anca], TORSO),
    ...arti.map((a) => linea(a, ARTO)),
  ].join('\n  ')
}

const svg = (titolo, figure) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img">\n  <title>${titolo}</title>\n  ${figure.map(figura).join('\n  ')}\n</svg>\n`

export const varianti = {
  'judo-a': svg('Judo, spazzata esterna', [
    { // tori, in piedi, gamba destra che spazza
      spalla: [34, 46], anca: [42, 76],
      arti: [[[42, 76], [38, 98], [36, 120]], [[42, 76], [66, 90], [92, 100]], [[34, 46], [52, 52], [70, 46]]],
    },
    { // uke, sbilanciato all'indietro
      spalla: [104, 54], anca: [90, 80],
      arti: [[[90, 80], [78, 98], [70, 108]], [[90, 80], [100, 100], [106, 120]], [[104, 54], [116, 66], [122, 80]], [[104, 54], [90, 44], [80, 46]]],
    },
  ]),
  'judo-b': svg('Judo, proiezione di spalla', [
    { // tori, accovacciato
      spalla: [50, 78], anca: [66, 96],
      arti: [[[66, 96], [52, 108], [44, 122]], [[66, 96], [84, 108], [90, 122]], [[50, 78], [66, 66], [80, 58]]],
    },
    { // uke, in volo sopra la spalla
      spalla: [90, 40], anca: [70, 28],
      arti: [[[70, 28], [52, 18], [40, 24]], [[70, 28], [58, 40], [46, 38]], [[90, 40], [92, 54], [82, 62]]],
    },
  ]),
  'aikido-a': svg('Aikido, proiezione circolare', [
    { // tori, in guardia con il braccio disteso
      spalla: [42, 46], anca: [46, 76],
      arti: [[[46, 76], [34, 98], [28, 120]], [[46, 76], [66, 96], [76, 120]], [[42, 46], [64, 44], [88, 50]], [[42, 46], [30, 56], [26, 70]]],
    },
    { // uke, spinto in un arco all'indietro
      spalla: [104, 70], anca: [92, 96],
      arti: [[[92, 96], [100, 112], [112, 118]], [[92, 96], [80, 108], [78, 122]], [[104, 70], [96, 58], [88, 50]], [[104, 70], [116, 80], [122, 92]]],
    },
  ]),
  'aikido-b': svg('Aikido, controllo del polso', [
    { // tori, di tre quarti
      spalla: [48, 42], anca: [52, 74],
      arti: [[[52, 74], [38, 98], [30, 120]], [[52, 74], [72, 94], [82, 120]], [[48, 42], [68, 46], [86, 60]], [[48, 42], [36, 56], [44, 66]]],
    },
    { // uke, piegato dal controllo
      spalla: [100, 84], anca: [108, 108],
      arti: [[[108, 108], [100, 118], [96, 124]], [[108, 108], [118, 118], [122, 124]], [[100, 84], [92, 72], [86, 60]], [[100, 84], [84, 86], [70, 80]]],
    },
  ]),
}

if (process.argv[2]) {
  mkdirSync(process.argv[2], { recursive: true })
  for (const [nome, s] of Object.entries(varianti)) writeFileSync(`${process.argv[2]}/${nome}.svg`, s)
}
