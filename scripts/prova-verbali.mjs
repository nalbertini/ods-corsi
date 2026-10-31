// ---------------------------------------------------------------------------
// I verbali delle riunioni, senza browser (`src/lib/verbali.ts`).
//
//   node scripts/prova-verbali.mjs
//
// La segreteria scrive i verbali delle riunioni dei soci e del direttivo (bozza),
// li fa firmare a mano, li scansiona, carica il PDF e li marca «firmato» (si
// registra la data). Un firmato non si modifica: si rettifica con una nota
// datata o si sostituisce il PDF con un motivo. I verbali vecchi (storici) si
// caricano con i requisiti minimi.
//
// L'INTERFACCIA CHE QUESTA PROVA SI ASPETTA da `src/lib/verbali.ts`
// (date `AAAA-MM-GG`, ore `HH:MM`, `oggi` lo passa chi chiama, tutte pure):
//
//   type TipoVerbale = 'soci'|'direttivo'|'soci_direttivo'|'straordinaria'|'elettiva'
//   type Argomento = 'bilancio'|'elezioni'|'quote'|'statuto'|'sede_affitto'|'assicurazioni'|'corsi'|'istruttori'|'varie'|'altro'
//   interface Delibera { id; titolo; argomento: Argomento; esito?: 'approvata'|'respinta'|'rinviata';
//                        comeVotato?: string /* 'all’unanimità'|'a maggioranza'|'alzata di mano'|'per scrutinio'|testo libero */;
//                        annoRif?: number; bilancioTipo?: 'preventivo'|'consuntivo'; note? }
//   interface Carica { carica: string; personaId: string; dal?: string; al? }
//   interface Allegato { id; tipo: 'firmato'|'convocazione'|'fogli_firme'|'bilancio'|'copia_coperta'|'altro';
//                        nome; peso; caricatoIl; convocazioneInviataIl?; sostituitoIl?; motivoSostituzione? }
//   interface Rettifica { data; motivo; testo }
//   interface Verbale { id; anno; numero; tipo; data; oraInizio?; oraFine?; luogo?; odg: string[];
//                       presidenteId?; segretarioId?; aventiDiritto?; presenti?; deleghe?; testo?;
//                       stato: 'bozza'|'firmato'; firmatoIl?; storico: boolean;
//                       delibere: Delibera[]; cariche: Carica[]; allegati: Allegato[]; rettifiche: Rettifica[] }
//
//   numeroDi(v): string                      «n.4-2026»
//   etichettaTipo(t) · etichettaArgomento(a) · etichettaStato(v)
//        stato: «Bozza» · «Firmato il 12 marzo 2026» · «Rettificato» (firmato con ≥1 rettifica)
//   prossimoNumero(verbali, anno): number    max+1 dell'anno, 1 se nessuno
//   cosaNonVaVerbale(v, { staFirmando? }): string | null   (bloccante, italiano)
//   avvisiVerbale(v, altri = []): string[]   (non bloccanti, uno per caso)
//   puoModificare(v) · puoEliminare(v)       solo bozza
//   puoFirmare(v)                            bozza + PDF firmato in vigore + cosaNonVaVerbale(v,{staFirmando:true}) nullo
//   puoRettificare(v) · puoSostituirePdf(v)  solo firmato
//   cosaNonVaRettifica(r) · cosaNonVaSostituzione(motivo)
//   cosaNonVaDataFirma(v, data, oggi): string | null
//   pdfInVigore(v): Allegato | undefined     tipo 'firmato' e sostituitoIl vuoto
//   storiaPdf(v): { quando; cosa; motivo? }[]   dal più vecchio al più nuovo; «Firmato», «Rettificato», «PDF firmato sostituito»
//   cosaNonVaFile({ nome, tipo, peso }): string | null   solo application/pdf, max 20*1024*1024
//   cosaNonVaCaricamento(v, file | undefined, firmatoIl, oggi): string | null   file, poi numero/data/tipo, poi data della firma
//   cercaVerbali(verbali, { anno?, tipo?, argomento?, stato?: 'bozza'|'firmato'|'rettificato', testo? }): Verbale[]
//   ordinaVerbali(verbali): { daCompletare: Verbale[]; firmati: Verbale[] }
//   anniDei(verbali): number[]               decrescente, senza doppioni
//   segretariPossibili(segretariIds, presentiDirettivoIds, persone): Persona[]   per cognome e nome
//
// E in `src/lib/verbaliProva.ts`:
//   verbaliDiProva(oggi): Verbale[]          4 finti: una bozza, due firmati, uno firmato con rettifica
//   creaVerbaliProva(): Promise<DatiVerbali> come `creaGareProva()` di gareDati.ts (che NON prende l'archivio:
//        lo importa da sé; qui legge/scrive `archivio.dati.verbali: Verbale[]`)
//     DatiVerbali = {
//       leggi(): Promise<Verbale[]>
//       salva(v: Omit<Verbale,'id'> & { id?: string }): Promise<string>   solo bozze; torna l'id
//       elimina(id): Promise<void>                                        solo bozze
//       caricaPdf(id, { nome, peso }): Promise<void>                      il PDF firmato (anche per la bozza)
//       firma(id, data): Promise<void>                                    richiede il PDF
//       rettifica(id, { data, motivo, testo }): Promise<void>
//       sostituisciPdf(id, { nome, peso }, motivo): Promise<void>         il vecchio resta nella storia
//     }
//   Ogni rifiuto è un Error con una frase italiana.
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

