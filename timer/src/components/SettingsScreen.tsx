import type { Disciplina } from '../lib/discipline'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { CoachLevel, Settings } from '../types'
import { Cues, italianVoices, speak } from '../lib/audio'
import { COACH_HINT, COACH_LABEL, COACH_LEVELS } from '../lib/engine'
import { audioDa, modoAudio, type ModoAudio } from '../lib/storage'
import { listClips } from '../lib/clipStore'
import { CLIPS } from '../lib/voiceClips'
import { COMMIT, COMPILATA_IL, VERSIONE, cercaAggiornamenti } from '../lib/aggiornamento'
import {
  type Salvataggio,
  applicaSalvataggio,
  comeFile,
  contenutoDi,
  leggiSalvataggio,
  nomeFile,
  salvataggioCorrente,
} from '../lib/salvataggio'
import { type Tema, useTema } from '../lib/tema'
import { clientId, clientIdDaCompilazione, collega, impostaClientId, indirizzoRitorno, scollega } from '../lib/spotify'
import { useMusica, useSpotify } from '../lib/useMusica'
import { VOLUME_BLOCCATO, leggiLink } from '../lib/youtube'
import { Chevron } from './Icons'
import { Logo } from './Logo'
import { daRadice } from '../lib/radice'

const AUDIO_ETICHETTA: Record<ModoAudio, string> = {
  muto: 'MUTO',
  bip: 'SOLO BIP',
  voce: 'BIP + VOCE',
}

const AUDIO_SUGGERIMENTO: Record<ModoAudio, string> = {
  muto: 'Nessun suono. Restano il colore dello schermo, la barra e la vibrazione: in una sala con la musica alta è spesso l’unica cosa che si vede davvero.',
  bip: 'Cinque bip sugli ultimi cinque secondi di ogni intervallo — l’ultimo lungo il doppio — e uno diverso al cambio.',
  voce: 'I bip più la voce, che annuncia lo stato e il nome dell’esercizio.',
}

const cues = new Cues()

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string
  hint: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button className="card row" style={{ gap: 12, padding: '0 14px', minHeight: 58, textAlign: 'left' }} onClick={() => onChange(!on)}>
      <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{hint}</span>
      </div>
      <span className="switch" data-on={on} role="switch" aria-checked={on} aria-label={label}>
        <i />
      </span>
    </button>
  )
}

