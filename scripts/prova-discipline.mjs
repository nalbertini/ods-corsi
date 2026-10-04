// ---------------------------------------------------------------------------
// LE DISCIPLINE della palestra (Judo, Lotta, Pilates, Yoga…), senza browser.
//
//   node scripts/prova-discipline.mjs
//
// (`timer/src/lib/discipline.ts`) Una disciplina sola per voce, o nessuna; in
// più «Tutte» (id riservato `tutte`), che non sta nella lista ed è sempre
// scelta valida. La lista la cura la segreteria; quel che arriva dal
// database o da un backup si ripulisce. Gli esercizi, le liste di musica e i
// timer ne portano una; la parte del database è in supabase/prova/discipline.sql.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

// Un modulo che non si carica (manca ancora un file, o un'esportazione) non
// ferma tutto: ogni caso che lo usa fallisce da sé, col motivo.
const importa = async (contents) => {
  try {
    return await importaDavvero(contents)
  } catch (e) {
    const motivo = (e.errors?.[0]?.text ?? e.message).replace(/^/, 'modulo non caricato: ')
    return new Proxy({}, { get: (_, nome) => (nome === 'then' ? undefined : (...a) => { throw new Error(`${motivo} (${String(nome)})`) }) })
  }
}
const importaDavvero = async (contents) => {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
    // libreria.ts apre il collegamento al database: qui non serve.
    define: { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""' },
  })
  return import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))
}

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = async (cosa, f, voluto) => {
  let avuto
  try {
    avuto = await f()
  } catch (e) {
    avuto = `ERRORE: ${e.message}`
  }
  ok(cosa, avuto, voluto)
}

const D = await importa(`
  export * from './timer/src/lib/discipline'
`)
const E = await importa(`
  export { CATEGORIE, catalogoDiPartenza, loadEsercizi } from './timer/src/lib/esercizi'
  export { eserciziDellaPalestra } from './timer/src/lib/impostazioniSala'
  export { leggiSalvataggio } from './timer/src/lib/salvataggio'
`)
const L = await importa(`
  export { schemaDi, workoutDa } from './timer/src/lib/libreria'
`)
const G = await importa(`
  export { gruppiDi } from './timer/src/lib/gruppi'
`)
const I = await importa(`
  export { leggiTimerSala, scaricaDiscipline } from './timer/src/lib/impostazioniSala'
`)

const d = (id, nome) => ({ id, nome })
const lista = [d('judo', 'Judo'), d('lotta', 'Lotta'), d('pilates', 'Pilates'), d('yoga', 'Yoga')]

console.log('Le costanti')
await prova('«Tutte» è riservata', () => [D.TUTTE, D.NOME_TUTTE], ['tutte', 'Tutte'])
await prova('si parte da Judo, Lotta, Pilates, Yoga, in quest\'ordine', () => D.DISCIPLINE_DI_PARTENZA, lista)

console.log('\nLa lista ripulita (disciplineDa)')
await prova('non un array: la lista di partenza', () => [D.disciplineDa(null), D.disciplineDa(undefined), D.disciplineDa('judo'), D.disciplineDa({})], [lista, lista, lista, lista])
await prova('la lista di partenza è una copia, non quella stessa', () => {
  const a = D.disciplineDa(null)
  a.push(d('x', 'X'))
  a[0].nome = 'Cambiato'
  return D.DISCIPLINE_DI_PARTENZA
}, lista)
await prova('un array vuoto resta vuoto: è una scelta', () => D.disciplineDa([]), [])
await prova('una lista buona resta com\'è, nell\'ordine dato', () => D.disciplineDa([d('yoga', 'Yoga'), d('judo', 'Judo')]), [d('yoga', 'Yoga'), d('judo', 'Judo')])
await prova('scarta le voci senza id o nome validi', () =>
  D.disciplineDa([null, 3, 'judo', {}, { id: 'a' }, { nome: 'B' }, { id: 5, nome: 'C' }, { id: 'd', nome: 7 }, d('ok', 'Ok')]), [d('ok', 'Ok')])
