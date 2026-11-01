// ---------------------------------------------------------------------------
// L'area degli iscritti, senza browser: ognuno vede solo il suo.
//
//   node scripts/prova-iscritti.mjs
//
// Il pilota c'è solo in prova (vedi `src/lib/iscritto.ts`): qui si prova che
// legge quello che fanno la segreteria e l'appello — una lezione annullata,
// un sostituto, una sala cambiata, una presenza, una ricevuta — e che di un
// altro iscritto non vede niente. In fondo gli avvisi in cima alla pagina e
// le ricevute degli esempi; poi il nucleo familiare: chi lo vede, la
// persona in più coi dati del titolare, i conti con lo sconto famiglia, e il
// nucleo cambiato dalla scheda della segreteria.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents:
      "export { creaIscrittoProva } from './src/lib/iscrittoProva'; export { avvisi, contoPresenze } from './src/lib/iscritto'; export { creaDatiProva } from './src/lib/datiProva'; export { creaSegreteriaProva } from './src/lib/segreteriaProva'; export { archivio } from './src/lib/archivioProva'; export { seminaEsempi } from './src/lib/esempiProva'; export { ENTE_PREDEFINITO, vociDelCorso } from './src/lib/ricevute'; export { creaRichiesteProva } from './src/lib/richiesteProva'; export { stimaIscrizione, abbonamentiDalleRicevute, descrizioneScontata, scontoDellaVoce, doveVaLoSconto } from './src/lib/nucleo'; export { LISTINO_PREDEFINITO } from './src/lib/listino'; export { carattereControllo, lettereCognome, lettereNome, cfValido } from './src/lib/codiceFiscale'; export { GIORNI_SEGNALA } from './src/lib/segnalate'; export { paroleInRegola } from './src/lib/segreteria'; export { chiaveSessione, unisciSessioni, PERSONA_VISTA } from './src/lib/sessioni'",
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  logLevel: 'error',
  // Senza Vite `import.meta.env` non c'è: vuoto vuol dire «modalità prova».
  define: { 'import.meta.env': '{}' },
})
const modulo = 'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')

const memoria = new Map()
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
}
globalThis.window = { location: { search: '', hash: '' }, addEventListener() {} }

const m = await import(modulo)
let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}

const g = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const oggi = new Date()
oggi.setHours(0, 0, 0, 0)
const fra = (n) => new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + n)

const io = m.creaIscrittoProva()
const s = m.creaSegreteriaProva()
const d = m.creaDatiProva()

// Uno di Lotta 2 (lunedì, mercoledì e venerdì alle 17, sala Lotta) che non fa Lotta 3.
const iscrizioni = m.archivio.dati.iscrizioni
const di = (corso) => new Set(iscrizioni.filter((i) => i.corsoId === corso).map((i) => i.personaId))
const lotta2 = di('lotta-2')
const lotta3 = di('lotta-3')
const chi = [...lotta2].find((id) => !lotta3.has(id))
const altro = [...lotta3].find((id) => !lotta2.has(id))

console.log('\n1. chi si può essere, e la scheda')
{
  const tutti = await io.iscritti()
  ok('solo iscritti, niente istruttori né segreteria', tutti.every((p) => p.id.startsWith('p-')), true)
  ok('in ordine di cognome', tutti.map((p) => p.cognome).join() === [...tutti.map((p) => p.cognome)].sort((a, b) => a.localeCompare(b, 'it')).join(), true)
  const sc = await io.scheda(chi)
  ok('fra i suoi corsi c’è Lotta 2, non Lotta 3', [sc.corsi.some((c) => c.id === 'lotta-2'), sc.corsi.some((c) => c.id === 'lotta-3')], [true, false])
  ok('un istruttore non ha una scheda da iscritto', await io.scheda('i-maurizio'), null)
  await s.attivaPersona(altro, false)
  ok('chi è stato tolto dagli attivi nemmeno', [await io.scheda(altro), (await io.lezioni(altro, fra(0), fra(14))).length], [null, 0])
  await s.attivaPersona(altro, true)
}

console.log('\n2. le prossime lezioni, con quello che cambia')
{
  const prima = await io.lezioni(chi, fra(1), fra(14))
  const suoi = (await io.scheda(chi)).corsi.map((c) => c.nome)
  ok('solo dei suoi corsi', prima.length > 0 && prima.every((l) => suoi.includes(l.corso)), true)
  ok('nessuna lezione di Lotta 3', prima.some((l) => l.corso === 'Lotta 3'), false)
  const [a, b, c] = prima.filter((l) => l.corso === 'Lotta 2')
  await s.aggiornaLezione(a.id, { stato: 'annullata' })
  await s.aggiornaLezione(b.id, { sostitutoId: 'i-manuel' })
  await s.aggiornaLezione(c.id, { salaId: 'Tatami' })
  const dopo = await io.lezioni(chi, fra(1), fra(14))
  const x = (id) => dopo.find((l) => l.id === id)
  ok('annullata', x(a.id).stato, 'annullata')
  ok('col sostituto, e il suo nome', [x(b.id).sostituto, x(b.id).istruttore], [true, 'Manuel'])
  ok('in un’altra sala', [x(c.id).altraSala, x(c.id).sala], [true, 'Tatami'])
  ok('le altre come sempre', dopo.filter((l) => ![a.id, b.id, c.id].includes(l.id)).every((l) => l.stato === 'prevista' && !l.sostituto && !l.altraSala), true)
  await s.termina(chi, 'lotta-2')
  ok('chi smette non vede più le lezioni future del corso', (await io.lezioni(chi, fra(1), fra(14))).some((l) => l.corso === 'Lotta 2'), false)
  await s.iscrivi(chi, 'lotta-2')
}

console.log('\n3. le presenze, dalla più recente')
{
  const passate = await io.presenze(chi, 30)
  ok('ci sono lezioni passate', passate.length > 0, true)
  ok('dalla più recente', passate.every((p, i) => i === 0 || passate[i - 1].inizio >= p.inizio), true)
  const [ultima, penultima] = passate.filter((p) => p.corso === 'Lotta 2')
  await d.segna(ultima.sessioneId, chi, 'presente')
  await d.segna(penultima.sessioneId, chi, 'giustificato')
  const ora = await io.presenze(chi, 30)
  ok('il segno dell’appello arriva qui', [ora.find((p) => p.sessioneId === ultima.sessioneId).stato, ora.find((p) => p.sessioneId === penultima.sessioneId).stato], ['presente', 'giustificato'])
  const c = m.contoPresenze(ora)
  ok('le giustificate non contano', c.dovute, ora.filter((p) => p.stato !== 'giustificato').length)
  ok('e le annullate non ci sono', (await s.registro(fra(-30), fra(0))).filter((r) => r.stato === 'annullata').some((r) => ora.some((p) => p.sessioneId === r.sessioneId)), false)
  ok('l’appello di un altro non si vede', (await io.presenze(chi, 30)).some((p) => p.corso === 'Lotta 3'), false)
}

console.log('\n4. le ricevute, solo le sue')
{
  const voce = { descrizione: 'QUOTA ASSOCIATIVA', quantita: 1, prezzo: 3000, pagamenti: [{ data: g(oggi), importo: 3000, metodo: 'Contanti' }] }
  const r = await s.emettiRicevuta({ data: g(oggi), personaId: chi, ente: m.ENTE_PREDEFINITO, intestatario: { nome: 'A', cognome: 'B' }, voci: [voce], anticipo: 0 })
  ok('la vede chi ha pagato', (await io.ricevute(chi)).map((x) => x.id), [r.id])
  ok('non un altro', (await io.ricevute(altro)).some((x) => x.id === r.id), false)
  await s.annullaRicevuta(r.id)
  ok('annullata, resta e lo dice', !!(await io.ricevute(chi))[0].annullataIl, true)
}

