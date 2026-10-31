import { chiaveGiorno, dataLunga, oraDi } from './sala'
import { anni, telefonoGiusto } from './richieste'
import { cifreTelefono } from './vestiario'
import { euro, euroBreve } from './ricevute'
import type { StatoCorso } from './corsiDaPagare'
import { titolareSenzaCorsi } from './filtriIscritti'
import type { PagatoNelVecchio } from './pagatoPrima'
import { dalCertificato, pagamentoDi, statoCertificato, type Anagrafica, type PersonaSeg, type UltimoSollecito } from './segreteria'

/**
 * Il sollecito su WhatsApp della scheda di una persona: cosa manca (quota,
 * corsi, certificato), il messaggio già scritto e il link `wa.me` che apre WhatsApp
 * col testo pronto. L'app non manda niente: l'invio lo preme la segreteria.
 * Gli stati sono quelli dei timbri (`pagamentoDi`, `statoCertificato`).
 */

export interface Motivo {
  testo: string
  tono: 'rosso' | 'giallo'
}

export interface Sollecito {
  /** Quel che manca, per il riquadro: prima la quota, poi i corsi, poi il certificato. */
  motivi: Motivo[]
  /** Il messaggio: solo nome, motivo, data e importo. Mai codice fiscale, ricevute o note. */
  testo: string
  /** Le cifre per `wa.me`, col prefisso; null senza un telefono giusto. */
  numero: string | null
  link: string | null
  /** A chi va: «Rossi Laura (genitore)», «un genitore di Marco» o «Bianchi Paolo». */
  a: string
  /** Sembra un fisso italiano: su WhatsApp di solito non c'è. */
  fisso: boolean
  /** Il telefono della scheda: vuoto e scritto male si dicono in modo diverso. */
  telefono: 'ok' | 'manca' | 'sbagliato'
}

/**
 * Le cifre per `wa.me`. Col + o lo 00 il prefisso è quello scritto; senza, si
 * mette il 39 davanti alle cifre di `cifreTelefono` (che toglie un 39 già
 * scritto, ma non quello di un cellulare che comincia per 39).
 */
export function numeroWhatsApp(telefono?: string): string | null {
  const t = (telefono ?? '').trim()
  if (!telefonoGiusto(t)) return null
  const cifre = t.replace(/\D/g, '')
  if (t.startsWith('+')) return cifre
  if (cifre.startsWith('00')) return cifre.slice(2)
  return '39' + cifreTelefono(t)
}

// In Italia i fissi cominciano per 0, i cellulari per 3.
const sembraFisso = (numero: string) => numero.startsWith('390')

const SALUTO = 'ti scriviamo dalla segreteria del Centro Judo'
const CHIUSA = 'Puoi passare in segreteria o rispondere qui. Grazie!'

const fra = (giorno: string, oggi: string) => {
  const n = Math.round((Date.parse(giorno) - Date.parse(oggi)) / 86_400_000)
  return n === 0 ? 'oggi' : n === 1 ? 'domani' : `fra ${n} giorni`
}

export interface OpzioniSollecito {
  /** Ha un incasso di quota nel vecchio programma: la quota non si sollecita finché non è segnata (`pagatoPrima.ts`). */
  quotaNelVecchio?: boolean
  /** Ha la tessera da sistemare: il sollecito non ne parla, ma l'elenco lo dice. */
  tesseraDaSistemare?: boolean
  /** I corsi della persona (`statoCorsi`): quelli non coperti si sollecitano dopo la quota. */
  corsi?: StatoCorso[]
  /** I titolari dei nuclei (`titolariDi`): al titolare senza corsi la quota non si chiede, come nei conti. */
  titolari?: ReadonlySet<string>
}

/** Il motivo di un corso non coperto; null per quelli pagati e per «da controllare», che la segreteria guarda prima. */
function motivoCorso(s: StatoCorso): (Motivo & { frase: string }) | null {
  const al = s.al ? dataLunga(s.al) : ''
  const formula = s.formula ?? 'corso'
  if (s.come === 'scaduto') return { testo: `${s.corso}: ${formula} scaduto il ${al}`, tono: 'rosso', frase: `${formula === 'annuale' ? 'l’' : 'il '}${formula} di ${s.corso} è scaduto il ${al}` }
  if (s.come === 'fuori_scaduto') return { testo: `${s.corso}: pagato fino al ${al}, ora da pagare`, tono: 'rosso', frase: `il corso di ${s.corso} era pagato fino al ${al}` }
  if (s.come === 'da_pagare') return { testo: `${s.corso}: corso da pagare`, tono: 'rosso', frase: `il corso di ${s.corso} è da pagare` }
  if (s.come === 'in_parte') {
    const mancano = euroBreve(s.mancano ?? 0)
    return { testo: `${s.corso}: pagato in parte, mancano ${mancano}`, tono: 'giallo', frase: `del corso di ${s.corso} mancano ${mancano}` }
  }
  return null
}

