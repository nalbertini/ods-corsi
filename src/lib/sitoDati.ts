import { CONTATTI, chiama } from './sito'

/**
 * I dati strutturati (JSON-LD) delle pagine del sito pubblico.
 *
 * Servono a Google e agli assistenti AI per sapere chi siamo, dove, quali
 * corsi teniamo e che domande ci fanno. Niente qui è inventato: sede e recapiti
 * vengono da `CONTATTI`, i corsi sono le pagine a cui rimanda la pagina «corsi»,
 * le domande sono i titoli che finiscono con «?» (quelli che il sito già mostra
 * come domande frequenti). Orari di apertura e coordinate non ci sono: si
 * aggiungono quando qualcuno li decide.
 *
 * È un dato, non codice: l'unico `<script>` del sito è questo blocco. Per non
 * lasciarlo uscire (un titolo con «</script>») ogni `<`, `>` e `&` del JSON
 * diventa `\uXXXX`, che chi lo legge rimette com'era.
 */

export interface DatiPagina {
  /** Con lo schema e senza «/» in fondo. */
  dominio: string
  nome: string
  slug: string
  titolo: string
  descrizione: string
  /** Il testo già ripulito (HTML ammesso dall'editor). */
  testo: string
  /** Il titolo della pagina «corsi», se esiste. */
  titoloCorsi?: string
  /** La pagina è uno dei corsi elencati in «corsi». */
  eUnCorso: boolean
}

/** L'indirizzo per intero: Google vuole via, CAP e provincia, mentre `CONTATTI.indirizzo` è la forma breve che si legge in pagina. Sta qui perché il pannello (`sito.ts`) non si tocca per il sito. */
const POSTALE = { via: 'Via Vittorio Sassi 26', cap: '10093', comune: 'Collegno', provincia: 'TO' }

/** Pagine a cui «corsi» rimanda che non sono corsi. */
const NON_CORSI = new Set(['home', 'corsi', 'contatti'])

/** Gli slug dei corsi: i link interni del testo della pagina «corsi» che portano a una pagina del sito che non è di legge. */
export function corsiDa(testoCorsi: string, slugs: Set<string>, diLegge: Set<string>): Set<string> {
  const trovati = [...testoCorsi.matchAll(/href="\/([a-z0-9-]+)\/"/g)].map((m) => m[1])
  return new Set(trovati.filter((s) => slugs.has(s) && !NON_CORSI.has(s) && !diLegge.has(s)))
}

const ENTITA: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

/** Il testo senza tag: i blocchi si separano con uno spazio, il resto (grassetto, link) si incolla. */
const testoSemplice = (h: string): string =>
  h
    .replace(/<\/(p|li|h[1-6]|blockquote|ul|ol)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITA[e])
    .replace(/\s+/g, ' ')
    .trim()

/** Le domande e risposte: ogni `h3` che finisce con «?», con quel che lo segue fino al titolo dopo (di qualsiasi livello: una sezione che segue non finisce nella risposta). */
function domande(testo: string): Array<{ domanda: string; risposta: string }> {
  const titoli = [...testo.matchAll(/<(h[2-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)]
  return titoli.flatMap((t, i) => {
    const domanda = testoSemplice(t[2])
    if (t[1].toLowerCase() !== 'h3' || !domanda.endsWith('?')) return []
    const risposta = testoSemplice(testo.slice((t.index ?? 0) + t[0].length, titoli[i + 1]?.index ?? testo.length))
    return risposta ? [{ domanda, risposta }] : []
  })
}

const sicuro = (o: unknown): string => JSON.stringify(o).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)

/** Il blocco `<script type="application/ld+json">` della pagina, o niente se non c'è nulla da dire. */
export function datiStrutturati(p: DatiPagina): string {
  const radice = `${p.dominio}/`
  const sede = { '@id': `${p.dominio}/#sede` }
  const nodi: object[] = []

  if (p.slug === 'home' || p.slug === 'contatti') {
    nodi.push({
      '@type': 'SportsActivityLocation',
      ...sede,
      name: p.nome,
      url: radice,
      ...(p.slug === 'home' && p.descrizione ? { description: p.descrizione } : {}),
      logo: `${p.dominio}/risorse/logo.webp`,
      telephone: chiama.replace(/^tel:/, ''),
      address: {
        '@type': 'PostalAddress',
        streetAddress: POSTALE.via,
        postalCode: POSTALE.cap,
        addressLocality: POSTALE.comune,
        addressRegion: POSTALE.provincia,
        addressCountry: 'IT',
      },
      sameAs: [CONTATTI.instagram, CONTATTI.facebook],
    })
  }

  if (p.slug !== 'home') {
    const url = `${p.dominio}/${p.slug}/`
    const passi: Array<[string, string]> = [[p.nome, radice]]
    if (p.eUnCorso && p.titoloCorsi) passi.push([p.titoloCorsi, `${p.dominio}/corsi/`])
    passi.push([p.titolo, url])
    nodi.push({
      '@type': 'BreadcrumbList',
      itemListElement: passi.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
    })
    if (p.eUnCorso) nodi.push({ '@type': 'Course', name: p.titolo, ...(p.descrizione ? { description: p.descrizione } : {}), url, provider: { '@type': 'Organization', name: p.nome, url: radice } })
  }

  const qa = domande(p.testo)
  if (qa.length) {
    nodi.push({
      '@type': 'FAQPage',
      mainEntity: qa.map((x) => ({ '@type': 'Question', name: x.domanda, acceptedAnswer: { '@type': 'Answer', text: x.risposta } })),
    })
  }

  return nodi.length ? `<script type="application/ld+json">${sicuro({ '@context': 'https://schema.org', '@graph': nodi })}</script>` : ''
}
