import sanitizeHtml from 'sanitize-html'

/**
 * Il testo delle pagine del sito, ripulito.
 *
 * Il testo esce da un editor e finisce su un sito pubblico: chi lo apre non
 * deve mai eseguire codice scritto in una pagina. Si ammette solo quello che
 * l'editor sa fare (titoli, paragrafi, grassetto, corsivo, elenchi, citazione,
 * link, immagine, pulsante); tutto il resto sparisce, contenuto degli
 * script compreso. Si pulisce due volte: quando la segreteria salva, e quando
 * il sito si genera (lì è quella di cui ci si fida, perché chi scrive
 * all'API salta il pannello). Il database ne rifiuta una versione più rozza:
 * `sito_testo_sicuro` in `supabase/56-sito.sql`.
 */

/** I link che la pagina ammette: assoluti sicuri, oppure interni che cominciano con una sola «/». */
const LINK_ASSOLUTO = /^(https?:|mailto:|tel:)/i
export const LINK_INTERNO = /^\/(?![/\\])/

/** Le sole classi di un `div`: le colonne affiancate della pagina a pezzi (`sitoPezzi.ts`). */
const CLASSI_COLONNE = ['colonne', 'c-2', 'c-3', 'colonna']

const OPZIONI: sanitizeHtml.IOptions = {
  allowedTags: ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'br', 'div'],
  allowedAttributes: { a: ['href', 'rel', 'target', 'class'], img: ['src', 'alt'], div: ['class'] },
  allowedClasses: { a: ['pulsante'], div: [...CLASSI_COLONNE] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (nome, attributi) => {
      // Gli attributi arrivano già senza entità: «jav&#x61;script:» è «javascript:».
      const dato = (attributi.href ?? '').trim()
      const { href: _vecchio, rel: _rel, target, ...resto } = attributi
      if (LINK_INTERNO.test(dato)) return { tagName: nome, attribs: { ...resto, href: dato } }
      if (!LINK_ASSOLUTO.test(dato)) return { tagName: nome, attribs: resto }
      return {
        tagName: nome,
        attribs: { ...resto, href: dato, rel: 'noopener noreferrer', ...(target === '_blank' ? { target } : {}) },
      }
    },
    img: (nome, attributi) => {
      // Un'immagine è del sito o di un altro sito sicuro, mai di una pagina «//» o senza protocollo.
      const src = (attributi.src ?? '').trim()
      const { src: _src, ...resto } = attributi
      return { tagName: nome, attribs: /^https?:/i.test(src) || LINK_INTERNO.test(src) ? { ...resto, src } : resto }
    },
  },
}

/**
 * Toglie i `div` che non sono colonne, e le loro chiusure, tenendo il contenuto.
 * Lo fa prima di `sanitizeHtml`: rinominare un tag ammesso in uno no, dentro la libreria, lascia una chiusura orfana.
 */
function senzaDivEstranei(html: string): string {
  const tenuti: boolean[] = []
  return html.replace(/<(\/?)div\b([^>]*)>/gi, (tag, chiude: string, resto: string) => {
    if (chiude) return tenuti.pop() ? tag : ''
    const classi = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(resto)
    const tiene = (classi?.[1] ?? classi?.[2] ?? '').split(/\s+/).some((c) => c === 'colonne' || c === 'colonna')
    tenuti.push(tiene)
    return tiene ? tag : ''
  })
}

/**
 * Toglie i `<p>` che fanno da solo contenuto di una voce d'elenco (più `<p>`: a capo fra l'uno e l'altro).
 * L'editor salva `<li><p>…</p></li>`; il layout legge le voci come `<li><strong>…`, e col `<p>` in mezzo
 * numeri, fasce e dati restavano un elenco semplice. Lo si fa dopo `sanitizeHtml`: lì i tag sono bilanciati e senza attributi.
 */
const senzaPNelleVoci = (html: string): string =>
  html.replace(/<li>((?:<p>(?:(?!<\/p>)[\s\S])*<\/p>)+)<\/li>/g, (_, voce: string) => `<li>${voce.slice(3, -4).replace(/<\/p><p>/g, '<br />')}</li>`)

/** Il testo con solo quel che il sito ammette. */
export function pulisciTesto(html: string): string {
  return senzaPNelleVoci(sanitizeHtml(senzaDivEstranei(html), OPZIONI))
}

/** Vero se il testo non ha niente da togliere: è già come lo vuole il sito. */
export function testoSicuro(html: string): boolean {
  return pulisciTesto(html) === html
}
