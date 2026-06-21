import { execute, query } from './db.js'
import { readProductsCsv, readPurchaseOrderTemplateHeaders } from './csv.js'
import { schemaStatements } from './schema.js'

const defaultCompanySettings = {
  companyName: 'SANGUINA DUARTE, DOELIA CONCEPCION',
  companyTaxId: '55164584F',
  workplace: 'OBRADOR ROIG',
  contributionAccountCode: '08/2366143/48',
  bankName: '',
  bankIban: '',
}

function toBoolean(value) {
  return `${value ?? ''}`.trim().toUpperCase() === 'Y'
}

function toDecimal(value) {
  const normalized = `${value ?? ''}`.trim().replace(',', '.')
  if (!normalized) {
    return 0
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function ensureSchema() {
  for (const statement of schemaStatements) {
    await execute(statement)
  }
}

async function ensureColumnExists(tableName, columnName, definition) {
  await execute(
    `ALTER TABLE ${tableName}
     ADD COLUMN IF NOT EXISTS ${columnName} ${definition}`,
  )
}

export async function ensureSchemaEnhancements() {
  await ensureColumnExists('invoices', 'client_id', 'INTEGER')
  await ensureColumnExists('invoices', 'client_address', 'VARCHAR(255)')
  await ensureColumnExists('invoices', 'client_postal_code', 'VARCHAR(20)')
  await ensureColumnExists('invoices', 'client_city', 'VARCHAR(120)')
  await ensureColumnExists('invoices', 'client_email', 'VARCHAR(255)')
  await ensureColumnExists('invoices', 'client_phone', 'VARCHAR(50)')
  await ensureColumnExists(
    'invoices',
    'payment_by_transfer',
    'BOOLEAN NOT NULL DEFAULT FALSE',
  )
  await ensureColumnExists('employees', 'login_code', 'VARCHAR(60)')
  await ensureColumnExists(
    'employees',
    'mobile_access_enabled',
    'BOOLEAN NOT NULL DEFAULT TRUE',
  )
  await ensureColumnExists('employee_shifts', 'ended_verification_method', 'VARCHAR(50)')
  await ensureColumnExists('employee_shifts', 'device_id', 'VARCHAR(100)')

  await execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS employees_login_code_unique
     ON employees (login_code)
     WHERE login_code IS NOT NULL`,
  )
}

export async function syncTemplateHeaders() {
  const headers = await readPurchaseOrderTemplateHeaders()
  await execute(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES ('purchase_order_headers', :headers::jsonb)
     ON CONFLICT (setting_key)
     DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP`,
    { headers: JSON.stringify(headers) },
  )
}

export async function syncDefaultCompanySettings() {
  await execute(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES ('company_settings', :settings::jsonb)
     ON CONFLICT (setting_key) DO NOTHING`,
    { settings: JSON.stringify(defaultCompanySettings) },
  )
}

export async function syncProducts(force = false, skipIfPresent = true) {
  const [{ total }] = await query('SELECT COUNT(*)::int AS total FROM products')

  if (total > 0 && !force && skipIfPresent) {
    return { imported: 0, skipped: true }
  }

  const products = await readProductsCsv()
  const existingProducts = await query(
    'SELECT ref, available_for_sale AS "availableForSale" FROM products',
  )
  const existingProductsByRef = new Map(
    existingProducts.map((product) => [product.ref, Boolean(product.availableForSale)]),
  )
  let inserted = 0
  let updated = 0

  if (force) {
    await execute('DELETE FROM products')
    existingProductsByRef.clear()
  }

  for (const product of products) {
    const ref = product.REF
    const alreadyExists = existingProductsByRef.has(ref)

    await execute(
      `INSERT INTO products (
        handle,
        ref,
        name,
        category,
        description,
        sold_by_weight,
        supplier,
        purchase_cost,
        sale_price,
        barcode,
        available_for_sale,
        raw_payload
      ) VALUES (
        :handle,
        :ref,
        :name,
        :category,
        :description,
        :soldByWeight,
        :supplier,
        :purchaseCost,
        :salePrice,
        :barcode,
        :availableForSale,
        :rawPayload::jsonb
      )
      ON CONFLICT (ref) DO UPDATE SET
        handle = EXCLUDED.handle,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        sold_by_weight = EXCLUDED.sold_by_weight,
        supplier = EXCLUDED.supplier,
        purchase_cost = EXCLUDED.purchase_cost,
        sale_price = EXCLUDED.sale_price,
        barcode = EXCLUDED.barcode,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = CURRENT_TIMESTAMP`,
      {
        handle: product.Handle,
        ref,
        name: product.Nombre,
        category: product.Categoria,
        description: product['Descripción'],
        soldByWeight: toBoolean(product['Vendido por peso']),
        supplier: product.Proveedor,
        purchaseCost: toDecimal(product['Costo de compra']),
        salePrice: toDecimal(product['Precio [Obrador Roig]']),
        barcode: product['Codigo de barras'],
        availableForSale: alreadyExists ? existingProductsByRef.get(ref) : true,
        rawPayload: JSON.stringify(product),
      },
    )

    if (alreadyExists) {
      updated += 1
    } else {
      inserted += 1
      existingProductsByRef.set(ref, true)
    }
  }

  return {
    imported: products.length,
    inserted,
    updated,
    skipped: false,
  }
}

export async function bootstrapDatabase() {
  await ensureSchema()
  await ensureSchemaEnhancements()
  await syncTemplateHeaders()
  await syncDefaultCompanySettings()
  return syncProducts(`${process.env.FORCE_PRODUCTS_SYNC}` === 'true')
}
