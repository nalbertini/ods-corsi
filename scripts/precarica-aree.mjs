// Quali file scaricare subito, in parallelo col codice principale, quando si
// apre una pagina d'area. Senza, il browser scopre il pezzo dell'area solo
// dopo aver eseguito index-*.js e poi, a cascata, i suoi sotto-pezzi.

// Il modulo che ogni area carica per primo (vedi i `lazy()` di src/App.tsx).
export const PRIMO_PEZZO = {
  segreteria: 'src/components/segreteria/Segreteria.tsx',
  amministrazione: 'src/components/segreteria/Segreteria.tsx',
  iscrizioni: 'src/components/IscrizioniScreen.tsx',
}

/** I file (nomi del bundle) da precaricare per `area`: il suo pezzo e quel che importa subito, non il codice principale. */
export function daPrecaricare(bundle, area) {
  const primo = PRIMO_PEZZO[area]
  const pezzi = Object.values(bundle).filter((c) => c.type === 'chunk')
  const radice = pezzi.find((c) => primo && c.moduleIds?.some((m) => m.replace(/\\/g, '/').endsWith(primo)))
  if (!radice) return []
  // Quel che il codice principale già scarica non si ripete.
  const gia = new Set()
  const segna = (nome) => {
    if (gia.has(nome)) return
    gia.add(nome)
    bundle[nome]?.imports?.forEach(segna)
  }
  pezzi.filter((c) => c.isEntry).forEach((c) => segna(c.fileName))
  const visti = new Set()
  const visita = (nome) => {
    if (visti.has(nome) || gia.has(nome)) return
    visti.add(nome)
    bundle[nome]?.imports?.forEach(visita)
  }
  visita(radice.fileName)
  return [...visti]
}

/** Aggiunge i `modulepreload` alla pagina d'area. */
export function conPrecarica(html, file) {
  const link = file.map((f) => `<link rel="modulepreload" crossorigin href="./${f}">`).join('\n    ')
  return file.length ? html.replace('</head>', `    ${link}\n  </head>`) : html
}
