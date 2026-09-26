import { useEffect, useState } from 'react'
import type { DatiTablet, LezioneSala, RigaAppelloTablet } from '../../lib/tablet'
import { fase } from '../../lib/tablet'
import type { StatoPresenza } from '../../lib/sala'
import { chiaveGiorno, giornoPerEsteso } from '../../lib/sala'
import { Croce, Spunta } from '../Icons'
import { Guaio, messaggio, orario } from './comune'

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
 */
export function TabletIstruttore({
  d,
  pin,
  adesso,
  lezioni,
  onCambiato,
  onEsci,
  onPinScaduto,
  onScollega,
}: {
  d: DatiTablet
  pin: string
  adesso: Date
  lezioni: LezioneSala[]
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

  const primaDiOggi = diOggi.find((l) => fase(l, adesso) === 'aperta') ?? diOggi.find((l) => fase(l, adesso) === 'in corso') ?? diOggi[0]
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
  useEffect(() => setNonAndato(null), [scelta])
  // Rileggere passa da qui, così una lettura vecchia non finisce sotto
  // un'altra lezione scelta nel frattempo.
  useEffect(() => {
    if (!scelta) return
    let vivo = true
    setRighe(null)
    setGuaio(null)
    d.appello(pin, scelta)
      .then((r) => vivo && setRighe(r))
      .catch((e: unknown) => vivo && setGuaio(messaggio(e, "Non riesco a leggere l'appello")))
    return () => {
      vivo = false
    }
  }, [d, pin, scelta, giro])

  const metti = async (cambi: Array<{ personaId: string; stato: StatoPresenza }>) => {
    if (!scelta || !cambi.length) return
    setNonAndato(null)
    const quali = new Map(cambi.map((c) => [c.personaId, c.stato]))
    setRighe((r) => r && r.map((x) => (quali.has(x.personaId) ? { ...x, stato: quali.get(x.personaId)!, origine: 'appello' } : x)))
    try {
      for (const c of cambi) {
        if (!(await d.correggi(pin, scelta, c.personaId, c.stato))) return onPinScaduto()
      }
      onCambiato()
    } catch (e) {
      setNonAndato(messaggio(e, 'Il server non risponde'))
      setGiro((g) => g + 1)
    }
  }

  const presenti = righe?.filter((r) => r.stato === 'presente').length ?? 0
  const daSe = righe?.filter((r) => r.origine === 'tablet' || r.origine === 'recupero').length ?? 0

  const scegliCorso = (id: string) => {
    setCorsoId(id)
    setScelta(utili.filter((l) => l.corsoId === id).sort((a, b) => b.inizio.localeCompare(a.inizio))[0]?.id ?? null)
  }

  return (
    <div className="tb-corpo tb-istruttore">
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
            <label htmlFor="tb-corso" className="tb-etichetta" style={{ fontSize: 13 }}>
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

        <div className="stack grow tb-scorre" style={{ gap: 8 }}>
          {elenco.map((l) => {
            const g = chiaveGiorno(new Date(l.inizio))
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={l.id === scelta}
                className="tb-lezione-istr"
                style={{ ['--tinta' as string]: l.colore ?? 'var(--blu)' }}
                onClick={() => setScelta(l.id)}
              >
                <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--dim)' }}>{orario(l)}</span>
                <span className="ob" style={{ fontSize: 20, fontWeight: 700 }}>
                  {scheda === 'corso' ? (g === oggi ? 'OGGI' : giornoPerEsteso(g).toUpperCase()) : l.corso.toUpperCase()}
                </span>
                <span style={{ fontSize: 13, color: 'var(--sec)' }}>
                  {l.presenti} presenti su {l.iscritti}
                  {l.stato === 'annullata' ? ' · annullata' : ''}
                </span>
              </button>
            )
          })}
          {elenco.length === 0 && <span className="tb-nota">Nessuna lezione.</span>}
        </div>

        <button type="button" className="tb-btn tb-btn-linea" onClick={onEsci}>
          ESCI
        </button>
        <span className="tb-nota" style={{ fontSize: 13 }}>
          Si esce da soli dopo 2 minuti senza tocchi: il tablet resta in sala.
        </span>
        <button
          type="button"
          className="tb-scollega"
          onClick={() => {
            if (window.confirm('Scollegare il tablet dalla sala? Per ricollegarlo serve di nuovo l’account della sala.')) onScollega()
          }}
        >
          Scollega il tablet
        </button>
      </div>

      <div className="tb-colonna" style={{ gap: 14 }}>
        {lezione ? (
          <div className="tb-testa-appello">
            <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <span className="ob" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.03em' }}>{lezione.corso.toUpperCase()}</span>
              <span style={{ fontSize: 14, color: 'var(--sec)' }}>
                {chiaveGiorno(new Date(lezione.inizio)) === oggi ? 'oggi' : giornoPerEsteso(chiaveGiorno(new Date(lezione.inizio)))},{' '}
                {orario(lezione)} · {daSe} {daSe === 1 ? 'segnato' : 'segnati'} da sé sul tablet · tocca un nome per cambiarlo
              </span>
            </div>
            <span className="num" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{presenti}</span>
            <span className="num" style={{ fontSize: 22, color: 'var(--dim)' }}>/ {righe?.length ?? lezione.iscritti}</span>
            <button
              type="button"
              className="tb-btn tb-btn-verde"
              onClick={() => void metti((righe ?? []).filter((r) => r.stato !== 'presente').map((r) => ({ personaId: r.personaId, stato: 'presente' })))}
            >
              TUTTI PRESENTI
            </button>
            <button
              type="button"
              className="tb-btn tb-btn-linea"
              onClick={() => void metti((righe ?? []).filter((r) => r.stato === null).map((r) => ({ personaId: r.personaId, stato: 'assente' })))}
            >
              GLI ALTRI ASSENTI
            </button>
          </div>
        ) : (
          <span className="tb-nota">Scegli una lezione.</span>
        )}

        {guaio && <Guaio titolo="APPELLO" testo={guaio} />}
        {nonAndato && !guaio && <Guaio titolo="NON SEGNATO" testo={nonAndato} />}
        {lezione && !guaio && righe === null && <p className="tb-nota">Sto leggendo l'appello…</p>}

        <div className="tb-righe tb-scorre">
          {righe?.map((r) => (
            <button
              key={r.personaId}
              type="button"
              className="tb-riga"
              data-stato={r.stato ?? 'niente'}
              onClick={() => void metti([{ personaId: r.personaId, stato: r.stato === 'presente' ? 'assente' : 'presente' }])}
              aria-label={`${r.cognome} ${r.nome}: ${r.stato ?? 'non segnato'}`}
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
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
