const LOYVERSE_API_BASE_URL = `${process.env.LOYVERSE_API_BASE_URL ?? 'https://api.loyverse.com/v1.0'}`
  .trim()
  .replace(/\/$/, '')
const LOYVERSE_TOKEN = `${process.env.LOYVERSE_TOKEN ?? process.env.LOYVERSE_API_TOKEN ?? ''}`.trim()

function createHttpError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function normalizeText(value) {
  return `${value ?? ''}`.trim()
}

function normalizeNumber(value, fallback = 0) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function buildCustomerAddress(customer) {
  const addressParts = [
    customer?.address,
    customer?.address1,
    customer?.address2,
    customer?.street_address,
  ]
    .map(normalizeText)
    .filter(Boolean)

  return addressParts.join(', ')
}

function extractLoyverseTaxRate(source, fallback = 21) {
  const directCandidates = [
    source?.tax_percentage,
    source?.taxPercent,
    source?.tax_rate,
    source?.taxRate,
    source?.vat_rate,
    source?.vatRate,
    source?.tax?.rate,
    source?.tax?.percentage,
  ]

  for (const candidate of directCandidates) {
    const normalizedCandidate = normalizeNumber(candidate, Number.NaN)

    if (Number.isFinite(normalizedCandidate) && normalizedCandidate >= 0) {
      return normalizedCandidate
    }
  }

  const nestedTaxes = [
    ...normalizeArray(source?.line_taxes),
    ...normalizeArray(source?.total_taxes),
    ...normalizeArray(source?.taxes),
    ...normalizeArray(source?.tax_items),
    ...normalizeArray(source?.applied_taxes),
  ]

  for (const tax of nestedTaxes) {
    const normalizedCandidate = normalizeNumber(
      tax?.rate ?? tax?.percentage ?? tax?.tax_rate ?? tax?.tax_percentage,
      Number.NaN,
    )

    if (Number.isFinite(normalizedCandidate) && normalizedCandidate >= 0) {
      return normalizedCandidate
    }
  }

  return normalizeNumber(fallback, 21)
}

async function fetchLoyverseResource(resourcePath) {
  const response = await fetch(`${LOYVERSE_API_BASE_URL}${resourcePath}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${LOYVERSE_TOKEN}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw createHttpError('El recurso solicitado no existe en Loyverse.', 404)
    }

    if (response.status === 401 || response.status === 403) {
      throw createHttpError(
        'El token de Loyverse no es valido o no tiene permisos suficientes.',
        502,
      )
    }

    const errorText = await response.text()
    throw createHttpError(
      errorText || 'No se pudo recuperar la informacion desde Loyverse.',
      502,
    )
  }

  return response.json()
}

async function fetchLoyverseItem(itemId) {
  const normalizedItemId = normalizeText(itemId)

  if (!normalizedItemId) {
    return null
  }

  return fetchLoyverseResource(`/items/${encodeURIComponent(normalizedItemId)}`)
}

async function mapLoyverseLineItem(item, index, itemByIdCache) {
  const description =
    normalizeText(item?.item_name) ||
    normalizeText(item?.variant_name) ||
    normalizeText(item?.sku) ||
    `Linea ${index + 1}`
  const quantity = normalizeNumber(item?.quantity, 1)
  const lineTotal = normalizeNumber(
    item?.total_money ??
      item?.total ??
      item?.price_money ??
      item?.price ??
      item?.gross_total_money,
    0,
  )
  const unitPrice =
    quantity > 0 ? Number((lineTotal / quantity).toFixed(2)) : normalizeNumber(item?.price, 0)
  const itemId = normalizeText(item?.item_id ?? item?.itemId)
  let linkedItem = null

  if (itemId) {
    if (!itemByIdCache.has(itemId)) {
      itemByIdCache.set(
        itemId,
        fetchLoyverseItem(itemId).catch(() => null),
      )
    }

    linkedItem = await itemByIdCache.get(itemId)
  }

  return {
    id: `loyverse-${normalizeText(item?.line_item_id) || index + 1}`,
    description,
    quantity,
    vatRate: extractLoyverseTaxRate(linkedItem, extractLoyverseTaxRate(item, 21)),
    unitPrice,
  }
}

async function mapReceiptToInvoiceDraft(receipt) {
  const customer = receipt?.customer ?? receipt?.customer_info ?? {}
  const issueDate = normalizeText(receipt?.created_at ?? receipt?.date ?? '').slice(0, 10)
  const lineItems = Array.isArray(receipt?.line_items)
    ? receipt.line_items
    : Array.isArray(receipt?.items)
      ? receipt.items
      : []
  const itemByIdCache = new Map()
  const draftItems = (await Promise.all(
    lineItems.map((item, index) => mapLoyverseLineItem(item, index, itemByIdCache)),
  )).filter((item) => item.quantity > 0)
  const paymentByTransfer = false

  return {
    receiptNumber:
      normalizeText(receipt?.receipt_number) ||
      normalizeText(receipt?.receiptNumber) ||
      normalizeText(receipt?.number),
    issueDate,
    dueDate: issueDate,
    clientId: '',
    clientName:
      normalizeText(customer?.name) ||
      normalizeText(receipt?.customer_name) ||
      normalizeText(receipt?.customerName),
    taxId:
      normalizeText(customer?.tax_id) ||
      normalizeText(customer?.taxId) ||
      normalizeText(customer?.company_number),
    clientAddress: buildCustomerAddress(customer),
    clientPostalCode:
      normalizeText(customer?.postal_code) || normalizeText(customer?.postcode),
    clientCity: normalizeText(customer?.city) || normalizeText(customer?.locality),
    clientEmail: normalizeText(customer?.email),
    clientPhone:
      normalizeText(customer?.phone_number) || normalizeText(customer?.phone),
    paymentByTransfer,
    status: 'pendiente',
    notes: `Importado desde Loyverse. Recibo ${normalizeText(receipt?.receipt_number) || normalizeText(receipt?.receiptNumber)}.`,
    vatRate: normalizeNumber(receipt?.total_tax_rate ?? receipt?.tax_percentage ?? 21, 21),
    items: draftItems,
    sourceReceipt: receipt,
  }
}

export async function fetchLoyverseReceiptDraft(receiptNumber) {
  if (!LOYVERSE_TOKEN) {
    throw createHttpError(
      'No se ha configurado LOYVERSE_TOKEN en el servidor.',
      500,
    )
  }

  const normalizedReceiptNumber = normalizeText(receiptNumber)

  if (!normalizedReceiptNumber) {
    throw createHttpError('Debes indicar el numero de recibo de Loyverse.', 400)
  }

  const receipt = await fetchLoyverseResource(
    `/receipts/${encodeURIComponent(normalizedReceiptNumber)}`,
  )
  const draft = await mapReceiptToInvoiceDraft(receipt)

  if (!draft.clientName && draft.items.length === 0) {
    throw createHttpError(
      'El recibo de Loyverse no contiene datos suficientes para preparar una factura.',
      422,
    )
  }

  return draft
}