await prova('scarta gli id che non sono minuscole, numeri e trattini, o sono lunghi più di 30', () =>
  D.disciplineDa([d('Judo', 'A'), d('ju do', 'B'), d('jüdo', 'C'), d('', 'D'), d('a'.repeat(31), 'E'), d('a'.repeat(30), 'F'), d('b-2', 'G')]),
  [d('a'.repeat(30), 'F'), d('b-2', 'G')])
await prova('«tutte» non sta nella lista', () => D.disciplineDa([d('tutte', 'Tutte'), d('judo', 'Judo')]), [d('judo', 'Judo')])
await prova('doppioni per id: vale il primo', () => D.disciplineDa([d('judo', 'Judo'), d('judo', 'Altro')]), [d('judo', 'Judo')])
await prova('doppioni per nome, senza badare alle maiuscole', () => D.disciplineDa([d('a', 'Judo'), d('b', 'JUDO')]), [d('a', 'Judo')])
await prova('il nome si pulisce dagli spazi; vuoto o oltre 30 si scarta', () =>
  D.disciplineDa([d('a', '  Judo  '), d('b', '   '), d('c', 'x'.repeat(31)), d('e', 'x'.repeat(30))]), [d('a', 'Judo'), d('e', 'x'.repeat(30))])
await prova('al massimo 20', () => D.disciplineDa(Array.from({ length: 30 }, (_, i) => d('d' + i, 'Disciplina ' + i))).length, 20)
await prova('non muta l\'input', () => {
  const x = [d('a', ' A '), d('a', 'B'), d('Z', 'Z')]
  const prima = JSON.stringify(x)
  D.disciplineDa(x)
  return JSON.stringify(x) === prima
}, true)

console.log('\nIl nome di una disciplina (nomeDisciplinaValido)')
const nv = (nome, eccetto) => D.nomeDisciplinaValido(nome, lista, eccetto)
await prova('un nome nuovo va bene', () => nv('Karate'), null)
await prova('un nome di 30 caratteri va bene', () => nv('x'.repeat(30)), null)
await prova('vuoto o solo spazi: dice di scriverlo', () => [typeof nv(''), typeof nv('   '), nv('') === nv('   ')], ['string', 'string', true])
await prova('oltre 30 caratteri: un messaggio', () => typeof nv('x'.repeat(31)), 'string')
await prova('un doppione, senza badare a maiuscole', () => [typeof nv('judo'), typeof nv('YOGA')], ['string', 'string'])
await prova('né agli spazi attorno', () => typeof nv('  Lotta '), 'string')
await prova('né agli accenti', () => typeof D.nomeDisciplinaValido('Yòga', lista), 'string')
await prova('«Tutte» è riservato, comunque scritto', () => [typeof nv('Tutte'), typeof nv('tutte'), typeof nv(' TUTTE ')], ['string', 'string', 'string'])
await prova('rinominando, la disciplina non confligge con sé stessa', () => nv('judo', 'judo'), null)
await prova('rinominando, confligge con le altre', () => typeof nv('Yoga', 'judo'), 'string')
await prova('i messaggi sono per chi usa l\'app: italiano, senza termini tecnici', () =>
  [nv(''), nv('x'.repeat(31)), nv('Judo'), nv('Tutte')].every((m) => /[a-z]{3}/i.test(m) && !/undefined|null|regex|id\b|error/i.test(m)), true)
await prova('i messaggi differiscono: ognuno dice il suo problema', () => new Set([nv(''), nv('x'.repeat(31)), nv('Judo'), nv('Tutte')]).size, 4)

