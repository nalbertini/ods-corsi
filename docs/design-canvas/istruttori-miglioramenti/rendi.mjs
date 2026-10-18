// Anteprime statiche e autonome della pagina Istruttori proposta: espande i <dc-import> con i componenti Sito* della libreria (renderVals, {{...}}, sc-if, sc-for) senza il runtime del canvas.
// con i componenti Sito* della libreria (renderVals, {{...}}, sc-if, sc-for) senza il runtime del canvas.
// Uso: node docs/design-canvas/istruttori-miglioramenti/rendi.mjs  ->  anteprima-<tavola>.html (foto da img/).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const qui = import.meta.dirname
const lib = join(qui, '../ods-design-system')
class DCLogic { constructor(p) { this.props = p } }
const cache = {}
const comp = (nome) => cache[nome] ??= (() => {
  const t = readFileSync(join(lib, nome + '.dc.html'), 'utf8')
  const tpl = t.split('</helmet>')[1].split('</x-dc>')[0]
  const m = /<script data-dc-script data-props='([^']*)'>([\s\S]*?)<\/script>/.exec(t)
  const defs = Object.fromEntries(Object.entries(JSON.parse(m[1])).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, v.default]))
  return { tpl, defs, C: new Function('DCLogic', m[2] + '\nreturn Component;')(DCLogic) }
})()
const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o)
const rendi = (tpl, v) => tpl
  .replace(/<sc-for list="\{\{(\w+)\}\}" as="(\w+)"[^>]*>([\s\S]*?)<\/sc-for>/g, (_, l, a, corpo) => (v[l] || []).map((it) => rendi(corpo, { ...v, [a]: it })).join(''))
  .replace(/<sc-if value="\{\{(\w+)\}\}"[^>]*>([\s\S]*?)<\/sc-if>/g, (_, k, corpo) => (v[k] ? rendi(corpo, v) : ''))
  .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => { const x = get(v, k); return x === undefined ? '' : String(typeof x === 'string' ? x.replace(/&/g, '&amp;').replace(/</g, '&lt;') : x) })
const espandi = (html) => html.replace(/<dc-import ([^>]*)><\/dc-import>/g, (_, attrs) => {
  const props = {}
  for (const [, k, val] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) props[k] = val === '{{ true }}' ? true : val === '{{ false }}' ? false : val
  const { tpl, defs, C } = comp(props.name)
  return rendi(tpl, new C({ ...defs, ...props }).renderVals())
})
const tavole = [['IstruttoriProposta', 'anteprima-elenco-1440', 1440], ['IstruttoriPropostaTelefono', 'anteprima-elenco-375', 375], ['IstruttoreProposta', 'anteprima-scheda-1440', 1440], ['IstruttoreTelefono', 'anteprima-scheda-375', 375], ['IstruttoreMinima', 'anteprima-scheda-minima-1440', 1440], ['IstruttoreMinimaTelefono', 'anteprima-scheda-minima-375', 375]]
for (const [da, a, larg] of tavole) {
  const t = readFileSync(join(qui, da + '.dc.html'), 'utf8')
    .replace('<script src="./support.js"></script>', `<meta name="viewport" content="width=${larg}, initial-scale=1">`)
    .replace(/<helmet>([\s\S]*?)<\/helmet>/, '$1').replace('<x-dc>', '').replace('</x-dc>', '')
  writeFileSync(join(qui, a + '.html'), espandi(t))
}
console.log(tavole.map((x) => x[1] + '.html').join(', ') + ' pronte')
