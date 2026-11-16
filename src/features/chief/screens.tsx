import { ArrowDownToLine, Check, ChevronRight, FileSpreadsheet, FileText, MapPin, PackageCheck, Plus, Truck, Undo2, Users, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Button, Chip, SectionTitle, StatusPill } from '@/components/ui'
import { CATEGORIES, ITEM_BY_ID } from '@/lib/items'
import { DEMO_TODAY, dayLabel, dayNumber, jobDays, jobUsed, qtyText, round, usedLines } from '@/lib/logic'
import { downloadMessage, downloadSheet } from '@/lib/sheet'
import { useStore } from '@/lib/store'
import type { Entry, Job } from '@/lib/types'
import type { SpeechKind } from '@/lib/ai'

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '')

export function jobProgress(job: Job) {
  if (job.status === 'complete') return 'Finished'
  const n = dayNumber(job, DEMO_TODAY)
  return n ? `Day ${n} of ${job.plannedDays}` : 'Starts soon'
}

/** One line under a day: what it holds so far. */
function daySummary(e: Entry) {
  const used = usedLines(e).length
  if (e.mode === 'used') return `Used ${used} item${used === 1 ? '' : 's'}${e.specials.length ? ` · ${e.specials.length} special order` : ''}`
  if (e.status === 'on_truck' || e.status === 'draft') return `Loaded ${e.lines.length} item${e.lines.length === 1 ? '' : 's'}${e.loadedAt ? ` at ${time(e.loadedAt)}` : ''}`
  const back = Object.values(e.back ?? {}).filter((n) => n > 0).length
  return `Loaded ${e.lines.length} · ${back} came back · used ${used}`
}

const ModeIcon = ({ e, size = 16 }: { e: Entry; size?: number }) => (e.mode === 'used' ? <Wrench size={size} /> : <Truck size={size} />)

// ---------------------------------------------------------------- jobs list

export function JobsScreen({ onOpen }: { onOpen: (jobId: string) => void }) {
  const { state } = useStore()
  const active = state.jobs.filter((j) => j.status === 'active')
  const done = state.jobs.filter((j) => j.status === 'complete')
  const card = (j: Job) => {
    const es = state.entries.filter((e) => e.jobId === j.id)
    const today = es.find((e) => e.day === DEMO_TODAY)
    const waiting = es.filter((e) => e.status === 'pending').length
    const back = es.filter((e) => e.status === 'sent_back').length
    return (
      <button key={j.id} type="button" onClick={() => onOpen(j.id)} className="w-full rounded-2xl border border-stroke-soft-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(23,23,23,0.04)] hover:border-brand-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-text-strong-950">{j.name}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-sub-600">
              <MapPin size={12} /> {j.address} · <span className="mono text-[11.5px]">{j.sNumber}</span>
            </div>
          </div>
          <ChevronRight size={18} className="mt-1 shrink-0 text-icon-soft-400" />
        </div>
        <div className="mt-2 line-clamp-1 text-[12.5px] text-text-sub-600">{j.scope}</div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip tone={j.status === 'complete' ? 'neutral' : 'brand'}>{jobProgress(j)}</Chip>
          {j.status === 'active' && !today && <Chip tone="warn">Today not logged</Chip>}
          {today?.status === 'on_truck' && <Chip tone="blue">Truck loaded · return due tonight</Chip>}
          {waiting > 0 && <Chip tone="warn">{waiting} waiting for approval</Chip>}
          {back > 0 && <Chip tone="error">{back} sent back</Chip>}
        </div>
      </button>
    )
  }
  return (
    <div className="space-y-3 p-4">
      <div className="px-1 pt-1">
        <div className="text-[12.5px] text-text-sub-600">Monday, November 16</div>
        <h2 className="text-[21px] font-semibold tracking-tight text-text-strong-950">Good afternoon, Marcus</h2>
      </div>
      <SectionTitle>My jobs</SectionTitle>
      <div className="space-y-2.5">{active.map(card)}</div>
      <SectionTitle>Finished</SectionTitle>
      <div className="space-y-2.5">{done.map(card)}</div>
    </div>
  )
}

// ---------------------------------------------------------------- job