console.log('\nUna disciplina nuova (nuovaDisciplina)')
await prova('l\'id è il nome in minuscolo con i trattini', () => D.nuovaDisciplina('Krav Maga', lista), d('krav-maga', 'Krav Maga'))
await prova('senza accenti', () => D.nuovaDisciplina('Mobilità', lista).id, 'mobilita')
await prova('il nome si pulisce dagli spazi', () => D.nuovaDisciplina('  Karate  ', lista), d('karate', 'Karate'))
await prova('simboli e spazi doppi diventano un trattino solo, mai ai bordi', () => D.nuovaDisciplina(' Boxe  &  K1! ', lista).id, 'boxe-k1')
await prova('se l\'id c\'è già: -2, poi -3', () => {
  const l = [d('karate', 'Karate'), d('karate-2', 'Karate!')]
  return D.nuovaDisciplina('Karate?', l).id
}, 'karate-3')
await prova('un id già preso da una lista diversa dal nome', () => D.nuovaDisciplina('Judo!', lista).id, 'judo-2')
await prova('l\'id non supera 30 caratteri, nemmeno col suffisso', () => {
  const l = [d('a'.repeat(30), 'A')]
  const n = D.nuovaDisciplina('a'.repeat(30), l)
  return [n.id.length <= 30, n.id !== 'a'.repeat(30), /^[a-z0-9-]{1,30}$/.test(n.id)]
}, [true, true, true])
await prova('l\'id è sempre valido, anche col nome lungo 30 di sole lettere', () => /^[a-z0-9-]{1,30}$/.test(D.nuovaDisciplina('x'.repeat(30), []).id), true)
await prova('non muta la lista', () => {
  const l = [d('a', 'A')]
  D.nuovaDisciplina('B', l)
  return l
}, [d('a', 'A')])

console.log('\nLa disciplina scelta (ripulisciDisciplina)')
await prova('«tutte» vale', () => D.ripulisciDisciplina('tutte', lista), 'tutte')
await prova('una della lista vale', () => D.ripulisciDisciplina('lotta', lista), 'lotta')
await prova('una sconosciuta no (cancellata, o di un altro database)', () => D.ripulisciDisciplina('karate', lista), undefined)
await prova('nulla, vuota o non un testo: nessuna', () =>
  [null, undefined, '', 3, {}].map((x) => D.ripulisciDisciplina(x, lista)), [undefined, undefined, undefined, undefined, undefined])
await prova('maiuscole non valgono: gli id sono minuscoli', () => D.ripulisciDisciplina('Judo', lista), undefined)
await prova('con la lista vuota vale solo «tutte»', () => [D.ripulisciDisciplina('judo', []), D.ripulisciDisciplina('tutte', [])], [undefined, 'tutte'])
await prova('una lista di musica {disciplina}: si ripulisce per voce', () =>
  [{ nome: 'A', disciplina: 'lotta' }, { nome: 'B', disciplina: 'tutte' }, { nome: 'C', disciplina: 'karate' }, { nome: 'D', disciplina: null }, { nome: 'E' }]
    .map((m) => ({ ...m, disciplina: D.ripulisciDisciplina(m.disciplina, lista) })),
  [{ nome: 'A', disciplina: 'lotta' }, { nome: 'B', disciplina: 'tutte' }, { nome: 'C' }, { nome: 'D' }, { nome: 'E' }])

