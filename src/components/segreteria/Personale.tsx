import { useState, type FormEvent } from 'react'
import type { DatiSegreteria, PersonaleSeg } from '../../lib/segreteria'
import { Riga, Testa, useAvviso, useCarica } from './comune'

/** Quello che ciascun ruolo può fare: è il riassunto delle policy di `02-policy.sql`. */
const PERMESSI: Array<[string, string]> = [
  ['Vedere il calendario e fare l’appello, anche da sostituto', 'SÌ'],
  ['Aprire l’area istruttore del tablet col PIN', 'SÌ'],
  ['Annullare o chiudere le lezioni dei suoi corsi', 'SÌ'],
  ['Cambiare corsi, orari e sale', 'NO'],
  ['Aggiungere e togliere iscritti', 'NO'],
  ['Vedere il resoconto delle presenze e le regole', 'NO'],
]

/**
 * Chi entra nell'app e cosa può fare. Gli iscritti non sono qui: non hanno un
 * accesso.
 *
 * Una persona si aggiunge con la sua email; l'account lo crea poi chi ha le
 * chiavi di Supabase (**Authentication → Users**), con la stessa email: al
 * primo accesso i due si legano da soli. Dal browser un account non si può
 * creare, ed è giusto così: la chiave che sta nell'app è pubblica.
 */
