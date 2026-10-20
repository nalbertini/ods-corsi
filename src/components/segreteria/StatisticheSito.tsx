import { useCallback, useEffect, useRef, useState } from 'react'
import type { DatiSegreteria } from '../../lib/segreteria'
import type { AltreSito, NumeriSito } from '../../lib/sitoNumeri'
import type { TipoGuaioSito } from '../../lib/sitoStatistiche'
import { AGGIORNA_MS, TESTI_GUAI, chiaveSito, contaDal, creaMemoria, lettiAlle, nomeMeseSito, notaMese, puoAggiornare } from '../../lib/sitoStatistiche'
import { Riga } from './comune'
import { Colonne } from './Statistiche'

/** Fuori dal componente: STATISTICHE si chiude e si riapre, i numeri restano i loro 10 minuti. */
const memoria = creaMemoria()
/** L'ultima lettura vera di ogni periodo, anche andata male: AGGIORNA aspetta il suo minuto. */
const ultime = new Map<string, number>()

const it = (n: number) => n.toLocaleString('it-IT')

type Stato = { numeri: NumeriSito; letti: number } | { guaio: TipoGuaioSito } | null

/**
 * IL SITO, in fondo a STATISTICHE: quanta gente guarda il sito e quante volte tocca Iscriviti, Chiama o Scrivici,
 * da GoatCounter (funzione `statistiche-sito`). Le regole stanno in sitoStatistiche.ts e sitoNumeri.ts; qui si
 * mostra. Un guaio sta dentro il riquadro: gli altri riquadri restano. Il corso scelto non conta.
 */
export function StatisticheSito({ d, da, a, oggi, corso }: { d: DatiSegreteria; da: string; a: string; oggi: string; corso: boolean }) {
  const chiave = chiaveSito(da, a)
  const [stato, setStato] = useState<Stato>(null)
  const [legge, setLegge] = useState(false)
  const [, setGiro] = useState(0)
  const mio = useRef(0)

  const leggi = useCallback(async () => {
    const n = ++mio.current
    setLegge(true)
    const r = await d.statisticheSito(da, a)
    const adesso = Date.now()
    ultime.set(chiave, adesso)
    if (n !== mio.current) return
    if ('numeri' in r) {
      memoria.salva(chiave, r.numeri, adesso)
      setStato({ numeri: r.numeri, letti: adesso })
    } else setStato({ guaio: r.guaio })
    setLegge(false)
  }, [d, da, a, chiave])

  useEffect(() => {
    const giaLetti = memoria.leggi(chiave, Date.now())
    if (giaLetti) {
      mio.current++
      setLegge(false)
      setStato(giaLetti)
    } else {
      setStato(null)
      void leggi()
    }
  }, [chiave, leggi])

  // AGGIORNA si riaccende da sé quando passa il minuto.
  const ultima = ultime.get(chiave) ?? null
  const acceso = !legge && puoAggiornare(ultima, Date.now())
  useEffect(() => {
    if (acceso || ultima === null) return
    const t = setTimeout(() => setGiro((g) => g + 1), Math.max(0, ultima + AGGIORNA_MS - Date.now()) + 50)
    return () => clearTimeout(t)
  }, [acceso, ultima])

  const dal = contaDal(da)
  const numeri = stato && 'numeri' in stato ? stato.numeri : null
  const letti = stato && 'numeri' in stato ? lettiAlle(stato.letti) : stato ? 'Non letti' : ''

  return (
    <section aria-label="Il sito" className="sg-riquadro">
      <Riga titolo="IL SITO">
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>visite e tocchi su Iscriviti, Chiama e Scrivici · tutta la palestra</span>
      </Riga>
      <div className="sg-sito-testa">
        <span className="sg-sito-indicativi">
          Numeri indicativi, dal contatore del sito (GoatCounter): conta le visite, non le pagine viste. La stessa persona entro 8 ore è una visita sola.
        </span>
        <div className="sg-sito-aggiorna">
          <span role="status" className="num">
            {letti}
            {!legge && !acceso && stato ? ' · di nuovo fra un minuto' : ''}
          </span>
          <button type="button" className="sg-btn sg-btn-linea" disabled={!acceso} onClick={() => void leggi()}>
            Aggiorna
          </button>
        </div>
      </div>

      {numeri?.prova && (
        <div className="sg-sito-frase" data-prova="true">
          <b>… Prova</b> · numeri inventati, sempre gli stessi: il sito vero non si chiama.
        </div>
      )}
      {dal && !(stato && 'guaio' in stato) && (
        <div className="sg-sito-frase">
          Si conta dal <b>{dal}</b>, quando sul sito è stato acceso il contatore: i mesi prima non ci sono.
        </div>
      )}
      {corso && <div className="sg-sito-frase">Il sito è di tutta la palestra: il corso scelto qui non conta.</div>}

      {stato === null && <span className="sg-sotto">Sto leggendo i numeri del sito…</span>}
      {stato && 'guaio' in stato && (
        <div role="alert" className="sg-sito-guaio">
          <span className="sg-sito-guaio-segno">✕ NON LETTO</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{TESTI_GUAI[stato.guaio].titolo}</span>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--dim)' }}>{TESTI_GUAI[stato.guaio].frase}</span>
        </div>
      )}
      {numeri && <Numeri numeri={numeri} da={da} a={a} oggi={oggi} />}
    </section>
  )
}

