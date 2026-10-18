// ---------------------------------------------------------------------------
// Il testo della Home rivista come lo scriverebbe la segreteria, seguendo la
// convenzione (solo h2, h3, p, strong, em, ul, ol, li, a.pulsante, img,
// blockquote, br). Le parole sono quelle vere di docs/proposte-home/testi/REPORT.md
// e di docs/design-canvas/home-miglioramenti/HomeProposta.dc.html.
//
// Lo usano prova-sito-home-nuova.mjs e prova-sito-home-aspetto.mjs.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'

export const P = 'https://abc.supabase.co/storage/v1/object/public/sito/'
export const ISCRIZIONE = 'https://app.officinedellosport.it/iscrizioni/'
export const DOMINIO = 'https://officinedellosport.it'
const img = (nome, alt) => `<img src="${P}${nome}" alt="${alt}" />`

export const DESCRIZIONE = 'Arti marziali e preparazione atletica a Collegno, dai 3 anni in su. Prova una settimana a 5 €.'

// Nomi finti nel formato dei file veri: i file reali si sostituiscono quando l'utente li carica.
export const FOTO = {
  gruppo: '18c88f1d-5cea-4284-b45a-cc8fabd1a645.jpg',
  judo: 'b3d1f0aa-1111-4a2b-8c3d-0123456789a1.jpg',
  lotta: 'b3d1f0aa-2222-4a2b-8c3d-0123456789a2.jpg',
  aikido: 'b3d1f0aa-3333-4a2b-8c3d-0123456789a3.jpg',
  sala: '1a03b6b2-3311-441f-b35d-bd7a8e2471cb.jpg',
  cubi: '40ae8db3-5d53-4075-a708-134f0cef6e81.jpg',
  istruttori: '814a717b-91a2-441c-b34c-ef376d4781c6.jpg',
}

const corso = (nome, href, foto, eta, testo, fasce) =>
  `<h3><a href="${href}">${nome}</a></h3>${foto ? img(foto, `Foto di ${nome}`) : ''}<p>${eta}</p><p>${testo}</p><p><em>${fasce}</em></p>`

// Il pulsante secondario è scritto PRIMA del primario: nel DOM deve comunque venire dopo.
export const INTRO = `<p><a class="pulsante" href="/contatti/">Scrivici</a> <a class="pulsante" href="${ISCRIZIONE}">Prova una settimana a 5 €</a></p>${img(FOTO.gruppo, 'I bambini del gruppo in posa sul tatami giallo con gli istruttori')}<ul><li><strong>35+</strong> anni di sport</li><li><strong>9</strong> attività</li><li><strong>300+</strong> atleti</li><li><strong>13</strong> tecnici</li></ul><h3>Il corso giusto, il gruppo giusto</h3><p>Professionisti dello sport, da oltre 35 anni accanto a bambini, ragazzi e adulti.</p><p>Armonia nel movimento, rispetto nelle relazioni, costanza nel tempo.</p>`

export const CORSI = `<h2>I nostri corsi</h2><p>Accompagniamo bambini, ragazzi e adulti in percorsi sportivi pensati per ogni età e livello, dove tecnica, benessere e relazione vanno nella stessa direzione.</p>${[
  corso('Judo', '/judo/', FOTO.judo, 'Dai 7 anni agli adulti', 'Tecnica, disciplina e rispetto per crescere sul tatami, dai primi passi fino alle gare.', 'Bambini · Adulti · Agonisti'),
  corso('Lotta', '/lotta/', FOTO.lotta, 'Dai 7 anni agli adulti', 'Gioco, movimento e rispetto per crescere insieme, dalla prima prova alla gara.', 'Bambini · Adulti · Agonisti'),
  corso('Aikido', '/aikido/', FOTO.aikido, 'Dai 7 anni agli adulti', 'Armonia, equilibrio e difesa, in una disciplina adatta anche a chi ha più anni.', 'Bambini · Adulti · Anziani'),
  corso('Pre pugilistica', '/pre-pugilistica/', '', 'Dai 18 anni', 'Primi passi nella boxe: tecnica e coordinazione, per imparare i colpi in sicurezza.', 'Adulti'),
  corso('Metodo Globale di Autodifesa', '/mga-metodo-globale-di-autodifesa/', '', 'Dai 15 anni', 'Autodifesa pratica e realistica, basata su situazioni reali, spiegata passo dopo passo.', 'Adulti'),
  corso('Preparazione atletica', '/preparazione-atletica/', FOTO.sala, 'Dai 14 anni', 'Allenamenti mirati per migliorare forza, resistenza, velocità e coordinazione, anche per chi gareggia.', 'Adulti · Anziani · Agonisti'),
  corso('Giocomotricità e psicomotricità', '/giocomotricita-e-psicomotricita/', FOTO.cubi, 'Da 3 a 5 anni', 'Percorsi motori per crescere giocando e migliorare coordinazione e fiducia in sé.', 'Bambini'),
  corso('Avviamento alle arti marziali', '/avviamento-alle-arti-marziali/', '', '5-6 anni', 'Si scoprono le discipline, per aiutare i più piccoli a trovare la propria strada.', 'Bambini'),
  corso('Sollevamento pesi', '/sollevamenti-pesi/', '', 'Dagli 11 anni', 'Un percorso per imparare e perfezionare il sollevamento pesi, dai ragazzi agli adulti.', 'Bambini · Adulti · Agonisti'),
].join('')}`

