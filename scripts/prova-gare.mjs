// ---------------------------------------------------------------------------
// Le gare, senza browser (`src/lib/gare.ts`).
//
//   node scripts/prova-gare.mjs
//
// La segreteria gestisce le gare della palestra: chi ci va, il certificato alla
// data della gara, la quota a voci. Qui le regole lato app; quelle del database
// (vincoli, RLS, incassa, unione dei doppioni) sono in `supabase/prova/gare.sql`.
// I criteri sono in `docs/design-canvas/gare/CRITERI.md` (i numeri fra parentesi).
//
// L'INTERFACCIA CHE QUESTA PROVA SI ASPETTA da `src/lib/gare.ts`
// (i soldi sono centesimi, le date `AAAA-MM-GG`, `oggi` lo passa chi chiama):
//
//   interface VoceGara { voce: string; importo: number }
//   interface PagamentoGara { importo: number; voci: VoceGara[]; metodo: string; data: string; ricevuta?: { anno: number; numero: number } }
//   interface Gara { id; nome; dal; al?; luogo?; indirizzo?; organizzatore?; note?;
//                    annullata: boolean; voci: VoceGara[]; accompagnatori: string[] /* id persona */ }
//   interface AtletaGara { garaId; personaId; nota?; pagamento?: PagamentoGara }
//
//   cosaNonVaGara(g: Pick<Gara, 'nome'|'dal'|'al'|'voci'>): string | null   (1, 14, 15)
//   ultimoGiorno(g): string                       al, se c'è; se no dal            (14)
//   dateGara(g): string                           «sabato 14 e domenica 15 novembre 2026»  (14)
//   ordinaGare(gare, oggi): { prossime: Gara[]; passate: Gara[] }                  (2, 3)
//   eliminabile(g, oggi): boolean                 solo se non è ancora passata     (2)
//   candidatiGara(persone: PersonaSeg[], atleti: AtletaGara[], cerca: string): { persona: PersonaSeg; giaDentro: boolean }[]   (4)
//   aggiungiAtleti(atleti, garaId, personaIds, persone): AtletaGara[]              (4)
//   certificatoAllaGara(p: PersonaSeg, g: Gara): StatoCertificato                  (6, 7, 14)
//   righeGara(g, atleti, persone): RigaAtletaGara[]   per cognome e nome           (5, 8, 9)
//     RigaAtletaGara = { personaId; nome; cognome; annoNascita?; certificato: StatoCertificato; scade?; daConfermare;
//                        senzaCertificatoValido: boolean; nota?; pagata: boolean }
//   scrittaCertificato(riga): { testo; tipo?: 'fatto'|'manca'|'aspetta' }   la cella CERTIFICATO  (6, 7)
//   avvisoCertificati(righe): string | null       «N atleti senza certificato valido»  (8)
//   totaleQuota(voci): number                     somma; 0 se non ce n'è           (15)
//   pagaGara(g, { metodo, data }): PagamentoGara  importo e voci di adesso, copiate (16)
//   contiGara(g, atleti): { totale; incassato; daPagare; pagati; nonPagati }       (16)
//   pagamentoComeRiga(g, persona, pagamento): RigaPagamento   di `pagamenti.ts`, voce «Gare»  (17)
//   gareVisibili(chi: { ruolo; personaId; corsiInsegnati: string[] }, gare, atleti, persone): Gara[]   (18, 19)
//   leMieGare(personeIds: string[], gare, atleti): GaraMia[]                        (19)
//   certificatoPerLaGara(scheda, g): { testo; dettaglio?; guaio } | null       nella mia gara  (19)
//     GaraMia = { gara: Gara; personaId; voci: VoceGara[]; totale; pagata: boolean; daPagare }
//   gareDellaSettimana(gare, lunedi: Date): { gara: Gara; giorni: string[] }[]     (20)
//     solo i giorni dentro la settimana, in ordine di primo giorno
//   suggerimenti(gare, campo: 'luogo'|'organizzatore', scritto: string): string[]  (21)
//   linkMappa(indirizzo?: string): string | null                                   (22)
//
// E in `src/lib/archivioProva.ts`: `archivio.dati.gare: Gara[]` e
// `archivio.dati.gareAtleti: AtletaGara[]` con una gara passata, una vicina e
// una annullata (11).
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
      "export * from './src/lib/gare'; export { incassiDerivati, cassaDelMetodo, voceDiSistema } from './src/lib/contabilita'; export { conti } from './src/lib/ricevute'; export { archivio } from './src/lib/archivioProva'; export { voceDaPagamento } from './src/lib/pagamenti'; export { creaGareProva } from './src/lib/gareDati'",
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
const gara = (id, nome, dal, extra = {}) => ({ id, nome, dal, annullata: false, voci: [], accompagnatori: [], ...extra })
const persona = (id, nome, cognome, extra = {}) => ({
  id,
  nome,
  cognome,
  attiva: true,
  creataIl: '2025-09-01',
  iscrizioni: [],
  certificato: { scade: extra.scade, conFile: false, inAttesaIl: extra.inAttesaIl },
  documento: false,
  pagamento: { stato: 'pagato' },
  natoIl: '1990-05-10',
  ...extra.resto,
})
const atleta = (garaId, personaId, extra = {}) => ({ garaId, personaId, ...extra })

const trofeo = gara('g1', 'Trofeo Città di Varese', '2026-11-14', {
  al: '2026-11-15',
  luogo: 'PalaWhirlpool, Varese',
  organizzatore: 'FIJLKAM Lombardia',
  voci: [
    { voce: 'Iscrizione', importo: 3000 },
    { voce: 'Trasferimento in pullman', importo: 1500 },
    { voce: 'Hotel, una notte', importo: 4500 },
  ],
})

