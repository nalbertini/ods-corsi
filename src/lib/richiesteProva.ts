import type { DatiRichieste, FileRichiesta, Richiesta, TipoFile } from './richieste'
import { controlla, pulisciCf, minorenne } from './richieste'
import { caricaLuoghi, luogoDaCf, scriviLuogo } from './codiceFiscale'
import { archivio } from './archivioProva'
import { chiaveGiorno } from './sala'

/**
 * Le richieste di iscrizione senza server.
 *
 * Le risposte restano sul dispositivo, in `localStorage`, accanto
 * all'archivio di prova: così la segreteria di prova le trova e, accolte,
 * diventano iscritti che vedono anche il calendario, l'appello e il tablet.
 * I file no: foto e PDF pesano più di quanto `localStorage` tenga, e restano
 * solo finché la pagina è aperta. Accogliere fa quello che fa
 * `accogli_iscrizione` in `06-iscrizioni.sql`.
 */

const DOVE = 'ods-corsi:prova-richieste'   // vedi la nota in coda.ts

function leggi(): Richiesta[] {
  try {
    const r = JSON.parse(localStorage.getItem(DOVE) ?? '[]')
    return Array.isArray(r) ? r : []
  } catch {
    return []
  }
}

const file = new Map<string, Map<TipoFile, FileRichiesta>>()

/** Le richieste di prova, per l'esportazione dei dati di una persona. */
export function richiesteDi(personaId: string): Richiesta[] {
  return leggi().filter((r) => r.personaId === personaId)
}

/** Gli esempi di `esempiProva`: si aggiungono, e una richiesta che c'è già resta com'è. */
export function aggiungiRichiesteProva(nuove: Richiesta[]) {
  const tutte = leggi()
  const ci = new Set(tutte.map((r) => r.id))
  try {
    localStorage.setItem(DOVE, JSON.stringify([...tutte, ...nuove.filter((r) => !ci.has(r.id))]))
  } catch {
    /* niente esempi, pazienza */
  }
}

export function scordaRichiesteProva() {
  try {
    localStorage.removeItem(DOVE)
  } catch {
    /* pazienza */
  }
  file.clear()
}

