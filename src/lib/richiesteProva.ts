import type { DatiRichieste, FileRichiesta, Richiesta, StatoRichiesta, TipoFile } from './richieste'
import { controlla, DA_STAMPARE, pulisciCf, minorenne } from './richieste'
import { caricaLuoghi, luogoDaCf, scriviLuogo } from './codiceFiscale'
import { archivio, certificatiProva, scordaCertificato } from './archivioProva'
import { nomeProprio } from './nomi'
import { chiaveGiorno } from './sala'
import { MASSIMO_PERSONE } from './passiIscrizione'
import { pulisciConosciuto, pulisciProvenienza } from './provenienza'
import { caricaListino } from './listino'
import { stimaIscrizione } from './nucleo'
import { NOME_TROPPO_LUNGO, nonSemplice, PAGAMENTO_ALTRA_PERSONA, PAGAMENTO_ALTRA_SCELTA, PAGAMENTO_NON_ARRIVATO, PAGAMENTO_NON_VALE, senzaVoceDelCorso, type PagamentoSatispay } from './satispay'

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

/** Come `per_email_al_giorno` di `49-richieste-per-email.sql`: una famiglia le manda tutte con una email, quante sono le persone di un modulo. */
const PER_EMAIL_AL_GIORNO = MASSIMO_PERSONE

function leggi(): Richiesta[] {
  try {
    const r = JSON.parse(localStorage.getItem(DOVE) ?? '[]')
    return Array.isArray(r) ? r : []
  } catch {
    return []
  }
}

const file = new Map<string, Map<TipoFile, FileRichiesta>>()

const DOVE_SATISPAY = 'ods-corsi:prova-satispay'   // vedi la nota in coda.ts

/**
 * I pagamenti Satispay di prova, come `pagamenti_satispay`: li legge anche la
 * segreteria di prova, con la scheda della richiesta quando è stata accolta.
 * `ricevutaId` c'è solo se quella ricevuta vale: annullata, i soldi tornano
 * liberi, come in `emetti_ricevuta_satispay`.
 */
export function pagamentiSatispayProva(): PagamentoSatispay[] {
  try {
    const p: PagamentoSatispay[] = JSON.parse(localStorage.getItem(DOVE_SATISPAY) ?? '[]')
    if (!Array.isArray(p)) return []
    const richieste = leggi()
    const valide = new Set((archivio.dati.ricevute ?? []).filter((r) => !r.annullataIl).map((r) => r.id))
    return p.map((x) => ({
      ...x,
      personaId: richieste.find((r) => r.id === x.richiestaId && r.stato === 'accolta')?.personaId,
      ricevutaId: x.ricevutaId && valide.has(x.ricevutaId) ? x.ricevutaId : undefined,
    }))
  } catch {
    return []
  }
}

export function salvaSatispay(p: PagamentoSatispay[]) {
  try {
    localStorage.setItem(DOVE_SATISPAY, JSON.stringify(p))
  } catch {
    /* resta per questa sessione */
  }
}

/**
 * In prova Satispay non c'è: aprire il link del pagamento fatto prima di
 * mandare (`prepara`) lo «approva», come farebbe chi conferma nell'app.
 */
export function pagaSatispayProva(pagamentoId: string) {
  const ora = new Date().toISOString()
  salvaSatispay(pagamentiSatispayProva().map((p) => (p.id === pagamentoId && p.stato === 'attesa' ? { ...p, stato: 'pagato', pagatoIl: ora } : p)))
}

/** Le richieste di prova, per l'esportazione dei dati di una persona. */
export function richiesteDi(personaId: string): Richiesta[] {
  return leggi().filter((r) => r.personaId === personaId)
}

/** Le richieste di una persona passano a un'altra: due schede unite (`unisciPersone`). */
export function spostaRichieste(da: string, a: string) {
  try {
    localStorage.setItem(DOVE, JSON.stringify(leggi().map((r) => (r.personaId === da ? { ...r, personaId: a } : r))))
  } catch {
    /* come gli esempi: senza spazio, restano dov'erano */
  }
}

