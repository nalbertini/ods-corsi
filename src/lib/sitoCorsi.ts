/**
 * La pagina «I nostri corsi» (design A2, TatamiBlu-Corsi): la regola è in `sitoLayout.ts`, le misure e le icone sono qui.
 * Le misure sono quelle del design a 1440px e a 375px; docs/sito/corsi.md dice come si scrive il testo.
 */

/** Le fasce d'età con la loro icona (Phosphor, 256×256): la voce dell'elenco che ne porta il nome prende l'icona. */
const ICONE: Record<string, string> = {
  bambini: 'M92,140a12,12,0,1,1,12-12A12,12,0,0,1,92,140Zm72-24a12,12,0,1,0,12,12A12,12,0,0,0,164,116Zm-12.27,45.23a45,45,0,0,1-47.46,0,8,8,0,0,0-8.54,13.54,61,61,0,0,0,64.54,0,8,8,0,0,0-8.54-13.54ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88.11,88.11,0,0,0-84.09-87.91C120.32,56.38,120,71.88,120,72a8,8,0,0,0,16,0,8,8,0,0,1,16,0,24,24,0,0,1-48,0c0-.73.13-14.3,8.46-30.63A88,88,0,1,0,216,128Z',
  adulti: 'M128,80A32,32,0,1,0,96,48,32,32,0,0,0,128,80Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,128,32ZM230.86,132.12a8,8,0,0,1-11,2.74c-.35-.21-35.11-20.59-83.88-22.67V149l62,69.73a8,8,0,1,1-12,10.62L128,164,70,229.31a8,8,0,1,1-12-10.62L120,149V112.18c-49,2.08-83.52,22.46-83.88,22.68a8,8,0,1,1-8.23-13.72C29.6,120.11,70.45,96,128,96s98.4,24.11,100.12,25.14A8,8,0,0,1,230.86,132.12Z',
  agonisti: 'M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z',
  anziani: 'M128,80A32,32,0,1,0,96,48,32,32,0,0,0,128,80Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,128,32Zm96,72a8,8,0,0,1-8,8H136v26.72l51.15,21.93A8,8,0,0,1,192,168v48a8,8,0,0,1-16,0V173.28l-46.45-19.91L53.35,222a8,8,0,1,1-10.7-11.9L120,140.44V112H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,104Z',
}

/** Le fasce che hanno un'icona, per `sitoLayout.ts`. */
export const FASCE = Object.keys(ICONE)

/** Maschera da data-URI: l'icona prende il colore del testo. Il namespace è codificato: nel CSS del sito non c'è nessun indirizzo, e la prova lo controlla. */
const maschera = (d: string) => `url("data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox='0 0 256 256'%3E%3Cpath d='${d}'/%3E%3C/svg%3E")`

export const CSS_CORSI = `
.sezione.senza-titolo{padding-bottom:0}
.sezione.senza-titolo .colonna{max-width:900px;padding-bottom:22px}
.sezione.senza-titolo .colonna p{font-size:26px;line-height:1.35;font-weight:500}
.sezione .corsi .corso{min-height:400px}
.corsi .corso{position:relative;gap:0;justify-content:space-between;padding:22px 24px;font-size:17px;line-height:1.45}
.corsi .corso img{width:100%;height:170px;object-fit:cover}
.corsi .senza-foto::before{content:"";flex:none;height:170px}
.corsi .corso h3{display:flex;justify-content:space-between;align-items:flex-start;font-size:50px;line-height:.95}
.corsi .corso h3::after{content:"↗\uFE0E";flex:none;font-size:44px;line-height:1}
.corsi .corso h3 a{text-decoration-color:transparent}
.corsi .corso h3 a::after{content:"";position:absolute;inset:0;border-radius:6px}
.corsi .corso p{font-size:17px;line-height:1.45}
.corsi .corso p strong{display:block}
.corsi .corso .fasce{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding:0;list-style:none}
ul.fasce li{display:inline-flex;align-items:center;gap:6px;margin:0;padding:6px 12px 6px 8px;border-radius:999px;background:var(--chiara);color:var(--inchiostro);font-size:14px;font-weight:600;line-height:1}
ul.fasce li::before{content:"";flex:none;width:20px;height:20px;background:currentColor;-webkit-mask:var(--icona) center/contain no-repeat;mask:var(--icona) center/contain no-repeat}
${FASCE.map((f) => `.fasce .${f}{--icona:${maschera(ICONE[f])}}`).join('\n')}
.corsi + .fascia{height:620px;margin-top:96px}
.corsi + .fascia.due{grid-template-columns:1fr 420px}
.corsi + .fascia img{height:100%;aspect-ratio:auto}
@media (max-width:900px){
.tessere.corsi{gap:16px}
.sezione.senza-titolo .colonna{padding-bottom:14px}
.sezione.senza-titolo .colonna p{font-size:18px;line-height:1.4}
.sezione .corsi .corso{min-height:200px}
.corsi .corso{gap:12px;padding:20px;font-size:16px}
.corsi .corso img{height:150px}
.corsi .senza-foto::before{display:none}
.corsi .corso h3{font-size:38px}
.corsi .corso h3::after{font-size:36px}
.corsi .corso p{font-size:16px}
.corsi + .fascia{height:260px;margin-top:48px}
.corsi + .fascia.due{grid-template-columns:1fr}
.corsi + .fascia figure:nth-child(2){display:none}
}
`
