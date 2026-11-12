import { oraDi, perEsteso, type Persona } from '../lib/sala'

/**
 * Chi è già presente a un altro turno dello stesso corso e giorno (`turni.ts`):
 * fuori dalle liste e dai conti, qui in sola lettura con l'ora di quel turno.
 * Lo stesso nell'appello dell'istruttore e in quello della segreteria.
 */
export function GiaPresenti({ chi, className }: { chi: ReadonlyArray<Persona & { inizio: string }>; className: string }) {
  return (
    <div className={className}>
      {chi.map((p) => (
        <div key={p.id} className="riga-appello" data-stato="altrove">
          <span className="segno" aria-hidden="true">✓</span>
          <span className="nome-appello grow">{perEsteso(p)}</span>
          <span className="appello-altrove">GIÀ PRESENTE ALLE {oraDi(p.inizio)}</span>
        </div>
      ))}
    </div>
  )
}