export const PERCHE = `<h2>Perché unirti a noi?</h2><p>Qui lo sport è un percorso condiviso, fatto di relazioni, rispetto e crescita continua. Che tu muova i primi passi o cerchi un posto solido dove allenarti, troverai il corso giusto e le persone giuste.</p><h3>La crescita viene prima del risultato</h3><p>Contano i progressi di ciascuno, a ogni età e livello. I risultati arrivano di conseguenza.</p><h3>Educazione sportiva, prima di tutto</h3><p>Rispetto per compagni, istruttori e avversari: è la prima cosa che si impara sul tatami.</p><h3>Un ambiente sicuro e stimolante</h3><p>Gruppi divisi per età e competenze, con istruttori che seguono ogni persona passo dopo passo.</p><h3>Attività agonistiche con svariati podi ogni anno</h3><p>Chi vuole gareggiare può farlo, e ogni anno i nostri atleti salgono sul podio.</p>`

// Estratti letterali (con «[…]» dove si salta) e testo intero: Serena e Rinaldo hanno il «Leggi tutto», Maria no.
export const ESTRATTO_SERENA = '[…] ottima per l’incremento della forza ed il mantenimento del tono muscolare. […] I muscoli di tutto il corpo, oltre a diventare più forti, saranno anche più elastici e reattivi, con un rafforzamento della schiena e di tutte le articolazioni.'
export const INTERO_SERENA = 'Dal punto di vista medico l’attività sportiva è un’attività sportivo-ricreativa ottima per l’incremento della forza ed il mantenimento del tono muscolare, inoltre prevede un allenamento misto di tipo aerobico ed anaerobico. I muscoli di tutto il corpo, oltre a diventare più forti, saranno anche più elastici e reattivi, con un rafforzamento della schiena e di tutte le articolazioni.'
export const ESTRATTO_MARIA = 'Facendo sport si migliora se stessi per essere utili agli altri. In allenamento non serve fingere, si è quello che si è, non serve voler sembrare più bravi degli altri; bisogna fare quello che si può con il massimo impegno.'
export const ESTRATTO_RINALDO = 'Il judo è una disciplina che allena la gran parte dei muscoli del corpo in maniera bilanciata […] Mantiene attiva la mente e il corpo ed è praticabile ad ogni livello (amatoriale, agonistico, per tenersi in forma) e ad ogni età.'
export const INTERO_RINALDO = 'Il judo è una disciplina che allena la gran parte dei muscoli del corpo in maniera bilanciata, mette in movimento in misura uguale la parte destra e sinistra del corpo, sviluppa delle catene cinetiche complesse migliorando la coordinazione generale. Mantiene attiva la mente e il corpo ed è praticabile ad ogni livello (amatoriale, agonistico, per tenersi in forma) e ad ogni età.'

export const CITAZIONI = `<h2>Lo sport secondo chi lo studia</h2><blockquote><p>${ESTRATTO_SERENA}</p><p>${INTERO_SERENA}</p><p><em>Serena - Stud. di Medicina</em></p></blockquote><blockquote><p>${ESTRATTO_MARIA}</p><p><em>Maria - Psicologa</em></p></blockquote><blockquote><p>${ESTRATTO_RINALDO}</p><p>${INTERO_RINALDO}</p><p><em>Rinaldo - Prof. di Ed. Fisica</em></p></blockquote>`

export const NICOLA = 'Una palestra come ce ne sono poche, la passione guida tutti quelli che la gestiscono e si respira aria di casa. Tutto qui è all’insegna di crescere insieme con lo sport.'
export const NANDO = 'La professionalità di Maurizio rende l’ambiente cordiale e amichevole è ideale x chi si avvicina alle arti marziali, e per chi già pratica con passione, la location è molto accogliente. L’offerta è vasta tra varie discipline'
export const IN_BREVE = [['Palestra ben attrezzata per sport di combattimento', 'Stefano G.'], ['Insegnanti molto preparati e posto molto accogliente.', 'Blorida K.'], ['Discretamente strutturato Persone gentili e ben preparate', 'Davide R.']]
export const RECENSIONI = `<h2>Cosa dicono di noi</h2><blockquote><p>${NICOLA}</p><p><em>Nicola A.</em></p></blockquote><blockquote><p>${NANDO}</p><p><em>Nando</em></p></blockquote><h3>In breve</h3><ul>${IN_BREVE.map(([f, n]) => `<li>${f} <em>${n}</em></li>`).join('')}</ul>`
// Le stesse recensioni senza «In breve»: carte normali.
export const RECENSIONI_SOLE = `<h2>Cosa dicono di noi</h2><blockquote><p>${NICOLA}</p><p><em>Nicola A.</em></p></blockquote><blockquote><p>${NANDO}</p><p><em>Nando</em></p></blockquote>`

