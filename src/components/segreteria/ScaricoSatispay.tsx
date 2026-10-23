import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { DatiSegreteria } from '../../lib/segreteria'
import { CAMBIO_CASSA_SATISPAY, type DaDecidere } from '../../lib/satispayScarico'
import { oggiARoma } from '../../lib/contabilita'
import { dataRicevuta, euro } from '../../lib/ricevute'
import { SchedaPiena, useCarica, type useAvviso } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']

const soldi = (c: number) => `${euro(c)} €`
const giornoLungo = (data: string) => `${new Date(`${data}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long' })} ${dataRicevuta(data)}`

/**
 * Lo scarico dei pagamenti Satispay del negozio in MOVIMENTI (97-satispay-scarico.sql): la striscia con
 * «Scarica ora» o «Guarda il primo scarico» fra le voci del menu delle azioni (`menu`), l'avviso dei casi da decidere
 * e, la prima volta, l'anteprima. Senza il 96 non si vede niente.
 */
export function ScaricoSatispay({ d, fai, onCambiato, menu }: { d: DatiSegreteria; fai: Fai; onCambiato: () => void; menu: HTMLElement | null }) {
  const stato = useCarica(() => d.statoScaricoSatispay(), [d])
  const [pagina, setPagina] = useState<'primo' | 'decidere' | null>(null)
  const s = stato.dato
  // Senza il 96 lo stato non c'è e non si mostra niente; un altro guaio invece si dice.
  if (stato.guaio && !s) return <p role="alert" className="sg-sotto" style={{ color: 'var(--rosso-testo)' }}>{stato.guaio}</p>
  if (!s) return null
  const rileggi = () => {
    void stato.ricarica()
    onCambiato()
  }
  const scarica = () =>
    void fai(() => d.scaricaSatispay(false), 'Scarico Satispay fatto', rileggi)

  return (
    <>
      {menu && createPortal(
        s.primoFatto
          ? <button type="button" role="menuitem" onClick={scarica}>Scarica ora i pagamenti Satispay</button>
          : <button type="button" role="menuitem" onClick={() => setPagina('primo')}>Guarda il primo scarico Satispay</button>,
        menu,
      )}
      {/* La striscia di stato non c'è più: restano gli avvisi, che chiedono qualcosa. */}
      {s.errore && <p role="alert" className="sg-sotto" style={{ color: 'var(--rosso-testo)' }}>L’ultimo scarico Satispay non è riuscito: {s.errore}</p>}
      {s.daDecidere.length > 0 && (
        <section aria-label="Da decidere" className="sg-riquadro" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '12px 18px', padding: '14px 18px', borderColor: 'var(--giallo-testo)' }}>
          <div className="stack" style={{ gap: 2, flex: '999 1 420px', minWidth: 0 }}>
            <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>
              {s.daDecidere.length === 1 ? '1 PAGAMENTO SATISPAY DA DECIDERE' : `${s.daDecidere.length} PAGAMENTI SATISPAY DA DECIDERE`}
            </span>
            <span style={{ fontSize: 15 }}>{testoDaDecidere(s.daDecidere)} Non {s.daDecidere.length === 1 ? 'è entrato: resta' : 'sono entrati: restano'} qui finché non decidi.</span>
          </div>
          <button type="button" className="sg-btn sg-btn-pieno" onClick={() => setPagina('decidere')}>
            {s.daDecidere.length === 1 ? 'Guarda il caso' : `Guarda i ${s.daDecidere.length} casi`}
          </button>
        </section>
      )}
      {pagina === 'primo' && (
        <SchedaPiena etichetta="Primo scarico da Satispay" torna="I movimenti" onTorna={() => setPagina(null)}>
          <PrimoScarico d={d} fai={fai} onFatto={() => { setPagina(null); rileggi() }} onChiudi={() => setPagina(null)} />
        </SchedaPiena>
      )}
      {pagina === 'decidere' && s.daDecidere.length > 0 && (
        <SchedaPiena etichetta="Pagamenti Satispay da decidere" torna="I movimenti" onTorna={() => setPagina(null)}>
          <DaDecidereScheda d={d} casi={s.daDecidere} fai={fai} onFatto={rileggi} />
        </SchedaPiena>
      )}
    </>
  )
}

