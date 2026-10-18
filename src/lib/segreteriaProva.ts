import type { Anagrafica, AnagraficaDi, CorsoSeg, DatiSegreteria, EsitoDate, Impostazioni, LezioneSeg, PersonaSeg, PersonaleSeg, PresenzaIstruttoreSeg, ProvaSeg, RigaRegistro, Statistiche, StoricoSeg } from './segreteria'
import { attivitaCambiata, cancellaFileIl, contattoNonValido, cosaNonVaAnagrafica, cosaNonVaCertificato, cosaNonVaScadenza, emailGiaDi, cosaNonVaAttivita, lezioniCheSeguonoIlGiorno, motivoAttivitaUsata, ordinaAttivita, pulisciAnagrafica } from './segreteria'
import { giorniConLezioni } from './calendarioSettimana'
import { cosaNonVaNucleo, nuovoTitolare } from './nucleo'
import { gestisciSegnalataProva, segnalateProva } from './segnalateProva'
import { nomeProprio } from './nomi'
import { insegna, segniDi, type RuoloPersonale } from './ruoli'
import { contattoDopoUnione, type IndiziDoppioni } from './doppioni'
import { archivio, certificatiProva, idRicorrenza, nomeDi, scordaCertificato, STAGIONE, type LezioneProva, type PersonaProva } from './archivioProva'
import { attivitaDi, comeE, iscrittiIl, lezioniFra, lezioniSenzaIstruttoreProva, nomeIstruttore, salaDelGiorno, segnaIstruttoriLezioneProva, segnaIstruttorePrevistoProva, trovaLezione, type LezioneTrovata } from './datiProva'
import { memoria, nomeAttivita } from './datiProva'
import { chiaveGiorno } from './sala'
import { enteDaDati, fineAnno, importaTessereProva } from './tessere'
import { PIN_PROVA } from './tabletProva'
import { kanjiScritto } from './kanji'
// La pulizia del testo del sito è una libreria grossa: si scarica solo aprendo il pannello SITO.
const sitoProva = () => import('./sitoProva')
import { controllaImmagine, cosaNonVaImmagini, nomeNelContenitore } from './sitoImmagini'
import { allegatiScaduti, cosaNonVaSegnalazione, eCategoria, SCEGLI, guaioAllegati, nomiAllegati, type Allegato, type Segnalazione } from './segnalazioni'
import { richiesteDi, spostaRichieste } from './richiesteProva'
import { ESTENSIONI } from './richieste'
import { disciplinaDaSalvare, erroreDelLink, fonteDelLink, MAX_NOME_LISTA } from './musica'
import { eserciziDellaPalestra, voceDellaSala } from '../../timer/src/lib/impostazioniSala'
import { disciplineDa, ripulisciDisciplina } from '../../timer/src/lib/discipline'
import { chiaveValida } from '../../timer/src/lib/clipSala'
import { loadHistory } from '../../timer/src/lib/storage'
import { clipProva } from './voceProva'
import { agganciaPerNome, cosaNonVaListino, LISTINO_PREDEFINITO, listinoDa, listinoProva, salvaListinoProva } from './listino'
import { cosaNonVaDiretto, trovaPagatori, type PagamentoDiretto } from './pagamenti'
import {
  cosaNonVaAnnulloChiusura,
  cosaNonVaAnnulloMovimento,
  cosaNonVaChiusura,
  cosaNonVaGiroconto,
  cosaNonVaMovimento,
  cosaNonVaPrevisto,
  cosaNonVaSaldo,
  cosaNonVaVoce,
  dalDellaChiusura,
  elencoMovimenti,
  NOME_CASSA_CONTANTI,
  NOME_CASSA_CONTO,
  oggiARoma,
  previstoCassa,
  primoMovimentoManuale,
  righeMovimenti,
  ultimaChiusura,
  VOCE_CORSI,
  VOCE_DIFFERENZA,
  VOCE_QUOTA,
  type VoceContabile,
} from './contabilita'
import { conti as contiRicevuta, cosaNonVa, ENTE_PREDEFINITO, intestatarioDa, pulisciIntestatario, quoteDi, type Ricevuta } from './ricevute'

/**
 * La segreteria senza server: cambia l'archivio di prova sul dispositivo.
 *
 * Fa quello che fa il database, dove si può: un corso (o un suo giorno) che
 * cambia sala porta con sé le lezioni che non erano state spostate a mano,
 * togliere un giorno lo chiude a ieri invece di cancellarlo, archiviare un
 * corso lo toglie dal calendario. Una differenza: qui le lezioni non sono salvate una per una, si
 * calcolano dalle ricorrenze, quindi «rigenera» non ha niente da fare.
 */

const GIORNO = 24 * 60 * 60_000

/**
 * Un pezzo di id che non si ripete. L'ora da sola non basta: un import crea
 * dieci persone nello stesso millisecondo, e con lo stesso id diventavano una.
 */
/** Il ruolo da salvare, come `ruoloDaScrivere` di `segreteriaSupabase.ts`: il ruolo doppio solo se c'è in `r`. */
const ruoloDi = (r: RuoloPersonale) => ({
  ruolo: r.ruolo,
  ...(r.ancheIstruttore === undefined ? {} : { ancheIstruttore: segniDi(r.ruolo, r.ancheIstruttore).ancheIstruttore }),
  ...(r.ancheAmministrazione === undefined ? {} : { ancheAmministrazione: segniDi(r.ruolo, false, r.ancheAmministrazione).ancheAmministrazione }),
})
const unico = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * I file delle segnalazioni, per messaggio: come quelli dei certificati restano
 * solo finché la pagina è aperta, perché `localStorage` non li tiene.
 */
const fileProva = new Map<string, { allegati: Allegato[]; file: { id: string; file: File }[]; tolti: { da: string; il: string }[] }>()

const metti = (messaggio: string, files: File[]) => {
  if (!files.length) return
  const nomi = nomiAllegati(files, new Date())
  const r = { allegati: [] as Allegato[], file: [] as { id: string; file: File }[], tolti: [] as { da: string; il: string }[] }
  files.forEach((f, i) => {
    const id = `al-${unico()}`
    r.allegati.push({ id, nome: nomi[i], tipo: f.type, peso: f.size, mio: true })
    r.file.push({ id, file: f })
  })
  fileProva.set(messaggio, r)
}

