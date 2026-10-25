import type { ReactNode } from 'react'
import { ICONE, TRATTO, TRATTO_TABLET, type NomeIcona } from '../lib/icone'

type P = { size?: number }
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: TRATTO,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

/**
 * Un'icona dell'elenco unico (lib/icone, come Icona.dc.html della libreria). Accanto a una parola è
 * aria-hidden; da sola dice cosa fa con `etichetta`.
 */
export function Icona({ nome, misura = 18, tratto = TRATTO, etichetta }: { nome: NomeIcona; misura?: number; tratto?: number; etichetta?: string }) {
  return (
    <svg {...base(misura)} strokeWidth={tratto} style={{ flex: 'none' }} {...(etichetta ? { role: 'img', 'aria-label': etichetta } : { 'aria-hidden': true })}>
      {ICONE[nome].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

/**
 * I tracciati di un segno che l'elenco unico non ha (i loghi dei social, gli stati di una lezione),
 * disegnati come le altre icone: chi li usa tiene solo i dati, non un altro disegno a mano.
 */
export function Tracciati({ d, misura = 18, tratto = TRATTO, className }: { d: readonly string[]; misura?: number; tratto?: number; className?: string }) {
  return (
    <svg {...base(misura)} strokeWidth={tratto} className={className} style={{ flex: 'none' }} aria-hidden="true">
      {d.map((x) => <path key={x} d={x} />)}
    </svg>
  )
}

export const Back = ({ size = 18 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export const Recupero = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <polyline points="3 4 3 9 8 9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
)

export const Lucchetto = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export const Cronometro = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="13" r="8" />
    <polyline points="12 9 12 13 15 15" />
    <line x1="10" y1="2" x2="14" y2="2" />
  </svg>
)

/** Il tasto di accensione: ESCI DAL TABLET. */
export const Accensione = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M12 2v10" />
    <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
  </svg>
)

/** La nota: la musica. */
export const Nota = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)

export const Persone = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <circle cx="17" cy="9" r="2.8" />
    <path d="M17 14c2.8 0 4.8 2 4.8 5" />
  </svg>
)

// Spunta e croce grandi sono i segni del tablet, letti da un metro: lì il tratto di 1,75 sparisce.
const trattoSegno = (size: number) => (size >= 20 ? TRATTO_TABLET : TRATTO)

export const Spunta = ({ size = 24 }: P) => <Icona nome="conferma" misura={size} tratto={trattoSegno(size)} />

export const Torta = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M4 21h16" />
    <path d="M5 21v-7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v7" />
    <path d="M5 17c2.3 1.6 3.7 1.6 5.5 0s3.7-1.6 5.5 0c1 .9 2 1.2 3 .8" />
    <path d="M12 13V9.5" />
    <path d="M12 3.2c1 1.1 1.1 2.3 0 3.1-1.1-.8-1-2 0-3.1z" />
  </svg>
)

export const Croce = ({ size = 20 }: P) => <Icona nome="chiudi" misura={size} tratto={trattoSegno(size)} />

export const Sole = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const Luna = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

/** Il tatami visto dall'alto: due moduli affiancati, come la stuoia del dojo. */
export const Tatami = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" />
    <path d="M12 6v12M3 12h9" />
  </svg>
)

/** Le impostazioni: due cursori, non l'ingranaggio, che accanto al sole si confonde. */
export const Cursori = ({ size = 20 }: P) => (
  <svg {...base(size)} aria-hidden="true">
    <path d="M20 7h-9M14 17H4" />
    <circle cx="7" cy="7" r="3" />
    <circle cx="17" cy="17" r="3" />
  </svg>
)

/** Un'icona del menu, scritta qui perché la usano già i suoi posti; le nuove passano da `Icona`. */
const voce = (corpo: ReactNode) =>
  function IconaVoce({ size = 20 }: P) {
    return (
      <svg {...base(size)} aria-hidden="true" style={{ flex: 'none' }}>
        {corpo}
      </svg>
    )
  }

