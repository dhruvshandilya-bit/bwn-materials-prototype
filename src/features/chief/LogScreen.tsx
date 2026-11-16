import { AlertCircle, ChevronDown, Keyboard, Loader2, Mic, PackagePlus, Plus, Sparkles, Square, Trash2, Truck, Undo2, Wrench } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button, Chip, Stepper, cn } from '@/components/ui'
import { matchSpeech, type SpeechKind } from '@/lib/ai'
import { useDictation } from '@/lib/claude'
import { CATEGORIES, ITEMS, ITEM_BY_ID } from '@/lib/items'
import { DEMO_NOW, DEMO_TODAY, dayLabel, dayNumber, jobDays, mergeLines, qtyText, round, uid } from '@/lib/logic'
import type { Unmatched } from '@/lib/parse'
import { useStore } from '@/lib/store'
import type { Entry, Job, Line, SpecialOrder } from '@/lib/types'
import { ItemPicker } from './ItemPicker'

type Sample = { label: string; text: string; items?: string[] }

const SAMPLES: Record<SpeechKind, Sample[]> = {
  used: [
    {
      label: 'Crawl space day',
      text: 'Used fourteen hundred and fifty feet of crawl space liner, two rolls of drainage mat, three bags of one inch tree anchors, two rolls of flexi tape and twenty contractor bags. Also two of the blue fittings.',
    },
    {
      label: 'Pump and discharge',
      text: 'Put in the 508 battery backup with the AGM battery and a sump stand. Ran twenty feet of inch and a half PVC with four nineties, two forty-fives, a freeze guard and the Fernco. Used one can of glue and the primer.',
    },
  ],
  load: [
    {
      label: 'Crawl space load',
      text: 'Loading two thousand feet of crawl space liner, three rolls of drainage mat, four rolls of flexi tape, five bags of tree anchors, two hundred zip ties and a gallon of MediClean.',
    },
  ],
  back: [
    {
      label: 'What came back',
      text: 'Brought back sixteen buckets of stone, eight feet of ADS, eight of drain board and eight of fabric. Six feet of inch and a half PVC, one of the nineties, four contractor bags and two bags of Sakrete. The glue and the cleaner came back too.',
      items: ['stone', '3-ads-pipe', 'drain-board', '1-5-pvc-pipe', 'sakrete'],
    },
    {
      label: 'What came back',
      text: 'Came back with five hundred and fifty feet of crawl space liner, one roll of drainage mat, two rolls of flexi tape, two bags of tree anchors and eighty zip ties.',
      items: ['crawl-space-flexi-seal', 'crawl-space-drainage-mat', 'flexi-tape-roll-4-x180', '1-tree-anchors', 'zip-ties'],
    },
  ],
}

const COPY: Record<SpeechKind, { title: string; icon: typeof Truck; ask: string; help: string; placeholder: string }> = {
  load: {
    title: 'Morning load',
    icon: Truck,
    ask: 'Tap and say what is going on the truck',
    help: 'Tonight you say what came back. The difference is what the job used.',
    placeholder: '“Two tons of stone, sixty feet of ADS, the M63…”',
  },
  back: {
    title: 'Evening return',
    icon: Undo2,
    ask: 'Tap and say what came back',
    help: 'Anything from the morning load you do not mention counts as used. You can check every line next.',
    placeholder: '“Brought back sixteen buckets of stone, eight feet of ADS…”',
  },
  used: {
    title: 'Used today',
    icon: Wrench,
    ask: 'Tap and say what you used',
    help: 'No morning load needed. Say what the job used today.',
    placeholder: '“Used 52 feet of ADS pipe, a ton of stone and the M63…”',
  },
}

type Step = 'capture' | 'matching' | 'review'

