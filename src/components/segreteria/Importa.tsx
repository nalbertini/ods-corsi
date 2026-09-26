import { useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import { anteprima, importa, leggiFogli, type Anteprima, type Fogli } from '../../lib/importa'
import type { Destinazione, Voce } from './Segreteria'
import { dataLunga, messaggio, Riga, Testa } from './comune'

type Foglio = { nome: string; testo: string; righe: number }

const FOGLI = [
  { chiave: 'corsi', nome: 'corsi.csv', colonne: 'nome; sala; istruttore; giorno; ora; durata; capienza; colore' },
  { chiave: 'iscritti', nome: 'iscritti.csv', colonne: 'nome; cognome; email; telefono; corso' },
] as const

/**
 * Corsi e iscritti da due fogli Excel.
 *
 * Tre passi: si caricano i fogli, si guarda cosa entra e cosa no, si importa.
 * Il controllo viene prima di tutto: una riga che non si capisce si corregge
 * nel foglio e si rilancia, perché quello che c'è già non si duplica.
 */
export function Importa({ d, onVai }: { d: DatiSegreteria; onVai: (v: Voce, dove?: Destinazione) => void }) {
  const [fogli, setFogli] = useState<Record<string, Foglio | undefined>>({})
  const [controllo, setControllo] = useState<{ f: Fogli; a: Anteprima } | null>(null)
  const [fatto, setFatto] = useState<{ a: Anteprima; pronto: string | null } | null>(null)
  const [aspetta, setAspetta] = useState<string | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)

  const carica = async (chiave: string, file: File | undefined) => {
    if (!file) return
    const testo = await file.text()
    const righe = testo.replace(/\r\n?/g, '\n').split('\n').filter((r) => r.trim()).length - 1
    setFogli((x) => ({ ...x, [chiave]: { nome: file.name, testo, righe: Math.max(righe, 0) } }))
  }

  const controlla = async () => {
    setAspetta('Controllo i fogli…')
    setGuaio(null)
    try {
      const [sale, personale, corsi, persone] = await Promise.all([d.sale(), d.personale(), d.corsi(), d.persone()])
      const f = leggiFogli(fogli.corsi?.testo ?? null, fogli.iscritti?.testo ?? null, corsi.map((c) => c.nome))
      setControllo({ f, a: anteprima(f, { sale, personale, corsi, persone }) })
    } catch (e) {
      setGuaio(messaggio(e))
    } finally {
      setAspetta(null)
    }
  }

  const vai = async () => {
    if (!controllo) return
    setGuaio(null)
    try {
      const a = await importa(d, controllo.f, setAspetta)
      setFatto({ a, pronto: await d.prontoFino() })
      setControllo(null)
    } catch (e) {
      setGuaio(`L'import si è fermato: ${messaggio(e)}. Quello che era già entrato resta; si può rilanciare, non duplica.`)
    } finally {
      setAspetta(null)
    }
  }

  const daCapo = () => {
    setFogli({})
    setControllo(null)
    setFatto(null)
    setGuaio(null)
  }

  const passo = fatto ? 3 : controllo ? 2 : 1
  const buone = controllo ? controllo.f.righe.corsi + controllo.f.righe.iscritti - controllo.f.saltate.length : 0

  return (
    <>
      <Testa titolo="IMPORTA DA EXCEL" sotto="Corsi e iscritti da due fogli. Si può rifare quante volte si vuole: non duplica niente." />

      <ol className="sg-passi">
        {['I FOGLI', 'IL CONTROLLO', 'NEL DATABASE'].map((nome, i) => (
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
          <div className="sg-due" style={{ gap: 16 }}>
            {FOGLI.map((f) => {
              const c = fogli[f.chiave]
              return (
                <div key={f.chiave} className="sg-riquadro" data-fatto={!!c}>
                  <span className="sg-mono" style={{ fontSize: 17, fontWeight: 700 }}>{f.nome}</span>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>{f.colonne}</span>
                  {c && (
                    <span style={{ fontSize: 14, color: 'var(--verde)' }}>
                      {c.nome}: {c.righe} righe lette. Punto e virgola, BOM e accenti vanno bene così.
                    </span>
                  )}
                  <label className="sg-btn sg-btn-linea" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
                    {c ? 'CAMBIA FOGLIO' : 'SCEGLI IL FOGLIO'}
                    <input type="file" accept=".csv,text/csv" className="vh" onChange={(e) => void carica(f.chiave, e.target.files?.[0])} />
                  </label>
                </div>
              )
            })}
          </div>
          <span className="sg-sotto" style={{ lineHeight: 1.5 }}>
            Da Excel: <em>File → Salva con nome → CSV UTF-8</em>. Basta anche uno solo dei due: gli iscritti si possono iscrivere ai corsi che ci sono già.
          </span>
          <button type="button" className="sg-btn sg-btn-rosso" style={{ alignSelf: 'flex-start' }} disabled={!fogli.corsi && !fogli.iscritti} onClick={() => void controlla()}>
            AVANTI: CONTROLLA
          </button>
        </>
      )}

      {passo === 2 && controllo && (
        <div className="sg-importa">
          <div className="stack" style={{ gap: 16, minWidth: 0 }}>
            <div className="sg-due">
              {FOGLI.filter((f) => fogli[f.chiave]).map((f) => {
                const saltate = controllo.f.saltate.filter((s) => s.foglio === f.nome).length
                return (
                  <div key={f.chiave} className="sg-riquadro">
                    <span className="sg-mono" style={{ fontSize: 15 }}>{f.nome}</span>
                    <span className="num" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
                      {controllo.f.righe[f.chiave]} <span style={{ fontSize: 15, color: 'var(--dim)' }}>righe</span>
                    </span>
                    <span style={{ fontSize: 13, color: saltate ? 'var(--giallo)' : 'var(--verde)' }}>
                      {saltate ? `${saltate} saltate, da correggere nel foglio` : 'tutte lette'}
                    </span>
                  </div>
                )
              })}
            </div>

            <section aria-label="Cosa entra" className="sg-riquadro">
              <Riga titolo="COSA ENTRA" />
              <div className="sg-cosa-entra">
                <Conto n={controllo.a.saleNuove.length} testo="sale nuove" />
                <Conto n={controllo.a.istruttoriNuovi.length} testo={`istruttori nuovi · ${controllo.a.istruttoriTrovati} già in palestra`} />
                <Conto n={controllo.a.corsiNuovi.length} testo="corsi nuovi" />
                <Conto n={controllo.a.ricorrenzeNuove} testo="giorni di lezione nuovi" />
                <Conto n={controllo.a.iscrittiNuovi} testo="iscritti nuovi" />
                <Conto n={controllo.a.iscrizioniNuove} testo="iscrizioni ai corsi" />
              </div>
              <span className="sg-sotto">Quello che c'è già resta com'è: un corso esistente prende solo i giorni e gli istruttori che gli mancano. Poi il calendario si allunga.</span>
            </section>

            {(controllo.f.saltate.length > 0 || controllo.a.avvisi.length > 0) && (
              <section aria-label="Righe saltate" className="sg-riquadro">
                <Riga titolo="DA SISTEMARE" />
                <div className="sg-saltate">
                  {controllo.f.saltate.map((s, i) => (
                    <div key={i} className="contents">
                      <span className="num" style={{ color: 'var(--giallo)', fontWeight: 700 }}>
                        {s.foglio} · riga {s.riga}
                      </span>
                      <span>{s.motivo}</span>
                    </div>
                  ))}
                  {controllo.a.avvisi.map((s, i) => (
                    <div key={`a${i}`} className="contents">
                      <span className="num" style={{ color: 'var(--dim)', fontWeight: 700 }}>istruttore</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="sg-btn sg-btn-linea" disabled={!!aspetta} onClick={daCapo}>
                CARICA DI NUOVO
              </button>
              <button type="button" className="sg-btn sg-btn-rosso" disabled={!!aspetta || buone <= 0} onClick={() => void vai()}>
                IMPORTA LE {buone} RIGHE BUONE
              </button>
            </div>
          </div>

          {controllo.a.corsiNuovi.length + controllo.a.saleNuove.length + controllo.a.istruttoriNuovi.length > 0 && (
            <section aria-label="I nomi nuovi" className="sg-riquadro">
              <Riga titolo="I NOMI NUOVI" />
              {controllo.a.saleNuove.length > 0 && <Elenco titolo="Sale" nomi={controllo.a.saleNuove} />}
              {controllo.a.istruttoriNuovi.length > 0 && <Elenco titolo="Istruttori" nomi={controllo.a.istruttoriNuovi} />}
              {controllo.a.corsiNuovi.length > 0 && <Elenco titolo="Corsi" nomi={controllo.a.corsiNuovi} />}
              <span className="sg-sotto">Un nome scritto in modo diverso («Lotta 2» e «Lotta2») vale come un corso nuovo: se è un errore, correggilo nel foglio.</span>
            </section>
          )}
        </div>
      )}

      {passo === 3 && fatto && (
        <div className="sg-riquadro" style={{ borderColor: 'var(--verde)', maxWidth: 640 }}>
          <span className="ob" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.04em' }}>FATTO</span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--sec)' }}>
            {fatto.a.corsiNuovi.length} corsi nuovi, {fatto.a.ricorrenzeNuove} giorni di lezione, {fatto.a.iscrittiNuovi} iscritti nuovi e {fatto.a.iscrizioniNuove} iscrizioni.
            {fatto.pronto ? ` Il calendario è pronto fino al ${dataLunga(fatto.pronto)}.` : ''}
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--dim)' }}>
            Le righe saltate non sono entrate. Correggile nel foglio e reimporta: quello che c'è già non si duplica.
          </span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="sg-btn sg-btn-rosso" onClick={() => onVai('settimana')}>
              VAI ALLA SETTIMANA
            </button>
            <button type="button" className="sg-btn sg-btn-linea" onClick={daCapo}>
              IMPORTA DI NUOVO
            </button>
          </div>
        </div>
      )}
    </>
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