export function creaSegreteriaProva(): DatiSegreteria {
  const a = () => archivio.dati
  const oggi = () => chiaveGiorno(new Date())
  const ieri = () => chiaveGiorno(new Date(Date.now() - GIORNO))
  const salva = () => archivio.salva()
  // Le casse e le voci di partenza, finché la segreteria non ne cambia: due casse a zero e le due voci degli incassi.
  // Le voci della segreteria, o quelle di partenza; la chiusura di cassa scrive da sola «Differenza di cassa»: c'è sempre, anche in un archivio fatto prima.
  const vociDiPartenza = (): VoceContabile[] => {
    const base: VoceContabile[] = a().voci ?? [
      { id: 'voce-quota', nome: VOCE_QUOTA, tipo: 'entrata', diSistema: true, attiva: true },
      { id: 'voce-corsi', nome: VOCE_CORSI, tipo: 'entrata', diSistema: true, attiva: true },
    ]
    if (base.some((v) => v.nome === VOCE_DIFFERENZA)) return base
    return [
      ...base,
      { id: 'voce-differenza-entrata', nome: VOCE_DIFFERENZA, tipo: 'entrata', diSistema: true, attiva: true },
      { id: 'voce-differenza-uscita', nome: VOCE_DIFFERENZA, tipo: 'uscita', diSistema: true, attiva: true },
    ]
  }
  const contabilita = () => ({
    casse: a().casse ?? [
      { id: 'cassa-contanti', nome: NOME_CASSA_CONTANTI, saldoIniziale: 0 },
      { id: 'cassa-conto', nome: NOME_CASSA_CONTO, saldoIniziale: 0 },
    ],
    voci: vociDiPartenza(),
    movimenti: a().movimenti ?? [],
    chiusure: a().chiusure ?? [],
  })
  /** Trenta giorni dopo la scadenza il file se ne va, la data resta: come `pulisci_certificati` del database. */
  const potaCertificati = () => {
    const g = oggi()
    const scaduti = a().persone.filter((p) => p.certificato?.file && p.certificato.scade && cancellaFileIl(p.certificato.scade) <= g)
    if (!scaduti.length) return
    for (const p of scaduti) scordaCertificato(p.id)
    // Il giorno di caricamento resta: dice che un file c'è stato.
    a().persone = a().persone.map((p) => (scaduti.includes(p) ? { ...p, certificato: { scade: p.certificato!.scade, caricatoIl: p.certificato!.caricatoIl } } : p))
    salva()
  }

  const corso = (id: string) => {
    const c = a().corsi.find((x) => x.id === id)
    if (!c) throw new Error('Corso inesistente')
    return c
  }
  const persona = (id: string) => {
    const p = a().persone.find((x) => x.id === id)
    if (!p) throw new Error('Persona inesistente')
    return p
  }
  /** I controlli di `unione_possibile` (29-unisci-doppioni.sql); in prova anche il nucleo, che col database non c'è. */
  const unionePossibile = (resta: string, via: string) => {
    if (resta === via) throw new Error('Scegli due schede diverse')
    const r = persona(resta)
    const v = persona(via)
    if (r.ruolo !== 'iscritto' || v.ruolo !== 'iscritto') throw new Error('Si uniscono solo le schede degli iscritti, non quelle del personale')
    // Il codice fiscale scritto in segreteria, se no quello del modulo accolto.
    const cf = (id: string) =>
      a().anagrafiche?.[id]?.codiceFiscale ??
      richiesteDi(id)
        .filter((x) => x.stato === 'accolta')
        .sort((x, y) => (y.gestitaIl ?? '').localeCompare(x.gestitaIl ?? ''))[0]?.codiceFiscale
    if (cf(resta) && cf(via) && cf(resta) !== cf(via))
      throw new Error('Hanno due codici fiscali diversi: non sono la stessa persona. Se uno è sbagliato, correggilo nella scheda e riprova')
    if (v.nucleo) throw new Error(`${nomeDi(v)} è nel nucleo familiare di un'altra persona: prima toglila dal nucleo`)
    if (a().persone.some((x) => x.nucleo === via)) throw new Error(`${nomeDi(v)} è titolare di un nucleo familiare: prima rendi titolare qualcun altro o togli gli altri dal nucleo`)
  }
  /** Come `anagraficaDi` del database: i più recenti fra la richiesta accolta e quelli della segreteria. */
  const anagraficaDi = (personaId: string): AnagraficaDi | null => {
    const r = richiesteDi(personaId)
      .filter((x) => x.stato === 'accolta')
      .sort((x, y) => (y.gestitaIl ?? y.creataIl).localeCompare(x.gestitaIl ?? x.creataIl))[0]
    const { cambiataIl, ...an } = a().anagrafiche?.[personaId] ?? {}
    const daSegreteria = Object.keys(an).length ? { dati: an, da: 'segreteria' as const, quando: cambiataIl ?? '' } : null
    let daRichiesta = null
    if (r) {
      const { natoIl, natoA, codiceFiscale, indirizzo, cap, comune, genitoreNome, genitoreCognome, genitoreCodiceFiscale } = r
      const dati = Object.fromEntries(
        Object.entries({ natoIl, natoA, codiceFiscale, indirizzo, cap, comune, genitoreNome, genitoreCognome, genitoreCodiceFiscale }).filter(([, v]) => v),
      ) as Anagrafica
      daRichiesta = { dati, da: 'modulo' as const, quando: r.gestitaIl ?? r.creataIl }
    }
    const vince = daRichiesta && daSegreteria ? (daSegreteria.quando >= daRichiesta.quando ? daSegreteria : daRichiesta) : (daSegreteria ?? daRichiesta)
    return vince && { dati: vince.dati, da: vince.da }
  }

  const cambiaLezione = (id: string, f: (l: LezioneProva) => LezioneProva | null) => {
    const nuova = f({ ...(a().lezioni[id] ?? {}) })
    const lezioni = { ...a().lezioni }
    // Una voce vuota resta: dice che la lezione è stata toccata (vedi `giaCreata`).
    if (nuova) lezioni[id] = nuova
    else delete lezioni[id]
    a().lezioni = lezioni
  }

  /** Le presenze più vecchie del periodo scelto in REGOLE: coppie lezione, persona. */
  const scriviImpostazioni = (i: Partial<Impostazioni>) => {
    a().impostazioni = { ...(a().impostazioni ?? { mesiPresenze: 24, giorniCalendario: 60 }), ...i }
    // Conta la prima volta: riscrivendo le date il passato non torna a nascere.
    const { inizioCorsi, fineCorsi } = a().impostazioni ?? {}
    if (!inizioCorsi && !fineCorsi) delete a().dateCorsiDal
    else a().dateCorsiDal ??= oggi()
    salva()
  }

  /**
   * Come `salva_date_corsi`: da domani, le lezioni da ricorrenza fuori dalle
   * date se ne vanno con quel che hanno sopra, tranne appello e prove. Con
   * `soloContare` si dice soltanto cosa succederebbe.
   */
  const dateCorsi = (inizio: string | null, fine: string | null, soloContare: boolean): EsitoDate => {
    const domani = new Date()
    domani.setHours(0, 0, 0, 0)
    domani.setDate(domani.getDate() + 1)
    const ultimo = a().corsi.flatMap((c) => c.ricorrenze.map((r) => r.al ?? STAGIONE.al)).sort().at(-1) ?? STAGIONE.al
    const fuori = lezioniFra(domani, new Date(`${ultimo}T12:00:00`)).filter((l) => {
      const g = chiaveGiorno(l.inizio)
      return !l.straordinaria && ((!!inizio && g < inizio) || (!!fine && g > fine))
    })
    const tiene = (id: string) => Object.keys(memoria.segnate[id] ?? {}).length > 0 || !!a().prove?.some((p) => p.sessioneId === id)
    const tenute = fuori.filter((l) => tiene(l.id))
    if (!soloContare) {
      scriviImpostazioni({ inizioCorsi: inizio, fineCorsi: fine })
      const via = new Set(fuori.filter((l) => !tiene(l.id)).map((l) => l.id))
      const resta = <T,>(x: Record<string, T>) => Object.fromEntries(Object.entries(x).filter(([id]) => !via.has(id)))
      a().lezioni = resta(a().lezioni)
      a().presenzeIstruttori = (a().presenzeIstruttori ?? []).filter((p) => !via.has(p.sessioneId))
      memoria.segnate = resta(memoria.segnate)
      memoria.origini = resta(memoria.origini)
      salva()
      memoria.salva()
    }
    const giorni = tenute.map((l) => chiaveGiorno(l.inizio))
    return {
      tolte: fuori.length - tenute.length,
      restano: tenute.length,
      prima: giorni[0] ?? null,
      ultima: giorni.at(-1) ?? null,
      rimaste: tenute.slice(0, 3).map((l) => ({ corso: l.corso.nome, inizio: l.inizio.toISOString() })),
    }
  }

  const scadute = (mesi = a().impostazioni?.mesiPresenze ?? 24) => {
    const limite = new Date()
    limite.setMonth(limite.getMonth() - mesi)
    return Object.entries(memoria.segnate).flatMap(([id, segni]) => {
      const l = trovaLezione(id)
      return l && l.inizio < limite ? Object.keys(segni).map((p) => [id, p] as const) : []
    })
  }

  const conti = (id: string) => {
    const segni = Object.values(memoria.segnate[id] ?? {})
    return { presenti: segni.filter((s) => s === 'presente').length, segnati: segni.length }
  }

  const vista = (l: LezioneTrovata): LezioneSeg => {
    const k = comeE(l)
    const c = conti(l.id)
    return {
      id: l.id,
      corsoId: l.corso.id,
      corso: l.corso.nome,
      colore: l.corso.colore,
      salaId: k.sala,
      sala: k.sala,
      sostitutoId: k.sostituto,
      istruttori: k.istruttori.map(nomeIstruttore).join(', '),
      inizio: l.inizio.toISOString(),
      fine: l.fine.toISOString(),
      stato: k.stato,
      straordinaria: l.straordinaria,
      attivitaId: attivitaDi(l) ?? undefined,
      attivita: nomeAttivita(attivitaDi(l)),
      attivitaCambiata: attivitaCambiata({ attivitaId: attivitaDi(l), straordinaria: l.straordinaria, inizio: l.inizio.toISOString(), segnati: c.segnati }, { attivitaId: l.ricorrenza?.attivitaId }),
      iscritti: iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).length,
      capienza: l.corso.capienza,
      ...c,
    }
  }

  return {
    modo: 'prova',

    async sale() {
      return a().sale.map((nome) => ({ id: nome, nome, capienza: a().capienzaSale?.[nome] }))
    },

    async istruttori() {
      return a()
        .persone.filter((p) => insegna(p) && p.attiva)
        .map((p) => ({ id: p.id, nome: nomeDi(p) }))
        .sort((x, y) => x.nome.localeCompare(y.nome, 'it'))
    },

    async settimana(da, fino) {
      return lezioniFra(da, fino).map(vista)
    },

    async giorniConLezioni(da, fino) {
      return [...giorniConLezioni(lezioniFra(da, fino).map((l) => l.inizio.toISOString()))]
    },

    async aggiornaLezione(sessioneId, cambi) {
      const l = trovaLezione(sessioneId)
      if (!l) throw new Error('Lezione inesistente')
      if (cambi.attivitaId && !a().attivita?.some((x) => x.id === cambi.attivitaId)) throw new Error('Attività inesistente')
      cambiaLezione(sessioneId, (x) => {
        if (cambi.stato) x.stato = cambi.stato === 'prevista' ? undefined : cambi.stato
        // «Come da corso» vuol dire nessuna decisione a mano.
        if (cambi.sostitutoId !== undefined) x.istruttore = cambi.sostitutoId && !l.corso.istruttori.includes(cambi.sostitutoId) ? cambi.sostitutoId : undefined
        if (cambi.salaId !== undefined) x.sala = cambi.salaId && cambi.salaId !== salaDelGiorno(l) ? cambi.salaId : undefined
        // `null` è «nessuna attività», una scelta: va tenuta, non tolta come un valore vuoto.
        if (cambi.attivitaId !== undefined) x.attivitaId = cambi.attivitaId
        for (const k of Object.keys(x) as Array<keyof LezioneProva>) if (x[k] === undefined) delete x[k]
        return x
      })
      salva()
    },

    async attivitaComeIlGiorno(sessioneId) {
      const l = trovaLezione(sessioneId)
      if (!l) throw new Error('Lezione inesistente')
      cambiaLezione(sessioneId, (x) => {
        delete x.attivitaId
        return x
      })
      salva()
    },

    async straordinaria(corsoId, inizio, durata) {
      corso(corsoId)
      const id = `x@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      cambiaLezione(id, () => ({ straordinaria: { corsoId, inizio: inizio.toISOString(), durata } }))
      salva()
    },

    async togliLezione(sessioneId) {
      if (!a().lezioni[sessioneId]?.straordinaria) throw new Error('Si tolgono solo le lezioni straordinarie: le altre si annullano')
      if (conti(sessioneId).segnati) throw new Error("Ha già un appello: si annulla invece di toglierla")
      cambiaLezione(sessioneId, () => null)
      salva()
    },

    async prontoFino() {
      const fini = a().corsi.filter((c) => c.attivo).flatMap((c) => c.ricorrenze.map((r) => r.al ?? STAGIONE.al))
      const ultima = fini.sort().at(-1)
      if (!ultima) return null
      // Oltre la fine dei corsi il database non crea lezioni.
      const fine = a().impostazioni?.fineCorsi
      return fine && fine < ultima ? fine : ultima
    },

    async rigenera() {
      return 0
    },

    async corsi() {
      const g = oggi()
      return a().corsi.map(
        (c): CorsoSeg => ({
          id: c.id,
          nome: c.nome,
          colore: c.colore,
          salaId: c.sala,
          sala: c.sala,
          istruttori: c.istruttori.map((id) => ({ id, nome: nomeIstruttore(id) })),
          capienza: c.capienza,
          attivo: c.attivo,
          enteTessera: c.enteTessera,
          ricorrenze: c.ricorrenze
            .filter((r) => !r.al || r.al >= g)
            .map(({ sala, ...r }) => ({ ...r, salaId: sala, sala, attivita: nomeAttivita(r.attivitaId ?? null) }))
            .sort((x, y) => ((x.giorno + 6) % 7) - ((y.giorno + 6) % 7) || x.ora.localeCompare(y.ora)),
        }),
      )
    },

    async salvaCorso(dati) {
      if (!dati.nome.trim()) throw new Error('Il corso ha bisogno di un nome')
      if (!dati.id) {
        const base = dati.nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'corso'
        const id = a().corsi.some((c) => c.id === base) ? `${base}-${unico()}` : base
        a().corsi = [
          ...a().corsi,
          { id, nome: dati.nome.trim(), colore: dati.colore ?? '#1b8ac4', sala: dati.salaId ?? a().sale[0], istruttori: dati.istruttori, capienza: dati.capienza, attivo: true, enteTessera: enteDaDati(dati.enteTessera), ricorrenze: [] },
        ]
        salva()
        return id
      }
      const c = corso(dati.id)
      a().corsi = a().corsi.map((x) =>
        x.id === c.id
          ? {
              ...x,
              nome: dati.nome.trim(),
              sala: dati.salaId ?? x.sala,
              istruttori: dati.istruttori,
              capienza: dati.capienza,
              colore: dati.colore ?? x.colore,
              enteTessera: enteDaDati(dati.enteTessera),
              // Un giorno che ora sarebbe nella sala del corso torna a seguirlo, come nel database.
              ricorrenze: x.ricorrenze.map(({ sala, ...r }) => (sala && sala !== (dati.salaId ?? x.sala) ? { ...r, sala } : r)),
            }
          : x,
      )
      // Le lezioni che erano state spostate proprio nella sala in cui ora
      // andrebbero da sé, o date a chi ora insegna il corso, tornano «come da corso».
      for (const [id, l] of Object.entries(a().lezioni)) {
        if (!id.startsWith(`s@${c.id}@`) && l.straordinaria?.corsoId !== c.id) continue
        const t = trovaLezione(id)
        cambiaLezione(id, (x) => {
          if (t && x.sala === salaDelGiorno(t)) delete x.sala
          if (x.istruttore && dati.istruttori.includes(x.istruttore)) delete x.istruttore
          return x
        })
      }
      salva()
      return c.id
    },

    async archiviaCorso(corsoId, attivo) {
      corso(corsoId)
      a().corsi = a().corsi.map((c) => (c.id === corsoId ? { ...c, attivo } : c))
      salva()
    },

    async aggiungiRicorrenza(corsoId, r, _opzioni) {
      const c = corso(corsoId)
      if (c.ricorrenze.some((x) => x.giorno === r.giorno && x.ora === r.ora && (!x.al || x.al >= oggi()))) {
        throw new Error('Questo corso ha già una lezione quel giorno a quell’ora')
      }
      const base = idRicorrenza(c.id, r.giorno, r.ora)
      const id = c.ricorrenze.some((x) => x.id === base) ? `${base}~${unico()}` : base
      const dal = oggi() > STAGIONE.dal ? oggi() : STAGIONE.dal
      const nuova = { id, giorno: r.giorno, ora: r.ora, durata: r.durata, dal, al: STAGIONE.al, ...(r.salaId && r.salaId !== c.sala ? { sala: r.salaId } : {}), ...(r.attivitaId ? { attivitaId: r.attivitaId } : {}) }
      a().corsi = a().corsi.map((x) => (x.id === c.id ? { ...x, ricorrenze: [...x.ricorrenze, nuova] } : x))
      salva()
    },

    async salaRicorrenza(ricorrenzaId, salaId) {
      const c = a().corsi.find((x) => x.ricorrenze.some((r) => r.id === ricorrenzaId))
      if (!c) throw new Error('Ricorrenza inesistente')
      if (salaId && !a().sale.includes(salaId)) throw new Error('Sala inesistente')
      // La sala del corso non si scrive sul giorno: così, se il corso cambia sala, il giorno lo segue.
      const sala = salaId && salaId !== c.sala ? salaId : undefined
      a().corsi = a().corsi.map((x) =>
        x.id !== c.id
          ? x
          : {
              ...x,
              ricorrenze: x.ricorrenze.map((r) => {
                if (r.id !== ricorrenzaId) return r
                const { sala: _vecchia, ...resto } = r
                return sala ? { ...resto, sala } : resto
              }),
            },
      )
      // Le lezioni future spostate a mano proprio nella sala nuova non sono più un'eccezione.
      const adesso = Date.now()
      for (const id of Object.keys(a().lezioni)) {
        const t = id.startsWith(`s@${c.id}@`) ? trovaLezione(id) : null
        if (!t || t.ricorrenza?.id !== ricorrenzaId || t.inizio.getTime() <= adesso) continue
        cambiaLezione(id, (x) => {
          if (x.sala === salaDelGiorno(t)) delete x.sala
          return x
        })
      }
      salva()
    },

    async attivitaRicorrenza(ricorrenzaId, attivitaId) {
      const c = a().corsi.find((x) => x.ricorrenze.some((r) => r.id === ricorrenzaId))
      const giorno = c?.ricorrenze.find((r) => r.id === ricorrenzaId)
      if (!c || !giorno) throw new Error('Ricorrenza inesistente')
      if (attivitaId && !a().attivita?.some((x) => x.id === attivitaId)) throw new Error('Attività inesistente')
      const prima = giorno.attivitaId ?? null
      // Come il trigger del database: le future senza appello né prove, con ancora quella di prima, seguono il giorno;
      // le altre (passate, con un appello) tengono quella di prima.
      const mie = lezioniFra(new Date(`${giorno.dal}T00:00`), new Date(`${giorno.al ?? STAGIONE.al}T00:00`)).filter((l) => l.ricorrenza?.id === ricorrenzaId)
      const seguono = new Set(
        lezioniCheSeguonoIlGiorno(
          mie.map((l) => ({
            id: l.id,
            inizio: l.inizio.toISOString(),
            attivitaId: attivitaDi(l),
            segnati: Object.keys(memoria.segnate[l.id] ?? {}).length,
            prove: (a().prove ?? []).filter((p) => p.sessioneId === l.id).length,
          })),
          prima,
          new Date(),
        ),
      )
      for (const l of mie) {
        if (seguono.has(l.id)) cambiaLezione(l.id, (x) => (delete x.attivitaId, x))
        else if (attivitaDi(l) === prima && a().lezioni[l.id]?.attivitaId === undefined) cambiaLezione(l.id, (x) => ({ ...x, attivitaId: prima }))
      }
      a().corsi = a().corsi.map((x) =>
        x.id !== c.id
          ? x
          : { ...x, ricorrenze: x.ricorrenze.map((r) => {
                if (r.id !== ricorrenzaId) return r
                const { attivitaId: _vecchia, ...resto } = r
                return attivitaId ? { ...resto, attivitaId } : resto
              }),
            },
      )
      salva()
    },

    async attivita() {
      // Sul database ogni lezione è una riga, e conta chi ha quell'attività: qui si calcolano.
      const lezioni = lezioniFra(new Date(`${STAGIONE.dal}T00:00`), new Date(`${STAGIONE.al}T00:00`))
      return {
        elenco: ordinaAttivita(a().attivita ?? []).map((x) => ({
          ...x,
          giorni: a().corsi.flatMap((c) => c.ricorrenze).filter((r) => r.attivitaId === x.id).length,
          lezioni: lezioni.filter((l) => attivitaDi(l) === x.id).length,
        })),
      }
    },

    async salvaAttivita({ id, nome }) {
      const elenco = a().attivita ?? []
      const guaio = cosaNonVaAttivita(nome, elenco, id)
      if (guaio) throw new Error(guaio)
      if (id) {
        if (!elenco.some((x) => x.id === id)) throw new Error('Attività inesistente')
        a().attivita = elenco.map((x) => (x.id === id ? { ...x, nome: nome.trim() } : x))
        salva()
        return id
      }
      const nuovo = `at-${unico()}`
      a().attivita = [...elenco, { id: nuovo, nome: nome.trim(), attiva: true }]
      salva()
      return nuovo
    },

    async attivaAttivita(id, attiva) {
      a().attivita = (a().attivita ?? []).map((x) => (x.id === id ? { ...x, attiva } : x))
      salva()
    },

    async eliminaAttivita(id) {
      const { giorni, lezioni } = (await this.attivita()).elenco.find((x) => x.id === id) ?? { giorni: 0, lezioni: 0 }
      const motivo = motivoAttivitaUsata(giorni, lezioni)
      if (motivo) throw new Error(motivo)
      a().attivita = (a().attivita ?? []).filter((x) => x.id !== id)
      salva()
    },

    async togliRicorrenza(ricorrenzaId) {
      const c = a().corsi.find((x) => x.ricorrenze.some((r) => r.id === ricorrenzaId))
      if (!c) throw new Error('Ricorrenza inesistente')
      const g = oggi()
      a().corsi = a().corsi.map((x) =>
        x.id !== c.id
          ? x
          : {
              ...x,
              ricorrenze: x.ricorrenze
                // Non ancora cominciata: sparisce. Cominciata: si chiude a ieri.
                .filter((r) => r.id !== ricorrenzaId || r.dal < g)
                .map((r) => (r.id === ricorrenzaId ? { ...r, al: ieri() < r.dal ? r.dal : ieri() } : r)),
            },
      )
      salva()
    },

    async tessere() {
      return { elenco: [...(a().tessere ?? [])] }
    },

    async importaTessere(righe, soloProva) {
      const schede = a()
        .persone.filter((p) => p.ruolo === 'iscritto')
        .map((p) => ({ personaId: p.id, nome: p.nome, cognome: p.cognome, codiceFiscale: a().anagrafiche?.[p.id]?.codiceFiscale }))
      const { esito, daScrivere } = importaTessereProva(righe, schede, a().tessere ?? [])
      if (!soloProva && daScrivere.length) {
        a().tessere = [...(a().tessere ?? []), ...daScrivere.map((t) => ({ ...t, id: `t-${unico()}` }))]
        salva()
      }
      return { ...esito, scritto: !soloProva }
    },

    async aggiungiTessera(t) {
      const ente = t.ente.trim().toUpperCase()
      if (!ente || !t.codice.trim()) throw new Error('Scrivi l’ente e il numero della tessera')
      // Gli stessi limiti della tabella `tessere`.
      if (ente.length > 40 || t.codice.trim().length > 20 || !/^(20\d\d|2100)-\d{2}-\d{2}$/.test(t.dal)) throw new Error('La tessera ha dei dati che non vanno: controlla ente, numero e data')
      if ((a().tessere ?? []).some((x) => x.personaId === t.personaId && x.ente === ente && x.tipo === t.tipo && x.dal === t.dal)) throw new Error('Questa tessera c’è già')
      a().tessere = [...(a().tessere ?? []), { id: `t-${unico()}`, personaId: t.personaId, ente, tipo: t.tipo, codice: t.codice.trim(), dal: t.dal, al: fineAnno(t.dal), origine: t.origine ?? 'manuale' }]
      salva()
    },

    async togliTessera(id) {
      a().tessere = (a().tessere ?? []).filter((x) => x.id !== id)
      salva()
    },

    async persone() {
      potaCertificati()
      return a()
        .persone.filter((p) => p.ruolo === 'iscritto')
        .map(
          (p): PersonaSeg => ({
            id: p.id,
            nome: p.nome,
            cognome: p.cognome,
            email: p.email,
            emailContatto: p.emailContatto,
            telefono: p.telefono,
            attiva: p.attiva,
            creataIl: p.creataIl,
            iscrizioni: a()
              .iscrizioni.filter((i) => i.personaId === p.id)
              .map((i) => ({ corsoId: i.corsoId, dal: i.dal, al: i.al })),
            certificato: { scade: p.certificato?.scade, conFile: !!p.certificato?.file, vecchio: !!p.certificato?.file && !p.certificato.caricatoIl, caricatoIl: p.certificato?.caricatoIl },
            documento: !!p.documento,
            pagamento: { stato: p.pagamento?.stato ?? 'da_pagare', fino: p.pagamento?.fino, nota: p.pagamento?.nota },
            quote: quoteDi((a().ricevute ?? []).filter((r) => r.personaId === p.id)),
            nucleo: p.nucleo,
            natoIl: anagraficaDi(p.id)?.dati.natoIl,
          }),
        )
    },

    async frequenze() {
      const adesso = Date.now()
      const f = new Map<string, { presenti: number; dovute: number }>()
      for (const l of lezioniFra(new Date(adesso - 30 * GIORNO), new Date(adesso))) {
        if (l.inizio.getTime() >= adesso || comeE(l).stato === 'annullata') continue
        const segni = memoria.segnate[l.id] ?? {}
        for (const p of iscrittiIl(l.corso.id, chiaveGiorno(l.inizio))) {
          const s = segni[p.id]
          if (s === 'giustificato') continue
          const x = f.get(p.id) ?? { presenti: 0, dovute: 0 }
          x.dovute++
          if (s === 'presente') x.presenti++
          f.set(p.id, x)
        }
      }
      return f
    },

    async storico(personaId, quante) {
      const adesso = Date.now()
      const corsi = new Set(a().iscrizioni.filter((i) => i.personaId === personaId).map((i) => i.corsoId))
      const x: StoricoSeg[] = []
      for (const l of lezioniFra(new Date(adesso - 120 * GIORNO), new Date(adesso))) {
        if (!corsi.has(l.corso.id) || l.inizio.getTime() >= adesso || comeE(l).stato === 'annullata') continue
        if (!iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).some((p) => p.id === personaId)) continue
        x.push({ sessioneId: l.id, inizio: l.inizio.toISOString(), corso: l.corso.nome, stato: memoria.segnate[l.id]?.[personaId] ?? null })
      }
      return x.slice(-quante)
    },

    async salvaPersona(dati) {
      const nome = nomeProprio(dati.nome)
      const cognome = nomeProprio(dati.cognome)
      if (!nome || !cognome) throw new Error('Servono nome e cognome')
      const email = dati.email?.trim() || undefined
      const emailContatto = dati.emailContatto?.trim() || undefined
      const telefono = dati.telefono?.trim() || undefined
      // Come l'indice unico del database: due persone, due email; il contatto invece può ripetersi.
      const altro = email && a().persone.find((p) => p.id !== dati.id && p.email?.toLowerCase() === email.toLowerCase())
      if (altro) throw new Error(emailGiaDi(nomeDi(altro)))
      const guaio = contattoNonValido(emailContatto)
      if (guaio) throw new Error(guaio)
      if (!dati.id) {
        const id = `p-nuovo-${unico()}`
        a().persone = [...a().persone, { id, nome, cognome, email, emailContatto, telefono, ruolo: 'iscritto', attiva: true, creataIl: oggi() }]
        salva()
        return id
      }
      persona(dati.id)
      a().persone = a().persone.map((p) => (p.id === dati.id ? { ...p, nome, cognome, email, emailContatto, telefono } : p))
      salva()
      return dati.id
    },

    async attivaPersona(personaId, attiva) {
      persona(personaId)
      // Disattivata, si lascia dietro il file del certificato; la data resta, e riattivarla non lo riporta.
      if (!attiva) scordaCertificato(personaId)
      a().persone = a().persone.map((p) =>
        p.id !== personaId ? p : { ...p, attiva, certificato: !attiva && p.certificato ? { scade: p.certificato.scade, caricatoIl: p.certificato.caricatoIl } : p.certificato },
      )
      salva()
    },

    async salvaCertificato(personaId, scade) {
      persona(personaId)
      const guaio = cosaNonVaScadenza(scade)
      if (guaio) throw new Error(guaio)
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, certificato: { ...p.certificato, scade } } : p))
      salva()
    },

    async caricaCertificato(personaId, file, scade) {
      const guaio = cosaNonVaCertificato(file, scade)
      if (guaio) throw new Error(guaio)
      persona(personaId)
      // Un file per persona: il nuovo prende il posto del vecchio, insieme alla data.
      scordaCertificato(personaId)
      certificatiProva.set(personaId, { url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '', pdf: file.type === 'application/pdf' })
      a().persone = a().persone.map((p) =>
        p.id === personaId ? { ...p, certificato: { scade, file: `${personaId}/certificato-${Date.now()}.${ESTENSIONI[file.type]}`, caricatoIl: oggi() } } : p,
      )
      salva()
    },

    async togliCertificato(personaId) {
      persona(personaId)
      scordaCertificato(personaId)
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, certificato: undefined } : p))
      salva()
    },

    async salvaDocumento(personaId, inSegreteria) {
      persona(personaId)
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, documento: inSegreteria || undefined } : p))
      salva()
    },

    async apriCertificato(personaId) {
      persona(personaId)
      potaCertificati()
      return certificatiProva.get(personaId) ?? null
    },

    async salvaPagamento(personaId, dati) {
      persona(personaId)
      const nota = dati.nota?.trim() || undefined
      if (nota && nota.length > 300) throw new Error('La nota del pagamento è troppo lunga: al massimo 300 caratteri')
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, pagamento: { stato: dati.stato, fino: dati.fino || undefined, nota } } : p))
      salva()
    },

    async segnalate() {
      return segnalateProva()
    },

    async gestisciSegnalata(id, accogli) {
      gestisciSegnalataProva(id, accogli, 'Segreteria di prova')
    },

    // In prova chi usa la segreteria è la segreteria di prova: ogni messaggio è suo.
    async segnalazioni() {
      // Trenta giorni dopo la chiusura gli allegati non ci sono più, come nel database; il testo resta.
      const adesso = new Date().toISOString()
      return (a().segnalazioni ?? []).map((x) => ({
        ...x,
        messaggi: x.messaggi.map((m) => {
          const r = fileProva.get(m.id)
          return r ? { ...m, allegati: allegatiScaduti(x.chiusaIl, adesso) ? [] : r.allegati, tolti: r.tolti } : m
        }),
      }))
    },

    async apriSegnalazione(titolo, testo, categoria, allegati = []) {
      const no = cosaNonVaSegnalazione(testo, titolo, categoria) ?? guaioAllegati(allegati)
      if (no) throw new Error(no)
      const id = `sz-${unico()}`
      const s: Segnalazione = { id, titolo: titolo.trim(), categoria, messaggi: [{ id, autore: 'Segreteria di prova', mio: true, testo: testo.trim(), il: new Date().toISOString() }] }
      a().segnalazioni = [...(a().segnalazioni ?? []), s]
      salva()
      metti(id, allegati)
      return id
    },

    async rispondiSegnalazione(id, testo, allegati = []) {
      const no = cosaNonVaSegnalazione(testo) ?? guaioAllegati(allegati)
      if (no) throw new Error(no)
      const tutte = a().segnalazioni ?? []
      if (!tutte.some((x) => x.id === id)) throw new Error('Segnalazione inesistente')
      const m = { id: `sz-${unico()}`, autore: 'Segreteria di prova', mio: true, testo: testo.trim(), il: new Date().toISOString() }
      a().segnalazioni = tutte.map((x) => (x.id === id ? { ...x, messaggi: [...x.messaggi, m] } : x))
      salva()
      metti(m.id, allegati)
    },

    // In prova la segreteria è una sola e ogni allegato è suo: non c'è da controllare chi l'ha mandato, come fa il database.
    async togliAllegato(id) {
      for (const r of fileProva.values()) {
        if (!r.allegati.some((x) => x.id === id)) continue
        r.allegati = r.allegati.filter((x) => x.id !== id)
        r.tolti.push({ da: 'Segreteria di prova', il: new Date().toISOString() })
        return
      }
      throw new Error('Questo allegato non c\'è più')
    },

    async linkAllegato(id) {
      const f = [...fileProva.values()].flatMap((r) => r.file).find((x) => x.id === id)
      if (!f) throw new Error('Questo allegato non c\'è più')
      return URL.createObjectURL(f.file)
    },

    async chiudiSegnalazione(id, chiusa) {
      a().segnalazioni = (a().segnalazioni ?? []).map((x) => (x.id === id ? { ...x, chiusaIl: chiusa ? new Date().toISOString() : undefined } : x))
      salva()
    },

    async categoriaSegnalazione(id, categoria) {
      // Come il database: solo le due categorie.
      if (!eCategoria(categoria)) throw new Error(SCEGLI)
      a().segnalazioni = (a().segnalazioni ?? []).map((x) => (x.id === id ? { ...x, categoria } : x))
      salva()
    },

    // Il sito: le stesse regole del database, in memoria (vedi `sitoProva.ts`).
    async sitoPagine() {
      const sito = await sitoProva()
      return (a().sito ??= sito.sitoIniziale()).pagine
    },

    async sitoMenu() {
      const sito = await sitoProva()
      const { menu, footer } = (a().sito ??= sito.sitoIniziale())
      return { menu, footer }
    },

    async nuovaPaginaSito(titolo, slug) {
      const sito = await sitoProva()
      const r = sito.nuovaPagina((a().sito ??= sito.sitoIniziale()), titolo, slug)
      a().sito = r.stato
      salva()
      return r.id
    },

    async salvaBozzaSito(id, versione, dati) {
      const sito = await sitoProva()
      const r = sito.salvaBozza((a().sito ??= sito.sitoIniziale()), id, versione, dati)
      a().sito = r.stato
      salva()
      return r.versione
    },

    async pubblicaPaginaSito(id, versione) {
      const sito = await sitoProva()
      const r = sito.pubblica((a().sito ??= sito.sitoIniziale()), id, versione)
      a().sito = r.stato
      salva()
      return r.versione
    },

    async cambiaIndirizzoSito(id, slug) {
      const sito = await sitoProva()
      a().sito = sito.cambiaIndirizzo((a().sito ??= sito.sitoIniziale()), id, slug)
      salva()
    },

    async nascondiPaginaSito(id, nascosta) {
      const sito = await sitoProva()
      a().sito = sito.nascondi((a().sito ??= sito.sitoIniziale()), id, nascosta)
      salva()
    },

    async cancellaPaginaSito(id) {
      const sito = await sitoProva()
      a().sito = sito.cancella((a().sito ??= sito.sitoIniziale()), id)
      salva()
    },

    async salvaMenuSito(dove, voci) {
      const sito = await sitoProva()
      a().sito = sito.salvaMenu((a().sito ??= sito.sitoIniziale()), dove, voci)
      salva()
    },

    async sitoImmagini() {
      return a().sitoImmagini ?? []
    },

    async caricaImmagineSito(file) {
      // In prova niente riduzione (nel canvas non c'è): un file sopra 1 MB si rifiuta, nel database si rimpicciolisce.
      const no = controllaImmagine(file)
      const nome = nomeNelContenitore(crypto.randomUUID(), file.type)
      if (no || !nome) throw new Error(no ?? cosaNonVaImmagini(''))
      // Nel canvas non c'è niente da scaricare: un riquadro grigio col nome fa da immagine.
      const immagine = { nome, url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#444"/><text x="20" y="150" fill="#fff" font-size="16">${nome.slice(0, 8)}</text></svg>`)}` }
      a().sitoImmagini = [immagine, ...(a().sitoImmagini ?? [])]
      salva()
      return immagine
    },

    async cancellaImmagineSito(nome) {
      a().sitoImmagini = (a().sitoImmagini ?? []).filter((x) => x.nome !== nome)
      salva()
    },


    async mettiNelNucleo(personaId, titolareId) {
      const iscritti = a().persone.filter((p) => p.ruolo === 'iscritto')
      const no = cosaNonVaNucleo(iscritti, personaId, titolareId)
      if (no) throw new Error(no)
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, nucleo: titolareId } : p))
      salva()
    },

    async togliDalNucleo(personaId) {
      if (!persona(personaId).nucleo) throw new Error('Non è nel nucleo di nessuno')
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, nucleo: undefined } : p))
      salva()
    },

    async rendiTitolare(personaId) {
      const m = nuovoTitolare(a().persone.filter((p) => p.ruolo === 'iscritto'), personaId)
      if (typeof m === 'string') throw new Error(m)
      a().persone = a().persone.map((p) => (m.has(p.id) ? { ...p, nucleo: m.get(p.id) ?? undefined } : p))
      salva()
    },

    async ricevute(personaId) {
      return (a().ricevute ?? [])
        .filter((r) => !personaId || r.personaId === personaId)
        .sort((x, y) => y.data.localeCompare(x.data) || y.anno - x.anno || y.numero - x.numero)
    },

    async prossimoNumero(anno) {
      return Math.max(0, ...(a().ricevute ?? []).filter((r) => r.anno === anno).map((r) => r.numero)) + 1
    },

    async intestatarioDi(personaId) {
      const p = persona(personaId)
      const ultima = (a().ricevute ?? [])
        .filter((r) => r.personaId === personaId)
        // Fatte nello stesso millesimo (le prove), l'ultima è quella col numero dopo.
        .sort((x, y) => y.creataIl.localeCompare(x.creataIl) || y.anno - x.anno || y.numero - x.numero)[0]
      return intestatarioDa(ultima?.intestatario ?? null, anagraficaDi(personaId)?.dati ?? null, p)
    },

    async anagraficaDi(personaId) {
      persona(personaId)
      return anagraficaDi(personaId)
    },

    async salvaAnagrafica(personaId, dati, sostituisci) {
      persona(personaId)
      const nuovi = pulisciAnagrafica(dati)
      const no = cosaNonVaAnagrafica(nuovi)
      if (no) throw new Error(no)
      if (!sostituisci && Object.keys(nuovi).length === 0) return
      const prima = sostituisci ? {} : a().anagrafiche?.[personaId]
      a().anagrafiche = { ...a().anagrafiche, [personaId]: { ...prima, ...nuovi, cambiataIl: new Date().toISOString() } }
      salva()
    },

    async emettiRicevuta(dati) {
      if (dati.personaId) persona(dati.personaId)
      const r = { ...dati, intestatario: pulisciIntestatario(dati.intestatario), note: dati.note?.trim() || undefined }
      const no = cosaNonVa(r)
      if (no) throw new Error(no)
      if (r.note && r.note.length > 500) throw new Error('La nota è troppo lunga: al massimo 500 caratteri')
      const anno = Number(r.data.slice(0, 4))
      const tutte = a().ricevute ?? []
      // Come `emetti_ricevuta`: il numero dato, se è libero; se no il primo dopo l'ultimo.
      if (r.numero && tutte.some((x) => x.anno === anno && x.numero === r.numero))
        throw new Error(`La ricevuta numero ${r.numero} del ${anno} c’è già: lascia il numero vuoto per il primo libero`)
      const numero = r.numero ?? Math.max(0, ...tutte.filter((x) => x.anno === anno).map((x) => x.numero)) + 1
      const voci = r.voci.map((v) => ({ ...v, descrizione: v.descrizione.trim(), pagamenti: v.pagamenti.filter((p) => p.importo > 0) }))
      const c = contiRicevuta({ voci, anticipo: r.anticipo })
      const { numero: _n, ...resto } = r
      const nuova: Ricevuta = { ...resto, voci, id: `r-${unico()}`, anno, numero, totale: c.totale, pagato: c.pagato, creataIl: new Date().toISOString() }
      a().ricevute = [...tutte, nuova]
      salva()
      return nuova
    },

    async annullaRicevuta(id) {
      const r = (a().ricevute ?? []).find((x) => x.id === id)
      if (!r || r.annullataIl) throw new Error('Ricevuta inesistente o già annullata')
      a().ricevute = (a().ricevute ?? []).map((x) => (x.id === id ? { ...x, annullataIl: new Date().toISOString() } : x))
      salva()
    },

    async pagamentiDiretti(personaId) {
      return (a().pagamentiDiretti ?? [])
        .filter((x) => !personaId || x.personaId === personaId)
        .sort((x, y) => y.data.localeCompare(x.data) || y.creatoIl.localeCompare(x.creatoIl))
    },

    async nomiPersone(ids) {
      return a()
        .persone.filter((p) => ids.includes(p.id))
        .map(({ id, nome, cognome }) => ({ id, nome, cognome }))
    },

    async cercaPagatori(scritto) {
      return trovaPagatori(a().persone, scritto)
    },

    async casse() {
      return contabilita().casse.map((c) => ({ ...c }))
    },

    async voci() {
      return contabilita().voci.map((v) => ({ ...v }))
    },

    async movimenti() {
      return contabilita().movimenti.map((m) => ({ ...m }))
    },

    async salvaVoce(d) {
      const no = cosaNonVaVoce(d.nome, d.tipo, contabilita().voci)
      if (no) throw new Error(no)
      const id = `v-${unico()}`
      a().voci = [...contabilita().voci, { id, nome: d.nome.trim(), tipo: d.tipo, diSistema: false, attiva: true }]
      salva()
      return id
    },

    async rinominaVoce(id, nome) {
      const voce = contabilita().voci.find((v) => v.id === id)
      if (!voce) throw new Error('La voce non c’è')
      if (voce.diSistema) throw new Error('Le voci di sistema non si cambiano')
      const no = cosaNonVaVoce(nome, voce.tipo, contabilita().voci.filter((v) => v.id !== id))
      if (no) throw new Error(no)
      a().voci = contabilita().voci.map((v) => (v.id === id ? { ...v, nome: nome.trim() } : v))
      salva()
    },

    async attivaVoce(id, attiva) {
      const voce = contabilita().voci.find((v) => v.id === id)
      if (!voce) throw new Error('La voce non c’è')
      if (voce.diSistema) throw new Error('Le voci di sistema non si cambiano')
      a().voci = contabilita().voci.map((v) => (v.id === id ? { ...v, attiva } : v))
      salva()
    },

    async salvaSaldoCassa(id, saldo, dal) {
      if (!contabilita().casse.some((c) => c.id === id)) throw new Error('La cassa non c’è')
      const manuali = righeMovimenti([], contabilita().movimenti, contabilita().voci)
      const chiusa = contabilita().chiusure.some((k) => k.cassaId === id && !k.annullataIl)
      const no = cosaNonVaSaldo(saldo, dal, { oggi: oggiARoma(), primoMovimento: primoMovimentoManuale(manuali, id), chiusa })
      if (no) throw new Error(no)
      a().casse = contabilita().casse.map((c) => {
        if (c.id !== id) return c
        const { dal: _vecchia, ...resto } = c
        return { ...resto, saldoIniziale: saldo, ...(dal ? { dal } : {}) }
      })
      salva()
    },

    async registraMovimento(d) {
      const { voci, casse, chiusure } = contabilita()
      const no = cosaNonVaMovimento(d, voci, casse, oggiARoma(), chiusure)
      if (no) throw new Error(no)
      const id = `m-${unico()}`
      a().movimenti = [
        ...contabilita().movimenti,
        { id, tipo: d.tipo, data: d.data, importo: d.importo, voceId: d.voceId, cassaId: d.cassaId, descrizione: d.descrizione.trim(), ...(d.nota?.trim() ? { nota: d.nota.trim() } : {}), creatoIl: new Date().toISOString() },
      ]
      salva()
      return id
    },

    async registraGiroconto(d) {
      const { casse, chiusure } = contabilita()
      const no = cosaNonVaGiroconto(d, casse, oggiARoma(), chiusure)
      if (no) throw new Error(no)
      const nome = (id: string) => casse.find((c) => c.id === id)?.nome ?? ''
      const id = `m-${unico()}`
      a().movimenti = [
        ...contabilita().movimenti,
        { id, tipo: 'giroconto', data: d.data, importo: d.importo, cassaId: d.daCassaId, cassaAId: d.aCassaId, descrizione: `Giroconto da ${nome(d.daCassaId)} a ${nome(d.aCassaId)}`, ...(d.nota?.trim() ? { nota: d.nota.trim() } : {}), creatoIl: new Date().toISOString() },
      ]
      salva()
      return id
    },

    async annullaMovimento(id) {
      const m = contabilita().movimenti.find((x) => x.id === id)
      if (!m) throw new Error('Il movimento non c’è')
      if (m.annullatoIl) throw new Error('Il movimento è già annullato')
      const chiuso = cosaNonVaAnnulloMovimento(righeMovimenti([], [m], contabilita().voci)[0], contabilita().chiusure)
      if (chiuso) throw new Error(chiuso)
      a().movimenti = contabilita().movimenti.map((x) => (x.id === id ? { ...x, annullatoIl: new Date().toISOString() } : x))
      salva()
    },

    async chiusure() {
      return contabilita().chiusure.map((k) => ({ ...k }))
    },

    async chiudiCassa(d) {
      const { casse, voci, movimenti, chiusure } = contabilita()
      const no = cosaNonVaChiusura(d, casse, chiusure, oggiARoma())
      if (no) throw new Error(no)
      const cassa = casse.find((c) => c.id === d.cassaId)
      if (!cassa) throw new Error('Scegli la cassa')
      const nota = d.nota?.trim() || undefined
      // Gli incassi in contanti si ricavano da ricevute e pagamenti a mano, come nell'elenco della schermata.
      const elenco = elencoMovimenti(a().ricevute ?? [], a().pagamentiDiretti ?? [], [], casse, movimenti, voci)
      const previsto = previstoCassa(casse, elenco, cassa.id, d.data)
      const troppo = cosaNonVaPrevisto(previsto, d.contato)
      if (troppo) throw new Error(troppo)
      const differenza = d.contato - previsto
      let movimentoId: string | undefined
      if (differenza !== 0) {
        const tipo = differenza > 0 ? 'entrata' : 'uscita'
        const voce = voci.find((v) => v.nome === VOCE_DIFFERENZA && v.tipo === tipo)
        movimentoId = `m-${unico()}`
        a().movimenti = [
          ...movimenti,
          { id: movimentoId, tipo, data: d.data, importo: Math.abs(differenza), voceId: voce?.id, cassaId: cassa.id, descrizione: VOCE_DIFFERENZA, ...(nota ? { nota } : {}), creatoIl: new Date().toISOString() },
        ]
      }
      const ultima = ultimaChiusura(chiusure, cassa.id)
      const id = `k-${unico()}`
      a().chiusure = [
        ...chiusure,
        {
          id,
          cassaId: cassa.id,
          dal: dalDellaChiusura(cassa, ultima),
          data: d.data,
          previsto,
          contato: d.contato,
          differenza,
          ...(nota ? { nota } : {}),
          ...(movimentoId ? { movimentoId } : {}),
          chiusaDa: 'Amministrazione',
          chiusaIl: new Date().toISOString(),
        },
      ]
      salva()
      return id
    },

    async annullaChiusuraCassa(id) {
      const { chiusure, movimenti } = contabilita()
      const no = cosaNonVaAnnulloChiusura(id, chiusure)
      if (no) throw new Error(no)
      const adesso = new Date().toISOString()
      const k = chiusure.find((x) => x.id === id)
      a().chiusure = chiusure.map((x) => (x.id === id ? { ...x, annullataIl: adesso, annullataDa: 'Amministrazione' } : x))
      if (k?.movimentoId) a().movimenti = movimenti.map((x) => (x.id === k.movimentoId ? { ...x, annullatoIl: adesso } : x))
      salva()
    },

    async correggiTestoMovimento(id, descrizione, nota) {
      const m = contabilita().movimenti.find((x) => x.id === id)
      if (!m) throw new Error('Il movimento non c’è')
      if (m.annullatoIl) throw new Error('Un movimento annullato non si corregge')
      const testo = descrizione.trim()
      if (!testo) throw new Error('Scrivi una descrizione')
      if (testo.length > 200) throw new Error('La descrizione è troppo lunga: al massimo 200 caratteri')
      if ((nota?.trim() ?? '').length > 300) throw new Error('La nota è troppo lunga: al massimo 300 caratteri')
      const { nota: _vecchia, ...resto } = m
      a().movimenti = contabilita().movimenti.map((x) => (x.id === id ? { ...resto, descrizione: testo, ...(nota?.trim() ? { nota: nota.trim() } : {}) } : x))
      salva()
    },

    async registraPagamentoDiretto(dati) {
      // Prima la persona, poi il resto: come `registra_pagamento_diretto`.
      if (dati.personaId && !a().persone.some((x) => x.id === dati.personaId)) throw new Error('Questa scheda non c’è più')
      const no = cosaNonVaDiretto(dati)
      if (no) throw new Error(no)
      const nuovo: PagamentoDiretto = { ...dati, metodo: dati.metodo.trim(), voce: dati.voce.trim(), nota: dati.nota?.trim() || undefined, id: `pd-${unico()}`, creatoIl: new Date().toISOString() }
      a().pagamentiDiretti = [...(a().pagamentiDiretti ?? []), nuovo]
      salva()
      return nuovo
    },

    async annullaPagamentoDiretto(id) {
      const x = (a().pagamentiDiretti ?? []).find((y) => y.id === id)
      if (!x || x.annullatoIl) throw new Error('Pagamento inesistente o già annullato')
      a().pagamentiDiretti = (a().pagamentiDiretti ?? []).map((y) => (y.id === id ? { ...y, annullatoIl: new Date().toISOString() } : y))
      salva()
    },

    async enteRicevute() {
      return { ...ENTE_PREDEFINITO, ...(a().enteRicevute ?? {}) }
    },

    async salvaEnteRicevute(e) {
      a().enteRicevute = e
      salva()
    },

    async listino() {
      const l = listinoDa(listinoProva())
      return l ? { listino: l, cambiato: true } : { listino: LISTINO_PREDEFINITO, cambiato: false }
    },

    async salvaListino(l) {
      const elenco = await this.corsi()
      const pronto = l && agganciaPerNome(l, elenco)
      const guaio = pronto && cosaNonVaListino(pronto, elenco)
      if (guaio) throw new Error(guaio)
      salvaListinoProva(pronto)
    },

    async iscrivi(personaId, corsoId, dal) {
      persona(personaId)
      corso(corsoId)
      const g = oggi()
      const c = a().iscrizioni.find((i) => i.personaId === personaId && i.corsoId === corsoId)
      if (c && !c.al) return
      // Terminata oggi o più avanti: si toglie solo la fine (vedi Supabase).
      if (c && c.al && c.al >= g) {
        a().iscrizioni = a().iscrizioni.map((i) => (i === c ? { ...i, al: undefined } : i))
        salva()
        return
      }
      // Una sola iscrizione per corso, come nel database: chi torna riparte da oggi.
      a().iscrizioni = [...a().iscrizioni.filter((i) => i !== c), { corsoId, personaId, dal: dal ?? g }]
      salva()
    },

    async termina(personaId, corsoId) {
      const g = oggi()
      a().iscrizioni = a().iscrizioni.map((i) =>
        i.personaId === personaId && i.corsoId === corsoId ? { ...i, al: i.dal > g ? i.dal : g } : i,
      )
      salva()
    },
    async registro(da, fino) {
      const adesso = Date.now()
      return lezioniFra(da, fino)
        .filter((l) => l.inizio.getTime() < adesso)
        .map((l): RigaRegistro => {
          const k = comeE(l)
          const segni = memoria.segnate[l.id] ?? {}
          return {
            sessioneId: l.id,
            corsoId: l.corso.id,
            corso: l.corso.nome,
            sala: k.sala,
            istruttori: k.istruttori.map(nomeIstruttore).join(', '),
            inizio: l.inizio.toISOString(),
            stato: k.stato,
            appello: iscrittiIl(l.corso.id, chiaveGiorno(l.inizio)).map((p) => ({ personaId: p.id, nome: p.nome, cognome: p.cognome, stato: segni[p.id] ?? null })),
          }
        })
    },

    async prove(da, fino) {
      const dal = da.getTime()
      const al = new Date(fino).setHours(23, 59, 59, 999)
      const persone = new Map(a().persone.map((p) => [p.id, p]))
      const g = oggi()
      return (a().prove ?? [])
        .map((x): ProvaSeg | null => {
          const l = trovaLezione(x.sessioneId)
          const p = persone.get(x.personaId)
          if (!l || !p || l.inizio.getTime() < dal || l.inizio.getTime() > al) return null
          return {
            sessioneId: x.sessioneId,
            personaId: p.id,
            nome: p.nome,
            cognome: p.cognome,
            telefono: p.telefono,
            corsoId: l.corso.id,
            corso: l.corso.nome,
            inizio: l.inizio.toISOString(),
            da: x.da ? persone.get(x.da)?.nome : undefined,
            iscritto: a().iscrizioni.some((i) => i.personaId === p.id && i.dal <= g && (!i.al || i.al >= g)),
          }
        })
        .filter((x): x is ProvaSeg => !!x)
        .sort((p, q) => q.inizio.localeCompare(p.inizio))
    },

    async statistiche(da, fino): Promise<Statistiche> {
      const adesso = Date.now()
      const al = new Date(fino)
      al.setHours(23, 59, 59, 999)
      const lezioni = lezioniFra(da, fino)
        .filter((l) => l.inizio.getTime() < adesso)
        .map((l) => {
          const k = comeE(l)
          const segni = memoria.segnate[l.id] ?? {}
          const appello = iscrittiIl(l.corso.id, chiaveGiorno(l.inizio))
          const g = chiaveGiorno(l.inizio)
          const conta = (stato: string) => appello.filter((p) => segni[p.id] === stato).length
          // Come il database: presenti senza essere iscritti quel giorno (anche da disattivati), che in sala c'erano.
          const iscritto = (id: string) => a().iscrizioni.some((i) => i.corsoId === l.corso.id && i.personaId === id && i.dal <= g && (!i.al || i.al >= g))
          const fuori = Object.entries(segni).filter(([id, s]) => s === 'presente' && !iscritto(id)).length
          return {
            sessioneId: l.id,
            corsoId: l.corso.id,
            corso: l.corso.nome,
            colore: l.corso.colore,
            capienza: l.corso.capienza,
            sala: k.sala,
            inizio: l.inizio.toISOString(),
            stato: k.stato,
            istruttori: k.istruttori.map(nomeIstruttore),
            sostituto: !!k.sostituto && !l.corso.istruttori.includes(k.sostituto),
            iscritti: appello.length,
            presenti: conta('presente'),
            assenti: conta('assente'),
            giustificati: conta('giustificato'),
            prove: fuori,
          }
        })
      const mesi = new Map<string, { ricevute: number; totale: number; pagato: number }>()
      const dal = chiaveGiorno(da)
      const finoA = chiaveGiorno(al)
      for (const r of a().ricevute ?? []) {
        if (r.annullataIl || r.data < dal || r.data > finoA) continue
        const m = mesi.get(r.data.slice(0, 7)) ?? { ricevute: 0, totale: 0, pagato: 0 }
        m.ricevute++
        m.totale += r.totale
        m.pagato += r.pagato
        mesi.set(r.data.slice(0, 7), m)
      }
      const incassi = [...mesi.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([mese, m]) => ({ mese, ...m }))
      return { lezioni, incassi }
    },

    async personale() {
      const pin = { ...Object.fromEntries(Object.values(PIN_PROVA).map((x) => [x.personaId, true])), ...a().pin }
      return a()
        .persone.filter((p) => p.ruolo !== 'iscritto')
        .map(
          (p): PersonaleSeg => ({
            id: p.id,
            nome: p.nome,
            cognome: p.cognome,
            email: p.email,
            ruolo: p.ruolo as 'istruttore' | 'staff' | 'amministrazione',
            ...segniDi(p.ruolo, p.ancheIstruttore, p.ancheAmministrazione),
            attiva: p.attiva,
            // In prova è entrata solo la segreteria di prova: gli altri aspettano l'invito.
            collegato: p.id === 's-prova',
            haPin: !!pin[p.id],
            corsi: a().corsi.filter((c) => c.attivo && c.istruttori.includes(p.id)).map((c) => c.nome),
            kanji: p.kanji,
          }),
        )
    },

    async salvaPersonale(dati) {
      const nome = nomeProprio(dati.nome)
      const cognome = nomeProprio(dati.cognome)
      const email = dati.email?.trim() || undefined
      if (!nome) throw new Error('Serve almeno il nome')
      const altro = email && a().persone.find((p) => p.id !== dati.id && p.email?.toLowerCase() === email.toLowerCase())
      // Come nel database: un'iscritta con la stessa email diventa personale, non un doppione.
      if (altro && altro.ruolo !== 'iscritto') throw new Error(`Questa email è già di ${nomeDi(altro)}`)
      if (altro) {
        a().persone = a().persone.map((p) => (p.id === altro.id ? { ...p, ...ruoloDi(dati), attiva: true } : p))
        salva()
        return altro.id
      }
      // Già in elenco senza email (dall'import, per esempio): gliela si dà, invece di rifarla.
      const senza = !dati.id && a().persone.find((p) => p.ruolo !== 'iscritto' && !p.email && p.nome.toLowerCase() === nome.toLowerCase() && p.cognome.toLowerCase() === cognome.toLowerCase())
      if (senza) {
        a().persone = a().persone.map((p) => (p.id === senza.id ? { ...p, email, ...ruoloDi(dati), attiva: true } : p))
        salva()
        return senza.id
      }
      if (!dati.id) {
        const id = `i-${nome.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '')}-${unico()}`
        a().persone = [...a().persone, { id, nome, cognome, email, ...ruoloDi(dati), attiva: true, creataIl: oggi() }]
        salva()
        return id
      }
      persona(dati.id)
      a().persone = a().persone.map((p) => (p.id === dati.id ? { ...p, nome, cognome, email, ...ruoloDi(dati) } : p))
      salva()
      return dati.id
    },

    async impostaPin(personaId, pin) {
      if (!/^\d{4}$/.test(pin)) throw new Error('il PIN è di quattro cifre')
      const p = persona(personaId)
      // Come `imposta_pin`: chi insegna, o la segreteria. L'amministrazione che non insegna non ha un tablet da aprire.
      if (!(p.ruolo === 'staff' || insegna(p))) throw new Error('il PIN è solo per chi insegna o fa segreteria')
      const usati = { ...Object.fromEntries(Object.entries(PIN_PROVA).map(([k, v]) => [v.personaId, k])), ...a().pin }
      if (Object.entries(usati).some(([chi, x]) => chi !== personaId && x === pin)) throw new Error('questo PIN è già di un altro: scegline un altro')
      a().pin = { ...a().pin, [personaId]: pin }
      salva()
    },

    async salvaKanji(personaId, kanji) {
      const segno = kanji === null ? undefined : kanjiScritto(kanji)
      if (segno === null) throw new Error('Il kanji è un segno solo')
      const p = persona(personaId)
      if (p.ruolo === 'iscritto') throw new Error('Il kanji è solo per istruttori e segreteria')
      const altro = segno && a().persone.find((x) => x.id !== personaId && x.kanji === segno)
      // Come l'indice unico di 24-kanji.sql.
      if (altro) throw new Error(`${segno} è già di ${nomeDi(altro)}: scegline un altro`)
      a().persone = a().persone.map((x) => (x.id === personaId ? { ...x, kanji: segno } : x))
      salva()
    },

    async invita(personaId) {
      // Come la funzione `invita`, ma nessuna email parte: in prova non c'è un server.
      const p = persona(personaId)
      if (p.ruolo === 'iscritto') throw new Error('Si invitano solo istruttori e segreteria')
      if (!p.attiva) throw new Error(`${p.nome} è senza accesso: prima va ridato`)
      if (!p.email) throw new Error(`${p.nome} non ha un’email`)
      if (p.id === 's-prova') throw new Error(`${p.nome} è già entrata: se ha perso la password, la chiede dalla porta con «password dimenticata»`)
      return 'invito'
    },

    async eliminaIstruttore(personaId) {
      // Le stesse regole di `28-elimina-istruttore.sql`. In prova un corso
      // archiviato conta come le sue lezioni passate: col database, ha
      // insegnato.
      const p = persona(personaId)
      // In prova è entrata la segreteria di prova.
      if (personaId === 's-prova') throw new Error("Non ci si elimina da soli: lo fa un'altra persona di segreteria")
      if (!insegna(p))
        throw new Error(`Si eliminano solo gli istruttori: a ${p.nome} si toglie l'accesso`)
      const nome = nomeDi(p)
      const tiene = a().corsi.filter((c) => c.attivo && c.istruttori.includes(personaId)).map((c) => c.nome).sort((x, y) => x.localeCompare(y, 'it'))
      if (tiene.length) throw new Error(`${nome} insegna ancora in ${tiene.join(', ')}: prima va tolto dai corsi`)
      if (a().corsi.some((c) => c.istruttori.includes(personaId)) || Object.values(a().lezioni).some((l) => l.istruttore === personaId))
        throw new Error(`${nome} ha delle lezioni in calendario: non si elimina, gli si toglie l'accesso`)
      if ((a().presenzeIstruttori ?? []).some((x) => x.personaId === personaId))
        throw new Error(`${nome} ha delle presenze da istruttore: non si elimina, gli si toglie l'accesso`)
      if (a().iscrizioni.some((x) => x.personaId === personaId) || (a().ricevute ?? []).some((x) => x.personaId === personaId))
        throw new Error(`${nome} è anche allievo: non si elimina, gli si toglie l'accesso`)
      // Come il database: `pagamenti_diretti` non lascia cancellare chi ne ha.
      if ((a().pagamentiDiretti ?? []).some((x) => x.personaId === personaId))
        throw new Error(`${nome} ha dei pagamenti registrati: non si elimina, gli si toglie l'accesso`)
      a().persone = a().persone.filter((x) => x.id !== personaId)
      if (a().pin) {
        const { [personaId]: _, ...altri } = a().pin!
        a().pin = altri
      }
      salva()
    },

    async anteprimaUnione(resta, via) {
      unionePossibile(resta, via)
      return {
        presenze: Object.values(memoria.segnate).filter((x) => via in x).length,
        prove: (a().prove ?? []).filter((x) => x.personaId === via).length,
        iscrizioni: a().iscrizioni.filter((x) => x.personaId === via).length,
        ricevute: (a().ricevute ?? []).filter((x) => x.personaId === via).length,
      }
    },

    async unisciPersone(resta, via) {
      // Le stesse regole di `29-unisci-doppioni.sql`.
      unionePossibile(resta, via)
      const r = persona(resta)
      const v = persona(via)
      const fino = (x?: string, y?: string) => (!x ? y : !y ? x : x > y ? x : y)
      // Il pagamento che arriva più lontano si tiene intero, stato e data:
      // «pagato» senza data vuol dire senza scadenza.
      const finoA = (q?: PersonaProva['pagamento']) => (!q ? '' : q.stato === 'pagato' && !q.fino ? '9999' : (q.fino ?? ''))
      const vinceSuo = !!v.pagamento && (!r.pagamento || r.pagamento.stato === 'da_pagare' || finoA(v.pagamento) > finoA(r.pagamento))
      const scelto = vinceSuo ? v.pagamento : r.pagamento
      const pagamento = scelto && { ...scelto, nota: r.pagamento?.nota ?? v.pagamento?.nota }
      const fileDelDoppione = !!v.certificato?.file && (!r.certificato?.file || (v.certificato.scade ?? '') > (r.certificato.scade ?? ''))
      if (fileDelDoppione) {
        const suo = certificatiProva.get(via)
        scordaCertificato(resta)
        certificatiProva.delete(via)
        if (suo) certificatiProva.set(resta, suo)
      } else scordaCertificato(via)
      const unita: PersonaProva = {
        ...r,
        email: r.email ?? v.email,
        // Come `unisci_persone`: gli indirizzi che non trovano posto si perdono, e `indirizziPersi` lo dice prima.
        emailContatto: contattoDopoUnione(r, v),
        telefono: r.telefono ?? v.telefono,
        // Attiva se una delle due lo era: chi trova un doppione spesso l'ha già disattivato.
        attiva: r.attiva || v.attiva,
        // Il file è di chi resta, o di chi se ne va se la sua data è più lontana (e l'altro si cancella).
        certificato:
          r.certificato || v.certificato
            ? {
                ...(fileDelDoppione ? { file: v.certificato?.file, caricatoIl: v.certificato?.caricatoIl } : { file: r.certificato?.file, caricatoIl: r.certificato?.caricatoIl }),
                // La data è quella del certificato il cui file resta; se nessuno ha un file, la più lontana.
                scade: fileDelDoppione ? v.certificato?.scade : r.certificato?.file ? r.certificato.scade : fino(r.certificato?.scade, v.certificato?.scade),
              }
            : undefined,
        documento: r.documento || v.documento,
        pagamento,
      }
      a().persone = a().persone.filter((x) => x.id !== via).map((x) => (x.id === resta ? unita : x))

      // Una presenza per lezione: vince presente, poi giustificato, poi assente;
      // con lei, da dove è stata segnata (`origini`: il tablet o il recupero).
      const peso = { presente: 0, giustificato: 1, assente: 2 } as const
      const segnate = { ...memoria.segnate }
      const origini = { ...memoria.origini }
      for (const [sessione, segni] of Object.entries(segnate)) {
        if (!(via in segni)) continue
        const { [via]: suo, ...altri } = segni
        const mio = altri[resta]
        const vinceSuo = !mio || peso[suo] < peso[mio]
        segnate[sessione] = vinceSuo ? { ...altri, [resta]: suo } : altri
        const { [via]: suaO, [resta]: miaO, ...altreO } = origini[sessione] ?? {}
        const o = vinceSuo ? suaO : miaO
        origini[sessione] = o ? { ...altreO, [resta]: o } : altreO
      }
      memoria.segnate = segnate
      memoria.origini = origini
      memoria.salva()

      const prove = a().prove ?? []
      a().prove = prove
        .filter((x) => !(x.personaId === via && prove.some((y) => y.personaId === resta && y.sessioneId === x.sessioneId)))
        .map((x) => (x.personaId === via ? { ...x, personaId: resta } : x))

      // Un'iscrizione per corso: dalla più vecchia alla fine più lontana, nessuna se uno non ce l'ha.
      const sue = a().iscrizioni.filter((x) => x.personaId === via)
      a().iscrizioni = a().iscrizioni
        .filter((x) => x.personaId !== via)
        .map((x) => {
          const s = x.personaId === resta && sue.find((y) => y.corsoId === x.corsoId)
          return s ? { ...x, dal: x.dal < s.dal ? x.dal : s.dal, al: x.al && s.al ? (x.al > s.al ? x.al : s.al) : undefined } : x
        })
      a().iscrizioni = [...a().iscrizioni, ...sue.filter((y) => !a().iscrizioni.some((x) => x.personaId === resta && x.corsoId === y.corsoId)).map((y) => ({ ...y, personaId: resta }))]

      a().ricevute = (a().ricevute ?? []).map((x) => (x.personaId === via ? { ...x, personaId: resta } : x))
      // Le tessere passano a chi resta; la stessa su tutte e due resta una (quella di chi resta), come `tessere_unione`.
      const tessere = a().tessere ?? []
      a().tessere = tessere
        .filter((x) => !(x.personaId === via && tessere.some((y) => y.personaId === resta && y.ente === x.ente && y.tipo === x.tipo && y.dal === x.dal)))
        .map((x) => (x.personaId === via ? { ...x, personaId: resta } : x))
      a().pagamentiDiretti = (a().pagamentiDiretti ?? []).map((x) => (x.personaId === via ? { ...x, personaId: resta } : x))
      const an = a().anagrafiche ?? {}
      if (an[via]) {
        const { [via]: suaA, ...altre } = an
        const mia = altre[resta] ?? {}
        const piena = (x: unknown) => x !== undefined && x !== null && x !== ''
        // Come il trigger `anagrafiche_cambiata`: quella unita è la più recente.
        a().anagrafiche = { ...altre, [resta]: { ...suaA, ...Object.fromEntries(Object.entries(mia).filter(([, x]) => piena(x))), cambiataIl: new Date().toISOString() } }
      }
      spostaRichieste(via, resta)
      a().segnalate = (a().segnalate ?? []).map((x) => (x.personaId === via ? { ...x, personaId: resta } : x))
      // Le coppie «non sono doppioni» passano a chi resta; una con sé stessa, o che c'è già, se ne va.
      const coppie: [string, string][] = []
      for (const [p, q] of a().nonDoppioni ?? []) {
        const [x, y] = [p === via ? resta : p, q === via ? resta : q].sort()
        if (x !== y && !coppie.some(([c, d]) => c === x && d === y)) coppie.push([x, y])
      }
      a().nonDoppioni = coppie
      salva()
    },

    async indiziDoppioni() {
      const i: IndiziDoppioni = { codiciFiscali: {}, nascite: {}, nonDoppioni: [...(a().nonDoppioni ?? [])] }
      for (const p of a().persone) {
        // Campo per campo: la segreteria, se no la richiesta accolta più recente.
        const r = richiesteDi(p.id)
          .filter((x) => x.stato === 'accolta')
          .sort((x, y) => (y.gestitaIl ?? '').localeCompare(x.gestitaIl ?? ''))[0]
        const an = a().anagrafiche?.[p.id]
        const cf = an?.codiceFiscale ?? r?.codiceFiscale
        const nato = an?.natoIl ?? r?.natoIl
        if (cf) i.codiciFiscali[p.id] = cf
        if (nato) i.nascite[p.id] = nato
      }
      return i
    },

    async segnaNonDoppioni(x, y) {
      // Come 33-non-doppioni.sql: una riga per coppia, la scheda più piccola prima.
      if (x === y) throw new Error('Scegli due schede diverse')
      persona(x)
      persona(y)
      const coppia: [string, string] = x < y ? [x, y] : [y, x]
      const tutte = a().nonDoppioni ?? []
      if (!tutte.some(([p, q]) => p === coppia[0] && q === coppia[1])) a().nonDoppioni = [...tutte, coppia]
      salva()
    },

    async togliNonDoppioni(x, y) {
      a().nonDoppioni = (a().nonDoppioni ?? []).filter(([p, q]) => !((p === x && q === y) || (p === y && q === x)))
      salva()
    },

    async salvaSala(s) {
      const nome = s.nome.trim()
      if (!nome) throw new Error('La sala ha bisogno di un nome')
      if (a().sale.some((x) => x.toLowerCase() === nome.toLowerCase() && x !== s.id)) throw new Error('C’è già una sala con questo nome')
      const cap = { ...a().capienzaSale }
      if (s.id && s.id !== nome) {
        // Il nome è anche l'id, in prova: si rinomina ovunque.
        a().sale = a().sale.map((x) => (x === s.id ? nome : x))
        a().corsi = a().corsi.map((c) => ({
          ...c,
          sala: c.sala === s.id ? nome : c.sala,
          ricorrenze: c.ricorrenze.map((r) => (r.sala === s.id ? { ...r, sala: nome } : r)),
        }))
        a().lezioni = Object.fromEntries(Object.entries(a().lezioni).map(([k, l]) => [k, l.sala === s.id ? { ...l, sala: nome } : l]))
        a().musica = (a().musica ?? []).map((l) => (l.sala === s.id ? { ...l, sala: nome } : l))
        delete cap[s.id]
      } else if (!s.id) a().sale = [...a().sale, nome]
      if (s.capienza) cap[nome] = s.capienza
      else delete cap[nome]
      a().capienzaSale = cap
      salva()
      return nome
    },

    async listeMusica() {
      const discipline = disciplineDa(a().discipline)
      return (a().musica ?? []).map((l) => {
        const disciplina = ripulisciDisciplina(l.disciplina, discipline)
        return { id: l.id, nome: l.nome, link: l.link, salaId: l.sala, ...(disciplina ? { disciplina } : {}) }
      })
    },

    async salvaListaMusica(l) {
      const nome = l.nome.trim().slice(0, MAX_NOME_LISTA)
      const link = l.link.trim()
      if (!nome) throw new Error('La lista ha bisogno di un nome')
      if (!fonteDelLink(link)) throw new Error(erroreDelLink(link) ?? 'Il link non è una playlist di YouTube o di Spotify, né una radio')
      if (l.salaId && !a().sale.includes(l.salaId)) throw new Error('Sala inesistente')
      const id = l.id ?? `musica~${unico()}`
      const precedente = (a().musica ?? []).find((x) => x.id === l.id)
      // Assente = com'era; nulla o sconosciuta = nessuna.
      const daScrivere = disciplinaDaSalvare(l, disciplineDa(a().discipline))
      const disciplina = daScrivere === undefined ? precedente?.disciplina : (daScrivere ?? undefined)
      const riga = { id, nome, link, sala: l.salaId, ...(disciplina ? { disciplina } : {}) }
      const prima = a().musica ?? []
      a().musica = l.id ? prima.map((x) => (x.id === l.id ? riga : x)) : [...prima, riga]
      salva()
      return id
    },

    async togliListaMusica(id) {
      a().musica = (a().musica ?? []).filter((x) => x.id !== id)
      salva()
    },

    async voceSale() {
      return voceDellaSala(a().voceSale)
    },

    async salvaVoceSale(nome) {
      a().voceSale = voceDellaSala(nome)
      salva()
    },

    clipSale: () => clipProva.list(),

    async salvaClip(chiave, clip) {
      if (!chiaveValida(chiave)) throw new Error('Questa frase non si può incidere')
      if ((await clipProva.put(chiave, clip)) === null) throw new Error('Questo browser non tiene le clip: in prova servono i dati del sito')
    },

    apriClip: (chiave) => clipProva.get(chiave),

    async togliClip(chiave) {
      await clipProva.delete(chiave)
    },

    async eserciziPalestra() {
      return eserciziDellaPalestra(a().eserciziSale, disciplineDa(a().discipline))
    },

    async salvaEserciziPalestra(l) {
      a().eserciziSale = (eserciziDellaPalestra(l, disciplineDa(a().discipline)) ?? []).map(({ id, nome, disciplina }) => ({
        id,
        nome,
        ...(disciplina ? { disciplina } : {}),
      }))
      salva()
    },

    async discipline() {
      return disciplineDa(a().discipline)
    },

    async salvaDiscipline(l) {
      // Il database rifiuta oltre 4000 byte; in prova non c'è il limite, e con 20 voci da 30 lettere non ci si arriva.
      a().discipline = disciplineDa(l)
      salva()
    },

    // In prova lo storico è quello del timer su questo dispositivo: il tablet
    // di prova non ha un server a cui mandarlo.
    async presenzeIstruttori(giorni) {
      const da = new Date(Date.now() - giorni * GIORNO).toISOString()
      return (a().presenzeIstruttori ?? [])
        .filter((x) => x.stato === 'da_confermare' || x.entratoIl >= da)
        .flatMap((x): PresenzaIstruttoreSeg[] => {
          const l = trovaLezione(x.sessioneId)
          if (!l) return []
          const chi = a().persone.find((p) => p.id === x.personaId)
          return [
            {
              id: x.id,
              sessioneId: x.sessioneId,
              corso: l.corso.nome,
              colore: l.corso.colore,
              inizio: l.inizio.toISOString(),
              fine: l.fine.toISOString(),
              personaId: x.personaId,
              nome: chi ? nomeDi(chi) : '—',
              previsti: comeE(l).istruttori.map(nomeIstruttore).join(', '),
              previstiElenco: comeE(l).istruttori.map((id) => ({ id, nome: nomeIstruttore(id) })),
              annullata: comeE(l).stato === 'annullata',
              sala: x.sala,
              stato: x.stato,
              prevista: x.prevista,
              entratoIl: x.entratoIl,
              gestitaIl: x.gestitaIl,
              gestitaDa: x.gestitaDa,
              come: x.come ?? 'pin',
              segnataDa: x.segnataDa ? nomeIstruttore(x.segnataDa) : undefined,
            },
          ]
        })
        .sort((x, y) => y.entratoIl.localeCompare(x.entratoIl))
    },

    async gestisciPresenzaIstruttore(id, conferma) {
      const tutte = a().presenzeIstruttori ?? []
      if (!tutte.some((x) => x.id === id)) throw new Error('presenza inesistente')
      // In prova chi usa la segreteria è la segreteria di prova.
      a().presenzeIstruttori = tutte.map((x) =>
        x.id === id ? { ...x, stato: conferma ? 'confermata' : 'rifiutata', gestitaDa: 'Segreteria di prova', gestitaIl: new Date().toISOString() } : x,
      )
      salva()
    },

    async lezioniSenzaIstruttore() {
      return lezioniSenzaIstruttoreProva()
    },

    async segnaIstruttoriLezione(sessioneId, presenti) {
      // In prova chi usa la segreteria è la segreteria di prova.
      segnaIstruttoriLezioneProva(sessioneId, presenti, 'Segreteria di prova')
    },

    async segnaIstruttorePrevisto(sessioneId, personaId) {
      segnaIstruttorePrevistoProva(sessioneId, personaId, 'Segreteria di prova')
    },

    async allenamenti(quanti) {
      return loadHistory()
        .slice()
        .sort((x, y) => y.finishedAt - x.finishedAt)
        .slice(0, quanti)
        .map((h) => ({
          id: h.id,
          nome: h.workoutName,
          finitoIl: new Date(h.finishedAt).toISOString(),
          secondi: h.seconds,
          completato: h.completed,
          chi: 'Questo dispositivo',
        }))
    },

    async impostazioni() {
      return { inizioCorsi: null, fineCorsi: null, ...(a().impostazioni ?? { mesiPresenze: 24, giorniCalendario: 60 }) }
    },

    async salvaImpostazioni(i) {
      scriviImpostazioni(i)
    },

    async contaDateCorsi(inizio, fine) {
      return dateCorsi(inizio, fine, true)
    },

    async salvaDateCorsi(inizio, fine) {
      return dateCorsi(inizio, fine, false)
    },

    async scadute(mesi) {
      return scadute(mesi).length
    },

    async pulisci() {
      const via = scadute()
      const segnate = { ...memoria.segnate }
      for (const [sessione, persona] of via) {
        const mie = { ...segnate[sessione] }
        delete mie[persona]
        segnate[sessione] = mie
      }
      memoria.segnate = segnate
      memoria.salva()
      return via.length
    },

    async esporta(personaId) {
      const p = persona(personaId)
      const presenze = Object.entries(memoria.segnate).flatMap(([id, segni]) => {
        const stato = segni[personaId]
        const l = stato && trovaLezione(id)
        return l ? [{ lezione: l.corso.nome, inizio: l.inizio.toISOString(), stato, origine: memoria.origini[id]?.[personaId]?.da ?? 'appello' }] : []
      })
      return {
        esportato_il: new Date().toISOString(),
        persona: { nome: p.nome, cognome: p.cognome, email: p.email ?? null, telefono: p.telefono ?? null, attiva: p.attiva, in_elenco_dal: p.creataIl },
        iscrizioni: a().iscrizioni.filter((i) => i.personaId === personaId).map((i) => ({ corso: corso(i.corsoId).nome, dal: i.dal, al: i.al ?? null })),
        presenze: presenze.sort((x, y) => x.inizio.localeCompare(y.inizio)),
        richieste_di_iscrizione: richiesteDi(personaId).map(({ id: _id, personaId: _p, ...r }) => r),
        certificato_e_pagamento: { certificato_scade: p.certificato?.scade ?? null, certificato_file: p.certificato?.file ?? null, documento_in_segreteria: !!p.documento, ...(p.pagamento ?? { stato: 'da_pagare' }) },
        ricevute: (a().ricevute ?? []).filter((r) => r.personaId === personaId).map(({ id: _id, personaId: _p, ...r }) => r),
        pagamenti_a_mano: (a().pagamentiDiretti ?? []).filter((x) => x.personaId === personaId).map(({ id: _id, personaId: _p, ...x }) => x),
        dati_anagrafici: a().anagrafiche?.[personaId] ?? null,
      }
    },

    // In prova non c'è un database da copiare, né GitHub da chiamare.
    async backup() {
      return { copie: [], ultimo: null }
    },

    async avviaBackup() {
      throw new Error('In prova non c’è un database da copiare: il backup si fa col database vero')
    },

    async scaricaBackup() {
      throw new Error('In prova non ci sono copie')
    },
  }
}
