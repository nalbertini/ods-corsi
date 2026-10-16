import { perEsteso, type StatoPresenza } from './sala'

/**
 * L'appello della segreteria a tre tasti: DA SEGNARE, PRESENTI, ASSENTI.
 *
 * Il pannello mostra una lista sola, quella del tasto premuto. Qui sta tutto
 * quello che si decide senza schermo: chi finisce in quale lista, i conti, il
 * tasto con cui si apre, dove va il fuoco dopo un tocco, cosa si annuncia.
 * Le prove (chi viene a provare) restano fuori dalle tre liste: hanno la loro
 * sezione e non contano negli iscritti.
 */
export type Lista = 'da_segnare' | 'presenti' | 'assenti'

/** L'ordine dei tre tasti. */
export const LISTE: readonly Lista[] = ['da_segnare', 'presenti', 'assenti']

export interface RigaAppello {
  id: string
  nome: string
  cognome: string
  stato: StatoPresenza | null
  prova?: boolean
}

export type Azione = 'presente' | 'assente' | 'rimetti'

/** Un giustificato sta fra gli assenti: non c'è un quarto tasto, e il suo stato non si perde. */
export function listaDi(stato: StatoPresenza | null): Lista {
  return stato === null ? 'da_segnare' : stato === 'presente' ? 'presenti' : 'assenti'
}

/** Gli iscritti nelle tre liste, nell'ordine in cui arrivano: cognome e nome, mai quello dei tocchi. */
export function dividiElenco<R extends RigaAppello>(elenco: R[]): Record<Lista, R[]> {
  const liste: Record<Lista, R[]> = { da_segnare: [], presenti: [], assenti: [] }
  for (const r of elenco) if (!r.prova) liste[listaDi(r.stato)].push(r)
  return liste
}

export function contiListe(elenco: RigaAppello[]): Record<Lista, number> {
  const l = dividiElenco(elenco)
  return { da_segnare: l.da_segnare.length, presenti: l.presenti.length, assenti: l.assenti.length }
}

const NOME_LISTA: Record<Lista, string> = { da_segnare: 'DA SEGNARE', presenti: 'PRESENTI', assenti: 'ASSENTI' }

/** Il nome del tasto e della lista, uno solo per tutti e due. */
export const nomeLista = (lista: Lista): string => NOME_LISTA[lista]

export function titoloLista(lista: Lista, quanti: number): string {
  return `${nomeLista(lista)} ${quanti}`
}

/** Si apre su DA SEGNARE; se non manca nessuno, su chi c'è, e se non c'è nessuno, su chi manca. */
export function tastoIniziale(elenco: RigaAppello[]): Lista {
  const c = contiListe(elenco)
  return c.da_segnare > 0 ? 'da_segnare' : c.presenti > 0 ? 'presenti' : c.assenti > 0 ? 'assenti' : 'da_segnare'
}

export function messaggioVuoto(lista: Lista): string {
  return lista === 'da_segnare' ? 'Tutti segnati ✓' : lista === 'presenti' ? 'Nessun presente' : 'Nessun assente'
}

export function parolaDiStato(stato: StatoPresenza | null): string {
  return stato === 'presente' ? 'PRESENTE' : stato === 'assente' ? 'ASSENTE' : stato === 'giustificato' ? 'GIUSTIFICATO' : 'NON SEGNATO'
}

export function statoDaTocco(azione: Azione): StatoPresenza | null {
  return azione === 'rimetti' ? null : azione
}

/**
 * Lo stato di tutti dopo un tocco, e la riga che prende il posto di quella
 * mossa nella lista mostrata: la successiva, o la precedente se era l'ultima.
 * Il fuoco ci va subito, così chi segna in fila non perde il segno; `null` vuol dire che nessuna riga
 * prende il posto (la lista si è svuotata) e il fuoco torna al tasto premuto.
 */
export function dopoIlTocco<R extends RigaAppello>(
  elenco: R[],
  personaId: string,
  azione: Azione,
  lista: Lista,
): { elenco: R[]; prossimoFuoco: string | null } {
  const qui = dividiElenco(elenco)[lista]
  const i = qui.findIndex((r) => r.id === personaId)
  const prossimoFuoco = i < 0 ? null : (qui[i + 1] ?? qui[i - 1])?.id ?? null
  const stato = statoDaTocco(azione)
  return { elenco: elenco.map((r) => (r.id === personaId ? { ...r, stato } : r)), prossimoFuoco }
}

/** Togliere la giustificazione è l'unico tocco che cancella un'informazione fatta da qualcuno: prima si chiede. */
export function serveConferma(riga: RigaAppello, azione: Azione): boolean {
  return azione === 'rimetti' && riga.stato === 'giustificato'
}

/** Chi riceve TUTTI PRESENTI: solo chi non è segnato, le assenze già messe non si toccano. */
export function chiSegnaTuttiPresenti(elenco: RigaAppello[]): string[] {
  return elenco.filter((r) => r.stato === null).map((r) => r.id)
}

/**
 * TUTTI PRESENTI, scritto: una `segna` per ogni non segnato, mai `segnaTutti`, che sovrascriverebbe
 * le assenze già messe. Le scritture partono insieme e ognuna ha la sua voce in coda, per persona.
 */
export async function segnaNonSegnati(
  scrivi: { segna(sessioneId: string, personaId: string, stato: StatoPresenza | null): Promise<void> },
  sessioneId: string,
  elenco: RigaAppello[],
): Promise<void> {
  await Promise.all(chiSegnaTuttiPresenti(elenco).map((id) => scrivi.segna(sessioneId, id, 'presente')))
}

/** Per chi non vede lo schermo: cosa è successo e quanti ne restano. */
export function annuncio(riga: RigaAppello, azione: Azione, restano: number): string {
  const cosa = azione === 'rimetti' ? 'da segnare' : azione
  const resto = restano === 0 ? 'Tutti segnati.' : restano === 1 ? 'Resta 1 da segnare.' : `Restano ${restano} da segnare.`
  return `${perEsteso(riga)}: ${cosa}. ${resto}`
}
