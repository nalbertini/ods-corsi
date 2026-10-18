// Anteprima statica delle tavole dei corsi per età: espande i <dc-import> di ogni tavola
// con i componenti Sito* della libreria (renderVals, {{...}}, sc-if, sc-for) senza il runtime del canvas.
// Uso: node docs/design-canvas/corsi-per-eta/rendi.mjs  ->  anteprima.html (le tavole affiancate).
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
const tavole = JSON.parse(readFileSync(join(qui, 'canvas.json'), 'utf8')).artboards
const pezzi = tavole.map((t) => {
  const html = readFileSync(join(qui, t.file), 'utf8')
  const corpo = html.split('</helmet>')[1].split('</x-dc>')[0]
  return `<figure style="margin:0"><figcaption style="font:600 16px Inter,Arial,sans-serif;color:#0d2a3d;margin:0 0 12px">${t.title}</figcaption>${espandi(corpo)}</figure>`
})
writeFileSync(join(qui, 'anteprima.html'), `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=2400"><title>Corsi per età</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=Inter:wght@400;500;600;700&display=swap"><style>* { box-sizing: border-box; } body { margin: 0; padding: 32px; background: #dfe9f0; -webkit-font-smoothing: antialiased; } .tavole { display: flex; align-items: flex-start; gap: 24px; width: max-content }</style></head><body><div class="tavole">${pezzi.join('')}</div></body></html>`)
console.log('anteprima.html pronta')
