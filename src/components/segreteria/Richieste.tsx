import { Etichetta, Riquadro } from '../ds'
import { FiltroRicerca } from './FiltroRicerca'
import type { Ricercata } from '../../lib/ricerca'
import { useState, type ReactNode } from 'react'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import type { DatiRichieste, FileRichiesta, Richiesta, StatoRichiesta } from '../../lib/richieste'
import { DA_STAMPARE, datiRichieste, ETICHETTA_FILE, FILE, minorenne, problemiCertificato, siElimina } from '../../lib/richieste'
import { piatto } from '../../lib/importa'
import { attesoRicevuta } from '../../lib/passiIscrizione'
import { PAGAMENTO } from '../../lib/iscrizione'
import { euroBreve } from '../../lib/ricevute'
import { nomeConosciuto, nomeProvenienza } from '../../lib/provenienza'
import { daRestituire, segnoRichiesta, type PagamentoSatispay } from '../../lib/satispay'
import { anniDiNascita, fuoriEta, voceDelCorso } from '../../lib/listino'
import { useListino } from '../Costi'
import { chiaveGiorno, oraDi } from '../../lib/sala'
import { posizione, vicina } from '../../lib/schedaFinestra'
import { chiedi, Campo, dataLunga, Guaio, lasciare, Riga, SchedaPiena, Testa, useAvviso, useBozza, useCarica, useOrdina } from './comune'
import type { Destinazione, Voce } from './Segreteria'

const STATI: Record<StatoRichiesta, string> = { nuova: 'Nuova', accolta: 'Accolta', rifiutata: 'Rifiutata' }
/** Per ordinare per stato: prima quelle da guardare. */
const ORDINE_STATI: Record<StatoRichiesta, number> = { nuova: 0, accolta: 1, rifiutata: 2 }
const CON_ARTICOLO: Partial<Record<string, string>> = { modulo: 'il modulo firmato' }
const quando = (iso: string) => `${dataLunga(chiaveGiorno(new Date(iso)))}, ${oraDi(iso)}`

/** Il colore del segno Satispay nell'elenco: le classi dei bollini che ci sono già. */
const TIPO_TAG = { aspetta: 'aspetta', fatto: 'fatto', guaio: 'manca' } as const

/** Il bollino del pagamento Satispay nella riga dell'elenco. */
function SegnoSatispay({ segno }: { segno: ReturnType<typeof segnoRichiesta> }) {
  return segno && <span className="num sg-tag" data-tipo={TIPO_TAG[segno.tono]}>{segno.tag}</span>
}

/**
 * Le richieste arrivate dal modulo di iscrizione.
 *
 * Una richiesta non è ancora un iscritto: la segreteria guarda il modulo
 * firmato e la ricevuta, se c'è, e poi la accoglie — la persona entra in elenco,
 * iscritta ai corsi che ha scelto — o la rifiuta. Accolta o rifiutata resta
 * qui con quello che diceva, finché non la si elimina.
 *
 * Il documento d'identità arriva col modulo, ma si tiene su carta: DA
 * STAMPARE trova le richieste che ce l'hanno ancora, e dalla scheda, accolta
 * la richiesta, lo si stampa e lo si cancella. Il certificato medico invece
 * resta: lo si apre prima di accogliere, si scrive la data leggendo il foglio
 * (o si rifiuta il file se è quello sbagliato), e accolta la richiesta passa
 * alla scheda dell'iscritto.
 *
 * Una richiesta mandata dall'area degli iscritti per il nucleo familiare di
 * qualcuno lo dice (NUCLEO): accolta, la persona entra nel suo nucleo.
 *
 * Se in elenco c'è già qualcuno con lo stesso nome e cognome la scheda lo
 * mostra, e lo si sceglie con È LUI / È LEI: la richiesta mandata dalla mamma
 * con la sua email non ha niente che la leghi all'iscritto che aveva dato la
 * propria, e da sola diventerebbe un doppione.
 */