console.log('\n5. gli avvisi in cima')
{
  const t = (certificato, pagamento) => m.avvisi({ certificato, pagamento }, '2026-10-02').map((a) => a.tono)
  ok('in regola: niente', t({ scade: '2027-06-01', conFile: true }, { stato: 'pagato' }), [])
  ok('certificato che manca: guaio', t({ conFile: false }, { stato: 'pagato' }), ['guaio'])
  ok('su carta, senza file: basta la scadenza', t({ scade: '2027-06-01', conFile: false }, { stato: 'pagato' }), [])
  ok('che scade entro un mese: avviso', t({ scade: '2026-10-20', conFile: true }, { stato: 'pagato' }), ['avviso'])
  ok('scaduto e da pagare: due guai', t({ scade: '2026-09-01', conFile: true }, { stato: 'da_pagare' }), ['guaio', 'guaio'])
  ok('quota da pagare: dice che si paga qui sotto (c\'è il tasto PAGA LA QUOTA)', m.avvisi({ certificato: { scade: '2027-06-01', conFile: true }, pagamento: { stato: 'da_pagare' } }, '2026-10-02').map((a) => a.testo), ['La quota non risulta pagata: pagala qui sotto o passa in segreteria.'])
  ok('pagato in parte: avviso', t({ scade: '2027-06-01', conFile: true }, { stato: 'in_parte' }), ['avviso'])
  ok('pagato fino a ieri: guaio', t({ scade: '2027-06-01', conFile: true }, { stato: 'pagato', fino: '2026-10-01' }), ['guaio'])
}

console.log('\n5b. sotto i 6 anni il certificato non serve (area iscritti)')
{
  const t = (natoIl, certificato) => m.avvisi({ certificato, pagamento: { stato: 'pagato' }, natoIl }, '2026-10-02').map((a) => a.tono)
  ok('5 anni senza certificato: niente da sistemare', t('2021-03-10', { conFile: false }), [])
  ok('5 anni col certificato scaduto: nemmeno', t('2021-03-10', { scade: '2026-09-01', conFile: false }), [])
  ok('compie 6 anni fra due settimane, senza certificato: un avviso, non il via libera', t('2020-10-16', { conFile: false }), ['avviso'])
  ok('compie 6 anni oggi: manca il certificato', t('2020-10-02', { conFile: false }), ['guaio'])
  ok('senza data di nascita: come prima', t(undefined, { conFile: false }), ['guaio'])
  // La scheda dell'iscritto porta la data di nascita che la segreteria conosce.
  await s.salvaAnagrafica(chi, { natoIl: '2021-03-10' })
  ok('la scheda porta la data di nascita', (await io.scheda(chi)).natoIl, '2021-03-10')
}

console.log('\n6. le ricevute degli esempi')
{
  const DOVE = 'ods-corsi:prova-esempi-ricevute'
  const prima = (m.archivio.dati.ricevute ?? []).length
  const aMano = m.archivio.dati.ricevute.map((r) => r.id)
  // Un dispositivo con gli esempi della versione 1: il segno, e una ricevuta di esempio di allora.
  const vecchio = m.archivio.dati.persone.find((p) => p.ruolo === 'iscritto' && p.attiva && p.id !== chi && p.pagamento?.stato === 'pagato')
  m.archivio.dati.ricevute.push({ ...m.archivio.dati.ricevute[0], id: `r-esempio-${vecchio.id}`, personaId: vecchio.id, numero: 900, annullataIl: undefined })
  localStorage.setItem(DOVE, '1')
  m.seminaEsempi()
  ok('gli esempi nuovi arrivano anche dove c’erano quelli della versione 1', localStorage.getItem(DOVE) !== '1', true)
  ok('la ricevuta di esempio di allora è rifatta', m.archivio.dati.ricevute.some((r) => r.numero === 900), false)
  ok('le ricevute fatte a mano restano', aMano.every((id) => m.archivio.dati.ricevute.some((r) => r.id === id)), true)
  const tutte = m.archivio.dati.ricevute
  const esempi = tutte.filter((r) => r.id.startsWith('r-esempio-'))
  const paganti = m.archivio.dati.persone.filter((p) => p.ruolo === 'iscritto' && p.attiva && ['pagato', 'in_parte'].includes(p.pagamento?.stato))
  ok('una a chi ha pagato, tranne chi ne aveva già una', esempi.length, paganti.filter((p) => p.id !== chi).length)
  ok('chi non ha pagato niente non ne ha', esempi.some((r) => m.archivio.dati.persone.find((p) => p.id === r.personaId)?.pagamento?.stato === 'da_pagare'), false)
  const parte = esempi.find((r) => m.archivio.dati.persone.find((p) => p.id === r.personaId).pagamento.stato === 'in_parte' && r.voci.length > 1)
  ok('chi ha pagato in parte ha dato meno del totale', !!parte && parte.pagato < parte.totale, true)
  const numeri = tutte.filter((r) => r.anno === esempi[0].anno).map((r) => r.numero)
  ok('numeri tutti diversi', new Set(numeri).size, numeri.length)
  ok('nessuna nel futuro', esempi.every((r) => r.data <= g(new Date())), true)
  localStorage.removeItem('ods-corsi:prova-esempi-ricevute')
  m.seminaEsempi()
  ok('rifatti, non raddoppiano', m.archivio.dati.ricevute.length, prima + esempi.length)

  // Gli esempi fanno vedere tutte le parole della colonna IN REGOLA.
  const parole = async (giorno) => (await s.persone()).filter((p) => p.attiva).map((p) => m.paroleInRegola(p, giorno).map((b) => b.parola))
  const oggiParole = (await parole(g(oggi))).flat()
  for (const x of ['Quota scaduta', 'Fuori app', 'Pagata in parte']) ok(`gli esempi mostrano almeno un ${x}`, oggiParole.includes(x), true)

  // Dopo il 13/12 (novanta giorni dalla stagione) non scade la quota di mezza palestra.
  // Seminati da capo quel giorno, come su un dispositivo nuovo.
  const senzaEsempi = () => (m.archivio.dati.ricevute = m.archivio.dati.ricevute.filter((r) => !r.id.startsWith('r-esempio-')))
  senzaEsempi()
  localStorage.removeItem(DOVE)
  m.seminaEsempi(new Date('2026-12-20T12:00:00'))
  const dopo = await parole('2026-12-20')
  const scadute = dopo.filter((x) => x.includes('Quota scaduta')).length
  ok('il 20/12/2026 le QUOTA SCADUTA sono poche (meno di una su dieci)', scadute > 0 && scadute < dopo.length / 10, true)
  senzaEsempi()
  localStorage.removeItem(DOVE)
  m.seminaEsempi()
}

