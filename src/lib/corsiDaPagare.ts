import { conti, entroAnnuale, euroBreve, QUOTA, type Ricevuta } from './ricevute'
import { voceDelCorso, nomeCorso, type CorsoRef, type Listino } from './listino'
import { STAGIONE, type VoceCosto } from './costi'
import { dataLunga } from './sala'
import type { PersonaSeg } from './segreteria'

/**
 * I corsi da pagare: «in regola» guarda solo la quota associativa
 * (`pagamentoDi`), ma chi ha finito il trimestre o l'annuale di un corso deve
 * pagare anche quello. Qui, per ogni iscrizione in corso a un corso a
 * pagamento, si dice se il corso è coperto dalle voci delle ricevute,
 * dall'eccezione scritta a mano o da Satispay. La quota non cambia.
 */

/** Una voce di corso (non la QUOTA) di una ricevuta non annullata; `mancano` in centesimi, 0 = pagata. */
export interface VoceCorso {
  descrizione: string
  dal?: string
  al?: string
  mancano: number
  /** Il giorno della ricevuta: l'annuale si chiude entro il 31 dicembre di quell'anno. */
  data?: string
}

/** Come `quoteDi`, per le altre voci: quel che manca non supera quel che resta della ricevuta (l'anticipo copre). */
export function vociCorsiDi(ricevute: Ricevuta[]): VoceCorso[] {
  return ricevute
    .filter((r) => !r.annullataIl)
    .flatMap((r) => {
      const resta = conti(r).netto
      return r.voci
        .filter((v) => v.descrizione.trim().toUpperCase() !== QUOTA)
        .map((v) => {
          const pagata = v.pagamenti.reduce((s, p) => s + p.importo, 0)
          return { descrizione: v.descrizione, dal: v.dal, al: v.al, mancano: Math.min(Math.max(0, v.quantita * v.prezzo - pagata), resta), data: r.data }
        })
    })
}

export type ComeCorso = 'pagato' | 'fuori_app' | 'satispay' | 'in_parte' | 'scaduto' | 'fuori_scaduto' | 'da_pagare' | 'da_controllare'

export interface StatoCorso {
  corsoId: string
  corso: string
  come: ComeCorso
  formula?: 'trimestre' | 'annuale'
  al?: string
  /** Centesimi, per `in_parte`. */
  mancano?: number
  /** Per un annuale `in_parte`: entro quando va chiuso (31 dicembre dell'anno della ricevuta). */
  entro?: string
  /** Passata quella data. */
  oltre?: boolean
}

const PAGATI: ComeCorso[] = ['pagato', 'fuori_app', 'satispay']

// «Trimestre Judo 3», «Annuale Fitness 2 giorni», «Saldo Pilates»: le voci che scrive il modulo e la segreteria.
const FORMULA = /^(annuale|trimestre|saldo)\s+(.+)$/i

const formulaDi = (descrizione: string) => {
  const m = descrizione.trim().match(FORMULA)
  return m ? { formula: m[1].toLowerCase() === 'trimestre' ? ('trimestre' as const) : ('annuale' as const), nome: nomeCorso(m[2]) } : undefined
}

/** I nomi di una voce del listino, anche con l'etichetta di ogni riga («Fitness 2 giorni»). */
const nomiDellaVoce = (v: VoceCosto) => [v.corso, ...v.prezzi.flatMap((p) => (p.etichetta ? [`${v.corso} ${p.etichetta}`] : []))]

/** I nomi con cui una voce di ricevuta può chiamare un corso: il suo e quelli della sua voce di listino. */
function nomiDel(listino: Listino, c: CorsoRef): string[] {
  const v = voceDelCorso(listino.corsi, c)
  return [c.nome, ...(v ? nomiDellaVoce(v) : [])].map(nomeCorso)
}

/** Un corso gratuito non si paga: senza voce nel listino, senza un prezzo, o «va bene senza prezzo». */
function aPagamento(listino: Listino, c: CorsoRef): boolean {
  if (listino.senzaPrezzoVaBene?.includes(c.id)) return false
  const v = voceDelCorso(listino.corsi, c)
  return !!v && v.prezzi.some((p) => [p.annuale, p.trimestre, p.saldo].some((x) => (x ?? 0) > 0))
}

