import { useEffect, useMemo, useRef, useState } from 'react'
import type { DatiTablet, LezioneSala, PresenzaIstruttore, RigaAppelloTablet } from '../../lib/tablet'
import { fase, lezioneDiAdesso, sorvegliaScritture } from '../../lib/tablet'
import type { StatoPresenza } from '../../lib/sala'
import { chiaveGiorno, giornoPerEsteso } from '../../lib/sala'
import { Croce, Spunta } from '../Icons'
import { Guaio, messaggio, orario } from './comune'
import type { ChiProva } from '../../lib/prove'
import { giaNellAppello } from '../../lib/prove'
import { MarchioProva, PannelloProve, TogliProva } from '../Prove'

/**
 * L'appello completo, dal tablet, per chi ha il PIN.
 *
 * È l'appello dell'app con due cose in più: si vede chi si è segnato da sé
 * (DAL TABLET) e chi l'ha fatto dopo (SEGNATO DOPO), e si passa da una
 * lezione all'altra della sala — quelle di oggi, o quelle di un corso
 * all'indietro, che è come si recuperano i buchi del registro.
 *
 * Il giro del tocco è presente → assente → presente: un segno dell'istruttore
 * non si toglie, si cambia. È la stessa regola del database.
 *
 * Col tasto PROVE aggiunge chi viene a provare: va in fondo all'appello, già
 * presente, e si tocca come gli altri (vedi `Prove.tsx`).
 *
 * In cima dice se il PIN gli ha segnato la presenza nella lezione in corso:
 * segnata se era previsto, se no da confermare in segreteria.
 */
