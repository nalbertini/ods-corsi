import { dataLunga } from './sala'
import { anni, telefonoGiusto } from './richieste'
import { cifreTelefono } from './vestiario'
import { euro } from './ricevute'
import { dalCertificato, pagamentoDi, statoCertificato, type Anagrafica, type PersonaSeg } from './segreteria'

/**
 * Il sollecito su WhatsApp della scheda di una persona: cosa manca (quota,
 * certificato), il messaggio già scritto e il link `wa.me` che apre WhatsApp
 * col testo pronto. L'app non manda niente: l'invio lo preme la segreteria.
 * Gli stati sono quelli dei timbri (`pagamentoDi`, `statoCertificato`).
 */

export interface Motivo {
  testo: string
  tono: 'rosso' | 'giallo'
}

export interface Sollecito {
  /** Quel che manca, per il riquadro: prima la quota, poi il certificato. */
  motivi: Motivo[]
  /** Il messaggio: solo nome, motivo, data e importo. Mai codice fiscale, ricevute o note. */
  testo: string
  /** Le cifre per `wa.me`, col prefisso; null senza un telefono giusto. */
  numero: string | null
  link: string | null
  /** A chi va: «Rossi Laura (genitore)» o «Bianchi Paolo». */
  a: string
  /** Sembra un fisso italiano: su WhatsApp di solito non c'è. */
  fisso: boolean
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

/** I motivi con la loro frase per il messaggio, nell'ordine in cui si dicono. */
function cosaManca(p: PersonaSeg, quota: number, oggi: string): Array<Motivo & { frase: string }> {
  const fuori: Array<Motivo & { frase: string }> = []
  const paga = pagamentoDi(p, oggi)
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
export function sollecitoDi(p: PersonaSeg, anagrafica: Anagrafica | undefined, quota: number, oggi: string): Sollecito | null {
  if (!p.attiva) return null
  const manca = cosaManca(p, quota, oggi)
  if (!manca.length) return null

  const minore = !!p.natoIl && anni(p.natoIl, new Date(`${oggi}T12:00`)) < 18
  const genitore = minore && anagrafica?.genitoreNome ? anagrafica : undefined
  const saluto = genitore ? `Ciao ${genitore.genitoreNome}, ${SALUTO} per ${p.nome}` : `Ciao ${p.nome}, ${SALUTO}`
  const testo = `${saluto}: ${manca.map((x) => x.frase).join(' e ')}. ${CHIUSA}`
  const numero = numeroWhatsApp(p.telefono)
  return {
    motivi: manca.map(({ testo, tono }) => ({ testo, tono })),
    testo,
    numero,
    link: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(testo)}` : null,
    a: genitore ? `${[genitore.genitoreCognome, genitore.genitoreNome].filter(Boolean).join(' ')} (genitore)` : `${p.cognome} ${p.nome}`,
    fisso: !!numero && sembraFisso(numero),
  }
}
