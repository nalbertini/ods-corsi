import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import {
  cosaNonVaGiroconto,
  cosaNonVaImporto,
  cosaNonVaMovimento,
  cosaNonVaSaldoTesto,
  cosaNonVaVoce,
  csvMovimenti,
  elencoMovimenti,
  filtraMovimenti,
  oggiARoma,
  perVoce,
  primoMovimentoManuale,
  quanteUsate,
  residui,
  totali,
  totaleResidui,
  type Cassa,
  type RigaMovimento,
  type VoceContabile,
} from '../../lib/contabilita'
import { intervalloDi } from '../../lib/pagamenti'
import { centesimi, dataRicevuta, euro } from '../../lib/ricevute'
import { Campo, chiedi, Guaio, scaricaCsv, Testa, useAvviso, useBozza, useCarica } from './comune'
import { Numero } from './Presenze'

type Scheda = 'movimenti' | 'voci' | 'casse'
type Periodo = 'mese' | 'scorso' | 'anno' | 'tutto'
type Fai = ReturnType<typeof useAvviso>['fai']

/**
 * CONTABILITÀ, per chi cura i conti (`59-contabilita.sql`): i movimenti con i
 * residui delle casse, le voci, le casse con il saldo iniziale. Gli incassi
 * degli iscritti sono nell'elenco ma non si scrivono qui: si ricavano da
 * ricevute e pagamenti, e si correggono in PAGAMENTI.
 */
export function Contabilita({ d }: { d: DatiSegreteria }) {
  const [scheda, setScheda] = useState<Scheda>('movimenti')
  const casse = useCarica(() => d.casse(), [d])
  const voci = useCarica(() => d.voci(), [d])
  const manuali = useCarica(() => d.movimenti(), [d])
  // Gli incassi degli iscritti non cambiano quando si scrive qui: si leggono una volta. Se non si leggono,
  // restano i movimenti a mano e il guaio si dice sopra l'elenco (i residui, allora, non li contano).
  const incassi = useCarica(async () => {
    const [ricevute, diretti] = await Promise.all([d.ricevute(), d.pagamentiDiretti()])
    return { ricevute, diretti, nomi: diretti.length ? await d.nomiPersone(diretti.map((x) => x.personaId)) : [] }
  }, [d])
  const { avviso, fai } = useAvviso()

  const daiConti = [casse, voci, manuali]
  const guaio = daiConti.map((x) => x.guaio).find(Boolean)
  const pronto = daiConti.every((x) => x.dato !== null) && (incassi.dato !== null || !!incassi.guaio)
  const rileggi = () => {
    void casse.ricarica()
    void voci.ricarica()
    void manuali.ricarica()
  }

  const elenco: RigaMovimento[] = pronto
    ? elencoMovimenti(incassi.dato?.ricevute ?? [], incassi.dato?.diretti ?? [], incassi.dato?.nomi ?? [], casse.dato ?? [], manuali.dato ?? [], voci.dato ?? [])
    : []

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Testa titolo="CONTABILITÀ" sotto="Le entrate e le uscite della palestra, in due casse. Gli incassi degli iscritti ci sono già: si correggono in PAGAMENTI." />
      <div className="row" style={{ gap: 10 }} role="tablist" aria-label="Contabilità">
        {(
          [
            ['movimenti', 'MOVIMENTI'],
            ['voci', 'VOCI'],
            ['casse', 'CASSE'],
          ] as const
        ).map(([id, testo]) => (
          <button key={id} type="button" role="tab" aria-selected={scheda === id} className="num sg-chip" onClick={() => setScheda(id)}>
            {testo}
          </button>
        ))}
      </div>
      {guaio && <Guaio testo={guaio} />}
      {pronto && incassi.guaio && <Guaio testo={`Gli incassi degli iscritti non si leggono, e i residui non li contano. ${incassi.guaio}`} />}
      {!guaio && !pronto && <p className="sg-sotto">Sto leggendo i conti…</p>}
      {/* Le schede si nascondono, non si smontano: filtri e bozze restano dove sono. */}
      {pronto && (
        <>
          <div hidden={scheda !== 'movimenti'}><Movimenti d={d} casse={casse.dato ?? []} voci={voci.dato ?? []} righe={elenco} fai={fai} onCambiato={rileggi} /></div>
          <div hidden={scheda !== 'voci'}><Voci d={d} voci={voci.dato ?? []} righe={elenco} fai={fai} onCambiato={rileggi} /></div>
          <div hidden={scheda !== 'casse'}><Casse d={d} casse={casse.dato ?? []} righe={elenco} fai={fai} onCambiato={rileggi} /></div>
        </>
      )}
      {avviso}
    </div>
  )
}

