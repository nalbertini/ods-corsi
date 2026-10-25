import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { DatiSegreteria } from '../../lib/segreteria'
import { dataRicevuta } from '../../lib/ricevute'
import { SchedaPiena, useCarica, type useAvviso } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']


/**
 * Lo scarico dei pagamenti Satispay del negozio in MOVIMENTI (97-satispay-scarico.sql): la striscia con
 * «Scarica ora» o «Guarda il primo scarico» fra le voci del menu delle azioni (`menu`), l'avviso dei casi da decidere
 * e, la prima volta, l'anteprima. Senza il 96 non si vede niente.
 */
export function ScaricoSatispay({ d, fai, onCambiato, menu, onImportazioni }: { d: DatiSegreteria; fai: Fai; onCambiato: () => void; menu: HTMLElement | null; onImportazioni?: () => void }) {
  const stato = useCarica(() => d.statoScaricoSatispay(), [d])
  const [pagina, setPagina] = useState<'primo' | null>(null)
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
      {/* I casi da decidere si guardano in IMPORTAZIONI: qui resta solo l'avviso, per chi lavora in MOVIMENTI. */}
      {s.daDecidere.length > 0 && (
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <p className="sg-sotto" style={{ color: 'var(--giallo-testo)', margin: 0 }}>
            <b>{s.daDecidere.length === 1 ? '1 PAGAMENTO SATISPAY DA DECIDERE' : `${s.daDecidere.length} PAGAMENTI SATISPAY DA DECIDERE`}</b>: non entrano finché non decidi, in IMPORTAZIONI.
          </p>
          {onImportazioni && <button type="button" className="sg-btn sg-btn-linea" onClick={onImportazioni}>Vai a Importazioni</button>}
        </div>
      )}
      {pagina === 'primo' && (
        <SchedaPiena etichetta="Primo scarico da Satispay" torna="I movimenti" onTorna={() => setPagina(null)}>
          <PrimoScarico d={d} fai={fai} onFatto={() => { setPagina(null); rileggi() }} onChiudi={() => setPagina(null)} />
        </SchedaPiena>
      )}
    </>
  )
}

export function PrimoScarico({ d, fai, onFatto, onChiudi }: { d: DatiSegreteria; fai: Fai; onFatto: () => void; onChiudi: () => void }) {
  // L'anteprima legge tutto Satispay: si chiede solo aprendo questa pagina, e non scrive niente.
  const anteprima = useCarica(() => d.scaricaSatispay(true), [d])
  const c = anteprima.dato
  if (anteprima.guaio) return <p role="alert" style={{ color: 'var(--rosso-testo)' }}>{anteprima.guaio}</p>
  if (!c) return <p className="sg-sotto">Sto leggendo i pagamenti da Satispay…</p>
  const tutti = c.incassi + c.rimborsi + c.modulo + c.pagamenti + c.a_mano + c.da_decidere + c.prima
  const scritti = c.incassi + c.rimborsi
  const righe: Array<[number, string, string]> = [
    [c.incassi, 'incassi del negozio entrano', ' in «Da classificare». La voce la scegli dopo, con Cambia voce.'],
    [c.rimborsi, 'rimborsi entrano come uscite', ', anche loro in «Da classificare».'],
    [c.modulo, 'sono pagamenti del modulo di iscrizione', ': sono già fra gli incassi degli iscritti o in una ricevuta. Non si scrivono una seconda volta.'],
    [c.pagamenti, 'sono già fra gli incassi degli iscritti', ': pagati in palestra con Satispay e registrati lì, stesso giorno e stesso importo. Non si scrivono una seconda volta.'],
    [c.a_mano, 'erano già scritti a mano', ': stesso giorno, stesso importo, un solo movimento possibile. Resta quello a mano, con la sua voce.'],
    [c.da_decidere, 'sono da decidere', ': un giorno già chiuso, o più movimenti a mano con lo stesso importo quel giorno. Non entrano: li trovi in IMPORTAZIONI.'],
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
      <span className="sg-sotto">Entrano tutti nella cassa Satispay, separati dal Conto Corrente. Uno scarico si annulla movimento per movimento, come ogni movimento.</span>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-pieno" onClick={() => void fai(() => d.scaricaSatispay(false), 'Scarico fatto: da stanotte va da solo', onFatto)}>
          {scritti === 1 ? 'Sì, scrivi il movimento' : scritti ? `Sì, scrivi i ${scritti} movimenti` : 'Sì, comincia lo scarico'}
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>Non ora</button>
      </div>
    </section>
  )
}