export function Richieste({
  d,
  onVai,
  stampareIniziale,
  ricerca,
  aperta,
  onTogliRicerca,
  onConti,
}: {
  d: DatiSegreteria
  onVai: (v: Voce, d?: Destinazione) => void
  stampareIniziale?: boolean
  /** Aperta da «ALTRI N» della ricerca: l'elenco è solo delle richieste uscite, anche già accolte o rifiutate. */
  ricerca?: Ricercata
  /** Una richiesta scelta dalla ricerca: si apre da sola. */
  aperta?: string
  onTogliRicerca: () => void
  /** Una richiesta accolta, rifiutata o eliminata: i conti di COSA MANCA si rileggono. */
  onConti?: () => void
}) {
  const [r, setR] = useState<DatiRichieste | null>(null)
  const elenco = useCarica(async () => {
    const x = await datiRichieste()
    setR(x)
    return x.richieste()
  }, [])
  const corsi = useCarica(() => d.corsi(), [d])
  const persone = useCarica(() => d.persone(), [d])
  // I titoli delle pagine del sito, per dire da dove arriva una richiesta col suo nome («Judo kids» e non «corso-judo-kids»).
  const titoli = useCarica(() => d.titoliSito(), [d])
  const conDocumento = useCarica(async () => (await datiRichieste()).conDocumento(), [])
  // Il pagamento Satispay vivo di ogni richiesta, in attesa o pagato: uno non andato non si dice (`73-satispay.sql`; senza il file, nessuno).
  const satispay = useCarica(() => d.pagamentiSatispay(), [d])
  const pagamentoDi = (id: string) => (satispay.dato ?? []).find((p) => p.richiestaId === id && p.stato !== 'non-andato')
  const [tutte, setTutte] = useState(false)
  const [daStampare, setDaStampare] = useState(!!stampareIniziale)
  const [scelta, setScelta] = useState<string | null>(aperta ?? null)
  const { avviso, fai } = useAvviso()
  // Gli avvisi per email rimasti fuori dal tetto di oggi: senza 84-avvisi-segreteria.sql sono zero.
  const nonMandati = useCarica(() => d.avvisiNonMandatiOggi(), [d]).dato ?? 0
  const voci = useListino()?.listino.corsi

  const nomi = new Map((corsi.dato ?? []).map((c) => [c.id, c.nome]))
  const chi = new Map((persone.dato ?? []).map((p) => [p.id, `${p.nome} ${p.cognome}`]))
  const doc = conDocumento.dato ?? new Set<string>()
  const stampare = (elenco.dato ?? []).filter((x) => doc.has(x.id)).length
  // Stampati tutti, si torna all'elenco di prima.
  const soloStampare = daStampare && stampare > 0
  const lista = (elenco.dato ?? []).filter((x) => (ricerca ? ricerca.ids.includes(x.id) : soloStampare ? doc.has(x.id) : tutte || x.stato === 'nuova'))
  const nuove = (elenco.dato ?? []).filter((x) => x.stato === 'nuova').length
  const richiesta = (elenco.dato ?? []).find((x) => x.id === scelta) ?? null
  const { ordina, colonna } = useOrdina<Richiesta, 'nome' | 'corsi' | 'arrivata' | 'stato'>({
    nome: (x) => `${x.cognome} ${x.nome}`,
    corsi: (x) => x.corsi.map((c) => nomi.get(c) ?? '?').join(', '),
    arrivata: (x) => x.creataIl,
    stato: (x) => ORDINE_STATI[x.stato],
  })

  // PRECEDENTE e SUCCESSIVA scorrono le richieste che l'elenco mostra, nel suo ordine.
  const mostrate = ordina(lista)
  const ids = mostrate.map((x) => x.id)
  // Con la data del certificato scritta e non salvata, passare ad un'altra o chiudere chiede prima.
  const apri = async (id: string | null) => {
    if (await lasciare()) setScelta(id)
  }
  const vai = (verso: 1 | -1) => {
    const id = vicina(ids, richiesta?.id ?? null, verso)
    return id ? () => void apri(id) : undefined
  }

  const scheda = richiesta && r && (
    <Scheda
      key={richiesta.id}
      d={d}
      r={r}
      x={richiesta}
      insieme={richiesta.invio ? (elenco.dato ?? []).filter((y) => y.invio === richiesta.invio) : [richiesta]}
      satispay={pagamentoDi(richiesta.id)}
      nomi={nomi}
      titoli={titoli.dato ?? {}}
      titolare={richiesta.nucleoDi ? (chi.get(richiesta.nucleoDi) ?? 'un iscritto') : undefined}
      omonimi={(persone.dato ?? []).filter((p) => piatto(p.nome) === piatto(richiesta.nome) && piatto(p.cognome) === piatto(richiesta.cognome))}
      fai={fai}
      onCambiato={() => {
        void elenco.ricarica()
        onConti?.()
      }}
      onStampato={() => void conDocumento.ricarica()}
      // Accolta o rifiutata la richiesta è sbrigata: si torna all'elenco, alla prossima.
      onConclusa={() => setScelta(null)}
      onEliminata={() => {
        setScelta(null)
        void elenco.ricarica()
        onConti?.()
      }}
      onApri={(persona) => onVai('iscritti', { persona })}
    />
  )

  return (
    <>
      {scheda && (
        <SchedaPiena
          key={richiesta.id}
          etichetta={`Richiesta di ${richiesta.nome} ${richiesta.cognome}`}
          torna="Richieste"
          onTorna={() => void apri(null)}
          passaggio={{ posizione: posizione(ids, richiesta.id), onPrecedente: vai(-1), onSuccessiva: vai(1) }}
        >
          {scheda}
        </SchedaPiena>
      )}
      <div className="stack" style={{ gap: 18 }}>
        <Testa
          titolo="RICHIESTE ONLINE"
          sotto={`${nuove === 1 ? 'Una richiesta da guardare.' : nuove ? `${nuove} richieste da guardare.` : 'Nessuna richiesta da guardare.'}${
            stampare === 1 ? ' Una con il documento da stampare e cancellare.' : stampare ? ` ${stampare} con il documento da stampare e cancellare.` : ''
          }`}
        >
          {stampare > 0 && (
            <button type="button" className="num sg-chip" aria-pressed={soloStampare} onClick={() => setDaStampare(!soloStampare)}>
              Da stampare
            </button>
          )}
          <button type="button" className="num sg-chip" aria-pressed={tutte && !soloStampare} onClick={() => (setDaStampare(false), setTutte(!tutte))}>
            Anche quelle già gestite
          </button>
        </Testa>
        {nonMandati > 0 && (
          <section aria-label="Avvisi">
            <Riquadro tono="prova">
              <Etichetta>AVVISI</Etichetta>
              <span>{nonMandati === 1 ? 'Oggi un avviso non è partito' : `Oggi ${nonMandati} avvisi non sono partiti`} per email. Le richieste sono tutte qui sotto.</span>
            </Riquadro>
          </section>
        )}
        {ricerca && <FiltroRicerca ricerca={ricerca} onTogli={onTogliRicerca} />}

        {elenco.guaio && <Guaio testo={elenco.guaio} />}

        <div className="sg-iscritti">
          <div role="table" aria-label="Richieste" className="sg-tabella">
            <div role="row" className="sg-lista-testa sg-riga-iscritto">
              {colonna('nome', 'NOME')}
              {colonna('corsi', 'CORSI')}
              {colonna('arrivata', 'ARRIVATA', { numeri: true })}
              {colonna('stato', 'STATO', { destra: true })}
            </div>
            <div className="sg-tabella-corpo">
              {elenco.dato === null && !elenco.guaio && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo le richieste…</p>}
              {elenco.dato !== null && lista.length === 0 && (
                <p className="sg-sotto" style={{ padding: '12px 14px' }}>
                  {soloStampare
                    ? 'Niente da stampare.'
                    : tutte
                      ? 'Non è ancora arrivata nessuna richiesta.'
                      : 'Nessuna richiesta nuova. Le altre si vedono con «anche quelle già gestite».'}
                </p>
              )}
              {mostrate.map((x) => (
                <div
                  key={x.id}
                  role="row"
                  className="sg-riga-iscritto sg-iscritto"
                  data-scelto={scelta === x.id}
                  data-spento={x.stato === 'rifiutata'}
                  onClick={() => setScelta(x.id)}
                >
                  {/* I bollini vanno a capo: tutti su una riga allargherebbero la colonna e storcerebbero la tabella. */}
                  <span role="cell" style={{ fontSize: 15, fontWeight: 600, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px' }}>
                    <button type="button" className="sg-riga-apri" aria-current={scelta === x.id ? 'true' : undefined}>
                      {x.cognome} {x.nome}
                    </button>
                    {minorenne(x.natoIl) && <span className="num sg-tag">Minore</span>}
                    {x.nucleoDi && <span className="num sg-tag">Nucleo</span>}
                    {doc.has(x.id) && <span className="num sg-tag">Da stampare</span>}
                    <SegnoSatispay segno={segnoRichiesta(pagamentoDi(x.id), x.stato)} />
                    {/* La si richiama: meglio saperlo prima di aprirla. */}
                    {voci && x.corsi.some((c) => {
                      const nome = nomi.get(c)
                      return !!nome && fuoriEta({ id: c, nome }, x.natoIl, voci)
                    }) && (
                      <span className="num sg-tag" data-tipo="aspetta">Fuori età</span>
                    )}
                  </span>
                  <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{x.corsi.map((c) => nomi.get(c) ?? '?').join(', ')}</span>
                  <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{quando(x.creataIl)}</span>
                  <span role="cell" className="num" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textAlign: 'right', color: x.stato === 'nuova' ? 'var(--giallo-testo)' : x.stato === 'accolta' ? 'var(--verde-testo)' : 'var(--dim)' }}>
                    {STATI[x.stato]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {avviso}
    </>
  )
}

type Fai = ReturnType<typeof useAvviso>['fai']

function Scheda({
  d,
  r,
  x,
  insieme,
  satispay,
  nomi,
  titoli,
  titolare,
  omonimi,
  fai,
  onCambiato,
  onStampato,
  onConclusa,
  onEliminata,
  onApri,
}: {
  d: DatiSegreteria
  r: DatiRichieste
  x: Richiesta
  /** Le richieste mandate insieme dal modulo (anche questa): la ricevuta è una per tutte. */
  insieme: Richiesta[]
  /** Il pagamento Satispay dal modulo, se c'è. */
  satispay?: PagamentoSatispay
  nomi: Map<string, string>
  /** I titoli delle pagine del sito per indirizzo (`titoliSito`). */
  titoli: Record<string, string>
  /** Il titolare del nucleo da cui arriva, se arriva dall'area degli iscritti. */
  titolare?: string
  /** Chi in elenco ha già lo stesso nome e cognome. */
  omonimi: PersonaSeg[]
  fai: Fai
  onCambiato: () => void
  /** Il documento stampato e cancellato. */
  onStampato: () => void
  /** Accolta o rifiutata: la richiesta è sbrigata. */
  onConclusa: () => void
  onEliminata: () => void
  onApri: (personaId: string) => void
}) {
  const file = useCarica(() => r.file(x.id), [r, x.id])
  const segno = segnoRichiesta(satispay, x.stato)
  const restituire = daRestituire(satispay)
  const letto = useListino()
  const voci = letto?.listino.corsi
  const minore = minorenne(x.natoIl)
  const arrivati = new Map((file.dato ?? []).map((f) => [f.tipo, f]))
  // Il documento, stampato, si cancella: non manca, è su carta.
  const mancanti = FILE.filter((f) => f.obbligatorio && !DA_STAMPARE.includes(f.tipo) && !arrivati.has(f.tipo))
  const documenti = DA_STAMPARE.filter((t) => arrivati.has(t))
  // Il certificato si guarda prima di accogliere, con la data da scrivere: poi passa alla scheda.
  const atteso = arrivati.has('ricevuta') ? attesoRicevuta(insieme, [...nomi].map(([id, nome]) => ({ id, nome })), letto?.listino, chiaveGiorno(new Date(x.creataIl))) : undefined
  const certificato = x.stato === 'nuova' ? arrivati.get('certificato') : undefined
  const [scadeCert, setScadeCert] = useState('')
  useBozza(scadeCert !== '', `${x.nome} ${x.cognome}`)
  // Accolta, la richiesta crea una persona iscritta ai corsi e non si torna
  // indietro: quello che manca si dice prima, non dopo.
  const problemi = [
    !x.regolamento && 'Il regolamento non è accettato.',
    file.guaio && 'I file non si sono aperti: non si sa se il modulo firmato c’è.',
    ...(file.dato ? mancanti.map((f) => `Manca ${CON_ARTICOLO[f.tipo] ?? f.etichetta.toLowerCase()}.`) : []),
    ...problemiCertificato(!!certificato, scadeCert),
  ].filter((t): t is string => !!t)
  // Finché i file non si sono caricati non si sa cosa manca.
  const inAttesa = file.dato === null && !file.guaio
  const accogli = async (op: () => Promise<string>, riuscito: string) => {
    const chi = `${x.nome} ${x.cognome}${minore ? ' (minorenne)' : ''}`
    if (problemi.length && !(await chiedi(`Accogliere lo stesso la richiesta di ${chi}?\n\n${problemi.join('\n')}\n\nEntra in elenco iscritta ai suoi corsi, e non si torna indietro.`, 'Accogli lo stesso', { pericolo: true }))) return
    // Accolta, il certificato è passato alla scheda: l'elenco dei file si rilegge, se no resterebbe a schermo.
    const rileggi = () => {
      void file.ricarica()
      onCambiato()
    }
    // Riuscita: si ricarica e si chiude. Se fallisce, `fai` lascia la scheda aperta con l'errore.
    const finito = () => {
      rileggi()
      onConclusa()
    }
    void fai(
      async () => {
        try {
          return await op()
        } catch (e) {
          // Accolta ma con la data non salvata: la richiesta è già cambiata, e a schermo deve risultare.
          rileggi()
          throw e
        }
      },
      riuscito,
      finito,
    )
  }
  // La data del certificato la scrive la segreteria dal foglio: la richiesta non la porta, e viaggia con l'accoglimento.
  const accoglila = (personaId?: string) => () => r.accogli(x.id, personaId, certificato ? scadeCert : undefined)

  // Solo da accolta: così la scheda dell'iscritto segna che la copia è in segreteria.
  const stampato = async (personaId: string) => {
    if (!(await chiedi(`${documenti.map((t) => ETICHETTA_FILE[t].toLowerCase()).join(', ')} di ${x.nome} ${x.cognome}: stampati e nella cartellina? Dall'app si cancellano per sempre.`, 'Sì, cancellali dall’app', { pericolo: true }))) return
    void fai(
      async () => {
        for (const t of documenti) await r.eliminaFile(x.id, t)
        await d.salvaDocumento(personaId, true)
      },
      'Cancellato: la scheda dice che la copia è in segreteria',
      () => {
        void file.ricarica()
        onStampato()
      },
    )
  }

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.04em' }}>
          {x.nome.toUpperCase()} {x.cognome.toUpperCase()}
        </span>
        <span className="sg-sotto">
          Arrivata il {quando(x.creataIl)}
          {x.gestitaIl && ` · ${x.stato} il ${quando(x.gestitaIl)}${x.gestitaDa ? ` da ${x.gestitaDa}` : ''}`}
        </span>
      </div>

      <div className="sg-dati">
        {titolare && x.nucleoDi && (
          <Dato etichetta="NUCLEO">
            Aggiunto da{' '}
            <button type="button" className="sg-link" onClick={() => onApri(x.nucleoDi!)}>
              {titolare}
            </button>{' '}
            dalla sua area: accolto, entra nel suo nucleo.
          </Dato>
        )}
        <Dato etichetta="NATO IL">{dataLunga(x.natoIl)}{minore && ' · minorenne'}</Dato>
        <Dato etichetta="A">{x.natoA}</Dato>
        <Dato etichetta="CODICE FISCALE" num>{x.codiceFiscale}</Dato>
        <Dato etichetta="RESIDENZA">{x.indirizzo}, {x.cap} {x.comune}</Dato>
        {minore && (
          <>
            <Dato etichetta="GENITORE">{x.genitoreNome} {x.genitoreCognome}</Dato>
            <Dato etichetta="CF DEL GENITORE" num>{x.genitoreCodiceFiscale}</Dato>
          </>
        )}
        <Dato etichetta={minore ? 'EMAIL DEL GENITORE' : 'EMAIL'}>
          <a href={`mailto:${x.email}`} style={{ color: 'var(--sec)' }}>{x.email}</a>
        </Dato>
        <Dato etichetta="TELEFONO">
          <a href={`tel:${x.telefono.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--sec)' }}>{x.telefono}</a>
        </Dato>
        {x.telefono2 && (
          <Dato etichetta="TELEFONO 2">
            <a href={`tel:${x.telefono2.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--sec)' }}>{x.telefono2}</a>
          </Dato>
        )}
        <Dato etichetta="CORSI">
          {x.corsi.map((c, i) => {
            const nome = nomi.get(c)
            return (
              <span key={c}>
                {i > 0 && ', '}
                {nome ?? 'un corso che non c’è più'}
                {/* Chi si iscrive l'ha scelto lo stesso, avvisato che lo si richiama. */}
                {/* Gli anni del corso: per richiamare non si apre il listino. */}
                {nome && voci && fuoriEta({ id: c, nome }, x.natoIl, voci) && (
                  <span style={{ color: 'var(--giallo-testo)' }}> (fuori età: {anniDiNascita(voceDelCorso(voci, { id: c, nome }) ?? {})}, richiama)</span>
                )}
              </span>
            )
          })}
        </Dato>
        <Dato etichetta="PAGA">{x.formula === 'annuale' ? 'L’annuale' : 'Il trimestre'}</Dato>
        {x.note && <Dato etichetta="NOTE">{x.note}</Dato>}
        <Dato etichetta="REGOLAMENTO">{x.regolamento ? 'Accettato' : 'Non accettato (richiesta di prima della casella)'}</Dato>
        {/* Solo qui, per la segreteria: chi si iscrive non lo vede, e accolta non passa alla scheda. */}
        <Dato etichetta="ARRIVATA DA">{nomeProvenienza(x.provenienza, titoli)}</Dato>
        <Dato etichetta="CI HA CONOSCIUTO">{nomeConosciuto(x.conosciuto)}</Dato>
      </div>

      <Riga titolo="I FILE" />
      {file.guaio && <Guaio testo={file.guaio} />}
      {file.dato === null && !file.guaio && <span className="sg-sotto">Sto cercando i file…</span>}
      {file.dato && (
        <div className="stack" style={{ gap: 8 }}>
          {file.dato.length === 0 && (
            <span className="sg-sotto">{r.modo === 'prova' ? 'Nessun file: in prova restano solo finché la pagina è aperta.' : 'Nessun file arrivato.'}</span>
          )}
          {FILE.filter((f) => arrivati.has(f.tipo) && !DA_STAMPARE.includes(f.tipo) && !(certificato && f.tipo === 'certificato')).map((f) => (
            <Anteprima key={f.tipo} f={arrivati.get(f.tipo)!} />
          ))}
          {atteso && (
            <span className="sg-sotto">
              Confronta con la ricevuta: {euroBreve(atteso.totale)}
              {insieme.length > 1 && ` per le ${insieme.length} richieste mandate insieme`}, a {PAGAMENTO.intestatario}, IBAN {PAGAMENTO.iban}
              {atteso.causale && `, causale «${atteso.causale}»`}.
              {atteso.senzaPrezzo.length > 0 && ` Senza prezzo nel listino: ${atteso.senzaPrezzo.join(', ')}: la cifra non è completa.`}
            </span>
          )}
          {certificato && (
            <div className="stack" style={{ gap: 12, padding: '18px 20px', background: 'var(--surface)', border: '2px solid var(--line)', borderLeft: '4px solid var(--giallo)' }}>
              <span className="sg-etichetta">IL CERTIFICATO ARRIVATO DAL MODULO</span>
              <div className="row" style={{ gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', border: '2px solid var(--line)' }}>
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Il certificato medico</span>
                </span>
                {/* In linea: il tasto pieno della pagina è «Accogli». */}
                <a href={certificato.url} target="_blank" rel="noreferrer" className="num sg-chip">
                  Apri
                </a>
              </div>
              <span className="sg-sotto">
                Aprilo prima di accogliere: se è quello sbagliato, rifiutalo e la persona lo rimanda. Il link dura 10 minuti: se scade, basta riaprire la richiesta.
              </span>
              <div style={{ maxWidth: 280 }}>
                <Campo id="r-scade" etichetta="VALIDO FINO AL">
                  <input id="r-scade" className="sg-campo" type="date" value={scadeCert} onChange={(e) => setScadeCert(e.target.value)} />
                </Campo>
              </div>
              <span className="sg-sotto">
                La data la scrivi tu, leggendo il foglio. Accogliendo, il file passa alla scheda dell’iscritto, in «Certificato medico», se scade dopo quello che ha già: non va stampato né cancellato.
              </span>
              <div className="row">
                <button
                  type="button"
                  className="sg-btn sg-btn-linea"
                  onClick={async () => {
                    if ((await chiedi(`Rifiutare il certificato di ${x.nome} ${x.cognome}? Il file si cancella per sempre: va rimandato, o portato in segreteria.`, 'Rifiuta il file', { pericolo: true })))
                      void fai(() => r.eliminaFile(x.id, 'certificato'), 'File rifiutato e cancellato', () => void file.ricarica())
                  }}
                >
                  Rifiuta il file
                </button>
              </div>
            </div>
          )}
          {/* Non è un guaio: la ricevuta non è obbligatoria, si paga anche al banco. */}
          {segno ? (
            <span className="sg-sotto" data-tono={segno.tono}>{segno.testo}</span>
          ) : (
            file.dato.length > 0 && !arrivati.has('ricevuta') && <span className="sg-sotto">Nessuna ricevuta: il pagamento si fa in segreteria.</span>
          )}
          {documenti.length > 0 && (
            <div className="stack" style={{ gap: 8, padding: '10px 12px', border: '1px solid var(--giallo-testo)', borderRadius: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--giallo-testo)' }}>
                Il documento d’identità non resta nell’app: aprilo, stampalo, mettilo nella cartellina e cancellalo da qui.
                {!x.personaId && ' Prima accogli la richiesta, così la scheda dell’iscritto lo segna.'}
              </span>
              {documenti.map((t) => (
                <Anteprima key={t} f={arrivati.get(t)!} />
              ))}
              {x.personaId && (
                <div className="row">
                  <button type="button" className="sg-btn sg-btn-rosso" onClick={() => stampato(x.personaId!)}>
                    Stampato, cancella
                  </button>
                </div>
              )}
            </div>
          )}
          {x.stato !== 'nuova' && mancanti.length > 0 && file.dato.length > 0 && (
            <span className="sg-sotto" style={{ color: 'var(--rosso-testo)' }}>Manca: {mancanti.map((f) => f.etichetta.toLowerCase()).join(', ')}.</span>
          )}
          {file.dato.length > 0 && <span className="sg-sotto" style={{ fontSize: 12 }}>I link valgono dieci minuti: se non si aprono più, riapri la richiesta.</span>}
        </div>
      )}

      {x.stato === 'nuova' && omonimi.length > 0 && (
        <>
          <Riga titolo={omonimi.length === 1 ? 'IN ELENCO C’È GIÀ' : `IN ELENCO CE NE SONO GIÀ ${omonimi.length}`} />
          <span className="sg-sotto">
            Stesso nome e cognome. Se è {omonimi.length === 1 ? 'lui' : 'uno di loro'}, accogli la richiesta sulla sua scheda: se no «Accogli» ne fa una nuova
            quando la scheda ha già un altro codice fiscale, o quando email e telefono non tornano.
          </span>
          <div className="stack" style={{ gap: 8 }}>
            {omonimi.map((p) => {
              const corsi = p.iscrizioni.filter((i) => !i.al || i.al >= chiaveGiorno(new Date())).map((i) => nomi.get(i.corsoId) ?? '?')
              return (
                <div key={p.id} className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="grow" style={{ fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' }}>
                    <button type="button" className="sg-link" onClick={() => onApri(p.id)}>
                      {p.cognome} {p.nome}
                    </button>
                    <span style={{ color: 'var(--sec)' }}>
                      {' · '}
                      {[p.email, p.telefono].filter(Boolean).join(' · ') || 'nessun contatto'}
                      {' · '}
                      {corsi.length ? corsi.join(', ') : 'nessun corso'}
                      {!p.attiva && ' · non attiva'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="sg-btn sg-btn-linea"
                    disabled={inAttesa}
                    onClick={() => accogli(accoglila(p.id), `Accolta sulla scheda di ${p.nome} ${p.cognome}, iscritta ai suoi corsi`)}
                  >
                    Accogli su questa
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {x.stato === 'nuova' && problemi.length > 0 && (
        <div className="sg-prima">
          <span className="sg-etichetta" data-manca>PRIMA DI ACCOGLIERE</span>
          <ul>
            {problemi.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <span className="sg-sotto">
            {minore && file.dato && !arrivati.has('modulo') ? 'È minorenne: senza il modulo firmato dal genitore non c’è il suo consenso. ' : ''}
            Chiedi quello che manca prima, o accogli lo stesso se l’hai già in segreteria su carta.
          </span>
        </div>
      )}

      {/* Accogli e Rifiuta restano in vista anche con la scheda lunga: scorre il corpo della finestra. */}
      <div className="row sg-scheda-piede-fisso" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {x.stato === 'nuova' && (
          <>
            <button
              type="button"
              className={problemi.length ? 'sg-btn sg-btn-linea' : 'sg-btn sg-btn-verde'}
              disabled={inAttesa}
              onClick={() => accogli(accoglila(), 'Accolta: ora è in elenco e iscritta ai suoi corsi')}
            >
              {problemi.length ? 'Accogli lo stesso' : 'Accogli'}
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-linea"
              onClick={async () => {
                if ((await chiedi(`Rifiutare la richiesta di ${x.nome} ${x.cognome}? Chi l'ha mandata non viene avvisato: va chiamato o scritto a mano.${restituire ? `\n\n${restituire}` : ''}`, 'Rifiuta la richiesta', { pericolo: true })))
                  void fai(() => r.rifiuta(x.id), 'Richiesta rifiutata', () => {
                    onCambiato()
                    onConclusa()
                  })
              }}
            >
              Rifiuta
            </button>
          </>
        )}
        {x.personaId && (
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => onApri(x.personaId!)}>
            Apri la scheda
          </button>
        )}
      </div>

      {/* Lontano da «Accogli» e «Rifiuta»: cancella i file per sempre e si usa di rado. Accolta, tiene i dati della scheda. */}
      {siElimina(x) && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            type="button"
            className="sg-btn sg-btn-linea sg-pericolo"
            onClick={async () => {
              if ((await chiedi(`Eliminare per sempre la richiesta di ${x.nome} ${x.cognome}, con i suoi file?${restituire ? `\n\n${restituire} Eliminata la richiesta, in RICHIESTE ONLINE non si vede più.` : ''}`, 'Elimina per sempre', { pericolo: true })))
                void fai(() => r.elimina(x.id), 'Richiesta eliminata', onEliminata)
            }}
          >
            Elimina richiesta e file
          </button>
        </div>
      )}
    </>
  )
}

function Dato({ etichetta, children, num }: { etichetta: string; children: ReactNode; num?: boolean }) {
  return (
    <>
      <span className="sg-etichetta">{etichetta}</span>
      <span className={num ? 'num' : undefined} style={{ fontSize: 15, letterSpacing: num ? '0.06em' : undefined, overflowWrap: 'anywhere' }}>
        {children}
      </span>
    </>
  )
}

function Anteprima({ f }: { f: FileRichiesta }) {
  return (
    <a href={f.url} target="_blank" rel="noreferrer" className="sg-file">
      {f.pdf ? <span className="num sg-file-pdf">PDF</span> : <img src={f.url} alt="" className="sg-file-img" />}
      <span className="sg-etichetta" style={{ color: 'var(--sec)' }}>{ETICHETTA_FILE[f.tipo] ?? f.tipo.toUpperCase()}</span>
      <span className="grow" />
      <span className="sg-link">Apri</span>
    </a>
  )
}
