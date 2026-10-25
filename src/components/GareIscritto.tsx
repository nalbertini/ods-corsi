import { useEffect, useState } from 'react'
import { oggiARoma } from '../lib/contabilita'
import { datiGare } from '../lib/gareDati'
import { certificatoPerLaGara, dateGara, dividiMieGare, leMieGare, linkMappa, type GaraMia } from '../lib/gare'
import type { SchedaIscritto } from '../lib/iscritto'
import { euroBreve } from '../lib/ricevute'
import { giorniA } from '../lib/vestiario'
import { Dettaglio, Riquadro, Titoletto } from './ds'

/**
 * LE MIE GARE nell'area iscritti: le gare a cui la segreteria ha invitato
 * questa persona, con la sua quota e il certificato alla data della gara.
 * Niente degli altri atleti: le RLS di `117-gare.sql` danno solo le righe sue
 * e dei figli del nucleo.
 * Senza gare la sezione non c'è.
 */
export function GareIscritto({ scheda }: { scheda: SchedaIscritto }) {
  const [mie, setMie] = useState<GaraMia[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)
  const oggi = oggiARoma()

  useEffect(() => {
    let vivo = true
    void datiGare()
      .then((d) =>
        d.leggi({
          ruolo: 'iscritto',
          personaId: scheda.id,
          corsiInsegnati: [],
        }),
      )
      .then(({ gare, atleti }) => vivo && setMie(leMieGare([scheda.id], gare, atleti)))
      .catch((e: unknown) => vivo && setGuaio(e instanceof Error ? e.message : 'Non è andata: riprova fra poco'))
    return () => {
      vivo = false
    }
  }, [scheda.id])

  if (guaio)
    return (
      <div className="pad">
        <Dettaglio tono="guaio">{guaio}</Dettaglio>
      </div>
    )
  if (!mie?.length) return null
  const { prossime, passate } = dividiMieGare(mie, oggi)

  return (
    <div className="stack">
      <Titoletto icona="gara" conto={prossime.length || undefined}>LE MIE GARE</Titoletto>
      <div className="pad stack" style={{ gap: 14 }}>
        {prossime.map((m) => (
          <MiaGara key={m.gara.id} m={m} scheda={scheda} oggi={oggi} />
        ))}
        {passate.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <Dettaglio>{passate.some((m) => m.gara.annullata) ? 'Gare passate e annullate' : 'Gare passate'}</Dettaglio>
            {passate.map((m) => (
              <span key={m.gara.id} style={{ fontSize: 15 }}>
                {m.gara.nome} · <span className="num">{dateGara(m.gara)}</span>
                {m.gara.annullata && ' · annullata'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MiaGara({ m, scheda, oggi }: { m: GaraMia; scheda: SchedaIscritto; oggi: string }) {
  const g = m.gara
  const mappa = linkMappa(g.indirizzo)
  const cert = certificatoPerLaGara(scheda, g)
  return (
    <div className="card stack" style={{ padding: 14, gap: 10 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="ob" style={{ fontSize: 18 }}>
          {g.nome.toUpperCase()}
        </span>
        <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>
          {dateGara(g)} · {g.dal > oggi ? giorniA(oggi, g.dal) : 'in corso'}
        </span>
        {(g.luogo || g.organizzatore || g.indirizzo) && <Dettaglio>{[g.luogo, g.indirizzo, g.organizzatore && `organizza ${g.organizzatore}`].filter(Boolean).join(' · ')}</Dettaglio>}
        {mappa && (
          <a href={mappa} target="_blank" rel="noopener" className="link-alto">
            Apri la mappa ↗
          </a>
        )}
      </div>
      {scheda.corsi.length > 0 && <Dettaglio tono="testo">Corso: {scheda.corsi.map((c) => c.nome).join(', ')}</Dettaglio>}
      {m.nota && <Dettaglio tono="testo">{m.nota}</Dettaglio>}
      {g.note && <Dettaglio>{g.note}</Dettaglio>}
      {cert &&
        (cert.guaio ? (
          <Riquadro tono="guaio" stretto>
            <span style={{ fontWeight: 700 }}>{cert.testo}</span>
            {cert.dettaglio && <Dettaglio>{cert.dettaglio}</Dettaglio>}
          </Riquadro>
        ) : (
          <Dettaglio tono="fatto">{cert.testo}</Dettaglio>
        ))}
      {m.totale > 0 && (
        <div className="stack" style={{ gap: 4 }}>
          <Dettaglio>QUOTA</Dettaglio>
          {m.voci.map((v) => (
            <span key={v.voce} className="row" style={{ justifyContent: 'space-between', fontSize: 15 }}>
              <span>{v.voce}</span>
              <span className="num">{euroBreve(v.importo)}</span>
            </span>
          ))}
          <span
            className="row num"
            style={{
              justifyContent: 'space-between',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            <span>{m.pagata ? 'Pagata' : 'Da pagare'}</span>
            <span>{euroBreve(m.totale)}</span>
          </span>
        </div>
      )}
    </div>
  )
}
