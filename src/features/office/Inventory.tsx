import { ArrowRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Chip, cn } from '@/components/ui'
import { CATEGORIES, ITEMS, ITEM_BY_ID } from '@/lib/items'
import { money, moneyShort, outToday, qtyText, round, skuOf } from '@/lib/logic'
import { norm } from '@/lib/parse'
import { useStore } from '@/lib/store'

export function Inventory() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const rows = useMemo(() => {
    const nq = norm(q)
    return ITEMS.map((i) => {
      const shop = state.stock[i.id] ?? 0
      const onJob = outToday(state, i.id)
      return { i, shop, onJob, low: shop <= i.reorder, value: round(shop * i.cost) }
    }).filter((r) => (!cat || r.i.category === cat) && (!lowOnly || r.low) && (!nq || norm(`${r.i.name} ${r.i.sheetName}`).includes(nq)))
  }, [state, q, cat, lowOnly])
  const totalShop = round(ITEMS.reduce((s, i) => s + (state.stock[i.id] ?? 0) * i.cost, 0))
  const totalJobs = round(ITEMS.reduce((s, i) => s + outToday(state, i.id) * i.cost, 0))
  const lowCount = ITEMS.filter((i) => (state.stock[i.id] ?? 0) <= i.reorder).length
  const moves = state.movements.slice(0, 14)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Shop stock value" value={moneyShort(totalShop)} />
        <Tile label="Loaded on trucks today" value={moneyShort(totalJobs)} />
        <Tile label="Items at or below reorder" value={String(lowCount)} warn={lowCount > 0} onClick={() => setLowOnly(true)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-stroke-soft-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-stroke-soft-200 p-3">
            <label className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-stroke-sub-300 px-3">
              <Search size={15} className="text-icon-soft-400" />
              <input id="inv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" className="w-full bg-transparent text-[13px] outline-none" />
            </label>
            <select id="inv-cat" value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-lg border border-stroke-sub-300 bg-white px-2 text-[13px]">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-[13px] text-text-sub-600">
              <input id="inv-low" type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="h-4 w-4 accent-[#5d2f70]" />
              Low stock only
            </label>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-stroke-soft-200 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-text-sub-600">
                  <th className="py-2 pl-4 pr-2">Item</th>
                  <th className="px-2 text-right">In shop</th>
                  <th className="px-2 text-right">On trucks today</th>
                  <th className="px-2">Unit</th>
                  <th className="px-2 text-right">Avg cost</th>
                  <th className="px-2 text-right">Value</th>
                  <th className="py-2 pl-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke-soft-200">
                {rows.map(({ i, shop, onJob, low, value }) => (
                  <tr key={i.id} className={cn(low && 'bg-state-warning-lighter/40')}>
                    <td className="py-2 pl-4 pr-2">
                      <div className="font-medium text-text-strong-950">{i.name}</div>
                      <div className="text-[11.5px] text-text-sub-600"><span className="mono">{skuOf(i.id)}</span> · {i.category}</div>
                    </td>
                    <td className={cn('tnum px-2 text-right font-semibold', shop < 0 && 'text-state-error-base')}>{qtyText(shop)}</td>
                    <td className="tnum px-2 text-right text-text-sub-600">{onJob ? qtyText(onJob) : '–'}</td>
                    <td className="px-2 text-text-sub-600">{i.unit}</td>
                    <td className="tnum px-2 text-right text-text-sub-600">{money(i.cost)}</td>
                    <td className="tnum px-2 text-right">{money(value)}</td>
                    <td className="py-2 pl-2 pr-4">{low ? <Chip tone="warn">Reorder · min {i.reorder}</Chip> : <Chip tone="ok">OK</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="p-6 text-center text-[13px] text-text-sub-600">No items match.</p>}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stroke-soft-200 bg-white">
          <div className="border-b border-stroke-soft-200 px-4 py-3">
            <h3 className="text-[14px] font-semibold text-text-strong-950">Asset movements</h3>
            <p className="text-[12px] text-text-sub-600">Raw material used · written when the office approves a day</p>
          </div>
          <ul className="max-h-[560px] divide-y divide-stroke-soft-200 overflow-y-auto">
            {moves.map((m) => {
              const job = state.jobs.find((j) => j.id === m.jobId)
              return (
                <li key={m.id} className="px-4 py-2.5 text-[12.5px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium text-text-strong-950">{ITEM_BY_ID[m.itemId].name}</span>
                    <span className="tnum shrink-0 font-semibold">
                      {qtyText(m.qty)} {ITEM_BY_ID[m.itemId].unit}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-text-sub-600">
                    Shop on hand <ArrowRight size={11} /> {job?.name ?? 'Job'} WIP
                    <span className="tnum ml-auto">{money(m.qty * m.unitCost)}</span>
                  </div>
                </li>
              )
            })}
            {!moves.length && <li className="p-6 text-center text-[12.5px] text-text-sub-600">No movements yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, warn, onClick }: { label: string; value: string; warn?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="rounded-2xl border border-stroke-soft-200 bg-white p-4 text-left">
      <div className="text-[12px] text-text-sub-600">{label}</div>
      <div className={cn('tnum mt-0.5 text-[22px] font-semibold tracking-tight', warn ? 'text-state-warning-dark' : 'text-text-strong-950')}>{value}</div>
    </Tag>
  )
}
