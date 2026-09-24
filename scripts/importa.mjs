// ---------------------------------------------------------------------------
// Da due fogli al database della sala corsi.
//
//   node scripts/importa.mjs corsi.csv iscritti.csv > semina.sql
//
// Non parla con Supabase: scrive SQL. È una scelta — l'SQL si legge prima di
// lanciarlo, si tiene in un file, si rilancia uguale, e non chiede di avere una
// chiave di servizio in giro per la macchina di chi fa l'import.
//
// I fogli che escono da Excel in italiano sono separati da punto e virgola e
// cominciano con un BOM. Non è un dettaglio da poco: è la differenza fra
// «funziona» e una mattina persa. Qui sono gestiti tutti e due, e il separatore
// si indovina dalla riga di intestazione.
//
// corsi.csv      nome; sala; istruttore; giorno; ora; durata; capienza; colore
// iscritti.csv   nome; cognome; email; telefono; corso
//
// `giorno` accetta il nome («martedì», «mar») o il numero (0 = domenica).
// `corso` negli iscritti è il nome del corso, come scritto in corsi.csv.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

const GIORNI = {
  domenica: 0, dom: 0, lunedi: 1, lun: 1, martedi: 2, mar: 2, mercoledi: 3, mer: 3,
  giovedi: 4, gio: 4, venerdi: 5, ven: 5, sabato: 6, sab: 6,
}

/** Via accenti e maiuscole: «Martedì», «MARTEDI» e «martedi» sono lo stesso giorno. */
const piatto = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Un lettore di CSV che regge i campi fra virgolette, perché un nome di corso
 * con una virgola dentro non deve spaccare la riga in due.
 */
function leggiCsv(testo) {
  const pulito = testo.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const primaRiga = pulito.slice(0, pulito.indexOf('\n') + 1 || undefined)
  // Il separatore è quello che compare di più nell'intestazione.
  const sep = (primaRiga.match(/;/g) ?? []).length >= (primaRiga.match(/,/g) ?? []).length ? ';' : ','

  const righe = []
  let campo = ''
  let riga = []
  let fraVirgolette = false
  for (let i = 0; i < pulito.length; i++) {
    const c = pulito[i]
    if (fraVirgolette) {
      if (c === '"' && pulito[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') fraVirgolette = false
      else campo += c
    } else if (c === '"') fraVirgolette = true
    else if (c === sep) { riga.push(campo); campo = '' }
    else if (c === '\n') { riga.push(campo); righe.push(riga); riga = []; campo = '' }
    else campo += c
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga) }

  const intestazione = (righe.shift() ?? []).map((h) => piatto(h))
  return righe
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(intestazione.map((h, i) => [h, (r[i] ?? '').trim()])))
}

/** Le virgolette per l'SQL: `'` raddoppiato, e niente al posto del vuoto. */
const q = (v) => (v === undefined || v === null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? 'null' : String(Number(v)))

const [fileCorsi, fileIscritti] = process.argv.slice(2)
if (!fileCorsi) {
  console.error('uso: node scripts/importa.mjs corsi.csv [iscritti.csv] > semina.sql')
  process.exit(1)
}

const corsi = leggiCsv(readFileSync(fileCorsi, 'utf8'))
const iscritti = fileIscritti ? leggiCsv(readFileSync(fileIscritti, 'utf8')) : []

const guai = []
const righe = []
const dire = (s) => righe.push(s)

dire('-- Generato da scripts/importa.mjs. Rilanciabile: niente viene duplicato.')
dire('begin;')
dire('')

// --- sale -------------------------------------------------------------------
const sale = [...new Set(corsi.map((c) => c.sala).filter(Boolean))]
for (const s of sale) dire(`insert into sale (nome) values (${q(s)}) on conflict (nome) do nothing;`)
if (sale.length) dire('')

// --- istruttori -------------------------------------------------------------
// Un istruttore è una persona come le altre, solo con un ruolo diverso: sta
// nella stessa tabella, così un istruttore che frequenta un corso è una riga
// sola e non due anagrafiche che parlano della stessa persona.
const istruttori = [...new Set(corsi.map((c) => c.istruttore).filter(Boolean))]
for (const i of istruttori) {
  const [cognome, ...resto] = i.split(/\s+/).reverse()
  const nome = resto.reverse().join(' ') || cognome
  dire(
    `insert into persone (nome, cognome, ruolo) select ${q(nome)}, ${q(cognome)}, 'istruttore'` +
      ` where not exists (select 1 from persone where nome = ${q(nome)} and cognome = ${q(cognome)});`,
  )
}
if (istruttori.length) dire('')