/** I motivi con la loro frase per il messaggio, nell'ordine in cui si dicono. */
function cosaManca(p: PersonaSeg, quota: number, oggi: string, opz: OpzioniSollecito): Array<Motivo & { frase: string }> {
  const fuori: Array<Motivo & { frase: string }> = []
  const paga = opz.quotaNelVecchio || titolareSenzaCorsi(p, opz.titolari, oggi) ? { come: 'pagato' as const } : pagamentoDi(p, oggi)
  const prezzo = `${euro(quota)} €`
  if (paga.come === 'da_pagare') fuori.push({ testo: `Quota associativa da pagare: ${prezzo}`, tono: 'rosso', frase: `la quota associativa è da pagare (${prezzo})` })
  if (paga.come === 'scaduto' && paga.fino)
    fuori.push({ testo: `Quota associativa scaduta il ${dataLunga(paga.fino)}: ${prezzo}`, tono: 'rosso', frase: `la quota associativa è scaduta il ${dataLunga(paga.fino)} (${prezzo})` })
  if (paga.come === 'in_parte')
    fuori.push(
      paga.mancano
        ? { testo: `Quota associativa pagata in parte: mancano ${euro(paga.mancano)} €`, tono: 'giallo', frase: `della quota associativa mancano ${euro(paga.mancano)} €` }
        : { testo: 'Quota associativa pagata in parte', tono: 'giallo', frase: 'la quota associativa è pagata solo in parte' },
    )
  for (const c of opz.corsi ?? []) {
    const m = motivoCorso(c)
    if (m) fuori.push(m)
  }

  const scade = p.certificato.scade
  const cert = statoCertificato(p, oggi)
  if (cert === 'manca') fuori.push({ testo: 'Certificato medico mancante', tono: 'rosso', frase: 'manca il certificato medico' })
  if (cert === 'scaduto' && scade)
    fuori.push({ testo: `Certificato medico scaduto il ${dataLunga(scade)}`, tono: 'rosso', frase: `il certificato medico è scaduto il ${dataLunga(scade)}` })
  if (cert === 'in_scadenza' && scade)
    fuori.push({ testo: `Certificato medico in scadenza il ${dataLunga(scade)}, ${fra(scade, oggi)}`, tono: 'giallo', frase: `il certificato medico scade il ${dataLunga(scade)}` })
  if (cert === 'in_arrivo' && p.natoIl) {
    const dal = dataLunga(dalCertificato(p.natoIl))
    fuori.push({ testo: `Compie 6 anni il ${dal}: da allora serve il certificato medico`, tono: 'giallo', frase: `dal ${dal}, quando compie 6 anni, per allenarsi serve il certificato medico` })
  }
  return fuori
}

/**
 * Il sollecito di una persona attiva che ha qualcosa da sistemare, o null.
 * `quota` sono i centesimi della quota del listino. A un minorenne col
 * genitore nell'anagrafica si scrive al genitore.
 */
