// ---------------------------------------------------------------------------
// La scheda iscritto divisa in schede, senza browser (`src/lib/schedaSezioni.ts`).
//
//   node scripts/prova-scheda.mjs
//
// Quattro schede in ordine (PERSONA, DOCUMENTI, QUOTA E PAGAMENTI, CORSI);
// quale timbro e quale sezione portano a quale scheda; la tastiera con il
// giro; i segni (parola e tono) che documenti e quota mettono sulla loro
// linguetta, presi da `timbriScheda` e `timbroTessera`; quale scheda si apre.
// Canvas: docs/design-canvas/scheda-iscritto-schede.
// ---------------------------------------------------------------------------
process.env.TZ = 'Europe/Rome'

import { build } from 'esbuild'

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/schedaSezioni'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
// Una funzione che manca è una prova che fallisce, non un'uscita a metà.
const f = (nome, ...args) => (typeof m[nome] === 'function' ? m[nome](...args) : `manca ${nome}()`)

console.log('Le schede, in ordine')
ok('quattro, in ordine', (m.SCHEDE ?? []).map((s) => s.id), ['persona', 'documenti', 'quota', 'corsi'])
ok('le etichette', (m.SCHEDE ?? []).map((s) => s.etichetta), ['PERSONA', 'DOCUMENTI', 'QUOTA E PAGAMENTI', 'CORSI'])
ok('sul telefono QUOTA è corta', (m.SCHEDE ?? []).map((s) => s.etichettaTelefono), ['PERSONA', 'DOCUMENTI', 'QUOTA', 'CORSI'])
ok('il nome per il lettore schermo resta intero', (m.SCHEDE ?? []).find((s) => s.id === 'quota')?.nome, 'QUOTA E PAGAMENTI')
ok('la prima è l’iniziale', m.SCHEDA_INIZIALE, 'persona')

console.log('\nDa un timbro o una sezione alla scheda')
ok('le sezioni: sez-certificato, sez-tessere, sez-documento, sez-quota', ['sez-certificato', 'sez-tessere', 'sez-documento', 'sez-quota'].map((s) => f('schedaDellaSezione', s)), ['documenti', 'documenti', 'documenti', 'quota'])
ok('una sezione sconosciuta: nessuna scheda', f('schedaDellaSezione', 'sez-boh'), null)

console.log('\nQuando serve cambiare scheda')
ok('un’altra: sì', f('serveCambiare', 'persona', 'quota'), true)
ok('la stessa: no', f('serveCambiare', 'quota', 'quota'), false)
ok('nessuna destinazione: no', f('serveCambiare', 'quota', null), false)

console.log('\nLa tastiera')
const t = (aperta, tasto) => f('tastoScheda', aperta, tasto)
ok('destra: la successiva', [t('persona', 'ArrowRight'), t('documenti', 'ArrowRight'), t('quota', 'ArrowRight')], ['documenti', 'quota', 'corsi'])
ok('sinistra: la precedente', [t('corsi', 'ArrowLeft'), t('quota', 'ArrowLeft'), t('documenti', 'ArrowLeft')], ['quota', 'documenti', 'persona'])
ok('destra dall’ultima: gira alla prima', t('corsi', 'ArrowRight'), 'persona')
ok('sinistra dalla prima: gira all’ultima', t('persona', 'ArrowLeft'), 'corsi')
ok('Home e Fine: i capi', [t('quota', 'Home'), t('quota', 'End')], ['persona', 'corsi'])
ok('un altro tasto: niente', [t('quota', 'a'), t('quota', 'Enter')], [null, null])

