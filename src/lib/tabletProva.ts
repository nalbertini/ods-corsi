import type { DatiTablet, EsitoTocco, LezioneSala, RigaAppelloTablet } from './tablet'
import { REGOLE, sigle } from './tablet'
import { creaDatiProva, memoria } from './datiProva'
import { archivio } from './archivioProva'
import { perCognome } from './sala'

/**
 * Il tablet senza server: l'orario vero, gli iscritti inventati, e le stesse
 * regole di `04-tablet.sql` rifatte qui, così la prova si comporta come la
 * cosa vera. Le presenze sono quelle di `datiProva`: segnate dal tablet, le
 * vede l'appello dell'app, e viceversa.
 *
 * Due cose che col database non esistono:
 * - la sala si sceglie da un elenco, invece che con l'account della sala;
 * - l'ora si può spostare con `?adesso=2026-09-24T17:55` nell'indirizzo, per
 *   vedere una lezione che si apre senza aspettare il giovedì alle sei meno
 *   cinque.
 */

const DOVE_SALA = 'ods-corsi:prova-sala'
const SALE = ['Tatami', 'Lotta', 'Pesi', 'Motricità']

/** I PIN di prova. Col database ognuno ha il suo, e cifrato. */
export const PIN_PROVA: Record<string, { personaId: string; nome: string }> = {
  '1234': { personaId: 'i-maurizio', nome: 'Maurizio' },
  '2468': { personaId: 'i-maura', nome: 'Maura' },
  '5678': { personaId: 'i-fabio', nome: 'Fabio' },
}

const MIN = 60_000
const PIN_TENTATIVI = 5
const PIN_BLOCCO_MIN = 5
const ANNULLA_MIN = 2

/** Di quanto è spostato l'orologio della prova, letto una volta dall'indirizzo. */
function spostamento(): number {
  try {
    const v = new URLSearchParams(window.location.search).get('adesso')
    const t = v ? Date.parse(v) : NaN
    return Number.isFinite(t) ? t - Date.now() : 0
  } catch {
    return 0
  }
}

function leggiSala(): string | null {
  try {
    const s = localStorage.getItem(DOVE_SALA)
    return s && SALE.includes(s) ? s : null
  } catch {
    return null
  }
}

/**
 * Di chi è un PIN: prima quelli cambiati dalla segreteria di prova, poi quelli
 * di partenza — tranne per chi ne ha già uno nuovo, che col vecchio non entra più.
 */
function chiHaPin(pin: string): { personaId: string; nome: string } | null {
  const nuovi = archivio.dati.pin ?? {}
  const suo = Object.entries(nuovi).find(([, p]) => p === pin)?.[0]
  if (suo) return { personaId: suo, nome: archivio.dati.persone.find((p) => p.id === suo)?.nome ?? '' }
  const base = PIN_PROVA[pin]
  return base && !nuovi[base.personaId] ? base : null
}

