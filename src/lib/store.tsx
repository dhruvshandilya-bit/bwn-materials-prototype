import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { approveEntry, DEMO_NOW, sendBack } from './logic'
import { seedState } from './seed'
import type { Entry, State } from './types'

const KEY = 'bwn-materials-demo-v2'

type Action =
  | { type: 'save'; entry: Entry }
  | { type: 'delete'; id: string }
  | { type: 'approve'; id: string; specialCosts: Record<string, number> }
  | { type: 'sendBack'; id: string; note: string }
  | { type: 'completeJob'; jobId: string }
  | { type: 'reset' }

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'save': {
      const exists = state.entries.some((e) => e.id === a.entry.id)
      const entries = exists ? state.entries.map((e) => (e.id === a.entry.id ? a.entry : e)) : [a.entry, ...state.entries]
      return { ...state, entries }
    }
    case 'delete':
      return { ...state, entries: state.entries.filter((e) => e.id !== a.id) }
    case 'approve':
      return approveEntry(state, a.id, a.specialCosts, DEMO_NOW)
    case 'sendBack':
      return sendBack(state, a.id, a.note)
    case 'completeJob':
      return {
        ...state,
        jobs: state.jobs.map((j) => (j.id === a.jobId ? { ...j, status: 'complete', completedDate: j.completedDate ?? DEMO_NOW.slice(0, 10) } : j)),
      }
    case 'reset':
      return seedState()
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as State
      if (s && s.stock && Array.isArray(s.entries) && s.entries.every((e) => e.mode)) return s
    }
  } catch {
    /* storage blocked: start from the seed */
  }
  return seedState()
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('StoreProvider missing')
  return v
}
