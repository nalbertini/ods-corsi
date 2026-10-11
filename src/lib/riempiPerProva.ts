/**
 * RIEMPI, solo in prova: scrive dati finti ma validi nel passo in cui si è,
 * per la persona attiva, così il modulo a passi si prova fino all'invio senza
 * scrivere tutto né caricare file veri.
 *
 * Riempie solo quel che il passo dice che manca o non va (`mancanti`, sulla
 * persona com'è con la famiglia): quel che è giusto resta, e quel che la
 * famiglia già dà (indirizzo, chi firma, la carta) non si copia. Niente a caso:
 * lo stesso stato dà sempre lo stesso risultato.
 *
 * La schermata lo carica con `import()` solo in prova: fuori prova non c'è.
 */
import { codiceFinto } from './codiceFiscale'
import type { CorsoRef, Listino } from './listino'
import { corsiPerEta } from './listino'
import { conDatiDellaFamiglia, mancanti, tipiDiPassi, type StatoPassi, type TipoPasso } from './passiIscrizione'
import { dataDaCf } from './richieste'
import type { Tratto } from './tratti'

// Un nome per posto in famiglia, così le pastiglie e le richieste si distinguono. [nome, donna]
const ADULTI: Array<[string, boolean]> = [['Giulia', true], ['Marco', false], ['Sara', true], ['Luca', false], ['Elena', true], ['Paolo', false]]
const BAMBINI: Array<[string, boolean]> = [['Sofia', true], ['Tommaso', false], ['Alice', true], ['Leonardo', false], ['Emma', true], ['Pietro', false]]
const GENITORI: Array<[string, boolean]> = [['Paola', true], ['Andrea', false], ['Chiara', true], ['Stefano', false], ['Marta', true], ['Davide', false]]
const COGNOME = 'Prova'
// Torino: col codice L219 il luogo torna anche con l'elenco dei comuni.
const NATO_A = 'Torino'
const COMUNE_CF = 'L219'

/** Una data fissa, qualche anno fa: 35 per un adulto, 38 per chi firma, 8 per un bambino (sopra i 6: c'è anche il certificato). */
const nataIl = (oggi: Date, anni: number, i: number) => `${oggi.getFullYear() - anni}-03-${String(10 + i).padStart(2, '0')}`

const senzaNumeri = (x: string | undefined) => !!x?.trim() && !/\d/.test(x)

/** Una firma finta che `firmaVera` accetta: un'onda larga 160px. */
const FIRMA: Tratto[] = [Array.from({ length: 17 }, (_, k): [number, number] => [20 + k * 10, 60 + (k % 2 ? -18 : 18)])]

// Un PNG di un punto: abbastanza per un file vero, di un tipo che il contenitore accetta.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'

export interface PerRiempire {
  corsi: CorsoRef[]
  listino: Listino | undefined
  oggi?: Date
  /** «Ho il foglio firmato»: il modulo va come file, non si firma qui. */
  fotoDelFoglio?: boolean
}

