// Controllo prima di pubblicare un canvas: node docs/design-canvas/ods-design-system/verifica.mjs [cartella ...]
// Senza argomenti controlla tutte le cartelle di docs/design-canvas.
// Errori (exit 1): un colore esadecimale che non e' in src/styles.css, DESIGN.md o COLORI di
// src/lib/segreteria.ts (cioe' inventato); un <dc-import> senza hint-size o verso un file che non c'e'.
// Come nel Toolkit, riconosce solo #rrggbb a 6 cifre: scrivere sempre cosi'.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const radice = resolve(import.meta.dirname, '../../..')
const HEX = /#[0-9a-fA-F]{6}\b/g
const ammessi = new Set(
  ['src/styles.css', 'DESIGN.md', 'src/lib/segreteria.ts'].flatMap((f) =>
    (readFileSync(join(radice, f), 'utf8').match(HEX) ?? []).map((h) => h.toLowerCase()),
  ),
)

const base = join(radice, 'docs/design-canvas')
const cartelle = process.argv.length > 2
  ? process.argv.slice(2).map((c) => resolve(c))
  : readdirSync(base).map((n) => join(base, n)).filter((p) => statSync(p).isDirectory())

let errori = 0
for (const cartella of cartelle) {
  const libreria = join(base, 'ods-design-system')
  for (const nome of readdirSync(cartella).filter((n) => n.endsWith('.dc.html'))) {
    const testo = readFileSync(join(cartella, nome), 'utf8')
    const dice = (cosa) => { errori++; console.error(`${nome}: ${cosa}`) }
    for (const h of new Set((testo.match(HEX) ?? []).map((x) => x.toLowerCase()))) {
      if (!ammessi.has(h)) dice(`colore ${h} fuori dalla palette dell'app`)
    }
    for (const [tag] of testo.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<dc-import\b[^>]*>/g)) {
      if (!/hint-size=/.test(tag)) dice(`dc-import senza hint-size: ${tag.slice(0, 60)}`)
      const dest = /name="([^"]+)"/.exec(tag)?.[1]
      if (dest && ![cartella, libreria].some((c) => existsSync(join(c, `${dest}.dc.html`)))) dice(`dc-import verso ${dest}: file inesistente`)
    }
  }
}
console.log(errori ? `${errori} errori` : 'tutto in regola')
process.exit(errori ? 1 : 0)