export function creaRichiesteProva(): DatiRichieste {
  let tutte = leggi()
  const salva = () => {
    try {
      localStorage.setItem(DOVE, JSON.stringify(tutte))
    } catch {
      /* resta per questa sessione */
    }
  }
  const una = (id: string) => {
    const r = tutte.find((x) => x.id === id)
    if (!r) throw new Error('richiesta inesistente')
    return r
  }
  const cambia = (id: string, cambi: Partial<Richiesta>) => {
    tutte = tutte.map((r) => (r.id === id ? { ...r, ...cambi } : r))
    salva()
  }

  return {
    modo: 'prova',

    async corsiAperti() {
      return archivio.dati.corsi
        .filter((c) => c.attivo)
        .map((c) => ({ id: c.id, nome: c.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    },

    async invia(dati) {
      const guaio = controlla(dati)
      if (guaio) throw new Error(guaio)
      const aperti = new Set(archivio.dati.corsi.filter((c) => c.attivo).map((c) => c.id))
      if (dati.corsi.some((c) => !aperti.has(c))) throw new Error("Uno dei corsi scelti non c'è più: ricarica la pagina")
      const email = dati.email.trim().toLowerCase()
      const ieri = Date.now() - 24 * 60 * 60_000
      if (tutte.filter((r) => r.email === email && new Date(r.creataIl).getTime() > ieri).length >= 3)
        throw new Error('Da questa email sono già arrivate 3 richieste oggi: se serve, scrivi alla segreteria')
      const minore = minorenne(dati.natoIl)
      // Come il database: il luogo di nascita, se l'elenco lo conosce, è quello del codice.
      const luogo = luogoDaCf(await caricaLuoghi(), pulisciCf(dati.codiceFiscale), dati.natoIl)
      const r: Richiesta = {
        ...dati,
        id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        creataIl: new Date().toISOString(),
        stato: 'nuova',
        nome: dati.nome.trim(),
        cognome: dati.cognome.trim(),
        email,
        natoA: luogo ? scriviLuogo(luogo) : dati.natoA.trim(),
        codiceFiscale: pulisciCf(dati.codiceFiscale),
        corsi: [...new Set(dati.corsi)],
        genitoreNome: minore ? dati.genitoreNome?.trim() : undefined,
        genitoreCognome: minore ? dati.genitoreCognome?.trim() : undefined,
        genitoreCodiceFiscale: minore ? pulisciCf(dati.genitoreCodiceFiscale ?? '') : undefined,
        telefono2: dati.telefono2?.trim() || undefined,
        note: dati.note?.trim() || undefined,
      }
      tutte = [r, ...tutte]
      salva()
      return r.id
    },

    async caricaFile(richiestaId, tipo, f) {
      una(richiestaId)
      const suoi = file.get(richiestaId) ?? new Map<TipoFile, FileRichiesta>()
      const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : ''
      suoi.set(tipo, { tipo, url, pdf: f.type === 'application/pdf' })
      file.set(richiestaId, suoi)
    },

    async richieste() {
      tutte = leggi()
      return [...tutte].sort((a, b) => b.creataIl.localeCompare(a.creataIl))
    },

    async file(richiestaId) {
      return [...(file.get(richiestaId)?.values() ?? [])]
    },

    async accogli(richiestaId) {
      const r = una(richiestaId)
      if (r.stato !== 'nuova') throw new Error(`Questa richiesta è già stata ${r.stato}`)
      const a = archivio.dati
      const oggi = chiaveGiorno(new Date())
      const stesso = (x: string, y: string) => x.toLowerCase() === y.toLowerCase()
      const emailLibera = !a.persone.some((p) => p.email?.toLowerCase() === r.email)
      // Come nel database: prima il codice fiscale di una richiesta già
      // accolta, poi stesso nome e cognome, e la stessa email o nessuna.
      const perCf = tutte
        .filter((x) => x.id !== r.id && x.codiceFiscale === r.codiceFiscale && x.personaId)
        .map((x) => a.persone.find((p) => p.id === x.personaId))
        .find(Boolean)
      const perNome = a.persone
        .filter((p) => stesso(p.nome, r.nome) && stesso(p.cognome, r.cognome) && (!p.email || p.email.toLowerCase() === r.email))
        .sort((x, y) => Number(!!y.email) - Number(!!x.email))[0]
      const trovata = perCf ?? perNome
      let id: string
      if (trovata) {
        id = trovata.id
        a.persone = a.persone.map((p) =>
          p.id === id ? { ...p, attiva: true, telefono: p.telefono ?? r.telefono, email: p.email ?? (emailLibera ? r.email : undefined) } : p,
        )
      } else {
        id = `p-web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        a.persone = [
          ...a.persone,
          { id, nome: r.nome, cognome: r.cognome, ruolo: 'iscritto', email: emailLibera ? r.email : undefined, telefono: r.telefono, attiva: true, creataIl: oggi },
        ]
      }
      for (const corsoId of r.corsi) {
        if (!a.corsi.some((c) => c.id === corsoId && c.attivo)) continue
        const c = a.iscrizioni.find((i) => i.personaId === id && i.corsoId === corsoId)
        if (c && !c.al) continue
        // Chi aveva una fine segnata la perde; chi aveva già smesso riparte da oggi.
        a.iscrizioni = [...a.iscrizioni.filter((i) => i !== c), { corsoId, personaId: id, dal: c && c.al! >= oggi ? c.dal : oggi }]
      }
      archivio.salva()
      cambia(richiestaId, { stato: 'accolta', personaId: id, gestitaIl: new Date().toISOString(), gestitaDa: 'Segreteria di prova' })
      return id
    },

    async rifiuta(richiestaId) {
      if (una(richiestaId).stato !== 'nuova') throw new Error('Questa richiesta non è più nuova')
      cambia(richiestaId, { stato: 'rifiutata', gestitaIl: new Date().toISOString(), gestitaDa: 'Segreteria di prova' })
    },

    async elimina(richiestaId) {
      for (const f of file.get(richiestaId)?.values() ?? []) if (f.url) URL.revokeObjectURL(f.url)
      file.delete(richiestaId)
      tutte = tutte.filter((r) => r.id !== richiestaId)
      salva()
    },
  }
}
