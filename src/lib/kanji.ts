/**
 * Il kanji di un istruttore: un segno solo, scelto dalla segreteria, che lo
 * fa riconoscere a colpo d'occhio, come un piccolo logo, accanto al nome nel
 * calendario, nell'appello e nell'elenco del personale.
 *
 * Due istruttori non possono avere lo stesso kanji, sennò non servirebbe a
 * distinguerli: lo dice anche il database (`24-kanji.sql`).
 */

/** Quelli da scegliere con un tocco, ciascuno col suo significato. */
export const KANJI: Array<{ segno: string; vuol_dire: string }> = [
  { segno: '山', vuol_dire: 'montagna' },
  { segno: '火', vuol_dire: 'fuoco' },
  { segno: '水', vuol_dire: 'acqua' },
  { segno: '風', vuol_dire: 'vento' },
  { segno: '雷', vuol_dire: 'tuono' },
  { segno: '石', vuol_dire: 'pietra' },
  { segno: '鉄', vuol_dire: 'ferro' },
  { segno: '波', vuol_dire: 'onda' },
  { segno: '森', vuol_dire: 'foresta' },
  { segno: '桜', vuol_dire: 'ciliegio' },
  { segno: '日', vuol_dire: 'sole' },
  { segno: '月', vuol_dire: 'luna' },
  { segno: '星', vuol_dire: 'stella' },
  { segno: '光', vuol_dire: 'luce' },
  { segno: '龍', vuol_dire: 'drago' },
  { segno: '虎', vuol_dire: 'tigre' },
  { segno: '鷹', vuol_dire: 'falco' },
  { segno: '狼', vuol_dire: 'lupo' },
  { segno: '力', vuol_dire: 'forza' },
  { segno: '速', vuol_dire: 'velocità' },
  { segno: '勇', vuol_dire: 'coraggio' },
  { segno: '忍', vuol_dire: 'perseveranza' },
  { segno: '静', vuol_dire: 'calma' },
  { segno: '心', vuol_dire: 'cuore' },
  { segno: '気', vuol_dire: 'energia' },
  { segno: '道', vuol_dire: 'la via' },
  { segno: '武', vuol_dire: 'arte marziale' },
  { segno: '拳', vuol_dire: 'pugno' },
  { segno: '剣', vuol_dire: 'spada' },
  { segno: '誠', vuol_dire: 'sincerità' },
]

/** Un ideogramma solo, CJK: come il vincolo di `24-kanji.sql`. */
export const eKanji = (s: string) => /^[㐀-䶿一-鿿豈-﫿]$/u.test(s)

/** Il segno scritto a mano, ripulito: `null` se non è un kanji solo. */
export function kanjiScritto(s: string): string | null {
  const x = s.trim()
  return eKanji(x) ? x : null
}

/** Cosa vuol dire, se è uno di quelli della lista. */
export const significato = (segno: string) => KANJI.find((k) => k.segno === segno)?.vuol_dire
