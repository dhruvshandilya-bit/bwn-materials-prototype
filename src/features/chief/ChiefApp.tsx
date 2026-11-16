import { ChevronLeft } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Toast } from '@/components/ui'
import { useStore } from '@/lib/store'
import { LogScreen } from './LogScreen'
import type { SpeechKind } from '@/lib/ai'
import { EntryScreen, JobScreen, JobsScreen } from './screens'

type Route =
  | { s: 'jobs' }
  | { s: 'job'; jobId: string }
  | { s: 'log'; jobId: string; entryId?: string; mode: SpeechKind; day?: string; key: number }
  | { s: 'entry'; entryId: string }

export function ChiefApp() {
  const { state } = useStore()
  const [stack, setStack] = useState<Route[]>([{ s: 'jobs' }])
  const [toast, setToast] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const route = stack[stack.length - 1]
  const push = (r: Route) => {
    setStack((s) => [...s, r])
    scroller.current?.scrollTo(0, 0)
  }
  const pop = (n = 1) => {
    setStack((s) => (s.length > n ? s.slice(0, -n) : [{ s: 'jobs' }]))
    scroller.current?.scrollTo(0, 0)
  }
  const clearToast = useCallback(() => setToast(null), [])

  const job = 'jobId' in route ? state.jobs.find((j) => j.id === route.jobId) : undefined
  const entry = route.s === 'entry' || (route.s === 'log' && route.entryId) ? state.entries.find((e) => e.id === (route as { entryId: string }).entryId) : undefined
  const entryJob = entry ? state.jobs.find((j) => j.id === entry.jobId) : undefined

  const title =
    route.s === 'jobs'
      ? 'Materials'
      : route.s === 'job'
        ? job?.name
        : route.s === 'log'
          ? { load: 'Morning load', back: 'Evening return', used: 'Used today' }[route.mode]
          : 'Day materials'

  let body: JSX.Element | null = null
  if (route.s === 'jobs') body = <JobsScreen onOpen={(jobId) => push({ s: 'job', jobId })} />
  else if (route.s === 'job' && job)
    body = (
      <JobScreen
        job={job}
        toast={setToast}
        onLog={(mode, entryId, day) => push({ s: 'log', jobId: job.id, entryId, mode, day, key: Date.now() })}
        onOpenEntry={(entryId) => push({ s: 'entry', entryId })}
      />
    )
  else if (route.s === 'log' && job)
    body = (
      <LogScreen
        key={route.key}
        job={job}
        entry={entry}
        mode={route.mode}
        initialDay={route.day}
        onDone={(msg) => {
          setToast(msg)
          pop(stack.length > 2 && stack[stack.length - 2].s === 'entry' ? 2 : 1)
        }}
      />
    )
  else if (route.s === 'entry' && entry && entryJob)
    body = (
      <EntryScreen
        entry={entry}
        job={entryJob}
        toast={setToast}
        onEdit={(mode) => push({ s: 'log', jobId: entryJob.id, entryId: entry.id, mode, key: Date.now() })}
        onDeleted={() => {
          setToast('Draft deleted')
          pop()
        }}
      />
    )

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#f6f5f8]">
      <header className="z-20 flex h-12 shrink-0 items-center gap-1 border-b border-stroke-soft-200 bg-white px-2">
        {stack.length > 1 ? (
          <button type="button" onClick={() => pop()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-lg text-text-strong-950 hover:bg-bg-weak-50">
            <ChevronLeft size={22} />
          </button>
        ) : (
          <span className="ml-2 grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">M</span>
        )}
        <h1 className="min-w-0 flex-1 truncate px-1 text-[15.5px] font-semibold text-text-strong-950">{title}</h1>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div key={stack.length} className="animate-in min-h-full">
          {body}
        </div>
      </div>
      <Toast text={toast} onDone={clearToast} />
    </div>
  )
}