console.log('\n7. il nucleo familiare')
{
  const a = m.archivio.dati
  const membri = a.persone.filter((p) => p.nucleo)
  ok('gli esempi fanno qualche famiglia', membri.length > 0, true)
  const titolareId = membri[0].nucleo
  const titolare = a.persone.find((p) => p.id === titolareId)
  const suoi = a.persone.filter((p) => p.nucleo === titolareId)
  ok('stesso cognome', suoi.every((p) => p.cognome === titolare.cognome), true)
  const visto = await io.nucleo(titolareId)
  ok('il titolare vede sé stesso per primo, e il suo nucleo', [visto[0].id, visto.length], [titolareId, suoi.length + 1])
  ok('chi è nel nucleo vede solo sé stesso', (await io.nucleo(suoi[0].id)).map((p) => p.id), [suoi[0].id])
  ok('e non aggiunge', [await io.titolare(titolareId), await io.titolare(suoi[0].id)], [true, false])
  ok('chi non ha un nucleo è titolare del suo', await io.titolare(chi), true)
  ok('gli altri non hanno nemmeno i dati del titolare', await io.datiDelNucleo(suoi[0].id), {})

  const base = await io.datiDelNucleo(titolareId)
  ok('il modulo parte col cognome, la residenza e il titolare da genitore', [base.cognome, base.comune, base.genitoreNome, base.nucleoDi], [titolare.cognome, 'Collegno', titolare.nome, titolareId])
  ok('col suo codice fiscale vero', m.cfValido(base.genitoreCodiceFiscale), true)

  // Un figlio di otto anni, con un codice fiscale giusto.
  const nato = new Date()
  nato.setFullYear(nato.getFullYear() - 8)
  const natoIl = g(nato)
  const pezzo = `${m.lettereCognome(titolare.cognome)}${m.lettereNome('Tommaso')}${natoIl.slice(2, 4)}${'ABCDEHLMPRST'[nato.getMonth()]}${String(nato.getDate()).padStart(2, '0')}L219`
  // Chi non ha dato l'email alla segreteria la scrive nel modulo.
  const figlio = { ...base, email: base.email || 'famiglia@esempio.it', nome: 'Tommaso', natoIl, natoA: 'Torino', codiceFiscale: pezzo + m.carattereControllo(pezzo), corsi: ['judo-2'], formula: 'annuale', regolamento: true, telefono2: '', note: '' }
  const r = m.creaRichiesteProva()
  const id = await r.invia(figlio)
  ok('la richiesta parte, col nucleo', (await r.richieste()).find((x) => x.id === id).nucleoDi, titolareId)
  ok('il titolare la vede in attesa', (await io.aggiunte(titolareId)).map((x) => [x.nome, x.stato, x.corsi]), [['Tommaso', 'nuova', ['Judo 2']]])
  ok('per il nucleo di un altro no', (await io.aggiunte(suoi[0].id)).length, 0)
  const nuovo = await r.accogli(id)
  ok('accolta, entra nel nucleo', a.persone.find((p) => p.id === nuovo).nucleo, titolareId)
  ok('il titolare lo vede, e non più in attesa', [(await io.nucleo(titolareId)).some((p) => p.id === nuovo), (await io.aggiunte(titolareId)).length], [true, 0])
  ok('e vede le sue lezioni', (await io.lezioni(nuovo, fra(0), fra(14))).every((l) => l.corso === 'Judo 2'), true)
  let rifiuto = 'nessun errore'
  try {
    await r.invia({ ...figlio, nucleoDi: suoi[0].id })
  } catch (e) {
    rifiuto = e.message
  }
  ok('chi non è titolare non fa da nucleo', rifiuto, 'Il nucleo per cui iscrivi non c’è più: ricarica la pagina')

  // Il genitore del modulo è il titolare solo se è maggiorenne (o senza data di nascita).
  await s.salvaAnagrafica(titolareId, { natoIl: '1980-05-01' })
  const adultoT = await io.datiDelNucleo(titolareId)
  ok('titolare maggiorenne: genitore col titolare', [adultoT.genitoreNome, adultoT.genitoreCognome], [titolare.nome, titolare.cognome])
  await s.salvaAnagrafica(titolareId, { natoIl: g(nato) })
  const minoreT = await io.datiDelNucleo(titolareId)
  ok('titolare minorenne: nessun genitore', ['genitoreNome' in minoreT, 'genitoreCognome' in minoreT, 'genitoreCodiceFiscale' in minoreT, minoreT.nucleoDi], [false, false, false, titolareId])
}

console.log('\n8. quanto costa una persona in più')
{
  const L = m.LISTINO_PREDEFINITO
  const giorno = '2026-10-02'
  const annuale = (corso) => m.vociDelCorso(corso, giorno, L).find((v) => v.chiave.endsWith('~annuale')).voce(giorno).prezzo
  const quota = L.quota * 100
  const judo = annuale('Judo 2')
  const solo = m.stimaIscrizione({ chi: 'Tommaso', corsi: ['Judo 2'], formula: 'annuale' }, [], giorno, L)
  ok('da solo: quota e annuale, senza sconto', [solo.totale, solo.sconto], [quota + judo, undefined])
  const caro = m.stimaIscrizione({ chi: 'Tommaso', corsi: ['Judo 2'], formula: 'annuale' }, [{ chi: 'Anna', corso: 'X', importo: judo + 10000 }], giorno, L)
  ok('il suo annuale costa meno: lo sconto è suo', [caro.sconto.qui, caro.totale], [true, quota + judo - Math.round(judo * 0.2)])
  const meno = m.stimaIscrizione({ chi: 'Tommaso', corsi: ['Judo 2'], formula: 'annuale' }, [{ chi: 'Anna', corso: 'X', importo: judo - 10000 }], giorno, L)
  ok('costa meno quello di un altro: lo sconto è dell’altro', [meno.sconto.qui, meno.sconto.chi, meno.totale], [false, 'Anna', quota + judo])
  const pari = m.stimaIscrizione({ chi: 'Tommaso', corsi: ['Judo 2'], formula: 'annuale' }, [{ chi: 'Anna', corso: 'X', importo: judo }], giorno, L)
  ok('a pari prezzo lo sconto va sulla persona nuova', pari.sconto.qui, true)
  const tri = m.stimaIscrizione({ chi: 'Tommaso', corsi: ['Judo 2'], formula: 'trimestre' }, [{ chi: 'Anna', corso: 'X', importo: 1 }], giorno, L)
  ok('il trimestre non ha sconto', [tri.sconto, tri.righe.length], [undefined, 2])
  const ignoto = m.stimaIscrizione({ chi: 'Tommaso', corsi: ['Corso che non c’è'], formula: 'annuale' }, [], giorno, L)
  ok('un corso fuori listino si dice', [ignoto.senzaPrezzo, ignoto.totale], [['Corso che non c’è'], quota])
  const voce = (descrizione, prezzo) => ({ descrizione, quantita: 1, prezzo, pagamenti: [] })
  const ric = [
    { data: '2026-09-15', personaId: 'a', voci: [voce('QUOTA ASSOCIATIVA', quota), voce('Annuale Judo 2', judo)] },
    { data: '2026-09-15', personaId: 'b', voci: [voce('Trimestre Lotta 2', 9000)], annullataIl: undefined },
    { data: '2026-09-15', personaId: 'c', voci: [voce('Annuale Lotta 2', 1)], annullataIl: '2026-09-20' },
  ]
  ok('gli annuali del nucleo dalle ricevute, non le annullate', m.abbonamentiDalleRicevute(ric, (id) => id.toUpperCase(), giorno), [{ chi: 'A', corso: 'Judo 2', importo: judo }])
  const scontata = m.descrizioneScontata('Annuale Judo 2', judo)
  ok('la voce scontata dice su quanto', scontata, `Annuale Judo 2 · sconto famiglia 20% su ${(judo / 100).toFixed(2).replace('.', ',')} €`)
  ok('e si rilegge', m.scontoDellaVoce(scontata), { descrizione: 'Annuale Judo 2', pieno: judo })
  ok('una voce qualunque non è scontata', m.scontoDellaVoce('Annuale Judo 2'), null)
  const conSconto = [{ data: '2026-09-15', personaId: 'a', voci: [voce(scontata, judo - Math.round(judo * 0.2))] }]
  ok('l’annuale scontato conta col prezzo pieno', m.abbonamentiDalleRicevute(conSconto, (id) => id, giorno), [{ chi: 'a', corso: 'Judo 2', importo: judo, scontato: true }])
  const gia = m.stimaIscrizione({ chi: 'Tommaso', corsi: ['Judo 2'], formula: 'annuale' }, m.abbonamentiDalleRicevute(conSconto, () => 'Anna', giorno), giorno, L)
  ok('lo sconto già avuto da un altro non torna', [gia.sconto.qui, gia.sconto.chi, gia.totale], [false, 'Anna', quota + judo])
  ok('un annuale solo: niente sconto', m.doveVaLoSconto([{ chi: 'T', corso: 'X', importo: 1 }], []), null)

  // PIÙ CORSI: una persona con più annuali paga i corsi al massimo 660 €, quota a parte; lo sconto famiglia è fra persone.
  const PIU = 66000
  const due = m.stimaIscrizione({ chi: 'Marco', corsi: ['Judo 3', 'Judo agonisti'], formula: 'annuale' }, [], giorno, L)
  ok('due annuali della stessa persona: 660 € più la quota, niente sconto famiglia', [due.totale, due.sconto], [quota + PIU, undefined])
  ok('e la riga del tetto si vede', due.righe.some((r) => /più corsi/i.test(r.testo) && r.importo < 0), true)
  ok('due annuali della stessa persona: niente sconto famiglia', m.doveVaLoSconto([{ chi: 'T', corso: 'X', importo: 1 }, { chi: 'T', corso: 'Y', importo: 2 }], []), null)
  ok('anche se uno l’ha già pagato prima', m.doveVaLoSconto([{ chi: 'T', corso: 'X', importo: 1 }], [{ chi: 'T', corso: 'Y', importo: 2 }]), null)
  const conAnna = m.stimaIscrizione({ chi: 'Marco', corsi: ['Judo 3', 'Judo agonisti'], formula: 'annuale' }, [{ chi: 'Anna', corso: 'Judo 2', importo: judo }], giorno, L)
  ok('PIÙ CORSI conta come un annuale da 660: lo sconto va su quello di Anna, che costa meno', [conAnna.sconto?.qui, conAnna.sconto?.chi, conAnna.totale], [false, 'Anna', quota + PIU])
  const conCaro = m.stimaIscrizione({ chi: 'Marco', corsi: ['Judo 3', 'Judo agonisti'], formula: 'annuale' }, [{ chi: 'Anna', corso: 'X', importo: PIU + 1000 }], giorno, L)
  ok('se costa meno PIÙ CORSI, il 20% è su 660', [conCaro.sconto?.qui, conCaro.totale], [true, quota + PIU - Math.round(PIU * 0.2)])
  const pocoA = m.stimaIscrizione({ chi: 'A', corsi: ['Psicomotricità'], formula: 'annuale' }, [], giorno, L).totale - quota
  const pocoB = m.stimaIscrizione({ chi: 'A', corsi: ['Giocomotricità'], formula: 'annuale' }, [], giorno, L).totale - quota
  const sotto = m.stimaIscrizione({ chi: 'A', corsi: ['Psicomotricità', 'Giocomotricità'], formula: 'annuale' }, [], giorno, L)
  ok('sotto i 660 € si paga la somma', [pocoA + pocoB < PIU, sotto.totale], [true, quota + pocoA + pocoB])
  const triDue = m.stimaIscrizione({ chi: 'Marco', corsi: ['Judo 3', 'Judo agonisti'], formula: 'trimestre' }, [], giorno, L)
  ok('col trimestre il tetto non c’è', triDue.righe.some((r) => /più corsi/i.test(r.testo)), false)

  // Le ricevute contano per la stagione dei corsi di `giorno`: un annuale dell'anno prima non dà né toglie lo sconto.
  const stagioni = [
    { data: '2025-10-01', personaId: 'a', voci: [voce('Annuale Judo 2', judo)] },
    { data: '2025-10-01', personaId: 'b', voci: [voce(scontata, judo - Math.round(judo * 0.2))] },
    { data: '2026-07-15', personaId: 'c', voci: [{ ...voce('Annuale Lotta 2', 30000), dal: '2026-09-01', al: '2027-06-30' }] },
  ]
  ok('solo gli annuali della stagione di oggi (luglio è già della stagione dopo)', m.abbonamentiDalleRicevute(stagioni, (id) => id, giorno), [{ chi: 'c', corso: 'Lotta 2', importo: 30000 }])
  ok('l’anno dopo, quelli dell’anno prima non contano più', m.abbonamentiDalleRicevute(stagioni, (id) => id, '2027-10-01'), [])
}

