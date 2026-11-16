import { Minus, Plus, X } from 'lucide-react'
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { qtyText, statusLabel } from '@/lib/logic'
import type { EntryStatus } from '@/lib/types'

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-200',
  secondary: 'bg-brand-50 text-brand-500 hover:bg-brand-100',
  outline: 'border border-stroke-sub-300 bg-white text-text-strong-950 hover:bg-bg-weak-50',
  ghost: 'text-text-sub-600 hover:bg-bg-weak-50',
  danger: 'bg-white border border-state-error-light text-state-error-base hover:bg-state-error-lighter',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-12 px-5 text-[15px]' : 'h-10 px-4 text-sm'
  return (
    <button
      type="button"
      {...p}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed',
        VARIANT[variant],
        sz,
        className,
      )}
    />
  )
}

const STATUS_STYLE: Record<EntryStatus, string> = {
  draft: 'bg-bg-weak-50 text-text-sub-600 ring-stroke-soft-200',
  on_truck: 'bg-state-blue-lighter text-state-blue-dark ring-state-blue-light',
  pending: 'bg-state-warning-lighter text-state-warning-dark ring-state-warning-light',
  approved: 'bg-state-success-lighter text-state-success-dark ring-state-success-light',
  sent_back: 'bg-state-error-lighter text-state-error-dark ring-state-error-light',
}

export function StatusPill({ status, className }: { status: EntryStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset', STATUS_STYLE[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {statusLabel[status]}
    </span>
  )
}

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'blue' | 'warn' | 'ok' | 'error'; className?: string }) {
  const t = {
    neutral: 'bg-bg-weak-50 text-text-sub-600',
    brand: 'bg-brand-50 text-brand-500',
    blue: 'bg-state-blue-lighter text-state-blue-dark',
    warn: 'bg-state-warning-lighter text-state-warning-dark',
    ok: 'bg-state-success-lighter text-state-success-dark',
    error: 'bg-state-error-lighter text-state-error-dark',
  }[tone]
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', t, className)}>{children}</span>
}

/** − qty + with tap-to-type. Accepts decimals (half a pail, 2.5 bags). */
export function Stepper({ value, onChange, unit, step = 1, compact }: { value: number; onChange: (n: number) => void; unit?: string; step?: number; compact?: boolean }) {
  const [txt, setTxt] = useState(qtyText(value))
  useEffect(() => setTxt(qtyText(value)), [value])
  const set = (n: number) => onChange(Math.max(0, Math.round(n * 100) / 100))
  return (
    <div className="flex items-center gap-1">
      {!compact && <button
        type="button"
        aria-label="Less"
        onClick={() => set(value - step)}
        className="grid h-8 w-8 place-items-center rounded-lg border border-stroke-soft-200 bg-white text-text-sub-600 active:bg-bg-weak-50"
      >
        <Minus size={15} />
      </button>}
      <input
        inputMode="decimal"
        aria-label={unit ? `Quantity in ${unit}` : 'Quantity'}
        value={txt}
        onChange={(e) => {
          setTxt(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n)) set(n)
        }}
        onBlur={() => setTxt(qtyText(value))}
        onFocus={(e) => e.target.select()}
        className="tnum h-8 w-12 rounded-lg border border-stroke-soft-200 bg-white text-center text-[15px] font-semibold text-text-strong-950"
      />
      {!compact && <button
        type="button"
        aria-label="More"
        onClick={() => set(value + step)}
        className="grid h-8 w-8 place-items-center rounded-lg border border-stroke-soft-200 bg-white text-text-sub-600 active:bg-bg-weak-50"
      >
        <Plus size={15} />
      </button>}
    </div>
  )
}

/** Bottom sheet for the phone app, centered dialog on wide screens. */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn('animate-sheet flex max-h-[88%] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
      >
        <div className="flex items-center justify-between border-b border-stroke-soft-200 px-4 py-3">
          <h3 className="text-[15px] font-semibold text-text-strong-950">{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-text-sub-600 hover:bg-bg-weak-50">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-stroke-soft-200 p-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Toast({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!text) return
    const t = setTimeout(onDone, 3600)
    return () => clearTimeout(t)
  }, [text, onDone])
  if (!text) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div role="status" className="animate-in rounded-xl bg-text-strong-950 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
        {text}
      </div>
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-4">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-sub-600">{children}</h3>
      {right}
    </div>
  )
}
