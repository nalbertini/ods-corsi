import { useEffect, useId, useRef, useState } from 'react'
import { CARTA_RIFIUTATA, ERRORE_CARTA, guaioGoogle, guaioInvio, soldi } from '../lib/satispay'
import { Dettaglio, Tasto } from './ds'

// Solo quel che si usa degli SDK di PayPal, Google e Apple: si caricano a runtime, senza pacchetti.
interface CampoPayPal {
  render(dove: HTMLElement): Promise<void>
}
interface OpzioniCampo {
  placeholder?: string
}
interface CampiPayPal {
  isEligible(): boolean
  NumberField(o?: OpzioniCampo): CampoPayPal
  ExpiryField(o?: OpzioniCampo): CampoPayPal
  CVVField(o?: OpzioniCampo): CampoPayPal
  NameField(o?: OpzioniCampo): CampoPayPal
  submit(): Promise<void>
  getState(): Promise<{ fields: Record<string, { isValid: boolean }> }>
}
type MetodiGoogle = Array<Record<string, unknown>>
interface GooglePayPal {
  config(): Promise<{ isEligible: boolean; allowedPaymentMethods: MetodiGoogle; merchantInfo: Record<string, unknown>; apiVersion: number; apiVersionMinor: number; countryCode: string }>
  confirmOrder(o: { orderId: string; paymentMethodData: unknown }): Promise<{ status: string }>
  initiatePayerAction(o: { orderId: string }): Promise<unknown>
}
interface ApplePayPal {
  config(): Promise<{ isEligible: boolean; countryCode: string; merchantCapabilities: string[]; supportedNetworks: string[] }>
  validateMerchant(o: { validationUrl: string }): Promise<{ merchantSession: unknown }>
  confirmOrder(o: { orderId: string; token: unknown; billingContact: unknown }): Promise<unknown>
}
interface PayPal {
  CardFields(o: { createOrder: () => Promise<string>; onApprove: () => Promise<void>; onError: (e: unknown) => void; style: Record<string, Record<string, string>> }): CampiPayPal
  Googlepay?(): GooglePayPal
  Applepay?(): ApplePayPal
}
interface ClienteGoogle {
  isReadyToPay(o: Record<string, unknown>): Promise<{ result: boolean }>
  loadPaymentData(o: Record<string, unknown>): Promise<{ paymentMethodData: unknown }>
}
interface SessioneApple {
  onvalidatemerchant: (e: { validationURL: string }) => void
  onpaymentauthorized: (e: { payment: { token: unknown; billingContact?: unknown } }) => void
  oncancel: () => void
  begin(): void
  abort(): void
  completeMerchantValidation(s: unknown): void
  completePayment(stato: number): void
}
interface ClasseSessioneApple {
  new (versione: number, richiesta: Record<string, unknown>): SessioneApple
  canMakePayments(): boolean
  STATUS_SUCCESS: number
  STATUS_FAILURE: number
}
declare global {
  interface Window {
    paypal?: PayPal
    google?: { payments: { api: { PaymentsClient: new (o: { environment: 'TEST' | 'PRODUCTION' }) => ClienteGoogle } } }
    ApplePaySession?: ClasseSessioneApple
  }
}

const caricati = new Map<string, Promise<void>>()
/** Uno script una volta sola per pagina: riaprire i campi non lo ricarica. */
function carica(src: string): Promise<void> {
  let p = caricati.get(src)
  if (!p) {
    p = new Promise((ok, no) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = () => ok()
      s.onerror = () => {
        caricati.delete(src)
        no(new Error(ERRORE_CARTA))
      }
      document.head.appendChild(s)
    })
    caricati.set(src, p)
  }
  return p
}

/** «180.00»: come Apple e Google vogliono la cifra. */
const cifra = (cent: number) => (cent / 100).toFixed(2)

/**
 * I campi della carta sotto il riquadro PAGA, con Apple Pay e Google Pay se il
 * telefono li sa usare. Li disegna PayPal nei suoi riquadri: i numeri della
 * carta non passano dall'app. Dopo la conferma (e la banca, se la chiede)
 * l'incasso lo fa il server, con `onPaga`. In prova niente PayPal: PAGA
 * conferma subito.
 */