console.log('\nI segni sulle schede')
const OGGI = '2026-09-26'
const corsi = [{ id: 'judo', nome: 'Judo 3', enteTessera: 'FIJLKAM' }]
const inRegola = { id: 'p', attiva: true, iscrizioni: [], certificato: { scade: '2027-06-30', conFile: true }, documento: true, pagamento: { stato: 'pagato', fino: '2027-07-31' }, quote: [], natoIl: '1990-01-01' }
const segni = (p, aperta = 'persona', inModifica = false) => f('segniSchede', p, corsi, OGGI, { aperta, inModifica })
const SENZA = { persona: null, documenti: null, quota: null, corsi: null }
ok('in regola: nessun segno', segni(inRegola), SENZA)
ok('certificato mancante: DOCUMENTI rosso', segni({ ...inRegola, certificato: { conFile: false } }).documenti, { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('certificato scaduto: DOCUMENTI rosso', segni({ ...inRegola, certificato: { scade: '2026-01-01', conFile: true } }).documenti, { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('certificato in scadenza: DOCUMENTI giallo', segni({ ...inRegola, certificato: { scade: '2026-10-10', conFile: true } }).documenti, { parola: 'DA SISTEMARE', tono: 'giallo' })
ok('documento da portare: DOCUMENTI giallo', segni({ ...inRegola, documento: false }).documenti, { parola: 'DA SISTEMARE', tono: 'giallo' })
ok('documento giallo e certificato rosso: vale il rosso', segni({ ...inRegola, documento: false, certificato: { conFile: false } }).documenti.tono, 'rosso')
ok('quota da pagare: QUOTA rossa, «DA PAGARE»', segni({ ...inRegola, pagamento: { stato: 'da_pagare' } }).quota, { parola: 'DA PAGARE', tono: 'rosso' })
ok('quota pagata in parte: QUOTA gialla', segni({ ...inRegola, pagamento: { stato: 'da_pagare' }, quote: [{ numero: 1, anno: 2026, mancano: 20, dal: '2026-09-01', al: '2027-07-31' }] }).quota, { parola: 'DA PAGARE', tono: 'giallo' })
ok('un problema alla quota non tocca DOCUMENTI', segni({ ...inRegola, pagamento: { stato: 'da_pagare' } }).documenti, null)
ok('persona e corsi mai segnalati per i timbri', ((s) => [s.persona, s.corsi])(segni({ ...inRegola, certificato: { conFile: false }, pagamento: { stato: 'da_pagare' } })), [null, null])
const senzaTessera = { ...inRegola, iscrizioni: [{ corsoId: 'judo', dal: '2026-09-14' }], tessere: [] }
ok('tessera mancante: DOCUMENTI rosso', segni(senzaTessera).documenti, { parola: 'DA SISTEMARE', tono: 'rosso' })
ok('tessere undefined: nessun timbro tessera, nessun segno', segni({ ...senzaTessera, tessere: undefined }), SENZA)
ok('tessera valida: nessun segno', segni({ ...senzaTessera, tessere: [{ ente: 'FIJLKAM', dal: '2026-09-01', al: '2026-12-31', tipo: 'praticante' }] }).documenti, null)
ok('disattivata con tessera mancante: nessun segno (il timbro tessera è grigio)', segni({ ...senzaTessera, attiva: false }), SENZA)
ok('disattivata (timbri grigi): nessun segno di timbro', segni({ ...inRegola, attiva: false, certificato: { conFile: false }, documento: false, pagamento: { stato: 'da_pagare' } }), SENZA)

console.log('\nI corsi scaduti sulla QUOTA')
const scoperti = (p, sc) => f('segniSchede', p, corsi, OGGI, { aperta: 'persona', inModifica: false }, sc).quota
ok('quota a posto e un corso scaduto: QUOTA rossa, «CORSO SCADUTO»', scoperti(inRegola, [{ corsoId: 'judo', corso: 'Judo 3', come: 'scaduto' }]), { parola: 'CORSO SCADUTO', tono: 'rosso' })
ok('quota a posto e un corso pagato in parte: QUOTA gialla', scoperti(inRegola, [{ corsoId: 'judo', corso: 'Judo 3', come: 'in_parte', mancano: 4000 }]), { parola: 'CORSO SCADUTO', tono: 'giallo' })
ok('quota da pagare e corso scaduto: vale «DA PAGARE»', scoperti({ ...inRegola, pagamento: { stato: 'da_pagare' } }, [{ corsoId: 'judo', corso: 'Judo 3', come: 'scaduto' }]), { parola: 'DA PAGARE', tono: 'rosso' })
ok('nessun corso scoperto: nessun segno', scoperti(inRegola, []), null)

console.log('\nIN MODIFICA su PERSONA')
ok('modifica aperta e un’altra scheda aperta: PERSONA «IN MODIFICA»', segni(inRegola, 'quota', true).persona?.parola, 'IN MODIFICA')
ok('modifica aperta ma PERSONA è quella aperta: niente segno', segni(inRegola, 'persona', true).persona, null)
ok('nessuna modifica: niente segno', segni(inRegola, 'quota', false).persona, null)

console.log('\nQuale scheda si apre')
ok('all’inizio PERSONA', f('schedaIniziale'), 'persona')
ok('cambiando persona: ancora PERSONA', f('schedaIniziale', false), 'persona')
// Dopo UNISCI che tiene la stessa persona la scheda non si ricrea: `onUnite` chiama schedaIniziale() a mano (era il problema «resta su QUOTA»).
ok('dopo una ricevuta fatta: QUOTA', f('schedaIniziale', true), 'quota')
ok('SISTEMARE dal Banco: quota → QUOTA, certificato → DOCUMENTI', [f('schedaPerApertura', 'quota'), f('schedaPerApertura', 'certificato')], ['quota', 'documenti'])
ok('in ogni altro caso PERSONA', [f('schedaPerApertura', null), f('schedaPerApertura', undefined), f('schedaPerApertura', 'boh')], ['persona', 'persona', 'persona'])

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