console.log('\nIl filtro (dellaDisciplina)')
const voci = [
  { n: 1, disciplina: 'judo' }, { n: 2 }, { n: 3, disciplina: 'tutte' }, { n: 4, disciplina: 'yoga' },
  { n: 5, disciplina: null }, { n: 6, disciplina: 'judo' }, { n: 7, disciplina: 'tutte' },
]
const ns = (l) => l.map((v) => v.n)
await prova('filtro nullo (TUTTI): tutte le voci, anche senza disciplina', () => ns(D.dellaDisciplina(voci, null)), [1, 2, 3, 4, 5, 6, 7])
await prova('una disciplina: le sue e quelle di «tutte», nell\'ordine di prima', () => ns(D.dellaDisciplina(voci, 'judo')), [1, 3, 6, 7])
await prova('quelle senza disciplina restano fuori', () => ns(D.dellaDisciplina(voci, 'yoga')), [3, 4, 7])
await prova('una disciplina senza voci: solo quelle di «tutte»', () => ns(D.dellaDisciplina(voci, 'lotta')), [3, 7])
await prova('filtro «tutte»: le voci di «tutte»', () => ns(D.dellaDisciplina(voci, 'tutte')), [3, 7])
await prova('un elenco vuoto', () => D.dellaDisciplina([], 'judo'), [])
await prova('non muta l\'elenco', () => {
  const x = [{ n: 1, disciplina: 'judo' }, { n: 2 }]
  D.dellaDisciplina(x, 'judo')
  return x
}, [{ n: 1, disciplina: 'judo' }, { n: 2 }])
await prova('le voci tornano intere (stessi oggetti)', () => D.dellaDisciplina(voci, 'judo')[0] === voci[0], true)

console.log('\nIl catalogo di partenza')
const cat = E.catalogoDiPartenza()
const eraJudo = ['Uchi komi', 'Nage komi', 'Ukemi', 'Ne waza', 'Randori', 'Kuzushi', 'Entrate di seoi nage', 'Passaggi di guardia', 'Sprawl', 'Fuga d’anca', 'Ponte']
await prova('le categorie sono 5, senza «Judo»', () => E.CATEGORIE, ['A corpo libero', 'Attrezzi', 'Core', 'Cardio', 'Mobilità'])
await prova('nessun esercizio ha più la categoria «Judo»', () => cat.filter((e) => e.categoria === 'Judo').length, 0)
await prova('quelli che erano «Judo» sono «A corpo libero» con disciplina judo', () =>
  eraJudo.map((n) => { const e = cat.find((x) => x.nome === n); return [e?.categoria, e?.disciplina] }),
  eraJudo.map(() => ['A corpo libero', 'judo']))
await prova('gli altri non hanno disciplina', () => cat.filter((e) => !eraJudo.includes(e.nome) && e.disciplina !== undefined).length, 0)
await prova('i nomi di prima ci sono tutti', () => cat.length, 11 + 12 + 10 + 8 + 6 + 5)

console.log('\nIl catalogo del database (eserciziDellaPalestra)')
const ep = (g, l) => E.eserciziDellaPalestra(g, l)
const vecchio = (extra = {}) => ({ id: 'e1', nome: 'Randori', categoria: 'Judo', ...extra })
await prova('un catalogo vecchio, senza il campo, funziona uguale', () =>
  ep([{ id: 'a', nome: 'Squat', categoria: 'Core' }]), [{ id: 'a', nome: 'Squat', categoria: 'Core' }])
await prova('«Judo» diventa «A corpo libero» con disciplina judo', () => ep([vecchio()]), [{ id: 'e1', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'judo' }])
await prova('se ha già una disciplina, quella resta', () =>
  ep([vecchio({ disciplina: 'lotta' })]), [{ id: 'e1', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'lotta' }])
await prova('una disciplina valida nella lista si tiene', () =>
  ep([{ id: 'a', nome: 'Asana', categoria: 'Mobilità', disciplina: 'yoga' }], lista), [{ id: 'a', nome: 'Asana', categoria: 'Mobilità', disciplina: 'yoga' }])
await prova('«tutte» si tiene sempre', () =>
  ep([{ id: 'a', nome: 'Corsa', categoria: 'Cardio', disciplina: 'tutte' }], []), [{ id: 'a', nome: 'Corsa', categoria: 'Cardio', disciplina: 'tutte' }])
await prova('una sconosciuta si toglie', () =>
  ep([{ id: 'a', nome: 'Asana', categoria: 'Mobilità', disciplina: 'karate' }], lista), [{ id: 'a', nome: 'Asana', categoria: 'Mobilità' }])
