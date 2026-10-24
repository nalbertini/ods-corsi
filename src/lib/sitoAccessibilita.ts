import type { PezziPagina } from './sitoPezzi'

/**
 * La Dichiarazione di accessibilità: parte come bozza con dei segnaposto, perché
 * dichiarare una conformità che nessuno ha verificato sarebbe falso. Il testo sta
 * anche in `supabase/107-sito-accessibilita.sql` (la prova li tiene uguali).
 */
export const TRACCIA_ACCESSIBILITA =
  '<h2>Quale sito riguarda</h2>' +
  '<p>Questa dichiarazione riguarda il sito pubblico di [DA COMPILARE: nome di chi gestisce la palestra], raggiungibile all’indirizzo www.officinedellosport.it. L’app per gli iscritti, la segreteria e gli istruttori non rientra in questa dichiarazione.</p>' +
  '<h2>Stato di conformità</h2>' +
  '<p>Regole di accessibilità WCAG 2.1 livello AA, come chiede la norma europea EN 301 549: [DA COMPILARE: stato di conformità, «conforme», «parzialmente conforme» o «non conforme»; scrivilo solo dopo la verifica].</p>' +
  '<h2>Contenuti non accessibili</h2>' +
  '<p>[DA COMPILARE: contenuti non accessibili e perché, oppure «nessuno noto»; per ognuno scrivi quando sarà sistemato].</p>' +
  '<h2>Come e quando è stato verificato</h2>' +
  '<p>Data di redazione di questa dichiarazione: [DA COMPILARE: data, ad esempio 3 novembre 2026]. Data dell’ultima verifica: [DA COMPILARE: data, ad esempio 3 novembre 2026]. Metodo: [DA COMPILARE: metodo usato, ad esempio prova da tastiera, lettore di schermo e controllo automatico, e chi l’ha fatta].</p>' +
  '<h2>Segnalare un problema</h2>' +
  '<p>Se trovi qualcosa che non riesci a usare, scrivici: [DA COMPILARE: contatto per le segnalazioni, un indirizzo email o un telefono a cui risponde davvero qualcuno]. Rispondiamo entro [DA COMPILARE: numero di giorni, ad esempio 30].</p>' +
  '<h2>Se la risposta non basta</h2>' +
  '<p>Se non ricevi risposta, o la risposta non ti soddisfa, puoi segnalarlo all’Agenzia per l’Italia Digitale (AgID) dal modulo che trovi su www.agid.gov.it.</p>'

/**
 * Quanti `[DA COMPILARE …]` restano in un testo o nei pezzi di una pagina. I tag si
 * ignorano: un grassetto in mezzo al segnaposto non lo nasconde.
 */
export function segnapostoRimasti(testo: string | Pick<PezziPagina, 'content'>): number {
  const piatto = (typeof testo === 'string' ? testo : JSON.stringify(testo.content)).replace(/<[^>]*>/g, '')
  return piatto.match(/\[\s*da\s+compilare/gi)?.length ?? 0
}
