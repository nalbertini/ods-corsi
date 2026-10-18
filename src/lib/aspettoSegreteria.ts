import type { Area } from './aree'
import { riapplicaTema } from './tema'

/**
 * La segreteria e l'amministrazione hanno l'aspetto del sito della palestra
 * (blu e giallo, sempre chiaro), qualunque sia il tema scelto: le altre aree
 * (istruttori, tablet di sala, iscritti, timer) restano come sono. I colori e
 * i caratteri stanno in `styles.css` sotto `:root[data-look='sito']`; qui si
 * decide quando l'attributo c'è.
 *
 * Non è `data-modulo`: quello è del modulo di iscrizione e nasconde cose sue.
 */
export type Look = 'sito'

export function lookDellArea(area: Area): Look | null {
  return area === 'segreteria' || area === 'amministrazione' ? 'sito' : null
}

/**
 * Accende o spegne `data-look` su `<html>` secondo l'area, e solo se cambia
 * rifà il tema: con il look acceso `tema.ts` forza il chiaro e il colore della
 * barra del sito; spento rimette quelli scelti. Si chiama prima del primo
 * disegno e a ogni cambio di indirizzo (`#aree`, `#guida`).
 */
export function applicaLook(area: Area, doc: Document = document): void {
  const html = doc.documentElement
  const prima = html.dataset.look
  const look = lookDellArea(area)
  if (look) html.dataset.look = look
  else delete html.dataset.look
  if (prima !== (look ?? undefined)) riapplicaTema()
}
