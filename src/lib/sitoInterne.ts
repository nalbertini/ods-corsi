/**
 * Testata, pagina, invito e piede delle pagine interne come nel design A2 (TatamiBlu-Corsi, -ChiSiamo, …: 1440px;
 * TatamiBluM-*: 375px). Le regole stanno qui, in coda al CSS del sito, così ognuna si legge accanto al suo numero del design.
 *
 * Due scelte dove il design e l'accessibilità non vanno d'accordo: il
 * piede tiene i titoli delle sue colonne, nascosti alla vista (non si vedono, quindi non c'è differenza). Sotto i 1280px il titolo grande non ha accanto la frase:
 * a 200px non ci starebbe, e le due colonne tornano una sopra l'altra come sul telefono.
 */
export const CSS_INTERNE = `
.testata{padding:22px var(--margine)}
.logo img{height:110px}
.testata nav ul{gap:10px}
.testata nav a{min-height:0;padding:9px 16px;line-height:normal}
.testata nav a[aria-current]{background:var(--giallo)}
.pulsante.piccolo{padding:0 26px}
.pagina-hero.interna{display:block;padding:40px var(--margine) 72px}
.interna h1{font-size:clamp(84px,13.9vw,200px);line-height:.82;margin:0 0 20px}
.interna .intro{display:block;max-width:none}
.interna .intro p{margin:0 0 28px;font-size:22px;line-height:1.45}
@media (min-width:1280px){
.pagina-hero.interna{display:grid;grid-template-columns:1fr 520px;gap:0 56px;align-items:end}
.interna .intro{display:contents}
.interna h1{grid-row:1 / span 2;grid-column:1;font-size:200px;margin:0}
.interna .intro p,.interna .intro>div{grid-column:2}
}
.invito{margin:96px var(--margine) 6px;min-height:300px;padding:36px 40px}
.invito .frase{max-width:520px;font-size:22px}
.invito .freccia{display:none}
.invito .parola{font-size:170px}
.piede{gap:40px;margin:0 var(--margine) 48px;padding:40px}
.piede .nome{font-size:56px}
.piede .col{font-size:16px;line-height:1.9}
.piede h2{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.piede .col ul{margin:0;padding:0;list-style:none}
.piede .col:first-of-type li:nth-child(n+3){display:inline}
.piede .col:first-of-type li:nth-child(4)::before{content:" · "}
@media (max-width:900px){
.testata{padding:12px var(--margine) 0;gap:10px 16px}
.logo img{height:82px}
.pulsante.piccolo{padding:0 22px}
.testata nav ul{gap:6px}
.testata nav a{min-height:44px;padding:0 14px;background:var(--chiara);font-size:16px}
.pulsante .piu{display:none}
.testata nav a[aria-current]{background:var(--giallo)}
.pagina-hero.interna{padding:20px var(--margine) 36px}
.interna h1{font-size:84px;line-height:.84}
.interna .intro p{margin:0 0 22px;font-size:18px}
.interna .intro .pulsante{min-height:52px;padding:0 26px;font-size:17px}
.invito{margin-top:48px;min-height:260px;padding:22px}
.invito .frase{font-size:17px}
.invito .parola{font-size:120px}
.piede{flex-direction:column;flex-wrap:nowrap;gap:0;margin:0 var(--margine) 24px;padding:24px}
.piede .nome{font-size:44px;margin-bottom:14px}
.piede .col+.col{margin-top:12px}
.piede .col+.col li{display:inline}
.piede .col+.col li+li::before{content:" · "}
.piede .col+.col+.col{opacity:.85}
}
`