console.log('\n9. il nucleo dalla scheda della segreteria')
{
  const a = m.archivio.dati
  const err = async (f) => {
    try {
      await f()
      return 'nessun errore'
    } catch (e) {
      return e.message
    }
  }
  const liberi = a.persone.filter((p) => p.ruolo === 'iscritto' && p.attiva && !p.nucleo && !a.persone.some((x) => x.nucleo === p.id))
  const [t, x, y] = liberi
  const nucleoDi = (id) => a.persone.find((p) => p.id === id).nucleo
  await s.mettiNelNucleo(x.id, t.id)
  await s.mettiNelNucleo(y.id, t.id)
  ok('due persone nel nucleo di un titolare', [nucleoDi(x.id), nucleoDi(y.id)], [t.id, t.id])
  ok('la segreteria lo legge nella scheda', (await s.persone()).find((p) => p.id === x.id).nucleo, t.id)
  ok('e il titolare lo vede nella sua pagina', (await io.nucleo(t.id)).length, 3)
  ok('non nel nucleo di chi è già in un nucleo', await err(() => s.mettiNelNucleo(liberi[3].id, x.id)), 'È già nel nucleo di un altro: scegli il titolare')
  ok('non due volte', await err(() => s.mettiNelNucleo(x.id, t.id)), 'È già in questo nucleo')
  ok('non in un altro nucleo', await err(() => s.mettiNelNucleo(x.id, liberi[3].id)), 'È già nel nucleo di un altro: prima toglilo da lì')
  ok('un titolare con altri dentro non entra in un altro', await err(() => s.mettiNelNucleo(t.id, liberi[3].id)), 'Ha un nucleo suo, con altri dentro: prima toglili, o fai titolare un altro')
  ok('non in sé stesso', await err(() => s.mettiNelNucleo(t.id, t.id)), 'Una persona non entra nel suo stesso nucleo')
  await s.rendiTitolare(x.id)
  ok('fatto titolare un altro, il nucleo passa a lui', [nucleoDi(x.id), nucleoDi(t.id), nucleoDi(y.id)], [undefined, x.id, x.id])
  ok('e ora lo vede lui, non il titolare di prima', [(await io.nucleo(x.id)).length, (await io.nucleo(t.id)).length], [3, 1])
  ok('chi non è in un nucleo non diventa titolare', await err(() => s.rendiTitolare(liberi[3].id)), 'Non è nel nucleo di nessuno')
  await s.togliDalNucleo(y.id)
  ok('tolto, resta iscritto e fuori dal nucleo', [nucleoDi(y.id), (await io.scheda(y.id)) !== null, (await io.nucleo(x.id)).length], [undefined, true, 2])
  ok('non si toglie chi non c’è', await err(() => s.togliDalNucleo(y.id)), 'Non è nel nucleo di nessuno')
  await s.attivaPersona(liberi[4].id, false)
  ok('una scheda disattivata no', await err(() => s.mettiNelNucleo(liberi[4].id, x.id)), 'Le schede disattivate non entrano in un nucleo')
}

