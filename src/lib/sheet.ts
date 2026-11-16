import { buildPdf, buildXlsx, type SheetData } from './export'
import { saveFile } from './claude'
import { dayLabel, jobDays, jobUsed, moneyShort, usedLines } from './logic'
import type { Entry, Job, State } from './types'

const fmtDate = (iso?: string) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''

/** The paper sheet's single quantity column holds material USED, for one day or the whole job. */
export function sheetData(state: State, job: Job, opts: { entry?: Entry; office?: boolean } = {}): SheetData {
  const { entry, office } = opts
  const entries = entry ? [entry] : state.entries.filter((e) => e.jobId === job.id && e.status !== 'draft' && e.status !== 'on_truck')
  const quantities = entry ? Object.fromEntries(usedLines(entry).map((l) => [l.itemId, l.qty])) : jobUsed(state, job.id)
  const specials = entries.flatMap((e) => e.specials.map((s) => ({ vendor: s.vendor, item: s.item, qty: s.qty })))
  const notes = entries
    .filter((e) => e.notes.trim())
    .map((e) => (entries.length > 1 ? `${dayLabel(e.day, { short: true })}: ${e.notes.trim()}` : e.notes.trim()))
    .join('  ')
  const workDays = new Set(state.entries.filter((e) => e.jobId === job.id).map((e) => e.day)).size
  const days = entry ? '1' : String(Math.max(workDays, job.completedDate ? jobDays(job).length : 0) || job.plannedDays)
  const scope = entry ? `Used · ${dayLabel(entry.day, { short: true })}` : 'Whole job'
  return {
    quantities,
    specials,
    notes,
    chief: job.chief,
    jobName: `${job.name}, ${job.address}`,
    sNumber: job.sNumber,
    completionDate: fmtDate(job.completedDate),
    crew: job.crew.join(', '),
    days,
    jobAmount: office ? moneyShort(job.jobAmount) : undefined,
    caption: `${job.name} · ${job.sNumber} · ${scope}`,
  }
}

export async function downloadSheet(state: State, job: Job, format: 'xlsx' | 'pdf', opts: { entry?: Entry; office?: boolean } = {}) {
  const data = sheetData(state, job, opts)
  const blob = format === 'xlsx' ? await buildXlsx(data) : buildPdf(data)
  const part = opts.entry ? opts.entry.day : 'whole-job'
  const name = `Materials Sheet ${job.sNumber} ${job.name} ${part}.${format}`
  return saveFile(name, blob)
}

export const downloadMessage = (r: 'saved' | 'declined' | 'unavailable', format: string) =>
  r === 'saved' ? `${format.toUpperCase()} sheet saved` : r === 'declined' ? 'Download cancelled' : 'Downloads are not available in this view'
