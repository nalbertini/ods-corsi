import type { Posto, Voce } from './indirizzoSegreteria'
import { spunteDi } from './ruoli'

/**
 * Il menu di chi lavora in segreteria o in amministrazione: un menu solo, con le
 * voci delle autorizzazioni che ha la persona. Segreteria e amministrazione non sono
 * due aree ma due autorizzazioni: chi le ha tutte e due vede tutte le voci, in un
 * posto solo. I CONTI raccoglie PAGAMENTI e LISTINO, e CONTABILITÀ per chi ha
 * l'amministrazione. Un gruppo senza voci non c'è.
 *
 * Quel che la persona legge davvero lo decide il database (`55-amministrazione.sql`):
 * qui si sceglie cosa mostrare, non cosa è permesso.
 */

type Chi = { ruolo: string; ancheIstruttore?: boolean; ancheAmministrazione?: boolean }

export interface GruppoMenu {
  titolo: string
  /** Sul telefono più piccolo: sono cose da computer. */
  secondario?: boolean
  voci: Array<[Voce, string]>
}

/** Il menu in gruppi, da quello che si apre ogni giorno a quello che si tocca una volta a stagione. */
export function menuDi(chi: Chi): GruppoMenu[] {
  const spunte = spunteDi(chi)
  const segreteria = spunte.includes('segreteria')
  const amministrazione = spunte.includes('amministrazione')
  const conti: Array<[Voce, string]> = [...(amministrazione ? ([['contabilita', 'CONTABILITÀ']] as Array<[Voce, string]>) : []), ['pagamenti', 'PAGAMENTI'], ['listino', 'LISTINO']]
  const gruppi: GruppoMenu[] = segreteria
    ? [
        {
          titolo: 'OGNI GIORNO',
          voci: [
            ['dafare', 'DA FARE'],
            ['settimana', 'SETTIMANA'],
            ['richieste', 'RICHIESTE ONLINE'],
            ['presenze', 'PRESENZE'],
          ],
        },
        {
          titolo: 'PERSONE',
          voci: [
            ['iscritti', 'ISCRITTI'],
            ['tessere', 'TESSERE'],
            ['corsi', 'CORSI'],
          ],
        },
        { titolo: 'I CONTI', voci: conti },
        {
          titolo: 'ISTRUTTORI',
          voci: [
            ['istruttori', 'PRESENZE ISTRUTTORI'],
            ['personale', 'ISTRUTTORI E ACCESSI'],
          ],
        },
        {
          titolo: 'LA PALESTRA',
          secondario: true,
          voci: [
            ['statistiche', 'STATISTICHE'],
            ['vestiario', 'VESTIARIO'],
            ['esercizi', 'ESERCIZI'],
            ['segnalazioni', 'SEGNALAZIONI'],
            ['sito', 'SITO'],
          ],
        },
      ]
    : amministrazione
      ? [{ titolo: 'I CONTI', voci: conti }]
      : []
  return gruppi
}

/** Il titolo sotto «ODS CORSI» e sul tasto che porta qui: con tutte e due le autorizzazioni è uno solo, non due sezioni. */
export function titoloDelMenu(chi: Chi): string {
  const spunte = spunteDi(chi)
  if (spunte.includes('segreteria')) return spunte.includes('amministrazione') ? 'GESTIONE' : 'SEGRETERIA'
  return spunte.includes('amministrazione') ? 'AMMINISTRAZIONE' : 'SEGRETERIA'
}

/** Cosa si fa qui, detto a chi sceglie dove entrare. */
export function descrizioneDelMenu(chi: Chi): string {
  const spunte = spunteDi(chi)
  if (!spunte.includes('segreteria')) return 'I conti della palestra: contabilità, pagamenti e listino.'
  return `Corsi, iscritti, presenze e richieste, dal computer della reception${spunte.includes('amministrazione') ? ', e i conti: contabilità, pagamenti e listino' : ''}.`
}

/** Le voci del menu, in ordine. */
export const vociDelMenu = (chi: Chi): Voce[] => menuDi(chi).flatMap((g) => g.voci.map(([id]) => id))

/** La prima voce del menu: dove si atterra. `undefined` per chi non ha il menu. */
export const primaVoce = (chi: Chi): Voce | undefined => vociDelMenu(chi)[0]

/** La segreteria ha in più le impostazioni (che non sono nel menu) e, in prova, le presenze segnalate. */
export function vociConsentite(chi: Chi, { prova }: { prova: boolean }): Voce[] {
  const segreteria = spunteDi(chi).includes('segreteria')
  return [...vociDelMenu(chi), ...(segreteria ? (['regole'] as Voce[]) : []), ...(segreteria && prova ? (['segnalate'] as Voce[]) : [])]
}

/** Il posto, o la prima voce del menu se la voce non spetta: un indirizzo scritto a mano non apre quel che il menu non offre. */
export function postoConsentito(posto: Posto, chi: Chi, o: { prova: boolean }): Posto {
  if (vociConsentite(chi, o).includes(posto.voce)) return posto
  return { voce: primaVoce(chi) ?? 'dafare' }
}

/** PAGAMENTI mostra solo nomi e importi a chi ha solo l'amministrazione: le persone non le legge. */
export const pagamentiRidotti = (chi: Chi): boolean => !spunteDi(chi).includes('segreteria')

/** La pagina della guida di ogni voce: il tasto «?» apre quella della voce aperta. */
export function guidaDellaVoce(voce: Voce, chi: Chi): string {
  if (voce === 'contabilita') return 'amministrazione/contabilita'
  if (voce === 'pagamenti' && pagamentiRidotti(chi)) return 'amministrazione/pagamenti'
  return GUIDE[voce]
}

const GUIDE: Record<Exclude<Voce, 'contabilita'>, string> = {
  dafare: 'segreteria/da-fare',
  settimana: 'segreteria/settimana',
  corsi: 'segreteria/corsi',
  iscritti: 'segreteria/iscritti',
  tessere: 'segreteria/tessere',
  pagamenti: 'segreteria/pagamenti',
  richieste: 'segreteria/richieste',
  presenze: 'segreteria/presenze',
  segnalate: 'segreteria/presenze-segnalate',
  statistiche: 'segreteria/statistiche',
  istruttori: 'segreteria/presenze-istruttori',
  personale: 'segreteria/istruttori-e-accessi',
  esercizi: 'segreteria/esercizi',
  listino: 'segreteria/listino',
  vestiario: 'segreteria/vestiario',
  regole: 'segreteria/regole',
  segnalazioni: 'segreteria/segnalazioni',
  sito: 'segreteria/sito',
}
