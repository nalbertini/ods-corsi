// ---------------------------------------------------------------------------
// L'import della Prima Nota del vecchio programma, senza browser.
//
//   node scripts/prova-importa-prima-nota.mjs
//
// Controlla `src/lib/importaPrimaNota.ts` su un testo inventato fatto come l'«Elenco Movimenti
// Prima Nota» del vecchio programma (PDF letto con pdftotext -layout): le righe, la causale che va
// a capo, i salti pagina, le righe senza cassa o a zero, l'importo lordo, le voci scelte dalla
// causale, i totali del piede. Niente nomi veri: il file vero non entra mai nel repository.
// ---------------------------------------------------------------------------
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: { contents: "export * from './src/lib/importaPrimaNota'", resolveDir: '.', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const m = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'))

let guai = 0
const ok = (cosa, avuto, voluto) => {
  const va = JSON.stringify(avuto) === JSON.stringify(voluto)
  console.log(va ? '  ✓' : '  ✗', cosa, va ? '' : `— atteso ${JSON.stringify(voluto)}, avuto ${JSON.stringify(avuto)}`)
  if (!va) guai++
}
const prova = (f) => {
  try {
    return f()
  } catch (e) {
    return `ERRORE: ${e.message}`
  }
}

// Un testo come quello di pdftotext -layout: titolo, intestazione, righe, causali che vanno a capo,
// un salto pagina (\f) davanti alla prima riga della pagina, righe senza cassa o a zero, il piede.
const TESTO = [
  '                                                Elenco Movimenti Prima Nota',
  '',
  'Data         Categoria              Tipologia      Causale                                        Importo Netto   IVA   Importo Lordo    N° Movimento',
  '25/11/2011   Cassa Conto Corrente   Uscita         rimborso estate                                      €80,00                  €80,00',
  '17/06/2019   Cassa Conto Corrente   Uscita         affitto palestre scuole                            €6.725,00                 €67,25',
  '20/12/2018   Cassa Contanti         Uscita         detersivo                                           €180,00                 €180,00',
  '03/09/2019   Cassa Contanti         Entrata        Cliente ROSSI MARIO per QUOTA ASSOCIATIVA ANNUALE     €60,00    N.I.      €60,00    68',
  '03/09/2019   Cassa Contanti         Entrata        Cliente ROSSI MARIO per Mensile Corso X 2 gg 8-11      €47,00    N.I.      €47,00    69',
  '                                              Anni 3-Ingr.',
  '',
  '                                          Pagina 1 di 2',
  '\f19/07/2019   Cassa Conto Corrente   Entrata   scuola gozzano                                                   €300,00             €300,00',
  '23/09/2019   Cassa Contanti                                                                              €0,00            €0,00',
  '26/08/2019   Cassa Contanti         Uscita                                                                        €0,00               €0,00',
  '01/09/2023                          Uscita    cena tecnici                                      €190,40             €190,40',
  '07/10/2024   Cassa Conto Corrente   Entrata   Cliente BIANCHI ANNA per Annuale Judo kids     €1.234,56    N.I.   €1.234,56   9001',
  '',
  'N° Movimenti 10                      Totale Entrate 1.641,56 Totale Uscite 517,65                                  Totale 1.123,91 €',
  '                                                           €                                               €',
].join('\n')

console.log('1. le righe del file')
{
  const r = prova(() => m.leggiPrimaNota(TESTO))
  const righe = r.righe ?? []
  ok('dieci righe con la data: otto entrano, due a zero si scartano', prova(() => [righe.length, r.scartate.length]), [8, 2])
  ok('la prima: data, cassa, tipo, importo, causale', prova(() => [righe[0].data, righe[0].cassa, righe[0].tipo, righe[0].importo, righe[0].causale]), ['2011-11-25', 'conto', 'uscita', 8000, 'rimborso estate'])
  ok('il contante e il conto', prova(() => righe.map((x) => x.cassa)), ['conto', 'conto', 'contanti', 'contanti', 'contanti', 'conto', null, 'conto'])
  ok('conta l\'importo lordo, non il netto (6.725,00 era un errore di virgola)', prova(() => righe[1].importo), 6725)
  ok('la causale che va a capo si unisce', prova(() => righe[4].causale), 'Cliente ROSSI MARIO per Mensile Corso X 2 gg 8-11 Anni 3-Ingr.')
  ok('la riga dopo il salto pagina c\'è', prova(() => righe[5].causale), 'scuola gozzano')
  ok('IVA «N.I.» e numero del movimento non disturbano', prova(() => [righe[3].importo, righe[3].causale]), [6000, 'Cliente ROSSI MARIO per QUOTA ASSOCIATIVA ANNUALE'])
  ok('le migliaia all\'italiana', prova(() => righe[7].importo), 123456)
  ok('una riga senza cassa resta, con la cassa vuota', prova(() => [righe[6].causale, righe[6].cassa, righe[6].tipo]), ['cena tecnici', null, 'uscita'])
  ok('le righe a zero si scartano, dicendo perché', prova(() => r.scartate.map((x) => x.motivo)), ['Importo zero', 'Importo zero'])
  ok('la posizione è quella fra le righe con la data, buchi compresi: stabile se si rilegge', prova(() => righe.map((x) => x.posizione)), [1, 2, 3, 4, 5, 6, 9, 10])
  ok('…e uguale rileggendo lo stesso testo', prova(() => m.leggiPrimaNota(TESTO).righe.map((x) => x.posizione)), prova(() => righe.map((x) => x.posizione)))
  ok('un piè di pagina rientrato non si attacca alla causale di prima', prova(() => righe[4].causale.includes('Pagina')), false)
  ok('il testo vuoto non dà niente', prova(() => m.leggiPrimaNota('').righe), [])
}

console.log('\n2. il piede e i totali')
{
  const r = prova(() => m.leggiPrimaNota(TESTO))
  ok('il piede dice quanti sono e quanto vale', prova(() => m.totaliDelPiede(TESTO)), { conteggio: 10, entrate: 164156, uscite: 51765 })
  ok('senza piede, niente', prova(() => m.totaliDelPiede('Elenco\n25/11/2011 Cassa Contanti Uscita x €1,00 €1,00')), null)
  ok('le righe lette (e quelle a zero) fanno gli stessi totali del piede', prova(() => m.totaliDelleRighe(r)), { conteggio: 10, entrate: 164156, uscite: 51765 })
  ok('quadra se i totali coincidono', prova(() => m.quadra(r, m.totaliDelPiede(TESTO))), { quadra: true, differenze: [] })
  ok('non quadra se manca una riga, e dice cosa', prova(() => m.quadra({ ...r, righe: r.righe.slice(1) }, m.totaliDelPiede(TESTO))), { quadra: false, differenze: ['movimenti: 9 invece di 10', 'uscite: 437,65 € invece di 517,65 €'] })
  ok('senza piede non si può dire che quadra', prova(() => m.quadra(r, null).quadra), false)
}

console.log('\n3. la voce, scelta dalla causale')
{
  const voce = (causale, tipo = 'entrata') => prova(() => m.voceDellaCausale(causale, tipo))
  ok('la quota associativa di un cliente', voce('Cliente ROSSI MARIO per QUOTA ASSOCIATIVA ANNUALE'), 'Quota associativa')
  ok('…senza badare a maiuscole', voce('cliente rossi per quota associativa annuale'), 'Quota associativa')
  ok('un altro pagamento di un cliente', voce('Cliente ROSSI MARIO per Mensile Collegno Judo 2'), 'Corsi e altri pagamenti')
  ok('un\'entrata qualunque va da classificare', voce('scuola gozzano'), 'Da classificare')
  ok('un\'uscita qualunque pure', voce('enel', 'uscita'), 'Da classificare')
  ok('senza causale, da classificare', voce('', 'uscita'), 'Da classificare')
  ok('«Cliente» scritto in mezzo non basta', voce('rimborso cliente per quota associativa'), 'Da classificare')
  ok('un\'uscita «Cliente … per …» non è un incasso', voce('Cliente ROSSI per QUOTA ASSOCIATIVA', 'uscita'), 'Da classificare')
}

console.log('\n4. quello che si manda al database')
{
  const r = prova(() => m.leggiPrimaNota(TESTO))
  const d = prova(() => m.datiImport(r.righe))
  ok('una riga per movimento, con una chiave che non cambia', prova(() => [d.length, d[0].chiave]), [8, 'prima-nota:1'])
  ok('le chiavi sono tutte diverse', prova(() => new Set(d.map((x) => x.chiave)).size), 8)
  ok('la forma di una riga', prova(() => d[3]), { chiave: 'prima-nota:4', data: '2019-09-03', cassa: 'contanti', tipo: 'entrata', importo: 6000, descrizione: 'Cliente ROSSI MARIO per QUOTA ASSOCIATIVA ANNUALE', voce: 'Quota associativa' })
  ok('la riga senza cassa va sul conto, e si segnala', prova(() => [d[6].cassa, m.cassaIncerta(r.righe).map((x) => x.causale)]), ['conto', ['cena tecnici']])
  ok('una causale lunga si taglia a 200 lettere', prova(() => m.datiImport([{ posizione: 1, data: '2020-01-01', cassa: 'conto', tipo: 'uscita', importo: 100, causale: 'x'.repeat(300) }])[0].descrizione.length), 200)
  ok('senza causale si dice', prova(() => m.datiImport([{ posizione: 1, data: '2020-01-01', cassa: 'conto', tipo: 'uscita', importo: 100, causale: '' }])[0].descrizione), '(senza causale)')
  ok('a pacchetti: nessuno oltre il tetto, nessuna riga persa', prova(() => { const p = m.apacchetti(Array.from({ length: 2300 }, (_, i) => i), 1000); return [p.length, p.map((x) => x.length), p.flat().length] }), [3, [1000, 1000, 300], 2300])
}

console.log('\n5. gli incassi dei clienti dopo una certa data')
{
  const r = prova(() => m.leggiPrimaNota(TESTO))
  const fino = (data) => prova(() => m.senzaIncassiDopo(r.righe, data).map((x) => x.posizione))
  ok('fino al 31 dicembre 2019 restano le righe fino a lì, e le altre non incassi di clienti', fino('2019-12-31'), [1, 2, 3, 4, 5, 6, 9])
  ok('prima del 2019-09-03 sparisce il cliente di quel giorno, le uscite e le altre entrate restano', fino('2019-09-02'), [1, 2, 3, 6, 9])
  ok('senza data si tiene tutto', prova(() => m.senzaIncassiDopo(r.righe, null).length), 8)
  ok('l\'uscita e l\'entrata non da cliente dopo la data restano', prova(() => m.senzaIncassiDopo(r.righe, '2000-01-01').map((x) => x.causale)), ['rimborso estate', 'affitto palestre scuole', 'detersivo', 'scuola gozzano', 'cena tecnici'])
}

console.log('\n6. la cartella dei dati non può stare nel repository')
{
  const dentro = (cartella, ...radici) => prova(() => m.staDentro(cartella, radici))
  ok('una cartella nel repo', dentro('/repo/dati', '/repo'), true)
  ok('il repo stesso', dentro('/repo', '/repo'), true)
  ok('una cartella fuori', dentro('/tmp/dati', '/repo'), false)
  ok('una che si chiama «..dati» dentro il repo', dentro('/repo/..dati', '/repo'), true)
  ok('una con lo stesso inizio ma un altro repo', dentro('/repo2/dati', '/repo'), false)
  ok('con un segno finale', dentro('/repo/dati/', '/repo/'), true)
  ok('basta una delle radici (il worktree e il checkout principale)', dentro('/principale/dati', '/worktree', '/principale'), true)
  ok('con i «..» in mezzo si guarda dove arriva', dentro('/tmp/../repo/dati', '/repo'), true)
}

console.log(guai ? `\n${guai} COSE NON TORNANO` : '\nTUTTO A POSTO')
process.exit(guai ? 1 : 0)