await prova('senza la lista passata vale quella di partenza', () =>
  [ep([{ id: 'a', nome: 'A', categoria: 'Core', disciplina: 'yoga' }])[0].disciplina, ep([{ id: 'a', nome: 'A', categoria: 'Core', disciplina: 'karate' }])[0].disciplina], ['yoga', undefined])
await prova('«Judo» con la disciplina judo tolta dalla lista: resta in «A corpo libero», senza disciplina', () =>
  ep([vecchio()], [d('lotta', 'Lotta')]), [{ id: 'e1', nome: 'Randori', categoria: 'A corpo libero' }])
await prova('un valore che non è un testo si toglie', () =>
  ep([{ id: 'a', nome: 'A', categoria: 'Core', disciplina: 7 }], lista), [{ id: 'a', nome: 'A', categoria: 'Core' }])
await prova('non muta l\'input', () => {
  const x = [vecchio()]
  ep(x, lista)
  return x
}, [vecchio()])
await prova('non un array: nessun catalogo', () => ep('x', lista), null)

console.log('\nIl catalogo nel browser (loadEsercizi) e nel backup (leggiSalvataggio)')
await prova('dal localStorage: «Judo» diventa «A corpo libero» + judo', () => {
  const m = new Map([['ods-timer:esercizi', JSON.stringify([vecchio(), { id: 'b', nome: 'Plank', categoria: 'Core' }])]])
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }
  const r = E.loadEsercizi(lista)
  delete globalThis.localStorage
  return r
}, [{ id: 'e1', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'judo' }, { id: 'b', nome: 'Plank', categoria: 'Core' }])
await prova('dal localStorage: la disciplina sconosciuta si toglie', () => {
  const m = new Map([['ods-timer:esercizi', JSON.stringify([{ id: 'b', nome: 'Plank', categoria: 'Core', disciplina: 'karate' }])]])
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }
  const r = E.loadEsercizi(lista)
  delete globalThis.localStorage
  return r
}, [{ id: 'b', nome: 'Plank', categoria: 'Core' }])
const file = (esercizi) => JSON.stringify({ app: 'ods-timer', versione: 1, quando: 'oggi', timer: [], esercizi, impostazioni: {}, storico: [] })
await prova('dal backup: «Judo» diventa «A corpo libero» + judo', () => E.leggiSalvataggio(file([vecchio()]), lista)?.esercizi,
  [{ id: 'e1', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'judo' }])
await prova('dal backup: disciplina valida tenuta, sconosciuta tolta, «propri» resta', () =>
  E.leggiSalvataggio(file([
    { id: 'a', nome: 'Asana', categoria: 'Mobilità', disciplina: 'yoga', propri: true },
    { id: 'b', nome: 'Altro', categoria: 'Core', disciplina: 'karate' },
  ]), lista)?.esercizi,
  [{ id: 'a', nome: 'Asana', categoria: 'Mobilità', disciplina: 'yoga', propri: true }, { id: 'b', nome: 'Altro', categoria: 'Core' }])
await prova('dal backup, un file vecchio senza il campo funziona uguale', () => E.leggiSalvataggio(file([{ id: 'a', nome: 'Plank', categoria: 'Core' }]))?.esercizi,
  [{ id: 'a', nome: 'Plank', categoria: 'Core' }])

console.log('\nUn timer con la sua disciplina')
const timer = (extra = {}) => ({
  id: 't', name: 'T', mode: 'interval', prepare: 10, work: 40, rest: 20, rounds: 3, sets: 1, setRest: 0,
  cooldown: 0, duration: 600, exercises: [], updatedAt: 0, ...extra,
})
const riga = (schema) => ({ id: 't', persona_id: null, nome: 'T', schema, cambiato_il: '2026-01-01T00:00:00Z' })
await prova('nel database va nello schema', () => L.schemaDi(timer({ disciplina: 'judo' })).disciplina, 'judo')
await prova('uno senza disciplina non ne scrive una', () => 'disciplina' in L.schemaDi(timer()), false)
await prova('in lettura la conserva se è nella lista', () =>
  L.workoutDa(riga(L.schemaDi(timer({ disciplina: 'yoga' }))), null, [], [], lista)?.disciplina, 'yoga')
