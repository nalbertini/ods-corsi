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
//
// Una cosa sola per esercizio: la disciplina (che per chi usa l'app si chiama
// «categoria»). Le vecchie categorie (A corpo libero, Attrezzi, Core, Cardio,
// Mobilità) sono voci della stessa lista, accanto a Judo, Lotta, Pilates, Yoga;
// gli esercizi non hanno più il campo `categoria`, ma lo si legge ancora da
// browser, database e backup vecchi (la parte del database: prova/categorie-esercizi.sql).
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
    define: { __TIMER_RADICE__: '""', 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""' },
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
  export * from './timer/src/lib/esercizi'
  export { eserciziDellaPalestra } from './timer/src/lib/impostazioniSala'
  export { leggiSalvataggio } from './timer/src/lib/salvataggio'
`)
const L = await importa(`
  export { schemaDi, workoutDa } from './timer/src/lib/libreria'
`)
const G = await importa(`
  export { gruppiDi } from './timer/src/lib/gruppi'
`)
const V = await importa(`
  export { exerciseKey } from './timer/src/lib/voiceClips'
`)
const I = await importa(`
  export { leggiTimerSala, scaricaDiscipline } from './timer/src/lib/impostazioniSala'
`)

const d = (id, nome) => ({ id, nome })
const lista = [d('judo', 'Judo'), d('lotta', 'Lotta'), d('pilates', 'Pilates'), d('yoga', 'Yoga')]
// Le ex categorie: i loro id sono quelli che scrive anche la migrazione (supabase/42-categorie-esercizi.sql).
const exCategorie = [d('corpo-libero', 'A corpo libero'), d('attrezzi', 'Attrezzi'), d('core', 'Core'), d('cardio', 'Cardio'), d('mobilita', 'Mobilità')]
const partenza = [...lista, ...exCategorie]

console.log('Le costanti')
await prova('«Tutte» è riservata', () => [D.TUTTE, D.NOME_TUTTE], ['tutte', 'Tutte'])
await prova('si parte da Judo, Lotta, Pilates, Yoga e dalle ex categorie, in quest\'ordine', () => D.DISCIPLINE_DI_PARTENZA, partenza)
await prova('«Tutte» non compare tra le voci di partenza', () => D.DISCIPLINE_DI_PARTENZA.filter((x) => x.id === 'tutte' || x.nome === 'Tutte').length, 0)
await prova('la lista di partenza sta nei limiti (20 voci)', () => D.DISCIPLINE_DI_PARTENZA.length <= D.MAX_DISCIPLINE, true)

console.log('\nLa lista ripulita (disciplineDa)')
await prova('non un array: la lista di partenza', () => [D.disciplineDa(null), D.disciplineDa(undefined), D.disciplineDa('judo'), D.disciplineDa({})], [partenza, partenza, partenza, partenza])
await prova('la lista di partenza è una copia, non quella stessa', () => {
  const a = D.disciplineDa(null)
  a.push(d('x', 'X'))
  a[0].nome = 'Cambiato'
  return D.DISCIPLINE_DI_PARTENZA
}, partenza)
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
const quanti = (id) => cat.filter((e) => e.disciplina === id).length
await prova('gli esercizi non hanno più categorie: né l\'elenco né il tipo', () => [E.CATEGORIE, E.categoriaEDisciplina], [undefined, undefined])
await prova('nessun esercizio ha il campo «categoria»', () => cat.filter((e) => 'categoria' in e).length, 0)
await prova('quelli di judo hanno la voce judo', () =>
  eraJudo.map((n) => cat.find((x) => x.nome === n)?.disciplina), eraJudo.map(() => 'judo'))
await prova('gli altri hanno la voce che era la loro categoria: corpo libero, attrezzi, core, cardio, mobilità', () =>
  [quanti('judo'), quanti('corpo-libero'), quanti('attrezzi'), quanti('core'), quanti('cardio'), quanti('mobilita')], [11, 12, 10, 8, 6, 5])
await prova('una voce per esercizio, e nessuna fuori dalla lista di partenza', () =>
  cat.every((e) => D.DISCIPLINE_DI_PARTENZA.some((x) => x.id === e.disciplina)), true)
await prova('un esempio: Squat è nel corpo libero, Plank nel core', () => [cat.find((e) => e.nome === 'Squat')?.disciplina, cat.find((e) => e.nome === 'Plank')?.disciplina], ['corpo-libero', 'core'])
await prova('i nomi di prima ci sono tutti', () => cat.length, 11 + 12 + 10 + 8 + 6 + 5)

console.log('\nLe voci di un esercizio letto da fuori (disciplinaDi)')
const dd = (categoria, disciplina, l) => E.disciplinaDi(categoria, disciplina, l)
await prova('categoria e disciplina: vince la disciplina', () => dd('A corpo libero', 'judo'), 'judo')
await prova('anche se è un\'altra: Randori in «Judo» con disciplina lotta resta lotta', () => dd('Judo', 'lotta'), 'lotta')
await prova('solo la categoria: diventa la voce con lo stesso nome', () => ['A corpo libero', 'Attrezzi', 'Core', 'Cardio', 'Mobilità'].map((c) => dd(c, undefined)),
  ['corpo-libero', 'attrezzi', 'core', 'cardio', 'mobilita'])
await prova('la vecchia categoria «Judo» senza disciplina: judo', () => dd('Judo', undefined), 'judo')
await prova('solo la disciplina: invariata', () => dd(undefined, 'yoga'), 'yoga')
await prova('«tutte» resta, anche con la lista vuota e con una categoria', () => [dd(undefined, 'tutte', []), dd('Core', 'tutte')], ['tutte', 'tutte'])
await prova('né categoria né disciplina: nessuna voce (è permesso)', () => [dd(undefined, undefined), dd(null, null), dd('', '')], [undefined, undefined, undefined])
await prova('una categoria che non conosciamo: nessuna voce', () => [dd('Boh', undefined), dd(7, undefined)], [undefined, undefined])
await prova('una disciplina tolta dalla lista: nessuna voce, senza ripiego sulla categoria', () => dd('Core', 'karate'), undefined)
await prova('una disciplina nulla o vuota non conta: si guarda la categoria', () => [dd('Core', null), dd('Core', ''), dd('Core', 7)], ['core', 'core', 'core'])
await prova('la voce che era la categoria non c\'è più nella lista (tolta): nessuna voce, l\'esercizio resta', () => [dd('Core', undefined, lista), dd('Judo', undefined, [d('lotta', 'Lotta')])], [undefined, undefined])
await prova('senza la lista passata vale quella di partenza', () => [dd('Core', undefined), dd(undefined, 'karate')], ['core', undefined])

console.log('\nAggiungere esercizi (aggiungiNomi)')
await prova('un elenco incollato: nome e voce, niente categoria', () =>
  E.aggiungiNomi([{ id: 'a', nome: 'Squat', disciplina: 'core' }], ['Plank', 'squat', ' Burpee ', ''], 'corpo-libero').lista.slice(1).map(({ id, ...x }) => [typeof id, x]),
  [['string', { nome: 'Plank', disciplina: 'corpo-libero', propri: true }], ['string', { nome: 'Burpee', disciplina: 'corpo-libero', propri: true }]])
await prova('aggiunti e saltati si dicono', () => {
  const r = E.aggiungiNomi([{ id: 'a', nome: 'Squat' }], ['Plank', 'SQUAT', 'plank'], 'core')
  return [r.aggiunti, r.saltati]
}, [['Plank'], ['SQUAT', 'plank']])
await prova('senza voce è permesso: l\'esercizio non ha il campo', () =>
  E.aggiungiNomi([], ['Plank'], undefined).lista.map(({ id, ...x }) => x), [{ nome: 'Plank', propri: true }])
await prova('con «tutte»', () => E.aggiungiNomi([], ['Corsa'], 'tutte').lista[0].disciplina, 'tutte')

console.log('\nUn solo filtro e un solo raggruppamento')
const esercizi = [
  { id: '1', nome: 'Randori', disciplina: 'judo' }, { id: '2', nome: 'Squat', disciplina: 'core' },
  { id: '3', nome: 'Corsa', disciplina: 'tutte' }, { id: '4', nome: 'Libero' }, { id: '5', nome: 'Kata', disciplina: 'karate' },
  { id: '6', nome: 'Ukemi', disciplina: 'judo' }, { id: '7', nome: 'Plank', disciplina: 'core' },
]
const idsDi = (l) => l.map((e) => e.id)
await prova('filtro su una voce: quella e «Tutte», niente altro', () => idsDi(D.dellaDisciplina(esercizi, 'core')), ['2', '3', '7'])
await prova('i pulsanti del filtro: solo le voci che hanno esercizi, in ordine di lista, mai «Tutte»', () =>
  D.disciplineConVoci(esercizi, partenza).map((x) => x.id), ['judo', 'core'])
await prova('raggruppati: nell\'ordine della lista, poi «Tutte», poi quelli senza voce; le voci vuote non compaiono', () =>
  D.gruppiPerDisciplina(esercizi, partenza).map((g) => [g.chiave, g.nome, idsDi(g.voci)]),
  [['judo', 'Judo', ['1', '6']], ['core', 'Core', ['2', '7']], ['tutte', 'Tutte', ['3']], ['', 'Senza categoria', ['4', '5']]])
await prova('una voce tolta dalla lista: i suoi esercizi non spariscono, finiscono tra quelli senza voce', () =>
  D.gruppiPerDisciplina(esercizi, lista).map((g) => [g.chiave, idsDi(g.voci)]),
  [['judo', ['1', '6']], ['tutte', ['3']], ['', ['2', '4', '5', '7']]])
await prova('filtrati e raggruppati: la voce scelta e «Tutte»', () =>
  D.gruppiPerDisciplina(D.dellaDisciplina(esercizi, 'judo'), partenza).map((g) => g.chiave), ['judo', 'tutte'])
await prova('nessun esercizio: nessun gruppo', () => D.gruppiPerDisciplina([], partenza), [])
await prova('non muta l\'elenco', () => {
  const x = [{ id: 'a', disciplina: 'core' }, { id: 'b' }]
  D.gruppiPerDisciplina(x, partenza)
  return x
}, [{ id: 'a', disciplina: 'core' }, { id: 'b' }])

console.log('\nIl catalogo del database (eserciziDellaPalestra)')
const ep = (g, l) => E.eserciziDellaPalestra(g, l)
const vecchio = (extra = {}) => ({ id: 'e1', nome: 'Randori', categoria: 'Judo', ...extra })
await prova('un catalogo vecchio, {Squat, Core} senza disciplina: la voce core', () =>
  ep([{ id: 'a', nome: 'Squat', categoria: 'Core' }]), [{ id: 'a', nome: 'Squat', disciplina: 'core' }])
await prova('il vecchio «Judo» senza disciplina: judo', () => ep([vecchio()]), [{ id: 'e1', nome: 'Randori', disciplina: 'judo' }])
await prova('{Randori, A corpo libero, judo}: judo, senza errori', () =>
  ep([{ id: 'e1', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'judo' }]), [{ id: 'e1', nome: 'Randori', disciplina: 'judo' }])
await prova('se ha già una disciplina, quella resta', () => ep([vecchio({ disciplina: 'lotta' })]), [{ id: 'e1', nome: 'Randori', disciplina: 'lotta' }])
await prova('una copia nuova, senza categoria, si legge uguale', () =>
  ep([{ id: 'a', nome: 'Asana', disciplina: 'yoga' }, { id: 'b', nome: 'Libero' }], lista), [{ id: 'a', nome: 'Asana', disciplina: 'yoga' }, { id: 'b', nome: 'Libero' }])
await prova('un\'app non aggiornata che scrive ancora la categoria: si legge senza errori, e la categoria non resta', () =>
  ep([{ id: 'a', nome: 'Plank', categoria: 'Core', disciplina: 'yoga' }, { id: 'b', nome: 'Corsa', categoria: 'Cardio' }], lista.concat(exCategorie)),
  [{ id: 'a', nome: 'Plank', disciplina: 'yoga' }, { id: 'b', nome: 'Corsa', disciplina: 'cardio' }])
await prova('«tutte» si tiene sempre', () => ep([{ id: 'a', nome: 'Corsa', categoria: 'Cardio', disciplina: 'tutte' }], []), [{ id: 'a', nome: 'Corsa', disciplina: 'tutte' }])
await prova('una disciplina sconosciuta si toglie, l\'esercizio resta', () =>
  ep([{ id: 'a', nome: 'Asana', categoria: 'Mobilità', disciplina: 'karate' }], lista), [{ id: 'a', nome: 'Asana' }])
await prova('senza la lista passata vale quella di partenza', () =>
  [ep([{ id: 'a', nome: 'A', disciplina: 'yoga' }])[0].disciplina, ep([{ id: 'a', nome: 'A', disciplina: 'karate' }])[0].disciplina, ep([{ id: 'a', nome: 'A', categoria: 'Cardio' }])[0].disciplina],
  ['yoga', undefined, 'cardio'])
await prova('la voce che era la categoria tolta dalla lista: l\'esercizio resta, senza voce', () =>
  ep([{ id: 'a', nome: 'Squat', categoria: 'Core' }, vecchio()], [d('lotta', 'Lotta')]), [{ id: 'a', nome: 'Squat' }, { id: 'e1', nome: 'Randori' }])
await prova('i doppioni per nome restano fuori, come prima', () => ep([{ id: 'a', nome: 'Squat' }, { id: 'b', nome: 'squat', categoria: 'Core' }]).length, 1)
await prova('non muta l\'input', () => {
  const x = [vecchio()]
  ep(x, lista)
  return x
}, [vecchio()])
await prova('non un array: nessun catalogo', () => ep('x', lista), null)

console.log('\nIl catalogo nel browser (loadEsercizi) e nel backup (leggiSalvataggio)')
const nelBrowser = (salvato, l = partenza) => {
  const m = new Map(salvato === undefined ? [] : [['ods-timer:esercizi', JSON.stringify(salvato)]])
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }
  const letti = E.loadEsercizi(l)
  const risalvato = JSON.parse(m.get('ods-timer:esercizi'))
  delete globalThis.localStorage
  return { letti, risalvato }
}
await prova('dal localStorage: {Randori, A corpo libero, judo} → judo; {Squat, Core} → core; il vecchio «Judo» → judo', () =>
  nelBrowser([{ id: 'e1', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'judo' }, { id: 'b', nome: 'Squat', categoria: 'Core' }, vecchio({ id: 'c', nome: 'Ukemi' })]).letti,
  [{ id: 'e1', nome: 'Randori', disciplina: 'judo' }, { id: 'b', nome: 'Squat', disciplina: 'core' }, { id: 'c', nome: 'Ukemi', disciplina: 'judo' }])
await prova('dal localStorage: quel che si risalva non ha più la categoria', () =>
  nelBrowser([{ id: 'b', nome: 'Squat', categoria: 'Core' }]).risalvato, [{ id: 'b', nome: 'Squat', disciplina: 'core' }])
await prova('dal localStorage: la disciplina sconosciuta si toglie, l\'esercizio resta', () =>
  nelBrowser([{ id: 'b', nome: 'Plank', categoria: 'Core', disciplina: 'karate' }], lista).letti, [{ id: 'b', nome: 'Plank' }])
await prova('dal localStorage: un esercizio senza voce resta senza, «propri» resta', () =>
  nelBrowser([{ id: 'b', nome: 'Libero', propri: true }]).letti, [{ id: 'b', nome: 'Libero', propri: true }])
await prova('mai salvato: il catalogo di partenza, risalvato senza categoria', () => {
  const { letti, risalvato } = nelBrowser(undefined)
  return [letti.length, risalvato.some((e) => 'categoria' in e), letti.every((e) => e.disciplina)]
}, [52, false, true])
const file = (esercizi) => JSON.stringify({ app: 'ods-timer', versione: 1, quando: 'oggi', timer: [], esercizi, impostazioni: {}, storico: [] })
await prova('dal backup: {Randori, A corpo libero, judo} → judo, senza errori', () =>
  E.leggiSalvataggio(file([{ id: 'e1', nome: 'Randori', categoria: 'A corpo libero', disciplina: 'judo' }]), partenza)?.esercizi, [{ id: 'e1', nome: 'Randori', disciplina: 'judo' }])
await prova('dal backup: il vecchio «Judo» → judo; {Squat, Core} → core', () =>
  E.leggiSalvataggio(file([vecchio(), { id: 'b', nome: 'Squat', categoria: 'Core' }]), partenza)?.esercizi,
  [{ id: 'e1', nome: 'Randori', disciplina: 'judo' }, { id: 'b', nome: 'Squat', disciplina: 'core' }])
await prova('dal backup: disciplina valida tenuta, sconosciuta tolta, «propri» resta', () =>
  E.leggiSalvataggio(file([
    { id: 'a', nome: 'Asana', categoria: 'Mobilità', disciplina: 'yoga', propri: true },
    { id: 'b', nome: 'Altro', categoria: 'Core', disciplina: 'karate' },
  ]), lista)?.esercizi,
  [{ id: 'a', nome: 'Asana', disciplina: 'yoga', propri: true }, { id: 'b', nome: 'Altro' }])
await prova('dal backup, un file nuovo (senza categoria) e uno senza voce si leggono uguale', () =>
  E.leggiSalvataggio(file([{ id: 'a', nome: 'Plank', disciplina: 'core' }, { id: 'b', nome: 'Libero' }]))?.esercizi,
  [{ id: 'a', nome: 'Plank', disciplina: 'core' }, { id: 'b', nome: 'Libero' }])

console.log('\nLa voce incisa segue il nome, non la voce dell\'esercizio')
await prova('la chiave della clip dipende dal solo nome', () => V.exerciseKey('Burpee + salto'), 'esercizi/burpee-salto')
await prova('rinominare un esercizio: la sua clip è quella del nome nuovo, per qualunque voce', () => {
  const rinomina = (e, nome) => ep([{ ...e, nome }], partenza)[0]
  const prima = { id: 'a', nome: 'Squat', categoria: 'Core' }
  const dopo = rinomina(prima, 'Squat profondo')
  return [V.exerciseKey(dopo.nome), dopo.disciplina, V.exerciseKey(rinomina({ id: 'b', nome: 'Squat', disciplina: 'tutte' }, 'Squat profondo').nome)]
}, ['esercizi/squat-profondo', 'core', 'esercizi/squat-profondo'])

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
  return [r.discipline, r.voce, r.esercizi]
}, [partenza, 'Elsa', [{ id: 'a', nome: 'Squat', disciplina: 'core' }]])
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
], [partenza, []])

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