// Oggi, per la prova, è domenica 25 ottobre 2026 a mezzogiorno.
const OGGI_MS = new Date(2026, 9, 25, 12, 0).getTime()
const DateVera = Date
globalThis.Date = class extends DateVera {
  constructor(...a) {
    super(...(a.length ? a : [OGGI_MS]))
  }
  static now() {
    return OGGI_MS
  }
}
const OGGI = '2026-10-25'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export * from './src/lib/verbali'; export { archivio } from './src/lib/archivioProva'; export { verbaliDiProva, creaVerbaliProva } from './src/lib/verbaliProva'",
    resolveDir: '.',
    loader: 'ts',
  },
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
// Un rifiuto che dice cosa fare: una frase italiana, mai un testo tecnico.
const errore = (f) => {
  try {
    return f()
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
const parla = (msg, parola) => typeof msg === 'string' && new RegExp(parola, 'i').test(msg) && !/\bundefined\b|\bnull\b|\[object|TypeError/.test(msg)

// --- i dati -----------------------------------------------------------------
const pdf = (extra = {}) => ({ id: 'a1', tipo: 'firmato', nome: 'verbale-firmato.pdf', peso: 200000, caricatoIl: '2026-03-12', ...extra })
const bozza = (extra = {}) => ({
  id: 'v1', anno: 2026, numero: 4, tipo: 'direttivo', data: '2026-03-10', odg: [], stato: 'bozza', storico: false,
  delibere: [], cariche: [], allegati: [], rettifiche: [], ...extra,
})
// Un verbale completo, pronto da firmare.
const completo = (extra = {}) => bozza({
  oraInizio: '18:00', oraFine: '19:30', luogo: 'Sede', odg: ['Bilancio'], presidenteId: 'p1', segretarioId: 'p2',
  aventiDiritto: 20, presenti: 12, deleghe: 2, allegati: [pdf()], ...extra,
})
const firmato = (extra = {}) => completo({ stato: 'firmato', firmatoIl: '2026-03-12', ...extra })
const delibera = (extra = {}) => ({ id: 'd1', titolo: 'Approvazione bilancio', argomento: 'bilancio', ...extra })
const persona = (id, nome, cognome) => ({ id, nome, cognome })

// ---------------------------------------------------------------------------
console.log('\n1 · ETICHETTE E NUMERO')
ok('il numero è n.4-2026', m.numeroDi(bozza()), 'n.4-2026')
ok('tipo soci', m.etichettaTipo('soci'), 'Assemblea dei soci')
ok('tipo direttivo', m.etichettaTipo('direttivo'), 'Direttivo')
ok('tipo soci e direttivo', m.etichettaTipo('soci_direttivo'), 'Soci e direttivo')
ok('tipo straordinaria', m.etichettaTipo('straordinaria'), 'Assemblea straordinaria')
ok('tipo elettiva', m.etichettaTipo('elettiva'), 'Assemblea elettiva')
const ARG = { bilancio: 'Bilancio', elezioni: 'Elezioni', quote: 'Quote', statuto: 'Statuto', sede_affitto: 'Sede e affitto', assicurazioni: 'Assicurazioni', corsi: 'Andamento e apertura dei corsi', istruttori: 'Andamento e inserimento di istruttori', varie: 'Cena e feste di Natale (varie)', altro: 'Altro' }
for (const [id, et] of Object.entries(ARG)) ok(`argomento ${id}`, m.etichettaArgomento(id), et)
ok('la bozza è «Bozza»', m.etichettaStato(bozza()), 'Bozza')
ok('il firmato dice quando', m.etichettaStato(firmato({ firmatoIl: '2026-03-12' })), 'Firmato il 12 marzo 2026')
// «Rettificato» è un segno a parte accanto a «Firmato il …»: la data della firma resta leggibile.
ok('il firmato con una rettifica dice ancora quando', m.etichettaStato(firmato({ firmatoIl: '2026-03-12', rettifiche: [{ data: '2026-04-01', motivo: 'refuso', testo: 'Presenti 12, non 21' }] })), 'Firmato il 12 marzo 2026')

// ---------------------------------------------------------------------------
console.log('\n2 · PROSSIMO NUMERO')
ok('nessun verbale: il numero 1', m.prossimoNumero([], 2026), 1)
ok('max + 1 dell’anno', m.prossimoNumero([bozza({ numero: 1 }), bozza({ id: 'v2', numero: 3 }), bozza({ id: 'v3', numero: 2 })], 2026), 4)
ok('gli altri anni non contano', m.prossimoNumero([bozza({ numero: 9, anno: 2025 })], 2026), 1)
ok('con un buco si va dopo il massimo', m.prossimoNumero([bozza({ numero: 1 }), bozza({ id: 'v2', numero: 5 })], 2026), 6)

// ---------------------------------------------------------------------------
console.log('\n3 · COSA NON VA: la bozza ha bisogno di poco')
ok('numero, data e tipo bastano per una bozza', m.cosaNonVaVerbale(bozza()), null)
ok('senza data lo dice', parla(m.cosaNonVaVerbale(bozza({ data: '' })), 'data'), true)
ok('senza tipo lo dice', parla(m.cosaNonVaVerbale(bozza({ tipo: undefined })), 'tipo'), true)
ok('senza numero lo dice', parla(m.cosaNonVaVerbale(bozza({ numero: undefined })), 'numero'), true)
ok('numero zero non vale, e non dice che manca', [parla(m.cosaNonVaVerbale(bozza({ numero: 0 })), '1 in su'), parla(m.cosaNonVaVerbale(bozza({ numero: 0 })), 'Manca')], [true, false])
ok('numero negativo o con la virgola non vale', [parla(m.cosaNonVaVerbale(bozza({ numero: -1 })), '1 in su'), parla(m.cosaNonVaVerbale(bozza({ numero: 1.5 })), '1 in su')], [true, true])
ok('senza numero dice che manca', parla(m.cosaNonVaVerbale(bozza({ numero: undefined })), 'Manca'), true)
ok('una delibera senza titolo non va', parla(m.cosaNonVaVerbale(bozza({ delibere: [delibera({ titolo: '   ' })] })), 'delibera'), true)
ok('una delibera col titolo va', m.cosaNonVaVerbale(bozza({ delibere: [delibera()] })), null)
ok('una carica che finisce prima di cominciare non va', parla(m.cosaNonVaVerbale(bozza({ cariche: [{ carica: 'Presidente', personaId: 'p1', dal: '2026-03-01', al: '2026-02-01' }] })), 'carica'), true)
ok('una carica dal e al lo stesso giorno va', m.cosaNonVaVerbale(bozza({ cariche: [{ carica: 'Presidente', personaId: 'p1', dal: '2026-03-01', al: '2026-03-01' }] })), null)
ok('una carica senza fine va', m.cosaNonVaVerbale(bozza({ cariche: [{ carica: 'Presidente', personaId: 'p1', dal: '2026-03-01' }] })), null)

console.log('\n4 · COSA NON VA: per firmare bastano numero, data, tipo e PDF')
const F = { staFirmando: true }
const scarno = (extra = {}) => bozza({ allegati: [pdf()], ...extra })
ok('il verbale completo si può firmare', m.cosaNonVaVerbale(completo(), F), null)
ok('un verbale non storico con solo numero, data, tipo e PDF si può firmare', m.cosaNonVaVerbale(scarno(), F), null)
// Regola nuova (ora, luogo, odg, presidente, segretario, presenti stanno nel PDF): non bloccano più la firma.
ok('senza ora d’inizio si firma', m.cosaNonVaVerbale(completo({ oraInizio: undefined }), F), null)
ok('senza luogo si firma', m.cosaNonVaVerbale(completo({ luogo: '' }), F), null)
ok('senza ordine del giorno si firma', m.cosaNonVaVerbale(completo({ odg: [] }), F), null)
ok('con un ordine del giorno di righe vuote si firma', m.cosaNonVaVerbale(completo({ odg: ['  '] }), F), null)
ok('senza presidente si firma', m.cosaNonVaVerbale(completo({ presidenteId: undefined }), F), null)
ok('senza segretario si firma', m.cosaNonVaVerbale(completo({ segretarioId: undefined }), F), null)
ok('senza presenti si firma', m.cosaNonVaVerbale(completo({ presenti: undefined }), F), null)
ok('con zero presenti si firma', m.cosaNonVaVerbale(completo({ presenti: 0 }), F), null)
ok('senza PDF firmato', parla(m.cosaNonVaVerbale(completo({ allegati: [] }), F), 'pdf'), true)
ok('un PDF sostituito non è in vigore', parla(m.cosaNonVaVerbale(completo({ allegati: [pdf({ sostituitoIl: '2026-04-01' })] }), F), 'pdf'), true)
ok('un allegato che non è il firmato non basta', parla(m.cosaNonVaVerbale(completo({ allegati: [pdf({ tipo: 'convocazione' })] }), F), 'pdf'), true)
ok('senza PDF, non storico, dice ancora del PDF e non d’altro', parla(m.cosaNonVaVerbale(scarno({ allegati: [] }), F), 'pdf') && !/\bora\b|luogo|presidente|segretario|presenti/i.test(m.cosaNonVaVerbale(scarno({ allegati: [] }), F)), true)
ok('la stessa bozza senza PDF passa se non si firma', m.cosaNonVaVerbale(completo({ allegati: [] })), null)

console.log('\n5 · COSA NON VA: lo storico chiede il minimo')
ok('storico: numero, data, tipo e PDF bastano', m.cosaNonVaVerbale(bozza({ storico: true, allegati: [pdf()] }), F), null)
ok('storico senza PDF no', parla(m.cosaNonVaVerbale(bozza({ storico: true }), F), 'pdf'), true)
ok('storico senza data no', parla(m.cosaNonVaVerbale(bozza({ storico: true, data: '', allegati: [pdf()] }), F), 'data'), true)
ok('storico senza luogo e presidente passa', m.cosaNonVaVerbale(bozza({ storico: true, allegati: [pdf()], luogo: undefined, presidenteId: undefined }), F), null)

// ---------------------------------------------------------------------------
console.log('\n6 · AVVISI: non bloccano, uno per caso')
ok('nessun avviso su un verbale ben fatto', m.avvisiVerbale(completo()), [])
ok('nessun avviso su uno storico scarno', m.avvisiVerbale(bozza({ storico: true, allegati: [pdf()] })), [])
ok('campi importanti vuoti: nessun avviso', m.avvisiVerbale(bozza()), [])
// Ora, luogo, odg, presidente, segretario, presenti non servono più per firmare: niente «Per firmare mancano».
const nessunPerFirmare = (extra) => m.avvisiVerbale(completo(extra)).some((x) => /Per firmare/i.test(x))
for (const [campo, extra] of [['ora d’inizio', { oraInizio: undefined }], ['luogo', { luogo: '  ' }], ['ordine del giorno', { odg: ['', ' '] }], ['presidente', { presidenteId: undefined }], ['segretario', { segretarioId: undefined }], ['presenti', { presenti: 0 }]]) {
  ok(`manca solo ${campo}: nessun avviso «Per firmare»`, nessunPerFirmare(extra), false)
}
ok('non storico senza ora, luogo, presidente e presenti: nessun avviso «Per firmare»', m.avvisiVerbale(bozza({ allegati: [pdf()] })).some((x) => /Per firmare/i.test(x)), false)
ok('presenti più deleghe oltre gli aventi diritto', m.avvisiVerbale(completo({ aventiDiritto: 10, presenti: 9, deleghe: 2 })).length, 1)
ok('presenti più deleghe pari agli aventi diritto: niente', m.avvisiVerbale(completo({ aventiDiritto: 11, presenti: 9, deleghe: 2 })), [])
ok('anno del numero diverso dall’anno della data', m.avvisiVerbale(completo({ anno: 2025, data: '2026-03-10' })).length, 1)
ok('numero già usato nell’anno', m.avvisiVerbale(completo(), [completo({ id: 'v9' })]).length, 1)
// Il database rifiuta il doppione: l'avviso deve dire che così non si carica.
ok('il numero doppio dice che non si carica', parla(m.avvisiVerbale(completo(), [completo({ id: 'v9' })])[0], 'non si carica'), true)
ok('lo stesso numero in un altro anno va bene', m.avvisiVerbale(completo(), [completo({ id: 'v9', anno: 2025, data: '2025-03-10' })]), [])
ok('il verbale stesso nell’elenco non è un doppione', m.avvisiVerbale(completo(), [completo()]), [])
ok('ora di fine prima dell’inizio', m.avvisiVerbale(completo({ oraInizio: '19:00', oraFine: '18:00' })).length, 1)
ok('ora di fine uguale all’inizio: niente', m.avvisiVerbale(completo({ oraInizio: '19:00', oraFine: '19:00' })), [])
ok('due bilanci uguali (tipo e anno)', m.avvisiVerbale(completo({ delibere: [delibera({ bilancioTipo: 'consuntivo', annoRif: 2025 }), delibera({ id: 'd2', bilancioTipo: 'consuntivo', annoRif: 2025 })] })).length, 1)
ok('preventivo e consuntivo dello stesso anno vanno bene', m.avvisiVerbale(completo({ delibere: [delibera({ bilancioTipo: 'preventivo', annoRif: 2026 }), delibera({ id: 'd2', bilancioTipo: 'consuntivo', annoRif: 2026 })] })), [])
ok('due delibere non di bilancio uguali non avvisano', m.avvisiVerbale(completo({ delibere: [delibera({ argomento: 'quote' }), delibera({ id: 'd2', argomento: 'quote' })] })), [])
ok('due casi insieme: due avvisi', m.avvisiVerbale(completo({ oraInizio: '19:00', oraFine: '18:00', aventiDiritto: 5 })).length, 2)

// ---------------------------------------------------------------------------
console.log('\n7 · CHI PUÒ FARE COSA')
ok('la bozza si modifica', m.puoModificare(bozza()), true)
ok('il firmato no', m.puoModificare(firmato()), false)
ok('la bozza si elimina', m.puoEliminare(bozza()), true)
ok('il firmato non si elimina', m.puoEliminare(firmato()), false)
ok('il rettificato non si elimina', m.puoEliminare(firmato({ rettifiche: [{ data: '2026-04-01', motivo: 'm', testo: 't' }] })), false)
ok('la bozza completa col PDF si firma', m.puoFirmare(completo()), true)
ok('senza PDF non si firma', m.puoFirmare(completo({ allegati: [] })), false)
ok('con solo un PDF sostituito non si firma', m.puoFirmare(completo({ allegati: [pdf({ sostituitoIl: '2026-04-01' })] })), false)
ok('senza il luogo si firma lo stesso', m.puoFirmare(completo({ luogo: '' })), true)
ok('lo storico col PDF si firma', m.puoFirmare(bozza({ storico: true, allegati: [pdf()] })), true)
ok('il già firmato non si firma di nuovo', m.puoFirmare(firmato()), false)
ok('il firmato si rettifica', m.puoRettificare(firmato()), true)
ok('la bozza non si rettifica', m.puoRettificare(bozza()), false)
ok('il firmato ha il PDF da sostituire', m.puoSostituirePdf(firmato()), true)
ok('la bozza non ha il PDF da sostituire', m.puoSostituirePdf(bozza()), false)

// ---------------------------------------------------------------------------
console.log('\n8 · RETTIFICA, SOSTITUZIONE, DATA DELLA FIRMA')
ok('rettifica completa', m.cosaNonVaRettifica({ data: '2026-04-01', motivo: 'Refuso', testo: 'Presenti 12' }), null)
ok('rettifica senza motivo', parla(m.cosaNonVaRettifica({ data: '2026-04-01', motivo: '', testo: 'Presenti 12' }), 'motivo'), true)
ok('rettifica con motivo di soli spazi', parla(m.cosaNonVaRettifica({ data: '2026-04-01', motivo: '   ', testo: 'x' }), 'motivo'), true)
ok('rettifica senza testo', parla(m.cosaNonVaRettifica({ data: '2026-04-01', motivo: 'Refuso', testo: ' ' }), 'testo|nota|cosa'), true)
ok('sostituzione col motivo', m.cosaNonVaSostituzione('Scansione illeggibile'), null)
ok('sostituzione senza motivo', parla(m.cosaNonVaSostituzione(''), 'motivo'), true)
ok('sostituzione con motivo di soli spazi', parla(m.cosaNonVaSostituzione('  \n '), 'motivo'), true)
const rimini = bozza({ data: '2026-10-20' })
ok('la firma oggi va', m.cosaNonVaDataFirma(rimini, OGGI, OGGI), null)
ok('la firma nel giorno della riunione va', m.cosaNonVaDataFirma(rimini, '2026-10-20', OGGI), null)
ok('la firma nel futuro no', parla(m.cosaNonVaDataFirma(rimini, '2026-10-26', OGGI), 'futur|oggi'), true)
ok('la firma senza data no', parla(m.cosaNonVaDataFirma(rimini, '', OGGI), 'data'), true)
ok('la firma prima della riunione no', parla(m.cosaNonVaDataFirma(rimini, '2026-10-19', OGGI), 'riunione'), true)

// ---------------------------------------------------------------------------
console.log('\n9 · IL PDF IN VIGORE E LA STORIA')
ok('senza allegati nessun PDF in vigore', m.pdfInVigore(bozza()), undefined)
ok('il PDF firmato è in vigore', m.pdfInVigore(completo())?.id, 'a1')
ok('il sostituito non lo è', m.pdfInVigore(completo({ allegati: [pdf({ sostituitoIl: '2026-04-01' })] })), undefined)
ok('fra due, vale quello non sostituito', m.pdfInVigore(completo({ allegati: [pdf({ sostituitoIl: '2026-04-01' }), pdf({ id: 'a2', caricatoIl: '2026-04-01' })] }))?.id, 'a2')
ok('la convocazione non è il firmato', m.pdfInVigore(completo({ allegati: [pdf({ tipo: 'convocazione' })] })), undefined)
ok('la bozza non ha storia', m.storiaPdf(bozza()), [])
ok('il firmato ha una voce «Firmato»', m.storiaPdf(firmato()), [{ quando: '2026-03-12', cosa: 'Firmato' }])
const lunga = firmato({
  rettifiche: [{ data: '2026-05-02', motivo: 'Refuso', testo: 'Presenti 12' }],
  allegati: [pdf({ sostituitoIl: '2026-04-01', motivoSostituzione: 'Scansione storta' }), pdf({ id: 'a2', caricatoIl: '2026-04-01' })],
})
ok('la storia va dal più vecchio al più nuovo, coi motivi', m.storiaPdf(lunga), [
  { quando: '2026-03-12', cosa: 'Firmato' },
  { quando: '2026-04-01', cosa: 'PDF firmato sostituito', motivo: 'Scansione storta' },
  { quando: '2026-05-02', cosa: 'Rettificato', motivo: 'Refuso' },
])

// ---------------------------------------------------------------------------
console.log('\n10 · IL FILE')
const MB = 1024 * 1024
ok('un PDF piccolo va', m.cosaNonVaFile({ nome: 'v.pdf', tipo: 'application/pdf', peso: 300000 }), null)
ok('un PDF di 20 MB esatti va', m.cosaNonVaFile({ nome: 'v.pdf', tipo: 'application/pdf', peso: 20 * MB }), null)
ok('un PDF di 20 MB e un byte no', parla(m.cosaNonVaFile({ nome: 'v.pdf', tipo: 'application/pdf', peso: 20 * MB + 1 }), '20 ?MB'), true)
ok('una foto no', parla(m.cosaNonVaFile({ nome: 'v.jpg', tipo: 'image/jpeg', peso: 1000 }), 'pdf'), true)
ok('un Word no', parla(m.cosaNonVaFile({ nome: 'v.docx', tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', peso: 1000 }), 'pdf'), true)
ok('un file senza nome no', parla(m.cosaNonVaFile({ nome: '  ', tipo: 'application/pdf', peso: 1000 }), 'nome'), true)
ok('un file vuoto no', typeof m.cosaNonVaFile({ nome: 'v.pdf', tipo: 'application/pdf', peso: 0 }), 'string')

console.log('\n10b · IL CARICAMENTO: la riunione + il PDF firmato')
const FILE = { nome: 'v.pdf', tipo: 'application/pdf', peso: 300000 }
const carica = (v, file, firmatoIl, oggi = OGGI) => (typeof m.cosaNonVaCaricamento === 'function' ? m.cosaNonVaCaricamento(v, file, firmatoIl, oggi) : 'cosaNonVaCaricamento non esiste')
ok('la funzione esiste', typeof m.cosaNonVaCaricamento, 'function')
ok('tutto giusto: va', carica(bozza(), FILE, '2026-03-12'), null)
ok('non chiede ora, luogo, ordine del giorno, presidente, segretario, presenti', carica(bozza({ oraInizio: undefined, luogo: undefined, odg: [], presidenteId: undefined, segretarioId: undefined, presenti: undefined }), FILE, '2026-03-12'), null)
ok('senza file dice di scegliere il PDF', parla(carica(bozza(), undefined, '2026-03-12'), 'pdf'), true)
ok('un file che non è PDF non va', parla(carica(bozza(), { ...FILE, tipo: 'image/jpeg' }, '2026-03-12'), 'pdf'), true)
ok('un PDF troppo grande non va', parla(carica(bozza(), { ...FILE, peso: 20 * MB + 1 }, '2026-03-12'), '20 ?MB'), true)
ok('senza data della riunione lo dice', parla(carica(bozza({ data: '' }), FILE, '2026-03-12'), 'data'), true)
ok('senza numero lo dice', parla(carica(bozza({ numero: undefined }), FILE, '2026-03-12'), 'numero'), true)
ok('senza tipo lo dice', parla(carica(bozza({ tipo: undefined }), FILE, '2026-03-12'), 'tipo'), true)
ok('firma senza data lo dice', parla(carica(bozza(), FILE, ''), 'data'), true)
ok('firma nel futuro non va', parla(carica(bozza(), FILE, '2026-10-26'), 'futur|oggi'), true)
ok('firma prima della riunione non va', parla(carica(bozza(), FILE, '2026-03-09'), 'riunione'), true)
ok('firma nel giorno della riunione va', carica(bozza(), FILE, '2026-03-10'), null)
ok('uno storico in bozza si completa allo stesso modo', carica(bozza({ storico: true }), FILE, '2026-03-12'), null)

console.log('\n10c · CARICARE: salva, PDF e firma, e se un passo cade non nasce un doppione')
// Dati finti in memoria: caricaPdf cade la prima volta.
const finto = () => {
  const salvati = []
  let cadute = 1
  return {
    salvati,
    async salva(v) { if (v.id) return v.id; salvati.push(v); return `n${salvati.length}` },
    async caricaPdf() { if (cadute-- > 0) throw new Error('rete giù') },
    async firma() {},
  }
}
const nuovo = { ...bozza(), id: undefined }
if (typeof m.caricaVerbaleFirmato !== 'function') ok('caricaVerbaleFirmato esiste', typeof m.caricaVerbaleFirmato, 'function')
else {
  const f = finto()
  let tenuto
  const primo = await m.caricaVerbaleFirmato(f, nuovo, { nome: 'v.pdf', peso: 1 }, '2026-03-12', (id) => (tenuto = id)).then(() => 'fatto', (x) => x.message)
  ok('il primo tentativo cade col PDF', primo, 'rete giù')
  ok('ma l’id della bozza creata arriva a chi chiama', tenuto, 'n1')
  const secondo = await m.caricaVerbaleFirmato(f, { ...nuovo, id: tenuto }, { nome: 'v.pdf', peso: 1 }, '2026-03-12', (id) => (tenuto = id))
  ok('il secondo riusa la stessa bozza', secondo, 'n1')
  ok('nasce un verbale solo', f.salvati.length, 1)
}

// ---------------------------------------------------------------------------
console.log('\n11 · CERCARE')
const v1 = firmato({ id: 'v1', numero: 1, tipo: 'soci', data: '2026-02-01', anno: 2026, delibere: [delibera({ titolo: 'Approvazione consuntivo', argomento: 'bilancio' })], allegati: [pdf({ nome: 'perizia-segreta.pdf' })] })
const v2 = bozza({ id: 'v2', numero: 2, tipo: 'direttivo', data: '2026-06-10', odg: ['Rinnovo della polizza'], delibere: [delibera({ id: 'd2', titolo: 'Nuovo contratto', argomento: 'sede_affitto' })] })
const v3 = firmato({ id: 'v3', numero: 3, tipo: 'direttivo', data: '2025-11-05', anno: 2025, testo: 'Si discute dell’iscrizione dei bimbi', rettifiche: [{ data: '2025-12-01', motivo: 'm', testo: 't' }], allegati: [pdf()] })
const tutti = [v1, v2, v3]
const ids = (l) => l.map((v) => v.id).sort()
ok('senza filtri: tutti', ids(m.cercaVerbali(tutti, {})), ['v1', 'v2', 'v3'])
ok('per anno', ids(m.cercaVerbali(tutti, { anno: 2025 })), ['v3'])
ok('per tipo', ids(m.cercaVerbali(tutti, { tipo: 'direttivo' })), ['v2', 'v3'])
ok('per stato bozza', ids(m.cercaVerbali(tutti, { stato: 'bozza' })), ['v2'])
ok('per stato firmato: il rettificato no', ids(m.cercaVerbali(tutti, { stato: 'firmato' })), ['v1'])
ok('per stato rettificato', ids(m.cercaVerbali(tutti, { stato: 'rettificato' })), ['v3'])
ok('per argomento', ids(m.cercaVerbali(tutti, { argomento: 'bilancio' })), ['v1'])
ok('i filtri sono in AND', ids(m.cercaVerbali(tutti, { tipo: 'direttivo', anno: 2026 })), ['v2'])
ok('nessuno corrisponde', m.cercaVerbali(tutti, { tipo: 'elettiva' }), [])
ok('il testo cerca nel titolo di una delibera, senza maiuscole', ids(m.cercaVerbali(tutti, { testo: 'CONSUNTIVO' })), ['v1'])
ok('il testo cerca nell’etichetta dell’argomento', ids(m.cercaVerbali(tutti, { testo: 'affitto' })), ['v2'])
ok('il testo cerca nell’ordine del giorno', ids(m.cercaVerbali(tutti, { testo: 'polizza' })), ['v2'])
ok('il testo cerca nel testo scritto, senza accenti', ids(m.cercaVerbali(tutti, { testo: 'iscrizione dei bimbi' })), ['v3'])
ok('il testo cerca il numero', ids(m.cercaVerbali(tutti, { testo: 'n.3-2025' })), ['v3'])
ok('il testo non cerca nel nome del PDF', m.cercaVerbali(tutti, { testo: 'perizia' }), [])
ok('il testo si unisce agli altri filtri', m.cercaVerbali(tutti, { testo: 'polizza', anno: 2025 }), [])

console.log('\n12 · ORDINE E ANNI')
const a = bozza({ id: 'a', numero: 5, data: '2026-05-01' })
const b = bozza({ id: 'b', numero: 6, data: '2026-07-01' })
const c = firmato({ id: 'c', numero: 2, data: '2026-03-01' })
const d = firmato({ id: 'd', numero: 3, data: '2026-03-01' })
const e = firmato({ id: 'e', numero: 1, data: '2026-09-01', rettifiche: [{ data: '2026-09-10', motivo: 'm', testo: 't' }] })
const o = m.ordinaVerbali([c, a, e, b, d])
ok('le bozze in cima, le più recenti prima', o.daCompletare.map((v) => v.id), ['b', 'a'])
ok('i firmati per data decrescente, a parità per numero decrescente', o.firmati.map((v) => v.id), ['e', 'd', 'c'])
ok('niente verbali: due elenchi vuoti', m.ordinaVerbali([]), { daCompletare: [], firmati: [] })
ok('gli anni sono decrescenti e senza doppioni', m.anniDei([v1, v2, v3, bozza({ id: 'z', anno: 2024 })]), [2026, 2025, 2024])
ok('senza verbali nessun anno', m.anniDei([]), [])

console.log('\n13 · IL SEGRETARIO DI SEDUTA')
const gente = [persona('p1', 'Anna', 'Rossi'), persona('p2', 'Marco', 'Bianchi'), persona('p3', 'Luca', 'Bianchi'), persona('p4', 'Elena', 'Verdi')]
ok('solo i segretari presenti, per cognome e nome', m.segretariPossibili(['p1', 'p2', 'p3'], ['p3', 'p1', 'p4'], gente).map((p) => p.id), ['p3', 'p1'])
ok('un segretario assente non compare', m.segretariPossibili(['p2'], ['p1', 'p4'], gente), [])
ok('un presente che non è segretario non compare', m.segretariPossibili(['p1'], ['p4'], gente), [])
ok('senza presenti compaiono tutti i segretari', m.segretariPossibili(['p1', 'p2', 'p3'], [], gente).map((p) => p.id), ['p3', 'p2', 'p1'])
ok('senza segretari nessuno', m.segretariPossibili([], ['p1'], gente), [])
ok('un id che non è nelle persone si salta', m.segretariPossibili(['p1', 'pX'], [], gente).map((p) => p.id), ['p1'])

// ---------------------------------------------------------------------------
console.log('\n14 · I VERBALI DELLA MODALITÀ PROVA')
const finti = m.verbaliDiProva(OGGI)
ok('sono quattro', finti.length, 4)
ok('una bozza', finti.filter((v) => v.stato === 'bozza').length, 1)
ok('tre firmati', finti.filter((v) => v.stato === 'firmato').length, 3)
ok('uno solo rettificato', finti.filter((v) => v.rettifiche.length > 0).length, 1)
ok('i numeri sono unici (anno e numero)', new Set(finti.map(m.numeroDi)).size, 4)
ok('i firmati non storici non hanno nulla che non va', finti.filter((v) => v.stato === 'firmato' && !v.storico).map((v) => m.cosaNonVaVerbale(v, { staFirmando: true })), finti.filter((v) => v.stato === 'firmato' && !v.storico).map(() => null))
ok('ogni firmato ha il PDF in vigore e la data di firma', finti.filter((v) => v.stato === 'firmato').every((v) => m.pdfInVigore(v) && v.firmatoIl), true)
ok('nessuna firma nel futuro', finti.every((v) => !v.firmatoIl || v.firmatoIl <= OGGI), true)
ok('hanno delibere e cariche', finti.some((v) => v.delibere.length > 0) && finti.some((v) => v.cariche.length > 0), true)
ok('la bozza non ha data di firma', finti.filter((v) => v.stato === 'bozza').every((v) => !v.firmatoIl), true)

console.log('\n15 · I DATI IN PROVA')
m.archivio.dati.verbali = m.verbaliDiProva(OGGI)
const dati = await m.creaVerbaliProva()
const letti = await dati.leggi()
const laBozza = letti.find((v) => v.stato === 'bozza')
const unFirmato = letti.find((v) => v.stato === 'firmato')
ok('leggi torna i quattro di prova', letti.length, 4)
const nuovoId = await dati.salva({ ...bozza({ numero: 77, anno: 2026 }), id: undefined })
ok('salva una bozza nuova e torna l’id', typeof nuovoId === 'string' && nuovoId.length > 0, true)
ok('la bozza nuova si legge', (await dati.leggi()).some((v) => v.id === nuovoId && v.stato === 'bozza'), true)
ok('salvare una bozza con una delibera senza titolo è un rifiuto', parla(await dati.salva(bozza({ id: undefined, delibere: [delibera({ titolo: '' })] })).then(() => null, (x) => x.message), 'delibera'), true)
ok('salvare un firmato è un rifiuto', typeof (await dati.salva({ ...unFirmato, testo: 'cambiato' }).then(() => null, (x) => x.message)), 'string')
ok('eliminare un firmato è un rifiuto in italiano', parla(await dati.elimina(unFirmato.id).then(() => null, (x) => x.message), 'firmat|bozz'), true)
ok('il firmato resta', (await dati.leggi()).some((v) => v.id === unFirmato.id), true)
ok('firmare senza PDF è un rifiuto in italiano', parla(await dati.firma(nuovoId, OGGI).then(() => null, (x) => x.message), 'pdf'), true)
ok('il verbale è ancora bozza', (await dati.leggi()).find((v) => v.id === nuovoId).stato, 'bozza')
ok('eliminare una bozza si può', await dati.elimina(nuovoId).then(() => 'fatto', (x) => x.message), 'fatto')
ok('la bozza eliminata non c’è più', (await dati.leggi()).some((v) => v.id === nuovoId), false)

// Dalla bozza completa al firmato, passo per passo.
const idB = await dati.salva({ ...completo({ numero: 78 }), id: undefined, allegati: [] })
await dati.caricaPdf(idB, { nome: 'scansione.pdf', peso: 123456 })
ok('firmare con la data nel futuro è un rifiuto', parla(await dati.firma(idB, '2026-12-31').then(() => null, (x) => x.message), 'futur|oggi'), true)
await dati.firma(idB, '2026-10-24')
const firmatoOra = (await dati.leggi()).find((v) => v.id === idB)
ok('firmata: stato e data registrati', [firmatoOra.stato, firmatoOra.firmatoIl], ['firmato', '2026-10-24'])
// Un non storico con solo numero, data, tipo e PDF si firma (la riunione + il PDF firmato).
const idS = await dati.salva({ ...bozza({ numero: 79 }), id: undefined })
await dati.caricaPdf(idS, { nome: 'solo-pdf.pdf', peso: 5000 })
ok('in prova: firmare un non storico con solo il PDF riesce', await dati.firma(idS, '2026-10-24').then(() => 'fatto', (x) => x.message), 'fatto')
ok('e risulta firmato', (await dati.leggi()).find((v) => v.id === idS).stato, 'firmato')
ok('un firmato non si salva di nuovo', typeof (await dati.salva(firmatoOra).then(() => null, (x) => x.message)), 'string')

ok('rettificare senza motivo è un rifiuto', parla(await dati.rettifica(idB, { data: OGGI, motivo: ' ', testo: 'Presenti 13' }).then(() => null, (x) => x.message), 'motivo'), true)
await dati.rettifica(idB, { data: OGGI, motivo: 'Refuso', testo: 'Presenti 13, non 12' })
ok('la rettifica si aggiunge e il verbale resta firmato', (await dati.leggi()).find((v) => v.id === idB).rettifiche.map((r) => [r.motivo, r.testo]), [['Refuso', 'Presenti 13, non 12']])
ok('rettificare una bozza è un rifiuto', typeof (await dati.rettifica(laBozza.id, { data: OGGI, motivo: 'm', testo: 't' }).then(() => null, (x) => x.message)), 'string')

ok('sostituire il PDF senza motivo è un rifiuto', parla(await dati.sostituisciPdf(idB, { nome: 'nuovo.pdf', peso: 1000 }, '  ').then(() => null, (x) => x.message), 'motivo'), true)
ok('sostituire con un file non PDF o troppo grande è un rifiuto', typeof (await dati.sostituisciPdf(idB, { nome: 'nuovo.pdf', peso: 21 * MB }, 'Scansione storta').then(() => null, (x) => x.message)), 'string')
await dati.sostituisciPdf(idB, { nome: 'nuovo.pdf', peso: 1000 }, 'Scansione storta')
const dopo = (await dati.leggi()).find((v) => v.id === idB)
ok('il PDF in vigore è il nuovo', m.pdfInVigore(dopo)?.nome, 'nuovo.pdf')
ok('il vecchio PDF resta fra gli allegati, sostituito col motivo', dopo.allegati.filter((x) => x.tipo === 'firmato' && x.sostituitoIl).map((x) => [x.nome, x.motivoSostituzione]), [['scansione.pdf', 'Scansione storta']])
ok('la storia li racconta tutti', m.storiaPdf(dopo).map((x) => x.cosa), ['Firmato', 'PDF firmato sostituito', 'Rettificato'])
ok('sostituire il PDF di una bozza è un rifiuto', typeof (await dati.sostituisciPdf(laBozza.id, { nome: 'n.pdf', peso: 1000 }, 'm').then(() => null, (x) => x.message)), 'string')
ok('un id che non c’è dice di ricaricare', typeof (await dati.elimina('non-c-e').then(() => null, (x) => x.message)), 'string')

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
