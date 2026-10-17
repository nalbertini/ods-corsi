import { FiltroRicerca } from './FiltroRicerca'
import type { Ricercata } from '../../lib/ricerca'
import { useEffect, useRef, useState } from 'react'
import type { Destinazione, Voce } from './Segreteria'
import type { CorsoSeg, DatiCorso, DatiSegreteria, PersonaSeg, RigaIscrittoCorso } from '../../lib/segreteria'
import { avvisoPosti, cercaFraGliIscritti, COLORI, contoCorso, corsoCambiato, GIORNI_LUNGHI, iscrittiDelCorso, riepilogoCorso, ricorrenzaCambiata, ricorrenzaIniziale, soloNonInRegola, valoriIscrittoCorso, vociAttivita, type RicorrenzaNuova } from '../../lib/segreteria'
import { chiaveGiorno } from '../../lib/sala'
import { Croce } from '../Icons'
import { STRETTO, useSchermo } from '../../lib/largo'
import { chiedi, Campo, dataLunga, Guaio, lasciare, Riga, SchedaPiena, Testa, useAvviso, useBozza, useCarica, useOrdina, type MemoriaOrdine } from './comune'

const CORTI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

type Colonna = 'cognome' | 'nome' | 'dal' | 'certificato' | 'quota'
/**
 * Come si era lasciata la scheda di un corso: quale scheda, cosa si cercava, se il chip NON IN REGOLA era acceso, in che ordine.
 * Aprire un iscritto smonta la scheda; con Indietro si ritrova com'era, senza rifare la ricerca.
 */
const viste = new Map<string, { scheda: 'dati' | 'iscritti'; cerca: string; fuori: boolean; ordine: MemoriaOrdine<Colonna> }>()
const vistaDi = (corsoId: string) => {
  let v = viste.get(corsoId)
  if (!v) viste.set(corsoId, (v = { scheda: 'dati', cerca: '', fuori: false, ordine: { ordine: null } }))
  return v
}

/** «‹ CORSO» dalla scheda di una persona: il corso si riapre sugli iscritti, anche dopo una ricarica (la memoria si è svuotata). */
export const riapriSuIscritti = (corsoId: string) => {
  vistaDi(corsoId).scheda = 'iscritti'
}

/** «lun mer ven 17:00», o gli orari uno per uno quando non sono tutti uguali. */
function quando(c: CorsoSeg) {
  if (!c.ricorrenze.length) return 'nessun giorno'
  const ore = [...new Set(c.ricorrenze.map((r) => r.ora))]
  if (ore.length === 1) return `${c.ricorrenze.map((r) => CORTI[r.giorno]).join(' ')} ${ore[0]}`
  return c.ricorrenze.map((r) => `${CORTI[r.giorno]} ${r.ora}`).join(', ')
}

/** Cosa manca a un corso per essere completo: va sistemato dalla scheda. */
function mancano(c: CorsoSeg) {
  return [!c.salaId && 'sala', !c.istruttori.length && 'istruttore', !c.ricorrenze.length && 'giorni'].filter((x): x is string => !!x)
}

/** «Tatami», o «Tatami · gio Lotta» quando qualche giorno si fa in un'altra sala. */
function dove(c: CorsoSeg) {
  const altrove = new Map<string, string[]>()
  for (const r of c.ricorrenze) if (r.sala && r.salaId !== c.salaId) altrove.set(r.sala, [...(altrove.get(r.sala) ?? []), CORTI[r.giorno]])
  return [c.sala, ...[...altrove].map(([sala, giorni]) => `${[...new Set(giorni)].join(' ')} ${sala}`)].filter(Boolean).join(' · ')
}

/**
 * I corsi: cosa si fa, dove, con chi, e i giorni in cui si fa.
 *
 * Un corso è cosa si fa; le ricorrenze dicono quando, e dove quando un giorno
 * si fa in un'altra sala. Le lezioni del calendario si generano da quelle,
 * quindi cambiare un giorno qui cambia la settimana, ma solo da oggi in
 * avanti: il passato è già nel registro.
 */
