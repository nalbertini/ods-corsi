import type { DatiSegreteria } from '../../lib/segreteria'
import { dataRicevuta } from '../../lib/ricevute'
import { useCarica, type useAvviso } from './comune'

type Fai = ReturnType<typeof useAvviso>['fai']

/** La prima volta dello scarico Satispay (97), da IMPORTAZIONI: l'anteprima, poi il sì. Dal 132 non scrive movimenti. */
export function PrimoScarico({ d, fai, onFatto, onChiudi }: { d: DatiSegreteria; fai: Fai; onFatto: () => void; onChiudi: () => void }) {
  // L'anteprima legge tutto Satispay: si chiede solo aprendo questa pagina, e non scrive niente.
  const anteprima = useCarica(() => d.scaricaSatispay(true), [d])
  const c = anteprima.dato
  if (anteprima.guaio) return <p role="alert" style={{ color: 'var(--rosso-testo)' }}>{anteprima.guaio}</p>
  if (!c) return <p className="sg-sotto">Sto leggendo i pagamenti da Satispay…</p>
  const tutti = c.incassi + c.rimborsi + c.modulo + c.pagamenti + c.prima
  const righe: Array<[number, string, string]> = [
    [c.incassi, 'pagamenti sono nei versamenti della banca', ': non entrano in contabilità. Arrivano in Conto Corrente col versamento «Da Satispay Europe S.A.».'],
    [c.rimborsi, 'rimborsi escono dai versamenti della banca', ': non entrano in contabilità nemmeno loro.'],
    [c.modulo, 'sono pagamenti del modulo di iscrizione', ': sono già fra gli incassi degli iscritti o in una ricevuta. Non si contano due volte.'],
    [c.pagamenti, 'sono già fra gli incassi degli iscritti', ': pagati in palestra con Satispay e registrati lì, stesso giorno e stesso importo. Non si contano due volte.'],
    [c.prima, 'sono di prima dell’inizio dei conti', ': non entrano.'],
  ]
  return (
    <section aria-label="Primo scarico da Satispay" className="stack" style={{ gap: 14 }}>
      <span className="sg-etichetta">ANTEPRIMA · LA CONTABILITÀ NON CAMBIA</span>
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
      <span className="sg-sotto">Chi ha pagato lo trovi poi in IMPORTAZIONI → Chi ha pagato.</span>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="sg-btn sg-btn-pieno" onClick={() => void fai(() => d.scaricaSatispay(false), 'Scarico fatto: da stanotte va da solo', onFatto)}>
          Sì, comincia lo scarico
        </button>
        <button type="button" className="sg-btn sg-btn-linea" onClick={onChiudi}>Non ora</button>
      </div>
    </section>
  )
}