const piuLontana = <T extends { al?: string }>(voci: T[]) => [...voci].sort((a, b) => (b.al ?? '9999').localeCompare(a.al ?? '9999'))[0]

/**
 * Uno stato per iscrizione in corso a un corso a pagamento, per nome del
 * corso. undefined se le ricevute non si sono lette (`vociCorsi` assente).
 */
export function statoCorsi(p: Pick<PersonaSeg, 'attiva' | 'pagamento' | 'iscrizioni' | 'vociCorsi' | 'satispay' | 'satispayQuota' | 'satispayCorsi'>, corsi: CorsoRef[], listino: Listino, oggi: string): StatoCorso[] | undefined {
  const voci = p.vociCorsi
  if (!voci) return undefined
  if (!p.attiva) return []
  const conosciuti = new Set([...corsi.map((c) => c.nome), ...listino.corsi.flatMap(nomiDellaVoce)].map(nomeCorso))
  // Una voce scritta a mano che vale oggi potrebbe essere il corso: meglio guardarla che chiedere di pagare.
  const aMano = voci.some((v) => {
    const f = formulaDi(v.descrizione)
    return (!f || !conosciuti.has(f.nome)) && (!v.dal || v.dal <= oggi) && (!v.al || v.al >= oggi)
  })
  const ecc = p.pagamento
  const fino = ecc.fino || STAGIONE.quota.al

  const iscritti = new Set(p.iscrizioni.filter((i) => i.dal <= oggi && (!i.al || i.al >= oggi)).map((i) => i.corsoId))
  return corsi
    .filter((c) => iscritti.has(c.id) && aPagamento(listino, c))
    .map((c): StatoCorso => {
      const nomi = nomiDel(listino, c)
      const sue = voci.flatMap((v) => {
        const f = formulaDi(v.descrizione)
        return f && nomi.includes(f.nome) ? [{ ...v, formula: f.formula }] : []
      })
      const base = { corsoId: c.id, corso: c.nome }
      // Anche un trimestre che parte domani, già pagato, copre: non si sollecita chi ha pagato in anticipo.
      const pagata = piuLontana(sue.filter((v) => v.mancano === 0 && (!v.al || v.al >= oggi)))
      if (pagata) return { ...base, come: 'pagato', formula: pagata.formula, al: pagata.al }
      const parte = sue.filter((v) => v.mancano > 0 && (!v.dal || v.dal <= oggi) && (!v.al || v.al >= oggi)).sort((a, b) => a.mancano - b.mancano)[0]
      if (parte) {
        const entro = parte.formula === 'annuale' && parte.data ? entroAnnuale(parte.data) : undefined
        return { ...base, come: 'in_parte', formula: parte.formula, al: parte.al, mancano: parte.mancano, ...(entro ? { entro, oltre: oggi > entro } : {}) }
      }
      if (ecc.stato === 'pagato' && fino >= oggi) return { ...base, come: 'fuori_app', al: fino }
      // La quota pagata dall'area iscritti è dentro `satispay` ma non è l'iscrizione di prima: i corsi no.
      if ((p.satispay ?? 0) - (p.satispayQuota ?? 0) > 0 || p.satispayCorsi?.includes(c.id)) return { ...base, come: 'satispay' }
      const finita = piuLontana(sue.filter((v) => v.al && v.al < oggi))
      if (finita) return { ...base, come: 'scaduto', formula: finita.formula, al: finita.al }
      if (ecc.stato === 'pagato' && ecc.fino) return { ...base, come: 'fuori_scaduto', al: ecc.fino }
      return { ...base, come: aMano ? 'da_controllare' : 'da_pagare' }
    })
    .sort((a, b) => a.corso.localeCompare(b.corso, 'it'))
}

/** Fra gli stati, i corsi non coperti. */
export const nonPagati = (stati: StatoCorso[]): StatoCorso[] => stati.filter((s) => !PAGATI.includes(s.come))