export function TabletIstruttore({
  d,
  pin,
  presenze,
  adesso,
  lezioni,
  visibile = true,
  onCambiato,
  onEsci,
  onPinScaduto,
  onScollega,
}: {
  d: DatiTablet
  pin: string
  /** Le presenze che il PIN gli ha appena segnato. */
  presenze: PresenzaIstruttore[]
  adesso: Date
  lezioni: LezioneSala[]
  /** Sotto il timer resta montata ma nascosta, e tiene la lezione scelta. */
  visibile?: boolean
  /** Qualcosa è cambiato: i conti nell'elenco delle lezioni vanno riletti. */
  onCambiato: () => void
  onEsci: () => void
  onPinScaduto: () => void
  onScollega: () => void
}) {
  const oggi = chiaveGiorno(adesso)
  // Le lezioni già cominciate o che si aprono a momenti: quelle future non
  // hanno ancora un appello da fare.
  const utili = lezioni.filter((l) => fase(l, adesso) !== 'dopo' || chiaveGiorno(new Date(l.inizio)) === oggi)
  const diOggi = utili.filter((l) => chiaveGiorno(new Date(l.inizio)) === oggi)
  const corsi = [...new Map(utili.map((l) => [l.corsoId, l.corso])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'))

  // Si parte dalla lezione che tiene chi è entrato col PIN: al cambio lezione
  // ce ne sono due aperte, e la sua è quella che comincia. Senza una sua,
  // quella in cui ci si segna adesso.
  const sue = diOggi.filter((l) => presenze.some((p) => p.sessioneId === l.id))
  const primaDiOggi = lezioneDiAdesso(sue, adesso) ?? sue[0] ?? lezioneDiAdesso(diOggi, adesso) ?? diOggi[0]
  const [scheda, setScheda] = useState<'oggi' | 'corso'>(diOggi.length ? 'oggi' : 'corso')
  const [corsoId, setCorsoId] = useState<string | null>(primaDiOggi?.corsoId ?? corsi[0]?.[0] ?? null)
  const [scelta, setScelta] = useState<string | null>(
    primaDiOggi?.id ?? [...utili].sort((a, b) => b.inizio.localeCompare(a.inizio))[0]?.id ?? null,
  )

  const elenco =
    scheda === 'oggi'
      ? diOggi
      : utili.filter((l) => l.corsoId === corsoId).sort((a, b) => b.inizio.localeCompare(a.inizio))
  const lezione = utili.find((l) => l.id === scelta)

  const [righe, setRighe] = useState<RigaAppelloTablet[] | null>(null)
  const [guaio, setGuaio] = useState<string | null>(null)

  // Perché una scrittura non è andata: resta in vista mentre l'appello si
  // rilegge, e se ne va cambiando lezione.
  const [nonAndato, setNonAndato] = useState<string | null>(null)
  const [giro, setGiro] = useState(0)
  const [conProve, setConProve] = useState(false)
  const [giaQui, setGiaQui] = useState<ReadonlySet<string>>(new Set())
  // La lezione in vista adesso: una scrittura che risponde dopo un cambio di
  // lezione non deve toccare l'elenco di quella nuova.
  const inVista = useRef(scelta)
  inVista.current = scelta
  // L'elenco si svuota solo cambiando lezione: rileggendo la stessa resta in
  // vista, se no il pannello prove si smonta e perde il suo messaggio.
  useEffect(() => {
    setNonAndato(null)
    setConProve(false)
    setRighe(null)
    setGiaQui(new Set())
  }, [scelta])
  // Uno per lezione: la lettura di quella nuova non aspetta le scritture
  // ancora in corso su quella di prima.
  const scritture = useMemo(sorvegliaScritture, [scelta])
  const scrivendo = async (fai: () => Promise<void>) => {
    scritture.inizia()
    try {
      await fai()
    } finally {
      if (scritture.fine()) setGiro((g) => g + 1)
    }
  }
  // Rileggere passa da qui, così una lettura vecchia non finisce sotto
  // un'altra lezione scelta nel frattempo.
  useEffect(() => {
    if (!scelta) return
    let vivo = true
    const foto = scritture.fotografa()
    setGuaio(null)
    d.appello(pin, scelta)
      .then((r) => {
        if (!vivo) return
        const esito = scritture.lettura(foto)
        if (esito === 'mostra') {
          setRighe(r)
          setGiaQui((g) => giaNellAppello(g, { letti: r.map((x) => x.personaId) }))
        }
        else if (esito === 'rileggi') setGiro((g) => g + 1)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        // L'elenco vecchio può avere un tocco che il server non ha: sotto
        // l'avviso mostrerebbe presente chi non lo è. Il pannello prove resta,
        // con la conferma dell'aggiunta appena fatta, e chi è già nell'appello
        // resta quello di prima.
        setRighe(null)
        setGuaio(messaggio(e, "Non riesco a leggere l'appello"))
      })
    return () => {
      vivo = false
    }
  }, [d, pin, scelta, giro, scritture])

  const metti = async (cambi: Array<{ personaId: string; stato: StatoPresenza; prova?: boolean }>) => {
    if (!scelta || !cambi.length) return
    setNonAndato(null)
    const quali = new Map(cambi.map((c) => [c.personaId, c.stato]))
    setRighe((r) => r && r.map((x) => (quali.has(x.personaId) ? { ...x, stato: quali.get(x.personaId)!, origine: 'appello' } : x)))
    await scrivendo(async () => {
      try {
        for (const c of cambi) {
          if (!(await d.correggi(pin, scelta, c.personaId, c.stato, c.prova))) return onPinScaduto()
        }
        onCambiato()
      } catch (e) {
        setNonAndato(messaggio(e, 'Il server non risponde'))
        setGiro((g) => g + 1)
      }
    })
  }

  // Senza coda, come il resto del tablet: si rilegge l'appello dal server.
  const aggiungiProva = async (chi: ChiProva) => {
    if (!scelta) return
    const sessione = scelta
    const id = await d.aggiungiProva(pin, sessione, chi)
    if (!id) return onPinScaduto()
    if (inVista.current === sessione) setGiaQui((g) => giaNellAppello(g, { aggiunto: id }))
    onCambiato()
    setGiro((g) => g + 1)
  }
  const togliProva = async (personaId: string) => {
    if (!scelta) return
    const sessione = scelta
    setNonAndato(null)
    setRighe((r) => r && r.filter((x) => x.personaId !== personaId))
    await scrivendo(async () => {
      try {
        if (!(await d.togliProva(pin, sessione, personaId))) return onPinScaduto()
        if (inVista.current === sessione) setGiaQui((g) => giaNellAppello(g, { tolto: personaId }))
        onCambiato()
      } catch (e) {
        setNonAndato(messaggio(e, 'Il server non risponde'))
        setGiro((g) => g + 1)
      }
    })
  }

  // La lezione scelta resta in vista anche quando l'elenco è più lungo dello spazio.
  const scelto = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (visibile) scelto.current?.scrollIntoView({ block: 'nearest' })
  }, [scelta, scheda, visibile])

  // TUTTI PRESENTI e GLI ALTRI ASSENTI cambiano mezzo appello in un tocco. A
  // lezione aperta è il gesto più veloce e resta un tocco; su una lezione
  // passata, che è già storia, il primo tocco chiede conferma. Un vero annullo
  // non c'è: un segno dell'appello si cambia, non si toglie (segna_con_pin).
  const [daConfermare, setDaConfermare] = useState<'tutti' | 'altri' | null>(null)
  useEffect(() => {
    if (!daConfermare) return
    const t = window.setTimeout(() => setDaConfermare(null), 5000)
    return () => window.clearTimeout(t)
  }, [daConfermare])
  useEffect(() => setDaConfermare(null), [scelta])
  const conConferma = !!lezione && fase(lezione, adesso) !== 'aperta'
  const daSegnarePresenti = (righe ?? []).filter((r) => r.stato !== 'presente')
  const daSegnareAssenti = (righe ?? []).filter((r) => r.stato === null)
  const tutti = (quale: 'tutti' | 'altri') => {
    if (conConferma && daConfermare !== quale) return setDaConfermare(quale)
    setDaConfermare(null)
    void metti(
      quale === 'tutti'
        ? daSegnarePresenti.map((r) => ({ personaId: r.personaId, stato: 'presente', prova: r.prova }))
        : daSegnareAssenti.map((r) => ({ personaId: r.personaId, stato: 'assente', prova: r.prova })),
    )
  }

  const presenti = righe?.filter((r) => r.stato === 'presente').length ?? 0
  const daSe = righe?.filter((r) => r.origine === 'tablet' || r.origine === 'recupero').length ?? 0

  const scegliCorso = (id: string) => {
    setCorsoId(id)
    setScelta(utili.filter((l) => l.corsoId === id).sort((a, b) => b.inizio.localeCompare(a.inizio))[0]?.id ?? null)
  }

  return (
    <div className="tb-corpo tb-istruttore" hidden={!visibile}>
      <div className="tb-colonna" style={{ gap: 10 }}>
        <div role="tablist" aria-label="Quali lezioni" className="tb-schede">
          {(
            [
              ['oggi', 'OGGI'],
              ['corso', 'PER CORSO'],
            ] as const
          ).map(([id, nome]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={scheda === id}
              className="num tb-scheda"
              onClick={() => setScheda(id)}
            >
              {nome}
            </button>
          ))}
        </div>

        {scheda === 'corso' && (
          <>
            <label htmlFor="tb-corso" className="tb-etichetta" style={{ fontSize: 15 }}>
              CORSO
            </label>
            <select id="tb-corso" className="tb-select" value={corsoId ?? ''} onChange={(e) => scegliCorso(e.target.value)}>
              {/* Senza, con nessun corso scelto il primo sembrerebbe scelto e non si potrebbe sceglierlo. */}
              {!corsoId && <option value="">Scegli un corso</option>}
              {corsi.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="stack grow tb-scorre tb-lezioni-istr" style={{ gap: 8 }}>
          {elenco.map((l) => {
            const g = chiaveGiorno(new Date(l.inizio))
            // Passata, non annullata e nessuno presente: l'appello quasi
            // certamente non è stato fatto. In rosso, come SENZA APPELLO in
            // segreteria: è il buco che l'istruttore viene a chiudere.
            const senzaAppello = l.stato !== 'annullata' && l.presenti === 0 && fase(l, adesso) === 'finita'
            return (
              <button
                key={l.id}
                data-guaio={senzaAppello || undefined}
                ref={l.id === scelta ? scelto : undefined}
                type="button"
                aria-pressed={l.id === scelta}
                className="tb-lezione-istr"
                style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}
                onClick={() => setScelta(l.id)}
              >
                <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--dim)' }}>{orario(l)}</span>
                <span className="ob" style={{ fontSize: 20, fontWeight: 700 }}>
                  {scheda === 'corso' ? (g === oggi ? 'OGGI' : giornoPerEsteso(g).toUpperCase()) : l.corso.toUpperCase()}
                </span>
                {senzaAppello ? (
                  <span className="num tb-senza-appello">✕ SENZA APPELLO</span>
                ) : (
                  <span style={{ fontSize: 15, color: 'var(--sec)' }}>
                    {l.presenti} {l.presenti === 1 ? 'presente' : 'presenti'} su {l.iscritti}
                    {l.stato === 'annullata' ? ' · annullata' : ''}
                  </span>
                )}
              </button>
            )
          })}
          {elenco.length === 0 && <span className="tb-nota">Nessuna lezione.</span>}
        </div>

        {/* Sotto le lezioni, non sopra: l'istruttore entra per l'appello, e
            com'è andata la sua presenza è un'informazione in più. */}
        {presenze.length > 0 && <LaTuaPresenza presenze={presenze} />}
        <button type="button" className="tb-btn tb-btn-linea" onClick={onEsci}>
          ESCI
        </button>
        <span className="tb-nota" style={{ fontSize: 15 }}>
          Si esce da soli dopo 2 minuti senza tocchi: il tablet resta in sala.
        </span>
        <button type="button" className="tb-scollega" onClick={onScollega}>
          Scollega il tablet
        </button>
      </div>

      <div className="tb-colonna" style={{ gap: 14 }}>
        {lezione ? (
          <div className="tb-testa-appello">
            <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.03em' }}>{lezione.corso.toUpperCase()}</span>
              <span style={{ fontSize: 16, color: 'var(--sec)' }}>
                {chiaveGiorno(new Date(lezione.inizio)) === oggi ? 'oggi' : giornoPerEsteso(chiaveGiorno(new Date(lezione.inizio)))},{' '}
                {orario(lezione)} · {daSe} {daSe === 1 ? 'segnato' : 'segnati'} da sé sul tablet · tocca un nome per cambiarlo
              </span>
            </div>
            <span className="num" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{presenti}</span>
            <span className="num" style={{ fontSize: 22, color: 'var(--dim)' }}>/ {righe?.length ?? lezione.iscritti}</span>
            {/* I tre tasti insieme, sempre sulla stessa riga e nello stesso ordine. */}
            <div className="tb-azioni-appello">
              <button type="button" className="tb-btn tb-btn-verde" disabled={!daSegnarePresenti.length} onClick={() => tutti('tutti')}>
                {daConfermare === 'tutti' ? `CONFERMA: ${daSegnarePresenti.length} PRESENTI` : 'TUTTI PRESENTI'}
              </button>
              <button type="button" className="tb-btn tb-btn-linea" disabled={!daSegnareAssenti.length} onClick={() => tutti('altri')}>
                {daConfermare === 'altri' ? `CONFERMA: ${daSegnareAssenti.length} ASSENTI` : 'GLI ALTRI ASSENTI'}
              </button>
              <button
                type="button"
                className="tb-btn tb-btn-linea"
                aria-expanded={conProve}
                disabled={righe === null || lezione.stato === 'annullata'}
                onClick={() => setConProve((x) => !x)}
              >
                PROVE
              </button>
            </div>
            {daConfermare && (
              <span role="status" className="tb-nota" style={{ flexBasis: '100%', color: 'var(--giallo-testo)', fontWeight: 600 }}>
                Lezione passata: tocca ancora per confermare, o lascia stare e non cambia niente.
              </span>
            )}
          </div>
        ) : (
          <span className="tb-nota">Scegli una lezione.</span>
        )}

        {guaio && <Guaio titolo="APPELLO" testo={guaio} />}
        {nonAndato && !guaio && <Guaio titolo="NON SEGNATO" testo={nonAndato} />}
        {lezione && !guaio && righe === null && <p className="tb-nota">Sto leggendo l'appello…</p>}

        {conProve && (
          <PannelloProve
            stile="tb"
            cerca={(scritto) => d.provati(pin, scritto)}
            giaQui={giaQui}
            onAggiungi={aggiungiProva}
            onChiudi={() => setConProve(false)}
          />
        )}

        <div className="tb-righe tb-scorre">
          {righe?.map((r) => {
            const riga = (
              <button
                key={r.personaId}
                type="button"
                className="tb-riga"
                data-stato={r.stato ?? 'niente'}
                onClick={() => void metti([{ personaId: r.personaId, stato: r.stato === 'presente' ? 'assente' : 'presente', prova: r.prova }])}
                aria-label={`${r.cognome} ${r.nome}${r.prova ? ', in prova' : ''}: ${r.stato ?? 'non segnato'}`}
              >
                <span className="tb-riga-segno" aria-hidden="true">
                  {r.stato === 'presente' && <Spunta size={22} />}
                  {r.stato === 'assente' && <Croce />}
                </span>
                <span className="grow tb-riga-nome">
                  {r.cognome} {r.nome}
                </span>
                {r.stato === 'presente' && r.origine === 'recupero' && <span className="num tb-marchio" data-tipo="dopo">SEGNATO DOPO</span>}
                {r.stato === 'presente' && r.origine === 'tablet' && <span className="num tb-marchio">DAL TABLET</span>}
                {r.prova && <MarchioProva />}
              </button>
            )
            return r.prova ? (
              <div key={r.personaId} className="riga-prova">
                {riga}
                <TogliProva chi={`${r.cognome} ${r.nome}`} onTogli={() => void togliProva(r.personaId)} />
              </div>
            ) : (
              riga
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** `colore` per il bordo, `scritto` per l'etichetta: giallo e verde puri sul tema chiaro non si leggono. */
const PRESENZA: Record<PresenzaIstruttore['stato'], { titolo: string; testo: string; colore: string; scritto: string }> = {
  confermata: { titolo: 'LA TUA PRESENZA È SEGNATA', testo: 'Eri previsto su questa lezione.', colore: 'var(--verde)', scritto: 'var(--verde-testo)' },
  da_confermare: {
    titolo: 'PRESENZA DA CONFERMARE',
    testo: 'Non eri previsto su questa lezione: la tua presenza la conferma la segreteria.',
    colore: 'var(--giallo)',
    scritto: 'var(--giallo-testo)',
  },
  rifiutata: {
    titolo: 'PRESENZA NON CONFERMATA',
    testo: 'La segreteria non l’ha confermata: se è un errore, parlane con lei.',
    colore: 'var(--rosso)',
    scritto: 'var(--rosso)',
  },
}

/** Cosa ha fatto il PIN alla presenza dell'istruttore, una riga per lezione. */
function LaTuaPresenza({ presenze }: { presenze: PresenzaIstruttore[] }) {
  // Due lezioni aperte insieme, tutte e due sue: lo stesso stato si dice una volta.
  const stati = [...new Set(presenze.map((p) => p.stato))]
  return (
    <>
      {stati.map((stato) => {
        const x = PRESENZA[stato]
        return (
          <div key={stato} role="status" className="tb-riquadro" style={{ borderColor: x.colore }}>
            <span className="tb-etichetta" style={{ color: x.scritto }}>
              {x.titolo}
            </span>
            <span className="tb-riquadro-testo">
              {presenze
                .filter((p) => p.stato === stato)
                .map((p) => p.corso)
                .join(', ')}
              . {x.testo}
            </span>
          </div>
        )
      })}
    </>
  )
}
