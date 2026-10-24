// `@tiptap/react` ripubblica `@tiptap/core`, che non è fra le dipendenze dichiarate.
import { Node } from '@tiptap/react'
import Link from '@tiptap/extension-link'
import { indirizzoValido } from './sitoPagine'

/**
 * Le estensioni del campo di testo di Puck (tiptap) per quel che il sito ammette e Puck da solo non conosce:
 * tiptap butta via quel che non sa leggere, e alla prima lettera scritta una foto dentro un TESTO spariva
 * dalla pagina. Provate in `scripts/prova-sito-pezzi.mjs`.
 */

// Il pulsante è un link con la classe «pulsante» (l'unica che il sito ammette): il link di tiptap tiene già `class`.
// Niente target né rel da tiptap: `pulisciTesto` mette il rel giusto, e sul sito i link si aprono nella stessa scheda.
const LinkDelSito = Link.configure({ openOnClick: false, HTMLAttributes: { target: null, rel: null } })

// L'immagine è un blocco con indirizzo e testo alternativo, e nient'altro: è quello che il sito ammette (`sitoTesto.ts`).
// `alt=""` (solo decorativa) resta com'è, non sparisce; un'immagine che arriva senza `alt` si salva come decorativa.
const Immagine = Node.create({
  name: 'immagine',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'img[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', { src: HTMLAttributes.src, alt: HTMLAttributes.alt ?? '' }]
  },
})

/** Da dare al campo insieme a `link: false` nelle opzioni: al posto del link di Puck, quello senza target. */
export const ESTENSIONI_TESTO = [LinkDelSito, Immagine]

/** L'indirizzo scritto per un link o un pulsante: quello pulito, o cosa scrivere se il sito non lo ammette. */
export function indirizzoDelLink(scritto: string): { indirizzo: string } | { guaio: string } {
  const indirizzo = scritto.trim()
  // Il campo si apre col link di prima: chi scrive senza cancellarlo lo accoda, e l'indirizzo risultante sarebbe valido ma sbagliato.
  if (/^https?:\/\/.*https?:\/\//i.test(indirizzo)) return { guaio: 'Sembra due indirizzi uno dopo l’altro: cancella quello vecchio e scrivi solo il nuovo' }
  return indirizzoValido(indirizzo) ? { indirizzo } : { guaio: 'Scrivi un indirizzo che cominci con https://, mailto:, tel: oppure /, senza spazi' }
}
