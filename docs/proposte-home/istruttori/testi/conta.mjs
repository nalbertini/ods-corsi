// Conta parole e caratteri delle tessere: oggi, proposta e scheda. Uso: node conta.mjs
const P = [
  ['Maurizio', 'Innella', 'Maestro di Judo V Dan', ['Judo', 'Preparazione atletica', 'Pesi agonisti']],
  ['Diana', 'Ballabio', '', ['MGA', 'Autodifesa']],
  ['Katia', 'Ballabio', '', ['Judo', 'Preparazione atletica']],
  ['Serena', 'Baravalle', '', ['Judo']],
  ['Tiziano', 'Bartocci', '', ['Body functional', 'Pesistica', 'Prepugilistica']],
  ['Fabio', 'Berta', '', ['Aikido']],
  ['Valerio', 'Busa', '', ['Judo']],
  ['Giulia', 'De Chiara', '', ['Avviamento alle arti marziali']],
  ['Maura', 'Fornetti', '', ['Lotta', 'Preparazione atletica', 'Avviamento']],
  ['Elena', 'Merigo', '', ['Giocomotricità']],
  ['Aldo', 'Scollo', '', ['Judo agonisti']],
  ['Manuel', 'Tagini', '', ['Preparazione atletica', 'Pesi', 'Mobility']],
  ['Federico', 'Vuillermin', '', ['Judo', 'Lotta', 'Giocomotricità']],
]
const w = (s) => s.split(/\s+/).filter((x) => x && x !== '·').length
const oggi = P.map(([n, c, r, k]) => [n, [c, r, k.join(', ')].filter(Boolean).join(' · ')])
const prop = P.map(([n, c, , k]) => [n, k.join(', ')])
const stat = (righe, nome) => {
  const par = righe.map(([, t]) => w(t)), car = righe.map(([, t]) => t.length)
  const media = (a) => a.reduce((x, y) => x + y) / a.length
  const dentro = (a) => a.filter((v) => Math.abs(v - media(a)) <= 0.2 * media(a)).length
  console.log(`${nome}: parole ${Math.min(...par)}–${Math.max(...par)} (media ${media(par).toFixed(1)}, ${dentro(par)}/13 entro ±20%), caratteri ${Math.min(...car)}–${Math.max(...car)} (media ${media(car).toFixed(0)}, ${dentro(car)}/13 entro ±20%)`)
  return righe.map(([n, t], i) => `${n}: ${par[i]} parole, ${car[i]} car.`).join(' | ')
}
console.log(stat(oggi, 'OGGI  (Cognome · ruolo · corsi)'))
console.log(stat(prop, 'PROPOSTA (solo corsi, in pastiglie)'))
const blocchi = ['Docente di Educazione Fisica e Maestro di Judo, con una lunga esperienza nella promozione dello sport e del movimento a scuola. Ha collaborato con scuole primarie e secondarie a progetti di educazione motoria, inclusione e benessere.', 'Dal 1989 è presidente e direttore tecnico di ASD Il Centro Judo, l’associazione da cui è nata Officine dello Sport. Diploma ISEF a Torino nel 1997, poi le lauree in Scienze motorie.', 'Dal 2000 porta lo sport nelle scuole: progetti di educazione motoria con i Comuni di Collegno e Candiolo e con le scuole del territorio torinese.']
const bp = blocchi.map(w); const m = bp.reduce((a, b) => a + b) / 3
console.log('Scheda, tre blocchi:', bp.join(' / '), 'media', m.toFixed(1), 'intervallo ±20%:', (m * 0.8).toFixed(1), '–', (m * 1.2).toFixed(1))
const dati = ['Presidente e direttore tecnico di ASD Il Centro Judo', 'Judo (tutti i gruppi), preparazione atletica e pesi agonisti', 'Lunedì, mercoledì e venerdì; martedì e giovedì con gli agonisti', 'Maestro di Judo V Dan, allenatore di Lotta II livello'].map(w)
console.log('Scheda, quattro dati:', dati.join(' / '))
