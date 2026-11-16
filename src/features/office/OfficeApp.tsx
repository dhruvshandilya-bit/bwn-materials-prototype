import { Boxes, CalendarDays, ClipboardCheck, FolderKanban, LayoutDashboard, Receipt, ShoppingCart, Wallet } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Toast, cn } from '@/components/ui'
import { useStore } from '@/lib/store'
import { Approvals } from './Approvals'
import { Inventory } from './Inventory'
import { ProjectActuals } from './ProjectActuals'

type Tab = 'approvals' | 'cost' | 'inventory'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: FolderKanban, label: 'Projects' },
  { icon: CalendarDays, label: 'Daily Logs' },
  { icon: Boxes, label: 'Materials', active: true },
  { icon: ShoppingCart, label: 'Purchasing' },
  { icon: Receipt, label: 'Invoices' },
  { icon: Wallet, label: 'Finance' },
]

export function OfficeApp() {
  const { state } = useStore()
  const [tab, setTab] = useState<Tab>('approvals')
  const [jobId, setJobId] = useState('kessler')
  const [toast, setToast] = useState<string | null>(null)
  const clear = useCallback(() => setToast(null), [])
  const pending = state.entries.filter((e) => e.status === 'pending').length
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'approvals', label: 'Approvals', badge: pending },
    { id: 'cost', label: 'Project actuals' },
    { id: 'inventory', label: 'Inventory' },
  ]
  return (
    <div className="relative flex h-full min-h-0">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-stroke-soft-200 bg-white lg:flex">
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">M</span>
          <span className="text-[15px] font-semibold">Merlin</span>
        </div>
        <nav className="space-y-0.5 px-2">
          {NAV.map(({ icon: Icon, label, active }) => (
            <div key={label}>
              <div className={cn('flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px]', active ? 'bg-brand-50 font-semibold text-brand-500' : 'text-text-sub-600')}>
                <Icon size={16} /> {label}
              </div>
              {active && (
                <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-stroke-soft-200 pl-3 text-[13px]">
                  <div className="flex h-8 items-center gap-2 font-semibold text-text-strong-950">
                    <ClipboardCheck size={14} /> Job materials
                  </div>
                  <div className="flex h-8 items-center text-text-sub-600">SKUs</div>
                  <div className="flex h-8 items-center text-text-sub-600">Stock take</div>
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-stroke-soft-200 p-4 text-[12px] text-text-sub-600">BWN · Production office</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-stroke-soft-200 bg-white px-[max(16px,env(safe-area-inset-left,0px))] pt-4 sm:px-6">
          <div className="text-[12px] text-text-sub-600">Materials</div>
          <h1 className="text-[20px] font-semibold tracking-tight text-text-strong-950">Job materials</h1>
          <div className="no-scrollbar -mb-px mt-3 flex gap-5 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] font-semibold',
                  tab === t.id ? 'border-brand-500 text-brand-500' : 'border-transparent text-text-sub-600 hover:text-text-strong-950',
                )}
              >
                {t.label}
                {!!t.badge && <span className="rounded-full bg-state-warning-base px-1.5 text-[11px] font-bold text-white">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-[max(16px,env(safe-area-inset-left,0px))] py-5 sm:px-6">
          <div className="mx-auto max-w-6xl">
            {tab === 'approvals' && <Approvals toast={setToast} />}
            {tab === 'cost' && <ProjectActuals toast={setToast} jobId={jobId} setJobId={setJobId} />}
            {tab === 'inventory' && <Inventory />}
          </div>
        </div>
      </div>
      <Toast text={toast} onDone={clear} />
    </div>
  )
}
