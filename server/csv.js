import fs from 'node:fs/promises'
import path from 'node:path'

const PRODUCTS_FILE = path.resolve(process.cwd(), 'export_items.csv')

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

export async function readProductsCsv() {
  const content = await fs.readFile(PRODUCTS_FILE, 'utf8')
  return parseCsv(content)
}
