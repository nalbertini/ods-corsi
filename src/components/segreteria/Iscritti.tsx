import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { altriAperti, altriFiltri, cellaCorsi, conSollecito, contiChip, famigliaDi, FILTRI_VISIBILI, fraseMinorenni, inFamiglia, haConto, ID_FILTRI, passaChip, senzaNascita, TESTI_FILTRI, titolariDi, type ChipConto, type ContestoFiltri, type Famiglia, type IdFiltro } from '../../lib/filtriIscritti'
import { siPerdeUscendo, type DatiPagamentoDiretto } from '../../lib/pagamenti'
import type { Destinazione } from './Segreteria'
import type { Nota } from '../ds'
import type { Anagrafica, AnagraficaDi, ComePaga, CorsoSeg, DatiPersona, DatiSegreteria, Frequenza, PersonaSeg, Segno, StatoCertificato, Timbro, Tono } from '../../lib/segreteria'
import { avvisiGesto, cercaNellElenco, cfGenitoreDaMostrare, cosaManca, eMinorenne, etichettaNatoIl, natoIlDi, sottoNome, certificatoDaStampare, certificatoInArrivo, certificatoInScadenza, certificatoPronto, comePaga, confermaDisattiva, confermaUnione, corsoDiProvenienza, cosaNonVaAnagrafica, erroreDellEmail, gestoIniziale, inCorso, pagamentoDi, percentualeBarra, presentaCertificato, pulisciAnagrafica, senzaEmail, statoCertificato, statoPerElenco, paroleTelefono, tastoPrincipale, timbriScheda, vienePoco, azioniTestata } from '../../lib/segreteria'
import { stagioneDi } from '../../lib/costi'
import { cfTornaColNome, cfTornaConLaData, cfValido } from '../../lib/codiceFiscale'
import { comuneDalCap, conIlComune, etichettaTendina, fraseDellaScelta } from '../../lib/comuneDalCap'
import { chiaveGiorno, giornoPerEsteso, oraDi } from '../../lib/sala'
import { conTessere, incrocioDaMostrare, SEGNALA_TESSERE, senzaTessera, tesseratoSenzaCorso, timbroTessera, type RigaIncrocio, type TesseraSeg } from '../../lib/tessere'
import { APRI_SCHEDA, idLinguetta, idPannello, schedaDellaSezione, schedaIniziale, SCHEDE, segniSchede, serveCambiare, tastoScheda, type IdScheda } from '../../lib/schedaSezioni'
import { ICONE_SCHEDA_ISCRITTO } from '../Icons'
import { ImportaTessere, TessereDellaPersona } from './Tessere'
import { lette } from '../../lib/letture'
import { Bozza, chiedi, Campo, useBozza, dataLunga, Guaio, lasciare, MenuAzioni, messaggio, Proposta, Riga, SchedaPiena, Stato, SegnoStato, Testa, useAvviso, useCarica, useOrdina, Tasto } from './comune'
import { NuovaRicevuta, StoricoIscritto } from './Ricevute'
import { FiltroRicerca } from './FiltroRicerca'
import type { Ricercata } from '../../lib/ricerca'
import { abbonamentiDalleRicevute, doveVaLoSconto, cosaNonVaNucleo, fratelliDaProporre, maggiorenneDal, nucleoPerRicevuta, propostaGenitore, SCONTO_FAMIGLIA } from '../../lib/nucleo'
import { minorenne } from '../../lib/richieste'
import { euro, voceQuota } from '../../lib/ricevute'
import { altraDellaCoppia, campiDiversi, coppieDoppioni, indirizziPersi, MOTIVI, motivoDoppione, possibiliDoppioni, scambiati, segnateCon, stessoContatto, vicina, type IndiziDoppioni } from '../../lib/doppioni'
import { StoricoPersona } from './CollegaPersona'
import { PagatoPrima } from './PagatoPrima'
import { CellaSollecito, SollecitoWhatsApp, useSollecito } from './Sollecito'
import { cellaSollecito, fraseSollecitato, quotaNelVecchioDi } from '../../lib/sollecito'
import { consiglioCorso, corsiDaPagare, nonPagati, statoCorsi, testoCorsoBreve, type StatoCorso } from '../../lib/corsiDaPagare'
import { bollinoCorso, iscrizioniDellaScheda, riquadroCertificato, riquadroCorso, riquadroDocumento, riquadroQuota } from '../../lib/schedeIscritto'
import { pagatoNelVecchio, soloQueste } from '../../lib/pagatoPrima'
import { Icona, ICONE_ISCRITTI } from '../Icons'

/** Quanto non è in regola, per ordinare: i guai più grossi prima. */
const GUAIO_CERTIFICATO: Record<StatoCertificato, number> = { manca: 2, scaduto: 2, in_scadenza: 1, in_arrivo: 1, valido: 0, non_serve: 0 }
const GUAIO_PAGA: Record<ComePaga, number> = { da_pagare: 2, scaduto: 2, in_parte: 1, pagato: 0 }

/**
 * L'email della scheda: una sola, per le ricevute e gli avvisi e per entrare
 * nell'app (99-email-unica.sql). Se il salvataggio è fallito, l'errore sta sotto il campo.
 */
function CampoEmail({ prefisso, email, guaio: errore, onEmail }: { prefisso: string; email: string; guaio: string; onEmail: (v: string) => void }) {
  const guaio = erroreDellEmail(errore)
  const id = `${prefisso}-email`
  const nota: Nota = guaio ? { testo: guaio, guaio: true } : { testo: 'Per le ricevute e gli avvisi, e per entrare nell’app.', guaio: false }
  return (
    <Campo id={id} etichetta="Email" nota={nota}>
      <input
        id={id}
        className="sg-campo"
        type="email"
        placeholder="nome@esempio.it"
        value={email}
        aria-invalid={!!guaio || undefined}
        aria-describedby={`${id}-nota`}
        onChange={(e) => onEmail(e.target.value)}
      />
    </Campo>
  )
}

/**
 * Un segno delle colonne CERTIFICATO e QUOTA: il pallino del colore e la parola. Il verde è un ✓ solo, la nota
 * (Non serve) una frase grigia. Sul telefono le colonne non ci sono: le parole intere vanno sotto il nome.
 */
function SegnoElenco({ s }: { s: Segno }) {
  if (s.tono === 'verde')
    return (
      <span className="sg-segno-ok" role="img" aria-label={s.parola} title={s.parola}>
        ✓
      </span>
    )
  return <SegnoStato tono={s.tono} parola={s.parola} />
}

/** Sul telefono la colonna è stretta: 30 GIORNI diventa «30 GG». */
function TestaStretta({ parola, corta }: { parola: string; corta: string }) {
  return (
    <>
      <span className="sg-testa-larga">{parola}</span>
      <span className="sg-testa-stretta">{corta}</span>
    </>
  )
}

/** Un segno dell'elenco: l'icona, e la parola nel title e per chi legge lo schermo. */
function SegnoIscritto({ icona, parola }: { icona: keyof typeof ICONE_ISCRITTI; parola: string }) {
  const Icona = ICONE_ISCRITTI[icona]
  return (
    <span className="sg-segno-iscritto" role="img" aria-label={parola} title={parola}>
      <Icona size={16} />
    </span>
  )
}

/** La famiglia nella riga: la casa, e per un familiare il nome del titolare, che apre la sua scheda. */
function CellaFamiglia({ f, onApri }: { f: Famiglia | null; onApri: (id: string) => void }) {
  if (!f) return null
  if (f.tipo === 'titolare') return <SegnoIscritto icona="casa" parola="Titolare di una famiglia" />
  const t = f.titolare
  return (
    <>
      <SegnoIscritto icona="casa" parola="In famiglia con" />
      {t ? (
        <button
          type="button"
          className="sg-famiglia-titolare"
          onClick={(e) => {
            // Il click è per il titolare, non per la riga.
            e.stopPropagation()
            onApri(t.id)
          }}
        >
          {t.cognome} {t.nome}
        </button>
      ) : (
        'Famiglia'
      )}
    </>
  )
}

function Bollino({ tono, children }: { tono: Tono; children: string }) {
  return (
    <span className="num sg-segno-regola" data-tono={tono}>
      {children}
    </span>
  )
}

/**
 * Gli iscritti: chi c'è, a cosa è iscritto, come si raggiunge, se viene.
 *
 * Un nome in elenco non ha bisogno di un accesso: gli iscritti non entrano
 * nell'app. Qui la segreteria li aggiunge, li iscrive e li toglie dai corsi.
 */
