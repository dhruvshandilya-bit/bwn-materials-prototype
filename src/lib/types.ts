export interface Item {
  id: string
  category: string
  name: string
  /** Exact text on the client's paper sheet. */
  sheetName: string
  unit: string
  /** Quantity box for this item on the sheet (e.g. "C2"). */
  cell: string
  /** Sample average cost per unit (office only). */
  cost: number
  /** Sample shop stock at the start of the demo. */
  stock: number
  reorder: number
  aliases: string[]
}

/**
 * load = morning load-out, settled by the evening return (used = loaded − back).
 * used = no morning load; the chief says what the job used at the end of the day.
 */
export type EntryMode = 'load' | 'used'
/** on_truck: the morning load is in, the evening return is not. */
export type EntryStatus = 'draft' | 'on_truck' | 'pending' | 'approved' | 'sent_back'

export interface Line {
  itemId: string
  qty: number
  source: 'voice' | 'manual' | 'calc'
  /** Words the quantity came from, when it came from voice. */
  heard?: string
  /** Shown under the line, e.g. "1.5 tons = 50 buckets". */
  hint?: string
}

export interface SpecialOrder {
  id: string
  vendor: string
  item: string
  qty: number
  /** Entered by the office when approving. */
  cost?: number
}

/** One "Raw material used" movement written when the office approves. */
export interface PostedLine {
  itemId: string
  qty: number
  unitCost: number
}

/** One job day. */
export interface Entry {
  id: string
  jobId: string
  mode: EntryMode
  /** ISO date of the work day. */
  day: string
  status: EntryStatus
  /** load: what went on the truck. used: what the job used. */
  lines: Line[]
  /** load only: what came back to the shop, per item. */
  back?: Record<string, number>
  specials: SpecialOrder[]
  notes: string
  transcript?: string
  backTranscript?: string
  matchedBy?: 'ai' | 'device'
  createdAt: string
  loadedAt?: string
  submittedAt?: string
  reviewedAt?: string
  officeNote?: string
  posted?: PostedLine[]
}

export interface Job {
  id: string
  name: string
  customer: string
  address: string
  sNumber: string
  scope: string
  jobAmount: number
  /** BOM material budget (sample), the Budget card on Actuals. */
  materialBudget: number
  startDate: string
  plannedDays: number
  chief: string
  crew: string[]
  status: 'active' | 'complete'
  completedDate?: string
}

/** An asset movement as Merlin stores it: shop ON_HAND → the project's WIP bin. */
export interface Movement {
  id: string
  at: string
  itemId: string
  qty: number
  jobId: string
  unitCost: number
  entryId: string
  reason: string
  by: string
  approvedBy: string
}

export interface State {
  stock: Record<string, number>
  jobs: Job[]
  entries: Entry[]
  movements: Movement[]
}
