// Fills BWN's own Materials Sheet: the Excel download reuses their file (so the layout is
// exactly theirs), and the PDF redraws the same grid.
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import { ITEMS } from './items'
import { qtyText } from './logic'
import { SHEET_TEMPLATE_B64 } from './template'

export interface SheetData {
  quantities: Record<string, number>
  specials: { vendor: string; item: string; qty: number }[]
  notes: string
  chief: string
  jobName: string
  sNumber: string
  completionDate: string
  crew: string
  days: string
  /** Office downloads only; the crew sheet leaves "internal use" blank. */
  jobAmount?: string
  caption: string
}

const SHEET_UNIT: Record<string, string> = {
  bucket: 'Buckets', ft: 'Feet', each: 'Each', roll: 'Roll', 'bag (100)': 'Bag/100', sheet: 'Sheet', strap: 'Straps',
  tube: 'Tube', gallon: 'Gallon', pack: 'Pack', can: 'Can', pail: 'Pail', bag: 'Bags',
}

const HEADERS: [string, string, number][] = [
  ['FLOOR WORK', 'A', 1], ['CRAWL SPACE', 'A', 13], ['WALLS', 'A', 17], ['STRUCTURAL', 'A', 28], ['SPECIAL ORDERS', 'A', 36],
  ['DRAINS', 'E', 1], ['MISCELLANEOUS', 'E', 22], ['NOTES', 'E', 39], ['PUMP', 'I', 1], ['POLYURETHANE', 'I', 25], ['CONCRETE', 'I', 33],
]

function wrap(text: string, width: number, maxLines: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      out.push(cur.trim())
      cur = w
    } else cur += ' ' + w
  }
  if (cur.trim()) out.push(cur.trim())
  if (out.length > maxLines) {
    const head = out.slice(0, maxLines)
    head[maxLines - 1] = head[maxLines - 1].replace(/.{0,3}$/, '…')
    return head
  }
  return out
}