export function Iscritti({
  d,
  scelta,
  daCorso,
  onCorso,
  nuovo = false,
  onScelta,
  onNuovo,
  filtroIniziale,
  ricerca,
  onTogliRicerca,
  onConti,
  contabilita,
  onMovimento,
}: {
  d: DatiSegreteria
  /** La scheda aperta: sta nell'indirizzo, e la apre e chiude la segreteria. */
  scelta?: string
  /** Il corso da cui si è aperta la scheda: «‹ CORSO» riporta lì, se è ancora in calendario. */
  daCorso?: string
  onCorso: (corsoId: string) => void
  /** Il modulo del nuovo iscritto: sta nell'indirizzo anche lui, così Indietro lo chiude. */
  nuovo?: boolean
  /** `push` è un passo per Indietro, `replace` corregge l'indirizzo di adesso. */
  onScelta: (id: string | null, passo: 'push' | 'replace') => void
  onNuovo: () => void
  filtroIniziale?: Destinazione['filtro']
  /** Aperta da «ALTRI N» della ricerca: l'elenco è solo di chi è uscito. */
  ricerca?: Ricercata
  onTogliRicerca: () => void
  /** Una scheda cambiata (certificato, pagamento, archiviata, nuova): i conti di COSA MANCA si rileggono. */
  onConti?: () => void
  /** Chi vede CONTABILITÀ: registrando un pagamento legge dove entra. */
  contabilita?: boolean
  /** Apre in CONTABILITÀ un movimento scritto a mano per questa persona; senza, il tasto non c'è. */
  onMovimento?: (id: string) => void
}) {
  const persone = useCarica(() => d.persone(), [d])
  const pronti = lette(persone)
  const corsi = useCarica(() => d.corsi(), [d])
  const freq = useCarica(() => d.frequenze(), [d])
  const tessere = useCarica(() => d.tessere(), [d])
  const indizi = useCarica(() => d.indiziDoppioni(), [d])
  const storico = useCarica(() => d.pagatoPrima(), [d])
  // Il listino dice quali corsi si pagano: senza, nessuno ha un corso scaduto (mai un rosso per una lettura mancata).
  const listino = useCarica(() => d.listino(), [d])
  const [cerca, setCerca] = useState('')
  const [corso, setCorso] = useState('')
  const [soloSenzaEmail, setSoloSenzaEmail] = useState(false)
  const [poco, setPoco] = useState(false)
  const [certificato, setCertificato] = useState(filtroIniziale === 'certificato')
  const [scadenza, setScadenza] = useState(filtroIniziale === 'scadenza')
  const [arrivo, setArrivo] = useState(filtroIniziale === 'arrivo')
  const [pagare, setPagare] = useState(filtroIniziale === 'pagare')
  const [corsiScaduti, setCorsiScaduti] = useState(filtroIniziale === 'corsi-scaduti')
  const [fuori, setFuori] = useState(filtroIniziale === 'fuori-regola')
  const [noTessera, setNoTessera] = useState(filtroIniziale === 'senza-tessera')
  const [senzaCorso, setSenzaCorso] = useState(filtroIniziale === 'senza-corso')
  const [importa, setImporta] = useState(false)
  const [senzaDocumento, setSenzaDocumento] = useState(false)
  const [minorenni, setMinorenni] = useState(false)
  const [famiglie, setFamiglie] = useState(false)
  const [filePrima, setFilePrima] = useState(filtroIniziale === 'file-di-prima')
  const [doppi, setDoppi] = useState(false)
  const [pagatoPrima, setPagatoPrima] = useState(false)
  const [altriScelto, setAltriScelto] = useState(false)
  // Da una coppia di possibili doppioni: la scheda si apre con UNISCI già sull'altra.
  const [unisciCon, setUnisciCon] = useState<string | null>(null)
  const { avviso, avvisa, fai } = useAvviso()
  const oggi = chiaveGiorno(new Date())

  const perId = new Map((corsi.dato ?? []).map((c) => [c.id, c]))
  const attivi = (corsi.dato ?? []).filter((c) => c.attivo).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const tutti = [...(persone.dato ?? [])].sort(
    (a, b) => Number(b.attiva) - Number(a.attiva) || a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'),
  )
  // Le tessere contano solo quando si sa: lette, e il database le ha (61-tessere.sql). Mai «senza tessera» per un elenco che non è arrivato.
  const conTessereLette = !!tessere.dato && !tessere.dato.manca
  const incroci = new Map<string, RigaIncrocio[]>()
  if (conTessereLette)
    for (const r of incrocioDaMostrare(conTessere(tutti, tessere.dato!.elenco), corsi.dato ?? [], oggi)) incroci.set(r.personaId, [...(incroci.get(r.personaId) ?? []), r])
  const tesseraDi = (p: PersonaSeg) => incroci.get(p.id) ?? []
  const statiDi = (p: PersonaSeg) => (listino.dato && corsi.dato ? statoCorsi(p, corsi.dato, listino.dato.listino, oggi) : undefined)
  const scopertiDi = (p: PersonaSeg) => (listino.dato && corsi.dato ? corsiDaPagare(p, corsi.dato, listino.dato.listino, oggi) : [])
  const nFilePrima = tutti.filter((p) => certificatoDaStampare(p.certificato)).length
  // Finiti tutti (cancellati da soli o tolti), il filtro si spegne da sé.
  const soloFilePrima = filePrima && nFilePrima > 0
  const coppie = indizi.dato ? coppieDoppioni(tutti, indizi.dato) : []
  // Unite o segnate tutte, il filtro si spegne da sé.
  const soloDoppi = doppi && coppie.length > 0
  // Il filtro «Pagato nel vecchio programma» c'è solo se il database ha la lettura (71-…sql) e c'è qualcuno: mai «nessuno» per una lettura che non c'è.
  const delVecchio = storico.dato && !storico.dato.manca ? pagatoNelVecchio(tutti, storico.dato.elenco, oggi) : null
  const nelVecchio = delVecchio ? delVecchio.quota.length + delVecchio.daGuardare.length : 0
  const soloPagatoPrima = pagatoPrima && nelVecchio > 0
  // Ogni filtro con il suo stato; l'elenco dei nascosti e quali sono accesi lo dice `filtriIscritti.ts`.
  const filtri: Record<IdFiltro, [boolean, (v: boolean) => void]> = {
    'senza-email': [soloSenzaEmail, setSoloSenzaEmail],
    poco: [poco, setPoco],
    certificato: [certificato, setCertificato],
    scadenza: [scadenza, setScadenza],
    arrivo: [arrivo, setArrivo],
    pagare: [pagare, setPagare],
    'corsi-scaduti': [corsiScaduti, setCorsiScaduti],
    fuori: [fuori, setFuori],
    'senza-tessera': [noTessera, setNoTessera],
    'senza-corso': [senzaCorso, setSenzaCorso],
    'senza-documento': [senzaDocumento, setSenzaDocumento],
    'file-di-prima': [soloFilePrima, setFilePrima],
    doppioni: [soloDoppi, setDoppi],
    'pagato-prima': [soloPagatoPrima, setPagatoPrima],
    minorenni: [minorenni, setMinorenni],
    famiglie: [famiglie, setFamiglie],
  }
  // A segnalazioni spente resta solo «Tesserati senza corso»: «Senza tessera» non si mostra.
  const altri = altriFiltri({ conTessere: conTessereLette, filePrima: nFilePrima, doppioni: coppie.length, conStorico: nelVecchio > 0, segnalaTessere: SEGNALA_TESSERE })
  const accesi = ID_FILTRI.filter((id) => filtri[id][0])
  const altriVisibili = altriAperti(accesi, altriScelto)
  // Il gruppo è aperto solo perché un filtro nascosto è acceso: finché lo è, non si chiude.
  const altriForzato = altriVisibili && !altriScelto
  const togliFiltri = () => {
    setCerca('')
    setCorso('')
    accesi.forEach((id) => filtri[id][1](false))
  }
  const titolari = titolariDi(tutti)
  const contesto: ContestoFiltri = { oggi, scopertiDi, tesseraDi, titolari }
  const personaPerId = new Map(tutti.map((p) => [p.id, p]))
  const famigliaDiP = (p: PersonaSeg) => famigliaDi(p, personaPerId, titolari)
  // Ricerca e corso: quel che resta scelto quando si accende un chip, e su cui si contano i chip.
  const inBase = (p: PersonaSeg) =>
    (!ricerca || ricerca.ids.includes(p.id)) && cercaNellElenco(p, cerca) && (!corso || p.iscrizioni.some((i) => i.corsoId === corso && inCorso(i, oggi)))
  const conti = contiChip(tutti, inBase, contesto)
  const minorenneP = (p: PersonaSeg) => passaChip('minorenni', p, contesto)
  // Chi non ha la data di nascita non è contato: la segreteria deve sapere che il conto non è completo.
  const sottoMinorenni = minorenni ? fraseMinorenni(conti.minorenni, senzaNascita(tutti.filter(inBase))) : ''
  const apriTitolare = (id: string) => {
    setUnisciCon(null)
    onScelta(id, 'push')
  }
  const chipFiltro = (id: IdFiltro) => (
    <button key={id} type="button" className="num sg-chip" aria-pressed={filtri[id][0]} onClick={() => filtri[id][1](!filtri[id][0])}>
      {TESTI_FILTRI[id]}
      {id === 'doppioni' ? ` ${coppie.length}` : id === 'pagato-prima' ? ` ${nelVecchio}` : haConto(id) ? ` · ${conti[id]}` : ''}
    </button>
  )
  const chip = (id: ChipConto, acceso: boolean, p: PersonaSeg) => !acceso || passaChip(id, p, contesto)
  const trovati = tutti.filter(
    (p) =>
      inBase(p) &&
      (!soloSenzaEmail || senzaEmail(p)) &&
      (!poco || vienePoco(freq.dato?.get(p.id))) &&
      chip('certificato', certificato, p) &&
      (!scadenza || certificatoInScadenza(p, oggi)) &&
      (!arrivo || certificatoInArrivo(p, oggi)) &&
      chip('pagare', pagare, p) &&
      chip('corsi-scaduti', corsiScaduti, p) &&
      chip('fuori', fuori, p) &&
      chip('minorenni', minorenni, p) &&
      (!famiglie || inFamiglia(p, titolari)) &&
      (!noTessera || senzaTessera(tesseraDi(p))) &&
      (!senzaCorso || tesseratoSenzaCorso(tesseraDi(p))) &&
      (!senzaDocumento || !p.documento) &&
      (!soloFilePrima || certificatoDaStampare(p.certificato)),
  )
  // Coi filtri di chi ha qualcosa da sistemare, la colonna WHATSAPP: le letture in blocco partono solo allora.
  const sollecitare = conSollecito(accesi)
  const perSollecito = useCarica(
    async () => {
      if (!sollecitare) return null
      // Il genitore serve solo ai minorenni: se non si legge (`genitori` lo regge da sé), il tasto resta col messaggio senza genitore.
      const [listino, genitori] = await Promise.all([d.listino(), d.genitori()])
      return { quota: voceQuota(listino.listino).voce(oggi).prezzo, genitori }
    },
    [d, sollecitare, oggi],
  )
  // Un sollecito segnato o tolto, dalla riga o dalla scheda: si rileggono tutte e due.
  const [giroSolleciti, setGiroSolleciti] = useState(0)
  const sollecitati = useCarica(async () => (sollecitare ? d.ultimiSolleciti() : null), [d, sollecitare, giroSolleciti])
  const nelVecchioIds = quotaNelVecchioDi(delVecchio)
  const cellaDi = (p: PersonaSeg) =>
    perSollecito.dato
      ? cellaSollecito(p, perSollecito.dato.genitori.get(p.id), perSollecito.dato.quota, oggi, {
          quotaNelVecchio: nelVecchioIds.has(p.id),
          tesseraDaSistemare: senzaTessera(tesseraDi(p)),
          corsi: statiDi(p),
          titolari,
        })
      : null
  const suoiCorsi = (p: PersonaSeg) => p.iscrizioni.filter((i) => inCorso(i, oggi)).map((i) => perId.get(i.corsoId)?.nome).filter(Boolean)
  const { ordina, colonna } = useOrdina<PersonaSeg, 'nome' | 'certificato' | 'quota' | 'corsi' | 'contatto' | 'frequenza'>({
    nome: (p) => `${p.cognome} ${p.nome}`,
    certificato: (p) => GUAIO_CERTIFICATO[statoCertificato(p, oggi)],
    // La tessera da sistemare sta nella colonna QUOTA: pesa come un guaio piccolo.
    quota: (p) => GUAIO_PAGA[comePaga(p, oggi)] + Number(senzaTessera(tesseraDi(p))),
    corsi: (p) => suoiCorsi(p).join(', '),
    contatto: (p) => p.telefono ?? p.email,
    frequenza: (p) => {
      const f = freq.dato?.get(p.id)
      return f && f.dovute ? f.presenti / f.dovute : null
    },
  })
  // Il genitore non iscritto non è un iscritto: non conta fra le persone attive né fra i certificati in scadenza.
  const attiveOra = tutti.filter((p) => p.attiva && !p.genitoreNonIscritto)
  const inScadenza = attiveOra.filter((p) => certificatoInScadenza(p, oggi)).length
  const nScaduti = corsiScaduti ? attiveOra.filter((p) => scopertiDi(p).length > 0).length : 0
  const persona = nuovo ? null : (tutti.find((p) => p.id === scelta) ?? null)
  const ricarica = () => Promise.all([persone.ricarica(), freq.ricarica(), indizi.ricarica(), tessere.ricarica(), storico.ricarica()])

  const chiudi = () => {
    setUnisciCon(null)
    if (scelta || nuovo) onScelta(null, 'push')
  }
  // ← ISCRITTI con un iscritto nuovo o una ricevuta a metà: la stessa domanda del menu e di Indietro.
  // Aperta da un corso ancora in calendario, il tasto riporta lì; se no (corso archiviato, indirizzo inventato) all'elenco.
  const corsoDa = corsoDiProvenienza(daCorso, corsi.dato ?? [])
  const torna = async () => {
    if (!(await lasciare())) return
    if (corsoDa) onCorso(corsoDa)
    else chiudi()
  }
  // Un `?corso=` che non porta a un corso in calendario si toglie dall'indirizzo, senza avviso: la persona c'è.
  useEffect(() => {
    if (!daCorso || !scelta || !corsi.dato || corsoDa) return
    onScelta(scelta, 'replace')
    // All'arrivo dei corsi e quando cambia il corso di provenienza (Avanti del browser).
  }, [corsi.dato, daCorso])

  // Una scheda di qualcuno che non c'è più (un link vecchio, un'altra
  // finestra): si torna all'elenco e lo si dice. Solo quando l'elenco arriva:
  // un iscritto appena salvato non è ancora in quello di prima.
  useEffect(() => {
    if (!scelta || !persone.dato || persone.dato.some((p) => p.id === scelta)) return
    avvisa('Quell’iscritto non c’è più')
    onScelta(null, 'replace')
    // Solo all'arrivo dell'elenco: aprire una scheda non è un motivo per guardare.
  }, [persone.dato])

  return (
    <>
      {importa ? (
        <SchedaPiena etichetta="Importa tessere" torna="Iscritti" onTorna={() => setImporta(false)}>
          <ImportaTessere d={d} ricarica={tessere.ricarica} />
        </SchedaPiena>
      ) : nuovo ? (
        <SchedaPiena etichetta="Nuovo iscritto" torna="Iscritti" onTorna={torna}>
          <Bozza>
          <Nuovo
            d={d}
            corsi={attivi}
            fai={fai}
            onLasciaStare={chiudi}
            onSalvato={(id) => {
              // Al posto del modulo: Indietro dalla scheda nuova torna all'elenco, non a un modulo vuoto.
              onScelta(id, 'replace')
              void ricarica()
              onConti?.()
            }}
          />
          </Bozza>
        </SchedaPiena>
      ) : persona ? (
        <SchedaPiena key={persona.id} etichetta={`Scheda di ${persona.nome} ${persona.cognome}`} torna={corsoDa ? 'Corso' : 'Iscritti'} onTorna={torna}>
          <Scheda
            d={d}
            p={persona}
            tutti={tutti}
            corsi={perId}
            statiCorsi={statiDi(persona)}
            attivi={attivi}
            f={freq.dato?.get(persona.id)}
            tessere={conTessereLette ? tessere.dato!.elenco : undefined}
            fai={fai}
            avvisa={avvisa}
            contabilita={contabilita}
            onMovimento={onMovimento}
            quotaNelVecchio={nelVecchioIds.has(persona.id)}
            titolari={titolari}
            giroSolleciti={giroSolleciti}
            onSollecitato={() => setGiroSolleciti((g) => g + 1)}
            onCambiato={() => {
              void ricarica()
              onConti?.()
            }}
            onApri={(id) => {
              setUnisciCon(null)
              onScelta(id, 'push')
            }}
            unisciCon={unisciCon ?? undefined}
            doppio={altraDellaCoppia(coppie, persona.id)}
            nonDoppioni={indizi.dato ? segnateCon(indizi.dato, persona.id, tutti) : []}
          />
        </SchedaPiena>
      ) : null}

      {/* L'elenco resta montato sotto la scheda, con la ricerca e i filtri di prima. */}
      <div className="stack" style={{ gap: 18 }}>
        <Testa
          titolo="ISCRITTI"
          // Senza certificato e da pagare li dicono i chip, coi loro conti.
          sotto={corsiScaduti ? `${nScaduti === 1 ? 'Un iscritto ha' : `${nScaduti} iscritti hanno`} un corso scaduto o pagato in parte.` : minorenni ? sottoMinorenni : `${attiveOra.length} persone attive${inScadenza ? ` · ${inScadenza === 1 ? 'un certificato' : `${inScadenza} certificati`} in scadenza` : ''}.${
            nFilePrima === 1 ? ' Un certificato da archiviare.' : nFilePrima ? ` ${nFilePrima} certificati da archiviare.` : ''
          }`}
        >
          {conTessereLette && (
            <Tasto onClick={() => setImporta(true)}>
              Importa tessere
            </Tasto>
          )}
          <Tasto tono="pieno" icona="aggiungi" onClick={onNuovo}>
            Nuovo iscritto
          </Tasto>
        </Testa>

        {/* Filtri ed elenco compaiono insieme, a letture finite: se arrivano uno alla volta, ognuno sposta l'altro. */}
        {!pronti && <p className="sg-sotto">Sto leggendo gli iscritti…</p>}
        {pronti && (
        <>
        {ricerca && <FiltroRicerca ricerca={ricerca} onTogli={onTogliRicerca} />}
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', flexBasis: '100%', minWidth: 0 }}>
          <label htmlFor="cerca" className="vh">
            Cerca un iscritto
          </label>
          <input id="cerca" className="sg-campo" type="search" placeholder="Cerca per nome o email" style={{ width: 360, maxWidth: '100%' }} value={cerca} onChange={(e) => setCerca(e.target.value)} />
          <label htmlFor="filtro" className="vh">
            Corso
          </label>
          <select id="filtro" className="sg-campo" value={corso} onChange={(e) => setCorso(e.target.value)}>
            <option value="">Tutti i corsi</option>
            {attivi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          </div>
          {FILTRI_VISIBILI.map(chipFiltro)}
          {/* Con un filtro nascosto acceso il gruppo non si chiude: un filtro acceso non resta mai nascosto. Il tasto lo dice. */}
          <button
            type="button"
            className="sg-link sg-link-alto sg-altri-filtri"
            aria-expanded={altriVisibili}
            aria-controls={altriVisibili ? 'altri-filtri' : undefined}
            aria-disabled={altriForzato || undefined}
            title={altriForzato ? 'Uno di questi filtri è acceso: spegnilo per chiudere' : undefined}
            onClick={() => !altriForzato && setAltriScelto(!altriScelto)}
          >
            Altri filtri ({altri.length}
            {altriForzato ? `, ${accesi.filter((id) => !FILTRI_VISIBILI.includes(id)).length} acceso` : ''}) <span aria-hidden="true">{altriVisibili ? '▴' : '▾'}</span>
          </button>
          {altriVisibili && (
            <div id="altri-filtri" className="row" style={{ gap: 10, flexWrap: 'wrap', flexBasis: '100%' }}>
              {altri.map(chipFiltro)}
            </div>
          )}
        </div>

        {persone.guaio && <Guaio testo={persone.guaio} />}
        {storico.guaio && <Guaio testo={storico.guaio} />}

        {soloPagatoPrima && delVecchio ? (
          <PagatoPrima
            d={d}
            persone={tutti}
            // Ricerca e corso scelti sopra valgono anche qui.
            gruppi={soloQueste(delVecchio, new Set(trovati.map((p) => p.id)))}
            onApri={(id) => {
              setUnisciCon(null)
              onScelta(id, 'push')
            }}
            onCambiato={() => {
              void ricarica()
              onConti?.()
            }}
            avvisa={avvisa}
          />
        ) : soloDoppi && indizi.dato ? (
          <CoppieDoppioni
            // Ricerca e filtri valgono anche qui: resta una coppia se una delle due passa.
            coppie={coppie.filter((c) => c.some((x) => trovati.includes(x)))}
            indizi={indizi.dato}
            suoiCorsi={suoiCorsi}
            onUnisci={(a, b) => {
              setUnisciCon(b)
              onScelta(a, 'push')
            }}
            onNonDoppioni={async (a, b) => {
              const nome = (id: string) => {
                const x = tutti.find((y) => y.id === id)
                return x ? `${x.cognome} ${x.nome}` : ''
              }
              if (!(await chiedi(`${nome(a)} e ${nome(b)} non sono la stessa persona? La coppia non compare più fra i possibili doppioni.`, 'Sì, non sono doppioni'))) return
              // Toccato per sbaglio ce se ne accorge subito: ANNULLA nell'avviso, senza aprire la scheda.
              void fai(
                () => d.segnaNonDoppioni(a, b),
                undefined,
                async () => {
                  await indizi.ricarica()
                  avvisa('Segnati: non sono doppioni', false, {
                    etichetta: 'Annulla',
                    fa: () => void fai(() => d.togliNonDoppioni(a, b), 'Tornati fra i possibili doppioni', () => indizi.ricarica()),
                  })
                },
              )
            }}
          />
        ) : (
        <>
        {sollecitare && perSollecito.guaio && <Guaio titolo="WHATSAPP" testo={`La colonna dei solleciti non si è letta: ${perSollecito.guaio}`} />}
        <div className="sg-elenco">
        <div role="table" aria-label="Iscritti" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-iscritto sg-riga-iscritti" data-sollecito={sollecitare || undefined}>
            {colonna('nome', 'NOME', { icona: 'persona' })}
            <span role="columnheader" className="sg-etichetta">FAMIGLIA</span>
            {colonna('certificato', 'CERTIFICATO', { numeri: true, icona: 'certificato' })}
            {colonna('quota', 'QUOTA', { numeri: true, icona: 'quota' })}
            {colonna('corsi', 'CORSI', { icona: 'corso' })}
            {colonna('contatto', 'CONTATTO', { icona: 'telefono' })}
            {colonna('frequenza', <TestaStretta parola="30 GIORNI" corta="30 GG" />, { numeri: true, destra: true, icona: 'calendario' })}
            {sollecitare && <span role="columnheader" className="sg-etichetta sg-cella-sollecito-testa">WHATSAPP</span>}
          </div>
          <div className="sg-tabella-corpo">
            {persone.dato !== null && trovati.length === 0 && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Nessuno corrisponde alla ricerca. <button type="button" className="sg-link sg-link-alto" onClick={togliFiltri}>Togli ricerca e filtri</button></p>}
            {ordina(trovati).map((p) => {
              const f = freq.dato?.get(p.id)
              // Col filtro, al posto dei corsi quelli da pagare con la data: si legge chi sollecitare per cosa.
              const suoi = corsiScaduti ? scopertiDi(p).map(testoCorsoBreve) : suoiCorsi(p).filter((n): n is string => !!n)
              const cella = cellaCorsi(suoi, corsiScaduti)
              const stato = statoPerElenco(p, oggi, tesseraDi(p))
              const barra = percentualeBarra(f)
              const fam = famigliaDiP(p)
              return (
                // Una riga vera della tabella, che si clicca tutta; dalla tastiera e per chi legge lo schermo c'è il tasto sul nome.
                <div
                  key={p.id}
                  role="row"
                  className="sg-riga-iscritto sg-riga-iscritti sg-iscritto"
                  data-scelto={!nuovo && scelta === p.id}
                  data-spento={!p.attiva}
                  data-sollecito={sollecitare || undefined}
                  onClick={() => {
                    setUnisciCon(null)
                    onScelta(p.id, 'push')
                  }}
                >
                  <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>
                    <button type="button" className="sg-riga-apri" aria-current={!nuovo && scelta === p.id ? 'true' : undefined}>
                      {p.cognome} {p.nome}
                    </button>
                    {minorenneP(p) && <SegnoIscritto icona="bambino" parola="Minorenne" />}
                    {/* «Da archiviare» lo dice la colonna CERTIFICATO: qui resta solo chi non è un iscritto. */}
                    {p.genitoreNonIscritto && <span style={{ marginLeft: 8 }}><SegnoStato tono="nota" parola="Genitore non iscritto" /></span>}
                    {/* Sul telefono le colonne CERTIFICATO e QUOTA non ci sono: le parole intere vanno sotto il nome. */}
                    <span className="sg-stato-telefono">
                      {paroleTelefono(stato).map((s) => (
                        <SegnoStato key={s.parola} tono={s.tono} parola={s.parola} />
                      ))}
                    </span>
                    {/* Sotto i 1000 px la colonna FAMIGLIA non c'è: la famiglia va sotto il nome. */}
                    {fam && (
                      <span className="sg-sotto-nome">
                        <span className="sg-cella-famiglia"><CellaFamiglia f={fam} onApri={apriTitolare} /></span>
                      </span>
                    )}
                  </span>
                  <span role="cell" className="sg-cella-famiglia">
                    <CellaFamiglia f={fam} onApri={apriTitolare} />
                  </span>
                  <span role="cell" className="sg-stato-elenco">
                    <SegnoElenco s={stato.certificato} />
                  </span>
                  <span role="cell" className="sg-stato-elenco">
                    {stato.quota.map((s) => (
                      <SegnoElenco key={s.parola} s={s} />
                    ))}
                  </span>
                  <span role="cell" className="sg-cella-corsi" data-a-capo={corsiScaduti || undefined} title={cella.altri ? cella.title : undefined}>
                    {cella.visibili.join(corsiScaduti ? ' · ' : ', ') || '—'}
                    {cella.altri > 0 && <span className="sg-cella-piu">+{cella.altri}</span>}
                  </span>
                  <span role="cell" className="sg-cella-contatto" data-manca={!(p.email || p.telefono) || undefined}>
                    {(p.telefono || p.email) && <span className="sg-icona-contatto"><Icona nome={p.telefono ? 'telefono' : 'email'} misura={14} /></span>}
                    {p.telefono ?? p.email ?? 'nessun contatto'}
                  </span>
                  <span
                    role="cell"
                    className="num sg-cella-frequenza"
                    data-poco={vienePoco(f) || undefined}
                    title={barra === null ? undefined : `Presenze negli ultimi 30 giorni su lezioni avute, senza i giustificati${vienePoco(f) ? '. In giallo: è venuto a meno della metà.' : '.'}`}
                  >
                    {f ? `${f.presenti}/${f.dovute}` : '—'}
                    {barra !== null && (
                      <span className="sg-barra-frequenza" aria-hidden="true">
                        <span style={{ width: `${barra}%` }} />
                      </span>
                    )}
                  </span>
                  {sollecitare && <CellaSollecito d={d} p={p} cella={cellaDi(p)} ultimo={sollecitati.dato?.get(p.id)} avvisa={avvisa} dopo={() => setGiroSolleciti((g) => g + 1)} />}
                </div>
              )
            })}
          </div>
          <span className="sg-sotto" style={{ fontSize: 12, padding: '10px 14px' }}>
            {trovati.length === tutti.length ? `${tutti.length} in elenco` : `${trovati.length} di ${tutti.length}`}
            {' · '}
            30 GIORNI: presenze su lezioni avute, senza i giustificati
          </span>
        </div>
        </div>
        </>
        )}
        </>
        )}
      </div>
      {avviso}
    </>
  )
}

type Fai = ReturnType<typeof useAvviso>['fai']

function Nuovo({
  d,
  corsi,
  fai,
  onLasciaStare,
  onSalvato,
}: {
  d: DatiSegreteria
  corsi: CorsoSeg[]
  fai: Fai
  onLasciaStare: () => void
  onSalvato: (id: string) => void
}) {
  const [b, setB] = useState<DatiPersona & { corso: string }>({ nome: '', cognome: '', email: '', telefono: '', corso: '' })
  // Cosa non va nell'email, sotto il campo; l'avviso in basso resta.
  const [guaio, setGuaio] = useState('')
  const salva = () => {
    let id = ''
    setGuaio('')
    void fai(
      async () => {
        id = await d.salvaPersona(b).catch((e: unknown) => {
          setGuaio(messaggio(e))
          throw e
        })
        if (!b.corso) return
        try {
          await d.iscrivi(id, b.corso)
        } catch (e) {
          // La scheda c'è: si apre, così un secondo SALVA non ne crea un'altra.
          onSalvato(id)
          throw new Error(`Scheda creata, ma l'iscrizione non è andata: ${messaggio(e)}`)
        }
      },
      b.corso ? 'Scheda creata e iscrizione fatta' : 'Scheda creata',
      () => onSalvato(id),
    )
  }
  return (
    <>
      <span className="ob" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.04em' }}>NUOVO ISCRITTO</span>
      <div className="sg-due sg-scheda-campi">
        <Campo id="n-nome" etichetta="NOME">
          <input id="n-nome" className="sg-campo" value={b.nome} onChange={(e) => setB({ ...b, nome: e.target.value })} />
        </Campo>
        <Campo id="n-cognome" etichetta="COGNOME">
          <input id="n-cognome" className="sg-campo" value={b.cognome} onChange={(e) => setB({ ...b, cognome: e.target.value })} />
        </Campo>
        <CampoEmail prefisso="n" email={b.email ?? ''} guaio={guaio} onEmail={(v) => { setGuaio(''); setB({ ...b, email: v }) }} />
        <Campo id="n-tel" etichetta="TELEFONO · FACOLTATIVO">
          <input id="n-tel" className="sg-campo" type="tel" value={b.telefono} onChange={(e) => setB({ ...b, telefono: e.target.value })} />
        </Campo>
        <Campo id="n-corso" etichetta="ISCRIVI A" largo>
          <select id="n-corso" className="sg-campo" value={b.corso} onChange={(e) => setB({ ...b, corso: e.target.value })}>
            <option value="">Nessun corso per ora</option>
            {corsi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="sg-scheda-piede">
        <button type="button" className="sg-btn sg-btn-linea grow" onClick={onLasciaStare}>
          Lascia stare
        </button>
        <Tasto tono="pieno" className="grow" disabled={!b.nome.trim() || !b.cognome.trim()} onClick={salva}>
          Salva
        </Tasto>
      </div>
    </>
  )
}

function Scheda({
  d,
  p,
  tutti,
  corsi,
  attivi,
  f,
  tessere,
  fai,
  avvisa,
  onCambiato,
  onApri,
  unisciCon,
  doppio,
  nonDoppioni,
  contabilita,
  onMovimento,
  quotaNelVecchio,
  titolari,
  giroSolleciti,
  onSollecitato,
  statiCorsi,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  /** I corsi a pagamento in corso, pagati o no (`statoCorsi`); undefined se non si sa. */
  statiCorsi?: StatoCorso[]
  /** Tutti gli iscritti, per il nucleo familiare. */
  tutti: PersonaSeg[]
  corsi: Map<string, CorsoSeg>
  attivi: CorsoSeg[]
  f?: Frequenza
  /** Le tessere di tutti; senza (il database non le ha ancora) la sezione non c'è. */
  tessere?: TesseraSeg[]
  fai: Fai
  avvisa: ReturnType<typeof useAvviso>['avvisa']
  onCambiato: () => void
  /** Apre la scheda di un'altra persona: una del nucleo. */
  onApri: (personaId: string) => void
  /** Aperta da una coppia di possibili doppioni: UNISCI già aperto su quest'altra. */
  unisciCon?: string
  /** L'altra scheda, se questa è in una sola coppia di possibili doppioni. */
  doppio?: string
  /** Le schede segnate «non sono doppioni» con questa: si tolgono da qui, se segnate per sbaglio. */
  nonDoppioni: PersonaSeg[]
  contabilita?: boolean
  onMovimento?: (id: string) => void
  /** Ha la quota pagata nel vecchio programma: il sollecito non la chiede (come la riga dell'elenco). */
  quotaNelVecchio: boolean
  /** I titolari dei nuclei: al titolare senza corsi il sollecito non chiede la quota. */
  titolari: ReadonlySet<string>
  /** Cambia quando un sollecito si segna o si toglie dall'elenco. */
  giroSolleciti: number
  onSollecitato: () => void
}) {
  const oggi = chiaveGiorno(new Date())
  const [modifica, setModifica] = useState<DatiPersona | null>(null)
  const [guaio, setGuaio] = useState('')
  // Aperta la modifica, uscire dal menu chiede prima di perderla.
  useBozza(!!modifica)
  const [daAggiungere, setDaAggiungere] = useState('')
  const [iscrivendo, setIscrivendo] = useState(false)
  const [pagando, setPagando] = useState(false)
  // Il pagamento a mano da cui parte la ricevuta: se non la si fa, il modulo si riapre con quei dati.
  const [daPagamento, setDaPagamento] = useState<DatiPagamentoDiretto | null>(null)
  const [riprendi, setRiprendi] = useState<DatiPagamentoDiretto | null>(null)
  // Uscire dalla ricevuta aperta dal pagamento lo perderebbe: prima si chiede, anche se non si è toccato niente.
  useBozza(siPerdeUscendo(daPagamento), 'Il pagamento a mano')
  // StoricoIscritto lo legge una volta, nel suo useState iniziale, quando si monta (nello stesso render, prima
  // di questo effetto): poi si dimentica, se no una ricevuta dopo lo riaprirebbe coi dati vecchi.
  useEffect(() => {
    if (riprendi && !pagando) setRiprendi(null)
  }, [riprendi, pagando])
  const [unendo, setUnendo] = useState(!!unisciCon)
  const [togliendo, setTogliendo] = useState(false)
  // Il riquadro del sollecito si apre dal tasto in testata: chiuso, la scheda parte da quel che c'è.
  const [sollecitoAperto, setSollecitoAperto] = useState(false)
  // Dopo una ricevuta nuova l'elenco delle ricevute si rilegge da capo.
  const [giroRicevute, setGiroRicevute] = useState(0)
  // Dopo i DATI ANAGRAFICI salvati il sollecito rilegge il genitore: a un minorenne si scrive a lui.
  const [giroAnagrafica, setGiroAnagrafica] = useState(0)
  // La scheda con la persona si ricrea (key): ogni persona riparte da PERSONA.
  const [aperta, setAperta] = useState<IdScheda>(schedaIniziale())
  // Un timbro cliccato: scorre e mette il fuoco solo dopo che la sua scheda si vede (un nascosto non prende il fuoco).
  const [vai, setVai] = useState<{ id: string } | null>(null)
  useEffect(() => {
    if (vai) vaiA(vai.id)
  }, [vai])
  // Il Banco («Vai alla scheda») apre la scheda del problema.
  useEffect(() => {
    // Il detail lo mette solo PersonaBanco, sempre un IdScheda.
    const apri = (e: Event) => setAperta((e as CustomEvent<IdScheda>).detail)
    window.addEventListener(APRI_SCHEDA, apri)
    return () => window.removeEventListener(APRI_SCHEDA, apri)
  }, [])
  const sollecito = useSollecito({ d, p, oggi, giro: giroAnagrafica, giroSolleciti, quotaNelVecchio, titolari, corsi: statiCorsi })
  const azioni = azioniTestata(p, !!sollecito.s, { modifica: !!modifica, unendo, pagando })
  const voci = azioni.altro
  const storico = useCarica(() => d.storico(p.id, 12), [d, p.id, p.iscrizioni.length])
  // Letti qui e non in DATI ANAGRAFICI: età e COSA MANCA in cima alla scheda li vogliono.
  const an = useCarica(async () => ({ di: await d.anagraficaDi(p.id) }), [d, p.id])
  const ora = new Date()
  const datiAn = an.dato ? (an.dato.di?.dati ?? {}) : null
  const natoIl = natoIlDi(p, datiAn, ora)
  const minore = eMinorenne(p, datiAn, ora)
  // Finché non si sono letti, niente COSA MANCA: comparirebbe e poi cambierebbe. Se non si leggono, almeno i contatti.
  const letta = !!(an.dato || an.guaio)
  // Maggiorenne nel nucleo di un genitore non iscritto: la segreteria chiede a chi intestare le ricevute.
  const diciotto = maggiorenneDal(tutti.map((x) => (x.id === p.id && natoIl ? { ...x, natoIl } : x)), p.id, chiaveGiorno(ora))
  const manca = letta ? [...cosaManca(p, datiAn, ora), ...(diciotto ? [{ cosa: `Maggiorenne dal ${dataLunga(diciotto, false)}`, perche: 'chiedi a chi intestare le ricevute nuove' }] : [])] : []
  // Chi fa solo da titolare non ha certificato, quota né corsi: la scheda è PERSONA. «Iscrivilo a un corso» apre il resto.
  const [daIscrivere, setDaIscrivere] = useState(false)
  const soloGenitore = !!p.genitoreNonIscritto && !daIscrivere
  const vista: IdScheda = soloGenitore ? 'persona' : aperta
  const figli = soloGenitore ? tutti.filter((x) => x.nucleo === p.id && x.attiva).map((x) => x.nome) : []
  const apriModifica = () => {
    setGuaio('')
    setAperta('persona')
    setModifica({ id: p.id, nome: p.nome, cognome: p.cognome, email: p.email, telefono: p.telefono })
  }
  const { correnti, terminate } = iscrizioniDellaScheda(p.iscrizioni, oggi)
  const liberi = attivi.filter((c) => !correnti.some((i) => i.corsoId === c.id))
  const venuto = storico.dato?.filter((x) => x.stato === 'presente').length ?? 0
  // Gli altri del nucleo familiare, per lo sconto famiglia della ricevuta.
  const nucleo = nucleoPerRicevuta(p, tutti)
  const parenti = stessoContatto(p, tutti)
  // A segnalazioni spente niente timbro TESSERA né segno sulla linguetta: la sezione resta.
  const tessereDi = tessere && SEGNALA_TESSERE ? tessere.filter((t) => t.personaId === p.id) : undefined
  const segni = segniSchede({ ...p, tessere: tessereDi }, [...corsi.values()], oggi, { aperta, inModifica: !!modifica }, statiCorsi && nonPagati(statiCorsi))
  const tastiera = (e: KeyboardEvent) => {
    const dove = tastoScheda(aperta, e.key)
    if (!dove) return
    e.preventDefault()
    setAperta(dove)
    // Il fuoco segue la scheda: la prossima Tab entra nel suo pannello.
    document.getElementById(idLinguetta(dove))?.focus()
  }
  /** Un timbro porta alla scheda della sua sezione; se è già aperta, solo scorre. */
  const vaiAlTimbro = (id: string) => {
    const dove = schedaDellaSezione(id)
    if (dove && serveCambiare(aperta, dove)) setAperta(dove)
    setVai({ id })
  }

  return (
    <>
      <div className="sg-scheda-testa">
        <div className="stack" style={{ gap: 4 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <h2 className="ob" style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
              {`${p.cognome} ${p.nome}`.toUpperCase()}
            </h2>
            {p.genitoreNonIscritto && <SegnoStato tono="nota" parola="Genitore non iscritto" />}
          </div>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            {soloGenitore
              ? `${figli.length ? `Paga e firma per ${figli.join(' e ')}. ` : ''}Non ha corsi, quota né certificato, e non conta fra gli iscritti.`
              : sottoNome(natoIl, p.creataIl, ora)}
          </span>
        </div>
        {(azioni.sollecito || voci.length > 0) && (
          <div className="sg-scheda-testa-azioni">
            <div className="sg-scheda-testa-tasti">
              {azioni.sollecito && (
                <button type="button" className="sg-btn sg-btn-pieno sg-scheda-testa-sollecito" aria-expanded={sollecitoAperto} aria-controls="sg-sollecito" onClick={() => setSollecitoAperto((a) => !a)}>
                  Sollecita su WhatsApp <span aria-hidden="true">{sollecitoAperto ? '▴' : '▾'}</span>
                </button>
              )}
              {voci.length > 0 && (
                <MenuAzioni etichetta="Altro">
                  {voci.includes('unisci') && (
                    <button type="button" role="menuitem" onClick={() => setUnendo(true)}>
                      Unisci con un altro iscritto…
                    </button>
                  )}
                  {/* Un file con anagrafica, iscrizioni e presenze: è quello che una persona ha diritto di chiedere. */}
                  {voci.includes('esporta') && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        void fai(async () => {
                          const dati = await d.esporta(p.id)
                          const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }))
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `dati-${p.cognome}-${p.nome}.json`.toLowerCase().replace(/\s+/g, '-')
                          a.click()
                          URL.revokeObjectURL(url)
                        }, 'File scaricato')
                      }
                    >
                      Esporta i dati
                    </button>
                  )}
                  {voci.includes('disattiva') && (
                    <button
                      type="button"
                      role="menuitem"
                      className="sg-pericolo"
                      onClick={async () => {
                        if (!(await chiedi(confermaDisattiva(`${p.nome} ${p.cognome}`, p.certificato), 'Disattiva la scheda', { pericolo: true }))) return
                        void fai(() => d.attivaPersona(p.id, false), 'Scheda disattivata', onCambiato)
                      }}
                    >
                      Disattiva
                    </button>
                  )}
                  {voci.includes('riattiva') && (
                    <button type="button" role="menuitem" onClick={() => void fai(() => d.attivaPersona(p.id, true), 'Scheda riattivata', onCambiato)}>
                      Riattiva
                    </button>
                  )}
                </MenuAzioni>
              )}
            </div>
            {azioni.sollecito && sollecito.ultimo && <span className="sg-scheda-testa-ultimo">{fraseSollecitato(sollecito.ultimo)}</span>}
          </div>
        )}
      </div>
      {!unendo && !pagando && sollecito.guaio && <Guaio titolo="SOLLECITO SU WHATSAPP" testo={sollecito.guaio} />}
      {azioni.sollecito && sollecito.s && sollecitoAperto && <SollecitoWhatsApp d={d} p={p} s={sollecito.s} onSollecitato={onSollecitato} avvisa={avvisa} onPersona={() => setAperta('persona')} />}
      {!unendo && !pagando && manca.length > 0 && (
        <div className="sg-scheda-manca" role="status">
          <span className="sg-scheda-manca-titolo">✕ COSA MANCA</span>
          {manca.map((r) => (
            <span key={r.cosa} className="sg-scheda-manca-riga">
              {r.cosa}
              {r.perche && <span className="sg-scheda-manca-perche"> · {r.perche}</span>}
            </span>
          ))}
        </div>
      )}
      {/* Mentre si unisce o si fa una ricevuta le sezioni non ci sono: i timbri porterebbero a niente. */}
      {!unendo && !pagando && !soloGenitore && letta && <Timbri p={p} oggi={oggi} onVai={vaiAlTimbro} tessera={tessereDi ? timbroTessera({ ...p, tessere: tessereDi }, [...corsi.values()], oggi) : null} />}

      {unendo ? (
        <UnisciDoppione
          d={d}
          p={p}
          tutti={tutti}
          altraIniziale={unisciCon ?? doppio}
          fai={fai}
          onLasciaStare={() => setUnendo(false)}
          onUnite={(resta) => {
            setUnendo(false)
            // Se resta la stessa persona la scheda non si ricrea: si riparte da PERSONA a mano.
            setAperta(schedaIniziale())
            onCambiato()
            onApri(resta)
          }}
        />
      ) : pagando ? (
        <Bozza>
        <NuovaRicevuta
          // Scelto un pagamento a mano in cima alla ricevuta, il modulo riparte da quello.
          key={daPagamento?.chiaveRicevuta ?? 'nuova'}
          d={d}
          p={p}
          nucleo={nucleo}
          corsi={correnti.flatMap((i) => { const c = corsi.get(i.corsoId); return c ? [{ id: c.id, nome: c.nome }] : [] })}
          fai={fai}
          avvisa={avvisa}
          daPagamento={daPagamento ?? undefined}
          // Un pagamento a mano già registrato (FANNE LA RICEVUTA): niente da riprendere, resta nello storico com'era.
          onDaPagamento={daPagamento ? undefined : (x) => setDaPagamento(x)}
          onLasciaStare={() => {
            setPagando(false)
            if (!siPerdeUscendo(daPagamento)) return setDaPagamento(null)
            setRiprendi(daPagamento)
            setDaPagamento(null)
            avvisa('Pagamento non registrato: è ancora nel modulo, da registrare senza ricevuta o da riprovare.', true)
          }}
          onFatta={() => {
            setPagando(false)
            setDaPagamento(null)
            setAperta(schedaIniziale(true))
            setGiroRicevute((g) => g + 1)
            onCambiato()
          }}
        />
        </Bozza>
      ) : !letta ? (
        // Timbri e sezioni aspettano COSA MANCA: se comparisse dopo, li spingerebbe giù.
        <p className="sg-sotto" role="status">Carico la scheda…</p>
      ) : (
      <>
      {!soloGenitore && <div className="schede sg-schede sg-schede-scheda" role="tablist" aria-label="Parti della scheda" onKeyDown={tastiera}>
        {SCHEDE.map((s) => {
          const segno = segni[s.id]
          const Icona = ICONE_SCHEDA_ISCRITTO[s.id]
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={idLinguetta(s.id)}
              aria-controls={idPannello(s.id)}
              aria-selected={aperta === s.id}
              // Il nome intero e il segno a voce: gli span dentro sono aria-hidden (sul telefono la linguetta è corta).
              aria-label={segno ? `${s.nome}, ${segno.parola.toLowerCase()}` : s.nome}
              tabIndex={aperta === s.id ? 0 : -1}
              className="scheda"
              data-on={aperta === s.id}
              onClick={() => setAperta(s.id)}
            >
              <Icona size={16} />
              <span aria-hidden="true" className="sg-scheda-lunga">{s.etichetta}</span>
              <span aria-hidden="true" className="sg-scheda-corta">{s.etichettaTelefono}</span>
              {segno && (
                <span aria-hidden="true" className="sg-scheda-segno" data-tono={segno.tono}>
                  ● {segno.parola}
                </span>
              )}
            </button>
          )
        })}
      </div>}

      {/* Le schede lasciate si nascondono, non si smontano: quello che si sta scrivendo resta. */}
      <div role={soloGenitore ? undefined : 'tabpanel'} id={idPannello('persona')} aria-labelledby={soloGenitore ? undefined : idLinguetta('persona')} hidden={vista !== 'persona'} className="stack" style={{ gap: 20, minWidth: 0 }}>
          <div className="stack" style={{ gap: 8 }}>
          <Riga titolo="CONTATTI">
            {!modifica && (
              <button type="button" className="num sg-chip" onClick={apriModifica}>
                Modifica i contatti
              </button>
            )}
          </Riga>
          {modifica ? (
            <div className="sg-due">
              <Campo id="m-nome" etichetta="NOME">
                <input id="m-nome" className="sg-campo" value={modifica.nome} onChange={(e) => setModifica({ ...modifica, nome: e.target.value })} />
              </Campo>
              <Campo id="m-cognome" etichetta="COGNOME">
                <input id="m-cognome" className="sg-campo" value={modifica.cognome} onChange={(e) => setModifica({ ...modifica, cognome: e.target.value })} />
              </Campo>
              <CampoEmail prefisso="m" email={modifica.email ?? ''} guaio={guaio} onEmail={(v) => { setGuaio(''); setModifica({ ...modifica, email: v }) }} />
              <Campo id="m-tel" etichetta="TELEFONO">
                <input id="m-tel" className="sg-campo" type="tel" value={modifica.telefono ?? ''} onChange={(e) => setModifica({ ...modifica, telefono: e.target.value })} />
              </Campo>
            </div>
          ) : (
            <div className="sg-due">
              <Campo etichetta="EMAIL">
                <span className="sg-valore" style={{ wordBreak: 'break-all', color: p.email ? 'var(--text)' : 'var(--dim)' }}>{p.email ?? '—'}</span>
                {!p.email && minore && <span className="sg-sotto" style={{ fontSize: 12 }}>Per un minorenne è quella del genitore.</span>}
              </Campo>
              <Campo etichetta="TELEFONO">
                <span className="sg-valore" style={{ color: p.telefono ? 'var(--text)' : 'var(--dim)' }}>{p.telefono ?? '—'}</span>
                {!p.telefono && minore && <span className="sg-sotto" style={{ fontSize: 12 }}>Per un minorenne è quello del genitore.</span>}
              </Campo>
            </div>
          )}
          </div>

          {parenti.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <Riga titolo="STESSO CONTATTO DI" />
              <span className="sg-sotto">Parenti, non doppioni: usano lo stesso indirizzo.</span>
              {parenti.map((nome, i) => (
                <div key={`${nome}-${i}`} className="sg-iscrizione">
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{nome}</span>
                </div>
              ))}
            </div>
          )}

          <DatiAnagrafici key={`a-${p.id}`} d={d} p={p} an={an} natoIl={natoIl} minore={minore} fai={fai} onCambiato={() => { setGiroAnagrafica((g) => g + 1); onCambiato() }} />
          <NucleoFamiliare d={d} p={p} tutti={tutti} natoIl={natoIl} minore={minore} fai={fai} onCambiato={onCambiato} onApri={onApri} giroAnagrafica={giroAnagrafica} />
          {nonDoppioni.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <Riga titolo="NON SONO DOPPIONI" />
              <span className="sg-sotto">Non è la stessa persona di queste schede. Segnato per sbaglio? TOGLI, e se sembrano la stessa persona tornano fra i possibili doppioni.</span>
              {nonDoppioni.map((x) => (
                <div key={x.id} className="sg-iscrizione">
                  <span className="stack grow" style={{ minWidth: 0 }}>
                    <button type="button" className="sg-link" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }} onClick={() => onApri(x.id)}>
                      {x.cognome} {x.nome}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>{[x.telefono ?? x.email, x.attiva ? '' : 'disattivata'].filter(Boolean).join(' · ') || 'nessun contatto'}</span>
                  </span>
                  <button
                    type="button"
                    className="sg-btn sg-btn-linea sg-pericolo"
                    aria-label={`Togli il segno «non sono doppioni» con ${x.cognome} ${x.nome}`}
                    disabled={togliendo}
                    onClick={async () => {
                      if (!(await chiedi(`Togliere il segno «non sono doppioni» con ${x.cognome} ${x.nome}? Se sembrano la stessa persona tornano fra i possibili doppioni.`, 'Togli il segno', { pericolo: true }))) return
                      // Fermo finché la scheda non si rilegge: tolta la riga, il secondo clic di un doppio clic finirebbe su MODIFICA.
                      setTogliendo(true)
                      await fai(() => d.togliNonDoppioni(p.id, x.id), 'Tolto: se sembrano la stessa persona tornano fra i possibili doppioni', onCambiato)
                      setTimeout(() => setTogliendo(false), 400)
                    }}
                  >
                    Togli
                  </button>
                </div>
              ))}
            </div>
          )}

          {soloGenitore && (
            <div className="stack" style={{ gap: 8 }}>
              <Riga titolo="SE SI ISCRIVE" />
              <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                <span className="sg-sotto grow">Diventa un iscritto come gli altri, resta titolare e i figli restano nel suo nucleo.</span>
                <button
                  type="button"
                  className="num sg-chip"
                  onClick={() => {
                    setDaIscrivere(true)
                    setAperta('corsi')
                  }}
                >
                  Iscrivilo a un corso
                </button>
              </div>
            </div>
          )}
      </div>

      <div role="tabpanel" id={idPannello('documenti')} aria-labelledby={idLinguetta('documenti')} hidden={vista !== 'documenti'} className="stack" style={{ gap: 20, minWidth: 0 }}>
          <div id="sez-certificato">
            <Certificato key={`c-${p.id}`} d={d} p={p} fai={fai} onCambiato={onCambiato} />
          </div>
          <TessereDellaPersona key={`t-${p.id}-${(tessere ?? []).length}`} d={d} p={p} tessere={tessere} corsi={corsi} oggi={chiaveGiorno(new Date())} fai={fai} avvisa={avvisa} onCambiato={onCambiato} />
          <div id="sez-documento">
            <Documento d={d} p={p} minore={minore} fai={fai} onCambiato={onCambiato} />
          </div>
      </div>

      <div role="tabpanel" id={idPannello('quota')} aria-labelledby={idLinguetta('quota')} hidden={vista !== 'quota'}>
        <div id="sez-quota" className="stack" style={{ gap: 24, minWidth: 0 }}>
            <Pagamento key={`p-${p.id}-${p.pagamento.stato}-${p.pagamento.fino ?? ''}-${giroRicevute}-${(p.quote ?? []).length}`} d={d} p={p} statiCorsi={statiCorsi} fai={fai} onCambiato={onCambiato} onNuova={() => setPagando(true)} />
            <StoricoIscritto key={`r-${p.id}-${giroRicevute}`} d={d} p={p} corsi={attivi.map((c) => c.nome)} fai={fai} avvisa={avvisa} onCambiato={onCambiato} contabilita={contabilita} riprendi={riprendi ?? undefined} onRicevuta={(x) => {
              setRiprendi(null)
              setDaPagamento(x)
              setPagando(true)
            }} />
            <StoricoPersona key={`s-${p.id}`} d={d} personaId={p.id} onMovimento={onMovimento} />
        </div>
      </div>

      <div role="tabpanel" id={idPannello('corsi')} aria-labelledby={idLinguetta('corsi')} hidden={vista !== 'corsi'} className="stack" style={{ gap: 20, minWidth: 0 }}>
          <div className="stack" style={{ gap: 8 }}>
            <Riga titolo="ISCRIZIONI">
              {p.attiva && !iscrivendo && liberi.length > 0 && (
                <button type="button" className="num sg-chip" onClick={() => setIscrivendo(true)}>
                  + Iscrivi a un corso…
                </button>
              )}
            </Riga>
            {/* Una scheda disattivata non si iscrive: lo si dice, invece di un tasto spento senza motivo. */}
            {!p.attiva && <span className="sg-sotto">La scheda è disattivata: per iscriverla a un corso, prima Altro → Riattiva.</span>}
            {p.attiva && iscrivendo && (
              <div className="row" style={{ gap: 8 }}>
                <label htmlFor="p-agg" className="vh">
                  Corso da aggiungere
                </label>
                <select id="p-agg" className="sg-campo grow" style={{ minWidth: 0 }} value={daAggiungere} onChange={(e) => setDaAggiungere(e.target.value)}>
                  <option value="">Scegli il corso…</option>
                  {liberi.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <button type="button" className="num sg-chip" onClick={() => { setIscrivendo(false); setDaAggiungere('') }}>
                  Lascia stare
                </button>
                <button
                  type="button"
                  className="num sg-chip sg-chip-pieno"
                  disabled={!daAggiungere}
                  onClick={() =>
                    void fai(() => d.iscrivi(p.id, daAggiungere), 'Iscrizione fatta', () => {
                      setDaAggiungere('')
                      setIscrivendo(false)
                      onCambiato()
                    })
                  }
                >
                  Iscrivi
                </button>
              </div>
            )}
            {correnti.length === 0 && <span className="sg-sotto">Nessuna iscrizione in corso.</span>}
            {correnti.map((i) => {
              const c = corsi.get(i.corsoId)
              const sc = statiCorsi?.find((x) => x.corsoId === i.corsoId)
              const b = sc && bollinoCorso(sc)
              return (
                <Stato key={i.corsoId} nome={(c?.nome ?? 'Corso').toUpperCase()} sotto={`dal ${dataLunga(i.dal)}${i.al ? ` · fino al ${dataLunga(i.al)}` : ''}`}>
                  {b && <Bollino tono={b.tono}>{b.parola}</Bollino>}
                  {!i.al && (
                    <button
                      type="button"
                      className="num sg-chip"
                      onClick={async () => {
                        if ((await chiedi(`${p.nome} smette di venire a ${c?.nome}? Da domani non è più nell'appello; il registro resta.`, 'Termina l’iscrizione'))) {
                          void fai(() => d.termina(p.id, i.corsoId), 'Iscrizione terminata', onCambiato)
                        }
                      }}
                    >
                      Termina
                    </button>
                  )}
                </Stato>
              )
            })}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <Riga titolo="ULTIME 12 LEZIONI">
              <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>
                {storico.dato ? `${venuto} / ${storico.dato.length}` : ''}
              </span>
            </Riga>
            {storico.dato?.length === 0 && <span className="sg-sotto">Ancora nessuna lezione.</span>}
            {/* Il segno dentro, non solo il colore: ✓ presente, ✕ assente, G giustificato. Per chi legge lo schermo, la frase intera. */}
            <ul className="sg-storico" aria-label="Ultime 12 lezioni">
              {storico.dato?.map((x) => {
                const detto = `${x.corso} · ${giornoPerEsteso(chiaveGiorno(new Date(x.inizio)))} ${oraDi(x.inizio)} · ${x.stato ?? 'non segnato'}`
                return (
                  <li key={x.sessioneId} className="sg-quadretto" data-stato={x.stato ?? 'niente'} title={detto}>
                    <span aria-hidden="true">{x.stato === 'presente' ? '✓' : x.stato === 'assente' ? '✕' : x.stato === 'giustificato' ? 'G' : ''}</span>
                    <span className="vh">{detto}</span>
                  </li>
                )
              })}
            </ul>
            {f && (
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                Negli ultimi 30 giorni: {f.presenti} su {f.dovute}.
              </span>
            )}
          </div>

          {terminate.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <Riga titolo="TERMINATE" />
              {terminate.map((i) => (
                <Stato key={`${i.corsoId}-${i.dal}`} finita nome={(corsi.get(i.corsoId)?.nome ?? 'Corso').toUpperCase()} sotto={`dal ${dataLunga(i.dal)} al ${dataLunga(i.al ?? '')}`} />
              ))}
            </div>
          )}
      </div>

      {/* Fuori modifica il piede non c'è: le azioni rare stanno in «Altro», in testata. */}
      {modifica && (
      <div className="sg-scheda-piede sg-scheda-piede-fisso">
          <>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setModifica(null)}>
              Lascia stare
            </button>
            <Tasto
              tono="pieno"
              className="grow"
              disabled={!modifica.nome.trim() || !modifica.cognome.trim()}
              onClick={() => {
                setGuaio('')
                void fai(
                  () =>
                    d.salvaPersona(modifica).catch((e: unknown) => {
                      setGuaio(messaggio(e))
                      // L'errore sta sotto il campo, in PERSONA: da un'altra scheda non si vedrebbe.
                      setAperta('persona')
                      throw e
                    }),
                  'Scheda salvata',
                  () => {
                    setModifica(null)
                    onCambiato()
                  },
                )
              }}
            >
              Salva
            </Tasto>
          </>
      </div>
      )}
      </>
      )}
    </>
  )
}

