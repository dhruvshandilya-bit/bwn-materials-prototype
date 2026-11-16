import { Check, ChevronDown, CornerUpLeft, Mic, Truck, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Button, Chip, StatusPill, cn } from '@/components/ui'
import { ITEM_BY_ID } from '@/lib/items'
import { RAW_MATERIAL_USED, dayLabel, dayNumber, entryCost, money, qtyText, round, skuOf, usedLines } from '@/lib/logic'
import { useStore } from '@/lib/store'
import type { Entry } from '@/lib/types'

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

function LinesTable({ e }: { e: Entry }) {
  const { state } = useStore()
  const load = e.mode === 'load'
  const rows = load ? e.lines : usedLines(e)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-[13px]">
        <thead>
          <tr className="border-b border-stroke-soft-200 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-text-sub-600">
            <th className="py-2 pl-4 pr-2">Item</th>
            {load && <th className="px-2 text-right">Loaded</th>}
            {load && <th className="px-2 text-right">Back</th>}
            <th className="px-2 text-right">Used</th>
            <th className="px-2">Unit</th>
            <th className="px-2 text-right">Avg cost</th>
            <th className="px-2 text-right">Job cost</th>
            <th className="py-2 pl-2 pr-4">Shop stock</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke-soft-200">
          {rows.map((l) => {
            const it = ITEM_BY_ID[l.itemId]
            const back = e.back?.[l.itemId] ?? 0
            const used = load ? Math.max(0, round(l.qty - back, 3)) : l.qty
            const shop = state.stock[l.itemId] ?? 0
            const after = round(shop - used, 3)
            return (
              <tr key={l.itemId} className={cn('align-top', used === 0 && 'text-text-soft-400')}>
                <td className="py-2 pl-4 pr-2">
                  <div className="flex items-center gap-1.5 font-medium text-text-strong-950">
                    {it.name}
                    {l.source === 'voice' && <Mic size={12} className="text-brand-400" aria-label="From voice" />}
                  </div>
                  <div className="text-[11.5px] text-text-sub-600">
                    <span className="mono">{skuOf(it.id)}</span>
                    {l.hint ? ` · ${l.hint}` : ''}
                  </div>
                </td>
                {load && <td className="tnum px-2 py-2 text-right text-text-sub-600">{qtyText(l.qty)}</td>}
                {load && <td className="tnum px-2 py-2 text-right text-text-sub-600">{qtyText(back)}</td>}
                <td className="tnum px-2 py-2 text-right font-semibold text-text-strong-950">{qtyText(used)}</td>
                <td className="px-2 py-2 text-text-sub-600">{it.unit}</td>
                <td className="tnum px-2 py-2 text-right text-text-sub-600">{money(it.cost)}</td>
                <td className="tnum px-2 py-2 text-right font-medium text-text-strong-950">{money(used * it.cost)}</td>
                <td className={cn('py-2 pl-2 pr-4 text-[12px]', after < 0 ? 'text-state-error-base' : 'text-text-sub-600')}>
                  {used > 0 ? `${qtyText(shop)} → ${qtyText(after)}${after < 0 ? ' · below zero' : ''}` : 'All came back'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ApprovalCard({ e, onDone }: { e: Entry; onDone: (msg: string) => void }) {
  const { state, dispatch } = useStore()
  const job = state.jobs.find((j) => j.id === e.jobId)!
  const [open, setOpen] = useState(false)
  const [costs, setCosts] = useState<Record<string, string>>({})
  const [returning, setReturning] = useState(false)
  const [note, setNote] = useState('')
  const cost = entryCost(e) + e.specials.reduce((s, x) => s + (Number(costs[x.id]) || 0), 0)
  const Icon = e.mode === 'used' ? Wrench : Truck
  const used = usedLines(e).length

  return (
    <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-bg-soft-50">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500">
          <Icon size={17} />
        </span>
        <span className="min-w-[180px] flex-1">
          <span className="block text-[14px] font-semibold text-text-strong-950">
            {job.name} <span className="mono text-[11.5px] font-normal text-text-sub-600">{job.sNumber}</span>
          </span>
          <span className="block text-[12.5px] text-text-sub-600">
            {e.mode === 'load' ? 'Load and return' : 'Used only'} · Day {dayNumber(job, e.day)}, {dayLabel(e.day, { short: true })} · {job.chief} · sent {when(e.submittedAt)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {(e.transcript || e.backTranscript) && <Chip tone="brand">From voice</Chip>}
          <Chip>
            {used} used{e.specials.length ? ` + ${e.specials.length} special` : ''}
          </Chip>
          <span className="tnum text-[14px] font-semibold text-text-strong-950">{money(cost)}</span>
          <ChevronDown size={18} className={cn('text-icon-soft-400 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="border-t border-stroke-soft-200">
          {(e.transcript || e.backTranscript) && (
            <div className="space-y-1 border-b border-stroke-soft-200 bg-bg-soft-50 px-4 py-2.5 text-[12.5px] italic leading-relaxed text-text-sub-600">
              {e.transcript && (
                <p>
                  <span className="not-italic font-semibold text-text-strong-950">{e.mode === 'load' ? 'Morning load: ' : 'Heard: '}</span>“{e.transcript}”
                </p>
              )}
              {e.backTranscript && (
                <p>
                  <span className="not-italic font-semibold text-text-strong-950">Evening return: </span>“{e.backTranscript}”
                </p>
              )}
            </div>
          )}
          <LinesTable e={e} />
          {e.specials.length > 0 && (
            <div className="border-t border-stroke-soft-200 px-4 py-3">
              <div className="mb-2 text-[12px] font-semibold text-text-strong-950">Special orders: enter the cost to add it to the job</div>
              {e.specials.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 py-1 text-[13px]">
                  <span className="min-w-[200px] flex-1">
                    {s.item} × {qtyText(s.qty)} <span className="text-text-sub-600">· {s.vendor || 'vendor not set'}</span>
                  </span>
                  <label className="flex h-9 items-center gap-1 rounded-lg border border-stroke-sub-300 px-2.5">
                    <span className="text-text-sub-600">$</span>
                    <input
                      id={`cost-${s.id}`}
                      inputMode="decimal"
                      value={costs[s.id] ?? ''}
                      onChange={(ev) => setCosts((c) => ({ ...c, [s.id]: ev.target.value }))}
                      placeholder="Total cost"
                      className="tnum w-28 bg-transparent outline-none"
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
          {e.notes && (
            <div className="border-t border-stroke-soft-200 px-4 py-3 text-[13px]">
              <span className="font-semibold">Chief’s notes: </span>
              {e.notes}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-stroke-soft-200 bg-bg-soft-50 px-4 py-3">
            {returning ? (
              <>
                <input
                  id={`note-${e.id}`}
                  autoFocus
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  placeholder="What should the chief fix?"
                  className="h-10 min-w-[220px] flex-1 rounded-lg border border-stroke-sub-300 bg-white px-3 text-[13.5px]"
                />
                <Button variant="ghost" onClick={() => setReturning(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={!note.trim()}
                  onClick={() => {
                    dispatch({ type: 'sendBack', id: e.id, note: note.trim() })
                    onDone(`Sent back to ${job.chief}`)
                  }}
                >
                  Send back
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-[12.5px] text-text-sub-600">
                  Approving writes a “{RAW_MATERIAL_USED}” asset movement for each item, shop stock → {job.name} WIP. It shows on the project’s BOM → Actuals.
                </span>
                <Button variant="outline" onClick={() => setReturning(true)}>
                  <CornerUpLeft size={15} /> Send back
                </Button>
                <Button
                  onClick={() => {
                    const sc = Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, Number(v) || 0]))
                    dispatch({ type: 'approve', id: e.id, specialCosts: sc })
                    onDone(`Approved. ${money(cost)} posted to ${job.name}.`)
                  }}
                >
                  <Check size={15} /> Approve and post to project
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Approvals({ toast }: { toast: (t: string) => void }) {
  const { state } = useStore()
  const pending = state.entries.filter((e) => e.status === 'pending').sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
  const out = state.entries.filter((e) => e.status === 'on_truck')
  const recent = state.entries
    .filter((e) => e.status === 'approved' || e.status === 'sent_back')
    .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
    .slice(0, 6)
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 text-[17px] font-semibold text-text-strong-950">Waiting for you</h2>
        <p className="mb-3 text-[13px] text-text-sub-600">Days settled by crew chiefs. Nothing changes stock or the project cost until you approve it.</p>
        <div className="space-y-2.5">
          {pending.map((e) => (
            <ApprovalCard key={e.id} e={e} onDone={toast} />
          ))}
          {!pending.length && <div className="rounded-xl border border-dashed border-stroke-sub-300 bg-white p-6 text-center text-[13px] text-text-sub-600">All caught up.</div>}
        </div>
      </section>
      {out.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-text-sub-600">Out on jobs now</h3>
          <div className="divide-y divide-stroke-soft-200 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
            {out.map((e) => {
              const job = state.jobs.find((j) => j.id === e.jobId)!
              return (
                <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <Truck size={15} className="text-brand-500" />
                  <span className="min-w-[200px] flex-1">
                    <span className="font-medium text-text-strong-950">{job.name}</span>
                    <span className="text-text-sub-600">
                      {' '}
                      · {e.lines.length} items loaded {when(e.loadedAt)} by {job.chief}
                    </span>
                  </span>
                  <StatusPill status={e.status} />
                </div>
              )
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-text-soft-400">Stock stays on the shop count until the evening return is approved.</p>
        </section>
      )}
      {recent.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-text-sub-600">Recently reviewed</h3>
          <div className="divide-y divide-stroke-soft-200 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white">
            {recent.map((e) => {
              const job = state.jobs.find((j) => j.id === e.jobId)!
              return (
                <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-[200px] flex-1">
                    <span className="font-medium text-text-strong-950">{job.name}</span>
                    <span className="text-text-sub-600">
                      {' '}
                      · {e.mode === 'load' ? 'Load and return' : 'Used only'} · {dayLabel(e.day, { short: true })}
                    </span>
                  </span>
                  {e.status === 'approved' && <span className="tnum font-medium">{money(entryCost(e))}</span>}
                  <StatusPill status={e.status} />
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
