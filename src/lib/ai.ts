// Matches a spoken materials note to the sheet with Claude (the page's `sample` capability),
// falling back to the on-device parser when Claude is unavailable or declines.
import { caps } from './claude'
import { ITEMS, ITEM_BY_ID } from './items'
import { mergeLines, uid } from './logic'
import { parseLocal, type ParseResult } from './parse'
/** What the chief is describing. */
export type SpeechKind = 'load' | 'back' | 'used'

const CATALOG = ITEMS.map((i) => `${i.id} | ${i.name} | ${i.unit} | ${i.category}`).join('\n')

function prompt(text: string, kind: SpeechKind) {
  const what = kind === 'load' ? 'loaded from the shop onto the truck this morning' : kind === 'back' ? 'brought back to the shop at the end of the day' : 'used on the job today'
  return `You fill in a basement waterproofing crew's materials sheet from what the crew chief said about material ${what}.

Sheet items, one per line as: id | name | unit | category
${CATALOG}

Rules:
- Use only ids from the list. Give each quantity in that item's unit.
- Stone is counted in buckets: 33 buckets = 1 ton. Anchors come in bags of 100. Flexi Seal roll 4'x100' is counted in feet (1 roll = 100 ft).
- "Inch and a half" is 1.5". "Nineties" are 90° elbows and "forty-fives" are 45° elbows; with no size said, use the 1.5" fittings.
- When one number covers several items ("52 feet of drain board and fabric"), give each item that number.
- "A", "an" or "the" with no number means 1.
- When you convert a unit, say how in "note" (for example "1.5 tons × 33 = 50 buckets").
- Anything said that is not on the list, or where you can't tell which item, goes in "unmatched" with the words said. Mark vendor or special orders with "special": true and the vendor if said.
- Ignore talk that is not about material (work done, weather, people).

Reply with only JSON in this shape:
{"lines":[{"itemId":"stone","qty":50,"heard":"a ton and a half of stone","note":"1.5 tons × 33 = 50 buckets"}],"unmatched":[{"heard":"two of the blue fittings","qty":2,"special":false,"vendor":null}]}

What the crew chief said:
"""${text.slice(0, 6000)}"""`
}

export type MatchSource = 'ai' | 'device'

export async function matchSpeech(
  text: string,
  kind: SpeechKind,
  signal?: AbortSignal,
): Promise<ParseResult & { by: MatchSource; aiError?: string }> {
  const sample = await caps.sample
  if (sample) {
    try {
      const out = await sample.json(prompt(text, kind), { modelTier: 'quick', signal })
      const lines = (Array.isArray(out?.lines) ? out.lines : [])
        .filter((l: any) => ITEM_BY_ID[String(l?.itemId)] && Number(l?.qty) > 0)
        .map((l: any) => ({
          itemId: String(l.itemId),
          qty: Math.round(Number(l.qty) * 100) / 100,
          source: 'voice' as const,
          heard: l.heard ? String(l.heard).slice(0, 160) : undefined,
          hint: l.note ? String(l.note).slice(0, 120) : undefined,
        }))
      const unmatched = (Array.isArray(out?.unmatched) ? out.unmatched : [])
        .filter((u: any) => u && u.heard)
        .map((u: any) => ({
          id: uid('u'),
          heard: String(u.heard).slice(0, 160),
          qty: Number(u.qty) > 0 ? Number(u.qty) : null,
          special: !!u.special,
          vendor: u.vendor ? String(u.vendor) : null,
        }))
      if (lines.length || unmatched.length) return { lines: mergeLines(lines), unmatched, by: 'ai' }
    } catch (e: any) {
      if (e?.code === 'cancelled') throw e
      return { ...parseLocal(text), by: 'device', aiError: e?.code ?? 'upstream_error' }
    }
  }
  return { ...parseLocal(text), by: 'device' }
}
