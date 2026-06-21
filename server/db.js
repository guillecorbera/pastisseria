import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const { Pool } = pg

function buildSslConfig() {
  if (`${process.env.DATABASE_SSL ?? 'true'}` === 'false') {
    return false
  }

  return {
    rejectUnauthorized: false,
  }
}

function getConnectionConfig() {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.NEON_DATABASE_URL ??
    process.env.POSTGRES_URL

  if (connectionString) {
    return {
      connectionString,
      ssl: buildSslConfig(),
    }
  }

  return {
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? '',
    database: process.env.POSTGRES_DATABASE ?? 'pastisseria',
    ssl: buildSslConfig(),
  }
}

const pool = new Pool({
  ...getConnectionConfig(),
  max: 10,
})

function compileNamedParams(sql, params) {
  const values = []
  const indexes = new Map()
  let text = ''
  let index = 0
  let inSingleQuote = false

  while (index < sql.length) {
    const char = sql[index]
    const nextChar = sql[index + 1]

    if (char === "'") {
      text += char

      if (inSingleQuote && nextChar === "'") {
        text += nextChar
        index += 2
        continue
      }

      inSingleQuote = !inSingleQuote
      index += 1
      continue
    }

    if (
      !inSingleQuote &&
      char === ':' &&
      sql[index - 1] !== ':' &&
      nextChar !== ':' &&
      /[a-zA-Z_]/.test(nextChar ?? '')
    ) {
      let end = index + 1

      while (end < sql.length && /[a-zA-Z0-9_]/.test(sql[end])) {
        end += 1
      }

      const key = sql.slice(index + 1, end)

      if (!Object.prototype.hasOwnProperty.call(params, key)) {
        throw new Error(`Falta el parámetro SQL :${key}.`)
      }

      if (!indexes.has(key)) {
        indexes.set(key, values.length + 1)
        values.push(params[key])
      }

      text += `$${indexes.get(key)}`
      index = end
      continue
    }

    text += char
    index += 1
  }

  return { text, values }
}

function compilePositionalParams(sql, params) {
  let index = 0

  const text = sql.replace(/\?/g, () => {
    index += 1
    return `$${index}`
  })

  return { text, values: params }
}

function compileQuery(sql, params = {}) {
  if (Array.isArray(params)) {
    return compilePositionalParams(sql, params)
  }

  if (!params || typeof params !== 'object') {
    return { text: sql, values: [] }
  }

  return compileNamedParams(sql, params)
}

function mapResult(result) {
  return {
    rows: result.rows,
    rowCount: result.rowCount,
    affectedRows: result.rowCount,
    insertId: result.rows?.[0]?.id ?? null,
  }
}

export async function query(sql, params) {
  const compiled = compileQuery(sql, params)
  const result = await pool.query(compiled.text, compiled.values)
  return result.rows
}

export async function execute(sql, params) {
  const compiled = compileQuery(sql, params)
  const result = await pool.query(compiled.text, compiled.values)
  return mapResult(result)
}

export async function getConnection() {
  const client = await pool.connect()

  return {
    async beginTransaction() {
      await client.query('BEGIN')
    },
    async commit() {
      await client.query('COMMIT')
    },
    async rollback() {
      await client.query('ROLLBACK')
    },
    async query(sql, params) {
      const compiled = compileQuery(sql, params)
      return client.query(compiled.text, compiled.values)
    },
    async execute(sql, params) {
      const compiled = compileQuery(sql, params)
      const result = await client.query(compiled.text, compiled.values)
      return mapResult(result)
    },
    release() {
      client.release()
    },
  }
}

export default pool
