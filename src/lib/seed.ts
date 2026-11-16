import { ITEMS } from './items'
import { approveEntry } from './logic'
import type { Entry, Job, Line, State } from './types'

// Made-up jobs and people for the demo. Item names come from BWN's sheet; costs and stock are samples.
export const JOBS: Job[] = [
  {
    id: 'kessler',
    name: 'Kessler residence',
    customer: 'Dana Kessler',
    address: '18 Orchard Way',
    sNumber: 'S-24187',
    scope: 'Interior drainage 112 LF · M63 sump pump with 508 battery backup',
    jobAmount: 14850,
    materialBudget: 2600,
    startDate: '2026-11-13',
    plannedDays: 3,
    chief: 'Marcus Bell',
    crew: ['Dev Patel', 'Luis Ortega'],
    status: 'active',
  },
  {
    id: 'ramos',
    name: 'Ramos residence',
    customer: 'Elena Ramos',
    address: '77 Linden Court',
    sNumber: 'S-24192',
    scope: 'Crawl space encapsulation 1,450 sq ft · drainage mat',
    jobAmount: 9600,
    materialBudget: 3400,
    startDate: '2026-11-16',
    plannedDays: 2,
    chief: 'Marcus Bell',
    crew: ['Dev Patel', 'Sam Whitlock'],
    status: 'active',
  },
  {
    id: 'whitaker',
    name: 'Whitaker basement',
    customer: 'Tom Whitaker',
    address: '5 Quarry Road',
    sNumber: 'S-24170',
    scope: 'Wall stabilization · 6 carbon fiber straps · crack injection',
    jobAmount: 7200,
    materialBudget: 1500,
    startDate: '2026-11-11',
    plannedDays: 2,
    chief: 'Marcus Bell',
    crew: ['Luis Ortega'],
    status: 'complete',
    completedDate: '2026-11-12',
  },
]

const L = (pairs: [string, number][], source: Line['source'] = 'manual'): Line[] =>
  pairs.map(([itemId, qty]) => ({ itemId, qty, source }))

const ENTRIES: Entry[] = [
  // Kessler day 1: morning load, evening return, approved.
  {
    id: 'e-k1',
    jobId: 'kessler',
    mode: 'load',
    day: '2026-11-13',
    status: 'pending',
    lines: L([
      ['stone', 99], ['3-ads-pipe', 120], ['drain-board', 120], ['filter-fabric', 120],
      ['contractor-bags', 20], ['4-mil-plastic', 2], ['sakrete', 4],
    ], 'voice'),
    back: { stone: 59, '3-ads-pipe': 60, 'drain-board': 60, 'filter-fabric': 60, 'contractor-bags': 8, '4-mil-plastic': 1, sakrete: 4 },
    specials: [],
    notes: 'Broke out the east and north walls. Trench open on the west side.',
    transcript: 'Loading for Kessler: three tons of stone, a hundred and twenty feet of ADS, drain board and fabric, twenty contractor bags, two rolls of four mil plastic and four bags of Sakrete.',
    backTranscript: 'Brought back fifty nine buckets of stone, sixty feet of ADS, sixty of drain board and sixty of fabric, eight contractor bags, one roll of plastic and all four Sakrete.',
    matchedBy: 'ai',
    createdAt: '2026-11-13T07:05:00',
    loadedAt: '2026-11-13T07:10:00',
    submittedAt: '2026-11-13T16:05:00',
  },
  // Kessler day 2 (today): the truck is loaded, the evening return is not in yet.
  {
    id: 'e-k2',
    jobId: 'kessler',
    mode: 'load',
    day: '2026-11-16',
    status: 'on_truck',
    lines: L([
      ['stone', 66], ['3-ads-pipe', 60], ['drain-board', 60], ['filter-fabric', 60],
      ['m63-sump-pump', 1], ['20-pit-liner', 1], ['20-pit-cover', 1], ['in-line-check-valve', 1],
      ['1-5-pvc-pipe', 20], ['1-5-90-elbow', 4], ['pvc-glue', 1], ['pvc-cleaner', 1],
      ['contractor-bags', 10], ['sakrete', 6],
    ], 'voice'),
    back: {},
    specials: [],
    notes: '',
    transcript: 'Two tons of stone, sixty feet of ADS, drain board and fabric. The M63 with a twenty inch pit liner and cover, an inline check valve, twenty feet of inch and a half PVC, four nineties, glue and cleaner, ten contractor bags and six bags of Sakrete.',
    matchedBy: 'ai',
    createdAt: '2026-11-16T07:02:00',
    loadedAt: '2026-11-16T07:10:00',
  },
  // Whitaker day 1: used only, approved.
  {
    id: 'e-w1',
    jobId: 'whitaker',
    mode: 'used',
    day: '2026-11-11',
    status: 'pending',
    lines: L([['carbon-fiber-straps', 3], ['neck-ties', 3], ['grid-stitch', 6], ['fortress-epoxy', 2], ['contractor-bags', 2]], 'voice'),
    specials: [],
    notes: '',
    transcript: 'Day one at Whitaker, three carbon fiber straps with three neck ties, six grid stitches, two tubes of Fortress epoxy and two contractor bags.',
    matchedBy: 'ai',
    createdAt: '2026-11-11T16:40:00',
    submittedAt: '2026-11-11T16:42:00',
  },
  // Whitaker day 2: used only, waiting for the office.
  {
    id: 'e-w2',
    jobId: 'whitaker',
    mode: 'used',
    day: '2026-11-12',
    status: 'pending',
    lines: L([
      ['carbon-fiber-straps', 3], ['neck-ties', 3], ['grid-stitch', 6], ['fortress-epoxy', 3],
      ['2500-epoxy', 4], ['5-8-ports', 18], ['hydraulic-cement', 1], ['blue-tape', 1],
      ['contractor-bags', 2], ['yard-sign-with-stakes', 1],
    ], 'voice'),
    specials: [{ id: 'sp-w1', vendor: 'Fortress Stabilization', item: 'Wall plate kit', qty: 2 }],
    notes: 'North wall was bowing more than the estimate showed, so the two straps there took extra epoxy.',
    transcript:
      'Whitaker is done. Today three more straps with three neck ties, six grid stitches, three tubes of Fortress epoxy, four of the 2500 epoxy and eighteen ports. One pail of hydro, a roll of blue tape, two contractor bags and the yard sign. Special order two wall plate kits from Fortress.',
    matchedBy: 'ai',
    createdAt: '2026-11-12T17:30:00',
    submittedAt: '2026-11-12T17:34:00',
  },
]

export function seedState(): State {
  let s: State = {
    stock: Object.fromEntries(ITEMS.map((i) => [i.id, i.stock])),
    jobs: JOBS,
    entries: ENTRIES,
    movements: [],
  }
  s = approveEntry(s, 'e-k1', {}, '2026-11-13T17:20:00')
  s = approveEntry(s, 'e-w1', {}, '2026-11-12T08:10:00')
  return s
}
