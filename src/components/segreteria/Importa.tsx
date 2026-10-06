import { useMemo, useState } from 'react'
import type { DatiSegreteria, StatoBackup } from '../../lib/segreteria'
import {
  anteprima,
  controllaRighe,
  importa,
  indovinaColonne,
  indovinaCorso,
  indovinaOrdine,
  leggiFogli,
  leggiRisposte,
  leggiTabella,
  promemoriaBackup,
  RUOLI,
  chiaveRiga,
  righeBuone,
  scelteCorsi,
  fraseResoconto,
  righeDaSistemare,
  testoResoconto,
  type Colonne,
  type Fogli,
  type OrdineNome,
  type Resoconto,
  type Ruolo,
  type RigaControllo,
  type Scelte,
  type Situazione,
  type Tabella,
} from '../../lib/importa'
import type { Destinazione, Voce } from './Segreteria'
import { dataLunga, messaggio, Riga } from './comune'

type Foglio = { nome: string; testo: string; righe: number }

const FOGLI = [
  { chiave: 'corsi', nome: 'corsi.csv', titolo: 'corsi.csv', colonne: 'nome; sala; istruttore; giorno; ora; durata; capienza; colore' },
  { chiave: 'iscritti', nome: 'iscritti.csv', titolo: 'iscritti.csv', colonne: 'nome; cognome; email; telefono; corso' },
  {
    chiave: 'risposte',
    nome: 'risposte',
    titolo: 'risposte del modulo Google',
    colonne: 'Il foglio delle risposte com’è: le colonne si scelgono dopo averlo caricato.',
  },
] as const

type Corso = { id: string; nome: string }

/**
 * Corsi e iscritti da due fogli Excel, e gli iscritti dalle risposte del
 * modulo Google.
 *
 * Tre passi: si caricano i fogli, si guarda cosa entra e cosa no, si importa.
 * Il controllo viene prima di tutto: una riga che non si capisce si corregge
 * nel foglio e si rilancia, perché quello che c'è già non si duplica.
 */
