// ---------------------------------------------------------------------------
// Gli avvisi alla segreteria: l'email che parte quando arriva una richiesta di
// iscrizione, un pagamento Satispay, uno scarico Satispay in CONTABILITÀ o un
// certificato medico mandato dall'area iscritti (139). In più il sollecito del
// certificato alla famiglia (143): oggetto e testo li scrive la segreteria in
// IMPOSTAZIONI, qui si mettono i nomi, la data e i link. Cosa avvisare e quando lo decide il
// database (`84-avvisi-segreteria.sql`, `avvisi_da_mandare`); qui il testo
// della mail e gli indirizzi, così che si provino senza posta né database.
//
// Questo file ha una copia identica in supabase/functions/avvisi-segreteria/
// mail.ts: la funzione gira su Deno, che src/lib non lo legge. Per questo qui
// si importa solo la cornice (cornicaMail.ts, con la sua copia accanto);
// `npm run prova:avvisi-segreteria` controlla che le copie siano uguali. Si
// cambia qui e si ricopia là.
//
// Nella mail mai note, codice fiscale, data di nascita, documenti o file:
// l'avviso porta solo nomi, corsi e importi, e il resto si guarda nell'app.
// ---------------------------------------------------------------------------

import { incorniciaMail, tastoMail } from './cornicaMail.ts'

export const MITTENTE = 'ODS Corsi <info@officinedellosport.it>'

export type Pagamento = { come: 'satispay'; importo: number; pagatoIl: string } | { come: 'bonifico'; ricevuta: boolean } | { come: 'palestra' }

export interface PersonaAvviso {
  richiestaId: string
  nome: string
  cognome: string
  corsi: string[]
  /** I corsi per cui ha l'età sbagliata: la segreteria richiama. */
  fuoriEta: string[]
}

/** La forma di `avviso` in `avvisi_da_mandare()`. Importi in centesimi, momenti in ISO. */
export type Avviso =
  | { tipo: 'richiesta'; arrivataIl: string; pagamento: Pagamento; persone: PersonaAvviso[] }
  | { tipo: 'pagamento'; richiestaId: string; nome: string; cognome: string; corso: string; importo: number; pagatoIl: string; arrivataIl: string }
  | { tipo: 'pagamento_senza_richiesta'; nome: string; cognome: string; email: string; corso: string; importo: number; pagatoIl: string }
  /** Uno scarico Satispay non riuscito. Gli avvisi di prima del 132 hanno anche incassi, rimborsi e daDecidere. */
  | { tipo: 'satispay_scarico'; quando: string; incassi: number; rimborsi: number; daDecidere: number; errore: string | null }
  /** Un certificato da guardare: solo chi e quando, il file e la scadenza stanno nella scheda. */
  | { tipo: 'certificato'; personaId: string; nome: string; cognome: string; inviatoIl: string }
  /** Il sollecito alla famiglia: solo i nomi, il termine (`AAAA-MM-GG`) e il link firmato di ciascuno. */
  | { tipo: 'sollecito_certificato'; oggetto: string; testo: string; persone: { nome: string; entro: string; link: string }[] }

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

/** Nome e cognome li scrive chiunque nel modulo pubblico: su una riga, così l'oggetto non prende intestazioni in più. */
const riga = (s: string) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim()

const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const euro = (cent: number) => `${(cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/** Giorno e ora di Roma, a mano dai pezzi di Intl: «oggi» o «il 20 ottobre», e «18.32». */
function quando(iso: string): { giorno: string; ora: string } {
  const pezzi = (d: Date) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    )
  const x = pezzi(new Date(iso))
  const oggi = pezzi(new Date())
  const stesso = x.year === oggi.year && x.month === oggi.month && x.day === oggi.day
  return { giorno: stesso ? 'oggi' : `il ${Number(x.day)} ${MESI[Number(x.month) - 1]}`, ora: `${x.hour}.${x.minute}` }
}

/** «Marco», «Marco e Giulia», «Marco, Giulia e Leo». */
export function nomiInsieme(nomi: string[]): string {
  const n = nomi.map(riga)
  return n.length < 2 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`
}

/** «12 dicembre» da `2026-12-12`: è un giorno, non un istante, e non passa dai fusi. */
const giornoMese = (g: string) => {
  const [, m, d] = g.split('-').map(Number)
  return `${d} ${MESI[m - 1]}`
}