// --- corsi e ricorrenze -----------------------------------------------------
for (const c of corsi) {
  if (!c.nome) { guai.push(`una riga di ${fileCorsi} non ha il nome del corso`); continue }
  const giorno = /^\d$/.test(c.giorno ?? '') ? Number(c.giorno) : GIORNI[piatto(c.giorno ?? '')]
  if (giorno === undefined) { guai.push(`«${c.nome}»: non capisco il giorno «${c.giorno}»`); continue }
  if (!/^\d{1,2}[:.]\d{2}$/.test(c.ora ?? '')) { guai.push(`«${c.nome}»: non capisco l'ora «${c.ora}»`); continue }
  const ora = c.ora.replace('.', ':')

  const [cog, ...res] = (c.istruttore ?? '').split(/\s+/).reverse()
  const nomeIstr = res.reverse().join(' ') || cog

  dire(`-- ${c.nome}`)
  dire(`insert into corsi (nome, sala_id, istruttore_id, capienza, colore)`)
  dire(`select ${q(c.nome)},`)
  dire(`  (select id from sale where nome = ${q(c.sala)}),`)
  dire(`  (select id from persone where nome = ${q(nomeIstr)} and cognome = ${q(cog)}),`)
  dire(`  ${n(c.capienza)}, ${q(c.colore)}`)
  dire(`where not exists (select 1 from corsi where nome = ${q(c.nome)});`)
  dire(`insert into ricorrenze (corso_id, giorno, ora, durata_min, dal)`)
  dire(`select c.id, ${giorno}, ${q(ora)}, ${n(c.durata || 60)}, current_date from corsi c`)
  dire(`where c.nome = ${q(c.nome)}`)
  dire(`  and not exists (select 1 from ricorrenze r where r.corso_id = c.id and r.giorno = ${giorno} and r.ora = ${q(ora)});`)
  dire('')
}

// --- iscritti ---------------------------------------------------------------
const nomiCorsi = new Set(corsi.map((c) => piatto(c.nome ?? '')))
for (const i of iscritti) {
  if (!i.nome || !i.cognome) { guai.push(`una riga di ${fileIscritti} non ha nome o cognome`); continue }
  if (i.corso && !nomiCorsi.has(piatto(i.corso))) {
    guai.push(`${i.cognome} ${i.nome}: il corso «${i.corso}» non è fra quelli importati`)
    continue
  }
  // L'email, quando c'è, è l'unica cosa che distingue davvero due omonimi.
  const dove = i.email
    ? `email = ${q(i.email)}`
    : `nome = ${q(i.nome)} and cognome = ${q(i.cognome)}`
  dire(
    `insert into persone (nome, cognome, email, telefono) select ${q(i.nome)}, ${q(i.cognome)}, ${q(i.email)}, ${q(i.telefono)}` +
      ` where not exists (select 1 from persone where ${dove});`,
  )
  if (i.corso) {
    dire(
      `insert into iscrizioni (corso_id, persona_id) select c.id, p.id from corsi c, persone p` +
        ` where c.nome = ${q(i.corso)} and p.${i.email ? `email = ${q(i.email)}` : `nome = ${q(i.nome)} and p.cognome = ${q(i.cognome)}`}` +
        ` on conflict (corso_id, persona_id) do nothing;`,
    )
  }
}

dire('')
dire('-- Il calendario dei prossimi due mesi.')
dire("select materializza_sessioni(current_date, current_date + 60);")
dire('commit;')

if (guai.length) {
  console.error(`\n${guai.length} righe saltate:`)
  for (const g of guai) console.error('  · ' + g)
  console.error('')
}
console.log(righe.join('\n'))
console.error(
  `letti ${corsi.length} corsi e ${iscritti.length} iscritti · ${sale.length} sale · ${istruttori.length} istruttori` +
    (guai.length ? ` · ${guai.length} righe saltate` : ''),
)
