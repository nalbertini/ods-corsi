import { useState, type ReactNode } from 'react'
import type { DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import type { DatiRichieste, FileRichiesta, Richiesta, StatoRichiesta } from '../../lib/richieste'
import { accogliConCertificato, DA_STAMPARE, datiRichieste, ETICHETTA_FILE, FILE, minorenne, problemiCertificato } from '../../lib/richieste'
import { piatto } from '../../lib/importa'
import { anniDiNascita, fuoriEta, voceDelCorso } from '../../lib/listino'
import { useListino } from '../Costi'
import { chiaveGiorno, oraDi } from '../../lib/sala'
import { STRETTO, useSchermo } from '../../lib/largo'
import { chiedi, Campo, dataLunga, Guaio, Riga, SchedaPiena, Testa, useAvviso, useCarica, useOrdina } from './comune'
import type { Destinazione, Voce } from './Segreteria'

const STATI: Record<StatoRichiesta, string> = { nuova: 'NUOVA', accolta: 'ACCOLTA', rifiutata: 'RIFIUTATA' }
/** Per ordinare per stato: prima quelle da guardare. */
const ORDINE_STATI: Record<StatoRichiesta, number> = { nuova: 0, accolta: 1, rifiutata: 2 }
const CON_ARTICOLO: Partial<Record<string, string>> = { modulo: 'il modulo firmato' }
const quando = (iso: string) => `${dataLunga(chiaveGiorno(new Date(iso)))}, ${oraDi(iso)}`

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
 * qualcuno lo dice (NUCLEO): accolta, la persona entra nel suo nucleo, e per
 * un minore il documento è quello del genitore, che la segreteria ha già.
 *
 * Se in elenco c'è già qualcuno con lo stesso nome e cognome la scheda lo
 * mostra, e lo si sceglie con È LUI / È LEI: la richiesta mandata dalla mamma
 * con la sua email non ha niente che la leghi all'iscritto che aveva dato la
 * propria, e da sola diventerebbe un doppione.
 */
export function Richieste({ d, onVai, stampareIniziale }: { d: DatiSegreteria; onVai: (v: Voce, d?: Destinazione) => void; stampareIniziale?: boolean }) {
  const [r, setR] = useState<DatiRichieste | null>(null)
  const elenco = useCarica(async () => {
    const x = await datiRichieste()
    setR(x)
    return x.richieste()
  }, [])
  const corsi = useCarica(() => d.corsi(), [d])
  const persone = useCarica(() => d.persone(), [d])
  const conDocumento = useCarica(async () => (await datiRichieste()).conDocumento(), [])
  const [tutte, setTutte] = useState(false)
  const [daStampare, setDaStampare] = useState(!!stampareIniziale)
  const [scelta, setScelta] = useState<string | null>(null)
  const { avviso, fai } = useAvviso()
  const voci = useListino()?.listino.corsi

  const nomi = new Map((corsi.dato ?? []).map((c) => [c.id, c.nome]))
  const chi = new Map((persone.dato ?? []).map((p) => [p.id, `${p.nome} ${p.cognome}`]))
  const doc = conDocumento.dato ?? new Set<string>()
  const stampare = (elenco.dato ?? []).filter((x) => doc.has(x.id)).length
  // Stampati tutti, si torna all'elenco di prima.
  const soloStampare = daStampare && stampare > 0
  const lista = (elenco.dato ?? []).filter((x) => (soloStampare ? doc.has(x.id) : tutte || x.stato === 'nuova'))
  const nuove = (elenco.dato ?? []).filter((x) => x.stato === 'nuova').length
  const richiesta = (elenco.dato ?? []).find((x) => x.id === scelta) ?? null
  // Sullo schermo stretto la richiesta si apre al posto dell'elenco, non sotto.
  const stretto = useSchermo(STRETTO)
  const piena = stretto && !!richiesta
  const { ordina, colonna } = useOrdina<Richiesta, 'nome' | 'corsi' | 'arrivata' | 'stato'>({
    nome: (x) => `${x.cognome} ${x.nome}`,
    corsi: (x) => x.corsi.map((c) => nomi.get(c) ?? '?').join(', '),
    arrivata: (x) => x.creataIl,
    stato: (x) => ORDINE_STATI[x.stato],
  })

  const scheda = richiesta && r && (
    <Scheda
      key={richiesta.id}
      d={d}
      r={r}
      x={richiesta}
      nomi={nomi}
      titolare={richiesta.nucleoDi ? (chi.get(richiesta.nucleoDi) ?? 'un iscritto') : undefined}
      omonimi={(persone.dato ?? []).filter((p) => piatto(p.nome) === piatto(richiesta.nome) && piatto(p.cognome) === piatto(richiesta.cognome))}
      fai={fai}
      onCambiato={() => void elenco.ricarica()}
      onStampato={() => void conDocumento.ricarica()}
      onEliminata={() => {
        setScelta(null)
        void elenco.ricarica()
      }}
      onApri={(persona) => onVai('iscritti', { persona })}
    />
  )

  return (
    <>
      {piena && (
        <SchedaPiena key={richiesta.id} etichetta={`Richiesta di ${richiesta.nome} ${richiesta.cognome}`} torna="RICHIESTE" onTorna={() => setScelta(null)}>
          {scheda}
        </SchedaPiena>
      )}
      <div className="stack" style={{ gap: 18 }} hidden={piena}>
        <Testa
          titolo="RICHIESTE ONLINE"
          sotto={`${nuove === 1 ? 'Una richiesta da guardare.' : nuove ? `${nuove} richieste da guardare.` : 'Nessuna richiesta da guardare.'}${
            stampare === 1 ? ' Una con il documento da stampare e cancellare.' : stampare ? ` ${stampare} con il documento da stampare e cancellare.` : ''
          }`}
        >
          {stampare > 0 && (
            <button type="button" className="num sg-chip" aria-pressed={soloStampare} onClick={() => setDaStampare(!soloStampare)}>
              DA STAMPARE
            </button>
          )}
          <button type="button" className="num sg-chip" aria-pressed={tutte && !soloStampare} onClick={() => (setDaStampare(false), setTutte(!tutte))}>
            ANCHE QUELLE GIÀ GESTITE
          </button>
        </Testa>

        {elenco.guaio && <Guaio testo={elenco.guaio} />}

        <div className="sg-due-colonne sg-iscritti">
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
              {ordina(lista).map((x) => (
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
                    {minorenne(x.natoIl) && <span className="num sg-tag">MINORE</span>}
                    {x.nucleoDi && <span className="num sg-tag">NUCLEO</span>}
                    {doc.has(x.id) && <span className="num sg-tag">DA STAMPARE</span>}
                    {/* La si richiama: meglio saperlo prima di aprirla. */}
                    {voci && x.corsi.some((c) => {
                      const nome = nomi.get(c)
                      return !!nome && fuoriEta({ id: c, nome }, x.natoIl, voci)
                    }) && (
                      <span className="num sg-tag" data-tipo="aspetta">FUORI ETÀ</span>
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

          {!stretto && (
            <section aria-label="Richiesta" className="sg-scheda" style={{ maxWidth: 560 }}>
              {scheda || <span className="sg-sotto">Apri una richiesta per vedere le risposte e i file.</span>}
            </section>
          )}
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
  nomi,
  titolare,
  omonimi,
  fai,
  onCambiato,
  onStampato,
  onEliminata,
  onApri,
}: {
  d: DatiSegreteria
  r: DatiRichieste
  x: Richiesta
  nomi: Map<string, string>
  /** Il titolare del nucleo da cui arriva, se arriva dall'area degli iscritti. */
  titolare?: string
  /** Chi in elenco ha già lo stesso nome e cognome. */
  omonimi: PersonaSeg[]
  fai: Fai
  onCambiato: () => void
  /** Il documento stampato e cancellato. */
  onStampato: () => void
  onEliminata: () => void
  onApri: (personaId: string) => void
}) {
  const file = useCarica(() => r.file(x.id), [r, x.id])
  const voci = useListino()?.listino.corsi
  const minore = minorenne(x.natoIl)
  const arrivati = new Map((file.dato ?? []).map((f) => [f.tipo, f]))
  // Il documento, stampato, si cancella: non manca, è su carta.
  const mancanti = FILE.filter((f) => f.obbligatorio && !DA_STAMPARE.includes(f.tipo) && !arrivati.has(f.tipo))
  const documenti = DA_STAMPARE.filter((t) => arrivati.has(t))
  // Il certificato si guarda prima di accogliere, con la data da scrivere: poi passa alla scheda.
  const certificato = x.stato === 'nuova' ? arrivati.get('certificato') : undefined
  const [scadeCert, setScadeCert] = useState('')
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
    if (problemi.length && !(await chiedi(`Accogliere lo stesso la richiesta di ${chi}?\n\n${problemi.join('\n')}\n\nEntra in elenco iscritta ai suoi corsi, e non si torna indietro.`, 'ACCOGLI LO STESSO', { pericolo: true }))) return
    // Accolta, il certificato è passato alla scheda: l'elenco dei file si rilegge, se no resterebbe a schermo.
    const rileggi = () => {
      void file.ricarica()
      onCambiato()
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
      rileggi,
    )
  }
  // La data del certificato la scrive la segreteria dal foglio: la richiesta non la porta, e viaggia con l'accoglimento.
  const accoglila = (personaId?: string) => () => accogliConCertificato(r, d, x.id, personaId, certificato ? scadeCert : '')

  // Solo da accolta: così la scheda dell'iscritto segna che la copia è in segreteria.
  const stampato = async (personaId: string) => {
    if (!(await chiedi(`${documenti.map((t) => ETICHETTA_FILE[t].toLowerCase()).join(', ')} di ${x.nome} ${x.cognome}: stampati e nella cartellina? Dall'app si cancellano per sempre.`, 'SÌ, CANCELLALI DALL’APP', { pericolo: true }))) return
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
            dalla sua area: accolto, entra nel suo nucleo.{minore && ' Il documento è quello del genitore, già in segreteria.'}
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
          {certificato && (
            <div className="stack" style={{ gap: 12, padding: '18px 20px', background: 'var(--surface)', border: '2px solid var(--line)', borderLeft: '4px solid var(--giallo)' }}>
              <span className="sg-etichetta">IL CERTIFICATO ARRIVATO DAL MODULO</span>
              <div className="row" style={{ gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', border: '2px solid var(--line)' }}>
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Il certificato medico</span>
                </span>
                {/* In linea: il tasto pieno della pagina è ACCOGLI. */}
                <a href={certificato.url} target="_blank" rel="noreferrer" className="num sg-chip">
                  APRI
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
                La data la scrivi tu, leggendo il foglio. Accogliendo, il file resta nella scheda dell’iscritto, in CERTIFICATO MEDICO: non va stampato né cancellato.
              </span>
              <div className="row">
                <button
                  type="button"
                  className="sg-btn sg-btn-linea"
                  onClick={async () => {
                    if ((await chiedi(`Rifiutare il certificato di ${x.nome} ${x.cognome}? Il file si cancella per sempre: va rimandato, o portato in segreteria.`, 'RIFIUTA IL FILE', { pericolo: true })))
                      void fai(() => r.eliminaFile(x.id, 'certificato'), 'File rifiutato e cancellato', () => void file.ricarica())
                  }}
                >
                  RIFIUTA IL FILE
                </button>
              </div>
            </div>
          )}
          {/* Non è un guaio: la ricevuta non è obbligatoria, si paga anche al banco. */}
          {file.dato.length > 0 && !arrivati.has('ricevuta') && <span className="sg-sotto">Nessuna ricevuta: il pagamento si fa in segreteria.</span>}
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
                    STAMPATO, CANCELLA
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
            Stesso nome e cognome. Se è {omonimi.length === 1 ? 'lui' : 'uno di loro'}, accogli la richiesta sulla sua scheda: se no ACCOGLI ne fa una nuova
            quando email, telefono e codice fiscale non tornano.
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
                    ACCOGLI SU QUESTA
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

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {x.stato === 'nuova' && (
          <>
            <button
              type="button"
              className={problemi.length ? 'sg-btn sg-btn-linea' : 'sg-btn sg-btn-verde'}
              disabled={inAttesa}
              onClick={() => accogli(accoglila(), 'Accolta: ora è in elenco e iscritta ai suoi corsi')}
            >
              {problemi.length ? 'ACCOGLI LO STESSO' : 'ACCOGLI'}
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-linea"
              onClick={async () => {
                if ((await chiedi(`Rifiutare la richiesta di ${x.nome} ${x.cognome}? Chi l'ha mandata non viene avvisato: va chiamato o scritto a mano.`, 'RIFIUTA LA RICHIESTA', { pericolo: true })))
                  void fai(() => r.rifiuta(x.id), 'Richiesta rifiutata', onCambiato)
              }}
            >
              RIFIUTA
            </button>
          </>
        )}
        {x.personaId && (
          <button type="button" className="sg-btn sg-btn-linea" onClick={() => onApri(x.personaId!)}>
            APRI LA SCHEDA
          </button>
        )}
      </div>

      {/* Lontano da ACCOGLI e RIFIUTA: cancella i file per sempre e si usa di rado. */}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
        <button
          type="button"
          className="sg-btn sg-btn-linea"
          onClick={async () => {
            if ((await chiedi(`Eliminare per sempre la richiesta di ${x.nome} ${x.cognome}, con i suoi file? La scheda in elenco, se c'è, resta.`, 'ELIMINA PER SEMPRE', { pericolo: true })))
              void fai(() => r.elimina(x.id), 'Richiesta eliminata', onEliminata)
          }}
        >
          ELIMINA RICHIESTA E FILE
        </button>
      </div>
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