export function creaTabletProva(): DatiTablet {
  const prova = creaDatiProva()
  const scarto = spostamento()
  const adesso = () => new Date(Date.now() + scarto)
  let sala = leggiSala()
  const tentativi: Array<{ quando: number; riuscito: boolean }> = []

  /** La lezione, se è di questa sala: come `lezione_del_tablet`. */
  const lezione = async (sessioneId: string) => {
    if (!sala) throw new Error('solo un tablet di sala')
    const d = await prova.dettaglio(sessioneId)
    if (!d) throw new Error('lezione inesistente')
    if (d.sessione.sala !== sala) throw new Error("lezione di un'altra sala")
    return d
  }

  /** Come `persona_da_pin`: conta i tentativi, e dopo cinque errori blocca. */
  const daPin = (pin: string) => {
    const t = adesso().getTime()
    const sbagliati = tentativi.filter((x) => !x.riuscito && x.quando > t - PIN_BLOCCO_MIN * MIN).length
    if (sbagliati >= PIN_TENTATIVI) throw new Error('troppi PIN sbagliati: riprova fra qualche minuto')
    const chi = chiHaPin(pin)
    tentativi.push({ quando: t, riuscito: !!chi })
    return chi
  }

  const scrivi = (sessioneId: string, personaId: string, stato: 'presente' | 'assente' | 'giustificato' | null, da: 'tablet' | 'recupero' | null) => {
    const mie = { ...(memoria.segnate[sessioneId] ?? {}) }
    const origini = { ...(memoria.origini[sessioneId] ?? {}) }
    if (stato === null) delete mie[personaId]
    else mie[personaId] = stato
    if (stato !== null && da) origini[personaId] = { da, il: adesso().getTime(), postazione: sala ?? '' }
    else delete origini[personaId]
    memoria.segnate = { ...memoria.segnate, [sessioneId]: mie }
    memoria.origini = { ...memoria.origini, [sessioneId]: origini }
    memoria.salva()
  }

  return {
    modo: 'prova',
    adesso,
    sale: SALE,

    async postazione() {
      return sala ? { nome: `Tablet ${sala}`, sala } : null
    },

    async scegliSala(s) {
      sala = s
      try {
        localStorage.setItem(DOVE_SALA, s)
      } catch {
        /* resta per questa sessione */
      }
    },

    async scollega() {
      sala = null
      try {
        localStorage.removeItem(DOVE_SALA)
      } catch {
        /* pazienza */
      }
    },

    async lezioni(da, a) {
      const tutte = await prova.calendario(da, a)
      return tutte
        .filter((l) => l.sala === sala)
        .map((l): LezioneSala => ({
          id: l.id,
          corsoId: l.corsoId,
          corso: l.corso,
          colore: l.colore,
          istruttori: l.istruttore,
          inizio: l.inizio,
          fine: l.fine,
          stato: l.stato,
          iscritti: l.iscritti,
          presenti: l.presenti,
        }))
    },

    async elenco(sessioneId) {
      const d = await lezione(sessioneId)
      const t = adesso().getTime()
      const inizio = Date.parse(d.sessione.inizio)
      if (inizio < t - REGOLE.recuperoGiorni * 24 * 60 * MIN || inizio > t + REGOLE.primaMin * MIN) {
        throw new Error('lezione fuori dalla finestra del tablet')
      }
      const ordinati = [...d.elenco].sort((a, b) => a.nome.localeCompare(b.nome, 'it') || a.cognome.localeCompare(b.cognome, 'it'))
      return sigle(ordinati).map((p) => ({ personaId: p.id, nome: p.nome, sigla: p.sigla, segnato: p.stato === 'presente' }))
    },

    async segna(sessioneId, personaId): Promise<EsitoTocco> {
      const d = await lezione(sessioneId)
      if (d.sessione.stato === 'annullata') throw new Error('lezione annullata')
      const t = adesso().getTime()
      const inizio = Date.parse(d.sessione.inizio)
      const fine = Date.parse(d.sessione.fine)
      let da: 'tablet' | 'recupero'
      if (t >= inizio - REGOLE.primaMin * MIN && t <= fine + REGOLE.dopoMin * MIN) da = 'tablet'
      else if (inizio <= t && inizio >= t - REGOLE.recuperoGiorni * 24 * 60 * MIN) da = 'recupero'
      else throw new Error('fuori orario: la lezione non si può segnare adesso')
      const p = d.elenco.find((x) => x.id === personaId)
      if (!p) throw new Error('non è iscritto a questo corso')
      if (p.stato === 'presente') return 'gia'
      if (p.stato !== null && !memoria.origini[sessioneId]?.[personaId]) return 'istruttore'
      scrivi(sessioneId, personaId, 'presente', da)
      return 'segnata'
    },

    async annulla(sessioneId, personaId) {
      await lezione(sessioneId)
      const o = memoria.origini[sessioneId]?.[personaId]
      if (!o || o.postazione !== sala || o.il <= adesso().getTime() - ANNULLA_MIN * MIN) return false
      scrivi(sessioneId, personaId, null, null)
      return true
    },

    async entraConPin(pin) {
      if (!sala) throw new Error('solo un tablet di sala')
      return daPin(pin)
    },

    async appello(pin, sessioneId) {
      const d = await lezione(sessioneId)
      if (!daPin(pin)) return []
      const origini = memoria.origini[sessioneId] ?? {}
      return [...d.elenco].sort(perCognome).map((p): RigaAppelloTablet => ({
        personaId: p.id,
        nome: p.nome,
        cognome: p.cognome,
        stato: p.stato,
        origine: p.stato === null ? null : (origini[p.id]?.da ?? 'appello'),
      }))
    },

    async correggi(pin, sessioneId, personaId, stato) {
      const d = await lezione(sessioneId)
      if (!daPin(pin)) return false
      if (!d.elenco.some((p) => p.id === personaId)) throw new Error('non è iscritto a questo corso')
      if (stato === null) {
        // Come nel database: si toglie solo un segno arrivato dal tablet.
        if (memoria.origini[sessioneId]?.[personaId]) scrivi(sessioneId, personaId, null, null)
        return true
      }
      scrivi(sessioneId, personaId, stato, null)
      return true
    },
  }
}
