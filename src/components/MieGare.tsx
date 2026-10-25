import { useEffect, useState } from 'react'
import { oggiARoma } from '../lib/contabilita'
import { datiGare } from '../lib/gareDati'
import { avvisoCertificati, corsiInsegnati, corsoDi, dateGara, gareDaAccompagnare, linkMappa, righeGara, scrittaCertificato, type Gara, type RigaAtletaGara } from '../lib/gare'
import { datiSegreteria } from '../lib/segreteria'
import { giorniA } from '../lib/vestiario'
import { Dettaglio, Riquadro, Titoletto } from './ds'

interface Letto {
  gare: Gara[]
  righe: Map<string, (RigaAtletaGara & { corso: string })[]>
}

/**
 * GARE nella pagina I MIEI dell'istruttore: le gare prossime dei suoi atleti
 * o in cui accompagna, in sola lettura. Quali vede lo dicono le RLS di
 * `117-gare.sql` (in prova `gareVisibili`); le scrive la segreteria.
 */
export function MieGare({ personaId }: { personaId: string }) {
  const [letto, setLetto] = useState<Letto | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const oggi = oggiARoma()

  useEffect(() => {
    let vivo = true
    void (async () => {
      const seg = await datiSegreteria()
      const [persone, corsi] = await Promise.all([seg.persone(), seg.corsi()])
      const { gare, atleti } = await (
        await datiGare()
      ).leggi({
        ruolo: 'istruttore',
        personaId,
        corsiInsegnati: corsiInsegnati(corsi, personaId),
      })
      const prossime = gareDaAccompagnare(gare, oggi)
      const righe = new Map(
        prossime.map((g) => [
          g.id,
          righeGara(g, atleti, persone).map((r) => ({
            ...r,
            corso: corsoDi(
              persone.find((p) => p.id === r.personaId),
              corsi,
              oggi,
            ),
          })),
        ]),
      )
      if (vivo) setLetto({ gare: prossime, righe })
    })().catch((e: unknown) => vivo && setGuaio(e instanceof Error ? e.message : 'Non è andata: riprova fra poco'))
    return () => {
      vivo = false
    }
  }, [personaId, oggi])

  if (guaio)
    return (
      <div className="pad" style={{ paddingTop: 14 }}>
        <Riquadro tono="guaio" stretto>
          <span style={{ fontWeight: 700 }}>Le gare non si leggono</span>
          <Dettaglio>{guaio}</Dettaglio>
        </Riquadro>
      </div>
    )
  // Niente gare, niente sezione: la pagina resta quella dei timer.
  if (!letto?.gare.length) return null

  return (
    <div className="stack">
      <Titoletto conto={letto.gare.length}>GARE</Titoletto>
      <div className="pad stack" style={{ gap: 14 }}>
        {letto.gare.map((g) => {
          const righe = letto.righe.get(g.id) ?? []
          const avviso = avvisoCertificati(righe)
          const mappa = linkMappa(g.indirizzo)
          return (
            <div key={g.id} className="card stack" style={{ padding: 14, gap: 10 }}>
              <div className="stack" style={{ gap: 4 }}>
                <span className="ob" style={{ fontSize: 18 }}>
                  {g.nome.toUpperCase()}
                </span>
                <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>
                  {dateGara(g)} · {g.dal > oggi ? giorniA(oggi, g.dal) : 'in corso'}
                </span>
                {(g.luogo || g.indirizzo || g.note) && <Dettaglio>{[g.luogo, g.indirizzo, g.note].filter(Boolean).join(' · ')}</Dettaglio>}
                {mappa && (
                  <a href={mappa} target="_blank" rel="noopener" className="link-alto">
                    Apri la mappa ↗
                  </a>
                )}
              </div>
              {avviso && (
                <Riquadro tono="guaio" stretto>
                  <span style={{ fontWeight: 700 }}>{avviso}</span>
                  <Dettaglio>La segreteria li sta sentendo.</Dettaglio>
                </Riquadro>
              )}
              {righe.map((r) => {
                const c = scrittaCertificato(r)
                return (
                  <div
                    key={r.personaId}
                    className="stack"
                    style={{
                      gap: 2,
                      borderTop: '1px solid var(--line-soft)',
                      paddingTop: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {r.cognome} {r.nome}
                      {r.annoNascita && (
                        <span className="num" style={{ color: 'var(--dim)', fontWeight: 400 }}>
                          {' '}
                          · {r.annoNascita}
                        </span>
                      )}
                    </span>
                    <Dettaglio tono={c.tipo === 'manca' ? 'guaio' : c.tipo === 'aspetta' ? 'avviso' : undefined}>
                      {[r.corso, `Certificato: ${c.testo.toLowerCase()}`, r.nota].filter(Boolean).join(' · ')}
                    </Dettaglio>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
