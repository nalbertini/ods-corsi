// ---------------------------------------------------------------------------
// IL TIMER SI APRE LEGGERO, senza browser.
//
//   node scripts/prova-timer-chunk.mjs
//
// All'apertura serve solo la home: le altre schermate (impostazioni, storico,
// editor, timer in corsa…) si caricano quando le apri. Qui si controlla che
// `App.tsx` non le importi di nuovo in modo statico, e che il service worker
// continui a precaricare ogni file js, chunk compresi, per l'uso senza rete.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const app = readFileSync('timer/src/App.tsx', 'utf8')
const pigre = ['SettingsScreen', 'VoiceRecorderScreen', 'HistoryScreen', 'EserciziScreen', 'CondividiScreen', 'RicevutoScreen', 'PresetScreen', 'EditorScreen', 'TimerScreen']
for (const n of pigre) {
  ok(`${n}: non importata in modo statico`, new RegExp(`^import \\{[^}]*\\b${n}\\b[^}]*\\} from`, 'm').test(app), false)
  ok(`${n}: caricata con import()`, new RegExp(`import\\('\\./components/${n}'\\)`).test(app), true)
}
ok('HomeScreen resta nel pacchetto iniziale', /^import \{ HomeScreen \} from/m.test(app), true)

const cfg = readFileSync('timer/vite.config.ts', 'utf8')
ok('il service worker precarica i js (chunk inclusi)', /globPatterns: \['\*\*\/\*\.\{js,/.test(cfg), true)

if (guai) process.exit(1)
