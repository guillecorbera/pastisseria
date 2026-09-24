const LOYVERSE_API_BASE_URL = `${process.env.LOYVERSE_API_BASE_URL ?? 'https://api.loyverse.com/v1.0'}`
  .trim()
  .replace(/\/$/, '')
const LOYVERSE_TOKEN = `${process.env.LOYVERSE_TOKEN ?? process.env.LOYVERSE_API_TOKEN ?? ''}`.trim()
const LOYVERSE_ITEMS_CACHE_TTL_MS = 15 * 60 * 1000
let loyverseItemsCache = { items: [], expiresAt: 0 }
let loyverseItemsRequest = null

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

function pickDefinedFields(source, fieldNames) {
  return fieldNames.reduce((result, fieldName) => {
    if (source?.[fieldName] !== undefined) {
      result[fieldName] = source[fieldName]
    }

    return result
  }, {})
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

async function sendLoyverseResource(resourcePath, options) {
  const response = await fetch(`${LOYVERSE_API_BASE_URL}${resourcePath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${LOYVERSE_TOKEN}`,
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()

    if (response.status === 401 || response.status === 403) {
      throw createHttpError(
        'El token de Loyverse no tiene permisos de escritura sobre los productos.',
        502,
      )
    }

    if (response.status === 404) {
      throw createHttpError('El producto solicitado ya no existe en Loyverse.', 404)
    }

    throw createHttpError(
      errorText || 'No se pudo actualizar el producto en Loyverse.',
      502,
    )
  }

  const responseText = await response.text()
  return responseText ? JSON.parse(responseText) : null
}

async function fetchAllLoyverseResources(resourcePath, collectionKey) {
  const resources = []
  let cursor = ''

  do {
    const separator = resourcePath.includes('?') ? '&' : '?'
    const cursorParameter = cursor
      ? `${separator}cursor=${encodeURIComponent(cursor)}`
      : ''
    const response = await fetchLoyverseResource(`${resourcePath}${cursorParameter}`)
    resources.push(...normalizeArray(response?.[collectionKey]))
    cursor = normalizeText(response?.cursor)
  } while (cursor)

  return resources
}

async function fetchCachedLoyverseItems(forceRefresh = false) {
  if (
    !forceRefresh &&
    loyverseItemsCache.items.length > 0 &&
    loyverseItemsCache.expiresAt > Date.now()
  ) {
    return loyverseItemsCache.items
  }

  if (loyverseItemsRequest) {
    return loyverseItemsRequest
  }

  loyverseItemsRequest = fetchAllLoyverseResources('/items?limit=250', 'items')
    .then((items) => {
      loyverseItemsCache = {
        items,
        expiresAt: Date.now() + LOYVERSE_ITEMS_CACHE_TTL_MS,
      }
      return items
    })
    .finally(() => {
      loyverseItemsRequest = null
    })

  return loyverseItemsRequest
}

function clearLoyverseItemsCache() {
  loyverseItemsCache = { items: [], expiresAt: 0 }
}

function mapLoyverseVariant(item, variant, categoryById, variantIndex) {
  const itemName = normalizeText(item?.item_name ?? item?.name)
  const variantName = normalizeText(variant?.variant_name ?? variant?.name)
  const sku = normalizeText(variant?.sku)
  const variantId = normalizeText(variant?.variant_id ?? variant?.id)
  const itemId = normalizeText(item?.id ?? item?.item_id)
  const store = normalizeArray(variant?.stores)[0] ?? {}

  return {
    handle: normalizeText(item?.handle) || itemId,
    ref: sku || variantId || `${itemId}-${variantIndex + 1}`,
    name: variantName && variantName !== 'Default'
      ? `${itemName} - ${variantName}`
      : itemName || sku || 'Producto sin nombre',
    category:
      normalizeText(item?.category_name) ||
      categoryById.get(normalizeText(item?.category_id)) ||
      '',
    description: normalizeText(item?.description),
    soldByWeight: Boolean(item?.sold_by_weight ?? variant?.sold_by_weight),
    supplier: normalizeText(item?.supplier_name ?? variant?.supplier_name),
    purchaseCost: normalizeNumber(
      variant?.default_cost ?? variant?.cost ?? store?.cost,
      0,
    ),
    salePrice: normalizeNumber(
      variant?.default_price ?? variant?.price ?? store?.price,
      0,
    ),
    barcode: normalizeText(variant?.barcode),
    rawPayload: { item, variant },
  }
}

function mapLoyverseCatalogVariant(item, variant, categoryById, variantIndex) {
  const itemId = normalizeText(item?.id ?? item?.item_id)
  const variantId = normalizeText(variant?.variant_id ?? variant?.id)
  const itemName = normalizeText(item?.item_name ?? item?.name)
  const variantName = normalizeText(variant?.variant_name ?? variant?.name)
  const store = normalizeArray(variant?.stores)[0] ?? {}
  const categoryId = normalizeText(item?.category_id)

  return {
    id: `${itemId}:${variantId || variantIndex}`,
    itemId,
    variantId,
    itemName: itemName || 'Producto sin nombre',
    variantName: variantName && variantName !== 'Default' ? variantName : '',
    sku: normalizeText(variant?.sku),
    categoryId,
    categoryName:
      normalizeText(item?.category_name) || categoryById.get(categoryId) || '',
    salePrice: normalizeNumber(
      variant?.default_price ?? variant?.price ?? store?.price,
      0,
    ),
    imageUrl: normalizeText(item?.image_url ?? item?.imageUrl),
    availableForSale: store?.available_for_sale !== false,
  }
}

export async function fetchLoyverseProducts() {
  if (!LOYVERSE_TOKEN) {
    throw createHttpError('No se ha configurado LOYVERSE_TOKEN en el servidor.', 500)
  }

  const [items, categories] = await Promise.all([
    fetchAllLoyverseResources('/items?limit=250', 'items'),
    fetchAllLoyverseResources('/categories?limit=250', 'categories'),
  ])
  const categoryById = new Map(
    categories.map((category) => [
      normalizeText(category?.id ?? category?.category_id),
      normalizeText(category?.name ?? category?.category_name),
    ]),
  )

  return items.flatMap((item) => {
    const variants = normalizeArray(item?.variants)
    const normalizedVariants = variants.length ? variants : [{}]

    return normalizedVariants.map((variant, index) =>
      mapLoyverseVariant(item, variant, categoryById, index),
    )
  })
}

export async function fetchLoyverseCategories() {
  if (!LOYVERSE_TOKEN) {
    throw createHttpError('No se ha configurado LOYVERSE_TOKEN en el servidor.', 500)
  }

  const categories = await fetchAllLoyverseResources(
    '/categories?limit=250',
    'categories',
  )

  void fetchCachedLoyverseItems().catch(() => {})

  return categories
    .map((category) => ({
      id: normalizeText(category?.id ?? category?.category_id),
      name: normalizeText(category?.name ?? category?.category_name),
    }))
    .filter((category) => category.id && category.name)
    .sort((firstCategory, secondCategory) =>
      firstCategory.name.localeCompare(secondCategory.name, 'es'),
    )
}

export async function fetchLoyverseProductCatalog(categoryId, { forceRefresh = false } = {}) {
  if (!LOYVERSE_TOKEN) {
    throw createHttpError('No se ha configurado LOYVERSE_TOKEN en el servidor.', 500)
  }

  const normalizedCategoryId = normalizeText(categoryId)

  if (!normalizedCategoryId) {
    throw createHttpError('Debes seleccionar una categoría de Loyverse.', 400)
  }

  const items = await fetchCachedLoyverseItems(forceRefresh)
  const categoryItems = items.filter(
    (item) => normalizeText(item?.category_id) === normalizedCategoryId,
  )
  const products = categoryItems.flatMap((item) => {
    const variants = normalizeArray(item?.variants)
    const normalizedVariants = variants.length ? variants : [{}]

    return normalizedVariants.map((variant, index) =>
      mapLoyverseCatalogVariant(item, variant, new Map(), index),
    )
  })

  return {
    products: products.sort((firstProduct, secondProduct) =>
      firstProduct.itemName.localeCompare(secondProduct.itemName, 'es'),
    ),
  }
}

export async function updateLoyverseProduct({
  itemId,
  variantId,
  itemName,
  salePrice,
}) {
  if (!LOYVERSE_TOKEN) {
    throw createHttpError('No se ha configurado LOYVERSE_TOKEN en el servidor.', 500)
  }

  const item = await fetchLoyverseResource(
    `/items/${encodeURIComponent(itemId)}`,
  )
  const variants = normalizeArray(item?.variants)
  let variantFound = false
  const updatedVariants = variants.map((variant) => {
    const writableVariant = {
      ...pickDefinedFields(variant, [
        'variant_id',
        'item_id',
        'sku',
        'reference_variant_id',
        'option1_value',
        'option2_value',
        'option3_value',
        'barcode',
        'cost',
        'purchase_cost',
        'default_pricing_type',
        'default_price',
      ]),
      stores: normalizeArray(variant?.stores).map((store) =>
        pickDefinedFields(store, [
          'store_id',
          'pricing_type',
          'price',
          'available_for_sale',
          'optimal_stock',
          'low_stock',
        ]),
      ),
    }

    if (normalizeText(variant?.variant_id ?? variant?.id) !== variantId) {
      return writableVariant
    }

    variantFound = true
    return {
      ...writableVariant,
      default_pricing_type: 'FIXED',
      default_price: salePrice,
      stores: writableVariant.stores.map((store) => ({
        ...store,
        pricing_type: 'FIXED',
        price: salePrice,
      })),
    }
  })

  if (!variantFound) {
    throw createHttpError('La variante seleccionada ya no existe en Loyverse.', 404)
  }

  const payload = {
    ...pickDefinedFields(item, [
      'reference_id',
      'category_id',
      'description',
      'track_stock',
      'sold_by_weight',
      'is_composite',
      'use_production',
      'components',
      'primary_supplier_id',
      'tax_ids',
      'modifier_ids',
      'modifiers_ids',
      'form',
      'color',
      'option1_name',
      'option2_name',
      'option3_name',
    ]),
    id: normalizeText(item?.id ?? item?.item_id) || itemId,
    item_name: itemName,
    variants: updatedVariants,
  }

  await sendLoyverseResource('/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  clearLoyverseItemsCache()

  return {
    itemId,
    variantId,
    itemName,
    salePrice,
  }
}

export async function uploadLoyverseProductImage(itemId, imageBuffer) {
  if (!LOYVERSE_TOKEN) {
    throw createHttpError('No se ha configurado LOYVERSE_TOKEN en el servidor.', 500)
  }

  await sendLoyverseResource(
    `/items/${encodeURIComponent(itemId)}/image`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: imageBuffer,
    },
  )
  clearLoyverseItemsCache()

  const updatedItem = await fetchLoyverseResource(
    `/items/${encodeURIComponent(itemId)}`,
  )

  return {
    itemId,
    imageUrl: normalizeText(updatedItem?.image_url ?? updatedItem?.imageUrl),
  }
}

function summarizeLoyverseReceipt(receipt, categoryItemIds) {
  const lineItems = normalizeArray(receipt?.line_items)
  const matchingItems = lineItems.filter((item) =>
    categoryItemIds.has(normalizeText(item?.item_id ?? item?.itemId)),
  )

  if (matchingItems.length === 0) {
    return null
  }

  return {
    receiptNumber: normalizeText(
      receipt?.receipt_number ?? receipt?.receiptNumber ?? receipt?.number,
    ),
    receiptDate: normalizeText(receipt?.receipt_date ?? receipt?.created_at),
    receiptType: normalizeText(receipt?.receipt_type) || 'SALE',
    cancelledAt: normalizeText(receipt?.cancelled_at),
    totalMoney: normalizeNumber(receipt?.total_money ?? receipt?.total, 0),
    categoryTotal: matchingItems.reduce(
      (total, item) => total + normalizeNumber(item?.total_money ?? item?.total, 0),
      0,
    ),
    matchingItems: matchingItems.map((item, index) => ({
      id: normalizeText(item?.line_item_id) || `${index + 1}`,
      name:
        normalizeText(item?.item_name) ||
        normalizeText(item?.variant_name) ||
        'Producto sin nombre',
      variantName: normalizeText(item?.variant_name),
      quantity: normalizeNumber(item?.quantity, 0),
      totalMoney: normalizeNumber(item?.total_money ?? item?.total, 0),
    })),
    sourceReceipt: receipt,
  }
}

export async function fetchLoyverseReceiptsByCategory({
  createdAtMin,
  createdAtMax,
  categoryId,
}) {
  if (!LOYVERSE_TOKEN) {
    throw createHttpError('No se ha configurado LOYVERSE_TOKEN en el servidor.', 500)
  }

  const normalizedCategoryId = normalizeText(categoryId)

  if (!createdAtMin || !createdAtMax || !normalizedCategoryId) {
    throw createHttpError(
      'Debes indicar el rango de fechas y la categoria de Loyverse.',
      400,
    )
  }

  const [receipts, items, categories] = await Promise.all([
    fetchAllLoyverseResources(
      `/receipts?limit=250&created_at_min=${encodeURIComponent(createdAtMin)}&created_at_max=${encodeURIComponent(createdAtMax)}`,
      'receipts',
    ),
    fetchAllLoyverseResources('/items?limit=250', 'items'),
    fetchAllLoyverseResources('/categories?limit=250', 'categories'),
  ])
  const selectedCategory = categories.find(
    (category) => normalizeText(category?.id ?? category?.category_id) === normalizedCategoryId,
  )

  if (!selectedCategory) {
    throw createHttpError('La categoria seleccionada ya no existe en Loyverse.', 404)
  }

  const categoryItemIds = new Set(
    items
      .filter(
        (item) => normalizeText(item?.category_id) === normalizedCategoryId,
      )
      .map((item) => normalizeText(item?.id ?? item?.item_id))
      .filter(Boolean),
  )
  const matchingReceipts = receipts
    .map((receipt) => summarizeLoyverseReceipt(receipt, categoryItemIds))
    .filter(Boolean)

  return {
    category: {
      id: normalizedCategoryId,
      name: normalizeText(selectedCategory?.name ?? selectedCategory?.category_name),
    },
    receipts: matchingReceipts,
    summary: {
      totalReceipts: matchingReceipts.length,
      totalAmount: matchingReceipts.reduce(
        (total, receipt) => total + receipt.categoryTotal,
        0,
      ),
    },
  }
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

  const vatRate = extractLoyverseTaxRate(
    linkedItem,
    extractLoyverseTaxRate(item, 21),
  )
  const unitPriceWithVat =
    quantity > 0 ? lineTotal / quantity : normalizeNumber(item?.price, 0)
  const unitPrice = Number(
    (vatRate > 0 ? unitPriceWithVat / (1 + vatRate / 100) : unitPriceWithVat).toFixed(6),
  )

  return {
    id: `loyverse-${normalizeText(item?.line_item_id) || index + 1}`,
    description,
    quantity,
    vatRate,
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