/** Va alla sua sezione e mette il fuoco sul tasto che serve, o sul titolo. */
function vaiA(id: string) {
  const sez = document.getElementById(id)
  if (!sez) return
  const h = sez.querySelector<HTMLElement>('h3')
  h?.setAttribute('tabindex', '-1')
  const dove = sez.querySelector<HTMLElement>('[data-primo]:not(:disabled)') ?? h
  sez.scrollIntoView({ block: 'start' })
  dove?.focus({ preventScroll: true })
}

/**
 * In cima alla scheda: certificato, quota e documento in un colpo d'occhio,
 * con le parole dell'elenco (`timbriScheda`). Ognuno porta alla sua sezione.
 */
function Timbri({ p, oggi, tessera, onVai }: { p: PersonaSeg; oggi: string; tessera: ReturnType<typeof timbroTessera>; onVai: (id: string) => void }) {
  const t = timbriScheda(p, oggi)
  const uno = (titolo: string, x: Timbro, id: string) => (
    <button type="button" className="sg-timbro" data-tono={x.tono} onClick={() => onVai(id)}>
      <span className="sg-timbro-titolo">{titolo}</span>
      <span className="sg-timbro-parola">{x.parola}</span>
      {x.righe.map((r) => (
        <span key={r.testo} className="sg-timbro-riga" data-tono={r.tono}>
          {r.testo}
        </span>
      ))}
    </button>
  )
  return (
    <div className="stack" style={{ gap: 12 }}>
      {t.disattivata && (
        <p className="sg-timbri-spenta">
          <strong>DISATTIVATA</strong> Non è negli appelli né sul tablet. Per rimetterla: Altro → Riattiva.
        </p>
      )}
      <div className="sg-timbri">
        {uno('CERTIFICATO MEDICO', t.certificato, 'sez-certificato')}
        {uno('QUOTA', t.quota, 'sez-quota')}
        {tessera && uno('TESSERA', { ...tessera, tono: p.attiva ? tessera.tono : 'spento' }, 'sez-tessere')}
        {uno('DOCUMENTO D’IDENTITÀ', t.documento, 'sez-documento')}
      </div>
    </div>
  )
}