// ---------------------------------------------------------------------------
console.log('\n1 · NOME E DATA: senza non parte, e dice cosa manca')
ok('nome e data bastano', m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-14', voci: [] }), null)
ok('senza nome dice di scrivere il nome', parla(m.cosaNonVaGara({ nome: '', dal: '2026-11-14', voci: [] }), 'nome'), true)
ok('un nome di soli spazi è senza nome', parla(m.cosaNonVaGara({ nome: '   ', dal: '2026-11-14', voci: [] }), 'nome'), true)
ok('senza data dice di scegliere la data', parla(m.cosaNonVaGara({ nome: 'Trofeo', dal: '', voci: [] }), 'data'), true)
ok('senza niente dice prima il nome', parla(m.cosaNonVaGara({ nome: '', dal: '', voci: [] }), 'nome'), true)
ok('una data scritta male non vale', parla(m.cosaNonVaGara({ nome: 'Trofeo', dal: '14/11/2026', voci: [] }), 'data'), true)
ok('una data che non esiste non vale (31 novembre)', parla(m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-31', voci: [] }), 'data'), true)
// Gli stessi limiti dei vincoli di 117-gare.sql: se no il database rifiuta con un testo tecnico.
const lunga = (n) => 'x'.repeat(n)
ok('un nome di 120 lettere va bene', m.cosaNonVaGara({ nome: lunga(120), dal: '2026-11-14', voci: [] }), null)
ok('uno di 121 no, e lo dice', parla(m.cosaNonVaGara({ nome: lunga(121), dal: '2026-11-14', voci: [] }), 'nome'), true)
ok('un luogo troppo lungo no', parla(m.cosaNonVaGara({ nome: 'T', dal: '2026-11-14', luogo: lunga(201), voci: [] }), 'luogo'), true)
ok('un indirizzo troppo lungo no', parla(m.cosaNonVaGara({ nome: 'T', dal: '2026-11-14', indirizzo: lunga(301), voci: [] }), 'indirizzo'), true)
ok('un organizzatore troppo lungo no', parla(m.cosaNonVaGara({ nome: 'T', dal: '2026-11-14', organizzatore: lunga(201), voci: [] }), 'organizza'), true)
ok('note troppo lunghe no', parla(m.cosaNonVaGara({ nome: 'T', dal: '2026-11-14', note: lunga(2001), voci: [] }), 'note'), true)
ok('una voce dal nome troppo lungo no', parla(m.cosaNonVaGara({ nome: 'T', dal: '2026-11-14', voci: [{ voce: lunga(121), importo: 500 }] }), 'voce'), true)
ok('una voce oltre 100.000 € no', parla(m.cosaNonVaGara({ nome: 'T', dal: '2026-11-14', voci: [{ voce: 'Hotel', importo: 10000001 }] }), 'importo'), true)
ok('una gara nel 1999 no', parla(m.cosaNonVaGara({ nome: 'T', dal: '1999-11-14', voci: [] }), 'data'), true)
ok('una gara che finisce nel 2101 no', parla(m.cosaNonVaGara({ nome: 'T', dal: '2100-12-31', al: '2101-01-01', voci: [] }), 'data'), true)
ok('una nota sull\'atleta di 301 lettere no, e lo dice', parla(m.cosaNonVaNota(lunga(301)), 'nota'), true)
ok('una di 300 sì', m.cosaNonVaNota(lunga(300)), null)

console.log('\n14 · PIÙ GIORNI: AL non prima di DAL')
ok('AL vuoto va bene', m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-14', al: undefined, voci: [] }), null)
ok('AL uguale a DAL va bene', m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-14', al: '2026-11-14', voci: [] }), null)
ok('AL dopo DAL va bene', m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-14', al: '2026-11-15', voci: [] }), null)
ok('AL prima di DAL no, e lo dice', parla(m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-15', al: '2026-11-14', voci: [] }), 'fine|prima'), true)
ok('l\'ultimo giorno è AL, se c\'è', m.ultimoGiorno(trofeo), '2026-11-15')
ok('e senza AL è DAL', m.ultimoGiorno(gara('x', 'Un giorno', '2026-11-14')), '2026-11-14')
ok('le date dette: due giorni', m.dateGara(trofeo), 'sabato 14 e domenica 15 novembre 2026')
ok('le date dette: un giorno', m.dateGara(gara('x', 'Un giorno', '2026-11-14')), 'sabato 14 novembre 2026')
ok('le date dette: AL uguale a DAL è un giorno', m.dateGara(gara('x', 'Un giorno', '2026-11-14', { al: '2026-11-14' })), 'sabato 14 novembre 2026')
ok('le date dette: a cavallo di due mesi', m.dateGara(gara('x', 'Ponte', '2026-10-31', { al: '2026-11-01' })), 'sabato 31 ottobre e domenica 1 novembre 2026')

console.log('\n15 · LA QUOTA A VOCI')
ok('il totale a atleta è la somma delle voci', m.totaleQuota(trofeo.voci), 9000)
ok('senza voci la gara non ha quota', m.totaleQuota([]), 0)
ok('una voce a zero non vale, e lo dice', parla(m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-14', voci: [{ voce: 'Gratis', importo: 0 }] }), 'importo'), true)
ok('una voce in negativo non vale', parla(m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-14', voci: [{ voce: 'Sconto', importo: -500 }] }), 'importo'), true)
ok('una voce senza nome non vale, e lo dice', parla(m.cosaNonVaGara({ nome: 'Trofeo', dal: '2026-11-14', voci: [{ voce: '  ', importo: 500 }] }), 'voce'), true)
ok('le voci buone passano', m.cosaNonVaGara(trofeo), null)

// ---------------------------------------------------------------------------
console.log('\n2 e 3 · ELENCO: le future dalla più vicina, poi le passate dalla più recente')
{
  const gennaio = gara('a', 'Gennaio', '2027-01-16')
  const novembre = trofeo
  const lunga = gara('l', 'In corso', '2026-10-24', { al: '2026-10-26' }) // comincia ieri, finisce domani: è ancora una gara che viene
  const oggiStesso = gara('o', 'Oggi', OGGI)
  const settembre = gara('s', 'Settembre', '2026-09-20')
  const giugno = gara('g', 'Giugno', '2026-06-06')
  const annullata = gara('x', 'Annullata', '2026-12-05', { annullata: true })
  const { prossime, passate } = m.ordinaGare([giugno, gennaio, settembre, annullata, novembre, oggiStesso, lunga], OGGI)
  ok('prima le future per data crescente (una in corso e una oggi contano)', prossime.map((g) => g.id), ['l', 'o', 'g1', 'x', 'a'])
  ok('poi le passate dalla più recente', passate.map((g) => g.id), ['s', 'g'])
  ok('una annullata resta in elenco, e resta annullata', prossime.find((g) => g.id === 'x')?.annullata, true)
  ok('una gara passata e annullata resta fra le passate', m.ordinaGare([gara('p', 'Vecchia', '2026-05-01', { annullata: true })], OGGI).passate.map((g) => g.id), ['p'])
  ok('senza gare l\'elenco è vuoto', m.ordinaGare([], OGGI), { prossime: [], passate: [] })
  ok('una gara di due giorni conta per l\'ultimo: finita ieri è passata', m.ordinaGare([gara('d', 'Due giorni', '2026-10-23', { al: '2026-10-24' })], OGGI).passate.length, 1)

  console.log('\n2 · UNA GARA PASSATA NON SI CANCELLA')
  ok('una futura si cancella', m.eliminabile(novembre, OGGI), true)
  ok('quella di oggi non è passata: si cancella', m.eliminabile(oggiStesso, OGGI), true)
  ok('una in corso si cancella', m.eliminabile(lunga, OGGI), true)
  ok('una passata no', m.eliminabile(settembre, OGGI), false)
  ok('una passata annullata no', m.eliminabile(gara('p', 'Vecchia', '2026-05-01', { annullata: true }), OGGI), false)
  ok('una futura annullata sì', m.eliminabile(annullata, OGGI), true)
  ok('finita ieri dopo due giorni: no', m.eliminabile(gara('d', 'Due giorni', '2026-10-23', { al: '2026-10-24' }), OGGI), false)
}

// ---------------------------------------------------------------------------
console.log('\n4 e 5 · CHI SI PUÒ AGGIUNGERE')
{
  const anna = persona('anna', 'Anna', 'Gullì')
  const luca = persona('luca', 'Luca', 'Rossi')
  const lucia = persona('lucia', 'Lucia', 'Rossi')
  const vecchio = persona('vecchio', 'Piero', 'Rossi', { resto: { attiva: false } })
  const persone = [anna, luca, lucia, vecchio]
  const dentro = [atleta('g1', 'luca')]

  const trovati = m.candidatiGara(persone, dentro, 'rossi')
  ok('cercando «rossi» escono gli attivi, non l\'archiviato', trovati.map((c) => c.persona.id).sort(), ['luca', 'lucia'])
  ok('chi c\'è già è segnato: spento nell\'elenco', Object.fromEntries(trovati.map((c) => [c.persona.id, c.giaDentro])), { luca: true, lucia: false })
  ok('l\'archiviato non compare nemmeno scrivendo il suo nome', m.candidatiGara(persone, dentro, 'piero').length, 0)
  ok('la ricerca ignora maiuscole e accenti', m.candidatiGara(persone, dentro, 'GULLI').map((c) => c.persona.id), ['anna'])
  ok('nome e cognome insieme', m.candidatiGara(persone, dentro, 'anna gulli').map((c) => c.persona.id), ['anna'])

  const dopo = m.aggiungiAtleti(dentro, 'g1', ['anna', 'luca', 'lucia'], persone)
  ok('si aggiungono Anna e Lucia, Luca c\'era già', dopo.filter((a) => a.garaId === 'g1').map((a) => a.personaId).sort(), ['anna', 'luca', 'lucia'])
  ok('riaggiungere non duplica', m.aggiungiAtleti(dopo, 'g1', ['anna', 'luca'], persone).length, 3)
  ok('lo stesso id due volte nella stessa chiamata è una volta sola', m.aggiungiAtleti([], 'g1', ['anna', 'anna'], persone).length, 1)
  ok('un archiviato non si aggiunge', m.aggiungiAtleti([], 'g1', ['vecchio'], persone).length, 0)
  ok('uno che non esiste non si aggiunge', m.aggiungiAtleti([], 'g1', ['fantasma'], persone).length, 0)
  ok('la stessa persona può andare a un\'altra gara', m.aggiungiAtleti(dentro, 'g2', ['luca'], persone).length, 2)
  ok('l\'elenco di partenza non si cambia', dentro.length, 1)

  console.log('\n5 · CHI VIENE ARCHIVIATO DOPO LA GARA RESTA NELL\'ELENCO')
  const righe = m.righeGara(trofeo, [atleta('g1', 'luca'), atleta('g1', 'vecchio')], persone)
  ok('l\'archiviato è ancora una riga di quella gara', righe.map((r) => r.personaId).sort(), ['luca', 'vecchio'])
  ok('una riga di un\'altra gara non entra', m.righeGara(trofeo, [atleta('g1', 'luca'), atleta('g2', 'anna')], persone).map((r) => r.personaId), ['luca'])
}

// ---------------------------------------------------------------------------
console.log('\n6, 7 e 14 · IL CERTIFICATO ALL\'ULTIMO GIORNO DELLA GARA')
{
  const marzo = gara('m', 'Gara di marzo', '2027-03-14')
  // Scade il 1 marzo: oggi (25 ottobre) vale, il 14 marzo no.
  const scade1marzo = persona('a', 'Ada', 'Uno', { scade: '2027-03-01' })
  ok('oggi il certificato vale', m.certificatoAllaGara(scade1marzo, gara('oggi', 'Oggi', OGGI)), 'valido')
  ok('alla gara del 14 marzo è scaduto', m.certificatoAllaGara(scade1marzo, marzo), 'scaduto')
  ok('e conta come senza certificato valido', m.righeGara(marzo, [atleta('m', 'a')], [scade1marzo])[0].senzaCertificatoValido, true)

  ok('scade dopo la gara: valido', m.certificatoAllaGara(persona('b', 'Bea', 'Due', { scade: '2027-12-31' }), marzo), 'valido')
  ok('scade pochi giorni dopo la gara: in scadenza, ma valido', m.certificatoAllaGara(persona('c', 'Ciro', 'Tre', { scade: '2027-03-20' }), marzo), 'in_scadenza')
  ok('senza certificato manca', m.certificatoAllaGara(persona('d', 'Dino', 'Quattro'), marzo), 'manca')
  ok('manca vale come senza certificato valido', m.righeGara(marzo, [atleta('m', 'd')], [persona('d', 'Dino', 'Quattro')])[0].senzaCertificatoValido, true)

  console.log('\n7 · UN CERTIFICATO NON CONFERMATO VALE COME NON VALIDO')
  const inAttesa = persona('e', 'Elia', 'Cinque', { inAttesaIl: '2026-10-20' })
  ok('mandato e non confermato: manca', m.certificatoAllaGara(inAttesa, marzo), 'manca')
  ok('e la riga lo conta fra chi non ha il certificato valido', m.righeGara(marzo, [atleta('m', 'e')], [inAttesa])[0].senzaCertificatoValido, true)
  const scadutoInAttesa = persona('f', 'Fede', 'Sei', { scade: '2026-09-01', inAttesaIl: '2026-10-20' })
  ok('il vecchio scaduto con un nuovo in attesa: scaduto', m.certificatoAllaGara(scadutoInAttesa, gara('n', 'Novembre', '2026-11-14')), 'scaduto')

  console.log('\n6 e 7 · LA SCRITTA DEL CERTIFICATO NELLA RIGA')
  const scritta = (p, g = marzo) => m.scrittaCertificato(m.righeGara(g, [atleta(g.id, p.id)], [p])[0])
  ok('valido: fino a quando', scritta(persona('b', 'Bea', 'Due', { scade: '2027-12-31' })), { testo: 'Valido, scade il 31 dicembre 2027', tipo: 'fatto' })
  ok('scade dopo la gara ma presto: valido lo stesso', scritta(persona('c', 'Ciro', 'Tre', { scade: '2027-03-20' })).tipo, 'fatto')
  ok('scade prima della gara: quando, detto', scritta(scade1marzo), { testo: 'Scade il 1° marzo 2027, prima della gara', tipo: 'manca' })
  ok('mandato e non confermato: da confermare', scritta(inAttesa), { testo: 'Caricato, da confermare', tipo: 'aspetta' })
  ok('scaduto con uno nuovo da confermare: da confermare', scritta(scadutoInAttesa, gara('n', 'Novembre', '2026-11-14')), { testo: 'Caricato, da confermare', tipo: 'aspetta' })
  ok('niente: manca', scritta(persona('d', 'Dino', 'Quattro')), { testo: 'Manca', tipo: 'manca' })
  ok('sotto i 6 anni: non serve', scritta(persona('h', 'Ugo', 'Otto', { resto: { natoIl: '2024-01-01' } })), { testo: 'Non serve', tipo: undefined })

  console.log('\n14 · SI CONTROLLA ALL\'ULTIMO GIORNO, NON AL PRIMO')
  const finePrima = persona('g', 'Gina', 'Sette', { scade: '2026-11-14' }) // scade il primo giorno
  ok('scade il primo giorno di due: all\'ultimo è scaduto', m.certificatoAllaGara(finePrima, trofeo), 'scaduto')
  ok('la stessa gara di un solo giorno: ancora valido (scade quel giorno)', m.certificatoAllaGara(finePrima, { ...trofeo, al: undefined }) !== 'scaduto', true)
  ok('scade l\'ultimo giorno: vale ancora', m.certificatoAllaGara(persona('h', 'Ugo', 'Otto', { scade: '2026-11-15' }), trofeo) !== 'scaduto', true)

  console.log('\n8 · LA RIGA IN TESTA CONTA CHI NON HA IL CERTIFICATO VALIDO')
  const piccola = persona('p', 'Pia', 'Nove', { resto: { natoIl: '2023-03-01' } }) // 4 anni alla gara: il certificato non serve
  const tutti = [scade1marzo, persona('b', 'Bea', 'Due', { scade: '2027-12-31' }), persona('d', 'Dino', 'Quattro'), inAttesa, piccola]
  const righe = m.righeGara(marzo, tutti.map((p) => atleta('m', p.id)), tutti)
  ok('una bambina sotto i 6 anni non è senza certificato', righe.find((r) => r.personaId === 'p').senzaCertificatoValido, false)
  ok('l\'avviso conta scaduto, mancante e in attesa: 3', m.avvisoCertificati(righe), '3 atleti senza certificato valido')
  ok('con uno solo, al singolare', m.avvisoCertificati(righe.filter((r) => r.personaId === 'd')), '1 atleta senza certificato valido')
  ok('se sono tutti a posto non c\'è l\'avviso', m.avvisoCertificati(righe.filter((r) => r.personaId === 'b')), null)
  ok('senza atleti non c\'è l\'avviso', m.avvisoCertificati([]), null)
  ok('l\'aggiunta di uno senza certificato riesce (avvisa, non blocca)', m.aggiungiAtleti([], 'm', ['d'], tutti).length, 1)
}

// ---------------------------------------------------------------------------
console.log('\n3 e 9 · LA RIGA DELL\'ATLETA: per cognome, e niente dati del genitore')
{
  const minore = persona('min', 'Giulia', 'Colombo', {
    resto: {
      natoIl: '2012-04-09',
      email: 'genitore@example.it',
      telefono: '333 1234567',
      genitoreNome: 'Marta',
      genitoreCognome: 'Colombo',
      genitoreCodiceFiscale: 'CLMMRT80A41L219X',
      genitoreEmail: 'marta@example.it',
      genitoreTelefono: '338 7654321',
      indirizzo: 'via Roma 1',
      codiceFiscale: 'CLMGLI12D49L219X',
    },
  })
  const altro = persona('abb', 'Zeno', 'Abbate')
  const righe = m.righeGara(trofeo, [atleta('g1', 'min', { nota: '−52 kg' }), atleta('g1', 'abb')], [minore, altro])
  ok('l\'elenco è per cognome', righe.map((r) => r.cognome), ['Abbate', 'Colombo'])
  const riga = righe[1]
  ok('la riga ha nome, cognome e anno di nascita', [riga.nome, riga.cognome, riga.annoNascita], ['Giulia', 'Colombo', 2012])
  ok('e la nota', riga.nota, '−52 kg')
  const testo = JSON.stringify(righe)
  ok('nessun dato del genitore: né nome, né codice, né contatti', ['Marta', 'CLMMRT', 'marta@', '338 7654321', 'genitore'].filter((t) => testo.includes(t)), [])
  ok('nessun contatto della scheda: email, telefono, indirizzo, codice fiscale', ['@', '333 1234567', 'via Roma', 'CLMGLI'].filter((t) => testo.includes(t)), [])
  ok('la riga porta solo i campi previsti', Object.keys(riga).sort(), ['annoNascita', 'certificato', 'cognome', 'daConfermare', 'nome', 'nota', 'pagata', 'personaId', 'scade', 'senzaCertificatoValido'].sort())
}

// ---------------------------------------------------------------------------
console.log('\n16 · INCASSATO E DA PAGARE: chi ha pagato non cambia')
{
  const atleti = [atleta('g1', 'a'), atleta('g1', 'b'), atleta('g1', 'c')]
  const prima = m.contiGara(trofeo, atleti)
  ok('nessuno ha pagato: 0 incassato, 3 × 90 € da pagare', [prima.totale, prima.incassato, prima.daPagare, prima.pagati, prima.nonPagati], [9000, 0, 27000, 0, 3])
  const pag = m.pagaGara(trofeo, { metodo: 'Contanti', data: OGGI })
  ok('il pagamento registra importo, metodo e data', [pag.importo, pag.metodo, pag.data], [9000, 'Contanti', OGGI])
  ok('e le voci di quel momento', pag.voci, trofeo.voci)
  const conA = [{ ...atleti[0], pagamento: pag }, atleti[1], atleti[2]]
  const dopo = m.contiGara(trofeo, conA)
  ok('uno ha pagato: 90 € incassati, 2 × 90 € da pagare', [dopo.incassato, dopo.daPagare, dopo.pagati, dopo.nonPagati], [9000, 18000, 1, 2])

  // Le voci cambiano: l'hotel costa meno e c'è una cena.
  const nuova = { ...trofeo, voci: [{ voce: 'Iscrizione', importo: 3000 }, { voce: 'Trasferimento in pullman', importo: 1500 }, { voce: 'Hotel, una notte', importo: 4000 }, { voce: 'Cena', importo: 2000 }] }
  const cambiata = m.contiGara(nuova, conA)
  ok('il totale nuovo è 105 €', cambiata.totale, 10500)
  ok('chi ha pagato resta a 90 €: l\'incassato non cambia', cambiata.incassato, 9000)
  ok('chi non ha pagato deve il totale nuovo', cambiata.daPagare, 21000)
  ok('il pagamento di A ha ancora l\'hotel a 45 €', conA[0].pagamento.voci.find((v) => v.voce.startsWith('Hotel')).importo, 4500)
  ok('chi paga dopo paga il totale nuovo', m.pagaGara(nuova, { metodo: 'Bonifico', data: OGGI }).importo, 10500)

  // Il pagamento si porta dietro una copia delle voci, non lo stesso elenco.
  const gm = { ...trofeo, voci: trofeo.voci.map((v) => ({ ...v })) }
  const p2 = m.pagaGara(gm, { metodo: 'Contanti', data: OGGI })
  gm.voci.push({ voce: 'Extra', importo: 100 })
  gm.voci[0].importo = 1
  ok('cambiare le voci dopo non tocca il pagamento già fatto', [p2.importo, p2.voci.length, p2.voci[0].importo], [9000, 3, 3000])
  ok('una gara senza voci non si incassa, e lo dice', parla(errore(() => m.pagaGara(gara('x', 'Senza quota', '2026-11-14'), { metodo: 'Contanti', data: OGGI })), 'quota|voci'), true)
  ok('senza voci non ci sono conti', m.contiGara(gara('x', 'Senza quota', '2026-11-14'), atleti), { totale: 0, incassato: 0, daPagare: 0, pagati: 0, nonPagati: 0 })
  ok('le righe dicono chi ha pagato', m.righeGara(trofeo, conA, [persona('a', 'Ada', 'Uno'), persona('b', 'Bea', 'Due'), persona('c', 'Ciro', 'Tre')]).map((r) => [r.personaId, r.pagata]).sort(), [['a', true], ['b', false], ['c', false]])
}

// ---------------------------------------------------------------------------
console.log('\n17 · INCASSA: CONTABILITÀ E RICEVUTA')
{
  const ada = persona('a', 'Ada', 'Uno')
  const casse = [
    { id: 'cassa-contanti', nome: 'Cassa Contanti', saldoIniziale: 0 },
    { id: 'conto', nome: 'Conto Corrente', saldoIniziale: 0 },
  ]
  const incasso = (metodo) => m.incassiDerivati([m.pagamentoComeRiga(trofeo, ada, m.pagaGara(trofeo, { metodo, data: '2026-10-25' }))], casse)[0]
  const contanti = incasso('Contanti')
  ok('in contanti entra in Cassa Contanti', contanti.cassaId, 'cassa-contanti')
  ok('per 90 €, di entrata, a nome di chi ha pagato', [contanti.importo, contanti.tipo, contanti.personaId, contanti.descrizione], [9000, 'entrata', 'a', 'Uno Ada'])
  ok('con la voce «Gare»', contanti.voce, 'Gare')
  ok('un bonifico entra nel Conto Corrente', incasso('Bonifico').cassaId, 'conto')
  ok('POS e assegno, se no, vanno nel Conto Corrente', ['POS', 'Assegno'].map((x) => incasso(x).cassaId), ['conto', 'conto'])
  const riga = m.pagamentoComeRiga(trofeo, ada, m.pagaGara(trofeo, { metodo: 'Contanti', data: '2026-10-25' }))
  ok('la riga di PAGAMENTI ha la voce «Gare» e non è annullata', [riga.voce, riga.annullato, riga.data], ['Gare', false, '2026-10-25'])
  // La ricevuta si fa dal pagamento a mano (FANNE LA RICEVUTA), con la riga «Gare»: una riga per voce
  // («Iscrizione», «Hotel…») porterebbe l'incasso in «Corsi e altri pagamenti».
  ok('una riga di ricevuta «Iscrizione» non è più delle gare', m.voceDiSistema('Iscrizione'), 'Corsi e altri pagamenti')
  const dp = m.pagamentoPerRicevuta(trofeo, 'a', { metodo: 'Contanti', data: '2026-10-25' }, 'pag-1', 'chiave-1')
  ok('la ricevuta parte dal pagamento registrato, con la gara nella nota', [dp.personaId, dp.pagamentoId, dp.chiaveRicevuta, dp.nota], ['a', 'pag-1', 'chiave-1', trofeo.nome])
  const voce = m.voceDaPagamento(dp)
  ok('e ha una riga sola, «Gare», col totale della quota', [voce.descrizione, voce.quantita, voce.prezzo], ['Gare', 1, 9000])
  ok('pagata il giorno e col metodo dell’incasso', voce.pagamenti, [{ data: '2026-10-25', importo: 9000, metodo: 'Contanti' }])
}

// ---------------------------------------------------------------------------
console.log('\n18 e 19 · CHI VEDE COSA')
{
  const judo = 'corso-judo'
  const pesi = 'corso-pesi'
  const luca = persona('luca', 'Luca', 'Rossi', { resto: { iscrizioni: [{ corsoId: judo, dal: '2026-09-14' }] } })
  const marco = persona('marco', 'Marco', 'Verdi', { resto: { iscrizioni: [{ corsoId: pesi, dal: '2026-09-14' }] } })
  const sara = persona('sara', 'Sara', 'Bianchi', { resto: { nucleo: 'papa', iscrizioni: [{ corsoId: judo, dal: '2026-09-14' }] } })
  const persone = [luca, marco, sara]
  const g1 = gara('g1', 'Trofeo', '2026-11-14', { accompagnatori: ['gianni'], voci: [{ voce: 'Iscrizione', importo: 3000 }] })
  const g2 = gara('g2', 'Gara Torino', '2026-12-05', { voci: [{ voce: 'Iscrizione', importo: 2500 }] })
  const g3 = gara('g3', 'Nessuno', '2027-01-16')
  const gare = [g1, g2, g3]
  const atleti = [atleta('g1', 'luca'), atleta('g1', 'sara'), atleta('g2', 'marco')]
  const vede = (chi) => m.gareVisibili(chi, gare, atleti, persone).map((g) => g.id)

  ok('la segreteria le vede tutte', vede({ ruolo: 'staff', personaId: 'anna', corsiInsegnati: [] }), ['g1', 'g2', 'g3'])
  ok('Maura insegna Judo: vede la gara di Luca', vede({ ruolo: 'istruttore', personaId: 'maura', corsiInsegnati: [judo] }), ['g1'])
  ok('Piero insegna Pesi: vede quella di Marco, non l\'altra', vede({ ruolo: 'istruttore', personaId: 'piero', corsiInsegnati: [pesi] }), ['g2'])
  ok('Gianni accompagna e non insegna: la vede lo stesso', vede({ ruolo: 'istruttore', personaId: 'gianni', corsiInsegnati: [] }), ['g1'])
  ok('Zeno non insegna né accompagna: niente', vede({ ruolo: 'istruttore', personaId: 'zeno', corsiInsegnati: [] }), [])
  ok('più accompagnatori: tutti la vedono', m.gareVisibili({ ruolo: 'istruttore', personaId: 'zeno', corsiInsegnati: [] }, [{ ...g1, accompagnatori: ['gianni', 'zeno'] }], atleti, persone).length, 1)
  const finito = persona('finito', 'Ugo', 'Neri', { resto: { iscrizioni: [{ corsoId: judo, dal: '2025-09-14', al: '2026-06-30' }] } })
  ok('chi non è più iscritto al corso di Maura non le apre la gara (come in 117-gare.sql)', m.gareVisibili({ ruolo: 'istruttore', personaId: 'maura', corsiInsegnati: [judo] }, [g2], [atleta('g2', 'finito')], [finito]).length, 0)
  ok('chi insegna due corsi vede le gare di tutti e due', vede({ ruolo: 'istruttore', personaId: 'maura', corsiInsegnati: [judo, pesi] }), ['g1', 'g2'])
  ok('l\'iscritto vede le sue gare', vede({ ruolo: 'iscritto', personaId: 'luca', corsiInsegnati: [] }), ['g1'])
  ok('un altro iscritto vede le sue, non quelle di Luca', vede({ ruolo: 'iscritto', personaId: 'marco', corsiInsegnati: [] }), ['g2'])
  ok('chi non è in nessuna gara non vede niente', vede({ ruolo: 'iscritto', personaId: 'nuovo', corsiInsegnati: [] }), [])
  const papa = { ruolo: 'iscritto', personaId: 'papa', corsiInsegnati: [] }
  ok('il genitore titolare vede la gara della figlia (come iscritto_puo_vedere)', vede(papa), ['g1'])
  const righe = (chi, tutti) => m.atletiVisibili(chi, m.gareVisibili(chi, gare, tutti, persone), tutti, persone).map((a) => `${a.garaId}/${a.personaId}`)
  ok('e la riga di lei, non quella di Luca', righe(papa, atleti), ['g1/sara'])
  const conMarco = [...atleti, atleta('g1', 'marco')]
  ok('Maura vede i suoi atleti, non Marco di Pesi che va alla stessa gara', righe({ ruolo: 'istruttore', personaId: 'maura', corsiInsegnati: [judo] }, conMarco), ['g1/luca', 'g1/sara'])
  ok('Gianni accompagna: li vede tutti', righe({ ruolo: 'istruttore', personaId: 'gianni', corsiInsegnati: [] }, conMarco), ['g1/luca', 'g1/sara', 'g1/marco'])

  console.log('\n19 · LE MIE GARE: le voci e quanto devo, non gli altri atleti')
  const pagata = m.pagaGara(g1, { metodo: 'Contanti', data: OGGI })
  const mie = m.leMieGare(['luca'], gare, [atleta('g1', 'luca'), atleta('g1', 'sara'), atleta('g2', 'marco')])
  ok('Luca ha una gara', mie.map((x) => x.gara.id), ['g1'])
  ok('con le sue voci, il totale e quanto deve', [mie[0].voci, mie[0].totale, mie[0].pagata, mie[0].daPagare], [[{ voce: 'Iscrizione', importo: 3000 }], 3000, false, 3000])
  const pagataLuca = m.leMieGare(['luca'], gare, [atleta('g1', 'luca', { pagamento: pagata }), atleta('g1', 'sara')])
  ok('se ha pagato non deve più niente', [pagataLuca[0].pagata, pagataLuca[0].daPagare], [true, 0])
  ok('non c\'è l\'elenco degli altri atleti: né Sara né Marco', ['sara', 'Sara', 'Bianchi', 'marco'].filter((t) => JSON.stringify(mie).includes(t)), [])
  ok('un genitore vede le gare di sua figlia, quanto deve per lei', m.leMieGare(['papa', 'sara'], gare, atleti).map((x) => [x.gara.id, x.personaId]), [['g1', 'sara']])
  ok('senza gare, un elenco vuoto', m.leMieGare(['nuovo'], gare, atleti), [])
  ok('l\'iscritto vede la sua categoria, scritta dalla segreteria', m.leMieGare(['luca'], gare, [atleta('g1', 'luca', { nota: 'Cadetti -55 kg' })])[0].nota, 'Cadetti -55 kg')

  console.log('\n19 · IL CERTIFICATO NELLA MIA GARA: cosa fare, e per quando')
  const trofeoN = gara('t', 'Trofeo', '2026-11-14', { al: '2026-11-15' })
  ok('scade prima della gara: va rinnovato prima del primo giorno', m.certificatoPerLaGara(persona('a', 'Giulia', 'Colombo', { scade: '2026-11-02' }), trofeoN), {
    testo: 'Certificato: scade il 2 novembre',
    dettaglio: 'Scade prima della gara. Va rinnovato in segreteria prima del 14 novembre.',
    guaio: true,
  })
  ok('valido alla gara: nessun guaio', m.certificatoPerLaGara(persona('b', 'Bea', 'Due', { scade: '2027-12-31' }), trofeoN), { testo: 'Certificato: valido fino al 31 dicembre 2027', guaio: false })
  ok('manca: va portato', m.certificatoPerLaGara(persona('d', 'Dino', 'Quattro'), trofeoN), { testo: 'Certificato: manca', dettaglio: 'Va portato in segreteria prima del 14 novembre.', guaio: true })
  ok('caricato e non confermato: non vale ancora', m.certificatoPerLaGara(persona('e', 'Elia', 'Cinque', { inAttesaIl: '2026-10-20' }), trofeoN), {
    testo: 'Certificato: caricato, la segreteria lo deve ancora confermare',
    dettaglio: 'Finché non lo conferma non vale per la gara.',
    guaio: true,
  })
  ok('sotto i 6 anni: niente da dire', m.certificatoPerLaGara(persona('h', 'Ugo', 'Otto', { resto: { natoIl: '2024-01-01' } }), trofeoN), null)
}

// ---------------------------------------------------------------------------
console.log('\n20 · LA SETTIMANA DEL CALENDARIO: le gare, sui giorni che coprono')
{
  const lunedi = (a, mese, g) => new DateVera(a, mese - 1, g)
  const sett = (g) => m.gareDellaSettimana([trofeo, gara('s', 'Lunedì', '2026-11-09'), gara('f', 'Lontana', '2026-12-05')], g).map((x) => [x.gara.id, x.giorni])
  ok('la settimana 9–15 novembre: il Trofeo sul sabato e la domenica, il lunedì', sett(lunedi(2026, 11, 9)), [['s', ['2026-11-09']], ['g1', ['2026-11-14', '2026-11-15']]])
  ok('la settimana prima: niente', sett(lunedi(2026, 11, 2)), [])
  ok('la gara di un solo giorno prende una sola colonna', m.gareDellaSettimana([gara('u', 'Un giorno', '2026-11-14')], lunedi(2026, 11, 9))[0].giorni, ['2026-11-14'])
  const ponte = gara('p', 'Domenica e lunedì', '2026-11-15', { al: '2026-11-16' })
  ok('una gara a cavallo di due settimane: nella prima solo la domenica', m.gareDellaSettimana([ponte], lunedi(2026, 11, 9))[0].giorni, ['2026-11-15'])
  ok('e nella seconda solo il lunedì', m.gareDellaSettimana([ponte], lunedi(2026, 11, 16))[0].giorni, ['2026-11-16'])
  ok('a cavallo del cambio d\'ora (25 ottobre) i giorni non saltano', m.gareDellaSettimana([gara('c', 'Cambio ora', '2026-10-24', { al: '2026-10-26' })], lunedi(2026, 10, 19))[0].giorni, ['2026-10-24', '2026-10-25'])
  ok('senza gare, niente', m.gareDellaSettimana([], lunedi(2026, 11, 9)), [])
}

// ---------------------------------------------------------------------------
console.log('\n21 · LUOGO E ORGANIZZATORE: i valori già usati, dal più usato')
{
  const g = (id, luogo, organizzatore) => gara(id, id, '2026-11-14', { luogo, organizzatore })
  const gare = [
    g('1', 'PalaWhirlpool, Varese', 'FIJLKAM Lombardia'),
    g('2', 'Palestra Ods, Torino', 'FIJLKAM Piemonte'),
    g('3', 'PalaWhirlpool, Varese', 'FIJLKAM Lombardia'),
    g('4', 'Palazzetto di Alessandria', 'FIJLKAM Piemonte'),
    g('5', 'palawhirlpool, varese', ''),
    g('6', undefined, undefined),
    g('7', '  ', '  '),
  ]
  ok('«pal» propone i tre luoghi, dal più usato', m.suggerimenti(gare, 'luogo', 'pal'), ['PalaWhirlpool, Varese', 'Palazzetto di Alessandria', 'Palestra Ods, Torino'])
  ok('maiuscole e minuscole contano come uno, vale la prima scrittura', m.suggerimenti(gare, 'luogo', 'varese').length, 1)
  ok('anche chi contiene quel che si scrive: «torino»', m.suggerimenti(gare, 'luogo', 'torino'), ['Palestra Ods, Torino'])
  ok('chi comincia viene prima di chi contiene, a parità', m.suggerimenti([g('a', 'Hotel Torino', ''), g('b', 'Torino Esposizioni', '')], 'luogo', 'torino'), ['Torino Esposizioni', 'Hotel Torino'])
  ok('non c\'è niente di simile: nessun suggerimento', m.suggerimenti(gare, 'luogo', 'zzz'), [])
  ok('i vuoti non si propongono', m.suggerimenti(gare, 'luogo', '').includes(''), false)
  ok('senza scritto si propongono tutti, dal più usato', m.suggerimenti(gare, 'luogo', '')[0], 'PalaWhirlpool, Varese')
  ok('ORGANIZZATORE: a parità di uso, alfabetico', m.suggerimenti(gare, 'organizzatore', 'fij'), ['FIJLKAM Lombardia', 'FIJLKAM Piemonte'])
  ok('senza gare, niente', m.suggerimenti([], 'luogo', 'pal'), [])
}

// ---------------------------------------------------------------------------
console.log('\n22 · INDIRIZZO: il link alla mappa, senza chiave')
{
  const via = 'Via Giolitti 12, Torino'
  ok('un indirizzo diventa la ricerca di Google Maps', m.linkMappa(via), 'https://www.google.com/maps/search/?api=1&query=Via%20Giolitti%2012%2C%20Torino')
  ok('senza chiave API nel link', /key=/.test(m.linkMappa(via)), false)
  ok('gli spazi attorno non contano', m.linkMappa('  ' + via + '  '), m.linkMappa(via))
  ok('& e # nell\'indirizzo non rompono l\'indirizzo del link', new URL(m.linkMappa('Via A&B #3, Torino')).searchParams.get('query'), 'Via A&B #3, Torino')
  ok('senza indirizzo, niente link', m.linkMappa(undefined), null)
  ok('un indirizzo di soli spazi, niente link', m.linkMappa('   '), null)
}

// ---------------------------------------------------------------------------
console.log('\n11 · MODALITÀ PROVA: gare di esempio, stesse regole')
{
  const gare = m.archivio.dati.gare ?? []
  const gareAtleti = m.archivio.dati.gareAtleti ?? []
  ok('ci sono tre gare di esempio', gare.length, 3)
  const { prossime, passate } = m.ordinaGare(gare, OGGI)
  ok('una annullata', gare.filter((g) => g.annullata).length, 1)
  ok('una passata che non è annullata', passate.filter((g) => !g.annullata).length, 1)
  ok('una vicina: viene entro due mesi, e non è annullata', prossime.filter((g) => !g.annullata && g.dal <= '2026-12-25').length, 1)
  ok('ognuna è una gara valida', gare.map((g) => m.cosaNonVaGara(g)), [null, null, null])
  ok('la vicina ha degli atleti e una quota, per vedere le regole', (() => {
    const v = prossime.find((g) => !g.annullata)
    return [gareAtleti.some((a) => a.garaId === v.id), m.totaleQuota(v.voci) > 0]
  })(), [true, true])
  ok('gli atleti di esempio sono persone dell\'archivio di prova', gareAtleti.every((a) => m.archivio.dati.persone.some((p) => p.id === a.personaId)), true)
}

console.log('\n11 · MODALITÀ PROVA: chi ha pagato resta, la gara annullata non si incassa (come 117-gare.sql)')
{
  const d = await m.creaGareProva()
  const rifiuto = async (f) => {
    try {
      await f()
      return 'passato'
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }
  const chi = m.archivio.dati.persone.find((p) => p.ruolo === 'iscritto' && p.attiva).id
  const quota = [{ voce: 'Iscrizione', importo: 2000 }]
  const id = await d.salva({ nome: 'Prova pagata', dal: '2026-12-12', annullata: false, voci: quota, accompagnatori: [] })
  await d.aggiungi(id, [chi])
  const incasso = d.incassa(id, chi, ' Contanti ', OGGI)
  // Una nota scritta mentre l'incasso aspetta: il pagamento non si deve perdere.
  await d.scriviNota(id, chi, 'Cadetti')
  await incasso
  const riga = () => m.archivio.dati.gareAtleti.find((a) => a.garaId === id && a.personaId === chi)
  ok('pagato, con la nota scritta intanto', [riga()?.pagamento?.importo, riga()?.nota], [2000, 'Cadetti'])
  ok('il metodo senza spazi', riga()?.pagamento?.metodo, 'Contanti')
  ok('chi ha pagato non si toglie, e lo dice', parla(await rifiuto(() => d.togli(id, chi)), 'pagato'), true)
  ok('e resta nella gara', !!riga(), true)
  ok('una gara con un pagamento non si cancella, si annulla', parla(await rifiuto(() => d.elimina(id)), 'annulla'), true)
  const ann = await d.salva({ nome: 'Annullata', dal: '2026-12-19', annullata: true, voci: quota, accompagnatori: [] })
  await d.aggiungi(ann, [chi])
  ok('una gara annullata non si incassa', parla(await rifiuto(() => d.incassa(ann, chi, 'Contanti', OGGI)), 'annullata'), true)
  ok('l\'id di una gara nuova è un uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(ann), true)
}

// ---------------------------------------------------------------------------
console.log('\n12 · L’INDIRIZZO: i suggerimenti di Google Places, solo con la chiave')
{
  const chiamate = []
  const finta = (risposta, va = true) => async (url, o) => {
    chiamate.push({ url, o })
    return { ok: va, json: async () => risposta }
  }
  const risposta = { suggestions: [{ placePrediction: { text: { text: 'Via Roma 1, Torino, TO, Italia' } } }, { queryPrediction: { text: { text: 'via roma' } } }, { placePrediction: { text: { text: 'Via Roma 1, Asti, AT, Italia' } } }] }
  ok('senza chiave niente suggerimenti, e nessuna richiesta', [await m.indirizziGoogle('Via Roma 1', '', finta(risposta)), chiamate.length], [[], 0])
  ok('con meno di tre lettere non si chiede', [await m.indirizziGoogle('Vi', 'k', finta(risposta)), chiamate.length], [[], 0])
  ok('con la chiave: gli indirizzi dei luoghi, non le ricerche', await m.indirizziGoogle('Via Roma 1', 'k', finta(risposta)), ['Via Roma 1, Torino, TO, Italia', 'Via Roma 1, Asti, AT, Italia'])
  const c = chiamate[0]
  ok('la richiesta va a Places (New), con la chiave nell’intestazione e non nell’indirizzo', [c.url, c.o.method, c.o.headers['X-Goog-Api-Key']], ['https://places.googleapis.com/v1/places:autocomplete', 'POST', 'k'])
  ok('in italiano, in Italia', (({ input, languageCode, includedRegionCodes }) => ({ input, languageCode, includedRegionCodes }))(JSON.parse(c.o.body)), { input: 'Via Roma 1', languageCode: 'it', includedRegionCodes: ['it'] })
  ok('una risposta rifiutata (chiave sbagliata, quota finita): il campo resta libero', await m.indirizziGoogle('Via Roma 1', 'k', finta({ error: {} }, false)), [])
  ok('senza rete: il campo resta libero', await m.indirizziGoogle('Via Roma 1', 'k', async () => { throw new TypeError('Failed to fetch') }), [])
  ok('una risposta senza suggerimenti', await m.indirizziGoogle('Via Roma 1', 'k', finta({})), [])
}

console.log('\n18 · I PAGAMENTI DEGLI ATLETI: la segreteria e l\'atleta sì, l\'istruttore no (come gare_pagamenti())')
{
  const pag = { importo: 3000, voci: [{ voce: 'Iscrizione', importo: 3000 }], metodo: 'Contanti', data: '2026-10-20' }
  const g1 = gara('g1', 'Trofeo', '2026-11-14', { accompagnatori: ['maura'] })
  const g2 = gara('g2', 'Torino', '2026-12-05')
  const atleti = [atleta('g1', 'luca', { pagamento: pag, nota: 'Cadetti' }), atleta('g1', 'sara'), atleta('g2', 'marco', { pagamento: pag })]
  const vede = (ruolo, personaId, viste) => m.atletiVisibili({ ruolo, personaId, corsiInsegnati: [] }, viste, atleti, [])
  ok('la segreteria vede gli atleti delle gare, pagamento compreso', vede('staff', 'anna', [g1, g2]), atleti)
  ok('l\'istruttore vede gli atleti delle sue gare, con la nota', vede('istruttore', 'maura', [g1]).map((x) => [x.personaId, x.nota]), [['luca', 'Cadetti'], ['sara', undefined]])
  ok('ma non quanto hanno pagato', vede('istruttore', 'maura', [g1]).some((x) => 'pagamento' in x), false)
  ok('l\'iscritto vede solo la sua riga, col suo pagamento', vede('iscritto', 'luca', [g1]), [atleti[0]])
  ok('niente atleti delle gare che non vede', vede('staff', 'anna', [g2]).map((x) => x.personaId), ['marco'])
}

console.log('\n19 · LE MIE GARE: prima le prossime, poi le passate e le annullate')
{
  const mia = (id, dal, extra = {}) => ({ gara: gara(id, id, dal, extra), personaId: 'luca', voci: [], totale: 0, pagata: false, daPagare: 0 })
  const mie = [mia('dicembre', '2026-12-05'), mia('settembre', '2026-09-12'), mia('novembre', '2026-11-14'), mia('annullata', '2026-11-20', { annullata: true }), mia('ieri-oggi', '2026-10-24', { al: '2026-10-25' }), mia('agosto', '2026-08-01')]
  const d = m.dividiMieGare(mie, OGGI)
  ok('le prossime dalla più vicina, quella in corso compresa', d.prossime.map((x) => x.gara.id), ['ieri-oggi', 'novembre', 'dicembre'])
  ok('le passate e le annullate dalla più recente: una gara futura annullata non è fra le prossime', d.passate.map((x) => x.gara.id), ['annullata', 'settembre', 'agosto'])
}

console.log('\n18 · LE GARE DI I MIEI: le prossime, senza le annullate')
{
  const gare = [gara('dic', 'Dicembre', '2026-12-05'), gara('ann', 'Annullata', '2026-11-20', { annullata: true }), gara('set', 'Settembre', '2026-09-12'), gara('nov', 'Novembre', '2026-11-14')]
  ok('dalla più vicina, senza le passate né le annullate', m.gareDaAccompagnare(gare, OGGI).map((g) => g.id), ['nov', 'dic'])
}

console.log('\n18 · I CORSI DELL\'ISTRUTTORE: quelli in cui insegna')
{
  const corsi = [{ id: 'judo', istruttori: [{ id: 'maura' }, { id: 'piero' }] }, { id: 'pesi', istruttori: [{ id: 'piero' }] }, { id: 'yoga', istruttori: [] }]
  ok('Maura insegna Judo', m.corsiInsegnati(corsi, 'maura'), ['judo'])
  ok('Piero insegna Judo e Pesi', m.corsiInsegnati(corsi, 'piero'), ['judo', 'pesi'])
  ok('chi non insegna niente', m.corsiInsegnati(corsi, 'zeno'), [])
}

console.log('\n1 e 15 · SALVARE: dalla scheda alla gara')
{
  const bozza = { nome: 'Trofeo', dal: '2026-11-14', al: '2026-11-14', luogo: 'Varese', indirizzo: '', organizzatore: '', note: '', accompagnatori: ['gianni'], voci: [{ voce: 'Iscrizione', importo: '30' }, { voce: 'Hotel', importo: '45,50' }, { voce: '', importo: '' }] }
  const r = m.garaDaBozza(bozza, { id: 'g1', annullata: false })
  ok('le voci in centesimi, le righe vuote tolte', r.gara?.voci, [{ voce: 'Iscrizione', importo: 3000 }, { voce: 'Hotel', importo: 4550 }])
  ok('un giorno solo: AL uguale a DAL non si salva', r.gara?.al, undefined)
  ok('l\'id e l\'annullata passano', [r.gara?.id, r.gara?.annullata, r.gara?.accompagnatori], ['g1', false, ['gianni']])
  ok('due giorni: AL resta', m.garaDaBozza({ ...bozza, al: '2026-11-15' }, { annullata: false }).gara?.al, '2026-11-15')
  ok('un importo scritto male dice quale voce', parla(m.garaDaBozza({ ...bozza, voci: [{ voce: 'Hotel', importo: 'tanti' }] }, { annullata: false }).errore, 'Hotel'), true)
  ok('una voce senza importo non passa (la ferma cosaNonVaGara)', typeof m.garaDaBozza({ ...bozza, voci: [{ voce: 'Hotel', importo: '' }] }, { annullata: false }).errore, 'string')
  ok('senza nome dice di scriverlo', parla(m.garaDaBozza({ ...bozza, nome: ' ' }, { annullata: false }).errore, 'nome'), true)
}

// ---------------------------------------------------------------------------
console.log('\n10 · DUE SCHEDE UNITE: una riga per gara, quella pagata (come i trigger *_unione)')
{
  const pag = { importo: 3000, voci: [{ voce: 'Iscrizione', importo: 3000 }], metodo: 'contanti', data: '2026-11-01' }
  const atleti = [
    { garaId: 'g1', personaId: 'via', pagamento: pag },
    { garaId: 'g1', personaId: 'resta', nota: 'cinture gialle' },
    { garaId: 'g2', personaId: 'via', nota: 'kumite' },
    { garaId: 'g2', personaId: 'altro' },
  ]
  const gare = [
    { id: 'g1', accompagnatori: ['via', 'resta'] },
    { id: 'g2', accompagnatori: ['via'] },
  ]
  const u = m.unisciGare({ gare, atleti }, 'via', 'resta')
  const g1 = u.atleti.filter((a) => a.garaId === 'g1')
  ok('nella gara di tutti e due resta una riga', g1.length, 1)
  ok('ed è di chi resta', g1[0]?.personaId, 'resta')
  ok('il pagamento di chi va via passa', g1[0]?.pagamento?.importo, 3000)
  ok('la nota di chi resta resta', g1[0]?.nota, 'cinture gialle')
  ok('la gara solo sua passa a chi resta, con la nota', u.atleti.find((a) => a.garaId === 'g2' && a.personaId === 'resta')?.nota, 'kumite')
  ok('gli altri non cambiano', u.atleti.some((a) => a.personaId === 'altro'), true)
  ok('chi va via non c\'è più', u.atleti.some((a) => a.personaId === 'via'), false)
  ok('accompagnatore due volte: uno solo', u.gare[0].accompagnatori, ['resta'])
  ok('accompagnatore solo lui: passa', u.gare[1].accompagnatori, ['resta'])
}

// ---------------------------------------------------------------------------
console.log('\n11 · I MESSAGGI DEL DATABASE')
{
  const { outputFiles: f } = await build({
    stdin: { contents: "export { guaio, MANCA_GARE } from './src/lib/gareDati'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'error',
    define: { 'import.meta.env': '{}' },
  })
  const d = await import('data:text/javascript;base64,' + Buffer.from(f[0].text).toString('base64'))
  // Un errore che non si sa dire finisce nella console: qui è atteso, non si stampa.
  const dice = (e) => {
    const vera = console.error
    console.error = () => {}
    try {
      return d.guaio(e).message
    } finally {
      console.error = vera
    }
  }
  ok('senza il file 114 la tabella manca: «non ancora disponibili»', dice({ code: 'PGRST205', message: "Could not find the table 'public.gare'" }), d.MANCA_GARE)
  ok('e così se manca la funzione', dice({ code: 'PGRST202', message: 'Could not find the function public.incassa_gara' }), d.MANCA_GARE)
  ok('una tabella che manca e non è delle gare non lo dice', dice({ code: 'PGRST205', message: "Could not find the table 'public.ordini'" }) === d.MANCA_GARE, false)
  ok('il testo italiano di una regola passa così com’è', dice({ code: 'P0001', message: 'La quota di questa gara è già pagata' }), 'La quota di questa gara è già pagata')
  ok('senza permesso: chi scrive le gare', dice({ code: '42501', message: 'permission denied for table gare' }), 'Non hai il permesso: le gare le scrive la segreteria')
  ok('mai il testo grezzo dell’API', dice({ code: 'XX000', message: 'internal error' }), 'Non è andata: riprova fra poco')
}

// ---------------------------------------------------------------------------
console.log('\n12 · L\'ELENCO IN PDF')
{
  const { outputFiles: f } = await build({
    stdin: { contents: "export { elencoGaraPdf } from './src/lib/elencoGaraPdf'; export { PDFDocument } from 'pdf-lib'", resolveDir: '.', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'error',
    define: { 'import.meta.env': '{}' },
  })
  const d = await import('data:text/javascript;base64,' + Buffer.from(f[0].text).toString('base64'))
  const tanti = Array.from({ length: 60 }, (_, i) => persona(`p${i}`, `Nome${i}`, `Cognome${i}`))
  const righe = (n) => m.righeGara(trofeo, tanti.slice(0, n).map((p) => atleta('g1', p.id, { nota: 'Kumite -60 kg' })), tanti).map((r) => ({ ...r, corso: 'Karate ragazzi' }))
  const pagine = async (b) => (await d.PDFDocument.load(b)).getPageCount()
  ok('un elenco corto sta in una pagina', await pagine(await d.elencoGaraPdf(trofeo, righe(5))), 1)
  ok('sessanta atleti vanno alla pagina dopo', (await pagine(await d.elencoGaraPdf(trofeo, righe(60)))) > 1, true)
  ok('senza atleti il foglio c\'è lo stesso', await pagine(await d.elencoGaraPdf(trofeo, [])), 1)
  const strano = [{ ...righe(1)[0], cognome: 'Đoković-Šantić con un cognome lunghissimo che non sta nella colonna', nota: 'Kata 🥋 finale' }]
  ok('nomi con lettere fuori dal font e note lunghe non lo rompono', await pagine(await d.elencoGaraPdf(trofeo, strano)), 1)
}

console.log(guai ? `\n${guai} ${guai === 1 ? 'cosa non torna' : 'cose non tornano'}` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