await prova('«tutte» si conserva', () => L.workoutDa(riga(L.schemaDi(timer({ disciplina: 'tutte' }))), null, [], [], [])?.disciplina, 'tutte')
await prova('un id sconosciuto si ignora, il timer resta', () => {
  const w = L.workoutDa(riga(L.schemaDi(timer({ disciplina: 'karate' }))), null, [], [], lista)
  return [w?.id, w && 'disciplina' in w && w.disciplina !== undefined]
}, ['t', false])
await prova('un timer vecchio, senza il campo, si legge uguale', () => L.workoutDa(riga(L.schemaDi(timer())), null, [], [], lista)?.disciplina, undefined)

console.log('\nUn timer nel backup, e quando la lista non si è letta')
const backupConTimer = (t) => JSON.stringify({ app: 'ods-timer', versione: 1, quando: 'oggi', timer: [t], esercizi: [], impostazioni: {}, storico: [] })
await prova('dal backup: la disciplina del timer resta se è nella lista', () =>
  E.leggiSalvataggio(backupConTimer(timer({ disciplina: 'yoga' })), lista)?.timer[0].disciplina, 'yoga')
await prova('dal backup: «tutte» resta', () => E.leggiSalvataggio(backupConTimer(timer({ disciplina: 'tutte' })), [])?.timer[0].disciplina, 'tutte')
await prova('dal backup: una sconosciuta si toglie, il timer resta', () => {
  const r = E.leggiSalvataggio(backupConTimer(timer({ disciplina: 'karate' })), lista)
  return [r?.timer.length, r?.timer[0].disciplina]
}, [1, undefined])
await prova('dal backup, un timer senza il campo funziona uguale', () => E.leggiSalvataggio(backupConTimer(timer()), lista)?.timer[0].disciplina, undefined)
await prova('lista non letta (null): i timer tengono la loro disciplina, anche una che non conosciamo', () =>
  L.workoutDa(riga(L.schemaDi(timer({ disciplina: 'karate' }))), null, [], [], null)?.disciplina, 'karate')
await prova('lista non letta: un id scritto male non passa lo stesso', () =>
  L.workoutDa(riga({ ...L.schemaDi(timer()), disciplina: 'Karate!' }), null, [], [], null)?.disciplina, undefined)

console.log('\nLa lista letta dal database (leggiTimerSala, scaricaDiscipline)')
const finto = (risposte) => ({
  from: () => ({ select: (colonne) => ({ maybeSingle: async () => risposte(colonne) }) }),
})
const colonnaMancante = { data: null, error: { code: '42703', message: 'column does not exist' } }
await prova('con la colonna: la lista della riga, ripulita', async () => {
  const r = await I.leggiTimerSala(finto(() => ({ data: { timer: {}, voce: null, esercizi: null, discipline: [{ id: 'karate', nome: 'Karate' }, { id: 'x y', nome: 'No' }] }, error: null })))
  return r.discipline
}, [d('karate', 'Karate')])
await prova('senza 40-discipline.sql (colonna mancante): quella di partenza, il resto si legge', async () => {
  const r = await I.leggiTimerSala(finto((c) => (c.includes('discipline') ? colonnaMancante : { data: { timer: {}, voce: 'Elsa', esercizi: [{ id: 'a', nome: 'Squat', categoria: 'Core' }] }, error: null })))
  return [r.discipline, r.voce, r.esercizi?.length]
}, [lista, 'Elsa', 1])
await prova('un altro errore non si nasconde', async () => {
  try {
    await I.leggiTimerSala(finto(() => ({ data: null, error: { code: '57014', message: 'timeout' } })))
    return 'nessun errore'
  } catch (e) {
    return e.message
  }
}, 'timeout')
await prova('scaricaDiscipline: colonna mancante → quella di partenza; array vuoto resta vuoto', async () => [
  await I.scaricaDiscipline(finto(() => colonnaMancante)),
  await I.scaricaDiscipline(finto(() => ({ data: { discipline: [] }, error: null }))),
], [lista, []])