/**
 * I possibili doppioni (`coppieDoppioni`): ogni coppia con quello che serve
 * per decidere senza aprire le schede, UNISCI… e NON SONO DOPPIONI.
 */
function CoppieDoppioni({
  coppie,
  indizi,
  suoiCorsi,
  onUnisci,
  onNonDoppioni,
}: {
  coppie: [PersonaSeg, PersonaSeg][]
  indizi: IndiziDoppioni
  suoiCorsi: (p: PersonaSeg) => (string | undefined)[]
  onUnisci: (a: string, b: string) => void
  onNonDoppioni: (a: string, b: string) => void
}) {
  const riga = (x: PersonaSeg) => (
    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>
        {x.cognome} {x.nome}
        {!x.attiva && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--dim)' }}> · disattivata</span>}
      </span>
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>
        {[
          indizi.nascite[x.id] && `nascita ${dataLunga(indizi.nascite[x.id])}`,
          indizi.codiciFiscali[x.id],
          x.telefono ?? x.email,
          suoiCorsi(x).join(', '),
        ]
          .filter(Boolean)
          .join(' · ') || 'nessun altro dato'}
      </span>
    </div>
  )
  return (
    <div className="stack" style={{ gap: 12 }}>
      <span className="sg-sotto">Schede che sembrano la stessa persona, dalle più sicure.</span>
      {coppie.length === 0 && <p className="sg-sotto">Nessuna coppia corrisponde alla ricerca.</p>}
      {coppie.map(([a, b]) => (
        <div key={`${a.id}-${b.id}`} className="card stack" style={{ padding: 14, gap: 10 }}>
          {(() => {
            const m = motivoDoppione(a, b, indizi)
            return m && <span className="sg-etichetta">{MOTIVI[m].toUpperCase()}</span>
          })()}
          {riga(a)}
          <div style={{ borderTop: '2px solid var(--line)', paddingTop: 10 }}>{riga(b)}</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-pieno" onClick={() => onUnisci(a.id, b.id)}>
              Unisci…
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={() => onNonDoppioni(a.id, b.id)}>
              Non sono doppioni
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Unire un doppione (`doppioni.ts`, `29-unisci-doppioni.sql`): si sceglie
 * l'altra scheda, si vede cosa passa e cosa non torna, si sceglie quale
 * resta, e una conferma. Non si torna indietro.
 */
function UnisciDoppione({
  d,
  p,
  tutti,
  altraIniziale,
  fai,
  onLasciaStare,
  onUnite,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  tutti: PersonaSeg[]
  /** L'altra già scelta: un possibile doppione. */
  altraIniziale?: string
  fai: Fai
  onLasciaStare: () => void
  onUnite: (resta: string) => void
}) {
  const [altra, setAltra] = useState(altraIniziale ?? '')
  const [scambiate, setScambiate] = useState(false)
  const candidati = possibiliDoppioni(p, tutti)
  const lei = tutti.find((x) => x.id === altra)
  const [resta, via] = lei && scambiate ? [lei, p] : [p, lei]
  const passa = useCarica(async () => (resta && via ? d.anteprimaUnione(resta.id, via.id) : null), [d, resta?.id, via?.id])
  const nome = (x: PersonaSeg) => `${x.cognome} ${x.nome}`
  const quanto = (n: { presenze: number; prove: number; iscrizioni: number; ricevute: number }) => {
    const tutte: [number, string, string][] = [
      [n.presenze, 'presenza', 'presenze'],
      [n.prove, 'prova', 'prove'],
      [n.iscrizioni, 'iscrizione', 'iscrizioni'],
      [n.ricevute, 'ricevuta', 'ricevute'],
    ]
    const voci = tutte
      .filter(([q]) => q > 0)
      .map(([q, uno, tanti]) => `${q} ${q === 1 ? uno : tanti}`)
    return voci.length ? `Passano ${voci.join(', ')}.` : 'L’altra scheda non ha presenze, prove, iscrizioni né ricevute.'
  }
  const colonna = (t: string, x: PersonaSeg) => (
    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
      <span className="sg-etichetta">{t}</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{nome(x)}</span>
      <span style={{ fontSize: 12, color: 'var(--dim)' }}>{x.attiva ? 'Attiva' : 'Disattivata'}</span>
    </div>
  )
  const dove = (x: PersonaSeg) => [x.email, x.telefono, x.attiva ? '' : 'disattivata'].filter(Boolean).join(' · ')

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 640 }}>
      <Riga titolo="UNISCI UN DOPPIONE" />
      <span className="sg-sotto">Due schede della stessa persona diventano una: tutto passa a quella che resta.</span>
      <span className="sg-sotto">Unisci dopo gli appelli di oggi: uno fatto senza rete, arrivato tardi, si perderebbe.</span>
      <Campo id="u-altra" etichetta="L’ALTRA SCHEDA">
        <select id="u-altra" className="sg-campo" value={altra} onChange={(e) => {
            setAltra(e.target.value)
            setScambiate(false)
          }}>
          <option value="">Scegli…</option>
          {[
            ['STESSO COGNOME O SCAMBIATI', candidati.filter((x) => vicina(x, p))],
            ['TUTTI GLI ALTRI', candidati.filter((x) => !vicina(x, p))],
          ].map(([gruppo, chi]) =>
            typeof gruppo === 'string' && Array.isArray(chi) && chi.length > 0 ? (
              <optgroup key={gruppo} label={gruppo}>
                {chi.map((x) => (
                  <option key={x.id} value={x.id}>
                    {nome(x)}
                    {dove(x) && ` · ${dove(x)}`}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
      </Campo>

      {resta && via && (
        <>
          <div className="sg-due">
            {colonna('RESTA', resta)}
            {colonna('SE NE VA', via)}
          </div>
          <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={() => setScambiate((v) => !v)}>
            Tieni l’altra
          </button>
          {scambiati(resta, via) && (
            <span style={{ fontSize: 14 }}>
              Nome e cognome sono scambiati. Se resta il nome sbagliato, «Tieni l’altra».
            </span>
          )}
          {campiDiversi(resta, via).map((c) => (
            <span key={c.campo} style={{ fontSize: 14 }}>
              {c.campo}: <b>{c.resta || c.via}</b>
              {c.resta && c.via && <span style={{ color: 'var(--dim)' }}> (non «{c.via}»)</span>}
              {!c.resta && <span style={{ color: 'var(--dim)' }}> (dall’altra)</span>}
            </span>
          ))}
          {passa.guaio ? (
            <span style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{passa.guaio}</span>
          ) : !passa.dato ? (
            <span className="sg-sotto">Conto cosa passa…</span>
          ) : (
            (
              <span className="sg-sotto">
                {quanto(passa.dato)} Una presenza per lezione e un’iscrizione per corso; del certificato, la scadenza più lontana col suo file, e della quota, quella più lontana. Resta attiva
                se una delle due lo era.
              </span>
            )
          )}
        </>
      )}

      <div className="sg-scheda-piede">
        <button type="button" className="sg-btn sg-btn-linea grow" onClick={onLasciaStare}>
          Lascia stare
        </button>
        <button
          type="button"
          className="sg-btn sg-btn-rosso grow"
          disabled={!resta || !via || !passa.dato}
          onClick={async () => {
            if (!resta || !via) return
            const persi = indirizziPersi(resta, via)
            // Niente sparisce in silenzio: l'indirizzo che non trova posto si dice prima.
            const perso = persi.length ? `\nDell'altra scheda si perde ${persi.join(', ')}: ogni scheda ha una sola email.\nCopialo prima, se ti serve.` : ''
            if (!(await chiedi(confermaUnione(nome(via), nome(resta), via.certificato, resta.certificato, perso), 'Unisci', { pericolo: true }))) return
            void fai(() => d.unisciPersone(resta.id, via.id), 'Schede unite', () => onUnite(resta.id))
          }}
        >
          Unisci
        </button>
      </div>
    </div>
  )
}

/**
 * Il nucleo familiare (vedi `nucleo.ts`): di chi è, chi c'è, e dove va lo
 * sconto famiglia, dalle ricevute del nucleo. Dalla scheda del titolare (o di
 * chi non è in un nucleo) si aggiunge una persona; da quella di un'altra la
 * si toglie, o la si fa titolare. Se il database non ha ancora il nucleo
 * (100-nucleo.sql), la sezione resta vuota e i tasti rispondono «aggiornamento
 * in corso» (lo dice `guaio`, in `segreteriaSupabase.ts`).
 */
function NucleoFamiliare({
  d,
  p,
  tutti,
  natoIl,
  minore,
  fai,
  onCambiato,
  onApri,
  giroAnagrafica,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  tutti: PersonaSeg[]
  natoIl: string | null
  minore: boolean
  fai: Fai
  onCambiato: () => void
  onApri: (personaId: string) => void
  giroAnagrafica: number
}) {
  const [daAggiungere, setDaAggiungere] = useState('')
  const titolare = p.nucleo ? tutti.find((x) => x.id === p.nucleo) : p
  const membri = titolare ? tutti.filter((x) => x.nucleo === titolare.id && x.attiva) : []
  const nucleo = titolare ? [titolare, ...membri] : [p]
  const ids = nucleo.map((x) => x.id).join()
  const ricevute = useCarica(async () => (await Promise.all(nucleo.map((x) => d.ricevute(x.id)))).flat(), [d, ids])
  const nomeDi = (id: string) => {
    const x = tutti.find((y) => y.id === id)
    return x ? `${x.nome} ${x.cognome}` : ''
  }
  const oggi = chiaveGiorno(new Date())
  const annuali = abbonamentiDalleRicevute(ricevute.dato ?? [], nomeDi, oggi)
  // La data della testata (`natoIlDi`), così età e nucleo dicono la stessa cosa.
  const persone = tutti.map((x) => (x.id === p.id && natoIl ? { ...x, natoIl } : x))
  // Il genitore e i fratelli si riconoscono dal codice fiscale: le anagrafiche di tutti servono solo a un minorenne senza nucleo.
  const senzaNucleo = !p.nucleo && membri.length === 0
  // `giroAnagrafica`: il codice fiscale del genitore corretto qui sopra cambia la proposta.
  const genitori = useCarica(async () => (minore && senzaNucleo ? d.genitori() : null), [d, minore, senzaNucleo, ids, giroAnagrafica])
  const proposta = genitori.dato ? propostaGenitore(persone, p.id, genitori.dato, oggi) : null
  const fratelli = genitori.dato ? fratelliDaProporre(persone, p.id, genitori.dato, proposta) : []
  const maggiorenne = maggiorenneDal(persone, p.id, oggi)
  const fraAdulti = nucleo.length > 1 && nucleo.every((x) => !x.natoIl || !minorenne(x.natoIl))
  const minimo = doveVaLoSconto([], annuali)
  // Chi si può aggiungere: chi può entrare secondo le regole, prima chi ha lo stesso cognome.
  const candidati = p.nucleo
    ? []
    : tutti
        .filter((x) => !cosaNonVaNucleo(tutti, x.id, p.id))
        .sort((x, y) => Number(y.cognome === p.cognome) - Number(x.cognome === p.cognome) || x.cognome.localeCompare(y.cognome, 'it') || x.nome.localeCompare(y.nome, 'it'))
  const persona = (x: PersonaSeg, ruolo: string) => (
    <div key={x.id} className="sg-iscrizione">
      <span className="stack grow" style={{ minWidth: 0 }}>
        <button type="button" className="sg-link" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }} onClick={() => onApri(x.id)} disabled={x.id === p.id}>
          {x.nome} {x.cognome}
        </button>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{x.id === p.id ? `${ruolo} · questa scheda` : ruolo}</span>
      </span>
      {x.nucleo && (
        <>
          {!(x.natoIl && minorenne(x.natoIl)) && (
            <button type="button" className="num sg-chip" onClick={() => void fai(() => d.rendiTitolare(x.id), `${x.nome} è titolare del nucleo`, onCambiato)}>
              Titolare
            </button>
          )}
          <button
            type="button"
            className="num sg-chip sg-pericolo"
            onClick={async () => {
              if ((await chiedi(`Togliere ${x.nome} ${x.cognome} dal nucleo? Resta iscritto, ma il titolare non lo vede più nella sua pagina.`, 'Togli dal nucleo', { pericolo: true })))
                void fai(() => d.togliDalNucleo(x.id), 'Tolto dal nucleo', onCambiato)
            }}
          >
            Togli
          </button>
        </>
      )}
    </div>
  )

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="NUCLEO FAMILIARE" />
      {senzaNucleo && minore ? (
        <span className="sg-sotto">Non è in un nucleo. Chi è minorenne non fa da titolare: serve un adulto.</span>
      ) : senzaNucleo ? (
        <span className="sg-sotto">Non è in un nucleo. Aggiungi qualcuno qui sotto, e ne diventa titolare: vedrà nella sua pagina anche le persone del nucleo.</span>
      ) : !titolare ? (
        <span className="sg-sotto">Il titolare del nucleo non c’è più: toglilo dal nucleo.</span>
      ) : (
        <>
          {persona(titolare, titolare.genitoreNonIscritto ? 'Titolare · genitore non iscritto' : 'Titolare: vede tutto il nucleo nella sua pagina')}
          {membri.map((x) => persona(x, 'Nel nucleo'))}
        </>
      )}
      {maggiorenne && (
        <Proposta
          titolo={`${p.nome} è maggiorenne dal ${dataLunga(maggiorenne, false)}`}
          dettaglio={`È nel nucleo di ${titolare ? `${titolare.cognome} ${titolare.nome}` : 'un genitore'}, genitore non iscritto. Ora può avere un nucleo suo o restare qui: per le ricevute nuove, chiedi a chi intestarle.`}
          bordo="2px solid var(--line)"
        >
          <SegnoStato tono="giallo" parola="18 anni" />
        </Proposta>
      )}
      {fratelli.map((f) => (
        <Proposta
          key={f.titolare}
          titolo={`Stesso genitore di ${nomeDi(f.personaId)}`}
          dettaglio={`È nel nucleo di ${nomeDi(f.titolare)}: ${p.nome} entra lì, e lo sconto famiglia va sull’annuale che costa meno.`}
          bordo="2px dashed var(--line)"
        >
          <button type="button" className="num sg-chip" onClick={() => void fai(() => d.mettiNelNucleo(p.id, f.titolare), 'Messo nella famiglia', onCambiato)}>
            Mettilo nella famiglia
          </button>
        </Proposta>
      ))}
      {proposta?.tipo === 'nuovo' && (
        <Proposta
          titolo="Il genitore non è iscritto: aggiungilo"
          dettaglio={`${proposta.cognome} ${proposta.nome}, dal blocco GENITORE: diventa titolare del nucleo, senza corsi né quota, e paga per i figli.`}
          bordo="2px solid var(--blu)"
        >
          <button
            type="button"
            className="num sg-chip sg-chip-pieno"
            disabled={!proposta.nome || !proposta.cognome}
            onClick={() => void fai(() => d.aggiungiGenitore(p.id, { nome: proposta.nome, cognome: proposta.cognome, codiceFiscale: proposta.codiceFiscale }), 'Genitore aggiunto: è titolare del nucleo', onCambiato)}
          >
            Aggiungi il genitore
          </button>
        </Proposta>
      )}
      {(proposta?.tipo === 'iscritto' || proposta?.tipo === 'gia-in-elenco') && (
        <Proposta
          titolo={proposta.tipo === 'iscritto' ? `Il genitore è iscritto: ${nomeDi(proposta.titolare)}` : `C’è già ${nomeDi(proposta.titolare)} con questo codice fiscale: è la stessa persona?`}
          dettaglio={`Stesso codice fiscale del blocco GENITORE. ${p.nome} entra nel suo nucleo, senza una seconda scheda.`}
          bordo={proposta.tipo === 'iscritto' ? '2px solid var(--blu)' : '2px solid var(--giallo-testo)'}
        >
          <button type="button" className="num sg-chip sg-chip-pieno" onClick={() => void fai(() => d.mettiNelNucleo(p.id, proposta.titolare), 'Messo nel nucleo del genitore', onCambiato)}>
            {proposta.tipo === 'iscritto' ? 'Metti nel suo nucleo' : `Usa ${nomeDi(proposta.titolare)}`}
          </button>
        </Proposta>
      )}
      {proposta?.tipo === 'manca-cf' && (
        <Proposta
          titolo={proposta.sbagliato ? 'Il codice fiscale del genitore non è giusto: correggilo qui sopra' : 'Per aggiungere il genitore serve il suo codice fiscale'}
          dettaglio="Nel blocco GENITORE, qui sopra: va sulle ricevute e serve a riconoscere i fratelli."
          bordo="2px dashed var(--line)"
        />
      )}
      {senzaNucleo && !minore && (
        <div className="row" style={{ gap: 8 }}>
          <label htmlFor="n-agg" className="vh">
            Persona da aggiungere al nucleo
          </label>
          <select id="n-agg" className="sg-campo grow" style={{ borderStyle: 'dashed', minWidth: 0 }} value={daAggiungere} onChange={(e) => setDaAggiungere(e.target.value)}>
            <option value="">Aggiungi al nucleo…</option>
            {candidati.map((x) => (
              <option key={x.id} value={x.id}>
                {x.cognome} {x.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="num sg-chip sg-chip-pieno"
            disabled={!daAggiungere}
            onClick={() =>
              void fai(() => d.mettiNelNucleo(daAggiungere, p.id), 'Aggiunto al nucleo', () => {
                setDaAggiungere('')
                onCambiato()
              })
            }
          >
            Aggiungi
          </button>
        </div>
      )}
      {p.nucleo && titolare && <span className="sg-sotto">Per aggiungere qualcuno, apri la scheda del titolare.</span>}
      {fraAdulti && <span className="sg-sotto" style={{ fontSize: 12 }}>Fra adulti ognuno vede nella sua pagina anche le persone del nucleo, e il titolare paga per tutti. Nessuno firma per l’altro: firma ognuno per sé.</span>}
      {minimo ? (
        <span style={{ fontSize: 12, color: 'var(--sec)' }}>
          {minimo.scontato
            ? `Sconto famiglia: il ${Math.round(SCONTO_FAMIGLIA * 100)}% su ${minimo.corso} di ${minimo.chi}, cioè ${euro(Math.round(minimo.importo * SCONTO_FAMIGLIA))} €, già sulla sua ricevuta.`
            : `Sconto famiglia: il ${Math.round(SCONTO_FAMIGLIA * 100)}% sull’annuale che costa meno, ${minimo.corso} di ${minimo.chi}, cioè ${euro(Math.round(minimo.importo * SCONTO_FAMIGLIA))} €. Se è già pagato senza, si rende a parte; se no lo mette la ricevuta.`}
        </span>
      ) : (
        nucleo.length > 1 && (
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Sconto famiglia: con due annuali nelle ricevute del nucleo, il {Math.round(SCONTO_FAMIGLIA * 100)}% su quello che costa meno.</span>
        )
      )}
    </div>
  )
}

/**
 * Nascita, residenza e genitore: dal modulo di iscrizione dell'app o
 * dall'import delle risposte del modulo Google. Sono quelli che vanno sulle
 * ricevute: MODIFICA li corregge, e da lì valgono i nuovi.
 */
/**
 * `onCambiato`: codice fiscale e nascita decidono i possibili doppioni dell'elenco.
 * `an` lo legge la scheda, che ne ha bisogno per età e COSA MANCA. GENITORE solo
 * per un minorenne: a un adulto non serve, e la ricevuta non lo chiede.
 */
type AnagraficaLetta = ReturnType<typeof useCarica<{ di: AnagraficaDi | null }>>

/** `natoIl`: quella della testata (`natoIlDi`), così età e campo dicono la stessa data. */
function DatiAnagrafici({ d, p, an, natoIl, minore, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; an: AnagraficaLetta; natoIl: string | null; minore: boolean; fai: Fai; onCambiato: () => void }) {
  const [modifica, setModifica] = useState<Anagrafica | null>(null)
  const x = an.dato?.di?.dati
  const valore = (testo?: string) => <span className="sg-valore" style={{ color: testo ? 'var(--text)' : 'var(--dim)', overflowWrap: 'anywhere' }}>{testo || '—'}</span>
  const codice = (testo?: string) => (
    <span className="num sg-valore" style={{ color: testo ? 'var(--text)' : 'var(--dim)', letterSpacing: '0.04em', overflowWrap: 'anywhere' }}>{testo || '—'}</span>
  )
  const residenza = x && [x.indirizzo, [x.cap, x.comune].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const genitore = x && [x.genitoreCognome, x.genitoreNome].filter(Boolean).join(' ')
  // Come la ricevuta (`mancanoDatiSocio`): un codice sbagliato la blocca quanto uno vuoto.
  const { codice: cfGenitore, giusto: cfGenitoreSi } = cfGenitoreDaMostrare(x ?? {})
  const apri = () => setModifica({ ...(an.dato?.di?.dati ?? {}) })

  if (modifica) return <ModificaAnagrafica d={d} p={p} fai={fai} dati={modifica} onCambia={setModifica} onFatto={() => { setModifica(null); void an.ricarica(); onCambiato() }} />

  return (
    <>
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="DATI ANAGRAFICI">
        {an.dato && (
          <button type="button" className="num sg-chip" onClick={apri}>
            {an.dato.di ? 'Modifica i dati anagrafici' : 'Aggiungi i dati anagrafici'}
          </button>
        )}
      </Riga>
      {an.guaio && <Guaio testo={an.guaio} />}
      {an.dato && !an.dato.di && <span className="sg-sotto">Nessun dato: arrivano dal modulo di iscrizione o dall'import delle risposte del modulo Google.</span>}
      {x && (
        <div className="sg-due sg-scheda-campi">
          <Campo etichetta={etichettaNatoIl(x.codiceFiscale)}>{valore(natoIl ? dataLunga(natoIl) : undefined)}</Campo>
          <Campo etichetta="LUOGO DI NASCITA">{valore(x.natoA)}</Campo>
          <Campo etichetta="CODICE FISCALE">{codice(x.codiceFiscale)}</Campo>
          <Campo etichetta="RESIDENZA">{valore(residenza)}</Campo>
        </div>
      )}
      {/* Da dove vengono: serve a capire un dato sbagliato dopo un import. */}
      {an.dato?.di && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{an.dato.di.da === 'modulo' ? 'dal modulo di iscrizione' : 'dall’import o dalla segreteria'}</span>}
    </div>
    {minore && an.dato && (
      <div className="stack" style={{ gap: 8 }}>
        <Riga titolo="GENITORE" />
        <div className="sg-due sg-scheda-campi">
          <Campo etichetta="NOME">{valore(genitore || undefined)}</Campo>
          <Campo etichetta="NATO A E IL">{valore(x?.genitoreNato)}</Campo>
          {!cfGenitoreSi ? (
            <>
              <Campo etichetta="✕ CODICE FISCALE DEL GENITORE" manca>
                <span className="sg-valore" style={{ color: 'var(--rosso-testo)', fontWeight: 700 }}>{cfGenitore || 'Manca'}</span>
                <span className="sg-sotto" style={{ fontSize: 12 }}>{cfGenitore ? 'Non è giusto: la ricevuta non si può fare.' : 'Serve per la ricevuta: senza, non si può fare.'}</span>
              </Campo>
              <div className="row" style={{ alignItems: 'center' }}>
                <button type="button" className="num sg-chip" onClick={apri}>
                  {cfGenitore ? 'Correggi il codice fiscale' : 'Aggiungi il codice fiscale'}
                </button>
              </div>
            </>
          ) : (
            <Campo etichetta="CODICE FISCALE">{codice(cfGenitore)}</Campo>
          )}
        </div>
      </div>
    )}
    </>
  )
}

export type CampoAnagrafica = { k: keyof Anagrafica; etichetta: string; tipo?: 'date'; codice?: boolean; largo?: boolean; max: number }

/** I campi della MODIFICA, nell'ordine in cui si scrivono. */
const CAMPI_ANAGRAFICA: CampoAnagrafica[] = [
  { k: 'natoIl', etichetta: 'Nato il', tipo: 'date', max: 10 },
  { k: 'natoA', etichetta: 'A', max: 80 },
  { k: 'codiceFiscale', etichetta: 'Codice fiscale', codice: true, largo: true, max: 16 },
  { k: 'indirizzo', etichetta: 'Indirizzo', largo: true, max: 160 },
  { k: 'cap', etichetta: 'CAP', max: 5 },
  { k: 'comune', etichetta: 'Comune', max: 80 },
  { k: 'genitoreNome', etichetta: 'Nome del genitore', max: 80 },
  { k: 'genitoreCognome', etichetta: 'Cognome del genitore', max: 80 },
  { k: 'genitoreCodiceFiscale', etichetta: 'Codice fiscale del genitore', codice: true, largo: true, max: 16 },
  { k: 'genitoreNato', etichetta: 'Luogo e data di nascita del genitore', largo: true, max: 120 },
]

/**
 * Correggere i dati anagrafici: si salvano in segreteria e da lì valgono,
 * anche sulla ricevuta dopo. Un campo vuoto si cancella. Un codice fiscale
 * scritto giusto ma che non torna con la persona si dice, e si salva lo
 * stesso: a volte è il dato vecchio a essere sbagliato.
 */
export function ModificaAnagrafica({
  d,
  p,
  fai,
  dati,
  onCambia,
  onFatto,
  campi = CAMPI_ANAGRAFICA,
  titolo = 'DATI ANAGRAFICI',
}: {
  d: DatiSegreteria
  p: Pick<PersonaSeg, 'id' | 'nome' | 'cognome'>
  fai: Fai
  dati: Anagrafica
  onCambia: (a: Anagrafica) => void
  onFatto: () => void
  /** Quelli di un tecnico non sono quelli di un iscritto: niente genitore, ma province e IBAN. */
  campi?: CampoAnagrafica[]
  titolo?: string
}) {
  const pulita = pulisciAnagrafica(dati)
  const no = cosaNonVaAnagrafica(pulita)
  // Il comune dal CAP, come nel modulo di iscrizione (provincia di Torino): un aiuto, il campo resta scrivibile.
  const dalCap = comuneDalCap(dati.cap ?? '', dati.comune)
  const cf = pulita.codiceFiscale
  const avviso =
    cf && cf.length === 16 && !no
      ? !cfValido(cf)
        ? "L'ultimo carattere del codice fiscale non torna: forse c'è una lettera sbagliata."
        : !cfTornaColNome(cf, p.nome, p.cognome)
          ? `Il codice fiscale non torna con ${[p.nome, p.cognome].filter(Boolean).join(' ')}: è il suo?`
          : pulita.natoIl && !cfTornaConLaData(cf, pulita.natoIl)
            ? 'Il codice fiscale e la data di nascita non dicono lo stesso giorno.'
            : null
      : null
  return (
    <div className="stack" style={{ gap: 12 }}>
      <Riga titolo={titolo} />
      <div className="sg-due">
        {campi.map((c) => (
          <Fragment key={c.k}>
            <Campo id={`an-${c.k}`} etichetta={c.etichetta} largo={c.largo} nota={c.k === 'comune' && dalCap.nota ? { testo: dalCap.nota, guaio: false } : undefined}>
              <input
                id={`an-${c.k}`}
                className={c.codice ? 'sg-campo num' : 'sg-campo'}
                type={c.tipo ?? 'text'}
                maxLength={c.tipo ? undefined : c.max}
                inputMode={c.k === 'cap' ? 'numeric' : undefined}
                autoCapitalize={c.codice ? 'characters' : undefined}
                value={dati[c.k] ?? ''}
                onChange={(e) => onCambia(c.k === 'cap' ? conIlComune(dati, e.target.value) : { ...dati, [c.k]: c.codice ? e.target.value.toUpperCase() : e.target.value })}
              />
            </Campo>
            {c.k === 'comune' && dalCap.scelte.length > 0 && (
              <Campo id={dalCap.tendina ? 'an-comune-tendina' : undefined} etichetta={dalCap.tendina ? etichettaTendina(dati.cap ?? '', dalCap.scelte.length) : fraseDellaScelta(dati.cap ?? '', dalCap.scelte.length)} largo>
                {dalCap.tendina ? (
                  <select id="an-comune-tendina" className="sg-campo" value="" onChange={(e) => e.target.value && onCambia({ ...dati, comune: e.target.value })}>
                    <option value="">Scegli il comune</option>
                    {dalCap.scelte.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {dalCap.scelte.map((x) => (
                      <button key={x} type="button" className="sg-chip" onClick={() => onCambia({ ...dati, comune: x })}>
                        {x}
                      </button>
                    ))}
                  </div>
                )}
              </Campo>
            )}
          </Fragment>
        ))}
      </div>
      {no && <span style={{ fontSize: 13, color: 'var(--rosso-testo)' }}>{no}.</span>}
      {avviso && <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>{avviso} Si può salvare lo stesso.</span>}
      <span className="sg-sotto">Un campo lasciato vuoto si cancella. Le ricevute già fatte restano com'erano; le nuove prendono questi.</span>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onFatto}>
          Lascia stare
        </button>
        <Tasto tono="pieno" disabled={!!no} onClick={() => void fai(() => d.salvaAnagrafica(p.id, pulita, true), 'Dati anagrafici salvati', onFatto)}>
          Salva
        </Tasto>
      </div>
    </div>
  )
}

/**
 * Il certificato medico: il file e fino a quando vale. Il file sta nell'app,
 * lo apre solo la segreteria con un link di dieci minuti, e si cancella da
 * solo trenta giorni dopo la scadenza. La data la scrive la segreteria
 * leggendo il foglio: senza, in sala non si entra (e sotto i 6 anni non serve).
 * Un gesto solo per caricare o sostituire: il file e la data insieme, un solo
 * SALVA. Chi ha il file ma non la data (arrivato col modulo) scrive solo la data.
 */
function Certificato({ d, p, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onCambiato: () => void }) {
  const oggi = chiaveGiorno(new Date())
  const [gesto, setGesto] = useState<{ file?: File; scade: string } | null>(null)
  const sel = useRef<HTMLInputElement>(null)
  // La scadenza che la segreteria legge sul file mandato dall'iscritto.
  const [scadeMandato, setScadeMandato] = useState('')
  const c = p.certificato
  // Cosa dire e quale tasto offrire sta in `src/lib/segreteria.ts`: qui si mostra.
  const x = presentaCertificato(c, p.natoIl, oggi, p.attiva)
  const pronto = !!gesto && certificatoPronto(gesto, c)

  const apri = () => {
    // La finestra si apre subito, col clic: dopo l'attesa del link il browser la bloccherebbe.
    const w = window.open('', '_blank')
    void fai(async () => {
      const f = await d.apriCertificato(p.id).catch((e: unknown) => {
        w?.close()
        throw e
      })
      if (!f) {
        w?.close()
        throw new Error(d.modo === 'prova' ? 'In prova il file resta solo finché la pagina è aperta: questo non c’è più, si può togliere' : 'Il file non si trova')
      }
      if (w) w.location.href = f.url
      else window.location.href = f.url
    })
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="CERTIFICATO MEDICO">
        {/* Pieno solo se è la prima cosa da fare: in scheda un tasto pieno alla volta. */}
        {!gesto && x.puoCambiare && (
          <button type="button" className={x.primo ? 'num sg-chip sg-chip-pieno' : 'num sg-chip'} data-primo={x.primo || undefined} onClick={() => setGesto(gestoIniziale(c))}>
            {x.tasto}
          </button>
        )}
      </Riga>
      <Stato {...riquadroCertificato(c, p.natoIl, oggi, p.attiva)}>
        {c.conFile && (
          <button type="button" className="num sg-chip" onClick={apri}>
            Apri
          </button>
        )}
        {x.puoCambiare && !gesto && (c.conFile || c.scade) && (
          <button
            type="button"
            className="num sg-chip sg-pericolo"
            onClick={async () => {
              if ((await chiedi(`Togliere il certificato di ${p.nome} ${p.cognome}?${c.conFile ? ' Il file si cancella per sempre.' : ''} Senza certificato non entra in sala finché non se ne carica uno nuovo.`, 'Togli il certificato', { pericolo: true })))
                void fai(() => d.togliCertificato(p.id), 'Certificato tolto', onCambiato)
            }}
          >
            Togli
          </button>
        )}
      </Stato>
      {x.senzaNascita && <span className="sg-sotto">{x.senzaNascita}</span>}
      {x.cancellaIl && <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Il file si cancella da solo il {dataLunga(x.cancellaIl)}, 30 giorni dopo la scadenza.</span>}
      {c.vecchio && <span style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>Certificato da archiviare (caricato prima della nuova gestione): si apre con APRI come gli altri.</span>}

      {c.inAttesaIl && !gesto && (
        <div className="stack" style={{ gap: 10, padding: 14, background: 'var(--surface)', border: '2px solid var(--line)', borderLeft: '4px solid var(--giallo)' }}>
          <span className="num">Inviato dall’iscritto, da controllare</span>
          <span className="sg-sotto">{p.nome} {p.cognome} ha mandato un file il {dataLunga(c.inAttesaIl)}. Aprilo, leggi la data e scrivila qui sotto.</span>
          <div>
            <button
              type="button"
              className="num sg-chip"
              onClick={() => {
                const w = window.open('', '_blank')
                void fai(async () => {
                  const f = await d.apriCertificatoInAttesa(p.id).catch((e: unknown) => {
                    w?.close()
                    throw e
                  })
                  if (!f) {
                    w?.close()
                    throw new Error(d.modo === 'prova' ? 'In prova il file resta solo finché la pagina è aperta: questo non c’è più, si può confermare o rifiutare lo stesso' : 'Il file non si trova: l’iscritto può rimandarlo')
                  }
                  if (w) w.location.href = f.url
                  else window.location.href = f.url
                })
              }}
            >
              Apri il file
            </button>
          </div>
          <Campo id="c-scade-mandato" etichetta="VALIDO FINO AL">
            <input id="c-scade-mandato" className="sg-campo" type="date" value={scadeMandato} onChange={(e) => setScadeMandato(e.target.value)} />
          </Campo>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="sg-btn sg-btn-pieno grow"
              disabled={!scadeMandato}
              onClick={() => void fai(() => d.confermaCertificatoIscritto(p.id, scadeMandato), 'Certificato confermato', onCambiato)}
            >
              Conferma
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-linea sg-pericolo grow"
              onClick={async () => {
                if (await chiedi(`Rifiutare il certificato mandato da ${p.nome} ${p.cognome}? Il file si cancella e dovrà rimandarlo.`, 'Rifiuta', { pericolo: true }))
                  void fai(() => d.rifiutaCertificatoIscritto(p.id), 'Certificato rifiutato', onCambiato)
              }}
            >
              Rifiuta
            </button>
          </div>
        </div>
      )}

      {gesto ? (
        <div className="stack" style={{ gap: 10, padding: 14, background: 'var(--surface)', border: '2px solid var(--line)', borderLeft: '4px solid var(--giallo)' }}>
          <Campo etichetta="FILE">
            <div className="row" style={{ gap: 12, alignItems: 'center', padding: '6px 6px 6px 12px', background: 'var(--bg)', border: `2px solid ${gesto.file ? 'var(--verde-testo)' : 'var(--line)'}` }}>
              <span className="grow" style={{ minWidth: 0, fontSize: 15, color: gesto.file ? 'var(--text)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {gesto.file ? gesto.file.name : c.conFile ? 'Resta quello che c’è' : 'Nessun file scelto'}
              </span>
              <button type="button" className="num sg-chip" onClick={() => sel.current?.click()}>
                {gesto.file ? 'Cambia' : 'Scegli'}
              </button>
              <input
                ref={sel}
                type="file"
                className="vh"
                tabIndex={-1}
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) setGesto({ ...gesto, file })
                }}
              />
            </div>
          </Campo>
          <Campo id="c-scade" etichetta="VALIDO FINO AL">
            <input id="c-scade" className="sg-campo" type="date" value={gesto.scade} onChange={(e) => setGesto({ ...gesto, scade: e.target.value })} />
          </Campo>
          {avvisiGesto(gesto, c, oggi).map((t) => (
            <span key={t} style={{ fontSize: 13, color: 'var(--giallo-testo)' }}>
              {t}
            </span>
          ))}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setGesto(null)}>
              Lascia stare
            </button>
            <Tasto
              tono="pieno"
              className="grow"
              disabled={!pronto}
              onClick={() =>
                void fai(
                  () => (gesto.file ? d.caricaCertificato(p.id, gesto.file, gesto.scade) : d.salvaCertificato(p.id, gesto.scade)),
                  c.scade || c.conFile ? 'Certificato cambiato' : 'Certificato salvato',
                  () => {
                    setGesto(null)
                    onCambiato()
                  },
                )
              }
            >
              Salva
            </Tasto>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Il documento d'identità: la copia sta su carta, in segreteria, e qui si
 * segna solo che c'è. Per un minore è quello del genitore.
 */
function Documento({ d, p, minore, fai, onCambiato }: { d: DatiSegreteria; p: PersonaSeg; minore: boolean; fai: Fai; onCambiato: () => void }) {
  const r = riquadroDocumento(p.documento, minore)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="DOCUMENTO D’IDENTITÀ" />
      <Stato nome={r.nome} sotto={r.sotto} tono={r.tono}>
        <button
          type="button"
          className="num sg-chip"
          data-primo={p.documento ? undefined : true}
          onClick={() =>
            void fai(() => d.salvaDocumento(p.id, !p.documento), p.documento ? 'Documento tolto: ora è «Da portare». Se era uno sbaglio, «La copia è in segreteria» lo rimette' : 'Documento segnato in segreteria', onCambiato)
          }
        >
          {r.tasto}
        </button>
      </Stato>
    </div>
  )
}

/**
 * La quota: se ha pagato lo dicono le ricevute (la QUOTA ASSOCIATIVA che vale
 * oggi, vedi `pagamentoDi`). Per chi ha pagato fuori dall'app, prima dell'app
 * o con una ricevuta di carta, c'è l'eccezione scritta a mano, fino a una
 * data. Sotto, fin quando sono pagati i corsi: si guardano, non contano.
 */
function Pagamento({ d, p, fai, onCambiato, onNuova, statiCorsi }: { d: DatiSegreteria; p: PersonaSeg; fai: Fai; onCambiato: () => void; onNuova: () => void; statiCorsi?: StatoCorso[] }) {
  const oggi = chiaveGiorno(new Date())
  const s = pagamentoDi(p, oggi)
  const eccezione = p.pagamento.stato !== 'da_pagare'
  const [scrivi, setScrivi] = useState(false)
  const [b, setB] = useState({ fino: stagioneDi(oggi).quota.al, nota: '' })
  // Il primo corso scaduto dice quale voce scrivere sulla ricevuta nuova.
  const scaduto = statiCorsi?.find((c) => c.come === 'scaduto')

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Riga titolo="QUOTA">
        <button type="button" className={tastoPrincipale(p, oggi) === 'quota' ? 'num sg-chip sg-chip-pieno' : 'num sg-chip'} data-primo onClick={onNuova}>
          + Fai la ricevuta
        </button>
      </Riga>
      <Stato {...riquadroQuota(p, oggi)}>
        {!scrivi && eccezione ? (
          <button
            type="button"
            className="num sg-chip sg-pericolo"
            onClick={async () => {
              if ((await chiedi(`Togliere «pagata fuori dall’app» a ${p.nome} ${p.cognome}? Resta quello che dicono le ricevute.`, 'Togli l’eccezione', { pericolo: true })))
                void fai(() => d.salvaPagamento(p.id, { stato: 'da_pagare' }), 'Tolta: ora contano solo le ricevute', onCambiato)
            }}
          >
            {s.fonte === 'ricevuta' ? 'Togli «fuori app»: non serve più' : 'Togli'}
          </button>
        ) : (
          !scrivi &&
          s.come !== 'pagato' && (
            <button type="button" className="num sg-chip" onClick={() => setScrivi(true)}>
              Segna come pagata
            </button>
          )
        )}
      </Stato>
      {scrivi ? (
        <div className="stack" style={{ gap: 8, padding: '12px 14px', border: '2px dashed var(--tratteggio)' }}>
          <span style={{ fontSize: 14, color: 'var(--sec)' }}>Per chi ha pagato la quota senza una ricevuta dell’app: prima dell’app, o con una ricevuta di carta.</span>
          <div className="sg-due">
            <Campo id="pg-fino" etichetta="VALE FINO AL">
              <input id="pg-fino" className="sg-campo" type="date" value={b.fino} onChange={(e) => setB({ ...b, fino: e.target.value })} />
            </Campo>
            <Campo id="pg-nota" etichetta="NOTA · FACOLTATIVA">
              <input id="pg-nota" className="sg-campo" maxLength={300} placeholder="Ricevuta di carta n. 12…" value={b.nota} onChange={(e) => setB({ ...b, nota: e.target.value })} />
            </Campo>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setScrivi(false)}>
              Lascia stare
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-pieno grow"
              disabled={!b.fino || b.fino < oggi}
              onClick={() =>
                void fai(() => d.salvaPagamento(p.id, { stato: 'pagato', fino: b.fino, nota: b.nota.trim() || undefined }), 'Quota segnata pagata fuori dall’app', () => {
                  setScrivi(false)
                  onCambiato()
                })
              }
            >
              Segna pagata
            </button>
          </div>
        </div>
      ) : null}
      {statiCorsi?.map((c) => <Stato key={c.corsoId} {...riquadroCorso(c)} />)}
      {scaduto && <span style={{ fontSize: 14, color: 'var(--dim)' }}>{consiglioCorso(scaduto)}</span>}
    </div>
  )
}