export function LogScreen({
  job,
  entry,
  mode,
  initialDay,
  onDone,
}: {
  job: Job
  entry?: Entry
  /** load = morning load, back = evening return for a load day, used = used only. */
  mode: SpeechKind
  initialDay?: string
  onDone: (msg: string) => void
}) {
  const { state, dispatch } = useStore()
  const taken = new Set(state.entries.filter((e) => e.jobId === job.id && e.id !== entry?.id).map((e) => e.day))
  const days = jobDays(job).filter((d) => !taken.has(d))
  const [day, setDay] = useState(entry?.day ?? (initialDay && days.includes(initialDay) ? initialDay : days.includes(DEMO_TODAY) ? DEMO_TODAY : days[days.length - 1] ?? DEMO_TODAY))
  const startOnReview = !!entry && (mode !== 'back' || Object.keys(entry.back ?? {}).length > 0 || entry.status === 'sent_back')
  const [step, setStep] = useState<Step>(startOnReview ? 'review' : 'capture')
  const [transcript, setTranscript] = useState((mode === 'back' ? entry?.backTranscript : entry?.transcript) ?? '')
  const [newSpeech, setNewSpeech] = useState('')
  const [lines, setLines] = useState<Line[]>(entry?.lines ?? [])
  const [back, setBack] = useState<Record<string, number>>(entry?.back ?? {})
  const [unmatched, setUnmatched] = useState<Unmatched[]>([])
  const [specials, setSpecials] = useState<SpecialOrder[]>(entry?.specials ?? [])
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [matchedBy, setMatchedBy] = useState<Entry['matchedBy']>(entry?.matchedBy)
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [picker, setPicker] = useState<{ open: boolean; forUnmatched?: Unmatched }>({ open: false })
  const ctl = useRef<AbortController | null>(null)
  const copy = COPY[mode]
  const loadedIds = new Set(lines.map((l) => l.itemId))
  const samples = SAMPLES[mode].filter((s) => !s.items || s.items.filter((i) => loadedIds.has(i)).length >= Math.ceil(s.items.length / 2))

  const mic = useDictation((t) => setNewSpeech((s) => (s ? s + t : t.replace(/^\s+/, ''))))
  const speech = newSpeech

  async function fill(text: string) {
    if (!text.trim()) return
    if (mic.listening) await mic.stop()
    setStep('matching')
    ctl.current = new AbortController()
    try {
      const r = await matchSpeech(text, mode, ctl.current.signal)
      if (mode === 'back') {
        // What came back. Something not on the morning load is added as loaded = back (used 0).
        setBack((b) => ({ ...b, ...Object.fromEntries(r.lines.map((l) => [l.itemId, l.qty])) }))
        setLines((prev) =>
          mergeLines([...prev, ...r.lines.filter((l) => !prev.some((p) => p.itemId === l.itemId)).map((l) => ({ ...l, hint: 'Not on the morning load' }))]),
        )
      } else setLines((prev) => mergeLines([...prev, ...r.lines]))
      setUnmatched((prev) => [...prev, ...r.unmatched])
      setMatchedBy(r.by)
      setAiNote(r.aiError ? 'Merlin AI was not available, so this phone matched the items. Check them below.' : null)
      setTranscript((t) => (t ? `${t} ${text}` : text).trim())
      setNewSpeech('')
      setStep('review')
    } catch {
      setStep('capture')
    }
  }

  function save(send: boolean) {
    const status: Entry['status'] =
      mode === 'load' ? (send || entry?.status === 'on_truck' ? 'on_truck' : 'draft') : mode === 'back' ? (send ? 'pending' : 'on_truck') : send ? 'pending' : 'draft'
    const e: Entry = {
      ...(entry ?? {}),
      id: entry?.id ?? uid('e'),
      jobId: job.id,
      mode: mode === 'used' ? 'used' : 'load',
      day,
      status,
      lines: mergeLines(lines),
      back: mode === 'used' ? undefined : back,
      specials: specials.filter((s) => s.item.trim()),
      notes,
      transcript: mode === 'back' ? entry?.transcript : transcript || undefined,
      backTranscript: mode === 'back' ? transcript || undefined : entry?.backTranscript,
      matchedBy,
      createdAt: entry?.createdAt ?? DEMO_NOW,
      loadedAt: mode === 'load' && status === 'on_truck' ? entry?.loadedAt ?? DEMO_NOW : entry?.loadedAt,
      submittedAt: status === 'pending' ? DEMO_NOW : entry?.submittedAt,
      officeNote: status === 'pending' ? undefined : entry?.officeNote,
    }
    dispatch({ type: 'save', entry: e })
    onDone(
      status === 'pending'
        ? 'Sent to the office for approval'
        : mode === 'load' && status === 'on_truck'
          ? 'Morning load saved. Tell us what came back tonight.'
          : mode === 'back'
            ? 'Saved. Send it when the truck is unloaded.'
            : 'Saved as a draft',
    )
  }

  const setQty = (itemId: string, qty: number) =>
    setLines((ls) => {
      const has = ls.some((l) => l.itemId === itemId)
      if (qty <= 0) return ls.filter((l) => l.itemId !== itemId)
      return has ? ls.map((l) => (l.itemId === itemId ? { ...l, qty } : l)) : [...ls, { itemId, qty, source: 'manual' }]
    })

  const byCat = useMemo(() => {
    const m = new Map<string, Line[]>()
    for (const l of lines) {
      const c = ITEM_BY_ID[l.itemId].category
      m.set(c, [...(m.get(c) ?? []), l])
    }
    return CATEGORIES.filter((c) => m.has(c)).map((c) => ({ c, lines: m.get(c)! }))
  }, [lines])

  const qtyOf = (id: string) => lines.find((l) => l.itemId === id)?.qty ?? 0

  // -------------------------------------------------------------- capture
  if (step !== 'review') {
    return (
      <div className="flex min-h-full flex-col">
        <div className="space-y-4 p-4">
          <div className="flex items-start gap-3 px-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
              <copy.icon size={18} />
            </span>
            <div>
              <div className="text-[15px] font-semibold text-text-strong-950">
                {copy.title} · {dayLabel(day, { short: true })}
              </div>
              <p className="text-[12.5px] leading-snug text-text-sub-600">{copy.help}</p>
            </div>
          </div>

          {!entry && mode !== 'back' && days.length > 1 && (
            <div>
              <div className="mb-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-sub-600">For</div>
              <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDay(d)}
                    className={cn(
                      'whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium',
                      day === d ? 'border-brand-500 bg-brand-500 text-white' : 'border-stroke-soft-200 bg-white text-text-strong-950',
                    )}
                  >
                    Day {dayNumber(job, d)} · {d === DEMO_TODAY ? 'Today' : dayLabel(d, { short: true })}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-stroke-soft-200 bg-white p-4 text-center">
            {step === 'matching' ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="animate-spin text-brand-500" size={30} />
                <div className="text-[14px] font-semibold text-text-strong-950">Filling the materials sheet…</div>
                <div className="text-[12.5px] text-text-sub-600">Matching what you said to the 91 items</div>
                <Button variant="ghost" size="sm" onClick={() => ctl.current?.abort()}>
                  Stop
                </Button>
              </div>
            ) : (
              <>
                {mic.kind !== 'none' && (
                  <>
                    <button
                      type="button"
                      disabled={mic.kind === 'loading'}
                      onClick={() => (mic.listening ? mic.stop() : mic.start())}
                      aria-label={mic.listening ? 'Stop listening' : 'Start talking'}
                      className={cn(
                        'mx-auto mt-1 grid h-20 w-20 place-items-center rounded-full text-white shadow-md transition-colors',
                        mic.listening ? 'mic-live bg-brand-600' : 'bg-brand-500 hover:bg-brand-600',
                        mic.kind === 'loading' && 'opacity-60',
                      )}
                    >
                      {mic.listening ? <Square size={26} fill="currentColor" /> : <Mic size={32} />}
                    </button>
                    <div className="mt-3 flex items-center justify-center gap-2 text-[13.5px] font-semibold text-text-strong-950">
                      {mic.listening ? (
                        <>
                          <span className="eq text-brand-500" aria-hidden>
                            <span />
                            <span />
                            <span />
                            <span />
                          </span>
                          Listening. Tap to stop.
                        </>
                      ) : mic.kind === 'loading' ? (
                        'Getting the mic ready…'
                      ) : (
                        copy.ask
                      )}
                    </div>
                  </>
                )}
                {mic.kind === 'none' && (
                  <div className="flex items-start gap-2 rounded-lg bg-bg-weak-50 p-3 text-left text-[12.5px] text-text-sub-600">
                    <Keyboard size={16} className="mt-0.5 shrink-0" />
                    Voice is not available in this view. Type it, or tap a sample below.
                  </div>
                )}
                {mic.error && mic.kind !== 'none' && (
                  <p className="mt-2 text-[12px] text-state-error-base">The mic stopped ({mic.error.replace('_', ' ')}). Tap to try again, or type below.</p>
                )}
                <textarea
                  id="speech"
                  value={speech + (mic.partial ? ` ${mic.partial}` : '')}
                  onChange={(e) => setNewSpeech(e.target.value)}
                  rows={5}
                  placeholder={copy.placeholder}
                  className="mt-4 w-full resize-none rounded-xl border border-stroke-soft-200 bg-bg-soft-50 p-3 text-left text-[14px] leading-relaxed text-text-strong-950 placeholder:text-text-soft-400"
                />
                {!speech && samples.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-left">
                    <span className="text-[12px] text-text-sub-600">Try a sample:</span>
                    {samples.map((s) => (
                      <button key={s.text} type="button" onClick={() => setNewSpeech(s.text)} className="rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-500 hover:bg-brand-100">
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {mode !== 'back' && lines.length > 0 && step === 'capture' && (
            <p className="px-1 text-[12.5px] text-text-sub-600">This adds to the {lines.length} items already on this sheet.</p>
          )}
        </div>
        <div className="sticky bottom-0 mt-auto space-y-2 border-t border-stroke-soft-200 bg-white p-3">
          <Button size="lg" className="w-full" disabled={!speech.trim() || step === 'matching'} onClick={() => fill(speech)}>
            <Sparkles size={17} /> Fill the sheet
          </Button>
          <button type="button" onClick={() => setStep('review')} className="w-full py-1 text-[13px] font-semibold text-brand-500">
            {mode === 'back' ? 'Skip voice and check each line' : lines.length ? 'Back to the sheet' : 'Skip voice and fill it in by hand'}
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------- review
  const filled = lines.length
  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-3 p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <copy.icon size={16} className="text-brand-500" />
            <span className="text-[13.5px] font-semibold text-text-strong-950">{copy.title}</span>
            <span className="text-[13px] text-text-sub-600">
              · Day {dayNumber(job, day)}, {dayLabel(day, { short: true })}
            </span>
          </div>
        </div>

        {transcript && (
          <details className="group rounded-xl border border-stroke-soft-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-text-strong-950">
                <Sparkles size={15} className="text-brand-500" />
                {mode === 'back' ? `${Object.keys(back).length} returns` : `${filled} item${filled === 1 ? '' : 's'}`} filled from your voice note
              </span>
              <span className="flex items-center gap-1.5">
                {matchedBy && <Chip tone={matchedBy === 'ai' ? 'brand' : 'neutral'}>{matchedBy === 'ai' ? 'Merlin AI' : 'On this phone'}</Chip>}
                <ChevronDown size={16} className="text-icon-soft-400 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <p className="border-t border-stroke-soft-200 px-3 py-2.5 text-[13px] italic leading-relaxed text-text-sub-600">“{transcript}”</p>
          </details>
        )}
        {aiNote && <p className="rounded-lg bg-state-warning-lighter px-3 py-2 text-[12.5px] text-state-warning-dark">{aiNote}</p>}

        {unmatched.length > 0 && (
          <div className="space-y-2">
            {unmatched.map((u) => (
              <div key={u.id} className="rounded-xl border border-state-warning-light bg-state-warning-lighter/60 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-state-warning-base" />
                  <div className="min-w-0 text-[13px] text-text-strong-950">
                    <div className="font-semibold">{u.special ? 'Sounds like a special order' : 'Couldn’t find this on the sheet'}</div>
                    <div className="text-text-sub-600">
                      “{u.heard}”{u.qty ? ` · qty ${u.qty}` : ''}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 pl-6">
                  <Button size="sm" onClick={() => setPicker({ open: true, forUnmatched: u })}>
                    Pick the item
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSpecials((s) => [...s, { id: uid('sp'), vendor: u.vendor ?? '', item: u.heard, qty: u.qty ?? 1 }])
                      setUnmatched((x) => x.filter((y) => y.id !== u.id))
                    }}
                  >
                    Special order
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setUnmatched((x) => x.filter((y) => y.id !== u.id))}>
                    Ignore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4">
        {mode === 'back' && (
          <>
            <p className="px-1 pb-1 text-[12.5px] leading-snug text-text-sub-600">
              Used = loaded − back. Set what came back for each line. Anything you leave at 0 counts as used by the job.
            </p>
            {byCat.map(({ c, lines: ls }) => (
              <section key={c} className="mt-3">
                <h4 className="px-1 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-sub-600">{c}</h4>
                <ul className="divide-y divide-stroke-soft-200 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
                  {ls.map((l) => {
                    const it = ITEM_BY_ID[l.itemId]
                    const b = back[l.itemId] ?? 0
                    const used = Math.max(0, round(l.qty - b, 3))
                    return (
                      <li key={l.itemId} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-[14px] font-medium leading-snug text-text-strong-950">{it.name}</div>
                            {l.hint && <div className="text-[11.5px] text-state-warning-dark">{l.hint}</div>}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="tnum text-[14px] font-semibold text-text-strong-950">{qtyText(used)}</div>
                            <div className="text-[11px] text-text-sub-600">used, {it.unit}</div>
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-text-sub-600">
                          <label className="flex items-center gap-1.5">
                            Loaded
                            <Stepper compact value={l.qty} unit={it.unit} onChange={(n) => setQty(l.itemId, n)} />
                          </label>
                          <span className="flex items-center gap-1.5">
                            Back
                            <Stepper value={b} unit={it.unit} onChange={(n) => setBack((x) => ({ ...x, [l.itemId]: n }))} />
                          </span>
                        </div>
                        {b > l.qty && <div className="mt-1 text-[11.5px] font-medium text-state-error-base">More came back than was loaded. Check the loaded amount.</div>}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </>
        )}

        {mode !== 'back' && !filled && !showAll && (
          <div className="rounded-xl border border-dashed border-stroke-sub-300 bg-white p-5 text-center text-[13px] text-text-sub-600">
            Nothing on the sheet yet. Add items one by one, or open the full sheet.
          </div>
        )}
        {mode !== 'back' &&
          !showAll &&
          byCat.map(({ c, lines: ls }) => (
            <section key={c} className="mt-3">
              <h4 className="px-1 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-sub-600">{c}</h4>
              <ul className="divide-y divide-stroke-soft-200 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
                {ls.map((l) => {
                  const it = ITEM_BY_ID[l.itemId]
                  return (
                    <li key={l.itemId} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="line-clamp-2 text-[14px] font-medium leading-snug text-text-strong-950">{it.name}</span>
                          {l.source === 'voice' && <Mic size={12} className="shrink-0 text-brand-400" aria-label="From voice" />}
                        </div>
                        <div className="truncate text-[12px] text-text-sub-600">
                          {it.unit}
                          {l.hint ? ` · ${l.hint}` : ''}
                        </div>
                      </div>
                      <Stepper value={l.qty} unit={it.unit} onChange={(n) => setQty(l.itemId, n)} />
                      <button type="button" aria-label={`Remove ${it.name}`} onClick={() => setQty(l.itemId, 0)} className="grid h-8 w-7 place-items-center text-icon-soft-400 hover:text-state-error-base">
                        <Trash2 size={15} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

        {mode !== 'back' &&
          showAll &&
          CATEGORIES.map((c) => (
            <details key={c} open className="group mt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between px-1 pb-1.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-sub-600">{c}</span>
                <ChevronDown size={15} className="text-icon-soft-400 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-stroke-soft-200 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
                {ITEMS.filter((i) => i.category === c).map((it) => {
                  const q = qtyOf(it.id)
                  return (
                    <li key={it.id} className={cn('flex items-center gap-2 px-3 py-2', q > 0 && 'bg-brand-50/50')}>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[13.5px] font-medium leading-snug text-text-strong-950">{it.name}</div>
                        <div className="text-[11.5px] text-text-sub-600">{it.unit}</div>
                      </div>
                      <Stepper value={q} unit={it.unit} onChange={(n) => setQty(it.id, n)} />
                    </li>
                  )
                })}
              </ul>
            </details>
          ))}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setPicker({ open: true })}>
            <Plus size={16} /> Add item
          </Button>
          <Button variant="outline" onClick={() => setStep('capture')}>
            <Mic size={16} /> Add by voice
          </Button>
        </div>
        {mode !== 'back' && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 w-full py-1.5 text-[13px] font-semibold text-brand-500">
            {showAll ? 'Show only what’s filled' : 'Open the full sheet (91 items)'}
          </button>
        )}

        {mode !== 'load' && <section className="mt-3">
          <h4 className="flex items-center justify-between px-1 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-sub-600">
            Special orders
          </h4>
          <div className="space-y-2">
            {specials.map((s) => (
              <div key={s.id} className="space-y-2 rounded-xl border border-stroke-soft-200 bg-white p-3">
                <div className="flex gap-2">
                  <input
                    aria-label="Vendor"
                    value={s.vendor}
                    placeholder="Vendor"
                    onChange={(e) => setSpecials((x) => x.map((y) => (y.id === s.id ? { ...y, vendor: e.target.value } : y)))}
                    className="h-9 w-2/5 min-w-0 rounded-lg border border-stroke-soft-200 px-2.5 text-[13.5px]"
                  />
                  <input
                    aria-label="Item"
                    value={s.item}
                    placeholder="Item"
                    onChange={(e) => setSpecials((x) => x.map((y) => (y.id === s.id ? { ...y, item: e.target.value } : y)))}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-stroke-soft-200 px-2.5 text-[13.5px]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Stepper value={s.qty} onChange={(n) => setSpecials((x) => x.map((y) => (y.id === s.id ? { ...y, qty: n } : y)))} />
                  <button type="button" onClick={() => setSpecials((x) => x.filter((y) => y.id !== s.id))} className="text-[12.5px] font-semibold text-state-error-base">
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSpecials((x) => [...x, { id: uid('sp'), vendor: '', item: '', qty: 1 }])}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stroke-sub-300 bg-white py-2.5 text-[13px] font-semibold text-text-sub-600"
            >
              <PackagePlus size={16} /> Add a special order
            </button>
          </div>
        </section>}

        <section className="mt-3 pb-4">
          <h4 className="px-1 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-sub-600">Notes</h4>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything the office should know"
            className="w-full resize-none rounded-xl border border-stroke-soft-200 bg-white p-3 text-[14px]"
          />
        </section>
      </div>

      <div className="sticky bottom-0 mt-auto grid grid-cols-[1fr_1.6fr] gap-2 border-t border-stroke-soft-200 bg-white p-3">
        <Button variant="outline" size="lg" onClick={() => save(false)}>
          Save draft
        </Button>
        <Button size="lg" disabled={!filled && !specials.some((s) => s.item.trim())} onClick={() => save(true)}>
          {mode === 'load' ? (entry?.status === 'on_truck' ? 'Save the load' : 'Send morning load') : 'Send for approval'}
        </Button>
      </div>

      <ItemPicker
        open={picker.open}
        hint={picker.forUnmatched?.heard}
        onClose={() => setPicker({ open: false })}
        onPick={(id) => {
          const u = picker.forUnmatched
          const q = u?.qty ?? 1
          if (mode === 'back' && u) setBack((b) => ({ ...b, [id]: q }))
          setLines((ls) =>
            ls.some((l) => l.itemId === id) && mode === 'back'
              ? ls
              : mergeLines([...ls, { itemId: id, qty: ls.some((l) => l.itemId === id) && !u ? 1 : q, source: 'manual', heard: u?.heard, hint: mode === 'back' ? 'Not on the morning load' : undefined }]),
          )
          if (u) setUnmatched((x) => x.filter((y) => y.id !== u.id))
          setPicker({ open: false })
        }}
      />
    </div>
  )
}