export const DOMANDE = [
  ['Che tipo di associazione è Officine dello Sport?', 'Un’associazione sportiva dove il movimento è un percorso di crescita. Accogliamo bambini, ragazzi e adulti con corsi per età e livello, in un ambiente sicuro, seguito e progressivo.'],
  ['Va bene anche se non ho mai fatto sport?', 'Sì. Molti percorsi sono pensati per chi comincia. Gli istruttori ti guidano passo dopo passo, nel rispetto dei tuoi tempi, delle tue capacità e dei tuoi obiettivi.'],
  ['Posso provare prima di iscrivermi?', 'Sì: una settimana di prova a 5 €. In quei giorni provi tutte le discipline, conosci l’ambiente e gli istruttori e scegli quella che fa per te, senza impegno.'],
  ['Come mi iscrivo?', 'Scrivici sui nostri canali social, chiamaci o passa in sede. Ti aiutiamo a scegliere il corso più adatto e ti spieghiamo modalità, orari e disponibilità.'],
  ['I bambini sono divisi per età e livello?', 'Sì. I gruppi sono organizzati per fasce d’età e competenze: ogni bambino vive un’esperienza equilibrata, sicura e stimolante, in un gruppo adatto a lui.'],
]
export const FAQ = `<h2>Hai qualche domanda?</h2><p>Qui trovi le informazioni principali su corsi, iscrizioni e attività.</p>${DOMANDE.map(([d, r]) => `<h3>${d}</h3><p>${r}</p>`).join('')}`

export const CTA = (foto = true) => `<h2>Una settimana per scegliere.</h2><p>5 € e provi tutte le discipline. Ti aspettiamo in Via Vittorio Sassi 26, Collegno, vicino alla metro Fermi.</p><p><a class="pulsante" href="${ISCRIZIONE}">Prova una settimana a 5 €</a> <a class="pulsante" href="/contatti/">Scrivici</a></p>${foto ? img(FOTO.istruttori, 'Gli istruttori con la cintura nera in posa sul tatami') : ''}`

export const TESTO_NUOVO = INTRO + CORSI + PERCHE + CITAZIONI + RECENSIONI + FAQ + CTA()
/** Come sopra, senza i due paragrafi di pulsanti: la Home di oggi (nessun link all'iscrizione nell'introduzione). */
export const TESTO_SENZA_LINK = TESTO_NUOVO.replace(INTRO.match(/^<p>.*?<\/p>/)[0], '').replace(CTA().match(/<p><a class="pulsante".*?<\/p>/)[0], '')

export const MENU = [
  { dove: 'menu', ordine: 1, etichetta: 'Home', slug: 'home', indirizzo: null },
  { dove: 'menu', ordine: 2, etichetta: 'Corsi', slug: 'corsi', indirizzo: null },
  { dove: 'menu', ordine: 3, etichetta: 'Contatti', slug: 'contatti', indirizzo: null },
  { dove: 'footer', ordine: 1, etichetta: 'Privacy', slug: null, indirizzo: '/privacy/' },
]

const pag = (slug, titolo, testo, descrizione = 'd') => ({ slug, titolo, descrizione, testo })
const ALTRE = [pag('corsi', 'Corsi', '<h2>Tutti</h2><ul><li><strong><a href="/judo/">Judo</a></strong> Tecnica e rispetto</li><li><strong><a href="/lotta/">Lotta</a></strong> Gioco e movimento</li></ul>'), pag('contatti', 'Contatti', '<p>Scrivici.</p>')]

/** I dati di `generaSito` per una Home con questo testo, più Corsi e Contatti. */
export const dati = (testoHome, { conContatti = true, ospiti = [P] } = {}) => ({
  dominio: DOMINIO,
  pagine: [pag('home', 'Si cresce sul tatami.', testoHome, DESCRIZIONE), ...ALTRE.filter((p) => conContatti || p.slug !== 'contatti')],
  menu: MENU.filter((v) => conContatti || v.slug !== 'contatti'),
  rinvii: [],
  ospitiImmagini: ospiti,
})

/** La Home di prima (docs/sito/home.html, congelata in scripts/fixture-home-vecchia.html). */
export const OSPITE_VECCHIO = 'https://qfejpnkryrvjubcxvuco.supabase.co/storage/v1/object/public/sito/'
export const TESTO_VECCHIO = readFileSync(new URL('./fixture-home-vecchia.html', import.meta.url), 'utf8').replace(/^<!doctype html>\s*<meta charset="utf-8">\s*<title>[^<]*<\/title>\s*/i, '')
export const datiVecchi = () => dati(TESTO_VECCHIO, { ospiti: [OSPITE_VECCHIO] })
