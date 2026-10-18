import { useState } from 'react'
import { chiaveGiorno } from '../../lib/sala'
import type { CorsoSeg, DatiSegreteria, PersonaSeg } from '../../lib/segreteria'
import {
  conTessere,
  contaTessere,
  contiImport,
  fraseTessera,
  incrocioTessere,
  motivoNonAbbinata,
  righeDellaLista,
  tessereRichieste,
  parolaTessera,
  parolaTesseraBreve,
  righeDalFoglio,
  statoDiUna,
  type EsitoImportTessere,
  type ListaTessere,
  type RigaIncrocio,
  type RigaSaltata,
  type TesseraSeg,
  type TipoTessera,
} from '../../lib/tessere'
import type { Destinazione, Voce } from './Segreteria'
import { Campo, chiedi, Guaio, messaggio, Riga, Testa, useAvviso, useCarica } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']
type Avvisa = ReturnType<typeof useAvviso>['avvisa']

const TIPI: Array<[TipoTessera, string]> = [
  ['praticante', 'Praticante'],
  ['agonista', 'Agonista'],
  ['dirigente', 'Dirigente'],
  ['tecnico', 'Tecnico'],
  ['altro', 'Altro'],
]

function Segno({ tono, children }: { tono: 'rosso' | 'giallo' | 'verde' | 'spento'; children: string }) {
  return (
    <span className="num sg-segno-regola" data-tono={tono}>
      {children}
    </span>
  )
}

/** La parola di una tessera nella sua riga: lo stato dalle sue date, senza «TESSERA» davanti. */
function segnoDiUna(t: TesseraSeg, oggi: string) {
  const stato = statoDiUna(t, oggi)
  const p = parolaTesseraBreve(stato, t.al)
  return p ? <Segno tono={p.tono}>{p.parola}</Segno> : <Segno tono="verde">IN REGOLA</Segno>
}

/**
 * La sezione TESSERE nella scheda di una persona: una riga per tessera, e che
 * tessera chiedono i suoi corsi. A mano si aggiunge una tessera (per chi non
 * è nel foglio del RASD) e si toglie; quelle dell'RASD non si cambiano, si
 * rifà l'import. Senza `61-tessere.sql` (`tessere` indefinito) non c'è.
 */
