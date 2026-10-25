import { indirizziDaSalvare } from './avvisoSegreteria'
import type { Anagrafica, AnagraficaDi, UltimoSollecito, CorsoSeg, DatiSegreteria, EsitoDate, Impostazioni, LezioneSeg, PersonaSeg, PersonaleSeg, PresenzaIstruttoreSeg, ProvaSeg, RigaRegistro, Statistiche, StoricoSeg } from './segreteria'
import { cosaNonVaTariffa } from './tariffe'
import { cosaNonVaLettera, type Lettera } from './lettere'
import { cosaNonVaCompenso, cosaNonVaExtra, cosaNonVaPagamento, descrizionePagamento, extraDelPagamento, mancaPerRicevuta, primoDelMese, VOCE_COMPENSI, type RicevutaCompenso } from './compensi'
import { conDatiDellaSegreteria } from './segreteria'
import { attivitaCambiata, cancellaFileIl, cosaNonVaAnagrafica, cosaNonVaCertificato, cosaNonVaScadenza, emailNonValida, cosaNonVaAttivita, lezioniCheSeguonoIlGiorno, motivoAttivitaUsata, ordinaAttivita, pulisciAnagrafica } from './segreteria'
import { giorniConLezioni } from './calendarioSettimana'
import { unisciGare } from './gare'
import { codicePulito, cosaNonVaNucleo, GENITORE_GIA_IN_ELENCO, GENITORE_SENZA_CF, GENITORE_SENZA_NOME, nuovoTitolare, type DatiGenitore } from './nucleo'
import { gestisciSegnalataProva, segnalateProva } from './segnalateProva'
import { nomeProprio } from './nomi'
import { numeriDiProva } from './sitoStatistiche'
import { insegna, segniDi, siElimina, type RuoloPersonale } from './ruoli'
import type { IndiziDoppioni } from './doppioni'
import { archivio, certificatiInAttesaProva, certificatiProva, idRicorrenza, nomeDi, scordaCertificato, scordaInAttesa, STAGIONE, type LezioneProva, type PersonaProva } from './archivioProva'
import { attivitaDi, comeE, iscrittiIl, lezioniFra, lezioniSenzaIstruttoreProva, nomeIstruttore, salaDelGiorno, segnaIstruttoriLezioneProva, segnaIstruttoreAssenteProva, segnaIstruttorePrevistoProva, trovaLezione, type LezioneTrovata } from './datiProva'
import { memoria, nomeAttivita } from './datiProva'
import { chiaveGiorno } from './sala'
// La chiusura della cassa ha già il nome `cosaNonVaChiusura`.
import { cosaNonVaChiusura as cosaNonVaPeriodo, type ContoChiusura } from './chiusure'
import { enteDaDati, fineAnno, importaTessereProva } from './tessere'
import { QUOTA_ASSOCIATIVA, stagioneDi } from './costi'
import { NOTA_DI_DEFAULT, type IncassoPrima } from './pagatoPrima'
import { PIN_PROVA } from './tabletProva'
import { kanjiScritto } from './kanji'
import { MASSIMO_PER_IMPORTAZIONE, nonEQuestoBanca, PREFISSO_CHIAVE_BANCA, segnaCoperti } from './importaBanca'
// La pulizia del testo del sito è una libreria grossa: si scarica solo aprendo il pannello SITO.
const sitoProva = () => import('./sitoProva')
import { controllaImmagine, cosaNonVaImmagini, nomeNelContenitore } from './sitoImmagini'
import { allegatiScaduti, cosaNonVaSegnalazione, eCategoria, SCEGLI, guaioAllegati, nomiAllegati, type Allegato, type Segnalazione } from './segnalazioni'
import { abbinaPersone, cosaNonVaCollegato, esitiCollegamenti, nomeDallaCausale, riepilogoCollegamenti, type PersonaPerNome } from './movimentiPersona'
import { cartaPerPersona, cosaNonVaSatispay, cosaNonVaSatispayAMano, saldoPerPersona, satispayCorsiPerPersona, satispayPerPersona, satispayQuotaPerPersona } from './satispay'
import { applicaScarico, daDecidere, decidiGruppo, decidiScarico, NOME_CASSA_SATISPAY, scollegaScarico, type PagamentoNegozio } from './satispayScarico'
import { pagamentiSatispayProva, richiesteContateProva, richiesteDi, salvaSatispay, spostaRichieste } from './richiesteProva'
import { titoliDelSito, type RigaDaDove } from './provenienza'
import { ESTENSIONI } from './richieste'
import { disciplinaDaSalvare, erroreDelLink, fonteDelLink, MAX_NOME_LISTA } from './musica'
import { eserciziDellaPalestra, voceDellaSala } from '../../timer/src/lib/impostazioniSala'
import { disciplineDa, ripulisciDisciplina } from '../../timer/src/lib/discipline'
import { chiaveValida } from '../../timer/src/lib/clipSala'
import { loadHistory } from '../../timer/src/lib/storage'
import { clipProva } from './voceProva'
import { agganciaPerNome, cosaNonVaListino, LISTINO_PREDEFINITO, listinoDa, listinoProva, salvaListinoProva } from './listino'
import { cosaNonVaDaPagamento, cosaNonVaDiretto, righeDaRicevute, righeDirette, trovaPagatori, type PagamentoDiretto } from './pagamenti'
import {
  cosaNonVaAnnulloChiusura,
  cosaNonVaAnnulloMovimento,
  cosaNonVaCambioVoce,
  LIMITE_CAMBIO_VOCE,
  cosaNonVaChiusura,
  cosaNonVaGiroconto,
  cosaNonVaMovimento,
  vuolePersona,
  SCEGLI_LA_PERSONA,
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
  VOCE_GARE,
  contantiInGiornoChiuso,
  VOCE_QUOTA,
  type Cassa,
  type VoceContabile,
} from './contabilita'
import { conti as contiRicevuta, cosaNonVa, enteDa, intestatarioDa, pulisciIntestatario, quoteDi, type Ricevuta } from './ricevute'
import { vociCorsiDi } from './corsiDaPagare'
import { mandateOggi, SOGLIA_MAIL_GIORNO, TETTO_PER_RICEVUTA } from './ricevuteEmail'