const soldi = (c: number) => `${euro(c)} €`
const soldiConSegno = (c: number) => (c < 0 ? `− ${soldi(-c)}` : soldi(c))

/** Un riquadro che si apre in fondo alla pagina (il tasto è lì) non si vede: all'apertura si porta in vista. */
function InVista({ children }: { children: ReactNode }) {
  const qui = useRef<HTMLDivElement>(null)
  useEffect(() => {
    qui.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])
  return <div ref={qui} style={{ scrollMarginTop: 12 }}>{children}</div>
}

function Movimenti({ d, casse, voci, righe, fai, onCambiato }: { d: DatiSegreteria; casse: Cassa[]; voci: VoceContabile[]; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void }) {
  const oggi = oggiARoma()
  const [testo, setTesto] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('mese')
  const [tipo, setTipo] = useState('')
  const [cassaId, setCassaId] = useState('')
  const [annullati, setAnnullati] = useState(false)
  const [perVoci, setPerVoci] = useState(false)
  const [scrivo, setScrivo] = useState<'movimento' | 'giroconto' | null>(null)
  const [aperto, setAperto] = useState<RigaMovimento | null>(null)

  const { dal, al } = intervalloDi(periodo, oggi, '', '')
  const trovate = filtraMovimenti(righe, { testo, dal, al, tipo, cassaId, annullati })
  const somme = totali(trovate)
  const conti = residui(casse, righe)
  const mese = new Date(`${oggi}T12:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()
  const nomeCassa = (id?: string) => casse.find((c) => c.id === id)?.nome ?? ''
  const chiudi = () => {
    setScrivo(null)
    setAperto(null)
  }
  const fatto = () => {
    chiudi()
    onCambiato()
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="sg-numeri">
        {casse.map((c) => {
          const r = conti.find((x) => x.cassaId === c.id)
          return <Numero key={c.id} titolo={c.nome.toUpperCase()} valore={soldiConSegno(r?.residuo ?? 0)} sotto={`entrate ${soldi(r?.entrate ?? 0)} · uscite ${soldi(r?.uscite ?? 0)}`} />
        })}
        <Numero titolo="TOTALE" valore={soldiConSegno(totaleResidui(conti))} sotto="saldi iniziali compresi" />
      </div>

      {scrivo === 'movimento' && <InVista><NuovoMovimento d={d} voci={voci} casse={casse} fai={fai} onFatto={fatto} onChiudi={chiudi} /></InVista>}
      {scrivo === 'giroconto' && <InVista><NuovoGiroconto d={d} casse={casse} fai={fai} onFatto={fatto} onChiudi={chiudi} /></InVista>}
      {aperto && <InVista key={aperto.id}><MovimentoAperto d={d} riga={aperto} cassa={nomeCassa(aperto.cassaId)} cassaA={nomeCassa(aperto.cassaAId)} fai={fai} onChiudi={chiudi} onFatto={fatto} /></InVista>}

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" className="sg-btn sg-btn-linea" disabled={!trovate.length} onClick={() => scaricaCsv(`movimenti-${oggi}.csv`, csvMovimenti(trovate, casse))}>
          ESPORTA CSV
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={() => { setAperto(null); setScrivo('giroconto') }}>
          GIROCONTO
        </button>
        <button type="button" className="sg-btn sg-btn-pieno" onClick={() => { setAperto(null); setScrivo('movimento') }}>
          NUOVO MOVIMENTO
        </button>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label htmlFor="cerca-movimenti" className="vh">
          Cerca nella descrizione
        </label>
        <input id="cerca-movimenti" className="sg-campo" type="search" placeholder="Cerca nella descrizione" style={{ width: 320, maxWidth: '100%' }} value={testo} onChange={(e) => setTesto(e.target.value)} />
        {(
          [
            ['mese', mese],
            ['scorso', 'MESE SCORSO'],
            ['anno', 'TUTTO L’ANNO'],
            ['tutto', 'TUTTO'],
          ] as const
        ).map(([id, etichetta]) => (
          <button key={id} type="button" className="num sg-chip" aria-pressed={periodo === id} onClick={() => setPeriodo(id)}>
            {etichetta}
          </button>
        ))}
        {(
          [
            ['entrata', 'ENTRATE'],
            ['uscita', 'USCITE'],
            ['giroconto', 'GIROCONTI'],
          ] as const
        ).map(([id, etichetta]) => (
          <button key={id} type="button" className="num sg-chip" aria-pressed={tipo === id} onClick={() => setTipo(tipo === id ? '' : id)}>
            {etichetta}
          </button>
        ))}
        {casse.map((c) => (
          <button key={c.id} type="button" className="num sg-chip" aria-pressed={cassaId === c.id} onClick={() => setCassaId(cassaId === c.id ? '' : c.id)}>
            {c.nome.toUpperCase()}
          </button>
        ))}
        <button type="button" className="num sg-chip" aria-pressed={perVoci} onClick={() => setPerVoci(!perVoci)}>
          RAGGRUPPA PER VOCE
        </button>
        <button type="button" className="num sg-chip" aria-pressed={annullati} onClick={() => setAnnullati(!annullati)}>
          ANNULLATI
        </button>
      </div>

      {perVoci ? (
        <div role="table" aria-label="Totali per voce" className="sg-tabella">
          <div className="sg-tabella-corpo">
            {perVoce(trovate).length === 0 && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Nessun movimento nel periodo.</p>}
            {perVoce(trovate).map((g) => (
              <div key={`${g.tipo}|${g.voce}`} role="row" className="row" style={{ gap: 14, padding: '10px 14px', borderBottom: '1px solid var(--line-soft)', alignItems: 'center' }}>
                <span role="cell" style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{g.voce}</span>
                <span role="cell" className="sg-etichetta">{g.tipo === 'entrata' ? 'ENTRATA' : 'USCITA'}</span>
                <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, color: g.tipo === 'entrata' ? 'var(--verde-testo)' : undefined }}>{g.tipo === 'entrata' ? '+ ' : '− '}{soldi(g.totale)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div role="table" aria-label="Movimenti" className="sg-tabella">
          <div role="row" className="sg-lista-testa sg-riga-movimento">
            <span role="columnheader" className="sg-etichetta">DATA</span>
            <span role="columnheader" className="sg-etichetta">DESCRIZIONE</span>
            <span role="columnheader" className="sg-etichetta">VOCE</span>
            <span role="columnheader" className="sg-etichetta">CASSA</span>
            <span role="columnheader" className="sg-etichetta" style={{ textAlign: 'right' }}>IMPORTO</span>
          </div>
          <div className="sg-tabella-corpo">
            {trovate.length === 0 && (
              <p className="sg-sotto" style={{ padding: '12px 14px' }}>
                {righe.length === 0 ? 'Nessun movimento: compaiono qui gli incassi degli iscritti e quelli che scrivi tu.' : 'Nessun movimento corrisponde ai filtri.'}
              </p>
            )}
            {trovate.map((r) => (
              <div key={r.id} role="row" className="sg-riga-movimento sg-iscritto" data-spento={r.annullato} data-scelto={aperto?.id === r.id} onClick={() => { setScrivo(null); setAperto(r) }}>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{dataRicevuta(r.data)}</span>
                <span role="cell" style={{ fontSize: 15, fontWeight: 600, textDecoration: r.annullato ? 'line-through' : undefined }}>
                  <button type="button" className="sg-riga-apri">{r.descrizione}</button>
                  {r.origine !== 'movimento' && <span className="num sg-tag" style={{ marginLeft: 8 }}>INCASSO ISCRITTO</span>}
                  {r.tipo === 'giroconto' && <span className="num sg-tag" style={{ marginLeft: 8 }}>GIROCONTO</span>}
                  {r.annullato && <span className="num sg-tag" data-tipo="manca" style={{ marginLeft: 8 }}>ANNULLATO</span>}
                  <span className="sg-sotto-movimento">
                    <span className="sg-solo-telefono">{[dataRicevuta(r.data), r.voce, r.tipo === 'giroconto' ? `${nomeCassa(r.cassaId)} → ${nomeCassa(r.cassaAId)}` : nomeCassa(r.cassaId)].filter(Boolean).join(' · ')}</span>
                    {r.sotto && <span>{r.sotto}</span>}
                  </span>
                </span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{r.voce ?? '—'}</span>
                <span role="cell" style={{ fontSize: 13, color: 'var(--sec)' }}>{r.tipo === 'giroconto' ? `${nomeCassa(r.cassaId)} → ${nomeCassa(r.cassaAId)}` : nomeCassa(r.cassaId)}</span>
                <span role="cell" className="num" style={{ fontSize: 16, fontWeight: 700, textAlign: 'right', textDecoration: r.annullato ? 'line-through' : undefined, color: r.tipo === 'entrata' && !r.annullato ? 'var(--verde-testo)' : undefined }}>
                  {r.tipo === 'entrata' ? '+ ' : r.tipo === 'uscita' ? '− ' : ''}{soldi(r.importo)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ padding: '6px 14px 0', gap: 24, alignItems: 'baseline', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <span className="row" style={{ gap: 10, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          <span className="sg-etichetta">ENTRATE</span>
          <span className="num" style={{ fontSize: 24, fontWeight: 700, color: somme.entrate > 0 ? 'var(--verde-testo)' : undefined }}>+ {soldi(somme.entrate)}</span>
        </span>
        <span className="row" style={{ gap: 10, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          <span className="sg-etichetta">USCITE</span>
          <span className="num" style={{ fontSize: 24, fontWeight: 700 }}>− {soldi(somme.uscite)}</span>
        </span>
        <span className="row" style={{ gap: 10, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          <span className="sg-etichetta">DIFFERENZA</span>
          <span className="num" style={{ fontSize: 28, fontWeight: 700 }}>{soldiConSegno(somme.differenza)}</span>
        </span>
      </div>
      <span className="sg-sotto">
        I giroconti e gli annullati non contano in entrate e uscite. Un incasso degli iscritti si apre in PAGAMENTI, dove nasce; qui non si cambia. Contanti vanno in Cassa Contanti, tutto il resto in Conto Corrente.
      </span>
    </div>
  )
}

function NuovoMovimento({ d, voci, casse, fai, onFatto, onChiudi }: { d: DatiSegreteria; voci: VoceContabile[]; casse: Cassa[]; fai: Fai; onFatto: () => void; onChiudi: () => void }) {
  const oggi = oggiARoma()
  const [tipo, setTipo] = useState<'entrata' | 'uscita'>('uscita')
  const [data, setData] = useState(oggi)
  const [importo, setImporto] = useState('')
  const [cassaId, setCassaId] = useState(casse[0]?.id ?? '')
  const [voceId, setVoceId] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [nota, setNota] = useState('')
  useBozza(importo !== '' || descrizione !== '' || nota !== '', 'Il movimento')
  const dellaScelta = voci.filter((v) => v.tipo === tipo && v.attiva).sort((x, y) => x.nome.localeCompare(y.nome, 'it'))
  const cent = centesimi(importo)
  const guaio = cosaNonVaImporto(importo, '40,00') ?? (cent === null ? null : cosaNonVaMovimento({ tipo, data, importo: cent, voceId, cassaId, descrizione, nota }, voci, casse, oggi))
  const manca = cent === null || !!guaio || !voceId || !descrizione.trim()
  return (
    <section aria-label="Nuovo movimento" className="sg-riquadro">
      <span className="sg-etichetta">ENTRATA O USCITA</span>
      <span className="sg-riquadro-titolo ob">NUOVO MOVIMENTO</span>
      <div className="row" style={{ gap: 10 }}>
        {(['uscita', 'entrata'] as const).map((t) => (
          <button key={t} type="button" className="num sg-chip" aria-pressed={tipo === t} onClick={() => { setTipo(t); setVoceId('') }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="sg-due sg-scheda-campi">
        <Campo id="mv-data" etichetta="DATA">
          <input id="mv-data" className="sg-campo" type="date" value={data} max={oggi} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo id="mv-importo" etichetta="IMPORTO" manca={importo === ''}>
          <input id="mv-importo" className="sg-campo" inputMode="decimal" placeholder="40,00" value={importo} onChange={(e) => setImporto(e.target.value)} aria-invalid={(importo !== '' && cent === null) || undefined} />
        </Campo>
        <Campo id="mv-cassa" etichetta="CASSA">
          <select id="mv-cassa" className="sg-campo" value={cassaId} onChange={(e) => setCassaId(e.target.value)}>
            {casse.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </Campo>
        <Campo id="mv-voce" etichetta="VOCE" manca={!voceId} nota={dellaScelta.length ? undefined : { testo: `Non c’è nessuna voce di ${tipo === 'entrata' ? 'entrata' : 'uscita'}: si crea in VOCI.`, guaio: false }}>
          <select id="mv-voce" className="sg-campo" value={voceId} onChange={(e) => setVoceId(e.target.value)}>
            <option value="">Scegli la voce</option>
            {dellaScelta.map((v) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
        </Campo>
        <Campo id="mv-descrizione" etichetta="DESCRIZIONE" largo manca={!descrizione.trim()}>
          <input id="mv-descrizione" className="sg-campo" maxLength={200} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        </Campo>
        <Campo id="mv-nota" etichetta="NOTA · FACOLTATIVA" largo>
          <textarea id="mv-nota" className="sg-campo" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </div>
      <span className="sg-sotto">Un solo importo, senza IVA. Registrato, non si cambia: si annulla e si rifà (la descrizione e la nota sì). Niente dati personali che non servono.</span>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="sg-btn sg-btn-pieno"
          disabled={manca}
          onClick={() => {
            if (cent === null) return
            void fai(() => d.registraMovimento({ tipo, data, importo: cent, voceId, cassaId, descrizione: descrizione.trim(), nota: nota.trim() || undefined }), 'Movimento registrato', onFatto)
          }}
        >
          REGISTRA IL MOVIMENTO
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          NO, TORNA INDIETRO
        </button>
      </div>
    </section>
  )
}

function NuovoGiroconto({ d, casse, fai, onFatto, onChiudi }: { d: DatiSegreteria; casse: Cassa[]; fai: Fai; onFatto: () => void; onChiudi: () => void }) {
  const oggi = oggiARoma()
  const [da, setDa] = useState(casse[0]?.id ?? '')
  const [a, setA] = useState(casse[1]?.id ?? '')
  const [data, setData] = useState(oggi)
  const [importo, setImporto] = useState('')
  const [nota, setNota] = useState('')
  useBozza(importo !== '' || nota !== '', 'Il giroconto')
  const cent = centesimi(importo)
  const guaio = cosaNonVaImporto(importo, '1000,00') ?? (cent === null ? null : cosaNonVaGiroconto({ daCassaId: da, aCassaId: a, data, importo: cent, nota }, casse, oggi))
  const manca = cent === null || !!guaio
  const scelta = (id: string, valore: string, set: (v: string) => void, etichetta: string) => (
    <Campo id={id} etichetta={etichetta}>
      <select id={id} className="sg-campo" value={valore} onChange={(e) => set(e.target.value)}>
        {casse.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
    </Campo>
  )
  return (
    <section aria-label="Giroconto" className="sg-riquadro">
      <span className="sg-etichetta">PER IL VERSAMENTO IN BANCA</span>
      <span className="sg-riquadro-titolo ob">GIROCONTO FRA LE CASSE</span>
      <div className="sg-due sg-scheda-campi">
        {scelta('gc-da', da, setDa, 'DA')}
        {scelta('gc-a', a, setA, 'A')}
        <Campo id="gc-data" etichetta="DATA">
          <input id="gc-data" className="sg-campo" type="date" value={data} max={oggi} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo id="gc-importo" etichetta="IMPORTO" manca={importo === ''}>
          <input id="gc-importo" className="sg-campo" inputMode="decimal" placeholder="1000,00" value={importo} onChange={(e) => setImporto(e.target.value)} aria-invalid={(importo !== '' && cent === null) || undefined} />
        </Campo>
        <Campo id="gc-nota" etichetta="NOTA · FACOLTATIVA" largo>
          <textarea id="gc-nota" className="sg-campo" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      </div>
      <span className="sg-sotto">Sposta soldi fra le due casse: non è un’entrata né un’uscita, e non entra nei totali per voce. Si annulla come un movimento.</span>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="sg-btn sg-btn-pieno"
          disabled={manca}
          onClick={() => {
            if (cent === null) return
            void fai(() => d.registraGiroconto({ daCassaId: da, aCassaId: a, data, importo: cent, nota: nota.trim() || undefined }), 'Giroconto registrato', onFatto)
          }}
        >
          REGISTRA IL GIROCONTO
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          NO, TORNA INDIETRO
        </button>
      </div>
    </section>
  )
}

/** Un movimento aperto dall'elenco: a mano si annulla e se ne correggono descrizione e nota; un incasso degli iscritti si guarda e basta. */
function MovimentoAperto({ d, riga, cassa, cassaA, fai, onChiudi, onFatto }: { d: DatiSegreteria; riga: RigaMovimento; cassa: string; cassaA: string; fai: Fai; onChiudi: () => void; onFatto: () => void }) {
  const manuale = riga.origine === 'movimento'
  const giro = riga.tipo === 'giroconto'
  const [descrizione, setDescrizione] = useState(riga.descrizione)
  const [nota, setNota] = useState(riga.nota ?? '')
  const [chiedendo, setChiedendo] = useState(false)
  useBozza(descrizione !== riga.descrizione || nota !== (riga.nota ?? ''), 'La correzione')
  const annulla = async () => {
    if (chiedendo) return
    setChiedendo(true)
    const domanda = `Annullare «${riga.descrizione}» da ${soldi(riga.importo)} del ${dataRicevuta(riga.data)}? Resta in elenco, annullato, e non si conta più.`
    const si = await chiedi(domanda, 'SÌ, ANNULLA IL MOVIMENTO', { no: 'NO, LASCIALO', pericolo: true })
    setChiedendo(false)
    if (!si) return
    void fai(() => d.annullaMovimento(riga.id), 'Movimento annullato', onFatto)
  }
  const dettaglio: Array<[string, string]> = [
    ['DATA', dataRicevuta(riga.data)],
    ['TIPO', riga.tipo === 'giroconto' ? 'GIROCONTO' : riga.tipo === 'entrata' ? 'ENTRATA' : 'USCITA'],
    ['VOCE', riga.voce ?? '—'],
    ['CASSA', riga.tipo === 'giroconto' ? `${cassa} → ${cassaA}` : cassa],
    ['IMPORTO', soldi(riga.importo)],
  ]
  return (
    <section aria-label="Il movimento" className="sg-riquadro">
      <span className="sg-etichetta">{manuale ? 'IL MOVIMENTO' : 'INCASSO DI UN ISCRITTO'}</span>
      <span className="sg-riquadro-titolo ob">{riga.descrizione}</span>
      <div className="stack" style={{ gap: 0 }}>
        {dettaglio.map(([k, v]) => (
          <div key={k} className="row" style={{ gap: 14, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', alignItems: 'baseline' }}>
            <span className="sg-etichetta" style={{ width: 130, flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
          </div>
        ))}
      </div>
      {!manuale && <span className="sg-sotto">Si cambia in PAGAMENTI, dove nasce: se la ricevuta o il pagamento cambia o si annulla, cambia da sé anche qui.</span>}
      {manuale && riga.annullato && <span className="sg-sotto"><span className="num sg-tag" data-tipo="manca">ANNULLATO</span> Resta in elenco e non si conta più.</span>}
      {manuale && !riga.annullato && (
        <>
          <div className="sg-due sg-scheda-campi">
            {!giro && (
              <Campo id="ma-descrizione" etichetta="DESCRIZIONE" largo>
                <input id="ma-descrizione" className="sg-campo" maxLength={200} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
              </Campo>
            )}
            <Campo id="ma-nota" etichetta="NOTA" largo>
              <textarea id="ma-nota" className="sg-campo" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
            </Campo>
          </div>
          <span className="sg-sotto">Importo, data, voce e cassa non si cambiano: si annulla e si rifà.{giro && ' La descrizione di un giroconto la scrive il sistema.'}</span>
        </>
      )}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {manuale && !riga.annullato && (
          <>
            <button type="button" className="sg-btn sg-btn-pieno" disabled={!descrizione.trim()} onClick={() => void fai(() => d.correggiTestoMovimento(riga.id, descrizione, nota.trim() || undefined), 'Testo corretto', onFatto)}>
              SALVA IL TESTO
            </button>
            <button type="button" className="sg-btn sg-btn-rosso" disabled={chiedendo} onClick={() => void annulla()}>
              ANNULLA IL MOVIMENTO
            </button>
          </>
        )}
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>
          CHIUDI
        </button>
      </div>
    </section>
  )
}

function Voci({ d, voci, righe, fai, onCambiato }: { d: DatiSegreteria; voci: VoceContabile[]; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void }) {
  const usate = (v: VoceContabile) => quanteUsate(righe, v)
  const colonna = (tipo: 'entrata' | 'uscita', titolo: string) => (
    <ColonnaVoci key={tipo} d={d} tipo={tipo} titolo={titolo} voci={voci} usate={usate} fai={fai} onCambiato={onCambiato} />
  )
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {colonna('entrata', 'VOCI DI ENTRATA')}
        {colonna('uscita', 'VOCI DI USCITA')}
      </div>
      <span className="sg-sotto">
        Ogni voce è solo di entrata o solo di uscita. Una voce usata non si cancella: si disattiva, resta sui movimenti vecchi e non si offre per i nuovi. Le due di sistema servono agli incassi degli iscritti e non si cambiano. Non c’è «Varie»: se la crei, non farci finire spese diverse.
      </span>
    </div>
  )
}

function ColonnaVoci({ d, tipo, titolo, voci, usate, fai, onCambiato }: { d: DatiSegreteria; tipo: 'entrata' | 'uscita'; titolo: string; voci: VoceContabile[]; usate: (v: VoceContabile) => number; fai: Fai; onCambiato: () => void }) {
  const [nome, setNome] = useState('')
  useBozza(nome !== '', `Una voce di ${tipo}`)
  const dellaColonna = voci.filter((v) => v.tipo === tipo).sort((x, y) => Number(y.attiva) - Number(x.attiva) || Number(y.diSistema) - Number(x.diSistema) || x.nome.localeCompare(y.nome, 'it'))
  const guaio = nome.trim() === '' ? null : cosaNonVaVoce(nome, tipo, voci)
  return (
    <section className="stack grow" style={{ gap: 8, minWidth: 280, flexBasis: 320 }} aria-label={titolo}>
      <span className="sg-etichetta">{titolo}</span>
      {dellaColonna.map((v) => (
        <div key={v.id} className="sg-voce-elenco" style={{ opacity: v.attiva ? 1 : 0.55 }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
            {v.nome}
            {v.diSistema && <span className="num sg-tag" style={{ marginLeft: 8 }}>SISTEMA</span>}
            {!v.attiva && <span className="num sg-tag" style={{ marginLeft: 8 }}>NON IN USO</span>}
          </span>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>{v.diSistema ? 'incassi degli iscritti' : usate(v) ? `${usate(v)} ${usate(v) === 1 ? 'movimento' : 'movimenti'}` : 'mai usata'}</span>
          {!v.diSistema && (
            <button type="button" className="sg-link" style={{ fontSize: 15, minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 6px' }} onClick={() => void fai(() => d.attivaVoce(v.id, !v.attiva), v.attiva ? 'Voce disattivata' : 'Voce riattivata', onCambiato)}>
              {v.attiva ? 'DISATTIVA' : 'RIATTIVA'}
            </button>
          )}
        </div>
      ))}
      <form
        className="row"
        style={{ gap: 10, paddingTop: 6 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (guaio || !nome.trim()) return
          void fai(() => d.salvaVoce({ nome, tipo }), 'Voce creata', () => {
            setNome('')
            onCambiato()
          })
        }}
      >
        <label htmlFor={`nuova-voce-${tipo}`} className="vh">Nome della nuova voce di {tipo}</label>
        <input id={`nuova-voce-${tipo}`} className="sg-campo grow" placeholder="Nome della voce" maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={!!guaio || undefined} />
        <button type="submit" className="sg-btn sg-btn-linea" disabled={!nome.trim() || !!guaio}>
          NUOVA VOCE
        </button>
      </form>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
    </section>
  )
}

function Casse({ d, casse, righe, fai, onCambiato }: { d: DatiSegreteria; casse: Cassa[]; righe: RigaMovimento[]; fai: Fai; onCambiato: () => void }) {
  const conti = residui(casse, righe)
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {casse.map((c) => (
          <SaldoCassa key={c.id} d={d} cassa={c} righe={righe} conto={conti.find((x) => x.cassaId === c.id)} fai={fai} onCambiato={onCambiato} />
        ))}
      </div>
      <span className="sg-sotto">Il saldo iniziale cambia solo da qui e solo dall’amministrazione. La chiusura della cassa, col contato e la differenza, e la stampa PDF arrivano nella parte dopo.</span>
    </div>
  )
}

function SaldoCassa({ d, cassa, conto, righe, fai, onCambiato }: { d: DatiSegreteria; cassa: Cassa; righe: RigaMovimento[]; conto?: { entrate: number; uscite: number; residuo: number }; fai: Fai; onCambiato: () => void }) {
  const [saldo, setSaldo] = useState(euro(cassa.saldoIniziale))
  const [dal, setDal] = useState(cassa.dal ?? '')
  useBozza(saldo !== euro(cassa.saldoIniziale) || dal !== (cassa.dal ?? ''), `Il saldo di ${cassa.nome}`)
  const cent = centesimi(saldo)
  const guaio = cosaNonVaSaldoTesto(saldo, dal || null, { oggi: oggiARoma(), primoMovimento: primoMovimentoManuale(righe, cassa.id) })
  return (
    <section aria-label={cassa.nome} className="sg-riquadro" style={{ flex: '1 1 340px', maxWidth: 520 }}>
      <span className="sg-etichetta">CASSA</span>
      <span className="sg-riquadro-titolo ob">{cassa.nome.toUpperCase()}</span>
      <div className="row" style={{ gap: 24, alignItems: 'baseline' }}>
        <span className="sg-etichetta">RESIDUO</span>
        <span className="num" style={{ fontSize: 40, fontWeight: 700 }}>{soldiConSegno(conto?.residuo ?? 0)}</span>
      </div>
      <span className="sg-sotto">entrate {soldi(conto?.entrate ?? 0)} · uscite {soldi(conto?.uscite ?? 0)}</span>
      <div className="sg-due sg-scheda-campi">
        <Campo id={`saldo-${cassa.id}`} etichetta="SALDO INIZIALE">
          <input id={`saldo-${cassa.id}`} className="sg-campo" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} aria-invalid={!!guaio || undefined} />
        </Campo>
        <Campo id={`dal-${cassa.id}`} etichetta="DAL">
          <input id={`dal-${cassa.id}`} className="sg-campo" type="date" value={dal} onChange={(e) => setDal(e.target.value)} />
        </Campo>
      </div>
      <span className="sg-sotto">Da questa data si contano i movimenti: uno più vecchio non si registra. Residuo = saldo iniziale + entrate − uscite.</span>
      {guaio && <span role="alert" style={{ fontSize: 14, color: 'var(--rosso-testo)' }}>{guaio}</span>}
      <div>
        <button type="button" className="sg-btn sg-btn-linea" disabled={!!guaio || cent === null} onClick={() => cent !== null && void fai(() => d.salvaSaldoCassa(cassa.id, cent, dal || undefined), 'Saldo iniziale salvato', onCambiato)}>
          SALVA IL SALDO INIZIALE
        </button>
      </div>
    </section>
  )
}