/** Le icone del menu della segreteria: una per voce, la chiave è la voce di GRUPPI_MENU. */
export const ICONE_MENU = {
  dafare: voce(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  richieste: voce(<><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></>),
  presenze: voce(<><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><polyline points="9 14 11 16 15 12" /></>),
  iscritti: voce(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  settimana: voce(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  corsi: voce(<><circle cx="12" cy="8" r="6" /><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1" /></>),
  gare: voce(<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />),
  listino: voce(<><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1" /></>),
  istruttori: voce(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  compensi: voce(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>),
  personale: voce(<><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3 21 2M16 7l3 3M14 9l2 2" /></>),
  statistiche: voce(<path d="M12 20V10M18 20V4M6 20v-4" />),
  vestiario: voce(<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.4-2.2z" />),
  segnalazioni: voce(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></>),
  sito: voce(<><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>),
  contabilita: voce(<path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />),
  importazioni: voce(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />),
  areaIstruttori: voce(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>),
  link: voce(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>),
}

/** Le icone dei risultati della ricerca: una per tipo, la chiave è il `TipoRisultato` di lib/ricerca. */
export const ICONE_RISULTATO = {
  iscritti: ICONE_MENU.areaIstruttori,
  richieste: ICONE_MENU.richieste,
  corsi: ICONE_MENU.corsi,
  istruttori: ICONE_MENU.personale,
}

/** Le icone delle casse e delle voci in CONTABILITÀ: la chiave è quella di `iconaCassa`/`iconaVoce` (lib/contabilita). */
export const ICONE_CONTI = {
  banca: voce(<><path d="M3 10 12 4l9 6" /><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18" /></>),
  banconota: voce(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></>),
  telefono: voce(<><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>),
  tessera: voce(<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16a3 3 0 0 1 6 0M15 10h3M15 14h3" /></>),
  persone: voce(<><circle cx="9" cy="7" r="3" /><path d="M3 21v-2a5 5 0 0 1 10 0v2" /><circle cx="17" cy="9" r="2.5" /><path d="M15 21v-1.5a4 4 0 0 1 6-3.4" /></>),
  lampadina: voce(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>),
  manubrio: voce(<><path d="M6 12h12" /><rect x="3" y="8" width="3" height="8" rx="1" /><rect x="18" y="8" width="3" height="8" rx="1" /></>),
  casa: voce(<><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><rect x="10" y="14" width="4" height="6" /></>),
  frecce: voce(<><polyline points="15 4 19 8 15 12" /><path d="M5 8h14" /><polyline points="9 20 5 16 9 12" /><path d="M19 16H5" /></>),
}

/** Le icone del tablet: sulle schede «Quali lezioni» dell'istruttore. Il testo accanto resta il nome. */
export const ICONE_TABLET = {
  oggi: voce(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><circle cx="12" cy="16" r="1.5" /></>),
  corso: ICONE_MENU.corsi,
}

/** Le icone delle linguette delle barre a schede della segreteria (Contabilità, il corso, Presenze): le stesse del menu e dei conti. */
export const ICONE_SCHEDE = {
  movimenti: ICONE_CONTI.frecce,
  bilancio: ICONE_MENU.statistiche,
  voci: ICONE_MENU.listino,
  casse: ICONE_CONTI.banconota,
  dati: ICONE_MENU.compensi,
  iscritti: ICONE_MENU.iscritti,
  mese: ICONE_MENU.settimana,
  segnalate: ICONE_MENU.segnalazioni,
}

/** I segni dell'elenco ISCRITTI: il minorenne e la famiglia (il nucleo). */
export const ICONE_ISCRITTI = {
  bambino: voce(<><circle cx="12" cy="7" r="3" /><path d="M8 21v-3a4 4 0 0 1 8 0v3" /><path d="M6 13l2.5 1.5M18 13l-2.5 1.5" /></>),
  casa: ICONE_CONTI.casa,
}

/** Le icone delle schede di IMPOSTAZIONI: la chiave è l'`IdImpostazioni` di lib/schedeImpostazioni. */
export const ICONE_IMPOSTAZIONI = {
  stagione: ICONE_MENU.settimana,
  sale: voce(<><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M11 18h2" /></>),
  esercizi: ICONE_CONTI.manubrio,
  ricevute: voce(<><path d="M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z" /><path d="M9 8h6M9 12h6" /></>),
  avvisi: voce(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>),
  dati: voce(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>),
  importa: voce(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><path d="M12 15V3" /></>),
  computer: voce(<><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>),
}

/** Le icone delle linguette della scheda iscritto: la chiave è l'`IdScheda` di lib/schedaSezioni. */
export const ICONE_SCHEDA_ISCRITTO = {
  persona: ICONE_MENU.areaIstruttori,
  documenti: voce(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>),
  quota: ICONE_CONTI.banconota,
  corsi: ICONE_MENU.corsi,
}

/** Le icone delle schede di una persona del personale: la chiave è l'`IdSchedaPersonale` di lib/schedePersonale. */
export const ICONE_SCHEDA_PERSONALE = {
  persona: voce(<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0" />),
  accesso: voce(<path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z M8 11V8a4 4 0 0 1 8 0v3" />),
  dati: voce(<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6" />),
  presenze: voce(<path d="M8 3v4 M16 3v4 M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M4 9h16 M9 15l2 2 4-4" />),
}

/** Le icone davanti alle intestazioni di sezione della scheda di una persona del personale. */
export const ICONE_SEZIONE_PERSONALE = {
  ruolo: voce(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />),
  kanji: voce(<path d="M4 20l4-1 11-11-3-3L5 16z M14 6l3 3" />),
  accesso: ICONE_SCHEDA_PERSONALE.accesso,
  pin: voce(<path d="M5 5h.01 M12 5h.01 M19 5h.01 M5 12h.01 M12 12h.01 M19 12h.01 M5 19h.01 M12 19h.01 M19 19h.01" strokeWidth={3} />),
  dati: ICONE_SCHEDA_PERSONALE.dati,
  tariffe: voce(<path d="M17 7.5A6 6 0 1 0 17 16.5 M5 10h9 M5 14h9" />),
  lettera: voce(<path d="M4 6h16v12H4z M4 7l8 6 8-6" />),
  presenze: ICONE_SCHEDA_PERSONALE.presenze,
}