/** Come una riga di `richieste_contate` (74-provenienza-richieste.sql): niente dati personali. */
export interface RichiestaContata {
  /** Solo per seguire lo stato: tolta quando la richiesta si elimina accolta o rifiutata. */
  richiestaId?: string
  /** `AAAA-MM-GG`. */
  giorno: string
  provenienza?: string
  conosciuto?: string
  corsi: string[]
  stato: StatoRichiesta
}

// I conteggi in una chiave loro, rilette a ogni uso come le richieste: con il
// modulo e la segreteria aperti in due schede, nessuna delle due scrive sopra
// i conteggi dell'altra con una copia vecchia (vedi la nota in coda.ts).
const DOVE_CONTATE = 'ods-corsi:prova-richieste-contate'

/** I conteggi della prova, letti adesso: per `richiesteDaDove` della segreteria di prova. */
export function richiesteContateProva(): RichiestaContata[] {
  try {
    const r = JSON.parse(localStorage.getItem(DOVE_CONTATE) ?? '[]')
    return Array.isArray(r) ? r : []
  } catch {
    return []
  }
}

function cambiaContate(f: (c: RichiestaContata[]) => RichiestaContata[]) {
  try {
    localStorage.setItem(DOVE_CONTATE, JSON.stringify(f(richiesteContateProva())))
  } catch {
    /* senza spazio il conteggio si perde: è la prova */
  }
}

/** Una richiesta che nasce, come il trigger after insert: una riga, una volta sola. */
function conta(r: Richiesta) {
  cambiaContate((c) => (c.some((x) => x.richiestaId === r.id) ? c : [...c, { richiestaId: r.id, giorno: chiaveGiorno(new Date(r.creataIl)), provenienza: r.provenienza, conosciuto: r.conosciuto, corsi: r.corsi, stato: r.stato }]))
}

/** Una richiesta che cambia, come il trigger after update: solo la riga che c'è; una richiesta di prima non ne ha. */
function aggiornaConteggio(r: Richiesta) {
  cambiaContate((c) => c.map((x) => (x.richiestaId === r.id ? { ...x, provenienza: r.provenienza, conosciuto: r.conosciuto, corsi: r.corsi, stato: r.stato } : x)))
}

/** Una richiesta eliminata, come il trigger before delete e `on delete set null`: da nuova (lo spam) non conta più; accolta o rifiutata resta, senza legame. */
function scordaConteggio(id: string) {
  cambiaContate((c) => c.filter((x) => !(x.richiestaId === id && x.stato === 'nuova')).map(({ richiestaId, ...x }) => (richiestaId === id ? x : { richiestaId, ...x })))
}

/** Gli esempi di `esempiProva`: si aggiungono, e una richiesta che c'è già resta com'è. */
export function aggiungiRichiesteProva(nuove: Richiesta[]) {
  const tutte = leggi()
  const ci = new Set(tutte.map((r) => r.id))
  const davvero = nuove.filter((r) => !ci.has(r.id))
  try {
    localStorage.setItem(DOVE, JSON.stringify([...tutte, ...davvero]))
  } catch {
    /* niente esempi, pazienza */
  }
  davvero.forEach(conta)
}

