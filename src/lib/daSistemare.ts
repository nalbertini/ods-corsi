import { type StatoCorso } from './corsiDaPagare'
import { euro } from './ricevute'
import { cfSesso } from './codiceFiscale'
import { dataTimbro, GIORNI_CERTIFICATO, pagamentoDi, spostaGiorno, timbriScheda, type PersonaSeg, type PrezzoQuota, type RigaCheManca } from './segreteria'
import { type timbroTessera } from './tessere'

/** Dove porta il tasto di una voce: la scheda sa a quale sezione o finestra. */
export type AzioneVoce = 'certificato' | 'pagamento' | 'anagrafica' | 'contatti' | 'documento' | 'tessera'

/** Una riga di «Da sistemare»: cosa, perché, la parola dello stato, e l'importo in centesimi quando si sa. */
export interface VoceDaSistemare {
  chiave: string
  cosa: string
  perche?: string
  parola: string
  tono: 'rosso' | 'giallo'
  importo?: number
  azione: AzioneVoce
}

/** «MANCANO 20,00 €» → «Mancano 20,00 €»: le parole dei timbri, scritte come una frase. */
export const comeFrase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const minuscola = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

function vociCorso(s: StatoCorso): VoceDaSistemare[] {
  const base = { chiave: `corso-${s.corsoId}`, cosa: s.corso }
  switch (s.come) {
    case 'pagato':
    case 'fuori_app':
    case 'satispay':
      return []
    case 'in_parte': {
      const mancano = s.mancano ?? 0
      const perche = s.totale ? `Pagati ${euro(s.totale - mancano)} € su ${euro(s.totale)} €` : s.entro ? `Entro il ${dataTimbro(s.entro)}` : undefined
      return [{ ...base, perche, parola: 'Pagato in parte', tono: s.oltre ? 'rosso' : 'giallo', importo: mancano, azione: 'pagamento' }]
    }
    case 'da_pagare':
      return [{ ...base, perche: s.totale ? 'Annuale, nessun pagamento' : 'Nessun pagamento', parola: 'Da pagare', tono: 'rosso', importo: s.totale, azione: 'pagamento' }]
    case 'scaduto':
    case 'fuori_scaduto':
      return [{ ...base, perche: s.al ? `Scaduto il ${dataTimbro(s.al)}` : undefined, parola: 'Da pagare', tono: 'rosso', azione: 'pagamento' }]
    case 'da_controllare':
      return [{ ...base, perche: 'Voce scritta a mano', parola: 'Da controllare', tono: 'giallo', azione: 'pagamento' }]
  }
}

function azioneDi(cosa: string): AzioneVoce {
  if (['Telefono', 'Email', 'Telefono o email'].includes(cosa)) return 'contatti'
  return cosa === 'Documento d’identità' ? 'documento' : 'anagrafica'
}

/**
 * L'elenco «Da sistemare» in cima alla scheda: prende il posto di COSA MANCA
 * e dei timbri. Prima quel che tiene fuori di sala o è da incassare
 * (certificato, quota, corsi, tessera), poi i dati che mancano. Quel che è a
 * posto non c'è. Una scheda disattivata non ha niente da sistemare: resta la
 * sua nota. Il documento arriva dalle righe di `cosaManca`, non dal timbro.
 */
export function daSistemare(
  p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'documento' | 'pagamento' | 'quote' | 'natoIl' | 'satispay' | 'saldo'>,
  oggi: string,
  {
    prezzoQuota,
    corsi,
    tessera,
    manca,
    maggiorenne,
    soloDati = false,
  }: { prezzoQuota?: PrezzoQuota; corsi: ReadonlyArray<StatoCorso>; tessera: ReturnType<typeof timbroTessera>; manca: RigaCheManca[]; maggiorenne?: string; soloDati?: boolean },
): VoceDaSistemare[] {
  if (!p.attiva) return []
  const voci: VoceDaSistemare[] = soloDati ? [] : vociDiSala(p, oggi, prezzoQuota, corsi, tessera)
  for (const r of manca) voci.push({ chiave: r.cosa, cosa: r.cosa, perche: r.perche && maiuscola(r.perche), parola: 'Manca', tono: 'giallo', azione: azioneDi(r.cosa) })
  if (maggiorenne)
    voci.push({ chiave: 'maggiorenne', cosa: `Maggiorenne dal ${maggiorenne}`, perche: 'Chiedi a chi intestare le ricevute nuove', parola: 'Da chiedere', tono: 'giallo', azione: 'anagrafica' })
  return voci
}

