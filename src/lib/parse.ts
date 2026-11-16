// On-device fallback that turns a spoken materials note into sheet lines.
// The published prototype asks Claude first (see ai.ts); this runs when that is unavailable.
import { ITEMS, ITEM_BY_ID } from './items'
import { mergeLines, round, uid } from './logic'
import type { Line } from './types'

export interface Unmatched {
  id: string
  heard: string
  qty: number | null
  special?: boolean
  vendor?: string | null
}

export interface ParseResult {
  lines: Line[]
  unmatched: Unmatched[]
}

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  couple: 2, dozen: 12,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }

const UNIT_WORDS = new Set([
  'feet', 'foot', 'ft', 'bucket', 'buckets', 'ton', 'tons', 'bag', 'bags', 'roll', 'rolls', 'tube', 'tubes', 'pail', 'pails',
  'gallon', 'gallons', 'sheet', 'sheets', 'can', 'cans', 'pack', 'packs', 'box', 'boxes', 'piece', 'pieces', 'each',
  'stick', 'sticks', 'strap', 'kit', 'kits', 'of', 'lf',
])

const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'we', 'i', 'used', 'use', 'using', 'took', 'take', 'taken', 'loaded', 'load', 'put', 'in', 'on',
  'at', 'to', 'it', 'today', 'about', 'around', 'roughly', 'some', 'more', 'another', 'also', 'for', 'job', 'whole', 'set',
  'installed', 'install', 'ran', 'run', 'went', 'through', 'with', 'our', 'my', 'got', 'had', 'finished', 'did', 'wall',
  'west', 'east', 'north', 'south', 'side', 'up', 'out', 'is', 'was', 'were', 'that', 'this', 'there', 'them', 'those',
  'all', 'day', 'one', 'just', 'over', 'from', 'shop', 'truck', 'like', 'so', 'then', 'plus', 'yesterday', 'tomorrow',
])

const NUM_RE = /^\d+(?:\.\d+)?$|^\d+\/\d+$/

function toNumber(tok: string) {
  if (tok.includes('/')) {
    const [a, b] = tok.split('/').map(Number)
    return b ? a / b : NaN
  }
  return Number(tok)
}

function wordsToNumbers(text: string) {
  const toks = text.split(' ')
  const out: string[] = []
  for (let i = 0; i < toks.length; ) {
    const w = toks[i]
    if (w in SMALL || w in TENS) {
      let total = 0
      let cur = 0
      let j = i
      while (j < toks.length) {
        const t = toks[j]
        if (t in SMALL) cur += SMALL[t]
        else if (t in TENS) cur += TENS[t]
        else if (t === 'hundred') cur = (cur || 1) * 100
        else if (t === 'thousand') {
          total += (cur || 1) * 1000
          cur = 0
        } else if (t === 'and' && (total || cur >= 100) && (toks[j + 1] in SMALL || toks[j + 1] in TENS)) {
          /* "one hundred and twenty" */
        } else break
        j++
      }
      out.push(String(total + cur))
      i = j
    } else {
      out.push(w)
      i++
    }
  }
  return out.join(' ')
}