export function SettingsScreen({
  settings,
  onChange,
  historyCount,
  onOpenRecorder,
  onOpenStorico,
  onOpenEsercizi,
  sala = false,
  incorporato = false,
  palestra,
  discipline,
}: {
  settings: Settings
  discipline: Disciplina[]
  onChange: (patch: Partial<Settings>) => void
  historyCount: number
  onOpenRecorder: () => void
  onOpenStorico: () => void
  onOpenEsercizi: () => void
  /**
   * Un tablet di sala: Maurizio, i segnali, lo schermo e la musica durante il
   * timer si scelgono qui e valgono per tutti i tablet (`impostazioniSala.ts`);
   * la voce e gli esercizi li sceglie la segreteria, e qui non ci sono.
   */
  sala?: boolean
  /**
   * Dentro il tablet di ODS Corsi: l'accesso, il tema, la versione e la guida
   * sono già di ODS Corsi, e il salvataggio su file non serve a un tablet
   * i cui timer stanno sul database.
   */
  incorporato?: boolean
  /** Il collegamento con ODS Corsi, quando il timer ha un database. */
  palestra?: ReactNode
}) {
  const [tema, scegliTema] = useTema()
  const [incise, setIncise] = useState(0)
  const [daRipristinare, setDaRipristinare] = useState<Salvataggio | null>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [controllo, setControllo] = useState(false)
  const [esitoControllo, setEsito] = useState<string | null>(null)
  const loadCorrente = contenutoDi(salvataggioCorrente())
  const dataCompilazione = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(COMPILATA_IL))
  useEffect(() => {
    void listClips().then((k) => setIncise(k.length))
  }, [])
  // getVoices() è spesso vuoto al primo giro: il sistema le carica dopo.
  const [vociIt, setVociIt] = useState(() => italianVoices())
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const aggiorna = () => setVociIt(italianVoices())
    window.speechSynthesis.addEventListener('voiceschanged', aggiorna)
    const t = window.setTimeout(aggiorna, 300)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', aggiorna)
      window.clearTimeout(t)
    }
  }, [])

  const tryVolume = (v: number) => {
    onChange({ volume: v })
    cues.volume = v
    cues.unlock()
    cues.work()
  }

  const modo = modoAudio(settings)

  return (
    <>
      {sala && (
        <div className="pad" style={{ paddingTop: 16 }}>
          <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0 }}>
            Maurizio, i segnali, lo schermo e la musica durante il timer valgono per tutti i tablet di sala: cambiati qui,
            gli altri li prendono entro cinque minuti. La voce e gli esercizi li sceglie la segreteria, da ODS Corsi ›
            Segreteria › Impostazioni.
          </p>
        </div>
      )}

      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="card maurizio-card">
          <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
            <img src={daRadice('adesivi/indica.webp')} alt="" className="maurizio-faccia" />
            <div className="stack grow" style={{ gap: 6, minWidth: 0 }}>
              <span className="ob" style={{ fontSize: 25, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
                MODALITÀ MAURIZIO
              </span>
              <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0, textWrap: 'pretty' }}>
                L'allenatore che perde il conto per farti lavorare qualche secondo in più. Il tempo in più è deciso
                all'avvio e sparso a caso fra gli intervalli di lavoro; il recupero non si tocca.
              </p>
            </div>
          </div>

          <div className="maurizio-livelli">
            {(Object.keys(COACH_LEVELS) as CoachLevel[]).map((l) => (
              <button key={l} className="livello" data-on={settings.coach === l} onClick={() => onChange({ coach: l })}>
                <span className="ob" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.1em' }}>
                  {COACH_LABEL[l].toUpperCase()}
                </span>
              </button>
            ))}
          </div>

          <span style={{ fontSize: 13, lineHeight: 1.4, color: settings.coach === 'off' ? 'var(--dim)' : 'var(--giallo-testo)' }}>
            {COACH_HINT[settings.coach]}
          </span>
        </div>
      </div>

      {/* Il catalogo non è più una scheda della barra: si cura ogni tanto, non a
          ogni lezione. Resta però la prima voce, perché è quella per cui si
          entra nelle impostazioni più spesso. Sul tablet di sala lo cura la
          segreteria, e lo storico si guarda da lì. */}
      {!sala && (
      <>
      <div className="rule">
        <span className="rule-label">ESERCIZI</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 8 }}>
        <button className="card row" style={{ gap: 12, padding: '0 14px', minHeight: 64, textAlign: 'left' }} onClick={onOpenEsercizi}>
          <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Libreria esercizi</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              L’elenco della palestra: crea, rinomina, sposta di categoria
            </span>
          </div>
          <Chevron />
        </button>
      </div>
      </>
      )}

      {!incorporato && (
      <>
      <div className="rule">
        <span className="rule-label">TEMA</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 2 }}>
        <div className="card stack" style={{ gap: 10, padding: '12px 14px 14px' }}>
          <div className="segmenti" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {(
              [
                ['scuro', 'NERO'],
                ['chiaro', 'BIANCO'],
              ] as [Tema, string][]
            ).map(([t, etichetta]) => (
              <button key={t} className="segmento" data-on={tema === t} aria-pressed={tema === t} onClick={() => scegliTema(t)}>
                <span className="ob" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em' }}>
                  {etichetta}
                </span>
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--dim)' }}>
            È lo stesso di ODS Corsi: scelto qui o là, vale per tutte e due su questo dispositivo.
          </span>
        </div>
      </div>
      </>
      )}

      <div className="rule">
        <span className="rule-label">AUDIO</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 2 }}>
        {/* Una scelta sola a tre posizioni invece di due interruttori da
            combinare: in palestra si vuole «zitto», «solo i bip» o «anche la
            voce», e le combinazioni restanti non le chiedeva nessuno. */}
        <div className="card stack" style={{ gap: 10, padding: '12px 14px 14px' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Segnali acustici</span>
          <div className="segmenti">
            {(['muto', 'bip', 'voce'] as ModoAudio[]).map((m) => (
              <button
                key={m}
                className="segmento"
                data-on={modo === m}
                aria-pressed={modo === m}
                onClick={() => {
                  onChange(audioDa(m))
                  if (m === 'voce') speak('Voce attiva', settings.volume, settings.voiceURI)
                }}
              >
                <span className="ob" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em' }}>
                  {AUDIO_ETICHETTA[m]}
                </span>
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: modo === 'muto' ? 'var(--dim)' : 'var(--blu)' }}>
            {AUDIO_SUGGERIMENTO[modo]}
          </span>
        </div>

        {/* Un'opzione della voce: senza voce non ha niente da dire. */}
        {modo === 'voce' && (
          <Toggle
            label="Dice il prossimo esercizio"
            hint="Nel recupero annuncia dove si va dopo, così ci si prepara"
            on={settings.announceNext}
            onChange={(v) => onChange({ announceNext: v })}
          />
        )}
        <Toggle
          label="Ticchettio"
          hint="Un tic d'orologio a ogni secondo, mentre il timer conta"
          on={settings.ticchettio}
          onChange={(v) => {
            onChange({ ticchettio: v })
            // Farlo sentire subito: è l'unico modo per decidere se lo si vuole
            // davvero per un'ora di lezione.
            if (v) {
              cues.unlock()
              cues.volume = settings.volume
              cues.tick(false)
              window.setTimeout(() => cues.tick(true), 500)
            }
          }}
        />
        <Toggle
          label="Vibrazione"
          hint="Solo su telefono e tablet che la supportano"
          on={settings.vibrate}
          onChange={(v) => onChange({ vibrate: v })}
        />
        {/* Sul tablet le clip le incide la segreteria: qui resta solo se usarle. */}
        {sala && (
          <Toggle
            label="Usa le clip incise"
            hint="Quelle incise dalla segreteria, quando ci sono, al posto della sintesi"
            on={settings.recordedVoice}
            onChange={(v) => onChange({ recordedVoice: v })}
          />
        )}

        <div className="card stack" style={{ gap: 10, padding: '12px 14px 16px' }}>
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>
              Volume segnali
            </span>
            <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--blu)' }}>
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => tryVolume(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: 'var(--blu)', height: 28 }}
            aria-label="Volume dei segnali acustici"
          />
        </div>
      </div>

      <Musica settings={settings} onChange={onChange} />

      {/* Sul tablet di sala la voce la sceglie e la incide la segreteria. */}
      {!sala && (
      <>
      <div className="rule">
        <span className="rule-label">VOCE INCISA</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 8 }}>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0 }}>
          Frasi registrate con una voce vera al posto della sintesi. Si può incidere un pezzo per volta: dove manca
          la clip, il timer torna da solo alla voce di sistema.
        </p>
        <button className="card row" style={{ gap: 12, padding: '0 14px', minHeight: 60, textAlign: 'left' }} onClick={onOpenRecorder}>
          <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Incidi la voce</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {incise === 0 ? `nessuna clip · ${CLIPS.length} frasi da registrare` : `${incise} clip su questo dispositivo`}
            </span>
          </div>
          <Chevron />
        </button>
        <Toggle
          label="Usa le clip incise"
          hint="Quando ci sono, hanno la precedenza sulla sintesi"
          on={settings.recordedVoice}
          onChange={(v) => onChange({ recordedVoice: v })}
        />
      </div>

      <div className="rule">
        <span className="rule-label">VOCE DI SISTEMA</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 8 }}>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0 }}>
          Le voci disponibili le mette il dispositivo, non l'app: cambiano fra telefono, tablet e computer. Quelle
          marcate «enhanced» o «premium» suonano molto meno metalliche — su iPhone e iPad si scaricano da
          Impostazioni › Accessibilità › Contenuto letto › Voci.
        </p>
        {vociIt.length === 0 ? (
          <div className="card" style={{ padding: '12px 14px', fontSize: 14, color: 'var(--dim)' }}>
            Questo dispositivo non espone voci italiane.
          </div>
        ) : (
          <div className="stack" style={{ gap: 2 }}>
            {vociIt.map((v) => {
              const attiva = settings.voiceURI ? settings.voiceURI === v.voiceURI : v === vociIt[0]
              return (
                <button
                  key={v.voiceURI}
                  className="card row"
                  style={{ gap: 12, padding: '0 14px', minHeight: 54, textAlign: 'left', borderColor: attiva ? 'var(--blu)' : 'var(--line)' }}
                  onClick={() => {
                    onChange({ voiceURI: v.voiceURI })
                    speak('Lavoro. Burpee più salto', settings.volume, v.voiceURI)
                  }}
                >
                  <div style={{ width: 10, height: 10, background: attiva ? 'var(--blu)' : 'var(--line)' }} />
                  <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{v.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                      {v.lang}
                      {v.localService === false ? ' · dalla rete' : ' · sul dispositivo'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--dim)' }}>PROVA</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      </>
      )}

      <div className="rule">
        <span className="rule-label">SCHERMO</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 2 }}>
        <Toggle
          label="Schermo sempre acceso"
          hint="Durante l'allenamento, finché la batteria lo consente"
          on={settings.keepAwake}
          onChange={(v) => onChange({ keepAwake: v })}
        />
        <Toggle
          label="Modalità schermo grande"
          hint="Numeri più grandi e comandi ridotti, per il tablet in sala"
          on={settings.bigScreen}
          onChange={(v) => onChange({ bigScreen: v })}
        />
      </div>

      {palestra}

      {incorporato ? (
        <div style={{ height: 24 }} />
      ) : (
      <>
      <div className="rule">
        <span className="rule-label">DATI</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 10 }}>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)', margin: 0 }}>
          Timer, catalogo esercizi, impostazioni e storico vivono nella memoria di questo dispositivo. Un file di
          salvataggio li mette al riparo, e serve anche per allineare un secondo dispositivo la prima volta.
        </p>

        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-ghost grow"
            style={{ minHeight: 50, fontSize: 15 }}
            onClick={async () => {
              setMessaggio(null)
              const salvataggio = salvataggioCorrente()
              const nome = nomeFile()
              const blob = comeFile(salvataggio)
              const c = contenutoDi(salvataggio)
              const fatto = `Salvati ${c.timer} timer, ${c.esercizi} esercizi e le impostazioni.`
              // Su un'app installata dal telefono il foglio di condivisione è
              // la strada che porta davvero a «Salva su File»; il download
              // resta per il browser sul computer.
              const file = new File([blob], nome, { type: 'application/json' })
              if (navigator.canShare?.({ files: [file] })) {
                try {
                  await navigator.share({ files: [file], title: nome })
                  setMessaggio(fatto)
                  return
                } catch {
                  // Condivisione annullata o negata: si prova col download.
                }
              }
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = nome
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 2000)
              setMessaggio(fatto)
            }}
          >
            SALVA TUTTO
          </button>
          <button
            className="btn btn-ghost grow"
            style={{ minHeight: 50, fontSize: 15 }}
            onClick={() => {
              setMessaggio(null)
              fileRef.current?.click()
            }}
          >
            RIPRISTINA
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            const letto = leggiSalvataggio(await f.text(), discipline)
            if (!letto) {
              setMessaggio('Questo file non è un salvataggio di ODS Timer.')
              return
            }
            setDaRipristinare(letto)
          }}
        />

        {daRipristinare && (
          <div className="card stack" style={{ gap: 10, padding: 14, borderColor: 'var(--giallo)' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {contenutoDi(daRipristinare).timer} timer, {contenutoDi(daRipristinare).esercizi} esercizi
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--dim)' }}>
              Sostituiscono quello che c’è adesso su questo dispositivo: {loadCorrente.timer} timer e{' '}
              {loadCorrente.esercizi} esercizi. Non si può tornare indietro.
            </span>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn btn-ghost grow"
                style={{ minHeight: 46, fontSize: 15 }}
                onClick={() => setDaRipristinare(null)}
              >
                ANNULLA
              </button>
              <button
                className="btn btn-go grow"
                style={{ minHeight: 46, fontSize: 15 }}
                onClick={() => {
                  applicaSalvataggio(daRipristinare)
                  // L'app rilegge tutto all'avvio: ricaricare è il modo più
                  // onesto di rimettere in piedi ogni schermata con i dati nuovi.
                  window.location.reload()
                }}
              >
                RIPRISTINA
              </button>
            </div>
          </div>
        )}

        {messaggio && <span style={{ fontSize: 13, color: 'var(--verde)' }}>{messaggio}</span>}
      </div>

      <div className="rule">
        <span className="rule-label">VERSIONE</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 8 }}>
        <div className="card stack" style={{ gap: 8, padding: 14 }}>
          {/* Il numero dice a che punto è il progetto, il commit dice quale
              copia esatta stai guardando: è quello che serve quando si prova
              una cosa sul telefono e ci si chiede se è già dentro. */}
          <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
            <span className="grow ob" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '0.04em' }}>
              ODS TIMER {VERSIONE}
            </span>
            {COMMIT && (
              <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--faint)', letterSpacing: '0.08em' }}>
                {COMMIT}
              </span>
            )}
          </div>
          <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
            <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>
              Compilata il
            </span>
            <span className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--dim)' }}>
              {dataCompilazione}
            </span>
          </div>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--dim)' }}>
            {esitoControllo ?? 'L’app si aggiorna da sola quando torna in primo piano. Mai durante un allenamento.'}
          </span>
          <button
            className="btn btn-ghost"
            style={{ minHeight: 46, fontSize: 15 }}
            disabled={controllo}
            onClick={async () => {
              setControllo(true)
              setEsito(null)
              const esito = await cercaAggiornamenti()
              setControllo(false)
              setEsito(
                esito === 'nuova'
                  ? 'Versione nuova trovata: l’app si ricarica fra un istante.'
                  : esito === 'aggiornata'
                    ? 'Sei già sull’ultima versione.'
                    : 'Controllo non disponibile: serve una connessione, e l’app installata dal browser.',
              )
            }}
          >
            {controllo ? 'CONTROLLO…' : 'CONTROLLA AGGIORNAMENTI'}
          </button>
        </div>
      </div>

      <div className="rule">
        <span className="rule-label">PALESTRA</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 2, paddingBottom: 24 }}>
        <div className="card row" style={{ gap: 14, padding: 14 }}>
          <Logo width={52} />
          <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="ob" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.03em' }}>
              OFFICINE DELLO SPORT
            </span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>Collegno (TO)</span>
          </div>
        </div>

        {/* La guida sta dentro l'app e non su un link esterno: va aperta anche
            in palestra, dove la rete è quella che è, e deve valere per
            chiunque abbia l'indirizzo dell'app. */}
        <a
          className="card row"
          href={daRadice('guida.html')}
          target="_blank"
          rel="noopener"
          style={{ gap: 12, padding: '0 14px', minHeight: 60, textDecoration: 'none', color: 'inherit' }}
        >
          <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Guida all'app</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              Tutte le funzioni, con le schermate. Funziona anche senza rete.
            </span>
          </div>
          <Chevron />
        </a>

        {/* Lo storico non è più una scheda — in palestra non si guarda — ma
            continua a registrare, entra nel salvataggio e si apre da qui. */}
        <TastoStorico historyCount={historyCount} onOpen={onOpenStorico} />

        <div className="row" style={{ gap: 10, padding: '16px 2px 0' }}>
          <span style={{ fontSize: 12, color: 'var(--faint)', letterSpacing: '0.1em' }}>ODS TIMER {VERSIONE}</span>
          <div className="grow" />
          <span style={{ fontSize: 12, color: 'var(--faint)', letterSpacing: '0.1em' }}>
            {historyCount} allenamenti svolti
          </span>
          <div style={{ width: 8, height: 8, background: 'var(--verde)' }} />
        </div>
      </div>
      </>
      )}
    </>
  )
}

