/**
 * Nomi e cognomi come si scrivono: la prima lettera di ogni parola maiuscola,
 * il resto minuscolo, gli spazi in più via. «MARIA GRAZIA» e «maria grazia»
 * diventano «Maria Grazia», «d'amico» «D'Amico», «rossi-bianchi»
 * «Rossi-Bianchi». Il database fa lo stesso da sé (`nome_proprio` in
 * `supabase/20-nomi.sql`), così prova e database scrivono uguale.
 */
export function nomeProprio(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('it')
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, prima: string, lettera: string) => prima + lettera.toLocaleUpperCase('it'))
}
