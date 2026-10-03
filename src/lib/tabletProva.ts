import type { DatiTablet, EsitoTocco, LezioneSala, PresenzaIstruttore, RigaAppelloTablet } from './tablet'
import { fase, REGOLE, sigle, sigleDeiProvati } from './tablet'
import { comeE, creaDatiProva, istruttoreDallAppello, lezioniFra, memoria, mettiProva, provatiProva, togliProvaDa } from './datiProva'
import { archivio, type PresenzaIstruttoreProva } from './archivioProva'
import { perCognome } from './sala'
import { impostazioniSala, timerSala } from '../../timer/src/lib/impostazioniSala'
import { fonteClipProva } from './voceProva'
import { somiglianti, TROPPE_RICERCHE } from './prove'

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
const { pinTentativi: PIN_TENTATIVI, pinBloccoMin: PIN_BLOCCO_MIN, annullaMin: ANNULLA_MIN } = REGOLE

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
  /** Come `ricerche_prove` (29-prove-per-nome.sql): quando ha cercato chi è già venuto. */
  const ricerche: number[] = []

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

  /**
   * Come `presenza_con_pin`: le lezioni della sala aperte adesso in cui chi
   * entra è previsto si segnano confermate; se non è previsto in nessuna, la
   * prima (quella in corso, o la più vicina) va da confermare. La segreteria
   * che non è prevista non si segna.
   */
  const segnaIstruttore = (personaId: string): PresenzaIstruttore[] => {
    const ora = adesso()
    const t = ora.getTime()
    const inCorso = (l: { inizio: Date; fine: Date }) => Number(l.inizio.getTime() <= t && t <= l.fine.getTime())
    const ieri = new Date(t - 24 * 60 * MIN)
    const aperte = lezioniFra(ieri, ora)
      .filter((l) => {
        const k = comeE(l)
        return k.sala === sala && k.stato !== 'annullata' && fase({ inizio: l.inizio.toISOString(), fine: l.fine.toISOString() }, ora) === 'aperta'
      })
      .sort((x, y) => inCorso(y) - inCorso(x) || Math.abs(x.inizio.getTime() - t) - Math.abs(y.inizio.getTime() - t))
    if (!aperte.length) return []
    const previste = aperte.filter((l) => comeE(l).istruttori.includes(personaId))
    // La segreteria non prevista non si segna, a meno che insegni anche.
    const chi = archivio.dati.persone.find((p) => p.id === personaId)
    if (!previste.length && chi?.ruolo === 'staff' && !chi.ancheIstruttore) return []
    const segnate = previste.length ? previste : aperte.slice(0, 1)
    const tutte = [...(archivio.dati.presenzeIstruttori ?? [])]
    for (const l of segnate) {
      const c = tutte.findIndex((x) => x.sessioneId === l.id && x.personaId === personaId)
      if (c < 0) {
        const nuova: PresenzaIstruttoreProva = {
          id: `pi-${t.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          sessioneId: l.id,
          personaId,
          stato: previste.length ? 'confermata' : 'da_confermare',
          prevista: previste.length > 0,
          entratoIl: ora.toISOString(),
          sala: sala ?? '',
        }
        tutte.push(nuova)
      } else if (previste.length && tutte[c].stato === 'da_confermare') {
        tutte[c] = { ...tutte[c], stato: 'confermata', prevista: true }
      }
    }
    archivio.dati.presenzeIstruttori = tutte
    archivio.salva()
    return segnate
      .sort((x, y) => x.inizio.getTime() - y.inizio.getTime())
      .map((l) => ({ sessioneId: l.id, corso: l.corso.nome, stato: tutte.find((x) => x.sessioneId === l.id && x.personaId === personaId)!.stato }))
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
          kanji: l.kanji,
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
      // Le prove no: le aggiunge chi fa l'appello, già presenti.
      const ordinati = d.elenco.filter((p) => !p.prova).sort((a, b) => a.nome.localeCompare(b.nome, 'it') || a.cognome.localeCompare(b.cognome, 'it'))
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
      const p = d.elenco.find((x) => x.id === personaId && !x.prova)
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
      const chi = daPin(pin)
      return chi ? { ...chi, presenze: segnaIstruttore(chi.personaId) } : null
    },

    async verificaPin(pin) {
      if (!sala) throw new Error('solo un tablet di sala')
      return daPin(pin)
    },

    async appello(pin, sessioneId) {
      const d = await lezione(sessioneId)
      if (!daPin(pin)) return []
      const origini = memoria.origini[sessioneId] ?? {}
      return [...d.elenco].sort((a, b) => Number(!!a.prova) - Number(!!b.prova) || perCognome(a, b)).map((p): RigaAppelloTablet => ({
        personaId: p.id,
        nome: p.nome,
        cognome: p.cognome,
        stato: p.stato,
        origine: p.stato === null ? null : (origini[p.id]?.da ?? 'appello'),
        ...(p.prova ? { prova: true } : {}),
      }))
    },

    async correggi(pin, sessioneId, personaId, stato, prova) {
      const d = await lezione(sessioneId)
      if (!daPin(pin)) return false
      const p = d.elenco.find((x) => x.id === personaId && !!x.prova === !!prova)
      if (!p) throw new Error(prova ? 'non è fra le prove di questa lezione' : 'non è iscritto a questo corso')
      if (prova && stato === null) throw new Error('una prova si segna presente o assente')
      if (stato === null) {
        // Come nel database: si toglie solo un segno arrivato dal tablet.
        if (memoria.origini[sessioneId]?.[personaId]) scrivi(sessioneId, personaId, null, null)
        return true
      }
      scrivi(sessioneId, personaId, stato, null)
      // Chi fa l'appello col PIN c'era, come dall'app.
      istruttoreDallAppello(sessioneId, daPin(pin)!.personaId, sala ?? undefined)
      return true
    },

    async provati(pin, scritto) {
      if (!sala) throw new Error('solo un tablet di sala')
      if (!daPin(pin)) return []
      // Come `provati_con_pin`: al massimo cento ricerche in dieci minuti e
      // trecento in un giorno, e un testo lungo non si cerca.
      const t = adesso().getTime()
      if (ricerche.filter((q) => q > t - 10 * MIN).length >= 100 || ricerche.filter((q) => q > t - 24 * 60 * MIN).length >= 300) {
        throw new Error(TROPPE_RICERCHE)
      }
      ricerche.push(t)
      if (scritto.length > 100) return []
      return sigleDeiProvati(somiglianti(provatiProva(false), scritto, 20))
    },

    async aggiungiProva(pin, sessioneId, chi) {
      await lezione(sessioneId)
      const da = daPin(pin)
      if (!da) return false
      const p = mettiProva(sessioneId, chi, da.personaId)
      // Come dall'appello: la presenza non è «dal tablet».
      scrivi(sessioneId, p.id, memoria.segnate[sessioneId]?.[p.id] ?? 'presente', null)
      return true
    },

    async togliProva(pin, sessioneId, personaId) {
      await lezione(sessioneId)
      if (!daPin(pin)) return false
      togliProvaDa(sessioneId, personaId)
      return true
    },

    async musica() {
      return (archivio.dati.musica ?? [])
        .filter((l) => l.sala === null || l.sala === sala)
        .map((l) => ({ id: l.id, nome: l.nome, link: l.link, salaId: l.sala }))
    },

    async timerSala() {
      const a = archivio.dati
      return timerSala({ timer: a.timerSale, voce: a.voceSale, esercizi: a.eserciziSale })
    },

    async salvaTimerSala(i) {
      archivio.dati.timerSale = impostazioniSala(i)
      archivio.salva()
    },

    clipSala: fonteClipProva,
  }
}