export function Importa({ d, onVai }: { d: DatiSegreteria; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const [fogli, setFogli] = useState<Record<string, Foglio | undefined>>({})
  const [controllo, setControllo] = useState<{ f: Fogli; s: Situazione; backup?: StatoBackup } | null>(null)
  // Le scelte sui dubbi, per riga del foglio: di base non si tocca niente.
  const [scelte, setScelte] = useState<Scelte>({})
  const [copiato, setCopiato] = useState(false)
  const [fatto, setFatto] = useState<{ a: Resoconto; pronto: string | null } | null>(null)
  const [aspetta, setAspetta] = useState<string | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  // Le risposte del modulo: le colonne indovinate e le scelte dei corsi abbinate, da correggere a mano.
  const [risposte, setRisposte] = useState<{ t: Tabella; colonne: Colonne; abbinamenti: Record<string, string>; corsi: Corso[]; ordine: OrdineNome } | null>(null)

  const carica = async (chiave: string, file: File | undefined) => {
    if (!file) return
    const testo = await file.text()
    if (chiave === 'risposte') {
      setGuaio(null)
      try {
        const t = leggiTabella(testo)
        const corsi = (await d.corsi()).filter((c) => c.attivo).map((c) => ({ id: c.id, nome: c.nome }))
        const colonne = indovinaColonne(t.testa)
        setRisposte({ t, colonne, abbinamenti: abbina(t, colonne, corsi, {}), corsi, ordine: indovinaOrdine(t.testa, colonne) })
        setFogli((x) => ({ ...x, risposte: { nome: file.name, testo, righe: t.righe.filter((r) => r.some(Boolean)).length } }))
      } catch (e) {
        setGuaio(messaggio(e))
      }
      return
    }
    const righe = testo.replace(/\r\n?/g, '\n').split('\n').filter((r) => r.trim()).length - 1
    setFogli((x) => ({ ...x, [chiave]: { nome: file.name, testo, righe: Math.max(righe, 0) } }))
  }

  const cambiaColonna = (k: Ruolo, v: string) => {
    if (!risposte) return
    const colonne = { ...risposte.colonne }
    if (v === '') delete colonne[k]
    else colonne[k] = Number(v)
    // Nome e cognome insieme, o separati: non tutti e due.
    if (k === 'nomeCompleto' && v !== '') {
      delete colonne.nome
      delete colonne.cognome
    }
    if ((k === 'nome' || k === 'cognome') && v !== '') delete colonne.nomeCompleto
    // Cambiando la colonna del nome intero, l'ordine si ripropone da quello che dice la sua intestazione.
    const ordine = k === 'nomeCompleto' ? indovinaOrdine(risposte.t.testa, colonne) : risposte.ordine
    setRisposte({ ...risposte, colonne, abbinamenti: abbina(risposte.t, colonne, risposte.corsi, risposte.abbinamenti), ordine })
  }
  const nomeChiaro = !!risposte && (risposte.colonne.nomeCompleto !== undefined || (risposte.colonne.nome !== undefined && risposte.colonne.cognome !== undefined))

  const controlla = async () => {
    setAspetta('Controllo i fogli…')
    setGuaio(null)
    try {
      // Il backup si legge per il promemoria: se non risponde, l'import non si ferma.
      const [sale, personale, corsi, persone, backup] = await Promise.all([d.sale(), d.personale(), d.corsi(), d.persone(), d.backup().catch(() => undefined)])
      const f = leggiFogli(fogli.corsi?.testo ?? null, fogli.iscritti?.testo ?? null, corsi.map((c) => c.nome))
      if (risposte && fogli.risposte) {
        const r = leggiRisposte(risposte.t, risposte.colonne, risposte.abbinamenti, corsi.map((c) => ({ id: c.id, nome: c.nome })), risposte.ordine)
        f.iscritti.push(...r.iscritti)
        f.righe.risposte = r.righe
        f.saltate.push(...r.saltate)
        f.note = [...(f.note ?? []), ...r.note]
      }
      setScelte({})
      setControllo({ f, s: { sale, personale, corsi, persone }, backup })
    } catch (e) {
      setGuaio(messaggio(e))
    } finally {
      setAspetta(null)
    }
  }

  const vai = async () => {
    if (!controllo || aspetta) return
    // Subito, prima della prima attesa: un secondo clic creerebbe i corsi due volte.
    setAspetta('Comincio…')
    setGuaio(null)
    try {
      const a = await importa(d, controllo.f, setAspetta, scelte)
      setFatto({ a, pronto: await d.prontoFino() })
      setControllo(null)
      setCopiato(false)
    } catch (e) {
      setGuaio(`L'import si è fermato: ${messaggio(e)}. Quello che era già entrato resta; si può rilanciare, non duplica.`)
    } finally {
      setAspetta(null)
    }
  }

  const daCapo = () => {
    setFogli({})
    setRisposte(null)
    setControllo(null)
    setFatto(null)
    setGuaio(null)
    setScelte({})
  }

  const copia = async (testo: string) => {
    try {
      await navigator.clipboard.writeText(testo)
      setCopiato(true)
    } catch {
      setGuaio('Non riesco a copiare: seleziona il testo dell\'elenco e copialo a mano.')
    }
  }

  const passo = fatto ? 3 : controllo ? 2 : 1
  // Il controllo delle righe non dipende dalle scelte; i conti di COSA ENTRA sì, e si rifanno a ogni scelta.
  const righe = useMemo(() => (controllo ? controllaRighe(controllo.f, controllo.s) : null), [controllo])
  const a = useMemo(() => (controllo ? anteprima(controllo.f, controllo.s, scelte) : null), [controllo, scelte])
  const backup = promemoriaBackup(controllo?.backup)
  const buone = controllo && righe ? righeBuone(controllo.f, righe, scelte) : 0
  const scegli = (chiave: string, scelta: Scelte[string]) => setScelte((x) => ({ ...x, [chiave]: { ...x[chiave], ...scelta } }))

  return (
    // Occupa tutta la riga della griglia di IMPOSTAZIONI: i passi e i tre fogli vogliono la larghezza intera.
    <div className="stack" style={{ gap: 16, gridColumn: '1 / -1' }}>
      <span className="sg-sotto">
        Corsi e iscritti da due fogli, o gli iscritti dalle risposte del modulo Google. Si può rifare quante volte si vuole: non duplica niente. Chi c'è già si riconosce dal nome e cognome (anche scritti con il cognome prima, o con accenti e maiuscole diverse) e gli si aggiungono solo i corsi che mancano; le persone nuove entrano e si iscrivono ai corsi della colonna «Corsi».
      </span>

      <ol className="sg-passi">
        {['I FOGLI', 'IL CONTROLLO', 'NELL\'APP'].map((nome, i) => (
          <li key={nome} aria-current={passo === i + 1 ? 'step' : undefined} data-fatto={passo > i + 1}>
            <span className="num sg-passo-num">{i + 1}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.16em' }}>{nome}</span>
          </li>
        ))}
      </ol>

      {guaio && (
        <div className="sg-riquadro" style={{ borderColor: 'var(--rosso)' }}>
          <span style={{ fontSize: 14 }}>{guaio}</span>
        </div>
      )}
      {aspetta && <p className="sg-sotto">{aspetta}</p>}

      {passo === 1 && (
        <>
          <div className="sg-tre" style={{ gap: 16 }}>
            {FOGLI.map((f) => {
              const c = fogli[f.chiave]
              return (
                <div key={f.chiave} className="sg-riquadro" data-fatto={!!c}>
                  <span className="sg-mono" style={{ fontSize: 17, fontWeight: 700 }}>{f.titolo}</span>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>{f.colonne}</span>
                  {c && (
                    <span style={{ fontSize: 14, color: 'var(--verde-testo)' }}>
                      {c.nome}: {c.righe} {f.chiave === 'risposte' ? 'risposte lette.' : 'righe lette. Punto e virgola, BOM e accenti vanno bene così.'}
                    </span>
                  )}
                  <label className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
                    {c ? 'CAMBIA FOGLIO' : 'SCEGLI IL FOGLIO'}
                    <input type="file" accept=".csv,text/csv" className="vh" onChange={(e) => {
                        void carica(f.chiave, e.target.files?.[0])
                        // Così lo stesso file, corretto in Excel, si può rileggere.
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )
            })}
          </div>
          <span className="sg-sotto" style={{ lineHeight: 1.5 }}>
            Da Excel: <em>File → Salva con nome → CSV UTF-8</em>. Dal foglio Google delle risposte: <em>File → Scarica → Valori separati da virgola (.csv)</em>.
            Basta anche un foglio solo: gli iscritti si possono iscrivere ai corsi che ci sono già.
          </span>
          {risposte && (
            <Risposte
              r={risposte}
              onColonna={cambiaColonna}
              onOrdine={(ordine) => setRisposte({ ...risposte, ordine })}
              onAbbina={(scelta, id) => setRisposte({ ...risposte, abbinamenti: { ...risposte.abbinamenti, [scelta]: id } })}
            />
          )}
          <button
            type="button"
            className="sg-btn sg-btn-pieno"
            style={{ alignSelf: 'flex-start' }}
            disabled={(!fogli.corsi && !fogli.iscritti && !fogli.risposte) || (!!fogli.risposte && !nomeChiaro)}
            onClick={() => void controlla()}
          >
            AVANTI: CONTROLLA
          </button>
        </>
      )}

      {passo === 2 && controllo && a && righe && (
        <div className="sg-importa">
          <div className="stack" style={{ gap: 16, minWidth: 0 }}>
            <div className="sg-due">
              {FOGLI.filter((f) => fogli[f.chiave]).map((f) => {
                const saltate = controllo.f.saltate.filter((s) => s.foglio === f.nome).length
                return (
                  <div key={f.chiave} className="sg-riquadro">
                    <span className="sg-mono" style={{ fontSize: 15 }}>{f.titolo}</span>
                    <span className="num" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
                      {controllo.f.righe[f.chiave] ?? 0} <span style={{ fontSize: 15, color: 'var(--dim)' }}>righe</span>
                    </span>
                    <span style={{ fontSize: 13, color: saltate ? 'var(--giallo-testo)' : 'var(--verde-testo)' }}>
                      {saltate ? `${saltate} saltate, da correggere nel foglio` : 'tutte lette'}
                    </span>
                  </div>
                )
              })}
            </div>

            <section aria-label="Cosa entra" className="sg-riquadro">
              <Riga titolo="COSA ENTRA" />
              <div className="sg-cosa-entra">
                <Conto n={a.saleNuove.length} testo="sale nuove" />
                <Conto n={a.istruttoriNuovi.length} testo={`istruttori nuovi · ${a.istruttoriTrovati} già in palestra`} />
                <Conto n={a.corsiNuovi.length} testo="corsi nuovi" />
                <Conto n={a.ricorrenzeNuove} testo="giorni di lezione nuovi" />
                <Conto n={a.iscrittiNuovi} testo="iscritti nuovi" />
                <Conto n={a.iscrizioniNuove} testo="iscrizioni ai corsi" />
                {a.anagrafiche > 0 && <Conto n={a.anagrafiche} testo="con nascita, residenza o genitore" />}
              </div>
              <span className="sg-sotto">Quello che c'è già resta com'è: un corso esistente prende solo i giorni e gli istruttori che gli mancano. Poi il calendario si allunga.</span>
            </section>

            <section aria-label="Riga per riga" className="sg-riquadro">
              <Riga titolo="RIGA PER RIGA" />
              <span style={{ fontSize: 15 }}>
                <b>{righe.totali.nuova}</b> nuove · <b>{righe.totali.in_palestra}</b> già in palestra · <b>{righe.totali.da_sistemare}</b> da sistemare
              </span>
              {righe.righe.filter((r) => r.chiedeScelta).map((r) => (
                <RigaDaGuardare key={chiaveRiga(r)} r={r} scelta={scelte[chiaveRiga(r)]} onScegli={(x) => scegli(chiaveRiga(r), x)} />
              ))}
              <details className="sg-spiega">
                <summary>VEDI TUTTE LE RIGHE</summary>
                <div className="sg-saltate" style={{ marginTop: 8 }}>
                  {righe.righe.map((r) => (
                    <div key={chiaveRiga(r)} className="contents">
                      <span className="num" style={{ fontWeight: 700 }}>{r.foglio} · riga {r.riga}</span>
                      <span>
                        {r.nome} · {ETICHETTA[r.esito]}
                        {r.motivo ? `: ${r.motivo}` : ''}
                        {r.avvisi.map((x) => ` · ${x}`).join('')}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </section>

            {(controllo.f.saltate.length > 0 || a.avvisi.length > 0 || (controllo.f.note?.length ?? 0) > 0 || a.emailDiAltri.length > 0) && (
              <section aria-label="Righe saltate" className="sg-riquadro">
                <Riga titolo="DA SISTEMARE" />
                <div className="sg-saltate">
                  {controllo.f.saltate.map((s, i) => (
                    <div key={i} className="contents">
                      <span className="num" style={{ color: 'var(--giallo-testo)', fontWeight: 700 }}>
                        {s.foglio} · riga {s.riga}
                      </span>
                      <span>{s.motivo}</span>
                    </div>
                  ))}
                  {controllo.f.note?.map((s, i) => (
                    <div key={`n${i}`} className="contents">
                      <span className="num" style={{ color: 'var(--dim)', fontWeight: 700 }}>
                        {s.foglio} · riga {s.riga} · entra
                      </span>
                      <span>{s.motivo}</span>
                    </div>
                  ))}
                  {a.emailDiAltri.map((s, i) => (
                    <div key={`e${i}`} className="contents">
                      <span className="num" style={{ color: 'var(--dim)', fontWeight: 700 }}>iscritto · entra</span>
                      <span>{s}</span>
                    </div>
                  ))}
                  {a.avvisi.map((s, i) => (
                    <div key={`a${i}`} className="contents">
                      <span className="num" style={{ color: 'var(--dim)', fontWeight: 700 }}>istruttore</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <span className="sg-sotto" role="note" style={{ color: backup.avviso ? 'var(--giallo-testo)' : undefined }}>{backup.testo}</span>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="sg-btn sg-btn-linea" disabled={!!aspetta} onClick={daCapo}>
                CARICA DI NUOVO
              </button>
              <button type="button" className="sg-btn sg-btn-rosso" disabled={!!aspetta || buone <= 0} onClick={() => void vai()}>
                IMPORTA LE {buone} RIGHE BUONE
              </button>
            </div>
          </div>

          {a.corsiNuovi.length + a.saleNuove.length + a.istruttoriNuovi.length > 0 && (
            <section aria-label="I nomi nuovi" className="sg-riquadro">
              <Riga titolo="I NOMI NUOVI" />
              {a.saleNuove.length > 0 && <Elenco titolo="Sale" nomi={a.saleNuove} />}
              {a.istruttoriNuovi.length > 0 && <Elenco titolo="Istruttori" nomi={a.istruttoriNuovi} />}
              {a.corsiNuovi.length > 0 && <Elenco titolo="Corsi" nomi={a.corsiNuovi} />}
              <span className="sg-sotto">Un nome scritto in modo diverso («Lotta 2» e «Lotta2») vale come un corso nuovo: se è un errore, correggilo nel foglio.</span>
            </section>
          )}
        </div>
      )}

      {passo === 3 && fatto && (
        <div className="sg-riquadro" style={{ borderColor: fatto.a.daSistemare.length || fatto.a.emailDiAltri.length ? 'var(--giallo)' : 'var(--verde)', maxWidth: 640 }}>
          <span className="ob" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.04em' }}>{testoResoconto(fatto.a).split('\n')[0]}</span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--sec)' }}>
            {fatto.a.corsiNuovi.length} corsi nuovi, {fatto.a.ricorrenzeNuove} giorni di lezione, {fatto.a.iscrittiNuovi} iscritti nuovi e {fatto.a.iscrizioniNuove} iscrizioni.
            {fatto.pronto ? ` Il calendario è pronto fino al ${dataLunga(fatto.pronto)}.` : ''}
          </span>
          {fatto.a.emailDiAltri.length > 0 && <span style={{ fontSize: 15, lineHeight: 1.5 }}>{fraseResoconto(fatto.a)}</span>}
          {fatto.a.anagraficheFuori && (
            <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--giallo-testo)' }}>
              Nascita, residenza e genitore sono rimasti fuori: {fatto.a.anagraficheFuori}. Gli iscritti sono entrati lo stesso; lanciato il file, si reimporta e arrivano anche quelli.
            </span>
          )}
          {fatto.a.daSistemare.length > 0 && (
            <>
              <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--giallo-testo)' }}>
                {fatto.a.daSistemare.length} {fatto.a.daSistemare.length === 1 ? 'RIGA' : 'RIGHE'} DA SISTEMARE
              </span>
              <pre className="sg-mono" style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
                {righeDaSistemare(fatto.a).join('\n')}
              </pre>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--dim)' }}>
                Queste righe non sono entrate. Correggile nel foglio, o scegli cosa fare, e reimporta: quello che c'è già non si duplica.
              </span>
            </>
          )}
          {fatto.a.emailDiAltri.length > 0 && (
            <>
              <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--giallo-testo)' }}>
                {fatto.a.emailDiAltri.length} CON L'EMAIL DI CONTATTO
              </span>
              <pre className="sg-mono" style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
                {fatto.a.emailDiAltri.join('\n')}
              </pre>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--dim)' }}>
                Entrano senza email di accesso: l'email di accesso resta di chi ce l'aveva. Il contatto si vede nella scheda.
              </span>
            </>
          )}
          {(fatto.a.daSistemare.length > 0 || fatto.a.emailDiAltri.length > 0) && (
            <>
              <button type="button" className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start' }} onClick={() => void copia(testoResoconto(fatto.a))}>
                {copiato ? 'COPIATO' : 'COPIA L\'ELENCO'}
              </button>
              <span role="status" className="vh">{copiato ? 'Elenco copiato' : ''}</span>
            </>
          )}
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-pieno" onClick={() => onVai('settimana')}>
              VAI ALLA SETTIMANA
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={daCapo}>
              IMPORTA DI NUOVO
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const ETICHETTA = { nuova: 'nuova', in_palestra: 'già in palestra', da_sistemare: 'da sistemare' } as const

/** Una riga dubbia, col nome e la scelta: finché non si sceglie, di base non si tocca niente. */
function RigaDaGuardare({ r, scelta, onScegli }: { r: RigaControllo; scelta: Scelte[string] | undefined; onScegli: (x: Scelte[string]) => void }) {
  const id = `riga-${chiaveRiga(r)}`
  return (
    <div className="stack" style={{ gap: 4 }}>
      {(() => {
        const testo = (
          <>
            <span className="num" style={{ color: 'var(--giallo-testo)', fontWeight: 700 }}>{r.foglio} · riga {r.riga}</span> · {r.nome}
            <span style={{ color: 'var(--dim)' }}> — {r.motivo ?? r.avvisi.join(' · ')}</span>
          </>
        )
        // Senza una scelta da fare non c'è un campo a cui legare l'etichetta.
        return r.doppione || r.archiviato || r.terminate ? <label htmlFor={id} style={{ fontSize: 14 }}>{testo}</label> : <span style={{ fontSize: 14 }}>{testo}</span>
      })()}
      {r.doppione && (
        <select id={id} className="sg-campo" style={{ width: '100%' }} value={scelta?.doppione ?? ''} onChange={(e) => onScegli({ doppione: e.target.value === 'lega' ? 'lega' : e.target.value === 'nuova' ? 'nuova' : undefined })}>
          <option value="">Per ora lasciala fuori</option>
          <option value="lega">È lei: aggiungi i corsi a {r.doppione.nome}</option>
          <option value="nuova">È un'altra persona: creala</option>
        </select>
      )}
      {r.archiviato && (
        <select id={id} className="sg-campo" style={{ width: '100%' }} value={scelta?.archiviato ?? ''} onChange={(e) => onScegli({ archiviato: e.target.value === 'riattiva' ? 'riattiva' : undefined })}>
          <option value="">Resta archiviata, non la iscrivo</option>
          <option value="riattiva">Riattivala e iscrivila</option>
        </select>
      )}
      {r.terminate && (
        <select id={r.archiviato || r.doppione ? `${id}-t` : id} className="sg-campo" style={{ width: '100%' }} aria-label={`Iscrizione terminata: ${r.terminate.join(', ')}`} value={scelta?.terminate ?? ''} onChange={(e) => onScegli({ terminate: e.target.value === 'riapri' ? 'riapri' : undefined })}>
          <option value="">Lascia terminata: {r.terminate.join(', ')}</option>
          <option value="riapri">Riapri: {r.terminate.join(', ')}</option>
        </select>
      )}
    </div>
  )
}

function Conto({ n, testo }: { n: number; testo: string }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className="num" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>{testo}</span>
    </div>
  )
}

function Elenco({ titolo, nomi }: { titolo: string; nomi: string[] }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <span className="sg-etichetta">{titolo.toUpperCase()}</span>
      <span style={{ fontSize: 14, color: 'var(--sec)', lineHeight: 1.5 }}>{nomi.join(' · ')}</span>
    </div>
  )
}

/** Le scelte ancora senza abbinamento si indovinano; quelle già decise restano. */
function abbina(t: Tabella, colonne: Colonne, corsi: Corso[], prima: Record<string, string>): Record<string, string> {
  const fuori: Record<string, string> = {}
  for (const { testo } of scelteCorsi(t, colonne.corsi)) {
    const id = testo in prima ? prima[testo] : indovinaCorso(testo, corsi)
    if (id !== undefined) fuori[testo] = id
  }
  return fuori
}

/**
 * Le colonne del modulo e le scelte dei corsi. Le domande di un modulo Google
 * sono scritte come le ha scritte chi l'ha fatto: l'app prova a riconoscerle,
 * e qui si correggono prima di andare avanti.
 */
function Risposte({
  r,
  onColonna,
  onOrdine,
  onAbbina,
}: {
  r: { t: Tabella; colonne: Colonne; abbinamenti: Record<string, string>; corsi: Corso[]; ordine: OrdineNome }
  onColonna: (k: Ruolo, v: string) => void
  onOrdine: (o: OrdineNome) => void
  onAbbina: (scelta: string, id: string) => void
}) {
  const scelte = scelteCorsi(r.t, r.colonne.corsi)
  const esempio = r.t.righe.find((x) => x.some(Boolean)) ?? []
  const daFare = scelte.filter((x) => !(x.testo in r.abbinamenti)).length
  return (
    <div className="sg-due" style={{ gap: 16, alignItems: 'flex-start' }}>
      <section aria-label="Le colonne del modulo" className="sg-riquadro">
        <Riga titolo="LE COLONNE DEL MODULO" />
        <span className="sg-sotto">Quale domanda del modulo dice cosa. Nascita, residenza e genitore restano per le ricevute; le altre colonne (le foto caricate, i consensi) non entrano.</span>
        <div className="sg-colonne">
          {RUOLI.map(([k, etichetta]) => (
            <div key={k} className="contents">
              <label htmlFor={`col-${k}`} className="sg-etichetta">
                {etichetta}
              </label>
              <span className="stack" style={{ gap: 3, minWidth: 0 }}>
                <select id={`col-${k}`} className="sg-campo" value={r.colonne[k] ?? ''} onChange={(e) => onColonna(k, e.target.value)}>
                  <option value="">—</option>
                  {r.t.testa.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Colonna ${i + 1}`}
                    </option>
                  ))}
                </select>
                {r.colonne[k] !== undefined && esempio[r.colonne[k]!] && (
                  <span style={{ fontSize: 12, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    es. {esempio[r.colonne[k]!]}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        {r.colonne.nomeCompleto !== undefined && (
          <div className="stack" style={{ gap: 6 }}>
            <label htmlFor="ordine-nome" className="sg-etichetta">
              NELLA COLONNA DEL NOME INTERO, PRIMA C'È
            </label>
            <select id="ordine-nome" className="sg-campo" value={r.ordine} onChange={(e) => onOrdine(e.target.value === 'cognomeNome' ? 'cognomeNome' : 'nomeCognome')}>
              <option value="nomeCognome">Il nome («Anna De Luca»)</option>
              <option value="cognomeNome">Il cognome («De Luca Anna»)</option>
            </select>
            <span className="sg-sotto">
              {r.colonne.codiceFiscale !== undefined
                ? "Il codice fiscale dice qual è il cognome, anche di due parole; a chi ha scritto solo il cognome, il nome si cerca nell'email. Dove il codice manca o non torna, vale quello che scegli qui: De, Di, Del, Dell', Van… restano col cognome."
                : "Senza la colonna del codice fiscale vale quello che scegli qui, e De, Di, Del, Dell', Van… restano col cognome. Un cognome che non segue queste regole va corretto dopo, nella scheda."}
            </span>
          </div>
        )}
      </section>

      {r.colonne.corsi !== undefined && (
        <section aria-label="Le scelte dei corsi" className="sg-riquadro">
          <Riga titolo="LE SCELTE DEI CORSI" />
          <span className="sg-sotto" style={{ color: daFare ? 'var(--giallo-testo)' : undefined }}>
            {daFare
              ? `${daFare} ${daFare === 1 ? 'scelta' : 'scelte'} da abbinare: chi l'ha scelta entra lo stesso, senza quel corso.`
              : 'Ogni scelta del modulo ha il suo corso.'}
          </span>
          <div className="sg-colonne">
            {scelte.map((x) => (
              <div key={x.testo} className="contents">
                <label htmlFor={`sc-${x.testo}`} style={{ fontSize: 14, color: 'var(--sec)' }}>
                  {x.testo} <span className="num" style={{ color: 'var(--dim)' }}>· {x.quante}</span>
                </label>
                <select
                  id={`sc-${x.testo}`}
                  className="sg-campo"
                  data-acceso={!(x.testo in r.abbinamenti)}
                  value={r.abbinamenti[x.testo] ?? '?'}
                  onChange={(e) => onAbbina(x.testo, e.target.value)}
                >
                  {!(x.testo in r.abbinamenti) && <option value="?">Da abbinare…</option>}
                  <option value="">Lascia stare</option>
                  {r.corsi.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