/** I pagamenti d'esempio del negozio negli ultimi giorni, come li darebbe Satispay: uno annullato, un rimborso e uno da decidere. */
function negozioDiProva(): PagamentoNegozio[] {
  const fa = (giorni: number, ora: number) => new Date(Date.now() - giorni * 86_400_000).toISOString().slice(0, 10) + `T${String(ora).padStart(2, '0')}:15:00Z`
  return [
    { satispayId: 'negozio-1', tipo: 'TO_BUSINESS', stato: 'ACCEPTED', importo: 1200, quando: fa(5, 9), chi: 'Rossi Marta' },
    { satispayId: 'negozio-2', tipo: 'TO_BUSINESS', stato: 'ACCEPTED', importo: 3500, quando: fa(4, 16), chi: 'Bianchi Luca' },
    { satispayId: 'negozio-3', tipo: 'TO_BUSINESS', stato: 'CANCELED', importo: 1500, quando: fa(3, 17), chi: 'Verdi Anna' },
    { satispayId: 'negozio-4', tipo: 'TO_BUSINESS', stato: 'ACCEPTED', importo: 1500, quando: fa(3, 17), chi: 'Verdi Anna' },
    { satispayId: 'negozio-5', tipo: 'REFUND_TO_BUSINESS', stato: 'ACCEPTED', importo: 1200, quando: fa(2, 10), chi: 'Rossi Marta' },
    { satispayId: 'negozio-6', tipo: 'TO_BUSINESS', stato: 'ACCEPTED', importo: 800, quando: fa(1, 18), chi: 'Neri Paolo' },
    // Già messo da parte da uno scarico di prima: in prova si vede l'avviso giallo dei casi da decidere.
    { satispayId: 'negozio-7', tipo: 'TO_BUSINESS', stato: 'ACCEPTED', importo: 2000, quando: fa(6, 11), chi: 'Gialli Sara', esito: 'da_decidere', motivo: 'giorno_chiuso' },
  ]
}

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
  const vociSenzaScarico = (): VoceContabile[] => {
    const base: VoceContabile[] = a().voci ?? [
      { id: 'voce-quota', nome: VOCE_QUOTA, tipo: 'entrata', diSistema: true, attiva: true },
      { id: 'voce-corsi', nome: VOCE_CORSI, tipo: 'entrata', diSistema: true, attiva: true },
    ]
    const conDifferenza: VoceContabile[] = base.some((v) => v.nome === VOCE_DIFFERENZA)
      ? base
      : [
          ...base,
          { id: 'voce-differenza-entrata', nome: VOCE_DIFFERENZA, tipo: 'entrata', diSistema: true, attiva: true },
          { id: 'voce-differenza-uscita', nome: VOCE_DIFFERENZA, tipo: 'uscita', diSistema: true, attiva: true },
        ]
    // Come 81-compensi-pagati.sql: c'è anche in un archivio fatto prima.
    // Una voce omonima scritta a mano diventa quella di sistema, come nell'81.
    const omonima = (v: VoceContabile) => v.tipo === 'uscita' && v.nome.trim().toLowerCase() === VOCE_COMPENSI.toLowerCase()
    const conCompensi: VoceContabile[] = conDifferenza.some(omonima)
      ? conDifferenza.map((v) => (omonima(v) ? { ...v, diSistema: true, attiva: true } : v))
      : [...conDifferenza, { id: 'voce-compensi', nome: VOCE_COMPENSI, tipo: 'uscita', diSistema: true, attiva: true }]
    // Come 117-gare.sql: gli incassi delle gare hanno la loro voce, anche in un archivio fatto prima.
    return conCompensi.some((v) => v.tipo === 'entrata' && v.nome === VOCE_GARE)
      ? conCompensi
      : [...conCompensi, { id: 'voce-gare', nome: VOCE_GARE, tipo: 'entrata', diSistema: true, attiva: true }]
  }
  // Come 97-satispay-scarico.sql: le voci dello scarico ci sono anche in un archivio fatto prima.
  const vociDelloScarico = (): VoceContabile[] => {
    const voci = vociSenzaScarico()
    const mancano = (
      [
        ['voce-da-classificare-entrata', 'Da classificare', 'entrata'],
        ['voce-da-classificare-uscita', 'Da classificare', 'uscita'],
        ['voce-commissioni', 'Commissioni bancarie', 'uscita'],
      ] as const
    ).filter(([, nome, tipo]) => !voci.some((v) => v.tipo === tipo && v.nome.trim().toLowerCase() === nome.toLowerCase()))
    return [...voci, ...mancano.map(([id, nome, tipo]): VoceContabile => ({ id, nome, tipo, diSistema: false, attiva: true }))]
  }
  const cassePartenza = (): Cassa[] => {
    const casse = a().casse ?? [
      { id: 'cassa-contanti', nome: NOME_CASSA_CONTANTI, saldoIniziale: 0 },
      { id: 'cassa-conto', nome: NOME_CASSA_CONTO, saldoIniziale: 0 },
    ]
    // Come 97-satispay-scarico.sql e 116: la cassa Satispay c'è anche in un archivio fatto prima, dal 2025,
    // anche in uno salvato quando partiva dal 1° ottobre 2026.
    return casse.some((c) => c.nome === NOME_CASSA_SATISPAY)
      ? casse.map((c) => (c.nome === NOME_CASSA_SATISPAY && c.dal === '2026-10-01' ? { ...c, dal: '2025-01-01' } : c))
      : [...casse, { id: 'cassa-satispay', nome: NOME_CASSA_SATISPAY, saldoIniziale: 0, dal: '2025-01-01' }]
  }
  const contabilita = () => ({
    casse: cassePartenza(),
    voci: vociDelloScarico(),
    movimenti: a().movimenti ?? [],
    chiusure: a().chiusure ?? [],
  })
  // Come `cassa_contanti_chiusa_fino` (92): si chiude solo la Cassa Contanti, vale l'ultima chiusura attiva.
  const fino = () => contabilita().chiusure.filter((k) => !k.annullataIl).map((k) => k.data).sort().at(-1) ?? null
  // Lo storico collegato alle persone: le righe dei movimenti scritti qui o importati, e le schede per nome.
  const righeDelloStorico = () => righeMovimenti([], contabilita().movimenti, contabilita().voci)
  const personePerNome = (): PersonaPerNome[] => a().persone.map((p) => ({ id: p.id, nome: p.nome, cognome: p.cognome }))
  /** I movimenti scelti per id, nell'ordine dato; basta uno che non c'è per fermare tutto, come nel database. */
  const righeScelte = (ids: string[]) => {
    const righe = righeDelloStorico()
    return ids.map((id) => {
      const r = righe.find((x) => x.id === id && x.origine === 'movimento')
      if (!r) throw new Error('Il movimento non c’è')
      return r
    })
  }
  /** Cambia solo l'etichetta e scrive la traccia: importo, data, cassa, voce e testo restano quelli di prima. */
  const scriviCollegamento = (movimentoId: string, dopo: string | undefined, lotto?: string) => {
    const movimenti = contabilita().movimenti
    const prima = movimenti.find((x) => x.id === movimentoId)?.personaId
    a().movimenti = movimenti.map((x) => (x.id === movimentoId ? { ...x, personaId: dopo } : x))
    a().collegamentiPersona = [...(a().collegamentiPersona ?? []), { movimentoId, prima, dopo, lotto, quando: new Date().toISOString() }]
  }
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
  /** I controlli di `unione_possibile` (29-unisci-doppioni.sql), il nucleo compreso (100-nucleo.sql). */
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
    return conDatiDellaSegreteria(vince && { dati: vince.dati, da: vince.da }, an)
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

  /** Le lezioni non annullate del periodo e della sala (o di tutte): come `lezioni_da_chiudere`. */
  const daChiudere = (dal: string, al: string, salaId: string | null) => {
    const guaio = cosaNonVaPeriodo(dal, al)
    if (guaio) throw new Error(guaio)
    return lezioniFra(new Date(dal + 'T00:00:00'), new Date(al + 'T00:00:00')).filter((l) => comeE(l).stato !== 'annullata' && (salaId === null || comeE(l).sala === salaId))
  }

  const contoChiusura = (l: LezioneTrovata[]): ContoChiusura => {
    const conProva = new Set((a().prove ?? []).map((p) => p.sessioneId))
    return {
      lezioni: l.length,
      straordinarie: l.filter((x) => x.straordinaria).length,
      conAppello: l
        .filter((x) => conti(x.id).segnati || conProva.has(x.id))
        .map((x) => ({ corso: x.corso.nome, inizio: x.inizio.toISOString(), prova: conProva.has(x.id) })),
    }
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
        // Rimessa a mano non è più della chiusura, come il trigger sessioni_fuori_chiusura.
        if (cambi.stato && cambi.stato !== 'annullata') for (const c of a().chiusurePalestra ?? []) delete c.prima[sessioneId]
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

    async chiusurePalestra() {
      return [...(a().chiusurePalestra ?? [])].sort((x, y) => x.dal.localeCompare(y.dal)).map((c) => ({ id: c.id, dal: c.dal, al: c.al, salaId: c.salaId, lezioni: Object.keys(c.prima).length }))
    },

    async contaChiusura(dal, al, salaId) {
      return contoChiusura(daChiudere(dal, al, salaId))
    },

    async chiudi(dal, al, salaId) {
      // In prova le lezioni si calcolano: annullarle tutte ora vale anche per i giorni mai guardati.
      // shortcut: una ricorrenza aggiunta dopo la chiusura non nasce annullata; servirebbe se la prova lo chiedesse.
      const l = daChiudere(dal, al, salaId)
      const id = `ch-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      const prima = Object.fromEntries(l.map((x) => [x.id, comeE(x).stato]))
      for (const x of l) cambiaLezione(x.id, (y) => ({ ...y, stato: 'annullata' }))
      a().chiusurePalestra = [...(a().chiusurePalestra ?? []), { id, dal, al, salaId, prima }]
      salva()
      return { id, lezioni: l.length }
    },

    async togliChiusura(id) {
      const c = a().chiusurePalestra?.find((x) => x.id === id)
      if (!c) throw new Error('Questa chiusura non c’è più: ricarica la pagina.')
      let tornate = 0
      for (const [lezione, stato] of Object.entries(c.prima)) {
        // Una lezione rimessa a mano nel frattempo non si tocca.
        if (a().lezioni[lezione]?.stato !== 'annullata') continue
        // Un giorno chiuso anche da un'altra chiusura resta chiuso: la lezione passa a quella, la più vecchia.
        const l = trovaLezione(lezione)
        const altra = l && a().chiusurePalestra?.find((x) => x.id !== id && x.dal <= chiaveGiorno(l.inizio) && chiaveGiorno(l.inizio) <= x.al && (x.salaId === null || x.salaId === comeE(l).sala))
        if (altra) {
          altra.prima[lezione] = stato
          continue
        }
        cambiaLezione(lezione, (y) => {
          if (stato === 'prevista') delete y.stato
          else y.stato = stato
          return y
        })
        tornate++
      }
      a().chiusurePalestra = a().chiusurePalestra?.filter((x) => x.id !== id)
      salva()
      return tornate
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
          bastaUno: c.bastaUno ?? false,
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
          { id, nome: dati.nome.trim(), colore: dati.colore ?? '#1b8ac4', sala: dati.salaId ?? a().sale[0], istruttori: dati.istruttori, capienza: dati.capienza, attivo: true, enteTessera: enteDaDati(dati.enteTessera), bastaUno: dati.bastaUno ?? false, ricorrenze: [] },
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
              bastaUno: dati.bastaUno ?? x.bastaUno,
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

    // Gli incassi del vecchio programma nella stagione (71-pagato-vecchio-programma.sql): quelli importati e scritti qui, e
    // se non ce ne sono quattro inventati sulle prime persone da pagare, uno per caso, per vedere il filtro per intero.
    async pagatoPrima() {
      const { movimenti, voci } = contabilita()
      const veri: IncassoPrima[] = movimenti
        .filter((x) => x.tipo === 'entrata' && !x.annullatoIl && x.origineImport?.startsWith('prima-nota:') && x.data >= stagioneDi(chiaveGiorno(new Date())).dal && x.data <= stagioneDi(chiaveGiorno(new Date())).al)
        .map((x) => ({ personaId: x.personaId ?? null, data: x.data, importo: x.importo, voce: voci.find((v) => v.id === x.voceId)?.nome ?? '' }))
        .filter((x) => x.voce === VOCE_QUOTA || x.voce === VOCE_CORSI)
      if (veri.length) return { elenco: veri }
      const [intera, sotto, corsi] = a()
        .persone.filter((p) => p.ruolo === 'iscritto' && p.attiva && ((p.pagamento?.stato ?? 'da_pagare') === 'da_pagare' || p.pagamento?.nota === NOTA_DI_DEFAULT))
        .sort((x, y) => x.id.localeCompare(y.id))
      const anno = stagioneDi(oggi()).dal.slice(0, 4)
      const incasso = (personaId: string | null, giorno: string, importo: number, voce: string): IncassoPrima => ({ personaId, data: `${anno}-${giorno}`, importo, voce })
      return {
        elenco: [
          ...(intera ? [incasso(intera.id, '09-28', QUOTA_ASSOCIATIVA * 100, VOCE_QUOTA)] : []),
          ...(sotto ? [incasso(sotto.id, '10-03', 3000, VOCE_QUOTA)] : []),
          ...(corsi ? [incasso(corsi.id, '09-28', 12500, VOCE_CORSI)] : []),
          incasso(null, '09-29', QUOTA_ASSOCIATIVA * 100, VOCE_QUOTA),
        ],
      }
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
      const conSatispay = satispayPerPersona(pagamentiSatispayProva())
      const conCarta = cartaPerPersona(pagamentiSatispayProva())
      const conSaldo = saldoPerPersona(pagamentiSatispayProva())
      const corsiSatispay = satispayCorsiPerPersona(pagamentiSatispayProva())
      const quotaSatispay = satispayQuotaPerPersona(pagamentiSatispayProva())
      return a()
        .persone.filter((p) => p.ruolo === 'iscritto')
        .map(
          (p): PersonaSeg => ({
            id: p.id,
            nome: p.nome,
            cognome: p.cognome,
            email: p.email,
            telefono: p.telefono,
            attiva: p.attiva,
            creataIl: p.creataIl,
            iscrizioni: a()
              .iscrizioni.filter((i) => i.personaId === p.id)
              .map((i) => ({ corsoId: i.corsoId, dal: i.dal, al: i.al })),
            certificato: { scade: p.certificato?.scade, conFile: !!p.certificato?.file, vecchio: !!p.certificato?.file && !p.certificato.caricatoIl, caricatoIl: p.certificato?.caricatoIl, inAttesaIl: p.certificato?.inAttesa?.il },
            documento: !!p.documento,
            pagamento: { stato: p.pagamento?.stato ?? 'da_pagare', fino: p.pagamento?.fino, nota: p.pagamento?.nota },
            quote: quoteDi((a().ricevute ?? []).filter((r) => r.personaId === p.id)),
            vociCorsi: vociCorsiDi((a().ricevute ?? []).filter((r) => r.personaId === p.id)),
            satispay: conSatispay.get(p.id),
            carta: conCarta.get(p.id),
            saldo: conSaldo.get(p.id),
            satispayQuota: quotaSatispay.get(p.id),
            satispayCorsi: corsiSatispay.get(p.id),
            nucleo: p.nucleo,
            natoIl: anagraficaDi(p.id)?.dati.natoIl,
            ...(p.genitoreNonIscritto && { genitoreNonIscritto: true }),
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
      const telefono = dati.telefono?.trim() || undefined
      // Gli iscritti possono dividere l'email (un genitore e i figli): niente controllo di unicità (99-email-unica.sql).
      const guaio = emailNonValida(email)
      if (guaio) throw new Error(guaio)
      if (!dati.id) {
        const id = `p-nuovo-${unico()}`
        a().persone = [...a().persone, { id, nome, cognome, email, telefono, ruolo: 'iscritto', attiva: true, creataIl: oggi() }]
        salva()
        return id
      }
      persona(dati.id)
      a().persone = a().persone.map((p) => (p.id === dati.id ? { ...p, nome, cognome, email, telefono } : p))
      salva()
      return dati.id
    },

    async attivaPersona(personaId, attiva) {
      const quale = persona(personaId)
      // Come il trigger del database: un titolare con gente nel nucleo non sparisce da sotto i suoi.
      if (!attiva && quale.attiva && a().persone.some((x) => x.nucleo === personaId)) throw new Error('Prima cambia il titolare del nucleo')
      // Disattivata, si lascia dietro il file del certificato; la data resta, e riattivarla non lo riporta.
      if (!attiva) {
        scordaCertificato(personaId)
        scordaInAttesa(personaId)
      }
      // Come il trigger del database: disattivata, le iscrizioni aperte si chiudono oggi (come `termina`); riattivarla non le riapre.
      const g = oggi()
      if (!attiva)
        a().iscrizioni = a().iscrizioni.map((i) => {
          const fine = i.dal > g ? i.dal : g
          return i.personaId === personaId && (!i.al || i.al > fine) ? { ...i, al: fine } : i
        })
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
      // Come `salva_certificato`: il file mandato dall'iscritto se ne va con gli altri, la scadenza scritta qui lo sostituisce.
      scordaCertificato(personaId)
      scordaInAttesa(personaId)
      certificatiProva.set(personaId, { url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '', pdf: file.type === 'application/pdf' })
      a().persone = a().persone.map((p) =>
        p.id === personaId ? { ...p, certificato: { scade, file: `${personaId}/certificato-${Date.now()}.${ESTENSIONI[file.type]}`, caricatoIl: oggi() } } : p,
      )
      salva()
    },

    async togliCertificato(personaId) {
      persona(personaId)
      scordaCertificato(personaId)
      // Il file mandato dall'iscritto e non ancora controllato resta: toglie solo quello confermato.
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, certificato: p.certificato?.inAttesa ? { inAttesa: p.certificato.inAttesa } : undefined } : p))
      salva()
    },

    async salvaDocumento(personaId, inSegreteria) {
      persona(personaId)
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, documento: inSegreteria || undefined } : p))
      salva()
    },

    async certificatiDaControllare() {
      return a()
        .persone.filter((p) => p.certificato?.inAttesa)
        .map((p) => ({ personaId: p.id, inviatoIl: p.certificato!.inAttesa!.il }))
        .sort((x, y) => x.inviatoIl.localeCompare(y.inviatoIl))
    },

    async apriCertificatoInAttesa(personaId) {
      persona(personaId)
      return certificatiInAttesaProva.get(personaId) ?? null
    },

    async confermaCertificatoIscritto(personaId, scade) {
      const guaio = cosaNonVaScadenza(scade)
      if (guaio) throw new Error(guaio)
      const attesa = persona(personaId).certificato?.inAttesa
      if (!attesa) throw new Error('Non c’è un certificato da confermare')
      // Un file solo: quello mandato prende il posto del confermato di prima.
      const mandato = certificatiInAttesaProva.get(personaId)
      scordaCertificato(personaId)
      certificatiInAttesaProva.delete(personaId)
      if (mandato) certificatiProva.set(personaId, mandato)
      a().persone = a().persone.map((p) =>
        p.id === personaId ? { ...p, certificato: { scade, file: `${personaId}/certificato-${Date.now()}.${attesa.file.split('.').pop()}`, caricatoIl: oggi() } } : p,
      )
      salva()
    },

    async rifiutaCertificatoIscritto(personaId) {
      const p = persona(personaId)
      if (!p.certificato?.inAttesa) throw new Error('Non c’è un certificato da rifiutare')
      scordaInAttesa(personaId)
      a().persone = a().persone.map((x) => (x.id === personaId ? { ...x, certificato: { ...x.certificato, inAttesa: undefined } } : x))
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
      return sito.conPezzi((a().sito ??= sito.sitoIniziale())).pagine
    },

    async sitoMenu() {
      const sito = await sitoProva()
      const { menu, footer } = (a().sito ??= sito.sitoIniziale())
      return { menu, footer }
    },

    async nuovaPaginaSito(titolo, slug, pezzi) {
      const sito = await sitoProva()
      const r = sito.nuovaPagina((a().sito ??= sito.sitoIniziale()), titolo, slug, pezzi)
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

    async salvaBozzaPezziSito(id, versione, dati) {
      const sito = await sitoProva()
      const r = sito.salvaBozzaPezzi((a().sito ??= sito.sitoIniziale()), id, versione, dati)
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

    async collegaCorsiSito(id, corsi) {
      const sito = await sitoProva()
      a().sito = sito.collegaCorsi((a().sito ??= sito.sitoIniziale()), id, corsi, a().corsi.map((x) => x.id))
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

    async orariSito() {
      return (await sitoProva()).orariSitoProva(a().corsi, oggi())
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
      const iscritti = a().persone.filter((p) => p.ruolo === 'iscritto').map((p) => ({ ...p, natoIl: anagraficaDi(p.id)?.dati.natoIl }))
      const no = cosaNonVaNucleo(iscritti, personaId, titolareId)
      if (no) throw new Error(no)
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, nucleo: titolareId } : p))
      salva()
    },

    // Come `aggiungi_genitore` in 113-genitore-non-iscritto.sql: prima le prove, poi la persona nuova.
    async aggiungiGenitore(figlioId, g) {
      if (!g.nome.trim() || !g.cognome.trim()) throw new Error(GENITORE_SENZA_NOME)
      const cf = codicePulito(g.codiceFiscale)
      if (!cf) throw new Error(GENITORE_SENZA_CF)
      // Come il database: la scheda e ogni modulo accolto, anche del figlio, che non è mai il suo genitore.
      const codici = (id: string) => [a().anagrafiche?.[id]?.codiceFiscale, ...richiesteDi(id).filter((r) => r.stato === 'accolta').map((r) => r.codiceFiscale)]
      if (a().persone.some((p) => codici(p.id).some((c) => codicePulito(c) === cf))) throw new Error(GENITORE_GIA_IN_ELENCO)
      const id = crypto.randomUUID()
      const iscritti = [...a().persone, { id, attiva: true, ruolo: 'iscritto' }]
        .filter((p) => p.ruolo === 'iscritto')
        .map((p) => ({ ...p, natoIl: anagraficaDi(p.id)?.dati.natoIl }))
      const no = cosaNonVaNucleo(iscritti, figlioId, id)
      if (no) throw new Error(no)
      a().persone = [
        ...a().persone.map((p) => (p.id === figlioId ? { ...p, nucleo: id } : p)),
        { id, nome: g.nome.trim(), cognome: g.cognome.trim(), ruolo: 'iscritto', attiva: true, creataIl: oggi(), genitoreNonIscritto: true },
      ]
      a().anagrafiche = { ...a().anagrafiche, [id]: { codiceFiscale: cf, cambiataIl: new Date().toISOString() } }
      salva()
      return id
    },

    async togliDalNucleo(personaId) {
      if (!persona(personaId).nucleo) throw new Error('Non è nel nucleo di nessuno')
      a().persone = a().persone.map((p) => (p.id === personaId ? { ...p, nucleo: undefined } : p))
      salva()
    },

    async rendiTitolare(personaId) {
      const m = nuovoTitolare(a().persone.filter((p) => p.ruolo === 'iscritto').map((p) => ({ ...p, natoIl: anagraficaDi(p.id)?.dati.natoIl })), personaId)
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

    async tariffe(personaId) {
      return Object.entries(a().tariffe?.[personaId] ?? {}).flatMap(([corsoId, centesimi]) => {
        const c = a().corsi.find((x) => x.id === corsoId)
        return c ? [{ corsoId, corso: c.nome, centesimi }] : []
      })
    },

    async salvaTariffa(personaId, corsoId, centesimi) {
      persona(personaId)
      corso(corsoId)
      if (centesimi !== null) {
        const no = cosaNonVaTariffa(centesimi)
        if (no) throw new Error(no)
      }
      const sue = { ...a().tariffe?.[personaId] }
      if (centesimi === null) delete sue[corsoId]
      else sue[corsoId] = centesimi
      a().tariffe = { ...a().tariffe, [personaId]: sue }
      salva()
    },

    async lettere(personaId) {
      return (a().lettere ?? []).filter((x) => x.personaId === personaId).slice().reverse()
    },

    async faiLettera(dati) {
      // Le stesse regole di `fai_lettera_incarico`.
      const p = persona(dati.personaId)
      // Nell'ordine dell'app col database: prima `cosaNonVaLettera`, poi la funzione.
      const no = cosaNonVaLettera(dati)
      if (no) throw new Error(no)
      if (!(p.ruolo === 'istruttore' || p.ancheIstruttore)) throw new Error('La lettera d’incarico si fa a chi insegna')
      const ora = new Date().toISOString()
      const nuova: Lettera = { ...dati, giorni: dati.giorni.trim(), id: crypto.randomUUID(), firmata: false, sostituitaIl: null, creataIl: ora }
      a().lettere = [
        ...(a().lettere ?? []).map((x) => (x.personaId === dati.personaId && x.stagione === dati.stagione && !x.sostituitaIl ? { ...x, sostituitaIl: ora } : x)),
        nuova,
      ]
      salva()
      return nuova
    },

    async ricevuteCompensi(personaId) {
      return (a().ricevuteCompensi ?? [])
        .filter((x) => !personaId || x.personaId === personaId)
        .slice()
        .sort((x, y) => y.mese.localeCompare(x.mese) || y.creataIl.localeCompare(x.creataIl))
    },

    async faiRicevutaCompenso(dati) {
      // Le stesse regole di `fai_ricevuta_compenso`, nell'ordine dell'app col database.
      const p = persona(dati.personaId)
      const no = cosaNonVaCompenso(dati)
      if (no) throw new Error(no)
      if (!(p.ruolo === 'istruttore' || p.ancheIstruttore)) throw new Error('La ricevuta del compenso si fa a chi insegna')
      if (!/^\d{4}-\d{2}-01$/.test(dati.mese) || dati.mese > primoDelMese(new Date())) throw new Error('Il mese della ricevuta non va: il primo del mese, non nel futuro')
      if (!dati.righe.length || dati.righe.length > 50 || dati.righe.some((r) => !r.corso.trim() || r.lezioni < 1 || r.minuti < 1 || !r.centesimiOra || r.centesimiOra > 100_000 || r.importo !== Math.round((r.minuti / 60) * r.centesimiOra)) || dati.calcolato !== dati.righe.reduce((s, r) => s + (r.importo ?? 0), 0))
        throw new Error('Le righe del compenso non sono giuste: rifai la ricevuta dalla pagina COMPENSI')
      if ((a().ricevuteCompensi ?? []).some((x) => x.personaId === dati.personaId && x.mese === dati.mese && !x.annullataIl && !x.extra))
        throw new Error("C'è già la ricevuta di questo mese: annullala prima di rifarla")
      const nuova: RicevutaCompenso = {
        ...dati,
        motivo: dati.importo === dati.calcolato ? null : dati.motivo?.trim() || null,
        id: crypto.randomUUID(),
        firmata: false,
        annullataIl: null,
        creataIl: new Date().toISOString(),
        movimentoId: null,
        pagataIl: null,
      }
      a().ricevuteCompensi = [...(a().ricevuteCompensi ?? []), nuova]
      salva()
      return nuova
    },

    async faiRicevutaCompensoExtra({ personaId, mese, descrizione, importo }) {
      // Le stesse regole di `fai_ricevuta_compenso_extra`, nello stesso ordine.
      const p = persona(personaId)
      if (!(p.ruolo === 'istruttore' || p.ancheIstruttore)) throw new Error('La ricevuta del compenso si fa a chi insegna')
      if (!/^\d{4}-\d{2}-01$/.test(mese) || mese > primoDelMese(new Date())) throw new Error('Il mese della ricevuta non va: il primo del mese, non nel futuro')
      const no = cosaNonVaExtra({ descrizione, importo })
      if (no) throw new Error(no)
      const an = a().anagrafiche?.[personaId]
      const manca = mancaPerRicevuta(an ?? null)
      if (manca) throw new Error(manca)
      const campi = ['indirizzo', 'cap', 'comune', 'provincia', 'codiceFiscale', 'natoIl', 'natoA', 'provinciaNascita', 'iban'] as const
      const tecnico: RicevutaCompenso['tecnico'] = { nome: p.nome, cognome: p.cognome ?? '' }
      for (const k of campi) if (an?.[k]) tecnico[k] = an[k]
      const delMese = (a().ricevuteCompensi ?? []).find((x) => x.personaId === personaId && x.mese === mese && !x.annullataIl && !x.extra)
      const nuova: RicevutaCompenso = {
        personaId,
        mese,
        righe: [],
        calcolato: 0,
        importo,
        motivo: null,
        tecnico,
        qualifica: delMese?.qualifica ?? null,
        data: oggiARoma(),
        extra: descrizione.trim(),
        id: crypto.randomUUID(),
        firmata: false,
        annullataIl: null,
        creataIl: new Date().toISOString(),
        movimentoId: null,
        pagataIl: null,
      }
      a().ricevuteCompensi = [...(a().ricevuteCompensi ?? []), nuova]
      salva()
      return nuova
    },

    async modificaRicevutaCompensoExtra(id, { descrizione, importo }) {
      // Le stesse regole di `modifica_ricevuta_compenso_extra`.
      const r = (a().ricevuteCompensi ?? []).find((x) => x.id === id)
      if (!r || r.annullataIl) throw new Error("Questa ricevuta non c'è o è annullata")
      if (!r.extra) throw new Error('Si cambiano solo le ricevute extra')
      if (r.movimentoId) throw new Error('È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI')
      const no = cosaNonVaExtra({ descrizione, importo })
      if (no) throw new Error(no)
      // Cambiata, il foglio firmato non è più questa ricevuta: torna da firmare.
      const nuova = { ...r, extra: descrizione.trim(), importo, firmata: false }
      a().ricevuteCompensi = (a().ricevuteCompensi ?? []).map((x) => (x.id === id ? nuova : x))
      salva()
      return nuova
    },

    async annullaRicevutaCompenso(id) {
      const r = (a().ricevuteCompensi ?? []).find((x) => x.id === id)
      if (r?.movimentoId) throw new Error('È pagata: prima annulla il pagamento in CONTABILITÀ → MOVIMENTI')
      if (!r || r.annullataIl) throw new Error("Questa ricevuta non c'è o è già annullata")
      a().ricevuteCompensi = (a().ricevuteCompensi ?? []).map((x) => (x.id === id ? { ...x, annullataIl: new Date().toISOString() } : x))
      salva()
    },

    async pagaCompensi(ids, data, cassaId) {
      // Le stesse regole di `paga_compensi`.
      const scelte = [...new Set(ids)]
      if (!scelte.length) throw new Error('Scegli almeno una ricevuta da pagare')
      const rs = (a().ricevuteCompensi ?? []).filter((r) => scelte.includes(r.id) && !r.annullataIl && !r.movimentoId)
      if (rs.length !== scelte.length) throw new Error("Una delle ricevute non c'è più, è annullata o è già pagata: ricarica la pagina")
      if (new Set(rs.map((r) => r.personaId)).size !== 1) throw new Error('Si pagano insieme solo le ricevute dello stesso tecnico')
      const { casse, voci, chiusure } = contabilita()
      const no = cosaNonVaPagamento({ ricevute: rs, data, cassaId, casse, chiusure, oggi: oggiARoma() })
      if (no) throw new Error(no === 'Scrivi il giorno del pagamento' ? 'La data del pagamento non può essere nel futuro' : no)
      const cassa = casse.find((c) => c.id === cassaId)
      if (!cassa) throw new Error('Scegli la cassa')
      const p = persona(rs[0].personaId)
      const id = `m-${unico()}`
      a().movimenti = [
        ...contabilita().movimenti,
        {
          id,
          tipo: 'uscita',
          data,
          importo: rs.reduce((s, r) => s + r.importo, 0),
          voceId: voci.find((v) => v.tipo === 'uscita' && v.diSistema && v.nome.trim().toLowerCase() === VOCE_COMPENSI.toLowerCase())?.id,
          cassaId: cassa.id,
          descrizione: descrizionePagamento(
            p.nome,
            p.cognome ?? '',
            rs.map((r) => r.mese),
            extraDelPagamento(rs),
          ),
          personaId: p.id,
          creatoIl: new Date().toISOString(),
        },
      ]
      a().ricevuteCompensi = (a().ricevuteCompensi ?? []).map((r) => (scelte.includes(r.id) ? { ...r, movimentoId: id, pagataIl: data } : r))
      salva()
    },

    async segnaFirmataCompenso(id, firmata) {
      a().ricevuteCompensi = (a().ricevuteCompensi ?? []).map((x) => (x.id === id ? { ...x, firmata } : x))
      salva()
    },

    async segnaFirmata(letteraId, firmata) {
      a().lettere = (a().lettere ?? []).map((x) => (x.id === letteraId ? { ...x, firmata } : x))
      salva()
    },

    async emettiRicevuta(dati, satispayId, pagamentoId) {
      // Da un pagamento a mano o da un Satispay: gli stessi soldi in una ricevuta sola, mai due fonti insieme.
      if (satispayId && pagamentoId) throw new Error('Una ricevuta si fa da un pagamento a mano o da un Satispay, non da tutti e due: chiudi il modulo e riaprilo')
      // Lo stesso ordine del database: col Satispay, prima che sia arrivato; dal pagamento a mano, prima che ci sia.
      const sp = satispayId ? pagamentiSatispayProva().find((x) => x.id === satispayId) : undefined
      if (satispayId && sp?.stato !== 'pagato') throw new Error('Questo pagamento Satispay non è arrivato')
      const pd = pagamentoId ? (a().pagamentiDiretti ?? []).find((x) => x.id === pagamentoId) : undefined
      if (pagamentoId && !pd) throw new Error('Questo pagamento a mano non c’è più')
      // Come `ricevuta_gia_fatta` (86-ricevuta-una-volta.sql): la chiave del modulo già usata dà quella ricevuta.
      // Come `::uuid` in Postgres, le maiuscole non contano.
      const chiave = dati.chiave?.trim().toLowerCase() || undefined
      if (chiave && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(chiave))
        throw new Error('La ricevuta non si capisce: ricarica la pagina')
      const gia = chiave ? (a().ricevute ?? []).find((x) => x.chiave === chiave) : undefined
      if (gia && gia.personaId !== dati.personaId) throw new Error('Questa ricevuta è già stata fatta per un’altra persona: chiudi il modulo e riaprilo')
      if (gia?.annullataIl) throw new Error(`La ricevuta n. ${gia.numero}/${gia.anno} fatta da questo modulo è stata annullata: chiudi il modulo e riaprilo per farne un’altra`)
      // Come `emetti_ricevuta_da_pagamento` (89): la chiave prima di «già annullato», poi i soldi tali e quali.
      if (pd) {
        if (gia && pd.ricevutaId === gia.id) return gia
        if (gia) throw new Error(`La ricevuta n. ${gia.numero}/${gia.anno} fatta da questo modulo non ha dentro questo pagamento a mano: chiudi il modulo e riaprilo`)
        if (pd.annullatoIl) throw new Error('Questo pagamento a mano è già annullato: la ricevuta si fa da + FAI LA RICEVUTA')
        if (pd.personaId !== dati.personaId) throw new Error('Il pagamento a mano è di un’altra persona')
        const no = cosaNonVaDaPagamento(dati.voci, dati.data, pd)
        if (no) throw new Error(no)
      }
      // Come `emetti_ricevuta_satispay`, prima della ricevuta: un pagamento arrivato, una ricevuta sola, gli stessi soldi.
      if (sp) {
        if (gia && sp.ricevutaId === gia.id) return gia
        if (gia) throw new Error(`La ricevuta n. ${gia.numero}/${gia.anno} fatta da questo modulo non ha dentro questo pagamento Satispay: chiudi il modulo e riaprilo`)
        if (sp.ricevutaId) throw new Error('Questo pagamento Satispay è già in una ricevuta')
        if (!sp.personaId || sp.personaId !== dati.personaId) throw new Error('Il pagamento Satispay è di un’altra persona: accogli prima la sua richiesta')
        const no = cosaNonVaSatispay(dati.voci, sp)
        if (no) throw new Error(no)
      }
      if (gia) return gia
      if (dati.personaId) persona(dati.personaId)
      const r = { ...dati, intestatario: pulisciIntestatario(dati.intestatario), note: dati.note?.trim() || undefined }
      const anno = Number(r.data.slice(0, 4))
      const tutte = a().ricevute ?? []
      const prossimo = Math.max(0, ...tutte.filter((x) => x.anno === anno).map((x) => x.numero)) + 1
      const no = cosaNonVa(r, oggiARoma(), prossimo)
      if (no) throw new Error(no)
      // Come `fai_ricevuta` (92): i contanti di un giorno chiuso no, tranne quelli del pagamento a mano che diventa ricevuta.
      const chiuso = contantiInGiornoChiuso(r.voci.flatMap((v) => v.pagamenti), r.data, fino(), pd)
      if (chiuso) throw new Error(chiuso)
      // Come `fai_ricevuta` (93): il numero dato solo in un anno vuoto, se no il primo dopo l'ultimo.
      const numero = r.numero ?? prossimo
      const voci = r.voci.map((v) => ({ ...v, descrizione: v.descrizione.trim(), pagamenti: v.pagamenti.filter((p) => p.importo > 0) }))
      const c = contiRicevuta({ voci, anticipo: r.anticipo })
      const { numero: _n, ...resto } = r
      const nuova: Ricevuta = { ...resto, chiave, voci, id: `r-${unico()}`, anno, numero, totale: c.totale, pagato: c.pagato, creataIl: new Date().toISOString() }
      a().ricevute = [...tutte, nuova]
      salva()
      if (satispayId) salvaSatispay(pagamentiSatispayProva().map((x) => (x.id === satispayId ? { ...x, ricevutaId: nuova.id } : x)))
      if (pd) {
        a().pagamentiDiretti = (a().pagamentiDiretti ?? []).map((y) => (y.id === pd.id ? { ...y, annullatoIl: new Date().toISOString(), ricevutaId: nuova.id } : y))
        salva()
      }
      return nuova
    },

    async pagamentiSatispay() {
      return pagamentiSatispayProva()
    },

    async annullaRicevuta(id) {
      const r = (a().ricevute ?? []).find((x) => x.id === id)
      if (!r || r.annullataIl) throw new Error('Ricevuta inesistente o già annullata')
      a().ricevute = (a().ricevute ?? []).map((x) => (x.id === id ? { ...x, annullataIl: new Date().toISOString() } : x))
      // Come `annulla_ricevuta` (89): il pagamento a mano che era diventato questa ricevuta torna com'era.
      a().pagamentiDiretti = (a().pagamentiDiretti ?? []).map((y) => {
        if (y.ricevutaId !== id) return y
        const { annullatoIl: _annullato, ricevutaId: _ricevuta, ...comEra } = y
        return comEra
      })
      salva()
    },

    // Le stesse regole di `controlla_invio_ricevuta` e della Edge Function, senza rete: nessuna mail parte davvero.
    async mandaRicevuta(id) {
      const r = (a().ricevute ?? []).find((x) => x.id === id)
      if (!r) return { esito: 'non partita', motivo: 'posta' }
      if (r.annullataIl) return { esito: 'non partita', motivo: 'annullata' }
      const invii = a().inviiRicevute ?? []
      // Come il database: la stessa ricevuta al più tre volte in 24 ore, e la quarta non lascia righe.
      const dal = Date.now() - 24 * 3600_000
      if (invii.filter((i) => i.ricevutaId === id && i.esito === 'mandata' && Date.parse(i.creatoIl) > dal).length >= TETTO_PER_RICEVUTA) return { esito: 'non partita', motivo: 'troppe' }
      const indirizzo = a().persone.find((p) => p.id === r.personaId)?.email?.trim()
      if (!indirizzo) return { esito: 'non partita', motivo: 'senza-indirizzo' }
      const creatoIl = new Date().toISOString()
      const troppe = mandateOggi(invii, new Date()) >= SOGLIA_MAIL_GIORNO
      a().inviiRicevute = [...invii, troppe ? { ricevutaId: id, creatoIl, indirizzo, esito: 'non partita', motivo: 'soglia' } : { ricevutaId: id, creatoIl, indirizzo, esito: 'mandata' }]
      salva()
      return troppe ? { esito: 'non partita', motivo: 'soglia' } : { esito: 'mandata', indirizzo }
    },

    async inviiRicevute(personaId) {
      const sue = new Set((a().ricevute ?? []).filter((r) => r.personaId === personaId).map((r) => r.id))
      return (a().inviiRicevute ?? []).filter((i) => sue.has(i.ricevutaId)).sort((x, y) => x.creatoIl.localeCompare(y.creatoIl))
    },

    // Come `segna_sollecito`: solo su una scheda attiva. In prova non si sa chi è collegato: il nome resta vuoto.
    async segnaSollecito(personaId) {
      if (!a().persone.some((p) => p.id === personaId && p.attiva)) throw new Error('La scheda non c’è o è disattivata.')
      const creatoIl = new Date().toISOString()
      a().solleciti = [...(a().solleciti ?? []), { personaId, creatoIl, da: '' }]
      salva()
      return creatoIl
    },

    async ultimiSolleciti() {
      const tutti = new Map<string, UltimoSollecito>()
      for (const s of a().solleciti ?? []) if ((tutti.get(s.personaId)?.quando ?? '') < s.creatoIl) tutti.set(s.personaId, { quando: s.creatoIl, da: s.da })
      return tutti
    },

    // Come `togli_sollecito`: l'ultimo, solo entro 15 minuti. In prova si è sempre la stessa segreteria.
    async togliSollecito(personaId) {
      const suoi = (a().solleciti ?? []).filter((s) => s.personaId === personaId).sort((x, y) => y.creatoIl.localeCompare(x.creatoIl))
      if (!suoi[0] || Date.parse(suoi[0].creatoIl) < Date.now() - 15 * 60_000) return false
      a().solleciti = (a().solleciti ?? []).filter((s) => s !== suoi[0])
      salva()
      return true
    },

    async genitori() {
      const tutti = new Map<string, DatiGenitore>()
      for (const p of a().persone) {
        const an = anagraficaDi(p.id)
        const { genitoreNome, genitoreCognome, genitoreCodiceFiscale, codiceFiscale } = an?.dati ?? {}
        if (an) tutti.set(p.id, Object.fromEntries(Object.entries({ genitoreNome, genitoreCognome, genitoreCodiceFiscale, codiceFiscale }).filter(([, v]) => v)))
      }
      return tutti
    },

    async ultimoSollecito(personaId) {
      const u = (a().solleciti ?? []).filter((s) => s.personaId === personaId).sort((x, y) => y.creatoIl.localeCompare(x.creatoIl))[0]
      return u ? { quando: u.creatoIl, da: u.da } : null
    },

    async esitiInvioRicevuta(id) {
      // Come `esiti_invio_ricevuta`: data ed esito, senza indirizzo né motivo.
      return (a().inviiRicevute ?? []).filter((i) => i.ricevutaId === id).map(({ ricevutaId, creatoIl, esito }) => ({ ricevutaId, creatoIl, esito }))
    },

    async ricevuteEmailDal() {
      if (!a().ricevuteEmailDal) {
        a().ricevuteEmailDal = new Date().toISOString()
        salva()
      }
      return a().ricevuteEmailDal ?? null
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
      const chi = vuolePersona(d.tipo, voci.find((v) => v.id === d.voceId)?.nome) ? d.personaId : undefined
      if (chi && !a().persone.some((p) => p.id === chi)) throw new Error(SCEGLI_LA_PERSONA)
      const id = `m-${unico()}`
      a().movimenti = [
        ...contabilita().movimenti,
        { id, tipo: d.tipo, data: d.data, importo: d.importo, voceId: d.voceId, cassaId: d.cassaId, descrizione: d.descrizione.trim(), ...(d.nota?.trim() ? { nota: d.nota.trim() } : {}), creatoIl: new Date().toISOString() },
      ]
      if (chi) scriviCollegamento(id, chi)
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
      // Come il trigger `compensi_tornano`: il pagamento annullato rimette le sue ricevute da pagare.
      a().ricevuteCompensi = (a().ricevuteCompensi ?? []).map((r) => (r.movimentoId === id ? { ...r, movimentoId: null, pagataIl: null } : r))
      salva()
    },

    async importaMovimentiBanca(dati) {
      const { voci, casse, movimenti } = contabilita()
      const conto = casse.find((c) => c.nome === NOME_CASSA_CONTO)
      if (!conto) throw new Error('Manca la cassa Conto Corrente')
      // Come `importa_prima_nota`: tutto o niente, e con le stesse regole di un movimento a mano.
      if (dati.length > MASSIMO_PER_IMPORTAZIONE) throw new Error(`Troppi movimenti in una volta: al massimo ${MASSIMO_PER_IMPORTAZIONE}`)
      if (new Set(dati.map((d) => d.chiave)).size !== dati.length) throw new Error('Nel file ci sono movimenti ripetuti')
      const scritte = new Set(movimenti.map((m) => m.origineImport).filter((k): k is string => !!k))
      const nuovi = dati.filter((d) => !scritte.has(d.chiave))
      const quando = new Date().toISOString()
      const righe = nuovi.map((d) => {
        const voce = voci.find((v) => v.nome.trim().toLowerCase() === d.voce.trim().toLowerCase() && v.tipo === d.tipo)
        const no = cosaNonVaMovimento({ ...d, cassaId: conto.id, voceId: voce?.id }, voci.map((v) => (v.id === voce?.id ? { ...v, attiva: true } : v)), casse, oggiARoma(), contabilita().chiusure)
        if (no) throw new Error(no)
        return { id: `m-${unico()}`, tipo: d.tipo, data: d.data, importo: d.importo, voceId: voce?.id ?? '', cassaId: conto.id, descrizione: d.descrizione.trim(), origineImport: d.chiave, creatoIl: quando }
      })
      a().movimenti = [...movimenti, ...righe]
      salva()
      return nuovi.length
    },

    async annullaImportazioneBanca(creatoIl) {
      const lotto = (m: { origineImport?: string; annullatoIl?: string; creatoIl: string }) => !!m.origineImport?.startsWith(PREFISSO_CHIAVE_BANCA) && !m.annullatoIl && m.creatoIl === creatoIl
      const n = contabilita().movimenti.filter(lotto).length
      const quando = new Date().toISOString()
      a().movimenti = contabilita().movimenti.map((m) => (lotto(m) ? { ...m, annullatoIl: quando } : m))
      salva()
      return n
    },

    async cambiaVoceMovimenti(ids, voceId, personaId) {
      const { movimenti, voci } = contabilita()
      const no = cosaNonVaCambioVoce(ids, righeMovimenti([], movimenti, voci), voci, voceId, personaId)
      if (no) throw new Error(no)
      const scelti = new Set(ids)
      const arrivo = voci.find((v) => v.id === voceId)
      // Come il database: la persona conta solo per un movimento a mano che arriva su una quota o un corso.
      const aMano = movimenti.filter((x) => scelti.has(x.id) && x.voceId !== voceId && vuolePersona(x.tipo, arrivo?.nome) && !x.origineImport?.startsWith('prima-nota:'))
      if (aMano.length && !a().persone.some((p) => p.id === personaId)) throw new Error(SCEGLI_LA_PERSONA)
      const quando = new Date().toISOString()
      const cambiVoce = [...(a().cambiVoce ?? [])]
      let cambiati = 0
      let giaCosi = 0
      a().movimenti = movimenti.map((x) => {
        if (!scelti.has(x.id)) return x
        if (x.voceId === voceId) {
          giaCosi++
          return x
        }
        cambiati++
        cambiVoce.push({ movimentoId: x.id, quando, chi: 'Amministrazione', prima: voci.find((v) => v.id === x.voceId)?.nome ?? '—', dopo: arrivo?.nome ?? '—' })
        return { ...x, voceId }
      })
      a().cambiVoce = cambiVoce
      for (const x of aMano) if (x.personaId !== personaId) scriviCollegamento(x.id, personaId)
      salva()
      return { cambiati, giaCosi }
    },

    async cambiVoceMovimento(id) {
      return (a().cambiVoce ?? []).filter((c) => c.movimentoId === id).map(({ movimentoId: _m, ...c }) => c)
    },

    // Lo storico del vecchio programma collegato alla persona (70-movimenti-persona.sql): le stesse regole del database.
    async riepilogoCollegamentiPersona() {
      return riepilogoCollegamenti(righeDelloStorico(), personePerNome())
    },

    async esitiCollegamentiPersona() {
      return esitiCollegamenti(righeDelloStorico(), personePerNome())
    },

    async collegaSicuriPersona(lotto, quanti = LIMITE_CAMBIO_VOCE) {
      if (!Number.isInteger(quanti) || quanti < 1) throw new Error('Scegli almeno un movimento')
      if (quanti > LIMITE_CAMBIO_VOCE) throw new Error(`Troppi movimenti in una volta: al massimo ${LIMITE_CAMBIO_VOCE}`)
      if (!lotto) throw new Error('Manca il lotto')
      const persone = personePerNome()
      const sicuri = () =>
        righeDelloStorico()
          .filter((r) => r.origineImport?.startsWith('prima-nota:') && !cosaNonVaCollegato(r) && !r.personaId && abbinaPersone(nomeDallaCausale(r.descrizione), persone).esito === 'sicuro')
          .sort((x, y) => x.id.localeCompare(y.id))
      const daFare = sicuri().slice(0, quanti)
      for (const r of daFare) scriviCollegamento(r.id, abbinaPersone(nomeDallaCausale(r.descrizione), persone).ids[0], lotto)
      salva()
      return { collegati: daFare.length, restano: sicuri().length }
    },

    async collegaMovimentiPersona(ids, persona) {
      const elenco = [...new Set(ids)].sort()
      if (!elenco.length) throw new Error('Scegli almeno un movimento')
      if (elenco.length > LIMITE_CAMBIO_VOCE) throw new Error(`Troppi movimenti in una volta: al massimo ${LIMITE_CAMBIO_VOCE}`)
      if (!persona || !a().persone.some((p) => p.id === persona)) throw new Error(SCEGLI_LA_PERSONA)
      const scelte = righeScelte(elenco)
      for (const r of scelte) {
        const no = cosaNonVaCollegato(r)
        if (no) throw new Error(no)
      }
      let collegati = 0
      let giaCosi = 0
      for (const r of scelte) {
        if (r.personaId === persona) giaCosi++
        else {
          scriviCollegamento(r.id, persona)
          collegati++
        }
      }
      salva()
      return { collegati, giaCosi }
    },

    async scollegaMovimentiPersona(ids) {
      const elenco = [...new Set(ids)].sort()
      if (!elenco.length) throw new Error('Scegli almeno un movimento')
      if (elenco.length > LIMITE_CAMBIO_VOCE) throw new Error(`Troppi movimenti in una volta: al massimo ${LIMITE_CAMBIO_VOCE}`)
      let scollegati = 0
      let giaSenza = 0
      for (const r of righeScelte(elenco)) {
        if (!r.personaId) giaSenza++
        else {
          scriviCollegamento(r.id, undefined)
          scollegati++
        }
      }
      salva()
      return { scollegati, giaSenza }
    },

    async togliLottoCollegamenti(lotto) {
      // Un collegamento a mano non ha lotto: senza lotto non c'è niente da togliere (nel database null non è uguale a null).
      if (!lotto) return { tolti: 0 }
      const tracce = a().collegamentiPersona ?? []
      const daTogliere = righeDelloStorico().filter((r) => {
        if (!r.personaId) return false
        const ultima = [...tracce].reverse().find((t) => t.movimentoId === r.id)
        return !!ultima && ultima.lotto === lotto && ultima.dopo === r.personaId
      })
      for (const r of daTogliere) scriviCollegamento(r.id, undefined)
      salva()
      return { tolti: daTogliere.length }
    },

    async candidatiPersonaMovimento(movimento) {
      const m = contabilita().movimenti.find((x) => x.id === movimento)
      if (!m) throw new Error('Il movimento non c’è')
      // Come il database: solo un movimento che si può collegare, se no sarebbe una ricerca per nome sulle schede di chiunque.
      const no = cosaNonVaCollegato(righeScelte([movimento])[0])
      if (no) throw new Error(no)
      const { ids } = abbinaPersone(nomeDallaCausale(m.descrizione), personePerNome())
      return a()
        .persone.filter((p) => ids.includes(p.id))
        .sort((x, y) => x.cognome.localeCompare(y.cognome) || x.nome.localeCompare(y.nome) || x.id.localeCompare(y.id))
        .map((p) => {
          // Anno di nascita, corsi e iscrizione servono a distinguere due omonimi: con una persona sola non escono.
          if (ids.length < 2) return { id: p.id, nome: p.nome, cognome: p.cognome, corsi: [] as string[] }
          const nato = a().anagrafiche?.[p.id]?.natoIl
          const iscrizioni = a().iscrizioni.filter((i) => i.personaId === p.id)
          const dal = iscrizioni.map((i) => i.dal).sort()[0]
          return {
            id: p.id,
            nome: p.nome,
            cognome: p.cognome,
            ...(nato ? { annoNascita: Number(nato.slice(0, 4)) } : {}),
            corsi: iscrizioni.map((i) => a().corsi.find((c) => c.id === i.corsoId)?.nome ?? '').filter(Boolean).sort(),
            ...(dal ? { iscrittoDal: dal } : {}),
          }
        })
    },

    async storicoPersona(persona) {
      const { casse, voci, movimenti } = contabilita()
      return movimenti
        .filter((x) => x.personaId === persona && !x.annullatoIl)
        .sort((x, y) => y.data.localeCompare(x.data) || x.id.localeCompare(y.id))
        .map((x) => ({
          id: x.id,
          data: x.data,
          descrizione: x.descrizione,
          importo: x.importo,
          voce: voci.find((v) => v.id === x.voceId)?.nome ?? '—',
          cassa: casse.find((c) => c.id === x.cassaId)?.nome ?? '—',
          aMano: !x.origineImport?.startsWith('prima-nota:'),
        }))
    },

    async chiusure() {
      return contabilita().chiusure.map((k) => ({ ...k }))
    },

    async contantiChiusiFino() {
      return fino()
    },

    async chiudiCassa(d) {
      const { casse, voci, movimenti, chiusure } = contabilita()
      const no = cosaNonVaChiusura(d, casse, chiusure, oggiARoma())
      if (no) throw new Error(no)
      const cassa = casse.find((c) => c.id === d.cassaId)
      if (!cassa) throw new Error('Scegli la cassa')
      const nota = d.nota?.trim() || undefined
      // Gli incassi in contanti si ricavano da ricevute e pagamenti a mano, come nell'elenco della schermata.
      const elenco = elencoMovimenti(a().ricevute ?? [], a().pagamentiDiretti ?? [], [], casse, movimenti, voci, pagamentiSatispayProva())
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

    async statoScaricoSatispay() {
      const { movimenti, voci, casse } = contabilita()
      const stato = a().satispayScarico ?? { primoFatto: false, ultimo: null, errore: null }
      return { ...stato, daDecidere: daDecidere({ negozio: a().satispayNegozio ?? [], movimenti, voci, casse }) }
    },

    async scaricaSatispay(anteprima) {
      // In prova Satispay non si chiama: il negozio ha pagamenti d'esempio, più quelli pagati col modulo.
      const pagati = pagamentiSatispayProva().filter((p) => p.stato === 'pagato')
      const letti = a().satispayNegozio ?? negozioDiProva()
      const negozio = [
        ...letti,
        ...pagati
          .filter((p) => !letti.some((n) => n.satispayId === p.id))
          .map((p): PagamentoNegozio => ({ satispayId: p.id, tipo: 'TO_BUSINESS', stato: 'ACCEPTED', importo: p.importo, quando: p.pagatoIl ?? p.creatoIl, chi: p.chi })),
      ]
      const { movimenti, voci, casse, chiusure } = contabilita()
      // Come satispay_negozio_applica: del modulo ogni id, e le righe di PAGAMENTI tranne le ricevute del modulo.
      const modulo = pagamentiSatispayProva()
      const ricevuteModulo = new Set(modulo.map((p) => p.ricevutaId))
      const pagamenti = [...righeDaRicevute(a().ricevute ?? []).filter((x) => !ricevuteModulo.has(x.ricevuta?.id)), ...righeDirette(a().pagamentiDiretti ?? [], () => '')]
      const r = applicaScarico({ negozio, modulo: modulo.map((p) => p.id), pagamenti, movimenti, voci, casse, chiusure, oggi: oggiARoma() }, !anteprima)
      // Come satispay_negozio_salva: i pagamenti letti restano anche dopo l'anteprima, senza esito.
      a().satispayNegozio = r.negozio
      if (!anteprima) {
        a().movimenti = r.movimenti
        a().satispayScarico = { primoFatto: true, ultimo: new Date().toISOString(), errore: null }
      }
      salva()
      return r.conti
    },

    async decidiSatispay(satispayId, scelta, movimentoId) {
      const { movimenti, voci, casse, chiusure } = contabilita()
      const r = decidiScarico({ negozio: a().satispayNegozio ?? [], modulo: [], pagamenti: [], movimenti, voci, casse, chiusure, oggi: oggiARoma() }, satispayId, scelta, movimentoId)
      a().satispayNegozio = r.negozio
      a().movimenti = r.movimenti
      salva()
    },

    async decidiGruppoSatispay(scelte) {
      const { movimenti, voci, casse, chiusure } = contabilita()
      const r = decidiGruppo({ negozio: a().satispayNegozio ?? [], modulo: [], pagamenti: [], movimenti, voci, casse, chiusure, oggi: oggiARoma() }, scelte)
      a().satispayNegozio = r.negozio
      a().movimenti = r.movimenti
      salva()
    },

    async scollegaSatispay(satispayId) {
      const { movimenti, voci, casse, chiusure } = contabilita()
      const r = scollegaScarico({ negozio: a().satispayNegozio ?? [], modulo: [], pagamenti: [], movimenti, voci, casse, chiusure, oggi: oggiARoma() }, satispayId)
      a().satispayNegozio = r.negozio
      a().movimenti = r.movimenti
      salva()
    },

    async negozioSatispay() {
      // Pochi pagamenti d'esempio: il mese lo sceglie `righeEntrato`.
      return a().satispayNegozio ?? []
    },

    async bancaCoperti() {
      return a().bancaCoperti ?? []
    },

    async segnaCopertiBanca(righe) {
      const conto = contabilita().casse.find((c) => c.nome === NOME_CASSA_CONTO)
      if (!conto) throw new Error('Manca la cassa Conto Corrente')
      // Come `banca_segna_coperti`: le righe il cui abbinamento non regge entrano come un import normale.
      const r = segnaCoperti(contabilita().movimenti, a().bancaCoperti ?? [], righe, conto.id)
      // Le righe nuove si scrivono prima: se una non va, i segni sui movimenti a mano non restano a metà.
      if (r.daScrivere.length) await this.importaMovimentiBanca(r.daScrivere)
      const segni = new Map(r.movimenti.filter((m) => m.bancaChiave).map((m) => [m.id, m.bancaChiave]))
      a().movimenti = contabilita().movimenti.map((m) => (segni.has(m.id) ? { ...m, bancaChiave: segni.get(m.id) } : m))
      a().bancaCoperti = r.coperti
      salva()
    },

    async nonEQuestoBanca(chiave) {
      const conto = contabilita().casse.find((c) => c.nome === NOME_CASSA_CONTO)
      if (!conto) throw new Error('Manca la cassa Conto Corrente')
      const r = nonEQuestoBanca(a().bancaCoperti ?? [], chiave, contabilita().chiusure, conto.id)
      await this.importaMovimentiBanca([r.scrivi])
      // Il movimento a mano non è più coperto: torna libero, anche per Satispay.
      a().movimenti = contabilita().movimenti.map((m) => (m.bancaChiave === chiave ? { ...m, bancaChiave: undefined } : m))
      a().bancaCoperti = r.coperti
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
      const no = cosaNonVaDiretto(dati, oggiARoma(), fino())
      if (no) throw new Error(no)
      // Come `registra_pagamento_diretto` (88-pagamento-una-volta.sql): la ricevuta di questo modulo già fatta, o un Satispay libero.
      const chiave = dati.chiaveRicevuta?.trim().toLowerCase() || undefined
      if (chiave && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(chiave))
        throw new Error('La ricevuta non si capisce: ricarica la pagina')
      const gia = chiave ? (a().ricevute ?? []).find((x) => x.chiave === chiave && x.personaId === dati.personaId && !x.annullataIl) : undefined
      if (gia) throw new Error(`Questo pagamento è già nella ricevuta n. ${gia.numero}/${gia.anno}: non va registrato di nuovo`)
      const tutti = pagamentiSatispayProva()
      // Come registra_pagamento_diretto (115-carta.sql): Satispay e la carta si controllano ognuno coi suoi soldi.
      const sp = cosaNonVaSatispayAMano(dati.metodo, satispayPerPersona(tutti.filter((x) => x.circuito !== 'carta')).get(dati.personaId), cartaPerPersona(tutti).get(dati.personaId))
      if (sp) throw new Error(sp)
      const { chiaveRicevuta: _chiave, ...senzaChiave } = dati
      const nuovo: PagamentoDiretto = { ...senzaChiave, metodo: dati.metodo.trim(), voce: dati.voce.trim(), nota: dati.nota?.trim() || undefined, id: `pd-${unico()}`, creatoIl: new Date().toISOString() }
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
      return enteDa(a().enteRicevute)
    },

    async salvaEnteRicevute(e) {
      a().enteRicevute = e
      salva()
    },

    async avvisiIndirizzi() {
      return a().avvisiIndirizzi ?? { a: null, cc: 'asdilcentrojudo@gmail.com' }
    },

    async salvaAvvisiIndirizzi(x) {
      a().avvisiIndirizzi = indirizziDaSalvare(x)
      salva()
    },

    // In prova nessuna mail parte: nessun avviso si perde.
    async avvisiNonMandatiOggi() {
      return 0
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
      // Come il trigger di 113-genitore-non-iscritto.sql: iscritto a un corso, è un iscritto come gli altri.
      a().persone = a().persone.map((p) => (p.id === personaId && p.genitoreNonIscritto ? { ...p, genitoreNonIscritto: undefined } : p))
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

    async statisticheSito(da, a) {
      // In prova il sito vero non si chiama: numeri inventati, sempre gli stessi.
      return { numeri: numeriDiProva(da, a) }
    },

    async richiesteDaDove(da, fino) {
      // Come richieste_da_dove() di 74-provenienza-richieste.sql: le righe del periodo raggruppate, e da quando si conta.
      const contate = richiesteContateProva()
      const dal = chiaveGiorno(da)
      const al = chiaveGiorno(fino)
      if (al < dal) throw new Error('il periodo è al contrario')
      const per = new Map<string, RigaDaDove>()
      for (const x of contate) {
        if (x.giorno < dal || x.giorno > al) continue
        const k = JSON.stringify([x.provenienza ?? null, x.conosciuto ?? null, x.corsi, x.stato])
        const r = per.get(k) ?? { ...(x.provenienza ? { provenienza: x.provenienza } : {}), ...(x.conosciuto ? { conosciuto: x.conosciuto } : {}), corsi: x.corsi, stato: x.stato, n: 0 }
        r.n++
        per.set(k, r)
      }
      const primo = contate.reduce<string | undefined>((m, x) => (m === undefined || x.giorno < m ? x.giorno : m), undefined)
      return { dal: primo, righe: [...per.values()] }
    },

    async titoliSito() {
      // Il sito di prova nasce al primo uso: finché la segreteria non apre SITO, i titoli sono quelli di partenza.
      const st = a().sito ?? (await sitoProva()).sitoIniziale()
      return titoliDelSito(st.pagine.map((p) => ({ slug: p.slug, titolo: p.titoloPubblicato || p.titolo })), st.rinvii ?? [])
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
      // Gli iscritti dividono le email: il conflitto è con chi ha l'accesso, se no si prende il primo iscritto.
      const stesse = email ? a().persone.filter((p) => p.id !== dati.id && p.email?.toLowerCase() === email.toLowerCase()) : []
      const altro = stesse.find((p) => p.ruolo !== 'iscritto') ?? stesse[0]
      // Come nel database: un'iscritta con la stessa email diventa personale, non un doppione.
      if (altro && altro.ruolo !== 'iscritto') throw new Error(`Questa email è già di ${nomeDi(altro)}`)
      if (altro && !dati.id) {
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
      // Le stesse regole di `28-elimina-istruttore.sql` e `66-elimina-segreteria.sql`.
      // In prova un corso archiviato conta come le sue lezioni passate: col
      // database, ha insegnato. Le ricevute e i registri non dicono chi li ha
      // firmati: la storia di chi è solo di segreteria qui non si può avere.
      const p = persona(personaId)
      // In prova è entrata la segreteria di prova.
      if (personaId === 's-prova') throw new Error("Non ci si elimina da soli: lo fa un'altra persona di segreteria")
      if (!siElimina(p))
        throw new Error(`Si eliminano solo gli istruttori e la segreteria: a ${p.nome} si toglie l'accesso`)
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
      // Come `on delete restrict` di `lettere_incarico`, che `elimina_istruttore` dice così.
      if ((a().lettere ?? []).some((x) => x.personaId === personaId) || (a().ricevuteCompensi ?? []).some((x) => x.personaId === personaId)) throw new Error(`${nome} ha già lavorato nei registri: non si elimina, gli si toglie l'accesso`)
      if ((a().pagamentiDiretti ?? []).some((x) => x.personaId === personaId))
        throw new Error(`${nome} ha dei pagamenti registrati: non si elimina, gli si toglie l'accesso`)
      // Come `on delete set null` del database: chi era nel suo nucleo resta senza.
      a().persone = a().persone.filter((x) => x.id !== personaId).map((x) => (x.nucleo === personaId ? { ...x, nucleo: undefined } : x))
      // Come `on delete set null` del database: lo storico collegato resta, senza persona, e la traccia non nomina più nessuno.
      a().movimenti = (a().movimenti ?? []).map((x) => (x.personaId === personaId ? { ...x, personaId: undefined } : x))
      a().collegamentiPersona = (a().collegamentiPersona ?? []).map((x) => ({ ...x, prima: x.prima === personaId ? undefined : x.prima, dopo: x.dopo === personaId ? undefined : x.dopo }))
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
      const attesaDelDoppione = !!v.certificato?.inAttesa && (!r.certificato?.inAttesa || v.certificato.inAttesa.il > r.certificato.inAttesa.il)
      const inAttesa = attesaDelDoppione ? v.certificato?.inAttesa : r.certificato?.inAttesa
      if (attesaDelDoppione) {
        const suo = certificatiInAttesaProva.get(via)
        scordaInAttesa(resta)
        certificatiInAttesaProva.delete(via)
        if (suo) certificatiInAttesaProva.set(resta, suo)
      } else scordaInAttesa(via)
      const unita: PersonaProva = {
        ...r,
        // Come `unisci_persone`: se le email sono due, resta quella di chi resta; `indirizziPersi` lo dice prima.
        email: r.email ?? v.email,
        telefono: r.telefono ?? v.telefono,
        // Attiva se una delle due lo era: chi trova un doppione spesso l'ha già disattivato.
        attiva: r.attiva || v.attiva,
        // Il file è di chi resta, o di chi se ne va se la sua data è più lontana (e l'altro si cancella).
        certificato:
          r.certificato || v.certificato
            ? {
                inAttesa,
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
      // Lo storico collegato passa a chi resta, e con lui la traccia: come `unisci_persone`, che sposta ogni tabella che punta a `persone`.
      a().movimenti = (a().movimenti ?? []).map((x) => (x.personaId === via ? { ...x, personaId: resta } : x))
      a().collegamentiPersona = (a().collegamentiPersona ?? []).map((x) => ({ ...x, prima: x.prima === via ? resta : x.prima, dopo: x.dopo === via ? resta : x.dopo }))
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
      const gare = unisciGare({ gare: a().gare ?? [], atleti: a().gareAtleti ?? [] }, via, resta)
      a().gare = gare.gare
      a().gareAtleti = gare.atleti
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
              bastaUno: l.corso.bastaUno ?? false,
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

    async eliminaPresenzaIstruttore(id) {
      const tutte = a().presenzeIstruttori ?? []
      const x = tutte.find((p) => p.id === id)
      if (!x) throw new Error('presenza inesistente')
      if (x.stato !== 'rifiutata') throw new Error('si elimina solo una presenza rifiutata')
      a().presenzeIstruttori = tutte.filter((p) => p.id !== id)
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

    async segnaIstruttoreAssente(sessioneId, personaId) {
      segnaIstruttoreAssenteProva(sessioneId, personaId, 'Segreteria di prova')
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
        lettere_incarico: (a().lettere ?? []).filter((l) => l.personaId === personaId).map(({ id: _id, personaId: _p, ...l }) => l),
        ricevute_compensi: (a().ricevuteCompensi ?? []).filter((r) => r.personaId === personaId).map(({ id: _id, personaId: _p, movimentoId: _m, ...r }) => r),
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
