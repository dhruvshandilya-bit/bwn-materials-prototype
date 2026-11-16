// Thin wrappers over the claude.ai runtime capabilities the published page declares
// (dictation, sample, downloads), each with a fallback for local dev or other hosts.
import { useEffect, useRef, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

const framed = (() => {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
})()

function use(name: string): Promise<Any | null> {
  const c = (window as Any).claude
  if (!c || typeof c.use !== 'function') return Promise.resolve(null)
  try {
    return Promise.resolve(c.use(name)).catch(() => null)
  } catch {
    return Promise.resolve(null)
  }
}

// Resolve once at load so a click never waits on the runtime.
export const caps = {
  dictation: use('dictation'),
  sample: use('sample'),
  downloads: use('downloads'),
}

// ---------------------------------------------------------------- dictation

export type MicKind = 'loading' | 'claude' | 'browser' | 'none'
export type MicState = 'idle' | 'starting' | 'listening' | 'finishing'

const SR: Any = (window as Any).SpeechRecognition || (window as Any).webkitSpeechRecognition

export function useDictation(onText: (t: string) => void) {
  const [kind, setKind] = useState<MicKind>('loading')
  const [state, setState] = useState<MicState>('idle')
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<string | null>(null)
  const api = useRef<Any>(null)
  const rec = useRef<Any>(null)
  const cb = useRef(onText)
  cb.current = onText

  useEffect(() => {
    let off: (() => void)[] = []
    let alive = true
    caps.dictation.then((d) => {
      if (!alive) return
      if (d) {
        api.current = d
        setKind('claude')
        off = [
          d.onPartial(({ text }: { text: string }) => setPartial(text)),
          d.onFinal(({ text }: { text: string }) => {
            setPartial('')
            cb.current(text)
          }),
          d.onState(({ state: s, reason }: { state: MicState; reason?: string }) => {
            setState(s)
            if (s === 'idle' && reason && !['stopped', 'viewer_stopped', 'hidden'].includes(reason)) setError(reason)
            if (s === 'idle' && (reason === 'not_granted' || reason === 'unavailable')) setKind('none')
          }),
        ]
      } else setKind(SR && !framed ? 'browser' : 'none')
    })
    return () => {
      alive = false
      off.forEach((f) => f())
      try {
        rec.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  /** Must be called straight from a click. */
  function start() {
    setError(null)
    if (kind === 'claude' && api.current) {
      api.current.start().catch((e: Any) => {
        setError(e?.code ?? 'upstream_error')
        if (e?.code === 'not_granted' || e?.code === 'unavailable') setKind('none')
      })
      return
    }
    if (kind === 'browser') {
      const r = new SR()
      r.continuous = true
      r.interimResults = true
      r.lang = 'en-US'
      r.onresult = (ev: Any) => {
        let interim = ''
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i]
          if (res.isFinal) cb.current(' ' + res[0].transcript.trim())
          else interim += res[0].transcript
        }
        setPartial(interim)
      }
      r.onerror = (ev: Any) => {
        setError(ev.error === 'not-allowed' ? 'not_granted' : 'upstream_error')
        if (ev.error === 'not-allowed') setKind('none')
      }
      r.onend = () => {
        setState('idle')
        setPartial('')
      }
      rec.current = r
      setState('listening')
      r.start()
    }
  }

  async function stop() {
    if (kind === 'claude' && api.current) await api.current.stop().catch(() => {})
    else rec.current?.stop()
  }

  return { kind, state, partial, error, start, stop, listening: state !== 'idle' }
}

// ---------------------------------------------------------------- downloads

export async function saveFile(filename: string, blob: Blob): Promise<'saved' | 'declined' | 'unavailable'> {
  const dl = await caps.downloads
  if (dl) {
    try {
      await dl.save({ filename, data: blob })
      return 'saved'
    } catch (e: Any) {
      return e?.code === 'declined' ? 'declined' : 'unavailable'
    }
  }
  if (!framed) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return 'saved'
  }
  return 'unavailable'
}
