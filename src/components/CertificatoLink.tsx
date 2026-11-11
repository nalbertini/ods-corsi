import { useEffect, useRef, useState } from 'react'
import { CaricaFile, Campo, Dettaglio, Etichetta, Riquadro, Tasti, Tasto, TitoloEsito } from './ds'
import { codiceDalLink, cosaNonVaScadenza, esitoLink, testiLink, type EsitoLink } from '../lib/certificatoLink'
import { cosaNonVaFileMandato } from '../lib/certificatoIscritto'
import { datiLink, type AperturaLink } from '../lib/certificatoLinkDati'
import { chiaveGiorno } from '../lib/sala'

/**
 * La pagina del link `certificato/?l=…`: senza accesso, per chi deve portare
 * il certificato. Dice solo nome, iniziale, tipo e data; chiede il file e la
 * scadenza. Il file mandato resta da confermare in segreteria.
 */
export function CertificatoLink() {
  const [codice] = useState(() => codiceDalLink(window.location.search))
  const [aperto, setAperto] = useState<AperturaLink | null>(codice ? null : { stato: 'non_vale' })
  const [guaio, setGuaio] = useState<string | null>(null)
  const [giro, setGiro] = useState(0)
  const [esito, setEsito] = useState<EsitoLink | null>(null)

  useEffect(() => {
    if (!codice) return
    setGuaio(null)
    datiLink()
      .apri(codice)
      .then(setAperto, (e: unknown) => setGuaio(e instanceof Error ? e.message : 'La pagina non si è aperta: riprova.'))
  }, [codice, giro])

  if (guaio && !aperto)
    return (
      <div className="pad stack" style={{ gap: 14, paddingTop: 20 }}>
        <Dettaglio tono="guaio">{guaio}</Dettaglio>
        <Tasti>
          <Tasto onClick={() => setGiro((g) => g + 1)}>RIPROVA</Tasto>
        </Tasti>
      </div>
    )
  if (!aperto)
    return (
      <div className="pad" style={{ paddingTop: 20 }}>
        <Dettaglio>Un attimo…</Dettaglio>
      </div>
    )
  const fine = esito ?? (aperto.stato === 'valido' ? null : aperto)
  if (fine) return <Esito esito={fine} onAltro={esito?.stato === 'ricevuto' && aperto.stato === 'valido' ? () => setEsito(null) : undefined} />
  if (aperto.stato !== 'valido' || !codice) return null
  return <Modulo info={aperto} codice={codice} onNonVale={setAperto} onRicevuto={(scade) => setEsito({ stato: 'ricevuto', scade })} />
}

function Esito({ esito, onAltro }: { esito: EsitoLink; onAltro?: () => void }) {
  const t = esitoLink(esito)
  // Il tasto premuto sparisce: il fuoco va sull'esito, che così si legge.
  const qui = useRef<HTMLDivElement>(null)
  useEffect(() => qui.current?.focus(), [])
  return (
    <div ref={qui} tabIndex={-1} className="pad stack certificato-link" style={{ gap: 14, paddingTop: 20, paddingBottom: 28, outline: 'none' }}>
      <TitoloEsito tono={t.tono}>{t.titolo}</TitoloEsito>
      {t.testi.map((x) => (
        <Dettaglio key={x} tono="testo">
          {x}
        </Dettaglio>
      ))}
      {onAltro && (
        <>
          <Tasti>
            <Tasto onClick={onAltro}>HO SBAGLIATO, CARICANE UN ALTRO</Tasto>
          </Tasti>
          <Dettaglio>Quello nuovo prende il posto di questo, finché la segreteria non l’ha controllato.</Dettaglio>
        </>
      )}
    </div>
  )
}

function Modulo({ info, codice, onNonVale, onRicevuto }: {
  info: Extract<AperturaLink, { stato: 'valido' }>
  codice: string
  /** Il link ha smesso di valere mentre la pagina era aperta (confermato, o disattivato). */
  onNonVale: (e: AperturaLink) => void
  onRicevuto: (scade: string) => void
}) {
  const t = testiLink(info)
  const [file, setFile] = useState<File | null>(null)
  const [scade, setScade] = useState('')
  const [provato, setProvato] = useState(false)
  const [invio, setInvio] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  const oggi = chiaveGiorno(new Date())
  const guaioFile = file ? cosaNonVaFileMandato(file) : provato ? 'Scegli la foto o il PDF del certificato.' : null
  const guaioData = scade || provato ? cosaNonVaScadenza(scade, oggi) : null

  const manda = () => {
    setProvato(true)
    if (!file || cosaNonVaFileMandato(file) || cosaNonVaScadenza(scade, oggi)) return
    setGuaio(null)
    setInvio(true)
    datiLink()
      .manda(codice, file, scade)
      .then((e) => (e === 'ricevuto' ? onRicevuto(scade) : onNonVale(e)), (e: unknown) => setGuaio(e instanceof Error ? e.message : 'Non è partito: riprova.'))
      .finally(() => setInvio(false))
  }

  return (
    <div className="pad stack certificato-link" style={{ gap: 14, paddingTop: 6, paddingBottom: 28 }}>
      <h2 className="certificato-link-titolo">{t.titolo}</h2>
      <Riquadro tono="prova" stretto>
        <Etichetta>{t.etichetta}</Etichetta>
        <Dettaglio tono="testo">{t.testo}</Dettaglio>
      </Riquadro>
      <CaricaFile
        id="cl-file"
        etichetta="CERTIFICATO MEDICO"
        dettaglio="Una foto o il PDF, tutto leggibile: timbro e firma del medico."
        file={file ? { nome: file.name, byte: file.size } : undefined}
        errore={guaioFile}
        onFile={(f) => setFile(f ?? null)}
      />
      <Campo
        id="cl-scade"
        etichetta="SCADE IL"
        nota={{ testo: 'Cerca «valido fino al» o «scadenza». Se c’è solo la data della visita, scrivi la stessa data fra un anno.', guaio: false }}
      >
        <input id="cl-scade" className="campo" type="date" min={oggi} value={scade} aria-describedby="cl-scade-nota" aria-invalid={!!guaioData || undefined} onChange={(e) => setScade(e.target.value)} />
        {/* Sotto il campo e annunciato (role=alert), come l'errore del file. */}
        {guaioData && <Dettaglio tono="guaio">{guaioData}</Dettaglio>}
      </Campo>
      <Tasti>
        <Tasto variante="principale" disabled={invio} onClick={manda}>
          {invio ? 'STO MANDANDO…' : 'MANDA ALLA SEGRETERIA'}
        </Tasto>
      </Tasti>
      {guaio && <Dettaglio tono="guaio">{guaio}</Dettaglio>}
      <Dettaglio>Problemi? Scrivi alla segreteria o passa in palestra.</Dettaglio>
    </div>
  )
}