/** La persona `i` col passo `tipo` riempito, e la firma da mettere nel riquadro quando serve. */
export function riempiPerProva(persone: StatoPassi[], i: number, tipo: TipoPasso, { corsi, listino, oggi = new Date(), fotoDelFoglio }: PerRiempire): { stato: StatoPassi; firma?: Tratto[] } {
  const s = persone[i]
  const passo = tipiDiPassi(s.chi).indexOf(tipo) + 1
  if (!passo) return { stato: s }
  // Si guarda la persona com'è con la famiglia: quel che le dà un altro non manca.
  const v = { ...conDatiDellaFamiglia(persone)[i], ...(fotoDelFoglio && { firmaInFoto: true }) }
  const manca = new Set(mancanti(v, passo, oggi).map((p) => p.chiave))
  const r = { ...s.risposte }
  let stato: StatoPassi = s
  let firma: Tratto[] | undefined

  if (tipo === 'dati' || tipo === 'genitore') {
    const genitore = tipo === 'genitore'
    const [nome, cognome, cf] = genitore ? (['genitoreNome', 'genitoreCognome', 'genitoreCodiceFiscale'] as const) : (['nome', 'cognome', 'codiceFiscale'] as const)
    if ([nome, cognome, cf, 'natoIl', 'natoA'].some((k) => manca.has(k))) {
      const [proprio, donna] = (genitore ? GENITORI : s.chi === 'figlio' ? BAMBINI : ADULTI)[i % 6]
      const n = senzaNumeri(r[nome]) ? (r[nome] ?? '').trim() : proprio
      const c = senzaNumeri(r[cognome]) ? (r[cognome] ?? '').trim() : genitore && senzaNumeri(r.cognome) ? r.cognome.trim() : COGNOME
      const data = nataIl(oggi, genitore ? 38 : s.chi === 'figlio' ? 8 : 35, i)
      // Un nome già scritto dice chi è, non se è donna: il codice prende il giorno di chi è nella lista.
      r[nome] = n
      r[cognome] = c
      r[cf] = codiceFinto(c, n, data, donna, COMUNE_CF)
      if (!genitore) {
        r.natoIl = data
        r.natoA = NATO_A
      }
    }
    if (manca.has('indirizzo')) r.indirizzo = 'Via Prova 1'
    if (manca.has('cap')) r.cap = '10093'
    if (manca.has('comune')) r.comune = 'Collegno'
    if (manca.has('email')) r.email = `${(genitore ? r.genitoreNome : r.nome)?.trim().toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') || 'prova'}@esempio.it`
    if (manca.has('telefono')) r.telefono = `333 000 00${String(10 + i)}`
    if (manca.has('telefono2')) r.telefono2 = ''
    stato = { ...s, risposte: r, ...(manca.has('natoAGenitore') && { natoAGenitore: NATO_A }) }
  } else if (tipo === 'corso') {
    const nato = dataDaCf(v.risposte.codiceFiscale, v.risposte.natoIl, oggi) ?? v.risposte.natoIl
    const perEta = corsiPerEta(corsi, listino?.corsi ?? [], nato, listino?.senzaPrezzoVaBene, oggi)
    const buoni = [...perEta.adatti, ...perEta.senzaAnni].map((c) => c.id)
    // Restano i corsi già scelti che vanno con l'età; senza, il primo adatto. Solo senza listino il primo dell'elenco:
    // col listino il primo può essere un corso «dai 16 anni».
    const restano = r.corsi.filter((c) => buoni.includes(c))
    r.corsi = restano.length ? restano : [buoni[0] ?? (listino ? undefined : corsi[0]?.id)].filter((c): c is string => !!c)
    if (manca.has('formula')) r.formula = 'trimestre'
    stato = { ...s, risposte: r }
  } else if (tipo === 'modulo') {
    const scelte = { ...s.scelte, ...(manca.has('tesseramento') && { tesseramento: true }), ...(manca.has('foto') && { foto: true }) }
    if (s.io) return { stato: { ...s, scelte } }
    const file = manca.has('modulo') ? { ...s.file, modulo: new File([PDF], 'modulo-di-prova.pdf', { type: 'application/pdf' }) } : s.file
    if (manca.has('firma') && !file.modulo) firma = FIRMA
    if (manca.has('regolamento')) r.regolamento = true
    stato = { ...s, risposte: r, scelte, file, ...(firma && { tratti: firma.length }), ...(manca.has('privacy') && { privacy: true }) }
  } else if (tipo === 'documenti') {
    // Solo la carta d'identità: retro e certificato restano vuoti, così si prova anche «PUOI PORTARLO DOPO».
    if (manca.has('documento')) stato = { ...s, file: { ...s.file, documento: new File([PNG], 'carta-di-prova.png', { type: 'image/png' }) } }
  }
  return { stato, ...(firma && { firma }) }
}
