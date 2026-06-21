import { useEffect, useState } from 'react'

function calculateInvoiceTotals(items, vatRate) {
  const total = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  )
  const normalizedVatRate = Number(vatRate || 0)

  if (!Number.isFinite(normalizedVatRate) || normalizedVatRate <= 0) {
    return {
      subtotal: total,
      vatAmount: 0,
      total,
    }
  }

  const subtotal = total / (1 + normalizedVatRate / 100)
  const vatAmount = total - subtotal

  return {
    subtotal,
    vatAmount,
    total,
  }
}

function createEditableItem(item) {
  return {
    id: item.id ?? `draft-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    description: item.description ?? '',
    quantity: Number(item.quantity ?? 1),
    unitPrice: Number(item.unitPrice ?? 0),
  }
}

function InvoiceEditor({ invoice, onCancel, onSaved, isSaving, formatCurrency }) {
  const [form, setForm] = useState(() => ({
    clientId: invoice.clientId ?? '',
    clientName: invoice.clientName ?? '',
    taxId: invoice.taxId ?? '',
    clientAddress: invoice.clientAddress ?? '',
    clientPostalCode: invoice.clientPostalCode ?? '',
    clientCity: invoice.clientCity ?? '',
    clientEmail: invoice.clientEmail ?? '',
    clientPhone: invoice.clientPhone ?? '',
    paymentByTransfer: Boolean(invoice.paymentByTransfer),
    dueDate: invoice.dueDate ?? '',
    status: invoice.status ?? 'pendiente',
    notes: invoice.notes ?? '',
    vatRate: Number(invoice.vatRate ?? 21),
    items: (invoice.items ?? []).map(createEditableItem),
  }))

  useEffect(() => {
    setForm({
      clientId: invoice.clientId ?? '',
      clientName: invoice.clientName ?? '',
      taxId: invoice.taxId ?? '',
      clientAddress: invoice.clientAddress ?? '',
      clientPostalCode: invoice.clientPostalCode ?? '',
      clientCity: invoice.clientCity ?? '',
      clientEmail: invoice.clientEmail ?? '',
      clientPhone: invoice.clientPhone ?? '',
      paymentByTransfer: Boolean(invoice.paymentByTransfer),
      dueDate: invoice.dueDate ?? '',
      status: invoice.status ?? 'pendiente',
      notes: invoice.notes ?? '',
      vatRate: Number(invoice.vatRate ?? 21),
      items: (invoice.items ?? []).map(createEditableItem),
    })
  }, [invoice])

  const { subtotal, vatAmount, total } = calculateInvoiceTotals(
    form.items,
    form.vatRate,
  )

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateItem(itemId, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      ),
    }))
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, createEditableItem({})],
    }))
  }

  function removeItem(itemId) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length > 1
          ? current.items.filter((item) => item.id !== itemId)
          : current.items,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSaved(form)
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-stone-950/40 p-4 backdrop-blur-sm">
      <div className="mx-auto my-6 w-full max-w-4xl rounded-md border border-stone-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Editar factura
            </p>
            <h3 className="mt-2 text-xl font-semibold text-stone-900">
              {invoice.invoiceNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm bg-stone-100 px-4 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-200"
          >
            Cerrar
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">Cliente</span>
              <input
                value={form.clientName}
                onChange={(event) => updateField('clientName', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">NIF / CIF</span>
              <input
                value={form.taxId}
                onChange={(event) => updateField('taxId', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-medium text-stone-600">Dirección</span>
              <input
                value={form.clientAddress}
                onChange={(event) => updateField('clientAddress', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">CP</span>
              <input
                value={form.clientPostalCode}
                onChange={(event) => updateField('clientPostalCode', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">Ciudad</span>
              <input
                value={form.clientCity}
                onChange={(event) => updateField('clientCity', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Correo electrónico
              </span>
              <input
                value={form.clientEmail}
                onChange={(event) => updateField('clientEmail', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">Teléfono</span>
              <input
                value={form.clientPhone}
                onChange={(event) => updateField('clientPhone', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Vencimiento
              </span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => updateField('dueDate', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">Estado</span>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              >
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="vencida">Vencida</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 md:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(form.paymentByTransfer)}
                onChange={(event) => updateField('paymentByTransfer', event.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-400"
              />
              <span className="text-sm text-stone-700">
                Mostrar forma de pago por transferencia en el pie del PDF
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-stone-900">Líneas de factura</p>
              <button
                type="button"
                onClick={addItem}
                className="rounded-sm bg-stone-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-700"
              >
                Añadir línea
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {form.items.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-3 md:grid-cols-[1.6fr_0.45fr_0.6fr_auto]"
                >
                  <input
                    value={item.description}
                    onChange={(event) =>
                      updateItem(item.id, 'description', event.target.value)
                    }
                    className="rounded-sm border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                    placeholder={`Línea ${index + 1}`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.id, 'quantity', event.target.value)
                    }
                    className="rounded-sm border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) =>
                      updateItem(item.id, 'unitPrice', event.target.value)
                    }
                    className="rounded-sm border border-stone-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-sm border border-stone-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:bg-stone-100"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.6fr_1.4fr]">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">IVA %</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.vatRate}
                onChange={(event) => updateField('vatRate', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
              <span className="mt-2 block text-xs text-stone-500">
                Los precios de línea ya incluyen IVA.
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">Notas</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                className="min-h-26 w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>
          </div>

          <div className="grid gap-3 rounded-xl border border-stone-200 bg-emerald-50/60 p-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Base imponible
              </p>
              <p className="mt-1 text-lg font-semibold text-stone-900">
                {formatCurrency(subtotal)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                IVA
              </p>
              <p className="mt-1 text-lg font-semibold text-stone-900">
                {formatCurrency(vatAmount)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Total
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">
                {formatCurrency(total)}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-sm bg-stone-100 px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-sm bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default InvoiceEditor
