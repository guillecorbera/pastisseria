export function calculateInvoiceTotals(items, vatRate, pricesIncludeVat = false) {
  const totalsByVatRate = items.reduce((rows, item) => {
    const total = Number(item.quantity || 0) * Number(item.unitPrice || 0)
    const itemVatRate = Number(item.vatRate ?? vatRate ?? 0)
    const normalizedVatRate =
      Number.isFinite(itemVatRate) && itemVatRate >= 0 ? itemVatRate : 0
    const currentRow = rows.get(normalizedVatRate) ?? {
      subtotal: 0,
      vatAmount: 0,
      total: 0,
    }

    if (normalizedVatRate <= 0) {
      currentRow.subtotal += total
      currentRow.total += total
    } else if (pricesIncludeVat) {
      const subtotal = total / (1 + normalizedVatRate / 100)
      currentRow.subtotal += subtotal
      currentRow.vatAmount += total - subtotal
      currentRow.total += total
    } else {
      const vatAmount = total * (normalizedVatRate / 100)
      currentRow.subtotal += total
      currentRow.vatAmount += vatAmount
      currentRow.total += total + vatAmount
    }

    rows.set(normalizedVatRate, currentRow)
    return rows
  }, new Map())

  return [...totalsByVatRate.values()].reduce(
    (totals, row) => ({
      subtotal: totals.subtotal + row.subtotal,
      vatAmount: totals.vatAmount + row.vatAmount,
      total: totals.total + row.total,
    }),
    { subtotal: 0, vatAmount: 0, total: 0 },
  )
}