export function Corsi({
  d,
  scelto,
  nuovo = false,
  onScelta,
  onNuovo,
  ricerca,
  onTogliRicerca,
  onConti,
  onVai,
}: {
  d: DatiSegreteria
  /** Aperta da «ALTRI N» della ricerca: l'elenco è solo dei corsi usciti. */
  ricerca?: Ricercata
  onTogliRicerca: () => void
  /** Il corso aperto: sta nell'indirizzo, così Indietro lo chiude anche quando prende tutta la pagina. */
  scelto?: string
  /** Il modulo del nuovo corso: sta nell'indirizzo anche lui. */
  nuovo?: boolean
  /** `push` è un passo per Indietro, `replace` corregge l'indirizzo di adesso. */
  onScelta: (id: string | null, passo: 'push' | 'replace') => void
  onNuovo: () => void
  /** Un corso archiviato, salvato o con un iscritto in più: i conti di COSA MANCA si rileggono. */
  onConti?: () => void
  /** Un iscritto dell'elenco: si apre la sua scheda in ISCRITTI (con la domanda se qui c'è del lavoro non salvato). */
  onVai: (v: Voce, dove?: Destinazione) => void | Promise<void>
}) {
  const corsi = useCarica(() => d.corsi(), [d])
  const persone = useCarica(() => d.persone(), [d])
  const [archiviati, setArchiviati] = useState(false)
  const { avviso, avvisa, fai } = useAvviso()
  const oggi = chiaveGiorno(new Date())

  const attivi = (corsi.dato ?? []).filter((c) => c.attivo).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const vecchi = (corsi.dato ?? []).filter((c) => !c.attivo)
  const visti = ricerca ? attivi.filter((c) => ricerca.ids.includes(c.id)) : attivi
  // Sullo schermo stretto la scheda non sta accanto all'elenco: si apre al
  // suo posto quando si tocca un corso, e nessuno è aperto da sé.
  const stretto = useSchermo(STRETTO)
  const corso = nuovo ? null : (attivi.find((c) => c.id === scelto) ?? (stretto ? null : visti[0]) ?? null)
  const piena = stretto && (nuovo || !!corso)
  // Un'altra scheda prende il posto di questa: prima si chiede di quel che non è salvato.
  const apri = async (id: string | null, comeNuovo = false) => {
    if (comeNuovo === nuovo && (comeNuovo || id === corso?.id)) return
    if (!(await lasciare())) return
    if (comeNuovo) onNuovo()
    else onScelta(id, 'push')
  }
  const chiudi = () => void apri(null)
  const incompleti = attivi.filter((c) => mancano(c).length > 0).length
  // Un corso dell'indirizzo che non è in calendario (archiviato, un link
  // vecchio, un'altra finestra): si torna all'elenco e lo si dice. Solo
  // quando l'elenco arriva: un corso appena creato non è in quello di prima.
  useEffect(() => {
    if (!scelto || !corsi.dato || corsi.dato.some((c) => c.attivo && c.id === scelto)) return
    avvisa('Quel corso non è più in calendario')
    onScelta(null, 'replace')
    // Solo all'arrivo dell'elenco: aprire un corso non è un motivo per guardare.
  }, [corsi.dato])
  const iscrittiA = (id: string) => iscrittiDelCorso(persone.dato ?? [], id, oggi)
  // Finché le persone non arrivano (o la lettura fallisce) un conto sarebbe un «0» falso.
  const letti = persone.dato !== null

  const scheda = (nuovo || corso) && (
    <Scheda
      key={nuovo ? 'nuovo' : corso!.id}
      d={d}
      corso={corso}
      iscritti={corso ? iscrittiA(corso.id) : []}
      persone={persone.dato ?? []}
      guaio={persone.dato === null ? persone.guaio : null}
      leggo={!letti && !persone.guaio}
      onApriIscritto={(id) => onVai('iscritti', { persona: id, daCorso: corso?.id })}
      fai={fai}
      onSalvato={(id) => {
        // Al posto del modulo: Indietro dal corso nuovo torna all'elenco, non a un modulo vuoto.
        onScelta(id, 'replace')
        void corsi.ricarica()
        onConti?.()
      }}
      onCambiato={() => {
        void Promise.all([corsi.ricarica(), persone.ricarica()])
        onConti?.()
      }}
      // Archiviato non è più fra i corsi: si torna all'elenco senza un passo per Indietro.
      onArchiviato={() => {
        onScelta(null, 'replace')
        onConti?.()
      }}
      onLasciaStare={() => onScelta(null, 'push')}
    />
  )

  return (
    <>
      {piena && (
        <SchedaPiena key={nuovo ? 'nuovo' : corso!.id} etichetta={corso?.nome ?? 'Nuovo corso'} torna="CORSI" onTorna={chiudi} cornice={false}>
          {scheda}
        </SchedaPiena>
      )}
      {/* L'elenco resta montato sotto la scheda, come negli iscritti. */}
      <div className="stack" style={{ gap: 18 }} hidden={piena}>
        <Testa titolo="CORSI" sotto="Un corso è cosa si fa; le ricorrenze dicono quando. Le lezioni si generano da quelle.">
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => void apri(null, true)}>
            + NUOVO CORSO
          </button>
        </Testa>

        {ricerca && <FiltroRicerca ricerca={ricerca} onTogli={onTogliRicerca} />}
        {corsi.guaio && <Guaio testo={corsi.guaio} />}
        {incompleti > 0 && (
          <span className="sg-manca" style={{ fontSize: 14 }}>
            {incompleti === 1 ? '1 corso ha dati mancanti' : `${incompleti} corsi hanno dati mancanti`}: sono segnati in rosso, aprili per completarli.
          </span>
        )}

        <div className="sg-due-colonne">
          <div className="sg-lista">
            <div className="sg-lista-testa sg-corsi-testa">
              <span className="sg-etichetta">CORSO</span>
              <span className="sg-etichetta sg-corso-quando">QUANDO</span>
              <span className="sg-etichetta" style={{ textAlign: 'right' }}>ISCRITTI</span>
            </div>
            {corsi.dato === null && !corsi.guaio && <p className="sg-sotto">Sto leggendo i corsi…</p>}
            {visti.map((c) => {
              const n = iscrittiA(c.id).length
              const manca = mancano(c)
              return (
                <button
                  key={c.id}
                  type="button"
                  className="sg-corso"
                  data-manca={manca.length > 0}
                  title={manca.length ? `Manca: ${manca.join(', ')}` : undefined}
                  aria-pressed={!nuovo && corso?.id === c.id}
                  onClick={() => void apri(c.id)}
                >
                  <span className="row sg-corso-nome" style={{ gap: 10, minWidth: 0 }}>
                    <span style={{ width: 12, height: 12, flexShrink: 0, background: c.colore ?? 'var(--line)' }} />
                    <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span className="ob" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.03em' }}>{c.nome.toUpperCase()}</span>
                      <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                        {c.salaId ? dove(c) : <span className="sg-manca">sala da assegnare</span>}
                        {' · '}
                        {c.istruttori.length ? c.istruttori.map((i) => i.nome).join(', ') : <span className="sg-manca">istruttore da assegnare</span>}
                      </span>
                    </span>
                  </span>
                  <span className={c.ricorrenze.length ? 'sg-corso-quando' : 'sg-corso-quando sg-manca'} style={{ fontSize: 13, color: c.ricorrenze.length ? 'var(--sec)' : undefined }}>
                    {quando(c)}
                  </span>
                  <span className="num sg-corso-n" style={{ fontSize: 17, fontWeight: 700, textAlign: 'right', color: colorePosti(contoCorso(letti ? n : null, c.capienza).tono) }}>
                    {contoCorso(letti ? n : null, c.capienza).testo}
                  </span>
                </button>
              )
            })}
            {vecchi.length > 0 && (
              <button type="button" className="sg-link" style={{ alignSelf: 'flex-start', padding: '8px 14px' }} onClick={() => setArchiviati(!archiviati)}>
                {archiviati ? 'nascondi gli archiviati' : `${vecchi.length} ${vecchi.length === 1 ? 'corso archiviato' : 'corsi archiviati'} · mostra`}
              </button>
            )}
            {archiviati &&
              vecchi.map((c) => (
                <div key={c.id} className="sg-archiviato">
                  <span className="ob grow" style={{ fontSize: 16, fontWeight: 700 }}>{c.nome.toUpperCase()}</span>
                  <button type="button" className="num sg-chip" onClick={() => void fai(() => d.archiviaCorso(c.id, true), `${c.nome} di nuovo in calendario`, corsi.ricarica)}>
                    RIPRISTINA
                  </button>
                </div>
              ))}
          </div>

          {!stretto && scheda}
        </div>
      </div>
      {avviso}
    </>
  )
}