function Numeri({ numeri, da, a, oggi }: { numeri: NumeriSito; da: string; a: string; oggi: string }) {
  const totali: Array<[number, string]> = [
    [numeri.visite, 'visite nel periodo'],
    [numeri.iscriviti, 'su Iscriviti'],
    [numeri.chiama, 'su Chiama'],
    [numeri.scrivici, 'su Scrivici'],
  ]
  return (
    <>
      {/* Il totale del periodo, come INCASSI: la cifra grande e il resto in parole. */}
      <div className="sg-sito-totali">
        {totali.map(([n, cosa]) => (
          <span key={cosa}>
            <span className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{it(n)}</span> {cosa}
          </span>
        ))}
      </div>

      <div className="sg-sito-due">
        <div className="stack" style={{ gap: 8, minWidth: 0 }}>
          <span className="sg-etichetta">VISITE MESE PER MESE</span>
          <Colonne
            nome="Visite al sito"
            colonne={numeri.mesi.map((m) => ({
              chiave: m.mese,
              etichetta: nomeMeseSito(m.mese).corto,
              valore: m.visite,
              dettaglio: [nomeMeseSito(m.mese).lungo.toLowerCase(), `${it(m.visite)} visite`, `${it(m.iscriviti)} Iscriviti · ${it(m.chiama)} Chiama · ${it(m.scrivici)} Scrivici`],
            }))}
          />
        </div>
        <div className="stack sg-orari-scorre" style={{ gap: 8, minWidth: 0 }}>
          <span className="sg-etichetta">HANNO TOCCATO</span>
          <table className="sg-stat-tabella sg-sito-tabella">
            <thead>
              <tr>
                <th>MESE</th>
                <th className="num-col">VISITE</th>
                <th className="num-col">ISCRIVITI</th>
                <th className="num-col">CHIAMA</th>
                <th className="num-col">SCRIVICI</th>
              </tr>
            </thead>
            <tbody>
              {numeri.mesi.map((m) => {
                const nome = nomeMeseSito(m.mese)
                const nota = notaMese(m.mese, da, a, oggi)
                return (
                  <tr key={m.mese}>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      <span className="sg-sito-mese-lungo">{nome.lungo}</span>
                      <span className="sg-sito-mese-corto">
                        {nome.corto.toUpperCase()} {m.mese.slice(0, 4)}
                      </span>
                      {nota && <span className="sg-sito-nota"> {nota}</span>}
                    </th>
                    <td className="num num-col">{it(m.visite)}</td>
                    <td className="num num-col">{it(m.iscriviti)}</td>
                    <td className="num num-col">{it(m.chiama)}</td>
                    <td className="num num-col">{it(m.scrivici)}</td>
                  </tr>
                )
              })}
              <tr className="sg-sito-totale">
                <th scope="row">TOTALE</th>
                <td className="num num-col">{it(numeri.visite)}</td>
                <td className="num num-col">{it(numeri.iscriviti)}</td>
                <td className="num num-col">{it(numeri.chiama)}</td>
                <td className="num num-col">{it(numeri.scrivici)}</td>
              </tr>
            </tbody>
          </table>
          <span className="sg-sotto" style={{ fontSize: 12 }}>
            Scrivici è il tasto di WhatsApp. Un tocco conta anche se poi la persona non chiama o non scrive.
          </span>
        </div>
      </div>

      <div className="sg-sito-due">
        <Barre
          titolo="LE PAGINE PIÙ LETTE"
          righe={numeri.pagine.map((p) => ({ nome: p.titolo, sotto: p.percorso, n: p.visite }))}
          altre={numeri.altrePagine}
          parola="pagine"
          sotto="Visite per pagina: in una visita si leggono anche più pagine, quindi la somma è più delle visite."
        />
        <Barre
          titolo="DA DOVE ARRIVANO"
          righe={numeri.provenienze.map((p) => ({ nome: p.nome, sotto: '', n: p.visite }))}
          altre={numeri.altreProvenienze}
          parola=""
          diretto={numeri.diretto}
        />
      </div>
    </>
  )
}

/** Barre di un valore solo, come `.sg-barra` di PRESENZE, col nome su due righe; «Diretto o non si sa» a parte, sotto un filo. */
function Barre({ titolo, righe, altre, parola, sotto, diretto }: { titolo: string; righe: Array<{ nome: string; sotto: string; n: number }>; altre: AltreSito; parola: string; sotto?: string; diretto?: number }) {
  const tutte = altre.quante ? [...righe, { nome: `Altre ${altre.quante}${parola ? ` ${parola}` : ''}`, sotto: '', n: altre.visite }] : righe
  const max = Math.max(1, diretto ?? 0, ...tutte.map((r) => r.n))
  // La chiave è la posizione: due pagine possono avere lo stesso titolo.
  const riga = (r: { nome: string; sotto: string; n: number }, i: number, filo = false) => (
    <div key={i} className="sg-sito-barra" data-filo={filo}>
      <span className="sg-sito-barra-nome">
        <span>{r.nome}</span>
        {r.sotto && <span className="sg-sito-barra-sotto">{r.sotto}</span>}
      </span>
      <span className="sg-barra-binario" aria-hidden="true">
        <span className="sg-barra-pieno" style={{ width: `${(100 * r.n) / max}%` }} />
      </span>
      <span className="num sg-sito-barra-n">{it(r.n)}</span>
    </div>
  )
  return (
    <div className="stack" style={{ gap: 10, minWidth: 0 }}>
      <span className="sg-etichetta">{titolo}</span>
      {!tutte.length && diretto === undefined && <span className="sg-sotto">Ancora niente in questo periodo.</span>}
      {tutte.map((r, i) => riga(r, i))}
      {diretto !== undefined && riga({ nome: 'Diretto o non si sa', sotto: 'indirizzo scritto a mano, link da WhatsApp, app che non lo dicono', n: diretto }, tutte.length, true)}
      {sotto && (
        <span className="sg-sotto" style={{ fontSize: 12 }}>
          {sotto}
        </span>
      )}
    </div>
  )
}