/**
 * I corsi da chiedere: quelli che `righeDovute` dà non coperti. «Da controllare» è una voce a mano da guardare,
 * non da far pagare: resta nella scheda, non nei conti. [] per chi non è attivo, per il genitore non iscritto
 * o se le ricevute non si sono lette.
 */
export const corsiDaPagare = (p: PersonaSeg, corsi: CorsoRef[], listino: Listino, oggi: string): StatoCorso[] =>
  p.genitoreNonIscritto ? [] : nonPagati(statoCorsi(p, corsi, listino, oggi) ?? []).filter((s) => s.come !== 'da_controllare')

/**
 * Quante persone attive hanno almeno un corso da pagare: lo stesso numero in
 * DA FARE, COSA MANCA e nel filtro. undefined se nessuno ha le voci lette (il
 * riquadro non appare, senza errore).
 */
export function corsiScaduti(persone: PersonaSeg[], corsi: CorsoRef[], listino: Listino, oggi: string): number | undefined {
  if (!persone.some((p) => p.vociCorsi)) return undefined
  return persone.filter((p) => p.attiva && corsiDaPagare(p, corsi, listino, oggi).length > 0).length
}

/** La riga del corso nella scheda. */
export function testoCorso(s: StatoCorso): { testo: string; tono: 'sec' | 'rosso' | 'giallo' } {
  const d = dettaglioCorso(s)
  return { testo: `${s.corso}: ${d.testo}`, tono: d.tono }
}

/** Come sta il pagamento del corso, senza il nome del corso davanti. */
export function dettaglioCorso(s: StatoCorso): { testo: string; tono: 'sec' | 'rosso' | 'giallo' } {
  const al = s.al ? dataLunga(s.al) : ''
  const righe: Record<ComeCorso, [string, 'sec' | 'rosso' | 'giallo']> = {
    pagato: [al ? `pagato fino al ${al}` : 'pagato', 'sec'],
    fuori_app: [`pagato fuori dall’app fino al ${al}`, 'sec'],
    satispay: ['pagato con Satispay, ricevuta da fare', 'sec'],
    scaduto: [`scaduto il ${al}, da pagare`, 'rosso'],
    fuori_scaduto: [`pagata fuori dall’app fino al ${al}, ora da pagare`, 'rosso'],
    da_pagare: ['da pagare', 'rosso'],
    in_parte: s.entro && s.oltre
      ? [`l’annuale andava chiuso entro il ${dataLunga(s.entro)}, mancano ancora ${euroBreve(s.mancano ?? 0)}`, 'rosso']
      : [`pagato in parte, mancano ${euroBreve(s.mancano ?? 0)}${s.entro ? `, da chiudere entro il ${dataLunga(s.entro)}` : ''}`, 'giallo'],
    da_controllare: ['da controllare, c’è una voce scritta a mano', 'giallo'],
  }
  const [testo, tono] = righe[s.come]
  return { testo, tono }
}

/** La cella CORSI dell'elenco filtrato: corta, la data senza l'anno. */
export function testoCorsoBreve(s: StatoCorso): string {
  const al = s.al ? dataLunga(s.al, false) : ''
  const dopo = {
    pagato: al ? `pagato fino al ${al}` : 'pagato',
    fuori_app: `pagato fuori dall’app fino al ${al}`,
    // Nell'elenco filtrato sono tutti da pagare: basta dire fin quando valeva.
    fuori_scaduto: `pagato fuori dall’app fino al ${al}`,
    satispay: 'pagato con Satispay',
    scaduto: `scaduto il ${al}`,
    da_pagare: 'da pagare',
    in_parte: `mancano ${euroBreve(s.mancano ?? 0)}`,
    da_controllare: 'da controllare',
  }[s.come]
  return `${s.corso}: ${dopo}`
}

/** Sotto il corso scaduto nella scheda: la voce da mettere nella ricevuta nuova, con le parole del modulo. */
export const consiglioCorso = (s: StatoCorso): string =>
  `Una ricevuta nuova con «${s.formula === 'annuale' ? 'Annuale' : 'Trimestre'} ${s.corso}» lo rimette a posto. In sala entra lo stesso.`