export function JobScreen({
  job,
  onLog,
  onOpenEntry,
  toast,
}: {
  job: Job
  onLog: (mode: SpeechKind, entryId?: string, day?: string) => void
  onOpenEntry: (id: string) => void
  toast: (t: string) => void
}) {
  const { state, dispatch } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const entries = state.entries.filter((e) => e.jobId === job.id).sort((a, b) => b.day.localeCompare(a.day))
  const isWorkDay = jobDays(job).includes(DEMO_TODAY)
  const today = entries.find((e) => e.day === DEMO_TODAY)
  const missed = jobDays(job).filter((d) => d !== DEMO_TODAY && !entries.some((e) => e.day === d))
  const used = jobUsed(state, job.id)
  const rows = Object.keys(used).filter((id) => used[id] > 0)
  const openLoad = entries.some((e) => e.status === 'on_truck' || e.status === 'draft')

  async function dl(format: 'xlsx' | 'pdf') {
    setBusy(format)
    try {
      toast(downloadMessage(await downloadSheet(state, job, format), format))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div className="rounded-2xl border border-stroke-soft-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="mono text-[11.5px] text-text-sub-600">{job.sNumber}</div>
            <h2 className="text-[18px] font-semibold tracking-tight text-text-strong-950">{job.name}</h2>
            <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-text-sub-600">
              <MapPin size={12} /> {job.address}
            </div>
          </div>
          <Chip tone={job.status === 'complete' ? 'neutral' : 'brand'}>{jobProgress(job)}</Chip>
        </div>
        <p className="mt-2 text-[12.5px] text-text-sub-600">{job.scope}</p>
        <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-text-sub-600">
          <Users size={13} /> {job.chief} (chief), {job.crew.join(', ')}
        </div>
      </div>

      {job.status === 'active' && isWorkDay && (
        <div className="rounded-2xl border border-brand-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[14px] font-semibold text-text-strong-950">Today · {dayLabel(DEMO_TODAY, { short: true })}</div>
            {today && <StatusPill status={today.status} />}
          </div>

          {!today && (
            <>
              <p className="mt-1 text-[12.5px] leading-snug text-text-sub-600">Load the truck this morning and say what came back tonight. Or skip the load and just say what you used.</p>
              <div className="mt-3 grid gap-2">
                <Button size="lg" onClick={() => onLog('load')}>
                  <Truck size={17} /> Morning load
                </Button>
                <Button size="lg" variant="outline" onClick={() => onLog('used')}>
                  <Wrench size={16} /> Just what we used
                </Button>
              </div>
            </>
          )}

          {today?.status === 'on_truck' && (
            <>
              <p className="mt-1 text-[12.5px] text-text-sub-600">{daySummary(today)}. When you unload, say what came back.</p>
              <Button size="lg" className="mt-3 w-full" onClick={() => onLog('back', today.id)}>
                <Undo2 size={17} /> Evening return
              </Button>
              <button type="button" onClick={() => onLog('load', today.id)} className="mt-2 w-full py-1 text-[13px] font-semibold text-brand-500">
                Fix the morning load
              </button>
            </>
          )}

          {today && today.status !== 'on_truck' && (
            <button type="button" onClick={() => onOpenEntry(today.id)} className="mt-2 flex w-full items-center gap-3 rounded-xl bg-bg-weak-50 px-3 py-2.5 text-left">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-500">
                <ModeIcon e={today} />
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] text-text-sub-600">{daySummary(today)}</span>
              <ChevronRight size={16} className="text-icon-soft-400" />
            </button>
          )}
        </div>
      )}

      <SectionTitle>Days</SectionTitle>
      {!entries.length && (
        <div className="rounded-xl border border-dashed border-stroke-sub-300 bg-white p-4 text-center text-[13px] text-text-sub-600">Nothing logged yet.</div>
      )}
      {entries.length > 0 && (
        <div className="divide-y divide-stroke-soft-200 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
          {entries.map((e) => (
            <button key={e.id} type="button" onClick={() => onOpenEntry(e.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-bg-weak-50">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">
                <ModeIcon e={e} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-text-strong-950">
                  Day {dayNumber(job, e.day) ?? '–'} · {e.day === DEMO_TODAY ? 'Today' : dayLabel(e.day, { short: true })}
                </span>
                <span className="block text-[12px] leading-snug text-text-sub-600">{daySummary(e)}</span>
              </span>
              <StatusPill status={e.status} />
            </button>
          ))}
        </div>
      )}
      {missed.length > 0 && (
        <Button variant="secondary" className="w-full" onClick={() => onLog('used', undefined, missed[0])}>
          <Plus size={15} /> Log a day we missed
        </Button>
      )}

      {rows.length > 0 && (
        <>
          <SectionTitle>Used on this job so far</SectionTitle>
          <div className="rounded-2xl border border-stroke-soft-200 bg-white">
            <div className="max-h-72 overflow-y-auto px-3 py-1">
              {CATEGORIES.filter((c) => rows.some((id) => ITEM_BY_ID[id].category === c)).map((c) => (
                <div key={c} className="py-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft-400">{c}</div>
                  {rows
                    .filter((id) => ITEM_BY_ID[id].category === c)
                    .map((id) => (
                      <div key={id} className="flex items-baseline justify-between gap-2 py-1 text-[13px]">
                        <span className="truncate text-text-strong-950">{ITEM_BY_ID[id].name}</span>
                        <span className="tnum shrink-0 font-semibold text-text-strong-950">
                          {qtyText(used[id])} <span className="font-normal text-text-sub-600">{ITEM_BY_ID[id].unit}</span>
                        </span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-stroke-soft-200 p-2">
              <span className="flex-1 pl-1 text-[12px] text-text-sub-600">
                <ArrowDownToLine size={13} className="-mt-0.5 mr-1 inline" />
                Download the job’s sheet
              </span>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => dl('xlsx')}>
                <FileSpreadsheet size={14} /> {busy === 'xlsx' ? 'Making…' : 'Excel'}
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => dl('pdf')}>
                <FileText size={14} /> {busy === 'pdf' ? 'Making…' : 'PDF'}
              </Button>
            </div>
          </div>
          <p className="px-1 text-[11.5px] text-text-soft-400">Every day sent to the office, approved or not.</p>
        </>
      )}

      {job.status === 'active' && (
        <Button
          variant="ghost"
          className="w-full"
          disabled={openLoad}
          onClick={() => {
            dispatch({ type: 'completeJob', jobId: job.id })
            toast('Job marked finished')
          }}
        >
          <Check size={15} /> {openLoad ? 'Finish the open day before closing the job' : 'Mark job finished'}
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- one day

export function EntryScreen({
  entry,
  job,
  onEdit,
  toast,
  onDeleted,
}: {
  entry: Entry
  job: Job
  onEdit: (mode: SpeechKind) => void
  toast: (t: string) => void
  onDeleted: () => void
}) {
  const { state, dispatch } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const editable = entry.status === 'draft' || entry.status === 'sent_back' || entry.status === 'on_truck'
  async function dl(format: 'xlsx' | 'pdf') {
    setBusy(format)
    try {
      toast(downloadMessage(await downloadSheet(state, job, format, { entry }), format))
    } finally {
      setBusy(null)
    }
  }
  const settled = entry.mode === 'load' && entry.status !== 'on_truck' && entry.status !== 'draft'
  return (
    <div className="p-4">
      <div className="rounded-2xl border border-stroke-soft-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-text-strong-950">
            <ModeIcon e={entry} size={17} /> {entry.mode === 'used' ? 'Used today' : 'Morning load and return'}
          </div>
          <StatusPill status={entry.status} />
        </div>
        <div className="mt-1 text-[12.5px] text-text-sub-600">
          {job.name} · Day {dayNumber(job, entry.day)}, {dayLabel(entry.day, { short: true })}
        </div>
        {entry.status === 'sent_back' && entry.officeNote && (
          <div className="mt-3 rounded-lg bg-state-error-lighter px-3 py-2 text-[12.5px] text-state-error-dark">
            <span className="font-semibold">Office: </span>
            {entry.officeNote}
          </div>
        )}
        {entry.status === 'approved' && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-state-success-lighter px-3 py-2 text-[12.5px] text-state-success-dark">
            <PackageCheck size={15} /> Approved. It is on the project in Merlin.
          </div>
        )}
        {entry.status === 'pending' && <p className="mt-3 text-[12.5px] text-text-sub-600">The office will check it. You can still download it.</p>}
        {entry.status === 'on_truck' && <p className="mt-3 text-[12.5px] text-text-sub-600">Loaded at {time(entry.loadedAt)}. Waiting for the evening return.</p>}
      </div>

      {entry.mode === 'load' ? (
        <>
          <SectionTitle>{settled ? 'Loaded, back and used' : 'On the truck'}</SectionTitle>
          <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
            {settled && (
              <div className="grid grid-cols-[1fr_44px_44px_52px] gap-1 border-b border-stroke-soft-200 bg-bg-weak-50 px-3 py-1.5 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-text-sub-600">
                <span className="text-left">Item</span>
                <span>Load</span>
                <span>Back</span>
                <span>Used</span>
              </div>
            )}
            <ul className="divide-y divide-stroke-soft-200">
              {entry.lines.map((l) => {
                const it = ITEM_BY_ID[l.itemId]
                const b = entry.back?.[l.itemId] ?? 0
                return settled ? (
                  <li key={l.itemId} className="grid grid-cols-[1fr_44px_44px_52px] items-baseline gap-1 px-3 py-2 text-right text-[13px]">
                    <span className="min-w-0 text-left">
                      <span className="block truncate font-medium text-text-strong-950">{it.name}</span>
                      <span className="block text-[11px] text-text-sub-600">{it.unit}</span>
                    </span>
                    <span className="tnum text-text-sub-600">{qtyText(l.qty)}</span>
                    <span className="tnum text-text-sub-600">{qtyText(b)}</span>
                    <span className="tnum font-semibold text-text-strong-950">{qtyText(Math.max(0, round(l.qty - b, 3)))}</span>
                  </li>
                ) : (
                  <li key={l.itemId} className="flex items-baseline justify-between gap-2 px-3 py-2.5">
                    <span className="truncate text-[13.5px] font-medium text-text-strong-950">{it.name}</span>
                    <span className="tnum shrink-0 text-[13.5px] font-semibold">
                      {qtyText(l.qty)} <span className="font-normal text-text-sub-600">{it.unit}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      ) : (
        <>
          <SectionTitle>Used</SectionTitle>
          <ul className="divide-y divide-stroke-soft-200 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
            {entry.lines.map((l) => (
              <li key={l.itemId} className="flex items-baseline justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-text-strong-950">{ITEM_BY_ID[l.itemId].name}</span>
                  {l.hint && <span className="block truncate text-[11.5px] text-text-sub-600">{l.hint}</span>}
                </span>
                <span className="tnum shrink-0 text-[13.5px] font-semibold">
                  {qtyText(l.qty)} <span className="font-normal text-text-sub-600">{ITEM_BY_ID[l.itemId].unit}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {entry.specials.length > 0 && (
        <>
          <SectionTitle>Special orders</SectionTitle>
          <ul className="divide-y divide-stroke-soft-200 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
            {entry.specials.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 px-3 py-2.5 text-[13.5px]">
                <span>
                  {s.item} <span className="text-text-sub-600">· {s.vendor || 'Vendor not set'}</span>
                </span>
                <span className="tnum font-semibold">× {qtyText(s.qty)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {entry.notes && (
        <>
          <SectionTitle>Notes</SectionTitle>
          <p className="rounded-xl border border-stroke-soft-200 bg-white p-3 text-[13.5px] text-text-strong-950">{entry.notes}</p>
        </>
      )}
      {(entry.transcript || entry.backTranscript) && (
        <>
          <SectionTitle>What you said</SectionTitle>
          <div className="space-y-2 rounded-xl border border-stroke-soft-200 bg-white p-3 text-[13px] italic leading-relaxed text-text-sub-600">
            {entry.transcript && (
              <p>
                {entry.mode === 'load' && <span className="mr-1 font-semibold not-italic text-text-strong-950">Morning:</span>}“{entry.transcript}”
              </p>
            )}
            {entry.backTranscript && (
              <p>
                <span className="mr-1 font-semibold not-italic text-text-strong-950">Evening:</span>“{entry.backTranscript}”
              </p>
            )}
          </div>
        </>
      )}

      <div className="mt-4 space-y-2">
        {editable && (
          <Button size="lg" className="w-full" onClick={() => onEdit(entry.mode === 'used' ? 'used' : entry.status === 'draft' ? 'load' : 'back')}>
            {entry.status === 'sent_back' ? 'Fix and send again' : entry.status === 'on_truck' ? 'Evening return' : 'Continue'}
          </Button>
        )}
        {entry.status !== 'on_truck' && entry.status !== 'draft' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={!!busy} onClick={() => dl('xlsx')}>
              <FileSpreadsheet size={15} /> {busy === 'xlsx' ? 'Making…' : 'Excel'}
            </Button>
            <Button variant="outline" disabled={!!busy} onClick={() => dl('pdf')}>
              <FileText size={15} /> {busy === 'pdf' ? 'Making…' : 'PDF'}
            </Button>
          </div>
        )}
        {entry.status === 'draft' && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              dispatch({ type: 'delete', id: entry.id })
              onDeleted()
            }}
          >
            Delete draft
          </Button>
        )}
      </div>
    </div>
  )
}
