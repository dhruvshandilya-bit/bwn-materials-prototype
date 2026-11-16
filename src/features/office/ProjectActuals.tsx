import { Clock, FileSpreadsheet, FileText } from 'lucide-react'
import { useState } from 'react'
import { Button, Chip, cn } from '@/components/ui'
import { ITEM_BY_ID } from '@/lib/items'
import { DEMO_NOW, dayLabel, dayNumber, money, projectActuals, qtyText, round, skuOf } from '@/lib/logic'
import { downloadMessage, downloadSheet } from '@/lib/sheet'
import { useStore } from '@/lib/store'
import { jobProgress } from '../chief/screens'

type Lens = 'movements' | 'sku'

const PROJECT_TABS = ['Details', 'Schedule', 'Daily Logs', 'BOM', 'Files', 'Invoices']
const BOM_TABS = ['Details', 'By class', 'Actuals']

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function ago(iso?: string) {
  if (!iso) return 'No movements yet'
  const mins = Math.round((new Date(DEMO_NOW).getTime() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `Updated ${Math.max(mins, 1)} min ago`
  if (mins < 60 * 24) return `Updated ${Math.round(mins / 60)} h ago`
  return `Updated ${Math.round(mins / 1440)} d ago`
}

/** The project's BOM → Actuals tab in Merlin, fed by the approved "Raw material used" movements. */
export function ProjectActuals({ toast, jobId, setJobId }: { toast: (t: string) => void; jobId: string; setJobId: (id: string) => void }) {
  const { state } = useStore()
  const job = state.jobs.find((j) => j.id === jobId) ?? state.jobs[0]
  const a = projectActuals(state, job.id)
  const [lens, setLens] = useState<Lens>('movements')
  const [busy, setBusy] = useState<string | null>(null)
  const variance = round(job.materialBudget - a.actual)
  const usedPct = job.materialBudget ? (a.actual / job.materialBudget) * 100 : 0

  async function dl(format: 'xlsx' | 'pdf') {
    setBusy(format)
    try {
      toast(downloadMessage(await downloadSheet(state, job, format, { office: true }), format))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {state.jobs.map((j) => (
          <button
            key={j.id}
            type="button"
            onClick={() => setJobId(j.id)}
            className={cn('rounded-lg border px-3 py-2 text-left', j.id === job.id ? 'border-brand-500 bg-brand-50' : 'border-stroke-soft-200 bg-white hover:border-brand-200')}
          >
            <div className="text-[13px] font-semibold text-text-strong-950">{j.name}</div>
            <div className="text-[11.5px] text-text-sub-600">
              <span className="mono">{j.sNumber}</span> · {jobProgress(j)}
            </div>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-stroke-soft-200 bg-white">
        <div className="border-b border-stroke-soft-200 px-5 pt-4">
          <div className="text-[12px] text-text-sub-600">
            Projects / <span className="mono">{job.sNumber}</span>
          </div>
          <h2 className="text-[19px] font-semibold tracking-tight text-text-strong-950">{job.name}</h2>
          <div className="no-scrollbar -mb-px mt-3 flex gap-5 overflow-x-auto">
            {PROJECT_TABS.map((t) => (
              <span key={t} className={cn('whitespace-nowrap border-b-2 pb-2.5 text-[13px] font-semibold', t === 'BOM' ? 'border-brand-500 text-brand-500' : 'border-transparent text-text-soft-400')}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200">
              {BOM_TABS.map((t) => (
                <span key={t} className={cn('rounded-md px-3 py-1 text-[12.5px] font-semibold', t === 'Actuals' ? 'bg-white text-text-strong-950 shadow-sm' : 'text-text-soft-400')}>
                  {t}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-[12px] text-text-sub-600">
                <Clock size={13} /> {ago(a.movements[0]?.at)}
              </span>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => dl('xlsx')}>
                <FileSpreadsheet size={14} /> {busy === 'xlsx' ? 'Making…' : 'Materials sheet'}
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => dl('pdf')}>
                <FileText size={14} /> {busy === 'pdf' ? 'Making…' : 'PDF'}
              </Button>
            </div>
          </div>

          {a.waiting.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-state-warning-light bg-state-warning-lighter/70 px-4 py-2.5 text-[12.5px] text-state-warning-dark">
              <span className="font-semibold">
                {a.waiting.length} day{a.waiting.length === 1 ? '' : 's'} waiting for approval · {money(a.waitingCost)}
              </span>
              <span>Not in Actuals until approved ({a.waiting.map((e) => `Day ${dayNumber(job, e.day)}`).join(', ')}).</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card label="Actual to date (net)" value={money(a.actual)} sub={`Issued ${money(a.actual)} · Returned ${money(0)}`} />
            <Card label="Budget" value={money(job.materialBudget)} sub="BOM material budget (sample)" />
            <Card
              label="Variance"
              value={`${variance < 0 ? '−' : ''}${money(Math.abs(variance))}`}
              sub={variance < 0 ? 'Over budget' : `${usedPct.toFixed(0)}% of budget used`}
              tone={variance < 0 ? 'error' : usedPct > 85 ? 'warn' : 'ok'}
            />
            <Card label="Cost to complete" value={money(Math.max(0, variance))} sub="Budget − actual" />
          </div>

          <div className="flex gap-1">
            {(
              [
                ['movements', 'Movements'],
                ['sku', 'By SKU'],
              ] as [Lens, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setLens(k)}
                className={cn('rounded-full px-3 py-1 text-[12.5px] font-semibold ring-1 ring-inset', lens === k ? 'bg-brand-500 text-white ring-brand-500' : 'bg-white text-text-sub-600 ring-stroke-soft-200')}
              >
                {label}
              </button>
            ))}
          </div>

          {!a.movements.length ? (
            <div className="rounded-xl border border-dashed border-stroke-sub-300 p-8 text-center text-[13px] text-text-sub-600">
              No movements recorded yet. Approved job days appear here.
            </div>
          ) : lens === 'movements' ? (
            <div className="overflow-x-auto rounded-xl border border-stroke-soft-200">
              <table className="w-full min-w-[860px] text-[13px]">
                <thead>
                  <tr className="border-b border-stroke-soft-200 bg-bg-soft-50 text-left text-[11.5px] font-semibold text-text-sub-600">
                    <th className="py-2 pl-4 pr-2">Date</th>
                    <th className="px-2">SKU</th>
                    <th className="px-2">Description</th>
                    <th className="px-2 text-right">Qty</th>
                    <th className="px-2 text-right">Unit cost</th>
                    <th className="px-2 text-right">Total cost</th>
                    <th className="px-2">Costing</th>
                    <th className="py-2 pl-2 pr-4">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke-soft-200">
                  {a.movements.map((m) => {
                    const it = ITEM_BY_ID[m.itemId]
                    return (
                      <tr key={m.id} className="align-top">
                        <td className="whitespace-nowrap py-2 pl-4 pr-2 text-text-sub-600">{when(m.at)}</td>
                        <td className="mono whitespace-nowrap px-2 py-2 text-[12px] text-text-sub-600">{skuOf(m.itemId)}</td>
                        <td className="px-2 py-2">
                          <div className="font-medium text-text-strong-950">{it.name}</div>
                          <div className="text-[11.5px] text-text-sub-600">
                            {m.reason} · {m.by} · approved by {m.approvedBy}
                          </div>
                        </td>
                        <td className="tnum whitespace-nowrap px-2 py-2 text-right font-semibold">
                          +{qtyText(m.qty)} <span className="text-[11.5px] font-normal text-text-sub-600">{it.unit}</span>
                        </td>
                        <td className="tnum px-2 py-2 text-right text-text-sub-600">{money(m.unitCost)}</td>
                        <td className="tnum px-2 py-2 text-right font-medium">{money(m.qty * m.unitCost)}</td>
                        <td className="px-2 py-2 text-[12px] text-text-sub-600">STANDARD</td>
                        <td className="py-2 pl-2 pr-4">
                          <Chip tone="brand">To WIP</Chip>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stroke-soft-200">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="border-b border-stroke-soft-200 bg-bg-soft-50 text-left text-[11.5px] font-semibold text-text-sub-600">
                    <th className="py-2 pl-4 pr-2">SKU</th>
                    <th className="px-2">Description</th>
                    <th className="px-2 text-right">Net qty</th>
                    <th className="px-2 text-right">Movements</th>
                    <th className="py-2 pl-2 pr-4 text-right">Net value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke-soft-200">
                  {a.bySku.map((r) => {
                    const it = ITEM_BY_ID[r.itemId]
                    return (
                      <tr key={r.itemId}>
                        <td className="mono py-2 pl-4 pr-2 text-[12px] text-text-sub-600">{skuOf(r.itemId)}</td>
                        <td className="px-2 py-2 font-medium text-text-strong-950">{it.name}</td>
                        <td className="tnum px-2 py-2 text-right">
                          {qtyText(r.qty)} <span className="text-[11.5px] text-text-sub-600">{it.unit}</span>
                        </td>
                        <td className="tnum px-2 py-2 text-right text-text-sub-600">{r.moves}</td>
                        <td className="tnum py-2 pl-2 pr-4 text-right font-medium">{money(r.cost)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {a.specials.length > 0 && (
            <div className="rounded-xl border border-stroke-soft-200">
              <div className="border-b border-stroke-soft-200 bg-bg-soft-50 px-4 py-2 text-[12px] font-semibold text-text-sub-600">Special orders on this job · cost entered at approval</div>
              {a.specials.map(({ entry, s }) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-[13px]">
                  <span className="min-w-[200px] flex-1">
                    {s.item} × {qtyText(s.qty)} <span className="text-text-sub-600">· {s.vendor} · {dayLabel(entry.day, { short: true })}</span>
                  </span>
                  <span className="tnum font-medium">{s.cost ? money(s.cost) : <Chip tone="warn">No cost entered</Chip>}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' | 'ok' | 'error' }) {
  return (
    <div className="min-w-0 rounded-xl border border-stroke-soft-200 p-3.5">
      <div className="text-[12px] font-medium text-text-soft-400">{label}</div>
      <div
        className={cn(
          'tnum mt-1 text-[20px] font-semibold tracking-tight',
          tone === 'error' ? 'text-state-error-base' : tone === 'warn' ? 'text-state-warning-dark' : 'text-text-strong-950',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11.5px] text-text-sub-600">{sub}</div>}
    </div>
  )
}