/**
 * Il sollecito: {nome} e {entro} (il termine più vicino) nell'oggetto e nel testo; {link} nel testo è l'indirizzo
 * (una persona) o una riga «Marco: …» per ciascuno, e nell'HTML un tasto per persona. Il testo della segreteria
 * entra nell'HTML convertito: un `<b>` scritto lì resta testo.
 */
function testoSollecito(a: Extract<Avviso, { tipo: 'sollecito_certificato' }>): { oggetto: string; testo: string; html: string } {
  const entro = [...a.persone.map((p) => p.entro)].sort()[0] ?? ''
  const metti = (t: string) => t.replaceAll('{nome}', nomiInsieme(a.persone.map((p) => p.nome))).replaceAll('{entro}', entro ? giornoMese(entro) : '')
  const link = a.persone.length === 1 ? a.persone[0].link : a.persone.map((p) => `${riga(p.nome)}: ${p.link}`).join('\n')
  const pezzi = metti(a.testo).split('{link}')
  const tasti = a.persone.map((p) => tastoMail(`Carica il certificato di ${riga(p.nome)}`, p.link)).join('\n')
  const paragrafo = (t: string) => (t.trim() ? `<p style="margin:0 0 10px">${html(t.trim()).replace(/\r?\n/g, '<br>')}</p>` : '')
  const corpo = pezzi.map(paragrafo).join(`\n${tasti}\n`)
  return {
    oggetto: riga(metti(a.oggetto)),
    testo: pezzi.join(link),
    html: incorniciaMail(corpo, { testata: 'OFFICINE DELLO SPORT · CERTIFICATO MEDICO', piede: 'Mail automatica: per qualsiasi domanda rispondi a questa mail.' }),
  }
}

const chi = (x: { nome: string; cognome: string }) => `${riga(x.nome)} ${riga(x.cognome)}`

function rigaPagamento(p: Pagamento): string {
  if (p.come === 'satispay') return `Satispay, pagata ${euro(p.importo)} alle ${quando(p.pagatoIl).ora}`
  if (p.come === 'bonifico') return p.ricevuta ? 'bonifico, ricevuta caricata' : 'bonifico, nessuna ricevuta'
  return 'in palestra'
}