console.log('\nLe discipline che hanno qualcosa (disciplineConVoci)')
const conVoci = (voci) => D.disciplineConVoci(voci, lista).map((x) => x.id)
await prova('solo quelle che compaiono, nell\'ordine della lista', () => conVoci([{ disciplina: 'yoga' }, { disciplina: 'judo' }, { disciplina: 'yoga' }]), ['judo', 'yoga'])
await prova('«tutte» e le voci senza disciplina non ne accendono nessuna', () => conVoci([{ disciplina: 'tutte' }, {}, { disciplina: null }]), [])
await prova('una disciplina sconosciuta non conta', () => conVoci([{ disciplina: 'karate' }]), [])
await prova('nessuna voce: nessuna disciplina', () => conVoci([]), [])
await prova('non muta la lista delle discipline', () => {
  const l = [d('a', 'A'), d('b', 'B')]
  D.disciplineConVoci([{ disciplina: 'b' }], l)
  return l
}, [d('a', 'A'), d('b', 'B')])

console.log('\nLa lista dei timer per disciplina (gruppiDi)')
const t = (id, dove, disciplina, extra = {}) => ({ ...timer({ id, name: id, dove, ...extra }), ...(disciplina ? { disciplina } : {}) })
const elenco = [t('a', 'palestra', 'judo'), t('b', 'palestra', 'lotta'), t('c', 'miei', 'tutte'), t('d', 'palestra'), t('e', 'miei', 'judo')]
const personale = { chi: 'personale', personaId: 'io' }
const idDi = (gruppi) => gruppi.map((g) => [g.chiave, g.timer.map((w) => w.id).sort()])
await prova('senza filtro, uguale a prima', () => idDi(G.gruppiDi(elenco, personale, null)), idDi(G.gruppiDi(elenco, personale, null, null)))
await prova('un filtro: i timer di quella disciplina e quelli di «tutte», nelle loro sezioni', () =>
  idDi(G.gruppiDi(elenco, personale, null, 'judo')), [['miei', ['c', 'e']], ['palestra', ['a']]])
await prova('le sezioni che si svuotano spariscono, anche quella del corso con la frase «nessun timer»', () =>
  G.gruppiDi(elenco, personale, { corsoId: 'c1', sessioneId: null, lezioneId: null, nome: 'Judo' }, 'lotta').map((g) => g.chiave), ['miei', 'palestra'])
await prova('l\'ordine delle sezioni non cambia', () => G.gruppiDi(elenco, personale, null, 'judo').map((g) => g.chiave), ['miei', 'palestra'])
await prova('senza accesso: una sezione sola, filtrata', () => idDi(G.gruppiDi(elenco, { chi: 'nessuno' }, null, 'judo')), [['tutti', ['a', 'c', 'e']]])
await prova('un filtro con solo le voci di «tutte»: solo la loro sezione', () => idDi(G.gruppiDi(elenco, personale, null, 'yoga')), [['miei', ['c']]])
await prova('un filtro che non trova niente, nemmeno «tutte»: nessuna sezione', () => G.gruppiDi(elenco.filter((w) => w.disciplina !== 'tutte'), personale, null, 'yoga'), [])

console.log('\nIl filtro acceso (filtroValido)')
await prova('una disciplina della lista resta', () => D.filtroValido('judo', lista), 'judo')
await prova('una tolta o sconosciuta si spegne', () => D.filtroValido('karate', lista), null)
await prova('nessun filtro resta nessuno', () => D.filtroValido(null, lista), null)
await prova('«tutte» non è un pulsante: non vale come filtro', () => D.filtroValido('tutte', lista), null)
await prova('con la lista vuota nessun filtro vale', () => D.filtroValido('judo', []), null)

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