function TastoStorico({ historyCount, onOpen }: { historyCount: number; onOpen: () => void }) {
  return (
    <button className="card row" style={{ gap: 12, padding: '0 14px', minHeight: 60, textAlign: 'left' }} onClick={onOpen}>
      <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Storico allenamenti</span>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>
          {historyCount === 0 ? 'ancora nessuno registrato' : `${historyCount} portati a termine`}
        </span>
      </div>
      <Chevron />
    </button>
  )
}

/**
 * La musica: da dove viene, e cosa fa mentre il timer gira.
 *
 * Due fonti che funzionano in modo opposto, e la sezione lo dice: Spotify si
 * comanda da qui ma suona altrove, e vuole Premium e un'app registrata;
 * YouTube suona dentro il timer, basta un link, ma vuole lo schermo acceso.
 * Le due automazioni valgono per tutte e due.
 */
function Musica({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const m = useMusica(settings)
  const yt = settings.musicaFonte === 'youtube'

  return (
    <>
      <div className="rule">
        <span className="rule-label">MUSICA</span>
        <div className="rule-line" />
      </div>
      <div className="pad stack" style={{ gap: 8 }}>
        <Toggle
          label="Player musicale"
          hint="Spento, la barra della musica sparisce e non parte niente"
          on={settings.musica}
          onChange={(v) => onChange({ musica: v })}
        />
        {settings.musica && <MusicaScelte settings={settings} onChange={onChange} m={m} yt={yt} />}
      </div>
    </>
  )
}

function MusicaScelte({
  settings,
  onChange,
  m,
  yt,
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  m: ReturnType<typeof useMusica>
  yt: boolean
}) {
  return (
    <>
        <div className="card stack" style={{ gap: 10, padding: '12px 14px 14px' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Da dove viene la musica</span>
          <div className="segmenti" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {(
              [
                ['spotify', 'SPOTIFY'],
                ['youtube', 'YOUTUBE'],
              ] as [Settings['musicaFonte'], string][]
            ).map(([f, etichetta]) => (
              <button
                key={f}
                className="segmento"
                data-on={settings.musicaFonte === f}
                aria-pressed={settings.musicaFonte === f}
                onClick={() => onChange({ musicaFonte: f })}
              >
                <span className="ob" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em' }}>
                  {etichetta}
                </span>
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--dim)' }}>
            {yt
              ? 'Suona dentro il timer, da un link a una playlist o a un video. Niente account. Il lettore resta visibile nel timer e si ferma con lo schermo spento: adatto al tablet di sala.'
              : 'Il timer comanda Spotify ovunque stia già suonando: tablet, telefono, cassa. Collegato qui, lo comanda anche il tablet di sala. Serve un account Premium e un’app registrata una volta su developer.spotify.com.'}
          </span>
        </div>

        {yt ? <PassiYoutube settings={settings} onChange={onChange} /> : <PassiSpotify />}

        {m.attiva && (
          <>
            <Toggle
              label="La musica segue il timer"
              hint="Parte con l’avvio, si ferma con la pausa e a fine allenamento"
              on={settings.musicaSegue}
              onChange={(v) => onChange({ musicaSegue: v })}
            />
            <Toggle
              label="Più bassa nel recupero"
              hint="Nel recupero e fra le serie scende, al lavoro torna dov’era"
              on={settings.musicaAbbassa}
              onChange={(v) => onChange({ musicaAbbassa: v })}
            />
            {settings.musicaAbbassa && (
              <div className="card stack" style={{ gap: 10, padding: '12px 14px 16px' }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>
                    Volume nel recupero
                  </span>
                  <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--verde)' }}>
                    {settings.musicaRecupero}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={settings.musicaRecupero}
                  onChange={(e) => onChange({ musicaRecupero: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--verde)', height: 28 }}
                  aria-label="Volume della musica nel recupero"
                />
                {(yt ? VOLUME_BLOCCATO : m.lettore?.volume === null) && (
                  <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--giallo-testo)' }}>
                    {yt
                      ? 'Su iPhone e iPad il volume lo decidono solo i tasti del dispositivo: qui la musica resta com’è.'
                      : `${m.lettore?.dispositivo} non lascia cambiare il volume da fuori: qui la musica resta com’è.`}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {!yt && m.errore && <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--rosso)' }}>{m.errore}</span>}
    </>
  )
}

/** YouTube: un link, e subito si vede se lo si è copiato bene. */
function PassiYoutube({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const [testo, setTesto] = useState(settings.youtube)
  const letto = leggiLink(testo)
  const esito = !testo.trim()
    ? 'Incolla il link di una playlist o di un video, dall’app o dal browser. Va bene anche YouTube Music.'
    : !letto
      ? 'Questo non sembra un link di YouTube.'
      : letto.lista
        ? 'Playlist: suona dall’inizio, un brano dopo l’altro.'
        : 'Un video solo: finito quello, la musica si ferma.'

  return (
    <div className="card stack" style={{ gap: 10, padding: '12px 14px 14px' }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>Link di YouTube</span>
      <input
        className="field"
        value={testo}
        placeholder="https://youtube.com/playlist?list=…"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          setTesto(e.target.value)
          // Si salva solo un link che si legge: uno a metà non deve spegnere la musica.
          if (leggiLink(e.target.value) || !e.target.value.trim()) onChange({ youtube: e.target.value.trim() })
        }}
        style={{ fontSize: 15 }}
      />
      <span style={{ fontSize: 12, lineHeight: 1.45, color: testo.trim() && !letto ? 'var(--rosso)' : letto ? 'var(--verde)' : 'var(--dim)' }}>
        {esito}
      </span>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--dim)' }}>
        Possono comparire pubblicità, e i video che il proprietario non lascia incorporare vengono saltati.
      </span>
    </div>
  )
}

/**
 * Spotify, tre passi: il Client ID (se non è già nel sito), il collegamento,
 * e da lì lo stato di cosa suona e dove.
 */
function PassiSpotify() {
  const m = useSpotify()
  const [id, setId] = useState(() => clientId())
  const [copiato, setCopiato] = useState(false)
  const ritorno = indirizzoRitorno()
  const l = m.lettore

  return (
    <>
      {!clientIdDaCompilazione() && !m.collegato && (
        <div className="card stack" style={{ gap: 10, padding: '12px 14px 14px' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Client ID dell’app Spotify</span>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--dim)' }}>
            Si ottiene una volta sola registrando un’app gratuita su developer.spotify.com, con questo indirizzo fra
            i Redirect URI. I passi sono nella guida.
          </span>
          <button
            className="field num"
            style={{ fontSize: 13, textAlign: 'left', wordBreak: 'break-all', color: copiato ? 'var(--verde)' : undefined }}
            onClick={() => {
              void navigator.clipboard?.writeText(ritorno).then(() => setCopiato(true))
            }}
            aria-label="Copia l’indirizzo di ritorno"
          >
            {copiato ? 'Copiato: ' : ''}
            {ritorno}
          </button>
          <input
            className="field"
            value={id}
            placeholder="Incolla qui il Client ID"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setId(e.target.value)}
            onBlur={() => impostaClientId(id)}
            style={{ fontSize: 15 }}
          />
        </div>
      )}

      {!m.collegato ? (
        <button
          className="btn btn-go"
          style={{ minHeight: 52, fontSize: 16 }}
          disabled={!id.trim()}
          onClick={() => {
            impostaClientId(id)
            void collega()
          }}
        >
          COLLEGA SPOTIFY
        </button>
      ) : (
        <div className="card row" style={{ gap: 12, padding: '10px 14px', minHeight: 58 }}>
          <div style={{ width: 10, height: 10, flexShrink: 0, background: l ? 'var(--verde)' : 'var(--line)' }} />
          <div className="stack grow" style={{ gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Spotify collegato</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {l
                ? `${l.inRiproduzione ? 'Suona' : 'In pausa'} su ${l.dispositivo}${l.volume == null ? ' · volume non regolabile da qui' : ''}`
                : 'Nessun dispositivo sta suonando adesso'}
            </span>
          </div>
          <button className="btn btn-ghost" style={{ minHeight: 40, fontSize: 13, padding: '0 12px' }} onClick={() => scollega()}>
            SCOLLEGA
          </button>
        </div>
      )}
    </>
  )
}
