import { useRef } from 'react'

import EmptyState from '../components/EmptyState'

function ClosingPage({
  selectedOrder,
  closingDraft,
  onUpdateClosingDraft,
  onCloseOrder,
  isClosingOrder,
  liveOrderSummary,
  formatCurrency,
  formatDate,
  getPrintDate,
}) {
  const remainingInputRefs = useRef([])

  function handleRemainingKeyDown(event, rowIndex) {
    if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      return
    }

    event.preventDefault()
    const lastIndex = remainingInputRefs.current.length - 1

    if (event.key === 'ArrowUp') {
      const previousInput =
        remainingInputRefs.current[rowIndex - 1] ?? remainingInputRefs.current[lastIndex]

      if (previousInput) {
        previousInput.focus()
        previousInput.select()
      }

      return
    }

    if (event.key === 'ArrowDown') {
      const nextInput =
        remainingInputRefs.current[rowIndex + 1] ?? remainingInputRefs.current[0]

      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      }

      return
    }

    if (event.shiftKey) {
      const previousInput =
        remainingInputRefs.current[rowIndex - 1] ?? remainingInputRefs.current[lastIndex]

      if (previousInput) {
        previousInput.focus()
        previousInput.select()
      }

      return
    }

    const nextInput =
      remainingInputRefs.current[rowIndex + 1] ?? remainingInputRefs.current[0]

    if (nextInput) {
      nextInput.focus()
      nextInput.select()
    }
  }

  return (
    <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Cierre del día
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-900">
            Registrar cantidades restantes
          </h2>
        </div>
        {selectedOrder ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-sm bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-700"
          >
            Imprimir resumen
          </button>
        ) : null}
      </div>

      {!selectedOrder ? (
        <div className="mt-6">
          <EmptyState
            title="Selecciona un pedido"
            description="Abre uno de los pedidos del historial para cargar las cantidades restantes y calcular la venta."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-5 print:mt-0">
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <div className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Fecha del pedido
              </span>
              <div className="rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                {formatDate(selectedOrder.orderDate)}
              </div>
              <p className="mt-2 text-[11px] text-stone-500">
                El cierre se registra sobre este pedido diario.
              </p>
            </div>

            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Carga la cantidad que quedó al final del día para cada producto. La
              venta se calcula automáticamente por diferencia entre lo pedido y lo
              restante.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Unidades pedidas
              </p>
              <p className="mt-2 text-xl font-semibold text-stone-900">
                {selectedOrder.summary?.totalOrderedUnits ?? 0}
              </p>
            </div>
            <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Unidades vendidas
              </p>
              <p className="mt-2 text-xl font-semibold text-emerald-700">
                {selectedOrder.status === 'closed'
                  ? selectedOrder.summary?.totalSoldUnits ?? 0
                  : liveOrderSummary.totalSoldUnits}
              </p>
            </div>
            <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Unidades restantes
              </p>
              <p className="mt-2 text-xl font-semibold text-stone-900">
                {selectedOrder.status === 'closed'
                  ? selectedOrder.summary?.totalRemainingUnits ?? 0
                  : liveOrderSummary.totalRemainingUnits}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-stone-200">
            <div className="max-h-[36rem] overflow-auto">
              <table className="min-w-full divide-y divide-stone-200 text-left text-[13px]">
                <thead className="sticky top-0 bg-stone-100 text-stone-600">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">REF</th>
                    <th className="px-3 py-2.5 font-medium">Producto</th>
                    <th className="px-3 py-2.5 font-medium">Pedido</th>
                    <th className="px-3 py-2.5 font-medium">Restante</th>
                    <th className="px-3 py-2.5 font-medium">Vendido</th>
                    <th className="px-3 py-2.5 font-medium">Precio venta</th>
                    <th className="px-3 py-2.5 font-medium">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {selectedOrder.items.map((item, index) => {
                    const remainingQuantity = Number(
                      closingDraft[item.id] ?? item.remainingQuantity ?? item.quantityOrdered,
                    )
                    const soldQuantity = Math.max(
                      Number(item.quantityOrdered) - remainingQuantity,
                      0,
                    )
                    const salesAmount = soldQuantity * Number(item.salePrice)

                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-medium text-stone-700">{item.ref}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-stone-900">{item.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
                            {item.category || 'Sin categoría'}
                          </p>
                        </td>
                        <td className="px-3 py-2 font-semibold text-stone-900">
                          {item.quantityOrdered}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            max={item.quantityOrdered}
                            value={remainingQuantity}
                            disabled={selectedOrder.status === 'closed'}
                            ref={(element) => {
                              remainingInputRefs.current[index] = element
                            }}
                            onChange={(event) =>
                              onUpdateClosingDraft(item.id, Number(event.target.value))
                            }
                            onKeyDown={(event) => handleRemainingKeyDown(event, index)}
                            className="w-20 rounded-sm border border-stone-300 bg-white px-2.5 py-1.5 outline-none focus:border-amber-400 disabled:bg-stone-100"
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-stone-900">
                          {selectedOrder.status === 'closed' ? item.soldQuantity : soldQuantity}
                        </td>
                        <td className="px-3 py-2 text-emerald-700">
                          {formatCurrency(item.salePrice)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-emerald-700">
                          {selectedOrder.status === 'closed'
                            ? formatCurrency(item.salesAmount)
                            : formatCurrency(salesAmount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-md bg-stone-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-300">
                Total de venta
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrency(
                  selectedOrder.status === 'closed'
                    ? selectedOrder.totalSalesAmount ?? 0
                    : liveOrderSummary.totalSalesAmount,
                )}
              </p>
              <p className="mt-2 text-sm text-stone-300">
                {selectedOrder.status === 'closed'
                  ? `Pedido cerrado el ${formatDate(selectedOrder.closedAt)}.`
                  : `Vista previa del cierre para ${getPrintDate(selectedOrder.orderDate)}.`}
              </p>
            </div>
            {selectedOrder.status === 'open' ? (
              <form onSubmit={onCloseOrder} className="sm:min-w-[18rem]">
                <button
                  type="submit"
                  disabled={isClosingOrder}
                  className="w-full rounded-sm bg-emerald-600 px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {isClosingOrder
                    ? 'Guardando cierre...'
                    : 'Guardar cantidades restantes y cerrar día'}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      )}
    </article>
  )
}

export default ClosingPage