type Fai = ReturnType<typeof useAvviso>['fai']

/** Il colore di una voce del riepilogo: neutro come il testo, rosso e giallo come un guaio, verde per «tutto in regola». */
const coloreVoce = (tono: 'neutro' | 'giallo' | 'rosso' | 'verde') =>
  tono === 'rosso' ? 'var(--rosso-testo)' : tono === 'giallo' ? 'var(--giallo-testo)' : tono === 'verde' ? 'var(--verde-testo)' : 'var(--sec)'

const colorePosti = (tono: 'neutro' | 'giallo' | 'rosso') => (tono === 'rosso' ? 'var(--rosso-testo)' : tono === 'giallo' ? 'var(--giallo-testo)' : 'var(--text)')

function Scheda({
  d,
  corso,
  iscritti,
  persone,
  guaio,
  leggo,
  onApriIscritto,
  fai,
  onSalvato,
  onCambiato,
  onArchiviato,
  onLasciaStare,
}: {
  d: DatiSegreteria
  corso: CorsoSeg | null
  iscritti: RigaIscrittoCorso[]
  persone: PersonaSeg[]
  /** La lettura delle persone è fallita: non si può dire «0 iscritti». */
  guaio: string | null
  /** Le persone stanno arrivando: niente conto e niente «Nessun iscritto» fino ad allora. */
  leggo: boolean
  onApriIscritto: (id: string) => void | Promise<void>
  fai: Fai
  onSalvato: (id: string) => void
  onCambiato: () => void
  onArchiviato: () => void
  onLasciaStare: () => void
}) {
  const sale = useCarica(() => d.sale(), [d])
  const istruttori = useCarica(() => d.istruttori(), [d])
  const attivita = useCarica(() => d.attivita(), [d])
  // Il campo c'è solo se il database ha le tessere (55-tessere.sql): se no la colonna non esiste e non si scrive.
  const tessereDelDb = useCarica(() => d.tessere(), [d])
  const [bozza, setBozza] = useState<DatiCorso>(() => ({
    id: corso?.id,
    nome: corso?.nome ?? '',
    salaId: corso?.salaId,
    istruttori: corso?.istruttori.map((i) => i.id) ?? [],
    capienza: corso?.capienza,
    colore: corso?.colore ?? COLORI[0].hex,
    enteTessera: corso?.enteTessera,
  }))
  // Un corso nuovo prende la prima sala, quando le sale arrivano.
  // Solo un corso nuovo: su uno che esiste senza sala SALVA si accenderebbe da solo.
  useEffect(() => {
    if (!corso && !bozza.salaId && sale.dato?.length) setBozza((b) => ({ ...b, salaId: sale.dato![0].id }))
  }, [corso, sale.dato, bozza.salaId])

  const [ric, setRic] = useState<RicorrenzaNuova | null>(null)
  const salaDelCorso = (sale.dato ?? []).find((s) => s.id === corso?.salaId)?.nome ?? corso?.sala ?? 'nessuna'
  /** La sala di un giorno: vuoto vuol dire quella del corso. */
  const sceltaSala = (id: string, valore: string | undefined, cambia: (salaId: string | undefined) => void, etichetta?: string) => (
    <select
      id={id}
      aria-label={etichetta}
      className="sg-campo"
      data-acceso={!!valore}
      value={valore ?? ''}
      onChange={(e) => cambia(e.target.value || undefined)}
    >
      <option value="">Sala del corso · {salaDelCorso}</option>
      {(sale.dato ?? [])
        .filter((s) => s.id !== corso?.salaId)
        .map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
    </select>
  )
  /** L'attività di un giorno; una già messa e poi tolta dall'uso resta in elenco, o il menu mentirebbe. */
  const sceltaAttivita = (id: string, valore: string | undefined, cambia: (attivitaId: string | undefined) => void, etichetta?: string) => {
    const elenco = attivita.dato?.elenco ?? []
    const voci = vociAttivita(elenco, valore)
    return (
      <select id={id} aria-label={etichetta} className="sg-campo" value={valore ?? ''} onChange={(e) => cambia(e.target.value || undefined)}>
        <option value="">Nessuna attività</option>
        {voci.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
            {a.fuoriUso ? ' (non più in uso)' : ''}
          </option>
        ))}
      </select>
    )
  }
  const [daIscrivere, setDaIscrivere] = useState('')
  // La bozza appena salvata: finché il corso non è riletto, `corso` è ancora
  // quello di prima, e senza questo la domanda scatterebbe a vuoto.
  const [salvata, setSalvata] = useState<DatiCorso | null>(null)
  const cambiato = bozza !== salvata && corsoCambiato(corso, bozza, corso ? undefined : sale.dato?.[0]?.id)
  const ricCambiato = !!ric && !!corso && ricorrenzaCambiata(corso, ric)
  const datiDaSalvare = cambiato || ricCambiato
  useBozza(datiDaSalvare || !!daIscrivere, corso?.nome ?? (bozza.nome.trim() || 'Nuovo corso'))

  const vista = vistaDi(corso?.id ?? '')
  const [scheda, setSchedaGiu] = useState(vista.scheda)
  const setScheda = (s: 'dati' | 'iscritti') => {
    vista.scheda = s
    setSchedaGiu(s)
  }
  const montata = useRef(true)
  useEffect(() => () => void (montata.current = false), [])
  // TORNA A FINIRE: chi resta ha delle modifiche, e stanno in DATI. Si guarda solo se la scheda è ancora lì, senza ricordarlo per Indietro.
  const apriIscritto = async (id: string) => {
    await onApriIscritto(id)
    if (montata.current && datiDaSalvare) setSchedaGiu('dati')
  }
  const nonLetti = !!guaio || leggo
  const conto = contoCorso(nonLetti ? null : iscritti.length, corso?.capienza)

  const liberi = persone
    .filter((p) => p.attiva && !iscritti.some((i) => i.persona.id === p.id))
    .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'))

  return (
    <section aria-label={corso?.nome ?? 'Nuovo corso'} className="sg-scheda" style={{ ['--tinta' as string]: bozza.colore ?? 'var(--line)' }}>
      <div className="row sg-corso-testa" style={{ gap: 12 }}>
        <span className="ob grow" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em' }}>{(bozza.nome || 'NUOVO CORSO').toUpperCase()}</span>
        {corso ? (
          <button
            type="button"
            className="sg-btn sg-btn-linea"
            onClick={async () => {
              if ((await chiedi(`Archiviare ${corso.nome}? Le lezioni future senza appello spariscono dal calendario; il registro resta.`, 'ARCHIVIA IL CORSO'))) {
                void fai(() => d.archiviaCorso(corso.id, false), `${corso.nome} archiviato`, () => {
                  onArchiviato()
                  onCambiato()
                })
              }
            }}
          >
            ARCHIVIA
          </button>
        ) : (
          <button type="button" className="sg-btn sg-btn-linea" onClick={onLasciaStare}>
            LASCIA STARE
          </button>
        )}
        <button
          type="button"
          className="sg-btn sg-btn-pieno"
          disabled={(!!corso && !cambiato) || !bozza.nome.trim()}
          onClick={() => {
            let id = ''
            const inviata = bozza
            void fai(
              async () => {
                try {
                  id = await d.salvaCorso(inviata)
                  setSalvata(inviata)
                } catch (e) {
                  // Il corso nuovo è stato creato anche se il resto no: si apre,
                  // così un secondo SALVA non ne crea un altro uguale.
                  const creato = (e as { id?: string }).id
                  if (!corso && creato) onSalvato(creato)
                  throw e
                }
              },
              corso ? 'Corso salvato' : 'Corso creato: ora aggiungi i giorni',
              () => onSalvato(id),
            )
          }}
        >
          SALVA
        </button>
      </div>

      {corso && (
        <div role="tablist" aria-label="Il corso" className="schede sg-schede">
          <button type="button" role="tab" aria-selected={scheda === 'dati'} className="scheda" data-on={scheda === 'dati'} onClick={() => setScheda('dati')}>
            DATI
            {datiDaSalvare && <span aria-hidden="true" style={{ color: 'var(--giallo-testo)', marginLeft: 8 }}>●</span>}
            {datiDaSalvare && <span className="vh"> (modifiche non salvate)</span>}
          </button>
          <button type="button" role="tab" aria-selected={scheda === 'iscritti'} className="scheda" data-on={scheda === 'iscritti'} onClick={() => setScheda('iscritti')}>
            ISCRITTI
            {!nonLetti && (
              <span className="num" style={{ marginLeft: 8, letterSpacing: '0.06em', color: colorePosti(conto.tono) }}>
                {conto.testo}
              </span>
            )}
            {!!daIscrivere && <span aria-hidden="true" style={{ color: 'var(--giallo-testo)', marginLeft: 8 }}>●</span>}
            {!!daIscrivere && <span className="vh"> (qualcuno scelto, da iscrivere)</span>}
          </button>
        </div>
      )}

      {(!corso || scheda === 'dati') && (
        <>
      <div className="sg-tre">
        <Campo id="k-nome" etichetta="NOME">
          <input id="k-nome" className="sg-campo" value={bozza.nome} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} />
        </Campo>
        <Campo id="k-sala" etichetta="SALA" manca={!bozza.salaId}>
          <select
            id="k-sala"
            className="sg-campo"
            aria-invalid={!bozza.salaId}
            value={bozza.salaId ?? ''}
            onChange={(e) => setBozza({ ...bozza, salaId: e.target.value || undefined })}
          >
            {!bozza.salaId && <option value="">Da assegnare: scegli la sala</option>}
            {(sale.dato ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="k-posti" etichetta="POSTI">
          <input
            id="k-posti"
            className="sg-campo"
            type="number"
            min={1}
            value={bozza.capienza ?? ''}
            onChange={(e) => setBozza({ ...bozza, capienza: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Campo>
        {tessereDelDb.dato && !tessereDelDb.dato.manca && (
          <Campo id="k-tessera" etichetta="TESSERA RICHIESTA">
            <input
              id="k-tessera"
              className="sg-campo"
              maxLength={40}
              placeholder="NESSUNA"
              aria-describedby="k-tessera-nota"
              value={bozza.enteTessera ?? ''}
              onChange={(e) => setBozza({ ...bozza, enteTessera: e.target.value.toUpperCase() })}
            />
            <span id="k-tessera-nota" className="sg-sotto">
              L’ente della tessera che chi si iscrive deve avere (FIJLKAM, FIPE…). Vuoto: il corso non la chiede.
            </span>
          </Campo>
        )}
        <Campo etichetta={bozza.istruttori.length ? "ISTRUTTORI · anche più d'uno" : 'ISTRUTTORI · da assegnare'} largo manca={!bozza.istruttori.length}>
          <div className={bozza.istruttori.length ? 'row' : 'row sg-scelte-mancano'} style={{ flexWrap: 'wrap', gap: 6 }}>
            {(istruttori.dato ?? []).map((i) => {
              const dentro = bozza.istruttori.includes(i.id)
              return (
                <button
                  key={i.id}
                  type="button"
                  className="num sg-chip"
                  aria-pressed={dentro}
                  onClick={() => setBozza({ ...bozza, istruttori: dentro ? bozza.istruttori.filter((x) => x !== i.id) : [...bozza.istruttori, i.id] })}
                >
                  {i.nome}
                </button>
              )
            })}
          </div>
        </Campo>
        <Campo etichetta="COLORE">
          <div className="row" style={{ gap: 8, height: 44 }}>
            {COLORI.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={c.nome}
                aria-pressed={bozza.colore === c.hex}
                className="sg-colore"
                style={{ background: c.hex }}
                onClick={() => setBozza({ ...bozza, colore: c.hex })}
              />
            ))}
          </div>
        </Campo>
      </div>
      {bozza.istruttori.length > 1 && (
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>
          Tutti possono fare l'appello e aggiornare le lezioni; il primo che hai scelto è quello di riferimento.
        </span>
      )}

      {corso && (
        <div className="stack" style={{ gap: 8 }}>
          <Riga titolo="RICORRENZE" />
          {corso.ricorrenze.length === 0 && <span className="sg-manca" style={{ fontSize: 14 }}>Nessun giorno: questo corso non genera lezioni. Aggiungine almeno uno.</span>}
          {corso.ricorrenze.map((r) => (
            <div key={r.id} className="sg-ricorrenza">
              <span style={{ fontSize: 15, fontWeight: 600 }}>{GIORNI_LUNGHI[r.giorno]}</span>
              <span className="num" style={{ fontSize: 17, fontWeight: 700 }}>{r.ora}</span>
              <span style={{ fontSize: 14, color: 'var(--sec)' }}>{r.durata} min</span>
              <span style={{ fontSize: 14, color: 'var(--sec)' }}>
                dal {dataLunga(r.dal)}
                {r.al ? ` al ${dataLunga(r.al)}` : ''}
              </span>
              <span className="sg-ricorrenza-sala">
                <span className="sg-etichetta" aria-hidden="true">
                  SALA
                </span>
                {sceltaSala(
                  `r-sala-${r.id}`,
                  r.salaId && r.salaId !== corso.salaId ? r.salaId : undefined,
                  (salaId) =>
                    void fai(
                      () => d.salaRicorrenza(r.id, salaId ?? null),
                      `${GIORNI_LUNGHI[r.giorno]} ${salaId ? `in ${(sale.dato ?? []).find((s) => s.id === salaId)?.nome ?? 'un’altra sala'}` : 'nella sala del corso'}: le lezioni future la seguono`,
                      onCambiato,
                    ),
                  `Sala del ${GIORNI_LUNGHI[r.giorno].toLowerCase()} alle ${r.ora}`,
                )}
                {!attivita.dato?.manca && (
                  <span className="sg-ricorrenza-voce">
                    <span className="sg-etichetta" aria-hidden="true">
                      ATTIVITÀ
                    </span>
                    {sceltaAttivita(
                      `r-att-${r.id}`,
                      r.attivitaId,
                      (attivitaId) =>
                        void fai(
                          () => d.attivitaRicorrenza(r.id, attivitaId ?? null),
                          `${GIORNI_LUNGHI[r.giorno]}: ${attivitaId ? (attivita.dato?.elenco.find((a) => a.id === attivitaId)?.nome ?? 'attività') : 'nessuna attività'}`,
                          onCambiato,
                        ),
                      `Attività del ${GIORNI_LUNGHI[r.giorno].toLowerCase()} alle ${r.ora}`,
                    )}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="sg-togli"
                aria-label={`Togli ${GIORNI_LUNGHI[r.giorno]} alle ${r.ora}`}
                onClick={async () => {
                  if ((await chiedi(`Togliere ${GIORNI_LUNGHI[r.giorno].toLowerCase()} alle ${r.ora}? Le lezioni future senza appello spariscono; quelle già fatte restano.`, 'TOGLI IL GIORNO'))) {
                    void fai(() => d.togliRicorrenza(r.id), 'Giorno tolto', onCambiato)
                  }
                }}
              >
                <Croce size={16} />
              </button>
            </div>
          ))}
          {ric ? (
            <div className="sg-nuova-ricorrenza">
              <Campo id="r-g" etichetta="GIORNO">
                <select id="r-g" className="sg-campo" value={ric.giorno} onChange={(e) => setRic({ ...ric, giorno: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 0].map((g) => (
                    <option key={g} value={g}>
                      {GIORNI_LUNGHI[g]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id="r-o" etichetta="ORA">
                <input id="r-o" className="sg-campo" type="time" value={ric.ora} onChange={(e) => setRic({ ...ric, ora: e.target.value })} />
              </Campo>
              <Campo id="r-d" etichetta="MINUTI">
                <input
                  id="r-d"
                  className="sg-campo"
                  type="number"
                  min={5}
                  max={480}
                  style={{ width: 90 }}
                  value={ric.durata}
                  onChange={(e) => setRic({ ...ric, durata: Number(e.target.value) })}
                />
              </Campo>
              <Campo id="r-s" etichetta="SALA">
                {sceltaSala('r-s', ric.salaId, (salaId) => setRic({ ...ric, salaId }))}
              </Campo>
              {!attivita.dato?.manca && (
                <Campo id="r-a" etichetta="ATTIVITÀ">
                  {sceltaAttivita('r-a', ric.attivitaId, (attivitaId) => setRic({ ...ric, attivitaId }))}
                </Campo>
              )}
              <div className="grow" />
              <button type="button" className="num sg-chip" onClick={() => setRic(null)}>
                LASCIA STARE
              </button>
              <button
                type="button"
                className="num sg-chip sg-chip-pieno"
                disabled={!ric.ora || ric.durata < 5}
                onClick={() => void fai(() => d.aggiungiRicorrenza(corso.id, ric), 'Giorno aggiunto: le lezioni sono in calendario', () => {
                  setRic(null)
                  onCambiato()
                })}
              >
                AGGIUNGI
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="sg-btn sg-btn-tratteggio"
              onClick={() => setRic(ricorrenzaIniziale(corso))}
            >
              + AGGIUNGI UN GIORNO
            </button>
          )}
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            Cambiare i giorni tocca solo le lezioni future: quelle con un appello restano come sono. Anche la sala di un giorno vale da oggi in
            avanti, e una lezione spostata a mano dalla settimana resta dov'è.
          </span>
          {!attivita.dato?.manca && (
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>
              L'attività vale da oggi in poi. Le lezioni già fatte e quelle con l'appello restano com'erano; anche quelle che hai cambiato a mano.
            </span>
          )}
        </div>
      )}
        </>
      )}

      {corso && scheda === 'iscritti' && (
        <IscrittiDelCorso
          corso={corso}
          righe={iscritti}
          guaio={guaio}
          leggo={leggo}
          liberi={liberi}
          daIscrivere={daIscrivere}
          onDaIscrivere={setDaIscrivere}
          onIscrivi={() =>
            void fai(() => d.iscrivi(daIscrivere, corso.id), 'Iscrizione fatta', () => {
              setDaIscrivere('')
              onCambiato()
            })
          }
          onApri={apriIscritto}
        />
      )}
    </section>
  )
}

/** Il tab ISCRITTI di un corso: chi c'è, da cercare e da ordinare; un clic apre la scheda della persona. */
function IscrittiDelCorso({
  corso,
  righe,
  guaio,
  leggo,
  liberi,
  daIscrivere,
  onDaIscrivere,
  onIscrivi,
  onApri,
}: {
  corso: CorsoSeg
  righe: RigaIscrittoCorso[]
  guaio: string | null
  leggo: boolean
  liberi: PersonaSeg[]
  daIscrivere: string
  onDaIscrivere: (id: string) => void
  onIscrivi: () => void
  onApri: (id: string) => void
}) {
  const vista = vistaDi(corso.id)
  const [cerca, setCercaGiu] = useState(vista.cerca)
  const setCerca = (t: string) => {
    vista.cerca = t
    setCercaGiu(t)
  }
  const { ordina, colonna } = useOrdina<RigaIscrittoCorso, Colonna>(
    {
      cognome: (r) => valoriIscrittoCorso(r).cognome,
      nome: (r) => valoriIscrittoCorso(r).nome,
      dal: (r) => valoriIscrittoCorso(r).dal,
      certificato: (r) => valoriIscrittoCorso(r).certificato,
      quota: (r) => valoriIscrittoCorso(r).quota,
    },
    vista.ordine,
  )
  const [fuori, setFuoriGiu] = useState(vista.fuori)
  const setFuori = (v: boolean) => {
    vista.fuori = v
    setFuoriGiu(v)
  }
  const trovate = cercaFraGliIscritti(fuori ? soloNonInRegola(righe) : righe, cerca)
  const filtrato = fuori || cerca.trim() !== ''
  const avviso = avvisoPosti(righe.length, corso.capienza)

  return (
    <div className="stack" style={{ gap: 12 }}>
      {guaio ? (
        <Guaio testo={guaio} />
      ) : leggo ? (
        <p className="sg-sotto">Sto leggendo gli iscritti…</p>
      ) : (
        <>
          <div className="num" role="status" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em' }}>
            {riepilogoCorso(righe, corso.capienza).map((v, i) => (
              <span key={v.testo} style={{ color: coloreVoce(v.tono) }}>
                {i > 0 && <span style={{ color: 'var(--dim)', marginRight: 10 }}>·</span>}
                {v.testo}
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="k-cerca-iscritti" className="vh">
              Cerca fra gli iscritti
            </label>
            <input
              id="k-cerca-iscritti"
              className="sg-campo"
              style={{ flex: '1 1 200px', maxWidth: 360, minWidth: 0 }}
              type="search"
              placeholder="Cerca per nome o cognome"
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
            />
            <button type="button" className="num sg-chip" aria-pressed={fuori} onClick={() => setFuori(!fuori)}>
              NON IN REGOLA
            </button>
            {filtrato && (
              <span className="num" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em' }}>
                {trovate.length} DI {righe.length}
              </span>
            )}
          </div>
          <div role="table" aria-label="Iscritti del corso" className="sg-tabella">
            <div role="row" className="sg-lista-testa sg-riga-iscritto-corso">
              {colonna('cognome', 'COGNOME')}
              {colonna('nome', 'NOME')}
              {colonna('dal', 'ISCRITTO DAL')}
              {colonna('certificato', 'CERTIFICATO')}
              {colonna('quota', 'QUOTA')}
            </div>
            <div className="sg-tabella-corpo">
              {righe.length === 0 && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Nessun iscritto ancora.</p>}
              {righe.length > 0 && trovate.length === 0 && (
                <p className="sg-sotto" style={{ padding: '12px 14px' }}>
                  {fuori && cerca.trim() === '' ? 'Tutti in regola.' : 'Nessun iscritto trovato. Prova con meno lettere.'}
                </p>
              )}
              {ordina(trovate).map((r) => (
                // Come in ISCRITTI: si clicca tutta la riga; dalla tastiera e per chi legge lo schermo c'è il tasto sul cognome.
                <div key={r.persona.id} role="row" className="sg-riga-iscritto-corso sg-iscritto" onClick={() => onApri(r.persona.id)}>
                  <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>
                    <button type="button" className="sg-riga-apri">
                      {r.persona.cognome}
                    </button>
                  </span>
                  <span role="cell" style={{ fontSize: 15, fontWeight: 600 }}>{r.persona.nome}</span>
                  <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{dataLunga(r.dal)}</span>
                  <span role="cell">
                    <span className="num sg-segno-regola" data-tono={r.certificato.tono}>{r.certificato.parola}</span>
                  </span>
                  <span role="cell">
                    <span className="num sg-segno-regola" data-tono={r.quota.tono}>{r.quota.parola}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          {avviso && (
            <span className="sg-manca" style={{ fontSize: 14 }}>
              {avviso}
            </span>
          )}
        </>
      )}
      <div className="row" style={{ gap: 8 }}>
        <label htmlFor="k-iscrivi" className="vh">
          Chi iscrivere
        </label>
        <select id="k-iscrivi" className="sg-campo grow" style={{ borderStyle: 'dashed' }} value={daIscrivere} onChange={(e) => onDaIscrivere(e.target.value)}>
          <option value="">Iscrivi qualcuno…</option>
          {liberi.map((p) => (
            <option key={p.id} value={p.id}>
              {p.cognome} {p.nome}
            </option>
          ))}
        </select>
        <button type="button" className="num sg-chip sg-chip-pieno" disabled={!daIscrivere} onClick={onIscrivi}>
          + ISCRIVI
        </button>
      </div>
    </div>
  )
}