console.log('\n10. le presenze segnalate')
{
  const a = m.archivio.dati
  const err = async (f) => {
    try {
      await f()
      return 'nessun errore'
    } catch (e) {
      return e.message
    }
  }
  const esempi = (a.segnalate ?? []).filter((x) => x.id.startsWith('sg-esempio-'))
  ok('gli esempi ne mettono due da vedere e una rifiutata', [esempi.filter((x) => x.stato === 'da_vedere').length, esempi.filter((x) => x.stato === 'rifiutata').length], [2, 1])
  ok('nelle lezioni di Maurizio', (await d.segnalate('i-maurizio')).filter((x) => x.id.startsWith('sg-esempio-')).length, 3)

  // Una lezione passata di chi, non segnata, e una dove è presente.
  const passate = await io.presenze(chi, 30)
  const libera = passate.find((p) => p.stato === null || p.stato === 'assente')
  const presente = passate.find((p) => p.stato === 'presente')
  ok('c’è una lezione da segnalare', !!libera, true)
  await io.segnala(chi, libera.sessioneId, '  in ritardo  ')
  const mia = (await io.segnalate(chi)).find((x) => x.sessioneId === libera.sessioneId)
  ok('segnalata, da vedere, con la nota pulita', [mia.stato, mia.nota], ['da_vedere', 'in ritardo'])
  ok('non due volte', await err(() => io.segnala(chi, libera.sessioneId)), 'L’hai già segnalata: la guarda l’istruttore o la segreteria')
  ok('non dove risulta già presente', await err(() => io.segnala(chi, presente.sessioneId)), 'Risulti già presente')
  const futura = (await io.lezioni(chi, fra(2), fra(9))).find((l) => l.stato !== 'annullata')
  ok('non una lezione che deve ancora venire', await err(() => io.segnala(chi, futura.id)), 'La lezione non è ancora cominciata')
  const diAltro = (await io.presenze(altro, 30))[0]
  ok('non una lezione di un altro corso', await err(() => io.segnala(chi, diAltro.sessioneId)), 'Questa lezione non è di un tuo corso')

  const vista = (await s.segnalate()).find((x) => x.id === mia.id)
  ok('la segreteria la vede, con chi, che lezione e il segno di adesso', [vista.personaId, vista.corso, vista.segno], [chi, libera.corso, libera.stato])
  const insegnanti = vista.insegnanti
  const estraneo = ['i-maurizio', 'i-maura', 'i-fabio', 'i-tiziano'].find((x) => !insegnanti.includes(x))
  ok('un istruttore non la vede se la lezione non è sua', (await d.segnalate(estraneo)).some((x) => x.id === mia.id), false)
  ok('e non la gestisce', await err(() => d.gestisciSegnalata(mia.id, true, estraneo)), 'Non è una tua lezione: la vede la segreteria')
  ok('l’istruttore della lezione sì', (await d.segnalate(insegnanti[0])).some((x) => x.id === mia.id), true)
  await d.gestisciSegnalata(mia.id, true, insegnanti[0])
  ok('accolta: nell’appello è presente', (await d.dettaglio(libera.sessioneId)).elenco.find((p) => p.id === chi).stato, 'presente')
  ok('e nella sua pagina', [(await io.presenze(chi, 30)).find((p) => p.sessioneId === libera.sessioneId).stato, (await io.segnalate(chi)).find((x) => x.id === mia.id).stato], ['presente', 'accolta'])
  ok('non si gestisce due volte', await err(() => s.gestisciSegnalata(mia.id, false)), 'È già stata accolta')

  // Il rifiuto, con un altro iscritto che ha ancora una lezione da segnalare.
  const altra = (await io.presenze(altro, 30)).find((p) => p.stato !== 'presente' && p.stato !== 'giustificato')
  ok('l’altro ha una lezione da segnalare', !!altra, true)
  ok('una nota lunghissima no', await err(() => io.segnala(altro, altra.sessioneId, 'x'.repeat(201))), 'La nota è troppo lunga: al massimo 200 caratteri')
  await io.segnala(altro, altra.sessioneId)
  const sua = (await io.segnalate(altro)).find((x) => x.sessioneId === altra.sessioneId)
  await s.gestisciSegnalata(sua.id, false)
  ok('rifiutata dalla segreteria: resta com’era', (await d.dettaglio(altra.sessioneId)).elenco.find((p) => p.id === altro).stato, altra.stato)
  ok('e chi l’ha rifiutata', (await s.segnalate()).find((x) => x.id === sua.id).gestitaDa, 'Segreteria di prova')
  ok('e non si rimanda', await err(() => io.segnala(altro, altra.sessioneId)), 'È già stata rifiutata: chiedi alla segreteria')
}

console.log('\n6. il certificato: l’iscritto non vede nemmeno se c’è un file')
{
  m.archivio.dati.persone = m.archivio.dati.persone.map((p) => (p.id === chi ? { ...p, certificato: { scade: '2027-06-01', file: `${chi}/certificato-1.pdf` } } : p))
  const c = (await io.scheda(chi)).certificato
  ok('vede fino a quando vale', c.scade, '2027-06-01')
  ok('ma non se sta nell’app, né di che tipo', ['conFile', 'vecchio', 'caricatoIl'].filter((k) => k in c), [])
  ok('e gli avvisi non ne hanno bisogno', m.avvisi({ certificato: { scade: '2027-06-01' }, pagamento: { stato: 'pagato' } }, '2026-10-02'), [])
}

console.log('\n7. la sessione sul dispositivo: la chiave e le tre sessioni di prima riportate a una')
{
  const URL = 'https://abcd.supabase.co'
  const K = m.chiaveSessione(URL)
  const SEG = `${K}-segreteria`
  const SALA = `${K}-sala`
  const VISTA = m.PERSONA_VISTA
  const pulisci = () => [K, SEG, SALA, VISTA, `${VISTA}-segreteria`, 'ods-corsi:modo'].forEach((k) => localStorage.removeItem(k))
  const leggi = () => [K, SEG, SALA, VISTA, `${VISTA}-segreteria`].map((k) => localStorage.getItem(k))

  ok('la chiave è quella di sempre di Supabase', K, 'sb-abcd-auth-token')
  ok('conta solo il progetto: percorso e porta non cambiano la chiave', m.chiaveSessione(URL + ':443/rest/v1/'), K)
  ok('un indirizzo storto cade su «ods»', m.chiaveSessione('non un indirizzo'), 'sb-ods-auth-token')

  pulisci()
  m.unisciSessioni(URL)
  ok('senza sessioni di prima non cambia niente', leggi(), [null, null, null, null, null])

  localStorage.setItem(SEG, 'seg')
  localStorage.setItem(SALA, 'sala')
  localStorage.setItem(`${VISTA}-segreteria`, 'p-seg')
  m.unisciSessioni(URL)
  ok('fuori dal tablet resta quella della segreteria, con la sua persona vista', leggi(), ['seg', null, null, 'p-seg', null])

  pulisci()
  localStorage.setItem('ods-corsi:modo', 'tablet')
  localStorage.setItem(SEG, 'seg')
  localStorage.setItem(SALA, 'sala')
  localStorage.setItem(`${VISTA}-segreteria`, 'p-seg')
  m.unisciSessioni(URL)
  ok('sul tablet resta quella della sala, e la persona della segreteria si butta', leggi(), ['sala', null, null, null, null])

  pulisci()
  localStorage.setItem('ods-corsi:modo', 'tablet')
  localStorage.setItem(SEG, 'seg')
  m.unisciSessioni(URL)
  ok('sul tablet senza quella della sala va quella della segreteria', leggi(), ['seg', null, null, null, null])

  pulisci()
  localStorage.setItem(SALA, 'sala')
  m.unisciSessioni(URL)
  ok('fuori dal tablet senza quella della segreteria va quella della sala', leggi(), ['sala', null, null, null, null])

  pulisci()
  localStorage.setItem(K, 'sempre')
  localStorage.setItem(VISTA, 'p-sempre')
  localStorage.setItem(SEG, 'seg')
  localStorage.setItem(SALA, 'sala')
  localStorage.setItem(`${VISTA}-segreteria`, 'p-seg')
  m.unisciSessioni(URL)
  ok('se la chiave di sempre c’è già vince lei: le altre si buttano', leggi(), ['sempre', null, null, 'p-sempre', null])

  pulisci()
  localStorage.setItem(SEG, 'seg')
  m.unisciSessioni(URL)
  m.unisciSessioni(URL)
  ok('lanciata due volte non cambia niente', leggi(), ['seg', null, null, null, null])

  const vera = globalThis.localStorage
  globalThis.localStorage = { getItem() { throw new Error('negato') }, setItem() {}, removeItem() {} }
  let tenuto = true
  try { m.unisciSessioni(URL) } catch { tenuto = false }
  globalThis.localStorage = vera
  ok('senza localStorage non si rompe niente', tenuto, true)
  pulisci()
}

