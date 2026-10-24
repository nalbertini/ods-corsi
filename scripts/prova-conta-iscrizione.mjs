// ---------------------------------------------------------------------------
// I passi dell'iscrizione contati su GoatCounter (senza cookie), senza browser.
//
//   node scripts/prova-conta-iscrizione.mjs
//
// Il modulo manda due eventi: «iscrizione-modulo» quando si apre e
// «iscrizione-fatta» quando la richiesta arriva. Senza codice (o con uno fuori
// forma) non carica niente e non conta niente; con un codice buono carica lo
// script ufficiale una volta sola, senza il conto automatico della pagina
// (le visite dell'app non devono finire in IL SITO), e conta solo gli eventi.
// Un contatore bloccato o che non risponde non rompe mai il modulo.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: ['src/lib/contaIscrizione.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

// Un finto browser: il documento tiene gli script aggiunti, la finestra il contatore.
const finto = ({ carica = true } = {}) => {
  const script = []
  const conti = []
  const finestra = {}
  const documento = {
    createElement: () => ({ dataset: {} }),
    head: {
      append: (s) => {
        script.push(s)
        if (carica) {
          finestra.goatcounter = { count: (v) => conti.push(v) }
          s.onload?.()
        } else s.onerror?.()
      },
    },
  }
  return { script, conti, finestra, documento }
}

console.log('i nomi')
ok('modulo aperto e richiesta fatta', m.EVENTI_ISCRIZIONE, { aperto: 'iscrizione-modulo', fatta: 'iscrizione-fatta' })

console.log('senza codice buono non si conta niente')
for (const codice of [undefined, '', 'Ods', 'a', 'ods prova', 'ods"x', 'https://x.goatcounter.com', '../x', 'a'.repeat(51), 'ods\n']) {
  const f = finto()
  await m.contaIscrizione('iscrizione-modulo', codice, f.finestra, f.documento)
  ok(`codice ${JSON.stringify(codice)}: nessuno script, nessun conto`, [f.script.length, f.conti.length], [0, 0])
}

console.log('con un codice buono')
{
  const f = finto()
  await m.contaIscrizione('iscrizione-modulo', 'ods-prova', f.finestra, f.documento)
  const s = f.script[0]
  ok('uno script solo', f.script.length, 1)
  ok('quello ufficiale', s.src, 'https://gc.zgo.at/count.js')
  ok('del sito giusto', s.dataset.goatcounter, 'https://ods-prova.goatcounter.com/count')
  ok('senza il conto della pagina', s.dataset.goatcounterSettings, '{"no_onload":true}')
  ok('un evento, col suo nome', f.conti, [{ path: 'iscrizione-modulo', title: 'iscrizione-modulo', event: true }])
  await m.contaIscrizione('iscrizione-fatta', 'ods-prova', f.finestra, f.documento)
  ok('al secondo evento lo script non si ricarica', f.script.length, 1)
  ok('e l\'evento arriva', f.conti.map((c) => c.path), ['iscrizione-modulo', 'iscrizione-fatta'])
}

console.log('un contatore che non risponde non rompe il modulo')
{
  const f = finto({ carica: false })
  let errore = null
  try {
    await m.contaIscrizione('iscrizione-fatta', 'ods-prova', f.finestra, f.documento)
  } catch (e) {
    errore = String(e)
  }
  ok('nessun errore, nessun conto', [errore, f.conti.length], [null, 0])
}

console.log(guai ? `\n${guai} da correggere` : '\nTutto in regola')
process.exit(guai ? 1 : 0)
