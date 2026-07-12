import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import { getInvoicePdfUrl } from '../lib/api'
import { getToday } from '../lib/formatters'

function createDraftItem() {
  return {
    id: `draft-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    description: '',
    quantity: 1,
    vatRate: 10,
    unitPrice: 0,
  }
}

function createEmptyInvoiceDraft() {
  return {
    issueDate: getToday(),
    clientId: '',
    clientName: '',
    taxId: '',
    clientAddress: '',
    clientPostalCode: '',
    clientCity: '',
    clientEmail: '',
    clientPhone: '',
    paymentByTransfer: false,
    dueDate: getToday(),
    status: 'pendiente',
    notes: '',
    vatRate: 10,
    items: [createDraftItem()],
  }
}

function calculateInvoiceTotals(items, vatRate) {
  const breakdown = items.reduce((rows, item) => {
    const total = Number(item.quantity || 0) * Number(item.unitPrice || 0)
    const itemVatRate = Number(item.vatRate ?? vatRate ?? 0)
    const normalizedVatRate = Number.isFinite(itemVatRate) && itemVatRate >= 0 ? itemVatRate : 0
    const currentRow = rows.get(normalizedVatRate) ?? {
      subtotal: 0,
      vatAmount: 0,
      total: 0,
    }

    if (normalizedVatRate <= 0) {
      currentRow.subtotal += total
      currentRow.total += total
    } else {
      const subtotal = total / (1 + normalizedVatRate / 100)
      currentRow.subtotal += subtotal
      currentRow.vatAmount += total - subtotal
      currentRow.total += total
    }

    rows.set(normalizedVatRate, currentRow)
    return rows
  }, new Map())

  return {
    subtotal: [...breakdown.values()].reduce((sum, row) => sum + row.subtotal, 0),
    vatAmount: [...breakdown.values()].reduce((sum, row) => sum + row.vatAmount, 0),
    total: [...breakdown.values()].reduce((sum, row) => sum + row.total, 0),
  }
}

function calculateInvoiceBreakdown(items, vatRate) {
  const rows = items.reduce((breakdown, item) => {
    const total = Number(item.lineTotal ?? Number(item.quantity || 0) * Number(item.unitPrice || 0))
    const itemVatRate = Number(item.vatRate ?? vatRate ?? 0)
    const normalizedVatRate = Number.isFinite(itemVatRate) && itemVatRate >= 0 ? itemVatRate : 0
    const currentRow = breakdown.get(normalizedVatRate) ?? {
      vatRate: normalizedVatRate,
      subtotal: 0,
      vatAmount: 0,
      total: 0,
    }

    if (normalizedVatRate <= 0) {
      currentRow.subtotal += total
      currentRow.total += total
    } else {
      const subtotal = total / (1 + normalizedVatRate / 100)
      currentRow.subtotal += subtotal
      currentRow.vatAmount += total - subtotal
      currentRow.total += total
    }

    breakdown.set(normalizedVatRate, currentRow)
    return breakdown
  }, new Map())

  return [...rows.values()].sort((left, right) => left.vatRate - right.vatRate)
}

function compareTextValues(left, right) {
  return `${left ?? ''}`.localeCompare(`${right ?? ''}`, 'es-ES', {
    sensitivity: 'base',
    numeric: true,
  })
}

function compareNumberValues(left, right) {
  return Number(left ?? 0) - Number(right ?? 0)
}

function InvoicingPage({
  section,
  clients,
  invoices,
  onNavigateSection,
  onCreateClient,
  onCreateInvoice,
  onEditClient,
  onEditInvoice,
  onDeleteClient,
  onDeleteInvoice,
  onUpdateInvoiceStatus,
  formatCurrency,
  formatDate,
}) {
  const [clientForm, setClientForm] = useState({
    name: '',
    taxId: '',
    address: '',
    postalCode: '',
    city: '',
    email: '',
    phone: '',
  })
  const [draft, setDraft] = useState({
    ...createEmptyInvoiceDraft(),
  })
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [historySort, setHistorySort] = useState({
    field: 'invoice',
    direction: 'desc',
  })

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null
  const selectedInvoiceBreakdown = useMemo(
    () =>
      selectedInvoice
        ? calculateInvoiceBreakdown(selectedInvoice.items ?? [], selectedInvoice.vatRate)
        : [],
    [selectedInvoice],
  )

  const { subtotal: draftSubtotal, vatAmount: draftVatAmount, total: draftTotal } =
    useMemo(
      () => calculateInvoiceTotals(draft.items, draft.vatRate),
      [draft.items, draft.vatRate],
    )

  const invoiceTotals = useMemo(
    () =>
      invoices.reduce(
        (accumulator, invoice) => ({
          billed: accumulator.billed + Number(invoice.total ?? 0),
          paid:
            accumulator.paid +
            (invoice.status === 'pagada' ? Number(invoice.total ?? 0) : 0),
          pending:
            accumulator.pending +
            (invoice.status !== 'pagada' ? Number(invoice.total ?? 0) : 0),
        }),
        { billed: 0, paid: 0, pending: 0 },
      ),
    [invoices],
  )

  const sortedHistoryInvoices = useMemo(() => {
    const sortedInvoices = [...invoices]

    sortedInvoices.sort((left, right) => {
      let result = 0

      if (historySort.field === 'date') {
        result = compareTextValues(left.issueDate, right.issueDate)
      }

      if (historySort.field === 'client') {
        result = compareTextValues(left.clientName, right.clientName)
      }

      if (historySort.field === 'invoice') {
        result = compareTextValues(left.invoiceNumber, right.invoiceNumber)
      }

      if (historySort.field === 'status') {
        result = compareTextValues(left.status, right.status)
      }

      if (historySort.field === 'total') {
        result = compareNumberValues(left.total, right.total)
      }

      if (result === 0) {
        result = compareNumberValues(left.id, right.id)
      }

      return historySort.direction === 'asc' ? result : -result
    })

    return sortedInvoices
  }, [historySort, invoices])

  const clientsWithStats = useMemo(() => {
    const invoicesByClientName = new Map()

    invoices.forEach((invoice) => {
      const key = invoice.clientName?.trim().toLocaleLowerCase('es-ES')

      if (!key) {
        return
      }

      const currentClient = invoicesByClientName.get(key) ?? {
        clientName: invoice.clientName,
        taxId: invoice.taxId,
        invoiceCount: 0,
        totalBilled: 0,
        pendingAmount: 0,
        lastInvoiceDate: invoice.issueDate,
      }

      currentClient.invoiceCount += 1
      currentClient.totalBilled += Number(invoice.total ?? 0)
      currentClient.pendingAmount +=
        invoice.status !== 'pagada' ? Number(invoice.total ?? 0) : 0
      currentClient.lastInvoiceDate =
        currentClient.lastInvoiceDate > invoice.issueDate
          ? currentClient.lastInvoiceDate
          : invoice.issueDate

      invoicesByClientName.set(key, currentClient)
    })

    return clients
      .map((client) => {
        const stats =
          invoicesByClientName.get(client.name.trim().toLocaleLowerCase('es-ES')) ?? null

        return {
          ...client,
          clientName: client.name,
          invoiceCount: stats?.invoiceCount ?? 0,
          totalBilled: stats?.totalBilled ?? 0,
          pendingAmount: stats?.pendingAmount ?? 0,
          lastInvoiceDate: stats?.lastInvoiceDate ?? '',
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'es-ES'))
  }, [clients, invoices])

  function updateDraftField(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateClientForm(field, value) {
    setClientForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleClientSelection(clientId) {
    const selectedClient = clients.find((client) => `${client.id}` === `${clientId}`)

    if (!selectedClient) {
      setDraft((current) => ({
        ...current,
        clientId: '',
      }))
      return
    }

    setDraft((current) => ({
      ...current,
      clientId: selectedClient.id,
      clientName: selectedClient.name ?? '',
      taxId: selectedClient.taxId ?? '',
      clientAddress: selectedClient.address ?? '',
      clientPostalCode: selectedClient.postalCode ?? '',
      clientCity: selectedClient.city ?? '',
      clientEmail: selectedClient.email ?? '',
      clientPhone: selectedClient.phone ?? '',
    }))
  }

  function updateDraftItem(itemId, field, value) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }))
  }

  function handleHistorySort(field) {
    setHistorySort((current) => ({
      field,
      direction:
        current.field === field
          ? current.direction === 'asc'
            ? 'desc'
            : 'asc'
          : field === 'date'
            ? 'desc'
            : 'asc',
    }))
  }

  function getHistorySortIndicator(field) {
    if (historySort.field !== field) {
      return '↕'
    }

    return historySort.direction === 'asc' ? '↑' : '↓'
  }

  function addDraftItem() {
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          ...createDraftItem(),
          vatRate: Number(current.vatRate ?? 10),
        },
      ],
    }))
  }

  function removeDraftItem(itemId) {
    setDraft((current) => ({
      ...current,
      items:
        current.items.length > 1
          ? current.items.filter((item) => item.id !== itemId)
          : current.items,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const created = await onCreateInvoice(draft)

    if (created) {
      setDraft(createEmptyInvoiceDraft())
    }
  }

  async function handleClientSubmit(event) {
    event.preventDefault()

    const created = await onCreateClient(clientForm)

    if (created) {
      setClientForm({
        name: '',
        taxId: '',
        address: '',
        postalCode: '',
        city: '',
        email: '',
        phone: '',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Facturado
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-900">
            {formatCurrency(invoiceTotals.billed)}
          </p>
        </article>
        <article className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Cobrado
          </p>
          <p className="mt-1 text-2xl font-semibold text-sky-900">
            {formatCurrency(invoiceTotals.paid)}
          </p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Pendiente
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">
            {formatCurrency(invoiceTotals.pending)}
          </p>
        </article>
      </div>

      {section === 'invoicing-dashboard' ? (
        <div>
          <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Nueva factura
                </p>
                <h2 className="mt-1 text-lg font-semibold text-stone-900">
                  Emision y calculo automatico
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateSection('invoicing-history')}
                className="rounded-sm border border-stone-300 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:bg-stone-100"
              >
                Ver historial
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Seleccionar cliente
                  </span>
                  <select
                    value={draft.clientId}
                    onChange={(event) => handleClientSelection(event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  >
                    <option value="">Cliente manual</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Cliente
                  </span>
                  <input
                    value={draft.clientName}
                    onChange={(event) => updateDraftField('clientName', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                    placeholder="Nombre o razon social"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    NIF / CIF
                  </span>
                  <input
                    value={draft.taxId}
                    onChange={(event) => updateDraftField('taxId', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                    placeholder="B12345678"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Direccion
                  </span>
                  <input
                    value={draft.clientAddress}
                    onChange={(event) => updateDraftField('clientAddress', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                    placeholder="Calle, numero..."
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    CP
                  </span>
                  <input
                    value={draft.clientPostalCode}
                    onChange={(event) =>
                      updateDraftField('clientPostalCode', event.target.value)
                    }
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Ciudad
                  </span>
                  <input
                    value={draft.clientCity}
                    onChange={(event) => updateDraftField('clientCity', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Correo electronico
                  </span>
                  <input
                    value={draft.clientEmail}
                    onChange={(event) => updateDraftField('clientEmail', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Telefono
                  </span>
                  <input
                    value={draft.clientPhone}
                    onChange={(event) => updateDraftField('clientPhone', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Vencimiento
                  </span>
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) => updateDraftField('dueDate', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Estado inicial
                  </span>
                  <select
                    value={draft.status}
                    onChange={(event) => updateDraftField('status', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="pagada">Pagada</option>
                    <option value="vencida">Vencida</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.paymentByTransfer)}
                    onChange={(event) =>
                      updateDraftField('paymentByTransfer', event.target.checked)
                    }
                    className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-400"
                  />
                  <span className="text-sm text-stone-700">
                    Mostrar forma de pago por transferencia en el pie del PDF
                  </span>
                </label>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Lineas de factura</p>
                    <p className="text-xs text-stone-500">
                      Describe cada producto o servicio y su importe unitario.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addDraftItem}
                    className="rounded-sm bg-stone-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-700"
                  >
                    Anadir linea
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {draft.items.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1.5fr_0.4fr_0.45fr_0.6fr_0.65fr_auto]"
                    >
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                          Descripción
                        </span>
                        <input
                          value={item.description}
                          onChange={(event) =>
                            updateDraftItem(item.id, 'description', event.target.value)
                          }
                          className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-400"
                          placeholder={`Línea ${index + 1}`}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                          Cantidad
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateDraftItem(item.id, 'quantity', event.target.value)
                          }
                          className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-400"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                          IVA (%)
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.vatRate ?? draft.vatRate}
                          onChange={(event) =>
                            updateDraftItem(item.id, 'vatRate', event.target.value)
                          }
                          className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-400"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                          Precio unitario (€)
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateDraftItem(item.id, 'unitPrice', event.target.value)
                          }
                          className="w-full rounded-sm border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-400"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                          Total
                        </span>
                        <input
                          type="text"
                          value={formatCurrency(
                            Number(item.quantity || 0) * Number(item.unitPrice || 0),
                          )}
                          readOnly
                          className="w-full cursor-default rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2.5 font-semibold text-emerald-800 outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeDraftItem(item.id)}
                        className="w-full self-end rounded-sm border border-rose-700 bg-rose-600 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:border-rose-800 hover:bg-rose-700 sm:col-span-2 xl:col-span-1 xl:w-auto"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[0.6fr_1.4fr]">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    IVA % por defecto
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.vatRate}
                    onChange={(event) => updateDraftField('vatRate', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                  <span className="mt-2 block text-xs text-stone-500">
                    Se usa en las nuevas líneas. Los precios de línea ya incluyen IVA.
                  </span>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Notas
                  </span>
                  <textarea
                    value={draft.notes}
                    onChange={(event) => updateDraftField('notes', event.target.value)}
                    className="min-h-24 w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                    placeholder="Observaciones, condiciones de pago o detalle del servicio"
                  />
                </label>
              </div>

              <div className="grid gap-3 rounded-xl border border-stone-200 bg-emerald-50/60 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Base imponible
                  </p>
                  <p className="mt-1 text-lg font-semibold text-stone-900">
                    {formatCurrency(draftSubtotal)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    IVA
                  </p>
                  <p className="mt-1 text-lg font-semibold text-stone-900">
                    {formatCurrency(draftVatAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Total
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-700">
                    {formatCurrency(draftTotal)}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-sm bg-emerald-600 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-emerald-500"
              >
                Emitir factura
              </button>
            </form>
          </article>

        </div>
      ) : null}

      {section === 'invoicing-history' ? (
        <div>
          <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-stone-900">Historial de facturas</h3>
              <button
                type="button"
                onClick={() => onNavigateSection('invoicing-dashboard')}
                className="rounded-sm bg-emerald-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-emerald-500"
              >
                Nueva factura
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-stone-200">
              {invoices.length === 0 ? (
                <div className="bg-white p-5">
                  <EmptyState
                    title="Todavia no hay facturas"
                    description="Las facturas emitidas apareceran aqui para su seguimiento."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto bg-white">
                  <table className="min-w-full divide-y divide-stone-200 text-sm">
                    <thead className="bg-stone-100/80">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        <th className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleHistorySort('invoice')}
                            className="inline-flex items-center gap-2 transition hover:text-stone-800"
                          >
                            Factura
                            <span>{getHistorySortIndicator('invoice')}</span>
                          </button>
                        </th>
                        <th className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleHistorySort('client')}
                            className="inline-flex items-center gap-2 transition hover:text-stone-800"
                          >
                            Cliente
                            <span>{getHistorySortIndicator('client')}</span>
                          </button>
                        </th>
                        <th className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleHistorySort('date')}
                            className="inline-flex items-center gap-2 transition hover:text-stone-800"
                          >
                            Fecha
                            <span>{getHistorySortIndicator('date')}</span>
                          </button>
                        </th>
                        <th className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleHistorySort('status')}
                            className="inline-flex items-center gap-2 transition hover:text-stone-800"
                          >
                            Estado
                            <span>{getHistorySortIndicator('status')}</span>
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleHistorySort('total')}
                            className="inline-flex items-center gap-2 transition hover:text-stone-800"
                          >
                            Total
                            <span>{getHistorySortIndicator('total')}</span>
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {sortedHistoryInvoices.map((invoice) => (
                        <tr
                          key={invoice.id}
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                          className={`cursor-pointer transition ${
                            selectedInvoice?.id === invoice.id
                              ? 'bg-emerald-50'
                              : 'bg-white hover:bg-stone-50'
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold text-stone-900">
                            {invoice.invoiceNumber}
                          </td>
                          <td className="px-4 py-3 text-stone-600">{invoice.clientName}</td>
                          <td className="px-4 py-3 text-stone-500">
                            {formatDate(invoice.issueDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                invoice.status === 'pagada'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : invoice.status === 'vencida'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-stone-900">
                            {formatCurrency(invoice.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </article>

          {selectedInvoice ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="invoice-detail-title"
              onClick={() => setSelectedInvoiceId(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
            >
              <article
                onClick={(event) => event.stopPropagation()}
                className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 shadow-[0_30px_100px_rgba(0,0,0,0.32)] sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Detalle
                    </p>
                    <h3 id="invoice-detail-title" className="mt-1 text-xl font-semibold text-stone-900">
                      Vista de factura
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceId(null)}
                    className="rounded-sm border border-stone-300 bg-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:bg-stone-200"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-lg font-semibold text-stone-900">
                    {selectedInvoice.invoiceNumber}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">{selectedInvoice.clientName}</p>
                  {selectedInvoice.clientAddress ? (
                    <p className="mt-1 text-sm text-stone-500">
                      {selectedInvoice.clientAddress}
                    </p>
                  ) : null}
                  {selectedInvoice.clientPostalCode || selectedInvoice.clientCity ? (
                    <p className="mt-1 text-sm text-stone-500">
                      {selectedInvoice.clientPostalCode} {selectedInvoice.clientCity}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-stone-500">
                    Emision {formatDate(selectedInvoice.issueDate)} · Vence{' '}
                    {formatDate(selectedInvoice.dueDate)}
                  </p>
                </div>

                <div className="space-y-2">
                  {selectedInvoice.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-3"
                    >
                      <div>
                        <p className="font-medium text-stone-900">{item.description}</p>
                        <p className="text-sm text-stone-500">
                          {item.quantity} x {formatCurrency(item.unitPrice)} · IVA{' '}
                          {item.vatRate ?? selectedInvoice.vatRate}%
                        </p>
                      </div>
                      <p className="font-semibold text-stone-900">
                        {formatCurrency(item.lineTotal)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between text-sm text-stone-600">
                    <span>Base imponible</span>
                    <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {selectedInvoiceBreakdown.map((taxRow) => (
                    <div
                      key={taxRow.vatRate}
                      className="mt-2 flex items-center justify-between text-sm text-stone-600"
                    >
                      <span>IVA {taxRow.vatRate}%</span>
                      <span>{formatCurrency(taxRow.vatAmount)}</span>
                    </div>
                  ))}
                  <div className="mt-3 flex items-center justify-between text-base font-semibold text-stone-900">
                    <span>Total</span>
                    <span>{formatCurrency(selectedInvoice.total)}</span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => onUpdateInvoiceStatus(selectedInvoice.id, 'pendiente')}
                    className="rounded-sm border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 transition hover:bg-amber-100"
                  >
                    Marcar pendiente
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateInvoiceStatus(selectedInvoice.id, 'pagada')}
                    className="rounded-sm border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Marcar pagada
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateInvoiceStatus(selectedInvoice.id, 'vencida')}
                    className="rounded-sm border border-rose-300 bg-rose-50 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100"
                  >
                    Marcar vencida
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      const invoiceToEdit = selectedInvoice
                      setSelectedInvoiceId(null)
                      onEditInvoice(invoiceToEdit)
                    }}
                    className="rounded-sm bg-sky-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-sky-500"
                  >
                    Editar factura
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const invoiceToDelete = selectedInvoice
                      setSelectedInvoiceId(null)
                      onDeleteInvoice(invoiceToDelete)
                    }}
                    className="rounded-sm bg-rose-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-rose-500"
                  >
                    Eliminar factura
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      getInvoicePdfUrl(selectedInvoice.id),
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                  className="w-full rounded-sm bg-stone-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-stone-700"
                >
                  Abrir PDF de factura
                </button>

                {selectedInvoice.notes ? (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                    {selectedInvoice.notes}
                  </div>
                ) : null}
                </div>
              </article>
            </div>
          ) : null}
        </div>
      ) : null}

      {section === 'invoicing-clients' ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.2fr]">
          <article className="rounded-md border border-stone-200 bg-white/90 p-4 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Nuevo cliente
            </p>
            <h3 className="mt-1 text-lg font-semibold text-stone-900">CRUD de clientes</h3>

            <form className="mt-4 space-y-3" onSubmit={handleClientSubmit}>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Nombre
                </span>
                <input
                  value={clientForm.name}
                  onChange={(event) => updateClientForm('name', event.target.value)}
                  className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  NIF / CIF
                </span>
                <input
                  value={clientForm.taxId}
                  onChange={(event) => updateClientForm('taxId', event.target.value)}
                  className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Direccion
                </span>
                <input
                  value={clientForm.address}
                  onChange={(event) => updateClientForm('address', event.target.value)}
                  className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    CP
                  </span>
                  <input
                    value={clientForm.postalCode}
                    onChange={(event) => updateClientForm('postalCode', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Ciudad
                  </span>
                  <input
                    value={clientForm.city}
                    onChange={(event) => updateClientForm('city', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Correo electronico
                  </span>
                  <input
                    value={clientForm.email}
                    onChange={(event) => updateClientForm('email', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Telefono
                  </span>
                  <input
                    value={clientForm.phone}
                    onChange={(event) => updateClientForm('phone', event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-2.5 outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="w-full rounded-sm bg-emerald-600 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-emerald-500"
              >
                Crear cliente
              </button>
            </form>
          </article>

          <article className="rounded-md border border-stone-200 bg-white/90 p-4 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Clientes
            </p>
            <h3 className="mt-1 text-lg font-semibold text-stone-900">Agenda comercial</h3>

            <div className="mt-4 space-y-3">
              {clientsWithStats.length === 0 ? (
                <EmptyState
                  title="Aun no hay clientes registrados"
                  description="Crea clientes aquí para seleccionarlos al emitir facturas."
                />
              ) : (
                clientsWithStats.map((client) => (
                  <div
                    key={client.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/80 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-stone-900">
                          {client.clientName}
                        </p>
                        <p className="text-sm text-stone-500">
                          {client.taxId || 'Sin NIF/CIF'}
                          {client.lastInvoiceDate
                            ? ` · Ultima factura ${formatDate(client.lastInvoiceDate)}`
                            : ''}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {[client.address, client.postalCode, client.city]
                            .filter(Boolean)
                            .join(' · ') || 'Sin direccion'}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {[client.email, client.phone].filter(Boolean).join(' · ') ||
                            'Sin contacto'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                          {client.invoiceCount} facturas
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {formatCurrency(client.totalBilled)}
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          {formatCurrency(client.pendingAmount)} pendiente
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onEditClient(client)}
                        className="rounded-sm bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-sky-500"
                      >
                        Editar
                      </button>
                      {client.invoiceCount > 0 ? (
                        <span className="rounded-sm border border-stone-300 bg-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                          Con ventas, no eliminable
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDeleteClient(client)}
                          className="rounded-sm bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-rose-500"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      ) : null}
    </div>
  )
}

export default InvoicingPage
