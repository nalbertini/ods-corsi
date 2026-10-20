// La firma delle chiamate a Satispay (https://developers.satispay.com/reference/sign-the-string): a parte da
// `index.ts` perché si prova anche senza Deno (scripts/prova-satispay.mjs). Solo Web Crypto, che c'è in tutti e due.

const base64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)))

/** `SHA-256=<base64>` del corpo esatto che parte: anche vuoto, per un GET. */
export async function digest(corpo: string): Promise<string> {
  return `SHA-256=${base64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(corpo)))}`
}

/** Le quattro righe che si firmano, nell'ordine di `headers="(request-target) host date digest"`. */
export const daFirmare = (metodo: string, percorso: string, host: string, data: string, dig: string) =>
  [`(request-target): ${metodo.toLowerCase()} ${percorso}`, `host: ${host}`, `date: ${data}`, `digest: ${dig}`].join('\n')

/** La chiave privata PEM (PKCS#8) come la vuole Web Crypto. */
export async function chiavePrivata(pem: string): Promise<CryptoKey> {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

/** Gli header di una chiamata firmata. */
export async function intestazioni(o: { metodo: string; percorso: string; host: string; corpo: string; keyId: string; chiave: CryptoKey }) {
  const data = new Date().toUTCString()
  const dig = await digest(o.corpo)
  const firma = base64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', o.chiave, new TextEncoder().encode(daFirmare(o.metodo, o.percorso, o.host, data, dig))))
  return {
    Host: o.host,
    Date: data,
    Digest: dig,
    'Content-Type': 'application/json',
    Authorization: `Signature keyId="${o.keyId}", algorithm="rsa-sha256", headers="(request-target) host date digest", signature="${firma}"`,
  }
}
