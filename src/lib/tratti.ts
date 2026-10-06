/**
 * Le regole della firma a schermo intero, senza browser (prova:firma-tratti).
 * I tratti sono punti in pixel del riquadro in cui si è firmato.
 */

export type Tratto = Array<[number, number]>

/** Abbastanza segno da essere una firma e non un tocco per sbaglio. */
export function firmaVera(tratti: readonly Tratto[]): boolean {
  let lungo = 0
  let [x0, x1] = [Infinity, -Infinity]
  for (const t of tratti)
    t.forEach(([x, y], i) => {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      if (i) lungo += Math.hypot(x - t[i - 1][0], y - t[i - 1][1])
    })
  return lungo >= 60 && x1 - x0 >= 40
}

/**
 * I tratti fatti a schermo intero, portati nel riquadro piccolo: un solo
 * fattore per x e y (la firma non si deforma), mai oltre 1 (non si ingrandisce),
 * centrati. Lo spessore non è nei tratti, quindi non si scala.
 */
export function adattaTratti(tratti: readonly Tratto[], w: number, h: number): Tratto[] {
  const punti = tratti.flat()
  if (!punti.length) return tratti.map((t) => [...t])
  const xs = punti.map((p) => p[0])
  const ys = punti.map((p) => p[1])
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)]
  const [bw, bh] = [Math.max(...xs) - x0, Math.max(...ys) - y0]
  // Una firma larga zero (un punto, una riga dritta) non dà divisioni per zero.
  const s = Math.min(1, bw > 0 ? w / bw : 1, bh > 0 ? h / bh : 1)
  const dx = (w - bw * s) / 2 - x0 * s
  const dy = (h - bh * s) / 2 - y0 * s
  return tratti.map((t) => t.map(([x, y]): [number, number] => [x * s + dx, y * s + dy]))
}

/** Un punto del riquadro piccolo non esce dai bordi: il dito può finire fuori. */
export function limitaPunto([x, y]: [number, number], w: number, h: number): [number, number] {
  return [Math.min(Math.max(x, 0), w), Math.min(Math.max(y, 0), h)]
}

/** Girare il telefono cambia l'orientamento; la barra del browser che si ritira no. */
export function orientamento(w: number, h: number): 'verticale' | 'orizzontale' {
  return w > h ? 'orizzontale' : 'verticale'
}

/**
 * L'altezza che si vede davvero: su iOS Safari con le barre in vista 100dvh può
 * restare quella a barre nascoste e il fondo finisce sotto la barra. La
 * visualViewport (se misurata) è la verità; intera per non far scorrere.
 */
export function altezzaVisibile(visuale: number | undefined, interna: number): number {
  return Math.floor(visuale && visuale > 0 ? Math.min(visuale, interna) : interna)
}

/**
 * Girare il telefono (solo su schermi a tocco: col mouse un resize non conta)
 * cancella la bozza e il «dito già sceso», così l'invito può ricomparire.
 */
export function rotazioneCancella(prima: 'verticale' | 'orizzontale', ora: 'verticale' | 'orizzontale', aTocco: boolean): boolean {
  return aTocco && prima !== ora
}

/**
 * L'invito a girare il telefono: solo in verticale e finché non si firma (il
 * primo dito lo toglie, anche prima che il tratto finisca). Non si somma
 * all'avviso di rotazione, che dice già di rifare la firma.
 */
export function invitoGirare(verso: 'verticale' | 'orizzontale', nTratti: number, toccato: boolean, avviso: string): boolean {
  return verso === 'verticale' && !nTratti && !toccato && !avviso
}

/**
 * Un tocco o un clic senza movimento non è un tratto: apre lo schermo intero.
 * Esattamente 6 px dal primo punto è ancora un tocco (il dito trema); un tratto
 * comincia oltre.
 */
export function trattoVero(punti: readonly [number, number][]): boolean {
  if (!punti.length) return false
  const [x0, y0] = punti[0]
  return punti.some(([x, y]) => Math.hypot(x - x0, y - y0) > 6)
}

/**
 * FATTO porta la bozza nel riquadro piccolo e si accende (e chiama onTratti)
 * solo se lì dentro è ancora una firma vera. ANNULLA e CANCELLA E RIFAI non
 * hanno regole: la firma di prima non si tocca e la bozza si svuota.
 */
export function risultatoFatto(bozza: readonly Tratto[], w: number, h: number): { tratti: Tratto[]; chiama: boolean } {
  const tratti = adattaTratti(bozza, w, h)
  return { tratti, chiama: firmaVera(tratti) }
}

/**
 * La voce di cronologia messa all'apertura si toglie con back() solo se è
 * ancora quella in cima: in StrictMode (dev) l'effetto si pulisce e riparte,
 * e un back() alla cieca mangerebbe una voce della pagina sotto.
 */
export function serveBack(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'firma' in state
}

/** Gli elementi da rendere inert: non la radice, né chi lo era già (non va tolto alla chiusura). */
export function daIsolare<T extends { hasAttribute(nome: string): boolean }>(figli: readonly T[], radice: T): T[] {
  return figli.filter((x) => x !== radice && !x.hasAttribute('inert'))
}
