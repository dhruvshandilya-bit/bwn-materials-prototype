import { ITEMS, ITEM_BY_ID } from './items'
import type { Entry, Job, Line, Movement, PostedLine, State } from './types'

export const DEMO_TODAY = '2026-11-16'
export const DEMO_NOW = '2026-11-16T16:40:00'

export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}`

export const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const moneyShort = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const qtyText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
export function dayLabel(day: string, opts: { short?: boolean } = {}) {
  const d = new Date(day + 'T12:00:00')
  const txt = d.toLocaleDateString('en-US', DAY_FMT)
  if (opts.short) return txt
  return day === DEMO_TODAY ? `Today · ${txt}` : txt
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Working days of a job up to today (skips weekends), for the day picker. */
export function jobDays(job: Job): string[] {
  const days: string[] = []
  let d = job.startDate
  const end = job.completedDate ?? DEMO_TODAY
  while (d <= end && days.length < 14) {
    const wd = new Date(d + 'T12:00:00').getDay()
    if (wd !== 0 && wd !== 6) days.push(d)
    d = addDays(d, 1)
  }
  return days
}

export function dayNumber(job: Job, day: string) {
  const i = jobDays(job).indexOf(day)
  return i < 0 ? null : i + 1
}

export const modeLabel: Record<Entry['mode'], string> = {
  load: 'Morning load and return',
  used: 'Used today',
}

export const statusLabel: Record<Entry['status'], string> = {
  draft: 'Draft',
  on_truck: 'Waiting for return',
  pending: 'Waiting for approval',
  approved: 'Approved',
  sent_back: 'Sent back',
}

export function mergeLines(lines: Line[]): Line[] {
  const map = new Map<string, Line>()
  for (const l of lines) {
    if (!(l.qty > 0)) continue
    const prev = map.get(l.itemId)
    if (prev) map.set(l.itemId, { ...prev, qty: round(prev.qty + l.qty, 3), heard: [prev.heard, l.heard].filter(Boolean).join(' · ') || undefined })
    else map.set(l.itemId, { ...l })
  }
  return [...map.values()]
}

const SKU = new Map(ITEMS.map((it, i) => [it.id, `BWN-${String(i + 1).padStart(3, '0')}`]))
export const skuOf = (itemId: string) => SKU.get(itemId) ?? itemId

/** What the day used: the used-only list, or loaded − back for a load day. */
export function usedLines(e: Entry): Line[] {
  if (e.mode === 'used') return e.lines
  return e.lines
    .map((l) => ({ ...l, qty: Math.max(0, round(l.qty - (e.back?.[l.itemId] ?? 0), 3)), source: 'calc' as const, hint: undefined }))
    .filter((l) => l.qty > 0)
}

// ---------------------------------------------------------------- posting

export const RAW_MATERIAL_USED = 'Raw material used'

/**
 * Office approval. Writes one "Raw material used" movement per item (shop ON_HAND → the job's
 * WIP), takes it out of shop stock, and freezes the cost on the day.
 */
export function approveEntry(state: State, entryId: string, specialCosts: Record<string, number> = {}, at = DEMO_NOW, approvedBy = 'Priya Shah'): State {
  const entry = state.entries.find((e) => e.id === entryId)
  if (!entry || entry.status === 'approved') return state
  const job = state.jobs.find((j) => j.id === entry.jobId)
  const stock = { ...state.stock }
  const movements: Movement[] = []
  const posted: PostedLine[] = []
  for (const l of usedLines(entry)) {
    const unitCost = ITEM_BY_ID[l.itemId]?.cost ?? 0
    stock[l.itemId] = round((stock[l.itemId] ?? 0) - l.qty, 3)
    posted.push({ itemId: l.itemId, qty: l.qty, unitCost })
    movements.push({
      id: uid('mv'),
      at,
      itemId: l.itemId,
      qty: l.qty,
      jobId: entry.jobId,
      unitCost,
      entryId: entry.id,
      reason: `${RAW_MATERIAL_USED} · ${dayLabel(entry.day, { short: true })}`,
      by: job?.chief ?? '',
      approvedBy,
    })
  }
  const specials = entry.specials.map((s) => ({ ...s, cost: specialCosts[s.id] ?? s.cost }))
  const entries = state.entries.map((e) =>
    e.id === entryId ? { ...e, status: 'approved' as const, reviewedAt: at, posted, specials, officeNote: undefined } : e,
  )
  return { ...state, stock, entries, movements: [...movements, ...state.movements] }
}

export function sendBack(state: State, entryId: string, note: string, at = DEMO_NOW): State {
  return {
    ...state,
    entries: state.entries.map((e) => (e.id === entryId ? { ...e, status: 'sent_back', officeNote: note, reviewedAt: at } : e)),
  }
}

// ---------------------------------------------------------------- summaries

/** Used per item across a job's days that were sent to the office (drafts and open loads excluded). */
export function jobUsed(state: State, jobId: string, opts: { approvedOnly?: boolean } = {}) {
  const totals: Record<string, number> = {}
  for (const e of state.entries) {
    if (e.jobId !== jobId || e.status === 'draft' || e.status === 'on_truck') continue
    if (opts.approvedOnly && e.status !== 'approved') continue
    for (const l of usedLines(e)) totals[l.itemId] = round((totals[l.itemId] ?? 0) + l.qty, 3)
  }
  return totals
}

export function lineCost(l: Line) {
  return round(l.qty * (ITEM_BY_ID[l.itemId]?.cost ?? 0))
}

export function specialsCost(e: Entry) {
  return e.specials.reduce((s, x) => s + (x.cost ?? 0), 0)
}

export function entryCost(e: Entry) {
  if (e.posted) return round(e.posted.reduce((s, p) => s + p.qty * p.unitCost, 0) + specialsCost(e))
  return round(usedLines(e).reduce((s, l) => s + lineCost(l), 0) + specialsCost(e))
}

/** The project's Actuals: approved movements plus what is still waiting. */
export function projectActuals(state: State, jobId: string) {
  const movements = state.movements.filter((m) => m.jobId === jobId)
  const materials = round(movements.reduce((s, m) => s + m.qty * m.unitCost, 0))
  const specials = state.entries
    .filter((e) => e.jobId === jobId && e.status === 'approved')
    .flatMap((e) => e.specials.map((s) => ({ entry: e, s })))
  const specialsTotal = round(specials.reduce((s, x) => s + (x.s.cost ?? 0), 0))
  const waiting = state.entries.filter((e) => e.jobId === jobId && e.status === 'pending')
  const bySku = new Map<string, { itemId: string; qty: number; cost: number; moves: number }>()
  for (const m of movements) {
    const r = bySku.get(m.itemId) ?? { itemId: m.itemId, qty: 0, cost: 0, moves: 0 }
    r.qty = round(r.qty + m.qty, 3)
    r.cost = round(r.cost + m.qty * m.unitCost)
    r.moves += 1
    bySku.set(m.itemId, r)
  }
  return {
    movements,
    bySku: [...bySku.values()].sort((a, b) => b.cost - a.cost),
    materials,
    specials,
    specialsTotal,
    actual: round(materials + specialsTotal),
    waiting,
    waitingCost: round(waiting.reduce((s, e) => s + entryCost(e), 0)),
  }
}

export function lowStock(state: State) {
  return ITEMS.filter((i) => (state.stock[i.id] ?? 0) <= i.reorder)
}

/** Loaded this morning and not settled yet: in Merlin this is still shop stock. */
export function outToday(state: State, itemId: string) {
  return round(
    state.entries.filter((e) => e.status === 'on_truck').reduce((s, e) => s + (e.lines.find((l) => l.itemId === itemId)?.qty ?? 0), 0),
    3,
  )
}
