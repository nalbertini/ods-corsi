/**
 * Il foglio di stile del timer, adattato a stare dentro un riquadro.
 *
 * Il timer è scritto per avere la pagina tutta per sé: `:root`, `body`, le
 * misure in `vh` e `vw`, le `@media` sulla finestra. Qui sta in un'ombra
 * (Shadow DOM), dove le sue classi non si scontrano con quelle di ODS Corsi —
 * `.btn`, `.card`, `.row` ci sono in tutte e due — e dove la pagina è il
 * riquadro: `:host` al posto di `:root` e `body`, le misure del riquadro
 * (`cqh`, `cqw`) al posto di quelle della finestra, e le `@media` sulle
 * misure che diventano `@container`. Quelle sulle preferenze
 * (`prefers-reduced-motion`) restano sulla finestra, dove hanno senso.
 *
 * Un riquadro più stretto di 560px conta come «in verticale» anche se è più
 * largo che alto, quando la regola non dice già una larghezza: sul telefono in
 * verticale, con YouTube sotto, il timer ha 375×360, ma non è un telefono
 * girato. Le due colonne di lato lì non ci stanno, e servono le regole per gli
 * schermi bassi in verticale.
 *
 * Le sostituzioni valgono sia sul file com'è scritto sia su quello
 * compresso della compilazione, che toglie spazi e virgolette.
 */
export function perLaSala(css: string): string {
  return (
    css
      .replace(/:root\[data-tema=(['"]?)chiaro\1\]/g, ':host([data-tema=chiaro])')
      .replace(/:root/g, ':host')
      // L'altezza della pagina: qui la dà il tablet, qualche riga più sotto.
      .replace(/html\s*,\s*body\s*,\s*#root\s*\{[^}]*\}/g, '')
      .replace(/(^|[}\s,;])body(\s*\{)/g, '$1:host$2')
      .replace(/(-?(?:\d+\.)?\d+)[dsl]?vh\b/g, '$1cqh')
      .replace(/(-?(?:\d+\.)?\d+)[dsl]?vw\b/g, '$1cqw')
      .replace(/@media([^{]*)\{/g, (tutto, q: string) => {
        if (!/(width|height|orientation|aspect-ratio)/.test(q) || /prefers-|hover|pointer|print|screen/.test(q)) return tutto
        // Senza una larghezza già detta, «di lato» e «in verticale» guardano anche quanto è largo il riquadro.
        const forma = /width/.test(q)
          ? q
          : q
              .replace(/\(orientation:\s*landscape\)/g, '((orientation: landscape) and (min-width: 560px))')
              .replace(/\(orientation:\s*portrait\)/g, '((orientation: portrait) or (max-width: 559px))')
        return `@container${forma}{`
      })
  )
}