/** Certificato, quota, corsi e tessera: chi fa solo da genitore non li ha. */
function vociDiSala(
  p: Pick<PersonaSeg, 'attiva' | 'certificato' | 'documento' | 'pagamento' | 'quote' | 'natoIl' | 'satispay' | 'saldo'>,
  oggi: string,
  prezzoQuota: PrezzoQuota | undefined,
  corsi: ReadonlyArray<StatoCorso>,
  tessera: ReturnType<typeof timbroTessera>,
): VoceDaSistemare[] {
  const t = timbriScheda(p, oggi, prezzoQuota)
  const voci: VoceDaSistemare[] = []

  const c = t.certificato
  if (c.tono === 'rosso' || c.tono === 'giallo') {
    const perche = c.tono === 'rosso' ? 'Senza, non può allenarsi' : c.righe.map((r) => comeFrase(r.testo)).join(' · ') || undefined
    voci.push({ chiave: 'certificato', cosa: 'Certificato medico', perche, parola: comeFrase(c.parola), tono: c.tono, azione: 'certificato' })
  }

  const q = pagamentoDi(p, oggi)
  const quota = { chiave: 'quota', cosa: 'Quota associativa' }
  if (q.come === 'da_pagare') voci.push({ ...quota, perche: 'Nessun pagamento', parola: 'Da pagare', tono: 'rosso', importo: typeof prezzoQuota === 'number' ? prezzoQuota : undefined, azione: 'pagamento' })
  if (q.come === 'in_parte') {
    const perche = q.ricevuta ? `Ricevuta ${q.ricevuta}` : q.fonte === 'fuori_app' ? q.nota || 'Fuori app' : undefined
    voci.push({ ...quota, perche, parola: 'Pagata in parte', tono: 'giallo', importo: q.fonte === 'ricevuta' ? q.mancano : undefined, azione: 'pagamento' })
  }
  if (q.come === 'scaduto') voci.push({ ...quota, perche: q.fino ? `Valeva fino al ${dataTimbro(q.fino)}` : undefined, parola: 'Scaduta', tono: 'rosso', azione: 'pagamento' })

  voci.push(...corsi.flatMap(vociCorso))

  if (tessera && tessera.tono !== 'verde')
    voci.push({ chiave: 'tessera', cosa: 'Tessera', perche: tessera.righe.map((r) => r.testo).join(' · ') || undefined, parola: comeFrase(tessera.parola), tono: tessera.tono, azione: 'tessera' })

  return voci
}

/** Quel che si paga fra le voci, in centesimi; null se non c'è niente da pagare o un importo non si sa. */
export function totaleDaPagare(voci: VoceDaSistemare[]): number | null {
  const soldi = voci.filter((v) => v.azione === 'pagamento')
  if (!soldi.length || soldi.some((v) => v.importo === undefined)) return null
  return soldi.reduce((s, v) => s + (v.importo ?? 0), 0)
}

/** Una cosa a posto, per la riga verde della scheda in regola. */
export interface CosaAPosto {
  chiave: string
  cosa: string
  parola: string
}

/**
 * Con niente da sistemare la scheda dice in una riga quel che è a posto, al
 * posto dei timbri verdi: certificato fino a quando, quota con la ricevuta,
 * i corsi pagati.
 */