function testoDaDecidere(casi: DaDecidere[]) {
  const chiusi = casi.filter((c) => c.motivo === 'giorno_chiuso').length
  const doppi = casi.length - chiusi
  const pezzi = [
    chiusi && (chiusi === 1 ? 'Uno cade in un giorno già chiuso' : `${chiusi} cadono in giorni già chiusi`),
    doppi && (doppi === 1 ? 'uno potrebbe essere già scritto a mano' : `${doppi} potrebbero essere già scritti a mano`),
  ].filter((x): x is string => !!x)
  const frase = pezzi.join(', ')
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`
}

function PrimoScarico({ d, fai, onFatto, onChiudi }: { d: DatiSegreteria; fai: Fai; onFatto: () => void; onChiudi: () => void }) {
  // L'anteprima legge tutto Satispay: si chiede solo aprendo questa pagina, e non scrive niente.
  const anteprima = useCarica(() => d.scaricaSatispay(true), [d])
  const c = anteprima.dato
  if (anteprima.guaio) return <p role="alert" style={{ color: 'var(--rosso-testo)' }}>{anteprima.guaio}</p>
  if (!c) return <p className="sg-sotto">Sto leggendo i pagamenti da Satispay…</p>
  const tutti = c.incassi + c.rimborsi + c.modulo + c.pagamenti + c.a_mano + c.da_decidere + c.prima
  const scritti = c.incassi + c.rimborsi
  const righe: Array<[number, string, string]> = [
    [c.incassi, 'incassi del negozio entrano', ' in «Da classificare», col segno DA SATISPAY. La voce la scegli dopo, con Cambia voce.'],
    [c.rimborsi, 'rimborsi entrano come uscite', ', anche loro in «Da classificare».'],
    [c.modulo, 'sono pagamenti del modulo di iscrizione', ': sono già fra gli incassi degli iscritti o in una ricevuta. Non si scrivono una seconda volta.'],
    [c.pagamenti, 'sono già fra gli incassi degli iscritti', ': pagati in palestra con Satispay e registrati lì, stesso giorno e stesso importo. Non si scrivono una seconda volta.'],
    [c.a_mano, 'erano già scritti a mano', ': stesso giorno, stesso importo, un solo movimento possibile. Resta quello a mano, con la sua voce; prende il segno DA SATISPAY.'],
    [c.da_decidere, 'sono da decidere', ': un giorno già chiuso, o più movimenti a mano con lo stesso importo quel giorno. Non entrano: li trovi in MOVIMENTI, nell’avviso giallo.'],
    [c.prima, 'sono di prima dell’inizio dei conti', ': non entrano.'],
  ]
  return (
    <section aria-label="Primo scarico da Satispay" className="stack" style={{ gap: 14 }}>
      <span className="sg-etichetta">NIENTE SI SCRIVE FINCHÉ NON DICI SÌ</span>
      <h2 className="sg-riquadro-titolo" style={{ margin: 0 }}>PRIMO SCARICO DA SATISPAY</h2>
      <span style={{ fontSize: 15 }}>
        Satispay ha <b>{tutti === 1 ? '1 pagamento' : `${tutti} pagamenti`}</b> del negozio{c.dal ? `, dal ${dataRicevuta(c.dal)}` : ''}. Ecco cosa ne farebbe l’app.
      </span>
      <div className="stack" style={{ gap: 8 }}>
        {righe.filter(([n]) => n > 0).map(([n, cosa, resto]) => (
          <div key={cosa} className="row" style={{ gap: 14, alignItems: 'baseline' }}>
            <b className="num" style={{ fontSize: 22, minWidth: 48, textAlign: 'right' }}>{n}</b>
            <span><b>{cosa}</b>{resto}</span>
          </div>
        ))}
      </div>
      <span className="sg-sotto">Dal {dataRicevuta(CAMBIO_CASSA_SATISPAY)} entrano nella cassa Satispay; quelli di prima in Conto Corrente, come si faceva finora, così i saldi passati non cambiano. Uno scarico si annulla movimento per movimento, come ogni movimento.</span>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-pieno" onClick={() => void fai(() => d.scaricaSatispay(false), 'Scarico fatto: da stanotte va da solo', onFatto)}>
          {scritti === 1 ? 'Sì, scrivi il movimento' : scritti ? `Sì, scrivi i ${scritti} movimenti` : 'Sì, comincia lo scarico'}
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>Non ora</button>
      </div>
    </section>
  )
}

function DaDecidereScheda({ d, casi, fai, onFatto }: { d: DatiSegreteria; casi: DaDecidere[]; fai: Fai; onFatto: () => void }) {
  const oggi = oggiARoma()
  const decidi = (c: DaDecidere, scelta: Parameters<DatiSegreteria['decidiSatispay']>[1], fatto: string, movimento?: string) =>
    void fai(() => d.decidiSatispay(c.satispayId, scelta, movimento), fatto, onFatto)
  return (
    <div className="stack" style={{ gap: 18 }}>
      <span style={{ fontSize: 15 }}>{casi.length === 1 ? '1 pagamento Satispay da decidere.' : `${casi.length} pagamenti Satispay da decidere.`} Finché non scegli, non entrano.</span>
      {casi.map((c) => {
        const segno = c.tipo === 'TO_BUSINESS' ? '+' : '−'
        const titolo = `${c.tipo === 'TO_BUSINESS' ? 'Satispay' : 'Rimborso Satispay'}${c.chi ? ` · ${c.chi}` : ''}`
        return (
          <section key={c.satispayId} aria-label={c.motivo === 'giorno_chiuso' ? 'Giorno chiuso' : 'Forse già scritto a mano'} className="sg-riquadro">
            <span className="sg-etichetta" style={{ color: 'var(--giallo-testo)' }}>{c.motivo === 'giorno_chiuso' ? 'CADE IN UN GIORNO GIÀ CHIUSO' : 'FORSE GIÀ SCRITTO A MANO'}</span>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <b>{titolo}</b>
              <b className="num">{segno}{soldi(c.importo)}</b>
            </div>
            {c.motivo === 'giorno_chiuso' ? (
              <>
                <span style={{ fontSize: 14 }}>Pagato {giornoLungo(c.data)}. La cassa di quel giorno è chiusa: scriverlo lì cambierebbe una chiusura già fatta.</span>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="sg-btn sg-btn-pieno" onClick={() => decidi(c, 'oggi', 'Scritto con la data di oggi')}>Scrivilo oggi, {dataRicevuta(oggi).slice(0, 5)}</button>
                  <button type="button" className="sg-btn sg-btn-linea" onClick={() => decidi(c, 'fuori', 'Lasciato fuori')}>Lascialo fuori</button>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14 }}>
                  Pagato {giornoLungo(c.data)}. Quel giorno ci sono {c.candidati.length} movimenti a mano da {soldi(c.importo)}. È uno di questi?
                </span>
                <div className="stack" style={{ gap: 6 }}>
                  {c.candidati.map((m) => (
                    <div key={m.id} className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'space-between', fontSize: 14 }}>
                      <span><b>{m.descrizione}</b>{m.voce ? ` · ${m.voce}` : ''}</span>
                      <span>{m.cassa}</span>
                      <span className="num">+{soldi(m.importo)}</span>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  {c.candidati.map((m) => (
                    <button key={m.id} type="button" className="sg-btn sg-btn-linea" onClick={() => decidi(c, 'a_mano', 'Il movimento a mano prende il segno DA SATISPAY', m.id)}>
                      È «{m.descrizione}»
                    </button>
                  ))}
                  <button type="button" className="sg-btn sg-btn-pieno" onClick={() => decidi(c, 'scrivi', 'Pagamento scritto')}>
                    {c.candidati.length === 2 ? 'Nessuno dei due: scrivilo' : 'Nessuno: scrivilo'}
                  </button>
                </div>
                <span className="sg-sotto">Se è uno di questi, resta quello a mano con la sua voce, e prende il segno DA SATISPAY.</span>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}
