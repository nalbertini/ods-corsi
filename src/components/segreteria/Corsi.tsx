import { useEffect, useState } from 'react'
import type { CorsoSeg, DatiCorso, DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import { COLORI, GIORNI_LUNGHI, inCorso } from '../../lib/segreteria'
import { chiaveGiorno } from '../../lib/sala'
import { Croce } from '../Icons'
import { STRETTO, useSchermo } from '../../lib/largo'
import { Campo, dataLunga, Guaio, Riga, SchedaPiena, Testa, useAvviso, useCarica } from './comune'

const CORTI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

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
export function Corsi({ d }: { d: DatiSegreteria }) {
  const corsi = useCarica(() => d.corsi(), [d])
  const persone = useCarica(() => d.persone(), [d])
  const [scelto, setScelto] = useState<string | null>(null)
  const [nuovo, setNuovo] = useState(false)
  const [archiviati, setArchiviati] = useState(false)
  const { avviso, fai } = useAvviso()
  const oggi = chiaveGiorno(new Date())

  const attivi = (corsi.dato ?? []).filter((c) => c.attivo).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const vecchi = (corsi.dato ?? []).filter((c) => !c.attivo)
  // Sullo schermo stretto la scheda non sta accanto all'elenco: si apre al
  // suo posto quando si tocca un corso, e nessuno è aperto da sé.
  const stretto = useSchermo(STRETTO)
  const corso = nuovo ? null : (attivi.find((c) => c.id === scelto) ?? (stretto ? null : attivi[0]) ?? null)
  const piena = stretto && (nuovo || !!corso)
  const chiudi = () => {
    setNuovo(false)
    setScelto(null)
  }
  const incompleti = attivi.filter((c) => mancano(c).length > 0).length
  const iscrittiA = (id: string) => (persone.dato ?? []).filter((p) => p.attiva && p.iscrizioni.some((i) => i.corsoId === id && inCorso(i, oggi)))

  const scheda = (nuovo || corso) && (
    <Scheda
      key={nuovo ? 'nuovo' : corso!.id}
      d={d}
      corso={corso}
      iscritti={corso ? iscrittiA(corso.id) : []}
      persone={persone.dato ?? []}
      fai={fai}
      onSalvato={(id) => {
        setNuovo(false)
        setScelto(id)
        void corsi.ricarica()
      }}
      onCambiato={() => void Promise.all([corsi.ricarica(), persone.ricarica()])}
      onLasciaStare={() => setNuovo(false)}
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
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setNuovo(true)}>
            + NUOVO CORSO
          </button>
        </Testa>

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
            {attivi.map((c) => {
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
                  onClick={() => {
                    setNuovo(false)
                    setScelto(c.id)
                  }}
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
                  <span className="num sg-corso-n" style={{ fontSize: 17, fontWeight: 700, textAlign: 'right', color: c.capienza && n >= c.capienza ? 'var(--giallo-testo)' : 'var(--text)' }}>
                    {c.capienza ? `${n}/${c.capienza}` : n}
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

function Scheda({
  d,
  corso,
  iscritti,
  persone,
  fai,
  onSalvato,
  onCambiato,
  onLasciaStare,
}: {
  d: DatiSegreteria
  corso: CorsoSeg | null
  iscritti: PersonaSeg[]
  persone: PersonaSeg[]
  fai: Fai
  onSalvato: (id: string) => void
  onCambiato: () => void
  onLasciaStare: () => void
}) {
  const sale = useCarica(() => d.sale(), [d])
  const istruttori = useCarica(() => d.istruttori(), [d])
  const [bozza, setBozza] = useState<DatiCorso>(() => ({
    id: corso?.id,
    nome: corso?.nome ?? '',
    salaId: corso?.salaId,
    istruttori: corso?.istruttori.map((i) => i.id) ?? [],
    capienza: corso?.capienza,
    colore: corso?.colore ?? COLORI[0].hex,
  }))
  // Un corso nuovo prende la prima sala, quando le sale arrivano.
  // Solo un corso nuovo: su uno che esiste senza sala SALVA si accenderebbe da solo.
  useEffect(() => {
    if (!corso && !bozza.salaId && sale.dato?.length) setBozza((b) => ({ ...b, salaId: sale.dato![0].id }))
  }, [corso, sale.dato, bozza.salaId])

  const [ric, setRic] = useState<{ giorno: number; ora: string; durata: number; salaId?: string } | null>(null)
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
  const [daIscrivere, setDaIscrivere] = useState('')
  const cambiato =
    !corso ||
    bozza.nome !== corso.nome ||
    bozza.salaId !== corso.salaId ||
    bozza.capienza !== corso.capienza ||
    bozza.colore !== (corso.colore ?? COLORI[0].hex) ||
    bozza.istruttori.join() !== corso.istruttori.map((i) => i.id).join()

  const liberi = persone
    .filter((p) => p.attiva && !iscritti.some((i) => i.id === p.id))
    .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'))

  return (
    <section aria-label={corso?.nome ?? 'Nuovo corso'} className="sg-scheda" style={{ ['--tinta' as string]: bozza.colore ?? 'var(--line)' }}>
      <div className="row sg-corso-testa" style={{ gap: 12 }}>
        <span className="ob grow" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '0.04em' }}>{(bozza.nome || 'NUOVO CORSO').toUpperCase()}</span>
        {corso ? (
          <button
            type="button"
            className="sg-btn sg-btn-linea"
            onClick={() => {
              if (window.confirm(`Archiviare ${corso.nome}? Le lezioni future senza appello spariscono dal calendario; il registro resta.`)) {
                void fai(() => d.archiviaCorso(corso.id, false), `${corso.nome} archiviato`, onCambiato)
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
          disabled={!cambiato || !bozza.nome.trim()}
          onClick={() => {
            let id = ''
            void fai(
              async () => {
                try {
                  id = await d.salvaCorso(bozza)
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
              </span>
              <button
                type="button"
                className="sg-togli"
                aria-label={`Togli ${GIORNI_LUNGHI[r.giorno]} alle ${r.ora}`}
                onClick={() => {
                  if (window.confirm(`Togliere ${GIORNI_LUNGHI[r.giorno].toLowerCase()} alle ${r.ora}? Le lezioni future senza appello spariscono; quelle già fatte restano.`)) {
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
              onClick={() => setRic({ giorno: 1, ora: corso.ricorrenze[0]?.ora ?? '17:00', durata: corso.ricorrenze[0]?.durata ?? 60 })}
            >
              + AGGIUNGI UN GIORNO
            </button>
          )}
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            Cambiare i giorni tocca solo le lezioni future: quelle con un appello restano come sono. Anche la sala di un giorno vale da oggi in
            avanti, e una lezione spostata a mano dalla settimana resta dov'è.
          </span>
        </div>
      )}

      {corso && (
        <div className="stack" style={{ gap: 8 }}>
          <Riga titolo="ISCRITTI">
            <span className="num" style={{ fontSize: 15, fontWeight: 700, color: corso.capienza && iscritti.length >= corso.capienza ? 'var(--giallo-testo)' : 'var(--text)' }}>
              {corso.capienza ? `${iscritti.length} / ${corso.capienza}` : iscritti.length}
            </span>
          </Riga>
          <div className="sg-nomi">
            {[...iscritti]
              .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'))
              .map((p) => (
                <span key={p.id}>
                  {p.cognome} {p.nome}
                </span>
              ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <label htmlFor="k-iscrivi" className="vh">
              Chi iscrivere
            </label>
            <select id="k-iscrivi" className="sg-campo grow" style={{ borderStyle: 'dashed' }} value={daIscrivere} onChange={(e) => setDaIscrivere(e.target.value)}>
              <option value="">Iscrivi qualcuno a questo corso…</option>
              {liberi.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.cognome} {p.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="num sg-chip sg-chip-pieno"
              disabled={!daIscrivere}
              onClick={() =>
                void fai(() => d.iscrivi(daIscrivere, corso.id), 'Iscrizione fatta', () => {
                  setDaIscrivere('')
                  onCambiato()
                })
              }
            >
              + ISCRIVI
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