export function sollecitoDi(p: PersonaSeg, anagrafica: Anagrafica | undefined, quota: number, oggi: string, opz: OpzioniSollecito = {}): Sollecito | null {
  // Il genitore non iscritto c'è per i figli: non ha quota né certificato da portare.
  if (!p.attiva || p.genitoreNonIscritto) return null
  const manca = cosaManca(p, quota, oggi, opz)
  if (!manca.length) return null

  const minore = !!p.natoIl && anni(p.natoIl, new Date(`${oggi}T12:00`)) < 18
  const genitore = minore && anagrafica?.genitoreNome ? anagrafica : undefined
  // Un minorenne senza genitore in scheda: il telefono è forse di un genitore, e a un bambino non si scrive «ti».
  const saluto = genitore ? `Ciao ${genitore.genitoreNome}, ${SALUTO} per ${p.nome}` : minore ? `Ciao, ${SALUTO} per ${p.nome}` : `Ciao ${p.nome}, ${SALUTO}`
  const testo = `${saluto}: ${manca.map((x) => x.frase).join(' e ')}. ${CHIUSA}`
  const numero = numeroWhatsApp(p.telefono)
  return {
    motivi: manca.map(({ testo, tono }) => ({ testo, tono })),
    testo,
    numero,
    link: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(testo)}` : null,
    a: genitore ? `${[genitore.genitoreCognome, genitore.genitoreNome].filter(Boolean).join(' ')} (genitore)` : minore ? `un genitore di ${p.nome}` : `${p.cognome} ${p.nome}`,
    fisso: !!numero && sembraFisso(numero),
    telefono: numero ? 'ok' : p.telefono?.trim() ? 'sbagliato' : 'manca',
  }
}

/** La riga sotto il tasto: quando e, se si sa, chi. */
export const fraseSollecitato = (u: UltimoSollecito) =>
  `Sollecitato l’ultima volta il ${dataLunga(chiaveGiorno(new Date(u.quando)))} alle ${oraDi(u.quando)}${u.da ? ` da ${u.da}` : ''}`

export type StatoCella = 'tasto' | 'fisso' | 'manca' | 'sbagliato' | 'tessera' | 'vecchio'

/**
 * La cella WHATSAPP dell'elenco ISCRITTI filtrato: il tasto (o il fisso), o
 * perché non c'è (telefono, solo la tessera, quota pagata nel vecchio
 * programma). null: niente da dire, la cella resta vuota.
 */
export function cellaSollecito(p: PersonaSeg, anagrafica: Anagrafica | undefined, quota: number, oggi: string, opz: OpzioniSollecito = {}): { stato: StatoCella; sollecito: Sollecito | null } | null {
  if (!p.attiva) return null
  const s = sollecitoDi(p, anagrafica, quota, oggi, opz)
  if (s) return { stato: s.telefono === 'ok' ? (s.fisso ? 'fisso' : 'tasto') : s.telefono, sollecito: s }
  if (opz.quotaNelVecchio && sollecitoDi(p, anagrafica, quota, oggi)) return { stato: 'vecchio', sollecito: null }
  return opz.tesseraDaSistemare ? { stato: 'tessera', sollecito: null } : null
}

/** La riga corta sotto il tasto dell'elenco: «Sollecitato il 14/10 da …», o «oggi alle 09:30». */
export function fraseCorta(u: UltimoSollecito): string {
  const d = new Date(u.quando)
  const giorno = chiaveGiorno(d)
  const quando = giorno === chiaveGiorno(new Date()) ? `oggi alle ${oraDi(u.quando)}` : `il ${giorno.slice(8)}/${giorno.slice(5, 7)}`
  return `Sollecitato ${quando}${u.da ? ` da ${u.da}` : ''}`
}

/** Una riga col genitore: da una richiesta accolta o dai dati della segreteria, con quando. */
export interface RigaGenitore {
  personaId: string
  genitoreNome?: string
  genitoreCognome?: string
  genitoreCodiceFiscale?: string
  codiceFiscale?: string
  quando: string
  /** Una riga della segreteria senza nessun dato: non conta, come in `anagraficaDi`. */
  vuota?: boolean
}

/**
 * Il genitore di ognuno, in un colpo, con la regola di `anagraficaDi`: vince
 * la più recente fra l'ultima richiesta accolta e i dati della segreteria (a
 * pari data la segreteria), anche se lì il genitore non c'è.
 */
export function genitoriDa(richieste: RigaGenitore[], segreteria: RigaGenitore[]): Map<string, Pick<Anagrafica, 'genitoreNome' | 'genitoreCognome' | 'genitoreCodiceFiscale' | 'codiceFiscale'>> {
  const vince = new Map<string, RigaGenitore>()
  for (const r of richieste) {
    const c = vince.get(r.personaId)
    if (!c || r.quando > c.quando) vince.set(r.personaId, r)
  }
  for (const r of segreteria) {
    const c = vince.get(r.personaId)
    if (!r.vuota && (!c || r.quando >= c.quando)) vince.set(r.personaId, r)
  }
  return new Map(
    [...vince].map(([id, r]) => [id, Object.fromEntries(Object.entries({ genitoreNome: r.genitoreNome, genitoreCognome: r.genitoreCognome, genitoreCodiceFiscale: r.genitoreCodiceFiscale, codiceFiscale: r.codiceFiscale }).filter(([, v]) => v))]),
  )
}

/** Chi ha la quota pagata nel vecchio programma (da segnare): solo corsi o quota sotto i 50 € li decide la segreteria, e si sollecitano. */
export const quotaNelVecchioDi = (g: PagatoNelVecchio | null): Set<string> => new Set(g ? g.quota.map((r) => r.personaId) : [])
