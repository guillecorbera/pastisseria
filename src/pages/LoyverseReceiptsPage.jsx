import { useEffect, useState } from 'react'
import {
  fetchLoyverseCategoriesList,
  fetchLoyverseReceipts,
} from '../lib/api'
import { showErrorToast } from '../lib/toast'

function getInitialDateRange() {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const toDateInput = (date) => {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return {
    dateFrom: toDateInput(monthStart),
    dateTo: toDateInput(today),
  }
}

function formatReceiptDate(value) {
  if (!value) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatReportDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return `${value}`
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(',', '')
}

function formatPeriodDate(value) {
  const [year, month, day] = `${value}`.split('-')
  return year && month && day ? `${day}-${month}-${year}` : `${value}`
}

function formatReportNumber(value) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function LoyverseReceiptsPage({ formatCurrency }) {
  const [filters, setFilters] = useState(() => ({
    ...getInitialDateRange(),
    categoryId: '',
  }))
  const [categories, setCategories] = useState([])
  const [result, setResult] = useState(null)
  const [selectedReceiptNumbers, setSelectedReceiptNumbers] = useState([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      try {
        const categoryList = await fetchLoyverseCategoriesList()

        if (!cancelled) {
          setCategories(categoryList)
        }
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error.message)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCategories(false)
        }
      }
    }

    loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  function updateFilter(field, value) {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  async function handleSearch(event) {
    event.preventDefault()

    if (filters.dateFrom > filters.dateTo) {
      showErrorToast('La fecha inicial no puede ser posterior a la fecha final.')
      return
    }

    const startDate = new Date(`${filters.dateFrom}T00:00:00`)
    const endDate = new Date(`${filters.dateTo}T23:59:59.999`)
    setIsSearching(true)

    try {
      const nextResult = await fetchLoyverseReceipts({
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
        categoryId: filters.categoryId,
      })
      setResult(nextResult)
      setSelectedReceiptNumbers(
        nextResult.receipts.map((receipt) => receipt.receiptNumber),
      )
    } catch (error) {
      showErrorToast(error.message)
    } finally {
      setIsSearching(false)
    }
  }

  function toggleReceipt(receiptNumber) {
    setSelectedReceiptNumbers((currentSelection) =>
      currentSelection.includes(receiptNumber)
        ? currentSelection.filter((number) => number !== receiptNumber)
        : [...currentSelection, receiptNumber],
    )
  }

  const allSelected = Boolean(
    result?.receipts.length &&
      selectedReceiptNumbers.length === result.receipts.length,
  )

  function toggleAllReceipts() {
    setSelectedReceiptNumbers(
      allSelected ? [] : result.receipts.map((receipt) => receipt.receiptNumber),
    )
  }

  function handlePrintSelected() {
    const selectedReceipts = result.receipts.filter((receipt) =>
      selectedReceiptNumbers.includes(receipt.receiptNumber),
    )
    const reportRows = selectedReceipts.flatMap((receipt) =>
      receipt.matchingItems.map((item) => ({
        date: receipt.receiptDate,
        name: item.name,
        quantity: Number(item.quantity ?? 0),
        totalMoney: Number(item.totalMoney ?? 0),
      })),
    )
    const printWindow = window.open('', '_blank', 'width=900,height=700')

    if (!printWindow) {
      showErrorToast('No se pudo abrir la ventana de impresión.')
      return
    }

    const totalQuantity = reportRows.reduce(
      (total, item) => total + item.quantity,
      0,
    )
    const totalSales = reportRows.reduce(
      (total, item) => total + item.totalMoney,
      0,
    )
    const rows = reportRows
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(formatReportDate(item.date))}</td>
            <td>${escapeHtml(item.name)}</td>
            <td class="number">${escapeHtml(item.quantity)}</td>
            <td class="number">${escapeHtml(formatReportNumber(item.totalMoney))}</td>
          </tr>
        `,
      )
      .join('')

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Informe de Ventas por Artículo</title>
          <style>
            @page { size: A4 portrait; margin: 16mm 15mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #111;
              font-family: Calibri, Arial, sans-serif;
              font-size: 11pt;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            h1 { margin: 0 0 3px; font-size: 14pt; font-weight: 700; }
            p { margin: 0 0 2px; font-size: 12pt; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            thead { display: table-header-group; }
            th {
              background: #4ea72e;
              color: #fff;
              font-weight: 700;
              text-align: left;
            }
            th, td {
              border-bottom: 1px solid #7ed36a;
              padding: 2px 4px;
              line-height: 1.15;
            }
            th:first-child, td:first-child { border-left: 1px solid #7ed36a; }
            th:last-child, td:last-child { border-right: 1px solid #7ed36a; }
            tbody tr:nth-child(odd) { background: #d9efd0; }
            tfoot { display: table-row-group; }
            tr { break-inside: avoid; }
            .date-column { width: 16%; }
            .item-column { width: 54%; }
            .quantity-column { width: 14%; }
            .sales-column { width: 16%; }
            .number { text-align: right; }
            tfoot td {
              border-top: 3px double #4ea72e;
              border-bottom: 1px solid #7ed36a;
              background: #fff;
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <h1>Informe de Ventas por Artículo</h1>
          <p>Periodo: ${escapeHtml(formatPeriodDate(filters.dateFrom))} a ${escapeHtml(formatPeriodDate(filters.dateTo))}</p>
          <table>
            <thead>
              <tr>
                <th class="date-column">Fecha</th>
                <th class="item-column">Artículo</th>
                <th class="quantity-column number">Cantidad</th>
                <th class="sales-column number">Ventas netas</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td></td>
                <td></td>
                <td class="number">${escapeHtml(totalQuantity)}</td>
                <td class="number">${escapeHtml(formatReportNumber(totalSales))}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSearch}
        className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            Consulta directa
          </p>
          <h3 className="mt-1 text-xl font-semibold text-stone-900">
            Recibos por fecha y categoria
          </h3>
          <p className="mt-2 text-sm text-stone-600">
            Se mostrarán los recibos que contengan al menos un producto de la categoria seleccionada.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            Desde
            <input
              type="date"
              required
              value={filters.dateFrom}
              max={filters.dateTo}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
              className="rounded-md border border-stone-300 bg-white px-3 py-2.5 font-normal text-stone-900 outline-none focus:border-violet-500"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            Hasta
            <input
              type="date"
              required
              value={filters.dateTo}
              min={filters.dateFrom}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
              className="rounded-md border border-stone-300 bg-white px-3 py-2.5 font-normal text-stone-900 outline-none focus:border-violet-500"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-stone-700">
            Categoria
            <select
              required
              value={filters.categoryId}
              disabled={isLoadingCategories}
              onChange={(event) => updateFilter('categoryId', event.target.value)}
              className="rounded-md border border-stone-300 bg-white px-3 py-2.5 font-normal text-stone-900 outline-none focus:border-violet-500 disabled:cursor-wait disabled:bg-stone-100"
            >
              <option value="">
                {isLoadingCategories ? 'Cargando categorias...' : 'Selecciona una categoria'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isSearching || isLoadingCategories}
            className="rounded-md bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching ? 'Buscando...' : 'Obtener recibos'}
          </button>
        </div>
      </form>

      {result ? (
        <section className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                {result.category.name}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-stone-900">
                {result.summary.totalReceipts} recibo(s)
              </h3>
              <p className="mt-1 text-sm text-stone-600">
                Total de la categoria: {formatCurrency(result.summary.totalAmount)}
              </p>
            </div>
            <button
              type="button"
              disabled={selectedReceiptNumbers.length === 0}
              onClick={handlePrintSelected}
              className="rounded-md bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
            >
              Imprimir seleccionados ({selectedReceiptNumbers.length})
            </button>
          </div>

          {result.receipts.length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs uppercase tracking-[0.12em] text-stone-500">
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAllReceipts}
                        aria-label="Seleccionar todos los recibos"
                      />
                    </th>
                    <th className="px-3 py-3">Recibo</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Productos coincidentes</th>
                    <th className="px-3 py-3 text-right">Total categoria</th>
                    <th className="px-3 py-3 text-right">Total recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.receipts.map((receipt) => (
                    <tr key={receipt.receiptNumber} className="border-b border-stone-100 align-top">
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedReceiptNumbers.includes(receipt.receiptNumber)}
                          onChange={() => toggleReceipt(receipt.receiptNumber)}
                          aria-label={`Seleccionar recibo ${receipt.receiptNumber}`}
                        />
                      </td>
                      <td className="px-3 py-4 font-semibold text-stone-900">
                        {receipt.receiptNumber}
                        {receipt.cancelledAt ? (
                          <span className="mt-1 block text-xs font-medium text-rose-700">Anulado</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-stone-600">
                        {formatReceiptDate(receipt.receiptDate)}
                      </td>
                      <td className="px-3 py-4 text-stone-600">
                        {receipt.matchingItems.map((item) => (
                          <span key={item.id} className="block">
                            {item.quantity} × {item.name}
                          </span>
                        ))}
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-violet-800">
                        {formatCurrency(receipt.categoryTotal)}
                      </td>
                      <td className="px-3 py-4 text-right text-stone-700">
                        {formatCurrency(receipt.totalMoney)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center text-sm text-stone-600">
              No se encontraron recibos con productos de esta categoria en el rango indicado.
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

export default LoyverseReceiptsPage