export function scordaRichiesteProva() {
  try {
    localStorage.removeItem(DOVE)
    localStorage.removeItem(DOVE_CONTATE)
    localStorage.removeItem(DOVE_SATISPAY)
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
    const r = tutte.find((x) => x.id === id)
    if (r) aggiornaConteggio(r)
  }

  return {
    modo: 'prova',

    async corsiAperti() {
      return archivio.dati.corsi
        .filter((c) => c.attivo)
        .map((c) => ({ id: c.id, nome: c.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    },

    async orariAperti() {
      // Come orari_aperti() in 48-orari-aperti.sql: corsi attivi, ricorrenze non finite.
      const oggi = chiaveGiorno(new Date())
      return archivio.dati.corsi
        .filter((c) => c.attivo)
        .flatMap((c) => c.ricorrenze.filter((x) => !x.al || x.al >= oggi).map((x) => ({ corsoId: c.id, giorno: x.giorno, ora: x.ora, durata: x.durata })))
    },

    async invia({ pagamentoSatispay, ...dati }) {
      const guaio = controlla(dati)
      if (guaio) throw new Error(guaio)
      const aperti = new Set(archivio.dati.corsi.filter((c) => c.attivo).map((c) => c.id))
      if (dati.corsi.some((c) => !aperti.has(c))) throw new Error("Uno dei corsi scelti non c'è più: ricarica la pagina")
      if (dati.nucleoDi && !archivio.dati.persone.some((p) => p.id === dati.nucleoDi && p.ruolo === 'iscritto' && p.attiva && !p.nucleo))
        throw new Error('Il nucleo per cui iscrivi non c’è più: ricarica la pagina')
      const email = dati.email.trim().toLowerCase()
      const pagato = pagamentoSatispay ? pagamentiSatispayProva().find((p) => p.id === pagamentoSatispay) : undefined
      // Come `invia_iscrizione` in 81-satispay-prima.sql: lo stesso invio rimandato dopo una risposta persa ritrova
      // la sua richiesta (stesso codice fiscale, email e scelta), senza contare nei limiti.
      const sua = pagato?.richiestaId ? tutte.find((x) => x.id === pagato.richiestaId) : undefined
      if (sua && sua.codiceFiscale === pulisciCf(dati.codiceFiscale) && sua.email === email && sua.formula === dati.formula && [...new Set(dati.corsi)].join() === sua.corsi.join())
        return sua.id
      const ieri = Date.now() - 24 * 60 * 60_000
      if (tutte.filter((r) => r.email === email && new Date(r.creataIl).getTime() > ieri).length >= PER_EMAIL_AL_GIORNO)
        throw new Error(`Da questa email sono già arrivate ${PER_EMAIL_AL_GIORNO} richieste oggi: se serve, scrivi alla segreteria`)
      // Come `invia_iscrizione` in 81-satispay-prima.sql: il pagamento fatto prima, solo se è arrivato, mai preso,
      // per questa scelta e pagato da chi si iscrive.
      if (pagamentoSatispay) {
        if (!pagato || pagato.richiestaId || pagato.presoIl || !pagato.corsoId) throw new Error(PAGAMENTO_NON_VALE)
        if (pagato.stato !== 'pagato') throw new Error(PAGAMENTO_NON_ARRIVATO)
        if (new Set(dati.corsi).size !== 1 || dati.corsi[0] !== pagato.corsoId || dati.formula !== pagato.formula) throw new Error(PAGAMENTO_ALTRA_SCELTA)
        const uguale = (a = '', b = '') => a.trim().toLowerCase() === b.trim().toLowerCase()
        if (!uguale(pagato.email, email) || !uguale(pagato.nome, dati.nome) || !uguale(pagato.cognome, dati.cognome)) throw new Error(PAGAMENTO_ALTRA_PERSONA)
      }
      const minore = minorenne(dati.natoIl)
      // Come il database: il luogo di nascita, se l'elenco lo conosce, è quello del codice.
      const luogo = luogoDaCf(await caricaLuoghi(), pulisciCf(dati.codiceFiscale), dati.natoIl)
      const r: Richiesta = {
        ...dati,
        id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        creataIl: new Date().toISOString(),
        stato: 'nuova',
        nome: nomeProprio(dati.nome),
        cognome: nomeProprio(dati.cognome),
        email,
        natoA: luogo ? scriviLuogo(luogo) : dati.natoA.trim(),
        codiceFiscale: pulisciCf(dati.codiceFiscale),
        corsi: [...new Set(dati.corsi)],
        genitoreNome: minore && dati.genitoreNome ? nomeProprio(dati.genitoreNome) : undefined,
        genitoreCognome: minore && dati.genitoreCognome ? nomeProprio(dati.genitoreCognome) : undefined,
        genitoreCodiceFiscale: minore ? pulisciCf(dati.genitoreCodiceFiscale ?? '') : undefined,
        telefono2: dati.telefono2?.trim() || undefined,
        note: dati.note?.trim() || undefined,
        nucleoDi: dati.nucleoDi || undefined,
        // Come il database: pulite, o scartate senza fermare la richiesta.
        provenienza: pulisciProvenienza(dati.provenienza),
        conosciuto: pulisciConosciuto(dati.conosciuto),
      }
      tutte = [r, ...tutte]
      salva()
      conta(r)
      if (pagato) salvaSatispay(pagamentiSatispayProva().map((p) => (p.id === pagato.id ? { ...p, richiestaId: r.id, presoIl: r.creataIl } : p)))
      return r.id
    },

    async caricaFile(richiestaId, tipo, f) {
      una(richiestaId)
      const suoi = file.get(richiestaId) ?? new Map<TipoFile, FileRichiesta>()
      // Come nel database: un file rimandato è arrivato, e caricato è caricato.
      // Qui un file si riconosce dal tipo, non dal nome con l'estensione: un
      // modulo in JPG dopo uno in PDF nel database entrerebbe come secondo file.
      if (suoi.has(tipo)) return
      const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : ''
      suoi.set(tipo, { tipo, url, pdf: f.type === 'application/pdf' })
      file.set(richiestaId, suoi)
    },

    async paga(richiestaId) {
      // Come `satispay_prepara`: un link sbagliato o vecchio dice la stessa cosa di una richiesta già gestita.
      const r = tutte.find((x) => x.id === richiestaId)
      if (r?.stato !== 'nuova') throw new Error('Questa richiesta non si può più pagare online: scrivi alla segreteria')
      const tutti = pagamentiSatispayProva()
      if (!tutti.some((p) => p.richiestaId === richiestaId && p.stato === 'pagato')) {
        // Nessuna rete in prova: Satispay «approva» subito, con l'importo che darebbe il database.
        const { listino } = await caricaListino()
        const corsi = r.corsi.map((id) => archivio.dati.corsi.find((c) => c.id === id) ?? { id, nome: id })
        const s = stimaIscrizione({ chi: `${r.cognome} ${r.nome}`, corsi, formula: r.formula }, [], chiaveGiorno(new Date()), listino)
        if (s.senzaPrezzo.length || senzaVoceDelCorso(corsi, listino).length || nonSemplice(corsi, listino)) throw new Error('Un corso non ha ancora il prezzo: paga col bonifico')
        const ora = new Date().toISOString()
        salvaSatispay([...tutti, { id: `sp-${Date.now().toString(36)}`, richiestaId, chi: `${r.cognome} ${r.nome}`, importo: s.totale, stato: 'pagato', creatoIl: ora, pagatoIl: ora }])
      }
      return { link: `${location.pathname}?prova&pagamento=${encodeURIComponent(richiestaId)}` }
    },

    async satispayAttivo() {
      return true
    },

    async prepara(x) {
      // Come `satispay_prepara_prima`: quello vivo per la stessa scelta e persona (anche già pagato e non ancora
      // preso: chi ricarica la pagina non paga due volte), o uno nuovo con l'importo del listino.
      const nome = x.nome.trim()
      const cognome = x.cognome.trim()
      const email = x.email.trim().toLowerCase()
      if (!nome || !cognome || !email) throw new Error('Scrivi nome, cognome ed email prima di pagare')
      if (nome.length > 80 || cognome.length > 80 || email.length > 254) throw new Error(NOME_TROPPO_LUNGO)
      const corso = archivio.dati.corsi.find((c) => c.id === x.corso && c.attivo)
      if (!corso) throw new Error("Uno dei corsi scelti non c'è più: ricarica la pagina")
      const tutti = pagamentiSatispayProva()
      // Col percorso della pagina, come `?pagamento=` di `paga`: la `<base href="../">` porterebbe un link relativo fuori da iscrizioni/.
      const link = (id: string) => `${window.location.pathname}?prova&satispay=${encodeURIComponent(id)}`
      const vivi = tutti.filter((p) => !p.richiestaId && !p.presoIl && p.stato !== 'non-andato' && p.corsoId === x.corso && p.formula === x.formula && p.nome === nome && p.cognome === cognome && p.email === email)
      const vivo = vivi.find((p) => p.stato === 'pagato') ?? vivi[0]
      if (vivo?.stato === 'pagato') return { stato: 'pagato', id: vivo.id, importo: vivo.importo, pagatoIl: vivo.pagatoIl }
      if (vivo) return { stato: 'attesa', id: vivo.id, importo: vivo.importo, link: link(vivo.id) }
      const { listino } = await caricaListino()
      const corsi = [{ id: corso.id, nome: corso.nome }]
      const s = stimaIscrizione({ chi: `${cognome} ${nome}`, corsi, formula: x.formula }, [], chiaveGiorno(new Date()), listino)
      if (s.senzaPrezzo.length || senzaVoceDelCorso(corsi, listino).length || nonSemplice(corsi, listino)) throw new Error('Un corso non ha ancora il prezzo: paga col bonifico')
      const id = `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      salvaSatispay([...tutti, { id, chi: `${cognome} ${nome}`, importo: s.totale, stato: 'attesa', creatoIl: new Date().toISOString(), corsoId: x.corso, corso: corso.nome, formula: x.formula, nome, cognome, email }])
      return { stato: 'attesa', id, importo: s.totale, link: link(id) }
    },

    async statoSatispay(pagamentoId) {
      const p = pagamentiSatispayProva().find((x) => x.id === pagamentoId)
      return p ? { stato: p.stato, importo: p.importo, pagatoIl: p.pagatoIl, collegato: !!p.presoIl } : null
    },

    async statoPagamento(richiestaId) {
      const p = pagamentiSatispayProva().find((x) => x.richiestaId === richiestaId && x.stato !== 'non-andato')
      return p ? { stato: p.stato, importo: p.importo, pagatoIl: p.pagatoIl } : null
    },

    async richieste() {
      tutte = leggi()
      return [...tutte].sort((a, b) => b.creataIl.localeCompare(a.creataIl))
    },

    async file(richiestaId) {
      return [...(file.get(richiestaId)?.values() ?? [])]
    },

    async conDocumento() {
      return new Set([...file].filter(([, suoi]) => DA_STAMPARE.some((t) => suoi.has(t))).map(([id]) => id))
    },

    async eliminaFile(richiestaId, tipo) {
      const f = file.get(richiestaId)?.get(tipo)
      if (f?.url) URL.revokeObjectURL(f.url)
      file.get(richiestaId)?.delete(tipo)
    },

    async accogli(richiestaId, personaId) {
      const r = una(richiestaId)
      if (r.stato !== 'nuova') throw new Error(`Questa richiesta è già stata ${r.stato}`)
      const a = archivio.dati
      const oggi = chiaveGiorno(new Date())
      const stesso = (x: string, y: string) => x.toLowerCase() === y.toLowerCase()
      const email = r.email.toLowerCase()
      const emailLibera = !a.persone.some((p) => p.email?.toLowerCase() === email)
      const cifre = (t?: string) => (t ?? '').replace(/\D/g, '').slice(-10)
      const scelta = personaId ? a.persone.find((p) => p.id === personaId) : undefined
      if (personaId && !scelta) throw new Error('Questa scheda non c’è più')
      // Come nel database: prima il codice fiscale di una richiesta già
      // accolta, poi stesso nome e cognome, e la stessa email, nessuna o lo
      // stesso telefono. Il codice vale solo con lo stesso nome e cognome: lo
      // sanno in tanti, e un nome diverso la segreteria lo sceglie a mano.
      const stessoNome = (p: { nome: string; cognome: string }) => stesso(p.nome, r.nome) && stesso(p.cognome, r.cognome)
      const perCf = tutte
        .filter((x) => x.id !== r.id && x.codiceFiscale === r.codiceFiscale && x.personaId)
        .map((x) => a.persone.find((p) => p.id === x.personaId))
        .find((p) => p && stessoNome(p))
      // O quello dei dati anagrafici, di chi è arrivato dalle risposte del modulo Google.
      const perAnagrafica = a.persone.find((p) => a.anagrafiche?.[p.id]?.codiceFiscale === r.codiceFiscale && stessoNome(p))
      const perNome = a.persone
        .filter((p) => stesso(p.nome, r.nome) && stesso(p.cognome, r.cognome) && (!p.email || p.email.toLowerCase() === email || (cifre(r.telefono).length >= 9 && cifre(p.telefono) === cifre(r.telefono))))
        .sort((x, y) => Number(!!y.email) - Number(!!x.email))[0]
      const trovata = scelta ?? perCf ?? perAnagrafica ?? perNome
      let id: string
      if (trovata) {
        id = trovata.id
        a.persone = a.persone.map((p) =>
          p.id === id
            ? {
                ...p,
                attiva: true,
                telefono: p.telefono ?? r.telefono,
                email: p.email ?? (emailLibera ? email : undefined),
                // L'email è di un'altra persona: la scheda che c'era la tiene come contatto, se non ne ha già uno.
                emailContatto: p.emailContatto ?? (!emailLibera && p.email?.toLowerCase() !== email ? email : undefined),
              }
            : p,
        )
      } else {
        id = `p-web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        a.persone = [
          ...a.persone,
          // L'email già di un'altra persona non è la sua di accesso: va nel contatto (44-email-contatto.sql).
          { id, nome: r.nome, cognome: r.cognome, ruolo: 'iscritto', email: emailLibera ? email : undefined, emailContatto: emailLibera ? undefined : email, telefono: r.telefono, attiva: true, creataIl: oggi },
        ]
      }
      // Dal nucleo di un iscritto: ci entra, a meno che non sia il titolare
      // stesso o non abbia già un nucleo suo, con altri dentro.
      const titolare = r.nucleoDi && a.persone.find((p) => p.id === r.nucleoDi && p.attiva && !p.nucleo)
      const haIlSuo = a.persone.some((p) => p.nucleo === id)
      if (titolare && titolare.id !== id && !haIlSuo) a.persone = a.persone.map((p) => (p.id === id ? { ...p, nucleo: titolare.id } : p))
      for (const corsoId of r.corsi) {
        if (!a.corsi.some((c) => c.id === corsoId && c.attivo)) continue
        const c = a.iscrizioni.find((i) => i.personaId === id && i.corsoId === corsoId)
        if (c && !c.al) continue
        // Chi aveva una fine segnata la perde; chi aveva già smesso riparte da oggi.
        a.iscrizioni = [...a.iscrizioni.filter((i) => i !== c), { corsoId, personaId: id, dal: c && c.al! >= oggi ? c.dal : oggi }]
      }
      // Il certificato passa alla scheda, senza data: la scrive la segreteria. Come `accogli_iscrizione`.
      const cert = file.get(richiestaId)?.get('certificato')
      if (cert) {
        scordaCertificato(id)
        certificatiProva.set(id, { url: cert.url, pdf: cert.pdf })
        file.get(richiestaId)?.delete('certificato')
        a.persone = a.persone.map((p) =>
          p.id === id ? { ...p, certificato: { scade: p.certificato?.scade, file: `${id}/certificato-${Date.now()}.${cert.pdf ? 'pdf' : 'jpg'}`, caricatoIl: oggi } } : p,
        )
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
      scordaConteggio(richiestaId)
    },
  }
}
