import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Workout } from '../types'
import type { Esercizio } from '../lib/esercizi'
import { CLIPS, type ClipSpec, exerciseKey } from '../lib/voiceClips'
import { deleteClip, getClip, listClips, putClip } from '../lib/clipStore'
import { forgetClips, say, unlockVoice } from '../lib/voice'
import { zipStore } from '../lib/zip'
import { Back, Play, Trash } from './Icons'

/** Il primo formato che questo browser sa registrare. */
function pickFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ]
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null
}

export function VoiceRecorderScreen({
  workouts,
  catalogo,
  onBack,
}: {
  workouts: Workout[]
  catalogo: Esercizio[]
  onBack: () => void
}) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const format = useMemo(pickFormat, [])

  // Gli esercizi incidibili: quelli del catalogo, più quelli che compaiono nei
  // timer salvati e nel catalogo non ci sono (scritti a mano, o tolti dopo).
  // Prima il catalogo, perché è l'elenco che la palestra cura davvero.
  const exercises = useMemo(() => {
    const seen = new Map<string, string>()
    const aggiungi = (nome: string) => {
      const k = exerciseKey(nome)
      if (k && !seen.has(k)) seen.set(k, nome.trim())
    }
    catalogo.forEach((e) => aggiungi(e.nome))
    workouts.forEach((w) => w.exercises.forEach((e) => aggiungi(e.name)))
    return [...seen.entries()].map(([key, text]): ClipSpec => ({ key, text, group: 'Stati' }))
  }, [catalogo, workouts])

  const refresh = useCallback(() => {
    void listClips().then((keys) => setDone(new Set(keys)))
  }, [])
  useEffect(refresh, [refresh])

  const record = async (key: string) => {
    setError(null)
    if (!format) {
      setError('Questo browser non sa registrare audio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: format.mime })
      const parts: BlobPart[] = []
      mr.ondataavailable = (e) => parts.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        await putClip(key, new Blob(parts, { type: format.mime }))
        forgetClips()
        refresh()
        setActive(null)
      }
      recorder.current = mr
      mr.start()
      setActive(key)
    } catch {
      setError('Microfono non disponibile: controlla il permesso del browser.')
      setActive(null)
    }
  }

  const stop = () => recorder.current?.stop()

  const listen = async (key: string, text: string) => {
    unlockVoice()
    await say([key], text, { volume: 1, voiceURI: null, useRecorded: true })
  }

  const remove = async (key: string) => {
    await deleteClip(key)
    forgetClips()
    refresh()
  }

  const exportAll = async () => {
    if (!format) return
    const keys = [...CLIPS, ...exercises].map((c) => c.key).filter((k) => done.has(k))
    const files = []
    for (const key of keys) {
      const blob = await getClip(key)
      if (!blob) continue
      files.push({ name: `${key}.${format.ext}`, data: new Uint8Array(await blob.arrayBuffer()) })
    }
    if (files.length === 0) return
    // L'indice viaggia nello zip: scompattando, `public/voce/` è già completo
    // e l'app sa cosa cercare senza tentativi a vuoto.
    const index = JSON.stringify({ ext: format.ext, clips: keys }, null, 2)
    files.push({ name: 'index.json', data: new TextEncoder().encode(index) })
    const url = URL.createObjectURL(zipStore(files))
    const a = document.createElement('a')
    a.href = url
    a.download = 'voce-ods.zip'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const groups: Array<[string, ClipSpec[]]> = [
    ['Stati', CLIPS.filter((c) => c.group === 'Stati')],
    ['Conto alla rovescia', CLIPS.filter((c) => c.group === 'Conto alla rovescia')],
    ['Maurizio', CLIPS.filter((c) => c.group === 'Maurizio')],
    ['Esercizi', exercises],
  ]
  const totale = CLIPS.length + exercises.length

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Indietro">
          <Back />
        </button>
        <span className="ob grow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.1em' }}>
          INCIDI LA VOCE
        </span>
        <span className="num" style={{ fontSize: 17, fontWeight: 700, color: 'var(--dim)' }}>
          {done.size}/{totale}
        </span>
      </div>

      <div className="scroll">
        <p className="pad" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--dim)', margin: '8px 0 0' }}>
          Registra ogni frase una volta: da quel momento il timer parla con questa voce su{' '}
          <strong style={{ color: 'var(--text)' }}>questo dispositivo</strong>. Dove manca la clip resta la sintesi, quindi
          si può incidere un pezzo per volta. Per darla a tutta la palestra, esporta e metti i file in{' '}
          <code style={{ color: 'var(--text)' }}>public/voce/</code>.
        </p>

        {!format && (
          <div className="pad" style={{ marginTop: 12 }}>
            <div className="card" style={{ padding: '12px 14px', fontSize: 14, borderColor: 'var(--giallo)' }}>
              Questo browser non permette di registrare audio. Puoi comunque incidere le clip altrove e metterle in{' '}
              <code>public/voce/</code>.
            </div>
          </div>
        )}
        {error && (
          <div className="pad" style={{ marginTop: 12 }}>
            <div className="card" style={{ padding: '12px 14px', fontSize: 14, borderColor: 'var(--rosso)' }}>{error}</div>
          </div>
        )}

        {groups.map(([titolo, items]) => (
          <div key={titolo}>
            <div className="rule">
              <span className="rule-label">{titolo.toUpperCase()}</span>
              <div className="rule-line" />
              <span className="num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--dim)' }}>
                {items.filter((c) => done.has(c.key)).length}/{items.length}
              </span>
            </div>
            <div className="pad stack" style={{ gap: 8 }}>
              {items.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>
                  Nessun esercizio con un nome nei tuoi timer.
                </span>
              )}
              {items.map((c) => {
                const inciso = done.has(c.key)
                const inCorso = active === c.key
                return (
                  <div
                    key={c.key}
                    className="card stack"
                    style={{ gap: 10, padding: '12px 14px', borderColor: inCorso ? 'var(--rosso)' : inciso ? 'var(--verde)' : 'var(--line)' }}
                  >
                    <div className="row" style={{ gap: 10 }}>
                      <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                        <span className="ob" style={{ fontSize: 19, fontWeight: 700 }}>«{c.text}»</span>
                        <span style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: '0.08em' }}>{c.key}</span>
                        {c.hint && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{c.hint}</span>}
                      </div>
                      {inciso && !inCorso && (
                        <>
                          <button className="icon-btn" onClick={() => listen(c.key, c.text)} aria-label={`Ascolta ${c.text}`}>
                            <Play size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            style={{ color: 'var(--rosso)' }}
                            onClick={() => remove(c.key)}
                            aria-label={`Cancella ${c.text}`}
                          >
                            <Trash size={16} />
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      className="btn"
                      style={{
                        minHeight: 48,
                        background: inCorso ? 'var(--rosso)' : 'transparent',
                        border: inCorso ? 'none' : '2px solid var(--line)',
                        color: inCorso ? 'var(--su-colore)' : 'var(--tasto)',
                      }}
                      disabled={!format || (active !== null && !inCorso)}
                      onClick={() => (inCorso ? stop() : record(c.key))}
                    >
                      {inCorso ? 'FERMA' : inciso ? 'RIFAI' : 'REGISTRA'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="pad" style={{ padding: '22px 20px 28px' }}>
          <button className="btn btn-go" style={{ width: '100%' }} disabled={done.size === 0} onClick={exportAll}>
            ESPORTA {done.size} CLIP
          </button>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)', margin: '12px 0 0' }}>
            Scarica <code style={{ color: 'var(--text)' }}>voce-ods.zip</code>: scompattalo dentro{' '}
            <code style={{ color: 'var(--text)' }}>public/voce/</code> del progetto e ripubblica l'app. Le istruzioni
            complete sono in <code style={{ color: 'var(--text)' }}>public/voce/README.md</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
