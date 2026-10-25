// L'insieme unico delle icone di ODS Corsi: a linea, 24x24, punte e giunture
// tonde, colore del testo. I tracciati sono gli stessi di
// docs/design-canvas/ods-design-system/Icona.dc.html (prova-icone li confronta):
// chi aggiunge un'icona la aggiunge lì e qui.

/** Il tratto di tutte le icone: accanto al testo non deve pesare. */
export const TRATTO = 1.75
/** Il tratto dei tasti grandi del tablet (40px): da un metro, sul tatami, 1,75 sparisce. */
export const TRATTO_TABLET = 2.5

/** Un cerchio come path, per tenere ogni icona una lista di tracciati. */
const C = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
/** Un rettangolo (con gli angoli tondi se `r`) come path. */
const R = (x: number, y: number, w: number, h: number, r = 0) =>
  r
    ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
    : `M${x} ${y}h${w}v${h}h${-w}z`

export const ICONE = {
  // Azioni
  aggiungi: ['M12 5v14M5 12h14'],
  salva: ['M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M7 3v5h8', R(7, 13, 10, 8)],
  modifica: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  elimina: ['M3 6h18', 'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2', 'M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14', 'M10 11v6M14 11v6'],
  annulla: ['M9 14 4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-4'],
  chiudi: ['M18 6 6 18M6 6l12 12'],
  conferma: ['M20 6 9 17l-5-5'],
  cerca: [C(11, 11, 7), 'M21 21l-4.3-4.3'],
  filtra: ['M22 3H2l8 9.5V19l4 2v-8.5z'],
  altro: ['M5 12h.01M12 12h.01M19 12h.01'],
  copia: [R(9, 9, 13, 13, 2), 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  stampa: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', R(6, 14, 12, 8)],
  scarica: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  carica: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  condividi: [C(18, 5, 3), C(6, 12, 3), C(18, 19, 3), 'M8.6 13.5l6.8 4M15.4 6.5l-6.8 4'],
  'apri fuori': ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  'sposta su': ['M12 19V5M5 12l7-7 7 7'],
  'sposta giu': ['M12 5v14M19 12l-7 7-7-7'],
  meno: ['M5 12h14'],
  'cancella cifra': ['M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M18 9l-6 6M12 9l6 6'],
  ingrandisci: ['M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'],
  esci: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  // Muoversi
  indietro: ['M15 18l-6-6 6-6'],
  avanti: ['M9 18l6-6-6-6'],
  'apri menu': ['M6 9l6 6 6-6'],
  ordina: ['M8 9l4-4 4 4', 'M16 15l-4 4-4-4'],
  crescente: ['M8 14l4-4 4 4'],
  decrescente: ['M8 10l4 4 4-4'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
  // Stati
  attenzione: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  info: [C(12, 12, 10), 'M12 16v-4', 'M12 8h.01'],
  'in attesa': [C(12, 12, 10), 'M12 6v6l4 2'],
  fatto: [C(12, 12, 10), 'M8 12l3 3 5-5'],
  manca: [C(12, 12, 10), 'M15 9l-6 6M9 9l6 6'],
  recupero: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
  accensione: ['M12 2v10', 'M18.4 6.6a9 9 0 1 1-12.8 0'],
  lucchetto: [R(3, 11, 18, 11, 2), 'M7 11V7a5 5 0 0 1 10 0v4'],
  vedi: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', C(12, 12, 3)],
  avvisi: ['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  // Persone
  persona: [C(12, 8, 4), 'M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1'],
  iscritti: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', C(9, 7, 4), 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  bambino: [C(12, 7, 3), 'M8 21v-3a4 4 0 0 1 8 0v3', 'M6 13l2.5 1.5M18 13l-2.5 1.5'],
  nucleo: ['M3 11 12 4l9 7', 'M5 10v10h14V10', R(10, 14, 4, 6)],
  istruttore: [C(7.5, 15.5, 4.5), 'M10.7 12.3 21 2M16 7l3 3M14 9l2 2'],
  firma: ['M3 17c3-1 4-6 6-6s1 6 3 6 3-4 5-4 2 2 4 2', 'M3 21h18'],
  // Palestra
  calendario: [R(3, 4, 18, 18, 2), 'M16 2v4M8 2v4M3 10h18'],
  oggi: [R(3, 4, 18, 18, 2), 'M16 2v4M8 2v4M3 10h18', C(12, 16, 1.5)],
  orario: [C(12, 12, 10), 'M12 6v6l4 2'],
  corso: [C(12, 8, 6), 'M15.5 12.9 17 22l-5-3-5 3 1.5-9.1'],
  gara: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z'],
  appello: ['M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', R(9, 3, 6, 4, 1), 'M9 14l2 2 4-4'],
  sala: [R(4, 2, 16, 20, 2), 'M11 18h2'],
  tatami: [R(3, 6, 18, 12), 'M12 6v12M3 12h9'],
  esercizi: ['M6 12h12', R(3, 8, 3, 8, 1), R(18, 8, 3, 8, 1)],
  vestiario: ['M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.4-2.2z'],
  cronometro: [C(12, 13, 8), 'M12 9v4l2 2', 'M10 2h4'],
  // Documenti e soldi
  certificato: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6M12 11v6M9 14h6'],
  documento: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6M9 13h6M9 17h4'],
  ricevuta: ['M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z', 'M9 8h6M9 12h6'],
  quota: [R(2, 6, 20, 12, 2), C(12, 12, 3), 'M6 12h.01M18 12h.01'],
  euro: ['M18 7c-1.2-1.3-3-2-5-2a7 7 0 0 0 0 14c2 0 3.8-.7 5-2', 'M4 10h9M4 14h9'],
  carta: [R(2, 5, 20, 14, 2), 'M2 10h20'],
  banca: ['M3 10 12 4l9 6', 'M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18'],
  tariffa: ['M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z', 'M7 7h.01'],
  tessera: [R(3, 5, 18, 14, 2), C(9, 11, 2), 'M6 16a3 3 0 0 1 6 0M15 10h3M15 14h3'],
  bilancio: ['M12 20V10M18 20V4M6 20v-4'],
  movimenti: ['M15 4l4 4-4 4', 'M5 8h14', 'M9 20l-4-4 4-4', 'M19 16H5'],
  // Contatti
  messaggio: ['M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5z'],
  email: [R(3, 5, 18, 14, 2), 'M3 7l9 6 9-6'],
  telefono: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z'],
  mappa: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z', C(12, 10, 3)],
  segnalazione: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  sito: [C(12, 12, 10), 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  // Timer e musica
  play: ['M7 4v16l13-8z'],
  pausa: ['M8 4v16M16 4v16'],
  ricomincia: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
  microfono: [R(9, 2, 6, 12, 3), 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  musica: ['M9 18V5l12-2v13', C(6, 18, 3), C(18, 16, 3)],
  volume: ['M11 5 6 9H2v6h4l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
  segnalibro: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  foto: ['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z', C(12, 13, 3.5)],
  // App
  impostazioni: ['M20 7h-9M14 17H4', C(7, 7, 3), C(17, 17, 3)],
  computer: [R(2, 3, 20, 14, 2), 'M8 21h8M12 17v4'],
  'dati sicuri': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  guida: [C(12, 12, 10), 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3', 'M12 17h.01'],
} satisfies Record<string, readonly string[]>

export type NomeIcona = keyof typeof ICONE

/** Le azioni che tornano in ogni pagina: solo loro hanno l'icona sul tasto. «Importa» prende la freccia che sale. */
const AZIONI: Record<string, NomeIcona> = {
  salva: 'salva',
  annulla: 'annulla',
  aggiungi: 'aggiungi',
  cerca: 'cerca',
  elimina: 'elimina',
  scarica: 'scarica',
  stampa: 'stampa',
  copia: 'copia',
  importa: 'carica',
  modifica: 'modifica',
  chiudi: 'chiudi',
}

/** Tasti che cominciano come un'azione ricorrente ma fanno un'altra cosa: la croce su «Chiudi la cassa» direbbe «esci». */
const NON_RICORRENTI = ['chiudi la cassa']

/**
 * L'icona del tasto dalla sua etichetta: decide il verbo con cui comincia.
 * `null` per tutti gli altri tasti (Prepara, Segna firmata, C'era…), che restano solo parola.
 */
export function iconaAzione(etichetta: string): NomeIcona | null {
  const testo = etichetta.trim().toLowerCase()
  if (NON_RICORRENTI.some((t) => testo.startsWith(t))) return null
  const verbo = testo.split(/[\s,.…]/)[0]
  return Object.hasOwn(AZIONI, verbo) ? AZIONI[verbo] : null
}

/** L'icona accanto all'intestazione che ordina: 1 crescente, -1 decrescente, 0 non ordinata. */
export function iconaVerso(verso: 1 | -1 | 0): NomeIcona {
  return verso === 1 ? 'crescente' : verso === -1 ? 'decrescente' : 'ordina'
}
