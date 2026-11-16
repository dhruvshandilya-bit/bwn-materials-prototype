import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Sheet, cn } from '@/components/ui'
import { CATEGORIES, ITEMS } from '@/lib/items'
import { norm } from '@/lib/parse'

export function ItemPicker({
  open,
  onClose,
  onPick,
  title = 'Pick an item from the sheet',
  hint,
}: {
  open: boolean
  onClose: () => void
  onPick: (itemId: string) => void
  title?: string
  hint?: string
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setQ('')
      setCat(null)
    }
  }, [open])
  const list = useMemo(() => {
    const nq = norm(q)
    return ITEMS.filter((i) => (!cat || i.category === cat) && (!nq || norm(`${i.name} ${i.sheetName} ${i.aliases.join(' ')}`).includes(nq)))
  }, [q, cat])
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="sticky top-0 z-10 space-y-2 border-b border-stroke-soft-200 bg-white p-3">
        {hint && <p className="rounded-lg bg-state-warning-lighter px-3 py-2 text-[12.5px] text-state-warning-dark">Heard: “{hint}”</p>}
        <label className="flex h-10 items-center gap-2 rounded-lg border border-stroke-sub-300 px-3">
          <Search size={16} className="text-icon-soft-400" />
          <input
            id="item-search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 91 items"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
          {[null, ...CATEGORIES].map((c) => (
            <button
              key={c ?? 'all'}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                'whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-medium',
                cat === c ? 'border-brand-500 bg-brand-500 text-white' : 'border-stroke-soft-200 bg-white text-text-sub-600',
              )}
            >
              {c ?? 'All'}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-stroke-soft-200">
        {list.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => {
                onPick(i.id)
                setQ('')
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-bg-weak-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-text-strong-950">{i.name}</span>
                <span className="text-[12px] text-text-sub-600">{i.category}</span>
              </span>
              <span className="shrink-0 text-[12px] text-text-soft-400">{i.unit}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="px-4 py-6 text-center text-[13px] text-text-sub-600">No item matches “{q}”. Add it as a special order instead.</li>}
      </ul>
    </Sheet>
  )
}