/** Oggetto, testo e HTML della mail; `app` è l'indirizzo della segreteria, con la barra in fondo. */
export function testoAvviso(a: Avviso, app: string): { oggetto: string; testo: string; html: string } {
  if (a.tipo === 'sollecito_certificato') return testoSollecito(a)
  let oggetto: string
  let frasi: string[]
  let link: string
  let tasto: string
  if (a.tipo === 'richiesta') {
    const { giorno, ora } = quando(a.arrivataIl)
    const pagata = a.pagamento.come === 'satispay' ? 'pagata' : 'da pagare'
    const corsi = (p: PersonaAvviso) => p.corsi.map(riga).join(', ')
    const fuori = (p: PersonaAvviso) => (p.fuoriEta.length ? ' · fuori età, da richiamare' : '')
    if (a.persone.length === 1) {
      const p = a.persone[0]
      oggetto = `Richiesta di iscrizione · ${chi(p)} · ${corsi(p)} · ${pagata}`
      frasi = [`È arrivata la richiesta di ${chi(p)} per ${corsi(p)}, ${giorno} alle ${ora}.${p.fuoriEta.length ? ' Fuori età, da richiamare.' : ''}`]
      link = `${app}#richieste/${encodeURIComponent(p.richiestaId)}`
      tasto = 'Apri la richiesta'
    } else {
      oggetto = `Richiesta di iscrizione · famiglia ${riga(a.persone[0].cognome)} (${a.persone.length}) · ${pagata}`
      frasi = [`Sono arrivate ${a.persone.length} richieste insieme, ${giorno} alle ${ora}:`, ...a.persone.map((p) => `· ${chi(p)}, ${corsi(p)}${fuori(p)}`)]
      link = `${app}#richieste`
      tasto = 'Apri le richieste'
    }
    frasi.push(`Pagamento: ${rigaPagamento(a.pagamento)}.`)
  } else if (a.tipo === 'pagamento') {
    const pagato = quando(a.pagatoIl)
    oggetto = `Pagamento Satispay · ${euro(a.importo)} · ${chi(a)} · ${riga(a.corso)}`
    const arrivata = quando(a.arrivataIl)
    frasi = [`${chi(a)} ha pagato ${euro(a.importo)} con Satispay ${pagato.giorno} alle ${pagato.ora} per la richiesta di ${riga(a.corso)} arrivata ${arrivata.giorno === 'oggi' ? '' : `${arrivata.giorno} `}alle ${arrivata.ora}.`]
    link = `${app}#richieste/${encodeURIComponent(a.richiestaId)}`
    tasto = 'Apri la richiesta'
  } else if (a.tipo === 'satispay_scarico') {
    // Dal 132 lo scarico non scrive niente e l'avviso parte solo se non è riuscito; uno di prima ancora in coda dice dove guardare.
    const q = quando(a.quando)
    oggetto = a.errore ? 'Scarico Satispay non riuscito' : 'Scarico Satispay'
    frasi = a.errore
      ? [`Lo scarico di ${q.giorno} alle ${q.ora} si è fermato.`, riga(a.errore)]
      : [`Lo scarico di ${q.giorno} alle ${q.ora} è fatto: chi ha pagato lo trovi in IMPORTAZIONI.`]
    link = `${app}#importazioni`
    tasto = 'Apri IMPORTAZIONI'
  } else if (a.tipo === 'certificato') {
    const q = quando(a.inviatoIl)
    oggetto = `Certificato medico · ${chi(a)}`
    frasi = [`${chi(a)} ha mandato il certificato medico dall’area iscritti ${q.giorno} alle ${q.ora}: è da guardare e confermare.`]
    link = `${app}#iscritti/${encodeURIComponent(a.personaId)}`
    tasto = 'Apri la scheda'
  } else {
    const pagato = quando(a.pagatoIl)
    oggetto = `Pagamento Satispay senza richiesta · ${euro(a.importo)} · ${chi(a)}`
    frasi = [
      `${chi(a)} ha pagato ${euro(a.importo)} con Satispay ${pagato.giorno} alle ${pagato.ora} per ${riga(a.corso)}, ma dopo un’ora la richiesta non è ancora arrivata.`,
      `Email lasciata: ${riga(a.email)}`,
      'Da chiamare: forse si è fermata a metà del modulo, o i soldi vanno restituiti.',
    ]
    link = `${app}#contabilita`
    tasto = 'Apri CONTABILITÀ'
  }
  return {
    oggetto,
    testo: [...frasi, '', `${tasto}: ${link}`].join('\n'),
    html: cornice(frasi, tasto, link),
  }
}

/** L'HTML con la cornice: il corpo lo converte `html`, la cornice no. */
function cornice(frasi: string[], tasto: string, link: string): string {
  const corpo = frasi.map((f) => `<p style="margin:0 0 10px">${html(f)}</p>`).join('\n') + tastoMail(tasto, link)
  return incorniciaMail(corpo, { testata: 'ODS CORSI · AVVISO', piede: 'Avviso automatico dell’app ODS Corsi.' })
}

/** Cosa non va in un indirizzo email, detto per chi lo scrive; `null` se va. */
export function indirizzoValido(s: string): string | null {
  const x = s.trim()
  if (/\s/.test(x)) return 'Un indirizzo email non ha spazi: controlla l’indirizzo.'
  const pezzi = x.split('@')
  if (pezzi.length < 2) return 'Manca la chiocciola: controlla l’indirizzo.'
  if (pezzi.length > 2) return 'C’è più di una chiocciola: controlla l’indirizzo.'
  if (!pezzi[0]) return 'Manca qualcosa prima della chiocciola: controlla l’indirizzo.'
  if (!/^[^.]+(\.[^.]+)+$/.test(pezzi[1])) return 'Manca qualcosa dopo la chiocciola: controlla l’indirizzo.'
  return null
}

/** Gli indirizzi come si salvano: vuoto è null (nessun avviso, nessuna copia), uno sbagliato non passa. */
export function indirizziDaSalvare(x: { a: string; cc: string }): { a: string | null; cc: string | null } {
  const a = x.a.trim() || null
  const cc = x.cc.trim() || null
  for (const v of [a, cc]) {
    const guaio = v && indirizzoValido(v)
    if (guaio) throw new Error(guaio)
  }
  return { a, cc }
}
