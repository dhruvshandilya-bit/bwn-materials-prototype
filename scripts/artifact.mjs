// Turns the single-file Vite build into an Artifact page: the host supplies
// <!doctype>, <html>, <head> and <body>, so we keep only the page's own tags.
// The inlined bundle contains literal "<head>"/"<body>" strings (jsPDF, ExcelJS), so the
// real tags are found by position: the first <head>, and the LAST </head>, <body>, </body>.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const html = readFileSync('dist-single/index.html', 'utf8')
const headStart = html.indexOf('<head>') + '<head>'.length
const headEnd = html.lastIndexOf('</head>')
const bodyStart = html.lastIndexOf('<body>') + '<body>'.length
const bodyEnd = html.lastIndexOf('</body>')
if (!(headStart < headEnd && headEnd < bodyStart && bodyStart < bodyEnd)) throw new Error('unexpected build layout')
const head = html.slice(headStart, headEnd)
const body = html.slice(bodyStart, bodyEnd)
if (!body.includes('id="root"')) throw new Error('root element missing from body')
const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<link rel="preconnect"[^>]*>/gi, '')
  .trim()
// Library strings carry a literal U+FFFD; write it as a JS escape so the page has none.
const esc = (t) => t.replace(/�/g, '\\uFFFD')
// The root div goes first so it exists before the module script runs.
const out = esc(`${body.trim()}\n${keep}\n<style>:root{color-scheme:light}html,body{background:#f4f2f6}</style>\n`)
mkdirSync('artifact', { recursive: true })
writeFileSync('artifact/bwn-job-materials.html', out)
console.log('artifact/bwn-job-materials.html', (out.length / 1024).toFixed(0) + ' KB')