// ---------------------------------------------------------------------------
// L'elenco ISCRITTI rivisto: due colonne di segni (CERTIFICATO e QUOTA), i conti
// sui chip, la cella CORSI e la barretta dei 30 GIORNI. Le funzioni sono nuove:
// finché non ci sono, ogni caso fallisce da sé con «manca …».
// ---------------------------------------------------------------------------
{
  const { outputFiles: fuori } = await build({
    stdin: {
      contents: "export * from './src/lib/segreteria'; export * from './src/lib/filtriIscritti'",
      resolveDir: '.',
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' },
  })
  const E = await import('data:text/javascript;base64,' + Buffer.from(fuori[0].text).toString('base64'))
  const vedi = (nome, f) => (typeof E[nome] === 'function' ? f(E[nome]) : `manca ${nome}`)

  const oggi = '2026-09-26'
  const fra = (n) => new Date(Date.UTC(2026, 8, 26 + n)).toISOString().slice(0, 10)
  const corta = (g) => `${g.slice(8, 10)}/${g.slice(5, 7)}`
  const pagata = { anno: 2026, numero: 12, dal: '2026-09-01', al: fra(200), mancano: 0 }
  const adulto = '1990-01-01'
  const persona = (altro = {}) => ({
    id: 'p-e', nome: 'Anna', cognome: 'Elenco', attiva: true, creataIl: '2026-09-01', iscrizioni: [], documento: true,
    natoIl: adulto, certificato: { scade: fra(100), conFile: false }, pagamento: { stato: 'da_pagare' }, quote: [pagata], ...altro,
  })
  const cert = (scade, altro = {}) => persona({ certificato: { scade, conFile: false }, ...altro })
  const tessera = (esito, tesseraAl, ente = 'FIJLKAM') => ({ personaId: 'p-e', ente, esito, tesseraAl })
  // Senza la funzione ogni caso fallisce con «manca statoPerElenco», senza rompere la prova.
  const stato = (p, righe = []) => (typeof E.statoPerElenco === 'function' ? E.statoPerElenco(p, oggi, righe) : { certificato: 'manca statoPerElenco', quota: ['manca statoPerElenco'] })
  const segno = (tono, parola) => ({ tono, parola })

  console.log('\nELENCO: la colonna CERTIFICATO (un segno solo)')
  ok('valido: verde «In regola»', stato(persona()).certificato, segno('verde', 'In regola'))
  ok('manca: rosso «Manca»', stato(cert(undefined)).certificato, segno('rosso', 'Manca'))
  ok('scaduto: rosso «Scaduto»', stato(cert(fra(-1))).certificato, segno('rosso', 'Scaduto'))
  ok('scade oggi: giallo «Scade oggi»', stato(cert(oggi)).certificato, segno('giallo', 'Scade oggi'))
  ok('in scadenza: giallo «Scade il gg/mm»', stato(cert(fra(10))).certificato, segno('giallo', `Scade il ${corta(fra(10))}`))
  ok('compie 6 anni fra 14 giorni, senza certificato: giallo «Serve dal gg/mm»', stato(persona({ natoIl: '2020-10-10', certificato: { conFile: false } })).certificato, segno('giallo', 'Serve dal 10/10'))
  ok('sotto i 6 anni senza certificato: nota «Non serve»', stato(persona({ natoIl: '2021-03-10', certificato: { conFile: false } })).certificato, segno('nota', 'Non serve'))
  ok('sotto i 6 anni con certificato valido: verde', stato(persona({ natoIl: '2021-03-10' })).certificato.tono, 'verde')
  ok('senza data di nascita e certificato valido: giallo «Senza data»', stato(persona({ natoIl: undefined })).certificato, segno('giallo', 'Senza data'))
  ok('senza data di nascita e certificato in scadenza: resta «Scade il gg/mm», che dice di più', stato(persona({ natoIl: undefined, certificato: { scade: fra(10), conFile: true } })).certificato, segno('giallo', `Scade il ${corta(fra(10))}`))
  ok('senza data di nascita e certificato che manca: vince il rosso «Manca»', stato(persona({ natoIl: undefined, certificato: { conFile: false } })).certificato, segno('rosso', 'Manca'))
  ok('senza data di nascita e certificato scaduto: vince il rosso «Scaduto»', stato(persona({ natoIl: undefined, certificato: { scade: fra(-1), conFile: false } })).certificato, segno('rosso', 'Scaduto'))
  // Il file di prima va archiviato: è lo stato giallo della colonna, non più un tag sotto il nome che allunga la riga.
  ok('valido col file di prima da archiviare: giallo «Da archiviare»', stato(persona({ certificato: { scade: fra(100), conFile: true, vecchio: true } })).certificato, segno('giallo', 'Da archiviare'))
  ok('scaduto col file di prima: vince il rosso «Scaduto»', stato(persona({ certificato: { scade: fra(-1), conFile: true, vecchio: true } })).certificato, segno('rosso', 'Scaduto'))

  console.log('\nELENCO: la colonna QUOTA (la quota, poi la tessera)')
  ok('certificato valido, quota pagata, nessuna tessera: verde e verde', stato(persona()), { certificato: segno('verde', 'In regola'), quota: [segno('verde', 'In regola')] })
  ok('certificato che manca e quota da pagare: «Manca» e «Da pagare», ognuno nella sua colonna', stato(persona({ certificato: { conFile: false }, quote: [] })), { certificato: segno('rosso', 'Manca'), quota: [segno('rosso', 'Da pagare')] })
  ok('quota scaduta: rosso «Scaduta»', stato(persona({ quote: [{ ...pagata, dal: '2025-09-01', al: fra(-1) }] })).quota, [segno('rosso', 'Scaduta')])
  ok('pagata in parte: giallo «In parte»', stato(persona({ quote: [{ ...pagata, mancano: 2000 }] })).quota, [segno('giallo', 'In parte')])
  ok('pagata fuori dall’app: verde «In regola», niente «Fuori app»', stato(persona({ quote: [], pagamento: { stato: 'pagato', fino: fra(100) } })).quota, [segno('verde', 'In regola')])
  ok('tessera che manca, il resto a posto: solo giallo «Tessera da fare», nessun verde', stato(persona(), [tessera('manca')]).quota, [segno('giallo', 'Tessera da fare')])
  ok('tessera scaduta, il resto a posto: rosso «Tessera scaduta»', stato(persona(), [tessera('scaduta', fra(-5))]).quota, [segno('rosso', 'Tessera scaduta')])
  ok('tessera in scadenza: giallo «Tessera scade a ottobre»', stato(persona(), [tessera('in_scadenza', '2026-10-05')]).quota, [segno('giallo', 'Tessera scade a ottobre')])
  ok('quota da pagare e tessera scaduta: tutte e due, la quota prima', stato(persona({ quote: [] }), [tessera('scaduta', fra(-5))]).quota, [segno('rosso', 'Da pagare'), segno('rosso', 'Tessera scaduta')])
  ok('quota in parte e tessera che manca: tutte e due', stato(persona({ quote: [{ ...pagata, mancano: 2000 }] }), [tessera('manca')]).quota, [segno('giallo', 'In parte'), segno('giallo', 'Tessera da fare')])
  ok('due enti con la tessera scaduta: una parola sola', stato(persona(), [tessera('scaduta', fra(-5)), tessera('scaduta', fra(-9), 'CSEN')]).quota, [segno('rosso', 'Tessera scaduta')])
  ok('due enti, una scaduta e una che manca: una parola per tipo', stato(persona(), [tessera('scaduta', fra(-5)), tessera('manca', undefined, 'CSEN')]).quota.map((s) => s.parola), ['Tessera scaduta', 'Tessera da fare'])
  ok('un corso che non chiede la tessera (non_iscritto): niente da dire', stato(persona(), [tessera('non_iscritto')]).quota, [segno('verde', 'In regola')])

  console.log('\nELENCO: chi è archiviato')
  ok('archiviato con tutti i guai: «Archiviato» spento e quota vuota', stato(persona({ attiva: false, certificato: { conFile: false }, quote: [] }), [tessera('manca')]), { certificato: segno('spento', 'Archiviato'), quota: [] })
  ok('archiviato con tutto a posto: niente verde', stato(persona({ attiva: false })), { certificato: segno('spento', 'Archiviato'), quota: [] })
  ok('archiviato con la tessera che manca: quota vuota lo stesso', stato(persona({ attiva: false }), [tessera('manca')]).quota, [])

  console.log('\nELENCO al telefono: certificato e quota a parole intere sotto il nome')
  {
    // Al telefono le colonne CERTIFICATO e QUOTA non ci stanno: le parole
    // vanno sotto il nome e devono dire da sole di cosa parlano.
    // paroleTelefono legge la persona, come statoPerElenco: i guai si decidono in un posto solo, non dalle parole corte.
    const telefono = (p, righe = []) => { try { return E.paroleTelefono(p, oggi, righe) } catch (e) { return `paroleTelefono: ${e.message}` } }
    const tel = (p, righe = []) => { const x = telefono(p, righe); return Array.isArray(x?.parole) ? x.parole : 'paroleTelefono non dà { parole, altri }' }
    const altri = (p, righe = []) => { const x = telefono(p, righe); return typeof x?.altri === 'string' ? x.altri : 'paroleTelefono non dà { parole, altri }' }
    const nomi = (x) => (Array.isArray(x) ? x.map((s) => s.parola) : x)
    const parole = (p, righe) => { const x = tel(p, righe); return Array.isArray(x) ? x.map((s) => s.parola) : x }
    ok('tutto a posto: un verde «In regola» e basta', tel(persona()), [segno('verde', 'In regola')])
    ok('certificato che manca: «Manca il certificato», rosso', tel(cert(undefined)), [segno('rosso', 'Manca il certificato')])
    ok('certificato scaduto: «Certificato scaduto»', parole(cert(fra(-1))), ['Certificato scaduto'])
    ok('scade oggi: «Certificato: scade oggi»', parole(cert(oggi)), ['Certificato: scade oggi'])
    ok('in scadenza: «Certificato: scade il gg/mm»', parole(cert(fra(10))), [`Certificato: scade il ${corta(fra(10))}`])
    ok('compie 6 anni: «Certificato: serve dal gg/mm»', parole(persona({ natoIl: '2020-10-10', certificato: { conFile: false } })), ['Certificato: serve dal 10/10'])
    ok('file di prima: «Certificato da archiviare», giallo', tel(persona({ certificato: { scade: fra(100), conFile: true, vecchio: true } })), [segno('giallo', 'Certificato da archiviare')])
    ok('senza data di nascita: «Manca la data di nascita»', parole(persona({ natoIl: undefined })), ['Manca la data di nascita'])
    ok('sotto i 6 anni senza certificato: niente da dire, «In regola»', tel(persona({ natoIl: '2021-03-10', certificato: { conFile: false } })), [segno('verde', 'In regola')])
    ok('quota da pagare: «Quota da pagare»', parole(persona({ quote: [] })), ['Quota da pagare'])
    ok('quota scaduta: «Quota scaduta»', parole(persona({ quote: [{ ...pagata, dal: '2025-09-01', al: fra(-1) }] })), ['Quota scaduta'])
    ok('pagata in parte: «Quota pagata in parte»', parole(persona({ quote: [{ ...pagata, mancano: 2000 }] })), ['Quota pagata in parte'])
    ok('la tessera dice già di cosa parla: resta com’è', parole(persona(), [tessera('scaduta', fra(-5))]), ['Tessera scaduta'])
    ok('certificato che manca e quota da pagare: prima il certificato, niente verdi', tel(persona({ certificato: { conFile: false }, quote: [] })), [segno('rosso', 'Manca il certificato'), segno('rosso', 'Quota da pagare')])
    ok('certificato a posto e quota da pagare: solo la quota', parole(persona({ quote: [] })), ['Quota da pagare'])
    ok('archiviato: «Archiviato» spento e basta', tel(persona({ attiva: false, certificato: { conFile: false }, quote: [] })), [segno('spento', 'Archiviato')])
    ok('sotto i 6 anni col certificato scaduto: «Non serve» non si dice', tel(persona({ natoIl: '2021-03-10', certificato: { scade: fra(-1), conFile: false } })), [segno('verde', 'In regola')])
    ok('tessera che manca: «Tessera da fare», giallo', tel(persona(), [tessera('manca')]), [segno('giallo', 'Tessera da fare')])
    // Due parole al massimo, prima i rossi; il resto è «+N» e si legge nella scheda: le righe restano alte uguali.
    ok('due guai: tutti e due, niente «+N»', altri(persona({ certificato: { conFile: false }, quote: [] })), '')
    ok('tre guai: i primi due e «+1 altro»', [tel(persona({ certificato: { conFile: false }, quote: [] }), [tessera('manca')]), altri(persona({ certificato: { conFile: false }, quote: [] }), [tessera('manca')])],
      [[segno('rosso', 'Manca il certificato'), segno('rosso', 'Quota da pagare')], '+1 altro'])
    ok('quattro guai: «+2 altri»', altri(persona({ certificato: { scade: fra(-1), conFile: false }, quote: [] }), [tessera('scaduta', fra(-5)), tessera('manca', undefined, 'CSEN')]), '+2 altri')
    ok('prima i rossi: la quota da pagare passa davanti al certificato in scadenza', nomi(tel(persona({ certificato: { scade: fra(10), conFile: true }, quote: [] }))),
      ['Quota da pagare', `Certificato: scade il ${corta(fra(10))}`])
    ok('tre gialli e un rosso: il rosso davanti, poi il primo giallo, «+2 altri»',
      [nomi(tel(persona({ natoIl: undefined, certificato: { scade: fra(10), conFile: true }, quote: [{ ...pagata, mancano: 2000 }] }), [tessera('scaduta', fra(-5)), tessera('manca', undefined, 'CSEN')])),
        altri(persona({ natoIl: undefined, certificato: { scade: fra(10), conFile: true }, quote: [{ ...pagata, mancano: 2000 }] }), [tessera('scaduta', fra(-5)), tessera('manca', undefined, 'CSEN')])],
      [['Tessera scaduta', `Certificato: scade il ${corta(fra(10))}`], '+2 altri'])
    ok('tutto a posto e archiviato: niente «+N»', [altri(persona()), altri(persona({ attiva: false, certificato: { conFile: false }, quote: [] }), [tessera('manca')])], ['', ''])
    // Un segno nuovo nella colonna non deve sparire, o cambiare colore, al telefono: quelli che non si vedono li conta «+N».
    const casi = [
      persona(), cert(undefined), cert(fra(-1)), cert(oggi), cert(fra(10)), persona({ natoIl: undefined }), persona({ quote: [] }),
      persona({ certificato: { scade: fra(100), conFile: true, vecchio: true } }), persona({ quote: [{ ...pagata, mancano: 2000 }] }),
      persona({ certificato: { conFile: false }, quote: [] }), persona({ natoIl: '2021-03-10', certificato: { scade: fra(-1), conFile: false } }),
    ]
    const toniGuai = (x) => (Array.isArray(x) ? x.filter((s) => s.tono === 'rosso' || s.tono === 'giallo').map((s) => s.tono) : [x])
    const prima = (t) => (t === 'rosso' ? 0 : 1)
    const contati = (x) => Number(/^\+(\d+) /.exec(x)?.[1] ?? 0)
    ok('i guai al telefono sono quelli delle colonne: i primi due per colore, e gli altri contati',
      casi.map((p) => [...toniGuai(tel(p, [tessera('manca')])), contati(altri(p, [tessera('manca')]))]),
      casi.map((p) => { const x = stato(p, [tessera('manca')]); const t = toniGuai([x.certificato, ...x.quota]).sort((a, b) => prima(a) - prima(b)); return [...t.slice(0, 2), Math.max(0, t.length - 2)] }))
  }

  console.log('\nELENCO: «In regola?» com’era, per la ricerca')
  ok('paroleInRegola: tutto a posto è ancora «In regola», e basta', E.paroleInRegola(persona(), oggi), [{ tono: 'verde', parola: 'In regola' }])
  ok('paroleInRegola: certificato che manca e quota da pagare, come prima', E.paroleInRegola(persona({ certificato: { conFile: false }, quote: [] }), oggi).map((x) => x.parola), ['Manca il certificato', 'Da pagare'])
  ok('paroleInRegola: la quota pagata fuori app dice ancora «Fuori app»', E.paroleInRegola(persona({ quote: [], pagamento: { stato: 'pagato', fino: fra(100) } }), oggi).map((x) => x.parola), ['In regola', 'Fuori app'])

  console.log('\nELENCO: i conti sui chip sono le righe che si vedrebbero col chip acceso da solo')
  {
    const sana = (id, altro = {}) => persona({ id, ...altro })
    const gente = [
      sana('a'),
      sana('b', { certificato: { conFile: false } }),
      sana('c', { certificato: { scade: fra(-3), conFile: false }, quote: [] }),
      sana('d', { quote: [] }),
      sana('e', { quote: [], attiva: false, certificato: { conFile: false } }),
      sana('f'),
      sana('g', { cognome: 'Verdi', pagamento: { stato: 'pagato', fino: fra(100) }, quote: [] }),
      sana('h', { cognome: 'Verdi', certificato: { conFile: false } }),
    ]
    const scoperti = new Set(['a', 'd'])
    const senzaTess = new Set(['f'])
    const c = { oggi, scopertiDi: (p) => (scoperti.has(p.id) ? ['Judo'] : []), tesseraDi: (p) => (senzaTess.has(p.id) ? [tessera('manca')] : []) }
    const tutte = () => true
    const chip = ['certificato', 'pagare', 'corsi-scaduti', 'fuori', 'minorenni']
    const conti = (base) => vedi('contiChip', (f) => f(gente, base, c))
    const veri = (base) => Object.fromEntries(chip.map((id) => [id, vedi('passaChip', (f) => gente.filter((p) => base(p) && f(id, p, c)).length)]))

    ok('senza ricerca né corso: i numeri a mano', conti(tutte), { certificato: 3, pagare: 2, 'corsi-scaduti': 2, fuori: 5, minorenni: 0 })
    ok('… e sono quelli di passaChip, il filtro vero', conti(tutte), veri(tutte))
    const soloVerdi = (p) => p.cognome === 'Verdi'
    ok('con la ricerca «Verdi» il conto cambia', conti(soloVerdi), { certificato: 1, pagare: 0, 'corsi-scaduti': 0, fuori: 1, minorenni: 0 })
    ok('… e torna con passaChip', conti(soloVerdi), veri(soloVerdi))
    const delCorso = (p) => ['b', 'c', 'd'].includes(p.id)
    ok('con un corso scelto il conto cambia', conti(delCorso), { certificato: 2, pagare: 2, 'corsi-scaduti': 1, fuori: 3, minorenni: 0 })
    ok('… e torna con passaChip', conti(delCorso), veri(delCorso))
    ok('«Senza certificato valido» conta come senzaCertificatoValido', vedi('passaChip', (f) => gente.map((p) => f('certificato', p, c))), gente.map((p) => E.senzaCertificatoValido(p, oggi)))
    ok('chi è archiviato non sta in «Da pagare»', vedi('passaChip', (f) => f('pagare', gente[4], c)), false)
    ok('«Non in regola» prende anche chi ha la tessera che manca', vedi('passaChip', (f) => f('fuori', gente[5], c)), true)
    const { readFileSync } = await import('node:fs')
    const tsx = readFileSync('src/components/segreteria/Iscritti.tsx', 'utf8')
    ok('Iscritti.tsx filtra con passaChip e conta con contiChip, non con condizioni sue', [tsx.includes('passaChip('), tsx.includes('contiChip(')], [true, true])
    ok('… e non rifà a mano le condizioni dei chip', ['senzaCertificatoValido(', 'daPagare(', 'fuoriRegola(', 'scopertiDi(p).length > 0) &&'].filter((x) => tsx.includes(x)), [])
  }

  console.log('\nELENCO: la cella CORSI')
  {
    const cella = (nomi, scaduti = false) => (typeof E.cellaCorsi === 'function' ? E.cellaCorsi(nomi, scaduti) : { altri: 'manca cellaCorsi' })
    ok('un corso: quello, niente «+N»', cella(['Judo']), { visibili: ['Judo'], altri: 0, title: 'Judo' })
    ok('due corsi: tutti e due', cella(['Judo', 'MGA']), { visibili: ['Judo', 'MGA'], altri: 0, title: 'Judo, MGA' })
    ok('tre corsi: i primi due e «+1», il title ha l’elenco intero', cella(['Judo', 'MGA', 'Lotta']), { visibili: ['Judo', 'MGA'], altri: 1, title: 'Judo, MGA, Lotta' })
    ok('cinque corsi: «+3»', cella(['A', 'B', 'C', 'D', 'E']).altri, 3)
    ok('col filtro Corsi scaduti: si vede tutto, niente «+N»', cella(['Judo', 'MGA', 'Lotta'], true), { visibili: ['Judo', 'MGA', 'Lotta'], altri: 0, title: 'Judo, MGA, Lotta' })
    ok('nessun corso: vuoto', cella([]), { visibili: [], altri: 0, title: '' })
  }

  console.log('\nELENCO: la barretta dei 30 GIORNI')
  {
    const perc = (f) => vedi('percentualeBarra', (g) => g(f))
    ok('9 su 12: 75%', perc({ presenti: 9, dovute: 12 }), 75)
    ok('1 su 3: 33%, intero', perc({ presenti: 1, dovute: 3 }), 33)
    ok('0 su 4: 0%, la barretta c’è ma è vuota', perc({ presenti: 0, dovute: 4 }), 0)
    ok('5 su 4: al massimo 100%', perc({ presenti: 5, dovute: 4 }), 100)
    ok('0 lezioni dovute: niente barretta', perc({ presenti: 0, dovute: 0 }), null)
    ok('senza dati: niente barretta', perc(undefined), null)
    const poco = (f) => vedi('vienePoco', (g) => g(f))
    ok('vienePoco: 1 su 3 sì', poco({ presenti: 1, dovute: 3 }), true)
    ok('vienePoco: metà esatta no', poco({ presenti: 2, dovute: 4 }), false)
    ok('vienePoco: meno di tre lezioni no', poco({ presenti: 0, dovute: 2 }), false)
    ok('vienePoco: senza dati no', poco(undefined), false)
  }
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