function b64ToBuffer(b64: string) {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

export async function buildXlsx(d: SheetData): Promise<Blob> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(b64ToBuffer(SHEET_TEMPLATE_B64))
  wb.creator = 'Merlin'
  wb.lastModifiedBy = 'Merlin'
  wb.modified = new Date()
  const ws = wb.worksheets[0]
  for (const it of ITEMS) {
    const q = d.quantities[it.id]
    if (q && q > 0) {
      const c = ws.getCell(it.cell)
      c.value = Number(qtyText(q))
      c.alignment = { horizontal: 'center', vertical: 'middle' }
      c.font = { ...(c.font ?? {}), bold: true }
    }
  }
  d.specials.slice(0, 5).forEach((s, i) => {
    const r = 38 + i
    ws.getCell(`A${r}`).value = s.vendor
    ws.getCell(`B${r}`).value = `${s.item}${s.qty ? ` × ${qtyText(s.qty)}` : ''}`
  })
  wrap(d.notes, 58, 3).forEach((line, i) => (ws.getCell(`E${40 + i}`).value = line))
  ws.getCell('A45').value = d.chief
  ws.getCell('B45').value = d.jobName
  ws.getCell('F44').value = d.sNumber
  ws.getCell('J44').value = d.completionDate
  ws.getCell('B47').value = d.crew
  if (d.jobAmount) ws.getCell('G47').value = d.jobAmount
  ws.getCell('K47').value = d.days
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function buildPdf(d: SheetData): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const widths = [21.71, 6.43, 5, 1, 21.71, 6.43, 5, 1.29, 21.71, 6.43, 5]
  const left = 30
  const usable = 612 - left * 2
  const scale = usable / widths.reduce((a, b) => a + b, 0)
  const colX: number[] = []
  widths.reduce((x, w, i) => ((colX[i] = x), x + w * scale), left)
  const colW = (i: number) => widths[i] * scale
  const ci = (col: string) => col.charCodeAt(0) - 65
  const top = 52
  const rowH = 14.2
  const y = (row: number) => top + (row - 1) * rowH

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('MATERIALS SHEET', left, 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)
  doc.text(d.caption, 612 - left, 32, { align: 'right' })
  doc.setTextColor(0)

  // category headers: a box across the three columns
  for (const [label, col, row] of HEADERS) {
    const c = ci(col)
    const span = label === 'NOTES' ? colX[c + 2] + colW(c + 2) - colX[c] : colX[c + 2] + colW(c + 2) - colX[c]
    doc.setLineWidth(1)
    doc.rect(colX[c], y(row), span, rowH - 1)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(label, colX[c] + 3, y(row) + rowH - 4.2)
  }

  // items
  doc.setLineWidth(0.5)
  for (const it of ITEMS) {
    const qc = ci(it.cell[0])
    const row = Number(it.cell.slice(1))
    const ny = y(row) + rowH - 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.4)
    doc.text(doc.splitTextToSize(it.sheetName, colW(qc - 2) - 4)[0], colX[qc - 2] + 2, ny)
    doc.setFontSize(6.8)
    doc.setTextColor(80)
    doc.text(SHEET_UNIT[it.unit] ?? it.unit, colX[qc - 1] + colW(qc - 1) / 2, ny, { align: 'center' })
    doc.setTextColor(0)
    doc.setDrawColor(150)
    doc.rect(colX[qc], y(row) + 1, colW(qc), rowH - 2)
    doc.setDrawColor(0)
    const q = d.quantities[it.id]
    if (q && q > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(qtyText(q), colX[qc] + colW(qc) / 2, ny, { align: 'center' })
    }
    doc.setDrawColor(215)
    doc.line(colX[qc - 2], y(row) + rowH, colX[qc - 1] + colW(qc - 1), y(row) + rowH)
    doc.setDrawColor(0)
  }

  // special orders
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.4)
  doc.text('Vendor', colX[0] + 2, y(37) + rowH - 4)
  doc.text('Item', colX[1] + 2, y(37) + rowH - 4)
  doc.setFont('helvetica', 'normal')
  for (let i = 0; i < 5; i++) {
    const r = 38 + i
    doc.setDrawColor(190)
    doc.line(colX[0], y(r) + rowH, colX[2] + colW(2), y(r) + rowH)
    doc.setDrawColor(0)
    const s = d.specials[i]
    if (s) {
      doc.text(doc.splitTextToSize(s.vendor, colW(0) - 4)[0], colX[0] + 2, y(r) + rowH - 4)
      doc.text(doc.splitTextToSize(`${s.item}${s.qty ? ` × ${qtyText(s.qty)}` : ''}`, colW(1) + colW(2) - 4)[0], colX[1] + 2, y(r) + rowH - 4)
    }
  }

  // notes box
  const nx = colX[4]
  const nw = colX[10] + colW(10) - nx
  doc.setLineWidth(0.6)
  doc.rect(nx, y(40), nw, rowH * 3)
  doc.setFontSize(7.4)
  wrap(d.notes, 78, 3).forEach((line, i) => doc.text(line, nx + 3, y(40 + i) + rowH - 4))

  // footer
  const label = (txt: string, col: number, row: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.6)
    doc.text(txt, colX[col] + 2, y(row) + rowH - 4)
  }
  const value = (txt: string, col: number, row: number, dx = 0) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(txt, colX[col] + 2 + dx, y(row) + rowH - 4)
  }
  label('CREW CHIEF:', 0, 44)
  value(d.chief, 0, 45)
  label('JOB NAME:', 1, 44)
  value(doc.splitTextToSize(d.jobName, 230)[0], 1, 45)
  label('S#:', 4, 44)
  value(d.sNumber, 4, 44, 16)
  label('COMPLETION DATE:', 8, 44)
  value(d.completionDate, 8, 44, 82)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(90)
  doc.text('(Internal use)', colX[0] + 2, y(46) + rowH - 4)
  doc.setTextColor(0)
  label('CREW:', 0, 47)
  value(doc.splitTextToSize(d.crew, 150)[0], 0, 47, 30)
  label('JOB AMOUNT:', 5, 47)
  if (d.jobAmount) value(d.jobAmount, 5, 47, 56)
  label('DAYS:', 9, 47)
  value(d.days, 9, 47, 26)
  doc.setDrawColor(190)
  doc.line(left, y(48) + 4, 612 - left, y(48) + 4)
  doc.setFontSize(6.5)
  doc.setTextColor(120)
  doc.text('Filled in from Merlin job materials', left, y(49))
  return doc.output('blob')
}