export function CampiCarta({ clientId, sandbox, ordine, importo, onPaga, onAnnulla }: {
  clientId: string
  sandbox: boolean
  ordine: string
  /** in centesimi */
  importo: number
  /** Incassa e aggiorna il pagamento; lancia con una frase per chi paga. */
  onPaga: () => Promise<void>
  onAnnulla: () => void
}) {
  const prova = clientId === 'prova'
  const radice = useRef<HTMLDivElement>(null)
  const id = useId()
  const numero = useRef<HTMLDivElement>(null)
  const scadenza = useRef<HTMLDivElement>(null)
  const codice = useRef<HTMLDivElement>(null)
  const nome = useRef<HTMLDivElement>(null)
  const [campi, setCampi] = useState<CampiPayPal | null>(null)
  const [google, setGoogle] = useState<{ gp: GooglePayPal; cliente: ClienteGoogle; config: Awaited<ReturnType<GooglePayPal['config']>> } | null>(null)
  const [apple, setApple] = useState<{ ap: ApplePayPal; config: Awaited<ReturnType<ApplePayPal['config']>> } | null>(null)
  const [occupato, setOccupato] = useState(false)
  const [guaio, setGuaio] = useState<string | null>(null)
  // Confermato da chi paga ma non incassato (la rete è caduta): PAGA riprova l'incasso, non la carta.
  const [approvato, setApprovato] = useState(false)

  const incassa = async () => {
    setOccupato(true)
    setGuaio(null)
    try {
      await onPaga()
    } catch (e) {
      setApprovato(true)
      setGuaio(e instanceof Error ? e.message : ERRORE_CARTA)
    }
    setOccupato(false)
  }

  // Il tasto che li ha aperti sparisce: il fuoco viene qui, se no finisce in fondo alla pagina.
  useEffect(() => radice.current?.focus(), [])

  useEffect(() => {
    if (prova) return
    let vivo = true
    let pronti = false
    void (async () => {
      try {
        await carica(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=card-fields,applepay,googlepay&currency=EUR&intent=capture`)
        const pp = window.paypal
        if (!vivo || !pp || !numero.current || !scadenza.current || !codice.current || !nome.current) return
        // I colori del modulo, letti adesso: dentro i riquadri di PayPal le variabili CSS non arrivano.
        const css = getComputedStyle(document.documentElement)
        const v = (n: string) => css.getPropertyValue(n).trim()
        const cf = pp.CardFields({
          createOrder: async () => ordine,
          onApprove: incassa,
          onError: () => vivo && setGuaio(CARTA_RIFIUTATA),
          style: {
            input: { 'font-size': '17px', 'font-family': 'Inter, Helvetica, Arial, sans-serif', color: v('--text'), background: v('--surface'), border: `2px solid ${v('--riga-campo')}`, 'border-radius': '6px', padding: '14px', 'box-shadow': 'none' },
            'input:focus': { border: `2px solid ${v('--text')}` },
            '.invalid': { color: v('--rosso-testo') },
          },
        })
        if (!cf.isEligible()) throw new Error(ERRORE_CARTA)
        await Promise.all([
          cf.NumberField({ placeholder: '1234 1234 1234 1234' }).render(numero.current),
          cf.ExpiryField({ placeholder: 'MM/AA' }).render(scadenza.current),
          cf.CVVField({ placeholder: '3 cifre sul retro' }).render(codice.current),
          cf.NameField({ placeholder: 'Come è scritto sulla carta' }).render(nome.current),
        ])
        pronti = true
        if (vivo) setCampi(cf)
        // Apple Pay e Google Pay solo se il telefono li sa usare: se no non si vedono, e restano i campi.
        const ap = pp.Applepay?.()
        if (ap && window.ApplePaySession?.canMakePayments()) {
          const config = await ap.config().catch(() => null)
          if (vivo && config?.isEligible) setApple({ ap, config })
        }
        const gp = pp.Googlepay?.()
        if (gp) {
          await carica('https://pay.google.com/gp/p/js/pay.js')
          const config = await gp.config()
          const Cliente = window.google?.payments.api.PaymentsClient
          if (!Cliente || !config.isEligible) return
          const cliente = new Cliente({ environment: sandbox ? 'TEST' : 'PRODUCTION' })
          const { result } = await cliente.isReadyToPay({ apiVersion: config.apiVersion, apiVersionMinor: config.apiVersionMinor, allowedPaymentMethods: config.allowedPaymentMethods })
          if (vivo && result) setGoogle({ gp, cliente, config })
        }
      } catch {
        // Senza i campi non si paga: lo si dice. Senza Apple o Google Pay restano i campi, e basta.
        if (vivo && !pronti) setGuaio(ERRORE_CARTA)
      }
    })()
    return () => {
      vivo = false
    }
    // Una volta per ordine: un ordine nuovo è un altro pagamento, e i campi si riaprono da capo.
  }, [clientId, ordine])

  const paga = async () => {
    if (prova || approvato) return incassa()
    if (!campi) return
    setOccupato(true)
    setGuaio(null)
    // Se la banca chiede la conferma, PayPal apre la sua finestra; poi `onApprove` incassa.
    try {
      await campi.submit()
    } catch {
      const stato = await campi.getState().catch(() => null)
      const validi = stato ? Object.values(stato.fields).every((f) => f.isValid) : null
      // `onError` può aver già detto che la banca ha rifiutato: quello resta.
      setGuaio((gia) => guaioInvio(validi, gia))
    }
    setOccupato(false)
  }

  const conGoogle = async () => {
    if (!google) return
    const { gp, cliente, config } = google
    setGuaio(null)
    try {
      const dati = await cliente.loadPaymentData({
        apiVersion: config.apiVersion,
        apiVersionMinor: config.apiVersionMinor,
        allowedPaymentMethods: config.allowedPaymentMethods,
        merchantInfo: config.merchantInfo,
        transactionInfo: { countryCode: config.countryCode, currencyCode: 'EUR', totalPriceStatus: 'FINAL', totalPrice: cifra(importo) },
      })
      const { status } = await gp.confirmOrder({ orderId: ordine, paymentMethodData: dati.paymentMethodData })
      if (status === 'PAYER_ACTION_REQUIRED') await gp.initiatePayerAction({ orderId: ordine })
    } catch (e) {
      setGuaio(guaioGoogle(e))
      return
    }
    await incassa()
  }

  const conApple = () => {
    const Sessione = window.ApplePaySession
    if (!apple || !Sessione) return
    const { ap, config } = apple
    setGuaio(null)
    // Apple vuole la sessione aperta subito, nel tocco: niente attese prima di `begin`.
    const s = new Sessione(4, {
      countryCode: config.countryCode,
      currencyCode: 'EUR',
      merchantCapabilities: config.merchantCapabilities,
      supportedNetworks: config.supportedNetworks,
      total: { label: 'ODS', amount: cifra(importo), type: 'final' },
    })
    s.onvalidatemerchant = (e) =>
      void ap.validateMerchant({ validationUrl: e.validationURL }).then(
        (r) => s.completeMerchantValidation(r.merchantSession),
        () => s.abort(),
      )
    s.onpaymentauthorized = (e) =>
      void ap.confirmOrder({ orderId: ordine, token: e.payment.token, billingContact: e.payment.billingContact }).then(
        async () => {
          s.completePayment(Sessione.STATUS_SUCCESS)
          await incassa()
        },
        () => s.completePayment(Sessione.STATUS_FAILURE),
      )
    s.oncancel = () => undefined
    s.begin()
  }

  const pronto = prova || approvato || !!campi
  return (
    <div ref={radice} tabIndex={-1} role="group" aria-label="Paga con la carta" className="modulo-campo modulo-largo campi-carta">
      {apple && !approvato && (
        <button type="button" className="tasto-wallet" onClick={conApple} disabled={occupato}>
          Paga con Apple Pay
        </button>
      )}
      {google && !approvato && (
        <button type="button" className="tasto-wallet" onClick={() => void conGoogle()} disabled={occupato}>
          Paga con Google Pay
        </button>
      )}
      {(apple || google) && !approvato && (
        <div className="campi-carta-oppure">
          <span>oppure scrivi i dati della carta</span>
        </div>
      )}
      {/* Le etichette sono nostre; i campi li mette PayPal nei suoi riquadri, ognuno col suo nome, e il riquadro prende la nostra. */}
      <div className="campi-carta-campi" hidden={approvato}>
        <span id={`${id}-numero`} className="modulo-etichetta">NUMERO DELLA CARTA</span>
        <div ref={numero} aria-labelledby={`${id}-numero`} className={prova ? 'campo campo-carta-prova' : 'campo-carta'}>{prova && '4111 1111 1111 1111'}</div>
        <span id={`${id}-scadenza`} className="modulo-etichetta">SCADENZA</span>
        <div ref={scadenza} aria-labelledby={`${id}-scadenza`} className={prova ? 'campo campo-carta-prova' : 'campo-carta'}>{prova && '12/30'}</div>
        <span id={`${id}-codice`} className="modulo-etichetta">CODICE DI SICUREZZA</span>
        <div ref={codice} aria-labelledby={`${id}-codice`} className={prova ? 'campo campo-carta-prova' : 'campo-carta'}>{prova && '123'}</div>
        <span id={`${id}-nome`} className="modulo-etichetta">NOME SULLA CARTA</span>
        <div ref={nome} aria-labelledby={`${id}-nome`} className={prova ? 'campo campo-carta-prova' : 'campo-carta'}>{prova && 'In prova la carta non si scrive'}</div>
      </div>
      {guaio && (
        <div role="alert">
          <Dettaglio tono="guaio">{guaio}</Dettaglio>
        </div>
      )}
      <Tasto variante="principale" onClick={() => void paga()} disabled={!pronto || occupato}>
        {occupato ? 'CONFERMO IL PAGAMENTO…' : approvato ? 'RIPROVA A CONFERMARE' : `PAGA ${soldi(importo)}`}
      </Tasto>
      <Dettaglio>Non serve nessun conto. I numeri della carta li legge solo il circuito di pagamento: la palestra non li vede e non li salva.</Dettaglio>
      <Dettaglio>Se la tua banca chiede una conferma, dalla sua app o con un SMS, confermala e torna qui.</Dettaglio>
      <Tasto onClick={onAnnulla} disabled={occupato}>
        ANNULLA
      </Tasto>
    </div>
  )
}
