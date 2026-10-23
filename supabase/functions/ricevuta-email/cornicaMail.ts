// ---------------------------------------------------------------------------
// La cornice delle email in uscita: gli avvisi alla segreteria e la ricevuta
// alle famiglie hanno lo stesso aspetto. Il corpo lo compone chi manda la mail;
// qui c'è solo quel che sta intorno (testata, tasto, tabella, piè).
//
// Questo file ha una copia identica in supabase/functions/avvisi-segreteria/ e
// in supabase/functions/ricevuta-email/ (cornicaMail.ts): le funzioni girano su
// Deno, che src/lib non lo legge. Per questo qui non si importa niente;
// `npm run prova:cornice-mail` controlla che le copie siano uguali. Si cambia
// qui e si ricopia là.
//
// Le mail non sono pagine web: tabelle e stili inline, nessuno script, font,
// foglio di stile o immagine esterna, così si leggono anche senza immagini e
// nel tema scuro. I colori sono quelli di src/styles.css.
// ---------------------------------------------------------------------------

const FILO = '#cfe6f4'
const INCHIOSTRO = '#0d2a3d'
const DIM = '#46606f'
const FONDO = '#eef5fa'
const FONT = "Inter,'Helvetica Neue',Helvetica,Arial,sans-serif"

/** Il testo semplice diventa HTML: chi passa un corpo lo converte da sé, la cornice non lo riconverte. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Un tasto vero (una cella colorata dentro una tabella) e, sotto, l'indirizzo scritto in piccolo. */
export function tastoMail(etichetta: string, link: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 0"><tbody><tr>` +
    `<td style="background:${INCHIOSTRO};border-radius:6px;padding:12px 18px"><a href="${esc(link)}" style="color:#ffffff;font-weight:600;text-decoration:none">${esc(etichetta)}</a></td>` +
    `</tr></tbody></table>\n` +
    `<p style="margin:10px 0 0;font-size:12px;line-height:1.4;color:${DIM};word-break:break-all"><span>${esc(link)}</span></p>`
  )
}

/** Righe etichetta/valore; i valori li converte la tabella. */
export function tabellaMail(righe: [string, string][]): string {
  const ultima = righe.length - 1
  const riga = ([e, v]: [string, string], i: number) =>
    `<tr><td style="padding:10px 14px;color:${DIM};${i < ultima ? `border-bottom:2px solid ${FILO};` : ''}">${esc(e)}</td>` +
    `<td align="right" style="padding:10px 14px;font-weight:700;${i < ultima ? `border-bottom:2px solid ${FILO};` : ''}">${esc(v)}</td></tr>`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:2px solid ${FILO};border-radius:6px"><tbody>${righe.map(riga).join('')}</tbody></table>`
}

/** L'HTML della mail: `corpoHtml` è già convertito; `testata` e `piede` sono testo semplice. */
export function incorniciaMail(corpoHtml: string, c: { testata: string; piede: string }): string {
  return (
    `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(c.testata)}</title></head>` +
    `<body style="margin:0;padding:0;background:${FONDO};color:${INCHIOSTRO};font-family:${FONT}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FONDO}"><tbody><tr><td align="center" style="padding:20px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:2px solid ${FILO};border-radius:6px"><tbody>` +
    `<tr><td style="padding:12px 20px;border-bottom:2px solid ${FILO};font-size:12px;font-weight:700;letter-spacing:0.2em;color:${DIM}">${esc(c.testata)}</td></tr>` +
    `<tr><td style="padding:20px;font-size:15px;line-height:1.5;color:${INCHIOSTRO}">${corpoHtml}</td></tr>` +
    `<tr><td style="padding:12px 20px;border-top:2px solid ${FILO};font-size:12px;color:${DIM}">${esc(c.piede)}</td></tr>` +
    `</tbody></table></td></tr></tbody></table></body></html>`
  )
}