export function Personale({ d }: { d: DatiSegreteria }) {
  const lista = useCarica(() => d.personale(), [d])
  const { avviso, fai } = useAvviso()
  const [bozza, setBozza] = useState({ nome: '', cognome: '', email: '', ruolo: 'istruttore' as 'istruttore' | 'staff' })
  const [pin, setPin] = useState<{ id: string; valore: string } | null>(null)

  const persone = [...(lista.dato ?? [])].sort(
    (a, b) => Number(b.attiva) - Number(a.attiva) || a.ruolo.localeCompare(b.ruolo) || a.nome.localeCompare(b.nome, 'it'),
  )

  const aggiungi = (e: FormEvent) => {
    e.preventDefault()
    void fai(() => d.salvaPersonale(bozza), `${bozza.nome} è nell'elenco`, async () => {
      setBozza({ nome: '', cognome: '', email: '', ruolo: 'istruttore' })
      await lista.ricarica()
    })
  }

  const cambiaRuolo = (p: PersonaleSeg, ruolo: 'istruttore' | 'staff') =>
    void fai(() => d.salvaPersonale({ id: p.id, nome: p.nome, cognome: p.cognome, email: p.email, ruolo }), 'Ruolo cambiato', lista.ricarica)

  return (
    <>
      <Testa titolo="ISTRUTTORI E ACCESSI" sotto="Chi entra nell'app e cosa può fare. Gli iscritti non sono qui: non hanno un accesso." />

      <div className="sg-due-colonne">
        <div className="stack grow" style={{ gap: 20, minWidth: 0 }}>
          <div role="table" aria-label="Personale" className="sg-tabella">
            <div role="row" className="sg-lista-testa sg-riga-personale">
              <span role="columnheader" className="sg-etichetta">NOME</span>
              <span role="columnheader" className="sg-etichetta">EMAIL</span>
              <span role="columnheader" className="sg-etichetta">RUOLO</span>
              <span role="columnheader" className="sg-etichetta">ACCESSO</span>
              <span role="columnheader" className="sg-etichetta">PIN TABLET</span>
              <span role="columnheader" />
            </div>
            {lista.dato === null && <p className="sg-sotto" style={{ padding: '12px 14px' }}>Sto leggendo…</p>}
            {persone.map((p) => (
              <div key={p.id} role="row" className="sg-riga-personale sg-personale" data-spento={!p.attiva}>
                <span role="cell" className="stack" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{`${p.nome} ${p.cognome}`.trim()}</span>
                  <span className="sg-una-riga" style={{ fontSize: 12, color: 'var(--dim)' }} title={p.corsi.join(', ')}>
                    {p.corsi.join(', ') || (p.ruolo === 'staff' ? 'segreteria' : 'nessun corso')}
                  </span>
                </span>
                <span role="cell" className="sg-una-riga" style={{ fontSize: 13, color: p.email ? 'var(--sec)' : 'var(--rosso)' }} title={p.email ?? 'Senza email non può entrare'}>
                  {p.email ?? 'nessuna email'}
                </span>
                <span role="cell">
                  <label className="vh" htmlFor={`ruolo-${p.id}`}>
                    Ruolo di {p.nome}
                  </label>
                  <select id={`ruolo-${p.id}`} className="sg-campo" style={{ height: 36 }} value={p.ruolo} onChange={(e) => cambiaRuolo(p, e.target.value as 'istruttore' | 'staff')}>
                    <option value="istruttore">Istruttore</option>
                    <option value="staff">Segreteria</option>
                  </select>
                </span>
                <span role="cell" className="num" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: !p.attiva ? 'var(--dim)' : p.collegato ? 'var(--verde)' : 'var(--giallo-testo)' }}>
                  {!p.attiva ? 'SENZA ACCESSO' : p.collegato ? 'HA FATTO L’ACCESSO' : 'NON ANCORA ENTRATO'}
                </span>
                <span role="cell">
                  {pin?.id === p.id ? (
                    <form
                      className="row"
                      style={{ gap: 4 }}
                      onSubmit={(e) => {
                        e.preventDefault()
                        void fai(() => d.impostaPin(p.id, pin.valore), 'PIN impostato', async () => {
                          setPin(null)
                          await lista.ricarica()
                        })
                      }}
                    >
                      <input
                        className="sg-campo num"
                        style={{ height: 36, width: 70 }}
                        inputMode="numeric"
                        pattern="\d{4}"
                        maxLength={4}
                        aria-label={`Nuovo PIN di ${p.nome}`}
                        autoFocus
                        value={pin.valore}
                        onChange={(e) => setPin({ id: p.id, valore: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      />
                      <button type="submit" className="num sg-chip sg-chip-pieno" style={{ minHeight: 36 }} disabled={pin.valore.length !== 4}>
                        OK
                      </button>
                    </form>
                  ) : (
                    <button type="button" className="num sg-chip" style={{ minHeight: 36 }} onClick={() => setPin({ id: p.id, valore: '' })}>
                      {p.haPin ? 'CAMBIA' : 'IMPOSTA'}
                    </button>
                  )}
                </span>
                <span role="cell" style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="sg-link"
                    onClick={() => {
                      if (p.attiva && !window.confirm(`Togliere l'accesso a ${p.nome}? Non entra più nell'app né nell'area istruttore; il registro resta.`)) return
                      void fai(() => d.attivaPersona(p.id, !p.attiva), p.attiva ? 'Accesso tolto' : 'Accesso ridato', lista.ricarica)
                    }}
                  >
                    {p.attiva ? 'togli l’accesso' : 'ridai l’accesso'}
                  </button>
                </span>
              </div>
            ))}
          </div>

          <section aria-label="Cosa può fare ogni ruolo" className="sg-riquadro">
            <Riga titolo="COSA PUÒ FARE OGNI RUOLO" />
            <div role="table" className="sg-permessi">
              <div role="row" className="contents">
                <span role="columnheader" />
                <span role="columnheader" className="sg-etichetta">ISTRUTTORE</span>
                <span role="columnheader" className="sg-etichetta">SEGRETERIA</span>
              </div>
              {PERMESSI.map(([cosa, i]) => (
                <div key={cosa} role="row" className="contents">
                  <span role="cell" style={{ fontSize: 14, color: 'var(--sec)' }}>{cosa}</span>
                  <span role="cell" className="num" style={{ fontWeight: 700, color: i === 'SÌ' ? 'var(--text)' : 'var(--dim)' }}>{i}</span>
                  <span role="cell" className="num" style={{ fontWeight: 700 }}>SÌ</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <form aria-label="Aggiungi una persona" className="sg-scheda sg-scheda-stretta" onSubmit={aggiungi}>
          <span className="ob" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.04em' }}>AGGIUNGI UNA PERSONA</span>
          <div className="sg-due">
            <div className="stack" style={{ gap: 6 }}>
              <label htmlFor="inv-nome" className="sg-etichetta">NOME</label>
              <input id="inv-nome" className="sg-campo" required value={bozza.nome} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} />
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <label htmlFor="inv-cognome" className="sg-etichetta">COGNOME</label>
              <input id="inv-cognome" className="sg-campo" required value={bozza.cognome} onChange={(e) => setBozza({ ...bozza, cognome: e.target.value })} />
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <label htmlFor="inv-email" className="sg-etichetta">EMAIL</label>
            <input id="inv-email" className="sg-campo" type="email" required placeholder="nome@esempio.it" value={bozza.email} onChange={(e) => setBozza({ ...bozza, email: e.target.value })} />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="sg-etichetta">RUOLO</span>
            <div role="radiogroup" aria-label="Ruolo" className="sg-due">
              {(
                [
                  ['istruttore', 'ISTRUTTORE'],
                  ['staff', 'SEGRETERIA'],
                ] as const
              ).map(([r, testo]) => (
                <button key={r} type="button" role="radio" aria-checked={bozza.ruolo === r} className="sg-btn sg-scelta" onClick={() => setBozza({ ...bozza, ruolo: r })}>
                  {testo}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="sg-btn sg-btn-rosso">
            AGGIUNGI
          </button>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            {d.modo === 'prova'
              ? 'In prova l’account non serve: la persona compare subito negli istruttori dei corsi.'
              : 'Poi chi ha le chiavi di Supabase crea il suo account in Authentication → Users, con la stessa email e una password: al primo accesso si lega da solo. Se la persona è già in elenco come iscritta, diventa istruttore invece di un doppione.'}
          </span>
        </form>
      </div>
      {avviso}
    </>
  )
}