/** Lowercases and rewrites sizes so speech and sheet names compare: 3" and "three inch" both become 3in. */
export function norm(s: string) {
  let t = ` ${s.toLowerCase()} `
    .replace(/[’`]/g, "'")
    .replace(/°/g, '')
    .replace(/(\d)\s*(?:"|''|”|“)/g, '$1in ')
    .replace(/[-–—]/g, ' ')
    .replace(/\.(?=\s|$)/g, ' ; ')
    .replace(/[,;]/g, ' ; ')
    .replace(/[^a-z0-9./;' ]/g, ' ')
    .replace(/'/g, ' ')
    .replace(/\binch and a half\b/g, '1.5 inch')
    .replace(/\binch and half\b/g, '1.5 inch')
    .replace(/\bnineties\b/g, '90s')
    .replace(/\bforty fives?\b/g, '45s')
    .replace(/\s+/g, ' ')
  t = wordsToNumbers(t.trim())
  t = ` ${t} `
    .replace(/\b(\d+) and a half\b/g, (_, n) => String(Number(n) + 0.5))
    .replace(/\ba (\w+) and a half\b/g, '1.5 $1')
    .replace(/\bhalf (?:a|an) /g, '0.5 ')
    .replace(/(\d+(?:\.\d+)?|\d+\/\d+)\s*(?:inches|inch)\b/g, '$1in')
    .replace(/\bm (\d+)\b/g, 'm$1')
    .replace(/\s+/g, ' ')
    .trim()
  return t
}

interface AliasEntry {
  itemId: string
  phrase: string
  numeric: boolean
}

const ALIASES: AliasEntry[] = ITEMS.flatMap((it) => {
  const phrases = new Set([norm(it.name), norm(it.sheetName), ...it.aliases.map(norm)])
  return [...phrases].filter(Boolean).map((phrase) => ({ itemId: it.id, phrase, numeric: /^\d+$/.test(phrase) }))
}).sort((a, b) => b.phrase.length - a.phrase.length)

const SINGLE_WORD = ALIASES.filter((a) => !a.phrase.includes(' ') && a.phrase.length >= 5 && !a.numeric)

function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return 2
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

interface Hit {
  itemId: string
  start: number
  end: number
}

function findItems(clause: string): Hit[] {
  const hits: Hit[] = []
  const taken = (s: number, e: number) => hits.some((h) => s < h.end && e > h.start)
  for (const a of ALIASES) {
    const re = new RegExp(`(?:^| )(${a.phrase.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')})(?= |$)`, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(clause))) {
      const start = m.index + (m[0].length - m[1].length)
      const end = start + m[1].length
      if (a.numeric) {
        const next = clause.slice(end).trim().split(' ')[0]
        if (UNIT_WORDS.has(next)) continue
      }
      if (!taken(start, end)) hits.push({ itemId: a.itemId, start, end })
    }
  }
  if (!hits.length) {
    // tolerate one-letter speech slips on longer names ("sackrete", "fernko")
    let pos = 0
    for (const w of clause.split(' ')) {
      if (w.length >= 5 && !STOP.has(w)) {
        const a = SINGLE_WORD.find((x) => editDistance(w, x.phrase) <= 1)
        if (a) hits.push({ itemId: a.itemId, start: pos, end: pos + w.length })
      }
      pos += w.length + 1
    }
  }
  // "the 508 battery backup" hits one item twice; keep one span
  const sorted = hits.sort((a, b) => a.start - b.start)
  return sorted.filter((h, i) => {
    const prev = sorted[i - 1]
    if (prev && prev.itemId === h.itemId && h.start - prev.end <= 2) {
      prev.end = h.end
      return false
    }
    return true
  })
}

function pretty(s: string) {
  return s.replace(/(\d)in\b/g, '$1"').trim()
}

function convert(itemId: string, qty: number, unitWord: string | undefined) {
  const it = ITEM_BY_ID[itemId]
  if (itemId === 'stone' && (unitWord === 'ton' || unitWord === 'tons')) {
    const q = Math.round(qty * 33)
    return { qty: q, hint: `${qty} ton${qty === 1 ? '' : 's'} × 33 = ${q} buckets` }
  }
  if (it.unit === 'bag (100)' && unitWord !== 'bag' && unitWord !== 'bags' && qty >= 50) {
    const q = round(qty / 100, 1)
    return { qty: q, hint: `${qty} anchors = ${q} bag${q === 1 ? '' : 's'} of 100` }
  }
  if (itemId === 'flexi-seal-roll-4-x100' && (unitWord === 'roll' || unitWord === 'rolls')) {
    return { qty: qty * 100, hint: `${qty} roll${qty === 1 ? '' : 's'} × 100 ft` }
  }
  return { qty }
}

export function parseLocal(text: string): ParseResult {
  const lines: Line[] = []
  const unmatched: Unmatched[] = []
  const clauses = norm(text)
    .split(/ ?; ?| and (?!a half)| plus | also | then | with /)
    .map((c) => c.trim())
    .filter(Boolean)
  let lastQty: number | null = null

  for (const clause of clauses) {
    const hits = findItems(clause)
    const words = clause.split(' ')
    if (!hits.length) {
      const nums = words.filter((w) => NUM_RE.test(w))
      const content = words.filter((w) => !STOP.has(w) && !UNIT_WORDS.has(w) && !NUM_RE.test(w) && w.length > 2)
      const special = /\bspecial order\b|\bordered\b/.test(clause)
      if ((nums.length || special) && content.length) {
        unmatched.push({ id: uid('u'), heard: pretty(clause.replace(/^(?:(?:also|and|plus|then|we|i|used|took|loaded) )+/, '')), qty: nums.length ? toNumber(nums[0]) : null, special })
      }
      continue
    }
    let prevEnd = 0
    hits.forEach((h, idx) => {
      const before = clause.slice(prevEnd, h.start).trim().split(' ').filter(Boolean)
      const after = clause.slice(h.end, hits[idx + 1]?.start ?? clause.length).trim().split(' ').filter(Boolean)
      let qty: number | null = null
      let unitWord: string | undefined
      for (let i = before.length - 1; i >= 0; i--) {
        if (NUM_RE.test(before[i])) {
          qty = toNumber(before[i])
          unitWord = before.slice(i + 1).find((w) => UNIT_WORDS.has(w) && w !== 'of')
          break
        }
      }
      if (qty === null && NUM_RE.test(after[0] ?? '')) {
        qty = toNumber(after[0])
        unitWord = after[1]
      }
      let hint: string | undefined
      if (qty === null) {
        const article = before.some((w) => w === 'a' || w === 'an' || w === 'one' || w === 'the')
        const short = before.filter((w) => !STOP.has(w)).length === 0
        if (!article && short && lastQty !== null && idx === 0) {
          qty = lastQty
          hint = `Same as the item before (${lastQty})`
        } else {
          qty = 1
          if (!article) hint = 'No amount heard, set to 1'
        }
      } else {
        lastQty = qty
      }
      const c = convert(h.itemId, qty, unitWord)
      lines.push({ itemId: h.itemId, qty: c.qty, source: 'voice', heard: pretty(clause.slice(prevEnd ? prevEnd : 0, h.end)), hint: c.hint ?? hint })
      prevEnd = h.end
    })
  }
  return { lines: mergeLines(lines), unmatched }
}
