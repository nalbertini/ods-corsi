/**
 * Il posto di Maurizio: le sue illustrazioni stanno sempre qui, mai sopra
 * cifre o comandi. Quella di stato (quando il timer è fermo o in recupero) e
 * quella della gag, quando si tradisce, prendono lo stesso posto, una alla volta.
 * Di fianco è lo spazio libero in mezzo alla colonna delle cifre; in verticale,
 * quello fra la scaletta e la barra.
 */
export function PostoMaurizio({
  className,
  stato,
  beccato,
}: {
  className: string
  /** L'illustrazione dello stato in corso, se ce n'è una da mostrare. */
  stato: string | null
  beccato: { src: string; frase: string } | null
}) {
  if (!beccato && !stato) return null
  return (
    <div className={`tf-maurizio ${className}`}>
      {beccato ? (
        <div className="beccato">
          <img src={beccato.src} alt="" />
          <span className="beccato-frase">{beccato.frase}</span>
        </div>
      ) : (
        <img className="tf-adesivo" src={stato ?? ''} alt="" />
      )}
    </div>
  )
}
