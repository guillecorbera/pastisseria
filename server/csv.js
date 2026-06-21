import fs from 'node:fs/promises'
import path from 'node:path'

const PRODUCTS_FILE = path.resolve(process.cwd(), 'export_items.csv')
const PURCHASE_ORDER_TEMPLATE_FILE = path.resolve(
  process.cwd(),
  'import_purchase_order.csv',
)

function parseCsvLine(line) {
  const values = []
  let current = ''
  let isInsideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && isInsideQuotes && nextChar === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      isInsideQuotes = !isInsideQuotes
      continue
    }

    if (char === ',' && !isInsideQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function parseCsv(content) {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return []
  }

  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line)
    return headers.reduce((record, header, index) => {
      record[header] = row[index] ?? ''
      return record
    }, {})
  })
}

function escapeCsvValue(value) {
  const normalized = `${value ?? ''}`
  if (normalized.includes('"') || normalized.includes(',') || normalized.includes('\n')) {
    return `"${normalized.replaceAll('"', '""')}"`
  }
  return normalized
}

export async function readProductsCsv() {
  const content = await fs.readFile(PRODUCTS_FILE, 'utf8')
  return parseCsv(content)
}

export async function readPurchaseOrderTemplateHeaders() {
  const content = await fs.readFile(PURCHASE_ORDER_TEMPLATE_FILE, 'utf8')
  const [headerLine = ''] = content.replace(/^\uFEFF/, '').split(/\r?\n/)
  return parseCsvLine(headerLine)
}

export async function writePurchaseOrderCsv({ filename, headers, rows }) {
  const outputDir = path.resolve(process.cwd(), 'generated-orders')
  await fs.mkdir(outputDir, { recursive: true })

  const lines = [headers.map(escapeCsvValue).join(',')]

  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(','))
  })

  const filePath = path.join(outputDir, filename)
  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf8')

  return filePath
}
