import { HardHat, Monitor, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/components/ui'
import { ChiefApp } from '@/features/chief/ChiefApp'
import { OfficeApp } from '@/features/office/OfficeApp'
import { caps } from '@/lib/claude'
import { StoreProvider, useStore } from '@/lib/store'

type Role = 'chief' | 'office'
const fromHash = (): Role => (location.hash === '#office' ? 'office' : 'chief')

function useCapsStatus() {
  const [s, setS] = useState<{ voice: boolean | null; ai: boolean | null }>({ voice: null, ai: null })
  useEffect(() => {
    const SR = (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    caps.dictation.then((d) => setS((x) => ({ ...x, voice: !!d || (!!SR && window.top === window.self) })))
    caps.sample.then((a) => setS((x) => ({ ...x, ai: !!a })))
  }, [])
  return s
}

function Guide() {
  const st = useCapsStatus()
  const steps = [
    ['Morning load', 'Ramos residence: tap Morning load and say what goes on the truck, or tap the sample. The 91 sheet items are matched from what was said.'],
    ['Evening return', 'Kessler residence is loaded already. Tap Evening return and say what came back. Used = loaded − back, and anything not mentioned counts as used.'],
    ['Or just what was used', 'No morning load? Tap Just what we used at the end of the day. Anything the AI could not place waits for the chief to pick.'],
    ['Office approves', 'Switch to Office. Approving writes a “Raw material used” movement per item, shop stock → the project’s WIP.'],
    ['On the project', 'Project actuals mirrors the project’s BOM → Actuals tab in Merlin. The Materials Sheet downloads as Excel or PDF in the paper layout.'],
  ]
  return (
    <div className="max-w-sm">
      <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-brand-500">BWN · job materials</div>
      <h2 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-text-strong-950" style={{ textWrap: 'balance' }}>
        The paper Materials Sheet, filled in by voice
      </h2>
      <ol className="mt-5 space-y-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500 text-[12px] font-semibold text-white">{i + 1}</span>
            <span>
              <span className="block text-[14px] font-semibold text-text-strong-950">{t}</span>
              <span className="block text-[13px] leading-snug text-text-sub-600">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 space-y-1 rounded-xl border border-stroke-soft-200 bg-white p-3 text-[12px] text-text-sub-600">
        <div>
          Voice here: <b className="text-text-strong-950">{st.voice === null ? 'checking…' : st.voice ? 'on' : 'type instead'}</b>
        </div>
        <div>
          Item matching: <b className="text-text-strong-950">{st.ai === null ? 'checking…' : st.ai ? 'Merlin AI (Claude)' : 'on this device'}</b>
        </div>
        <div className="pt-1 text-text-soft-400">Item names are BWN’s. Jobs, people, costs and stock are sample data.</div>
      </div>
    </div>
  )
}

function Shell() {
  const { dispatch } = useStore()
  const [role, setRole] = useState<Role>(fromHash)
  const [resetKey, setResetKey] = useState(0)
  useEffect(() => {
    const on = () => setRole(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const pick = (r: Role) => {
    setRole(r)
    try {
      history.replaceState(null, '', `#${r}`)
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="flex h-full flex-col">
      <header className="z-30 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-stroke-soft-200 bg-white py-2.5 pl-[max(16px,env(safe-area-inset-left,0px))] pr-[max(16px,env(safe-area-inset-right,0px))]">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">M</span>
          <span className="text-[14px] font-semibold text-text-strong-950">Merlin</span>
          <span className="hidden text-[13px] text-text-sub-600 sm:inline">· Job materials for BWN</span>
        </div>
        <div className="flex rounded-lg bg-bg-weak-50 p-0.5 ring-1 ring-inset ring-stroke-soft-200">
          {(
            [
              ['chief', 'Crew chief app', HardHat],
              ['office', 'Office', Monitor],
            ] as const
          ).map(([r, label, Icon]) => (
            <button
              key={r}
              type="button"
              onClick={() => pick(r)}
              className={cn('flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold', role === r ? 'bg-white text-brand-500 shadow-sm' : 'text-text-sub-600')}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'reset' })
            setResetKey((k) => k + 1)
          }}
          className="ml-auto flex items-center gap-1.5 text-[12.5px] font-medium text-text-sub-600 hover:text-text-strong-950"
        >
          <RotateCcw size={14} /> Reset demo
        </button>
      </header>
      <main key={resetKey} className="min-h-0 flex-1">
        {role === 'office' ? (
          <OfficeApp />
        ) : (
          <div className="flex h-full min-h-0 items-stretch justify-center gap-12 lg:items-center lg:px-8 lg:py-6">
            <div className="hidden lg:block">
              <Guide />
            </div>
            <div className="h-full w-full min-w-0 lg:h-[min(820px,100%)] lg:w-[392px] lg:shrink-0 lg:overflow-hidden lg:rounded-[34px] lg:border-[7px] lg:border-[#1d1a20] lg:shadow-[0_24px_60px_-20px_rgba(43,23,55,0.45)]">
              <ChiefApp />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