export function TessereDellaPersona({
  d,
  p,
  tessere,
  corsi,
  oggi,
  fai,
  avvisa,
  onCambiato,
}: {
  d: DatiSegreteria
  p: PersonaSeg
  tessere: TesseraSeg[] | undefined
  corsi: Map<string, CorsoSeg>
  oggi: string
  fai: Fai
  avvisa: Avvisa
  onCambiato: () => void
}) {
  const [scrivi, setScrivi] = useState(false)
  const richieste = tessereRichieste(p, [...corsi.values()], oggi)
  const primoEnte = [...richieste.keys()][0] ?? ''
  const [b, setB] = useState<{ ente: string; tipo: TipoTessera; codice: string; dal: string }>({ ente: primoEnte, tipo: 'praticante', codice: '', dal: oggi })
  if (!tessere) return null
  const sue = tessere.filter((t) => t.personaId === p.id).sort((x, y) => y.al.localeCompare(x.al))
  const chiede = [...richieste].map(([ente, nomi]) => `${nomi.join(', ')} ${nomi.length === 1 ? 'chiede' : 'chiedono'} la tessera ${ente}`).join('. ')

  return (
    <div className="stack" style={{ gap: 8 }} id="sez-tessere">
      <Riga titolo="TESSERE" />
      {sue.length === 0 && (
        <span style={{ fontSize: 14, color: richieste.size ? 'var(--rosso-testo)' : 'var(--sec)' }}>
          {richieste.size ? `Nessuna tessera. ${chiede}.` : 'Nessuna tessera. I suoi corsi non la chiedono.'}
        </span>
      )}
      {sue.map((t) => (
        <div key={t.id} className="sg-iscrizione" style={{ flexWrap: 'wrap', paddingBlock: 6 }}>
          <span className="stack grow" style={{ minWidth: 0, gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{fraseTessera(t, oggi)}</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              n. {t.codice} · {t.origine === 'rasd' ? 'dal RASD' : 'scritta a mano'}
            </span>
          </span>
          {segnoDiUna(t, oggi)}
          <button
            type="button"
            className="sg-btn sg-btn-linea"
            aria-label={`Togli la tessera ${t.ente} n. ${t.codice}`}
            onClick={async () => {
              if (!(await chiedi(`Togliere la tessera ${t.ente} n. ${t.codice} di ${p.nome} ${p.cognome}?`, 'SÌ, TOGLILA'))) return
              // ANNULLA la rimette com'era, anche «dal RASD».
              void fai(() => d.togliTessera(t.id ?? ''), undefined, async () => {
                onCambiato()
                avvisa('Tessera tolta', false, {
                  etichetta: 'ANNULLA',
                  fa: () => void fai(() => d.aggiungiTessera({ personaId: p.id, ente: t.ente, tipo: t.tipo, codice: t.codice ?? '', dal: t.dal, origine: t.origine }), 'Tessera rimessa', onCambiato),
                })
              })
            }}
          >
            TOGLI
          </button>
        </div>
      ))}
      {scrivi ? (
        <div className="stack" style={{ gap: 8, padding: '12px 14px', border: '2px dashed var(--tratteggio)' }}>
          <span style={{ fontSize: 14, color: 'var(--sec)' }}>Per chi non è nel foglio del RASD. Vale fino al 31 dicembre dell’anno di «valida dal».</span>
          <div className="sg-due">
            <Campo id="te-ente" etichetta="ENTE">
              <input id="te-ente" className="sg-campo" maxLength={40} placeholder="FIJLKAM" value={b.ente} onChange={(e) => setB({ ...b, ente: e.target.value.toUpperCase() })} />
            </Campo>
            <Campo id="te-tipo" etichetta="TIPO">
              <select id="te-tipo" className="sg-campo" value={b.tipo} onChange={(e) => setB({ ...b, tipo: e.target.value as TipoTessera })}>
                {TIPI.map(([v, nome]) => (
                  <option key={v} value={v}>
                    {nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="te-codice" etichetta="NUMERO DELLA TESSERA">
              <input id="te-codice" className="sg-campo" maxLength={20} value={b.codice} onChange={(e) => setB({ ...b, codice: e.target.value })} />
            </Campo>
            <Campo id="te-dal" etichetta="VALIDA DAL">
              <input id="te-dal" className="sg-campo" type="date" value={b.dal} onChange={(e) => setB({ ...b, dal: e.target.value })} />
            </Campo>
          </div>
          {(!b.ente.trim() || !b.codice.trim() || !b.dal) && (
            <span className="sg-sotto">Per salvare servono l’ente, il numero della tessera e la data.</span>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="sg-btn sg-btn-linea grow" onClick={() => setScrivi(false)}>
              LASCIA STARE
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-pieno grow"
              disabled={!b.ente.trim() || !b.codice.trim() || !b.dal}
              onClick={() =>
                void fai(() => d.aggiungiTessera({ personaId: p.id, ...b }), 'Tessera aggiunta', () => {
                  setScrivi(false)
                  setB({ ...b, codice: '' })
                  onCambiato()
                })
              }
            >
              SALVA LA TESSERA
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="sg-btn sg-btn-tratteggio" style={{ alignSelf: 'flex-start' }} onClick={() => setScrivi(true)}>
          + AGGIUNGI UNA TESSERA
        </button>
      )}
    </div>
  )
}

type Lista = ListaTessere

/**
 * La pagina TESSERE: l'incrocio fra chi è iscritto e chi è tesserato. Due
 * elenchi: chi non ha la tessera che il corso chiede (manca, scaduta, in
 * scadenza) e chi è tesserato senza un corso. Si tocca una riga per aprire la
 * scheda; per caricare il foglio del RASD si va in IMPOSTAZIONI.
 */
export function PaginaTessere({ d, onVai }: { d: DatiSegreteria; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const [lista, setLista] = useState<Lista>('senza')
  const persone = useCarica(() => d.persone(), [d])
  const corsi = useCarica(() => d.corsi(), [d])
  const tessere = useCarica(() => d.tessere(), [d])
  const oggi = chiaveGiorno(new Date())
  const guaio = persone.guaio ?? corsi.guaio ?? tessere.guaio
  const pronte = persone.dato && corsi.dato && tessere.dato
  const manca = !!tessere.dato?.manca
  const righe: RigaIncrocio[] = pronte && !manca ? incrocioTessere(conTessere(persone.dato!, tessere.dato!.elenco), corsi.dato!, oggi) : []
  const nome = new Map((persone.dato ?? []).map((p) => [p.id, `${p.cognome} ${p.nome}`]))
  const ordinate = (l: Lista) => righeDellaLista(righe, l).sort((a, b) => (nome.get(a.personaId) ?? '').localeCompare(nome.get(b.personaId) ?? '', 'it'))
  const senza = ordinate('senza')
  const senzaCorso = ordinate('senza-corso')
  const visibili = ordinate(lista)
  const sotto = !pronte
    ? 'Un attimo…'
    : manca
      ? 'Le tessere non sono ancora attive sul database: va lanciato 61-tessere.sql.'
      : `${contaTessere(righe)} ${contaTessere(righe) === 1 ? 'iscritto senza tessera valida' : 'iscritti senza tessera valida'} · ${senzaCorso.length} ${senzaCorso.length === 1 ? 'tesserato senza corso' : 'tesserati senza corso'}.`

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="TESSERE" sotto={sotto}>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => onVai('regole')}>
          IMPORTA DAL RASD
        </button>
      </Testa>
      {guaio && <Guaio testo={guaio} />}
      {pronte && !manca && (
        <>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="num sg-chip" aria-pressed={lista === 'senza'} onClick={() => setLista('senza')}>
              SENZA TESSERA {senza.length}
            </button>
            <button type="button" className="num sg-chip" aria-pressed={lista === 'mai'} onClick={() => setLista('mai')}>
              MAI AVUTE {ordinate('mai').length}
            </button>
            <button type="button" className="num sg-chip" aria-pressed={lista === 'scadute'} onClick={() => setLista('scadute')}>
              SCADUTE {ordinate('scadute').length}
            </button>
            <button type="button" className="num sg-chip" aria-pressed={lista === 'senza-corso'} onClick={() => setLista('senza-corso')}>
              TESSERATI SENZA CORSO {senzaCorso.length}
            </button>
          </div>
          {visibili.length === 0 ? (
            <p className="sg-sotto">{lista === 'senza-corso' ? 'Chi è tesserato ha un corso.' : lista === 'mai' ? 'Tutti hanno avuto almeno una tessera.' : lista === 'scadute' ? 'Nessuna tessera scaduta.' : 'Tutti gli iscritti hanno la tessera che il loro corso chiede.'}</p>
          ) : (
            <div className="stack" style={{ gap: 0 }}>
              {visibili.map((r) => {
                const t = r.esito === 'non_iscritto' ? null : parolaTessera(r.esito, r.tesseraAl)
                return (
                  <button
                    key={`${r.personaId}|${r.ente}`}
                    type="button"
                    className="sg-iscrizione"
                    style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
                    onClick={() => onVai('iscritti', { persona: r.personaId })}
                  >
                    <span className="stack grow" style={{ minWidth: 0, gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{nome.get(r.personaId)}</span>
                      <span style={{ fontSize: 13, color: 'var(--sec)' }}>
                        {r.corsi ? `${r.corsi} · ` : ''}
                        {r.ente}
                        {r.tesseraAl ? ` · ${r.esito === 'scaduta' ? 'scaduta il' : 'fino al'} ${r.tesseraAl.split('-').reverse().join('/')}` : r.esito === 'manca' ? ' · mai avuta' : ''}
                      </span>
                    </span>
                    {t ? <Segno tono={t.tono}>{t.parola}</Segno> : <Segno tono="spento">NESSUN CORSO</Segno>}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * IMPOSTAZIONI → TESSERE DAL RASD. Si carica il foglio (CSV), si guarda cosa
 * entra e cosa no (l'anteprima non scrive), poi si mette. Non crea nessuna
 * persona: le righe senza scheda restano fuori, col motivo, e si rifà il
 * foglio dopo averle sistemate.
 */
export function ImportaTessere({ d }: { d: DatiSegreteria }) {
  const [foglio, setFoglio] = useState<{ nome: string; testo: string } | null>(null)
  const [pronto, setPronto] = useState<{ righe: ReturnType<typeof righeDalFoglio>['righe']; saltate: ReturnType<typeof righeDalFoglio>['saltate']; esito: EsitoImportTessere } | null>(null)
  // Le righe saltate restano a vista anche dopo METTI: sono quelle da sistemare nel foglio.
  const [fatto, setFatto] = useState<{ esito: EsitoImportTessere; saltate: RigaSaltata[] } | null>(null)
  const [aspetta, setAspetta] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  const passo = fatto ? 3 : pronto ? 2 : 1

  const controlla = async () => {
    if (!foglio) return
    setGuaio(null)
    const l = righeDalFoglio(foglio.testo)
    if (l.errore) return setGuaio(l.errore)
    setAspetta(true)
    try {
      setPronto({ righe: l.righe, saltate: l.saltate, esito: await d.importaTessere(l.righe, true) })
    } catch (e) {
      setGuaio(messaggio(e))
    } finally {
      setAspetta(false)
    }
  }
  const metti = async () => {
    if (!pronto || aspetta) return
    setAspetta(true)
    setGuaio(null)
    try {
      setFatto({ esito: await d.importaTessere(pronto.righe, false), saltate: pronto.saltate })
      setPronto(null)
    } catch (e) {
      setGuaio(messaggio(e))
    } finally {
      setAspetta(false)
    }
  }
  const ricomincia = () => {
    setFoglio(null)
    setPronto(null)
    setFatto(null)
    setGuaio(null)
  }
  const mostra = fatto?.esito ?? pronto?.esito
  const saltate = fatto?.saltate ?? pronto?.saltate ?? []

  return (
    <section aria-label="Tessere dal RASD" className="sg-riquadro" style={{ gridColumn: '1 / -1' }}>
      <span className="ob sg-riquadro-titolo">TESSERE DAL RASD</span>
      <span className="sg-sotto">
        Il foglio dei tesseramenti del RASD, salvato come CSV, con le colonne Organismo, Persona, Codice fiscale, Tipo, Codice tess. e Valido dal. Si abbina a chi ha già la scheda, per codice fiscale e nome: non crea nessuno. Si può rifare quante volte si vuole, non duplica niente.
      </span>
      <ol className="sg-passi">
        {['IL FOGLIO', 'IL CONTROLLO', 'NELL’APP'].map((nome, i) => (
          <li key={nome} aria-current={passo === i + 1 ? 'step' : undefined} data-fatto={passo > i + 1}>
            <span className="num sg-passo-num">{passo > i + 1 ? '✓' : i + 1}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.16em' }}>
              {nome}
            </span>
          </li>
        ))}
      </ol>
      {guaio && (
        <div className="sg-riquadro" style={{ borderColor: 'var(--rosso)' }}>
          <span style={{ fontSize: 14 }}>{guaio}</span>
        </div>
      )}
      {aspetta && <p className="sg-sotto">Un attimo…</p>}

      {passo === 1 && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label htmlFor="rasd-file" className="sg-btn sg-btn-linea" style={{ cursor: 'pointer' }}>
            {foglio ? 'CAMBIA FOGLIO' : 'SCEGLI IL FOGLIO'}
          </label>
          <input
            id="rasd-file"
            className="vh"
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setFoglio({ nome: f.name, testo: await f.text() })
            }}
          />
          {foglio && <span style={{ fontSize: 14 }}>{foglio.nome}</span>}
          <button type="button" className="sg-btn sg-btn-pieno" disabled={!foglio || aspetta} onClick={() => void controlla()}>
            CONTROLLA
          </button>
        </div>
      )}

      {mostra && (
        <>
          <div className="sg-cosa-entra">
            {contiImport(mostra).map(([n, testo]) => (
              <div key={testo} className="stack" style={{ gap: 2 }}>
                <span className="num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
                  {n}
                </span>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{testo}</span>
              </div>
            ))}
          </div>
          {(mostra.non_abbinate.length > 0 || saltate.length > 0) && (
            <div className="stack" style={{ gap: 4, fontSize: 13 }}>
              <span className="num" style={{ fontWeight: 700, color: 'var(--giallo-testo)', letterSpacing: '0.12em' }}>
                RIGHE CHE RESTANO FUORI
              </span>
              {saltate.map((x) => (
                <span key={`s${x.riga}`}>
                  Riga {x.riga} del foglio: {x.motivo}
                </span>
              ))}
              {mostra.non_abbinate.map((x, i) => (
                <span key={`${x.codice_fiscale}-${i}`}>
                  {x.nome} · {x.codice_fiscale} · {x.ente}: {motivoNonAbbinata(x.esito)}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {passo === 2 && pronto && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="sg-btn sg-btn-linea" onClick={ricomincia}>
            INDIETRO
          </button>
          <button type="button" className="sg-btn sg-btn-pieno" disabled={aspetta || pronto.esito.nuove === 0} onClick={() => void metti()}>
            {pronto.esito.nuove === 1 ? 'METTI 1 TESSERA' : `METTI ${pronto.esito.nuove} TESSERE`}
          </button>
        </div>
      )}
      {passo === 3 && fatto && (
        <div className="stack" style={{ gap: 8 }}>
          <span style={{ fontSize: 15 }}>
            Fatto: {fatto.esito.nuove === 1 ? '1 tessera nuova' : `${fatto.esito.nuove} tessere nuove`}. Le trovi nella scheda di ogni persona, sotto TESSERE.
          </span>
          <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={ricomincia}>
            IMPORTA UN ALTRO FOGLIO
          </button>
        </div>
      )}
    </section>
  )
}