export function aPosto(p: Pick<PersonaSeg, 'certificato' | 'documento' | 'pagamento' | 'quote' | 'natoIl' | 'satispay' | 'saldo'>, oggi: string, corsi: ReadonlyArray<StatoCorso>): CosaAPosto[] {
  const t = timbriScheda({ ...p, attiva: true }, oggi)
  const q = pagamentoDi(p, oggi)
  const fino = q.fino ? `, fino al ${dataTimbro(q.fino)}` : ''
  return [
    ...(t.certificato.tono === 'verde' ? [{ chiave: 'certificato', cosa: 'Certificato medico', parola: comeFrase(t.certificato.parola) }] : []),
    ...(q.come === 'pagato' ? [{ chiave: 'quota', cosa: 'Quota associativa', parola: q.fonte === 'fuori_app' ? `Pagata fuori app${fino}` : `Pagata${q.ricevuta ? ` · ricevuta ${q.ricevuta}` : ''}${fino}` }] : []),
    ...corsi.filter((s) => ['pagato', 'fuori_app', 'satispay'].includes(s.come)).map((s) => ({ chiave: `corso-${s.corsoId}`, cosa: s.corso, parola: 'Pagato' })),
  ]
}

/** Un pezzo della frase sotto il nome: col tono è in grassetto e colorato. */
export interface PezzoFrase {
  testo: string
  tono?: 'rosso' | 'giallo' | 'verde'
}

/** «a, b e c» */
const elenco = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/**
 * La frase sotto il nome: prima i soldi e il certificato che tiene fuori di
 * sala, coi numeri; poi, in una riga, il resto da sistemare. Un importo che
 * non si sa (listino non letto, corso scaduto) diventa «dei pagamenti»: mai
 * un numero che poi cambia.
 */
export function fraseScheda(voci: VoceDaSistemare[]): PezzoFrase[] {
  if (!voci.length) return [{ testo: 'In regola.', tono: 'verde' }]
  const soldi = voci.filter((v) => v.azione === 'pagamento')
  const cert = voci.find((v) => v.azione === 'certificato' && v.tono === 'rosso')
  const altre = voci.filter((v) => !soldi.includes(v) && v !== cert)
  const pezzi: PezzoFrase[] = []
  if (soldi.length) {
    const totale = totaleDaPagare(voci)
    const tono = soldi.some((v) => v.tono === 'rosso') ? 'rosso' : 'giallo'
    pezzi.push({ testo: 'Mancano ' }, { testo: totale === null ? 'dei pagamenti' : `${euro(totale)} €`, tono })
  }
  if (cert) {
    pezzi.push({ testo: soldi.length ? ' e il certificato' : 'Manca il certificato' })
    if (cert.parola !== 'Manca') pezzi.push({ testo: ', ' }, { testo: minuscola(cert.parola), tono: 'rosso' })
  }
  const resto = altre.length ? `${pezzi.length ? ' Da sistemare anche: ' : 'Da sistemare: '}${elenco(altre.map((v) => minuscola(v.cosa)))}.` : ''
  if (pezzi.length) pezzi.push({ testo: '.' })
  if (resto) pezzi.push({ testo: resto })
  // Pezzi senza tono uno dopo l'altro si leggono come uno: si uniscono.
  return pezzi.reduce<PezzoFrase[]>((acc, x) => {
    const ultimo = acc[acc.length - 1]
    if (ultimo && !ultimo.tono && !x.tono) ultimo.testo += x.testo
    else acc.push({ ...x })
    return acc
  }, [])
}

/**
 * L'etichetta accanto al nome di chi si è appena iscritto: per i primi 30
 * giorni in elenco, gli stessi che ha per portare il certificato. «Nuova» o
 * «Nuovo» lo dice il codice fiscale; senza, «Nuova iscrizione»: dal nome non
 * si indovina. Chi fa solo da genitore non si è iscritto.
 */
export function etichettaNuovo(p: Pick<PersonaSeg, 'attiva' | 'creataIl' | 'genitoreNonIscritto'>, codiceFiscale: string | undefined, oggi: string): string | null {
  if (!p.attiva || p.genitoreNonIscritto || spostaGiorno(p.creataIl, GIORNI_CERTIFICATO) <= oggi) return null
  const sesso = cfSesso(codiceFiscale ?? '')
  return sesso === 'F' ? 'Nuova' : sesso === 'M' ? 'Nuovo' : 'Nuova iscrizione'
}
