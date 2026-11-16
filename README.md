# BWN job materials · Merlin prototype

A clickable prototype of how BWN's crew chiefs record job materials in Merlin, built from BWN's paper Materials Sheet (91 items, 9 categories).

**Live:** https://dhruvshandilya-bit.github.io/bwn-materials-prototype/

## The flow

Every job day settles on its own, one of two ways:

1. **Morning load, then evening return.** The chief says what goes on the truck. At the end of the day they say what came back. Used = loaded − back. Anything not mentioned counts as used.
2. **Just what we used.** No morning load. The chief says what the job used at the end of the day.

Voice fills the sheet. Anything the matcher can't place waits for the chief to pick by hand or mark as a special order. The chief reviews every line, then sends the day to the office.

**Office approval** writes one *Raw material used* asset movement per item, from shop stock (`ON_HAND`) to the project's `WIP` bin. In Merlin these show on the project's **BOM → Actuals** tab as *To WIP* rows with cost; the prototype's *Project actuals* tab copies that view. Merlin's existing `POST /asset/move/whunit` (`fromBinType: ON_HAND`, `toBinType: WIP`, `projectId`, `reason`) creates the same row.

The Materials Sheet downloads as Excel (BWN's own file, filled in) or PDF in the same layout, for one day or the whole job.

## Data

Item names come from BWN's sheet. Jobs, people, addresses, costs, stock and budgets are made up.

## Run it

```bash
npm install
npm run dev        # http://localhost:5193
npm run build      # static site in dist/
```

Pushing to `main` deploys GitHub Pages through `.github/workflows/deploy.yml`.

Outside claude.ai, voice uses the browser's own speech recognition (Chrome and Edge), and items are matched on the device rather than by Merlin AI.
