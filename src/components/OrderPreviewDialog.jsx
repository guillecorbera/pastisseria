function OrderPreviewDialog({
  open,
  order,
  formatCurrency,
  formatDate,
  onClose,
  onPrint,
  onRegenerateCsv,
}) {
  if (!open || !order) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Vista del pedido
            </p>
            <h3 className="mt-2 text-xl font-semibold text-stone-900">
              {formatDate(order.orderDate)}
            </h3>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
              {order.csvFilename}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {order.status === 'open' ? (
              <button
                type="button"
                onClick={onRegenerateCsv}
                className="rounded-sm bg-amber-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-950 transition hover:bg-amber-400"
              >
                Regenerar CSV
              </button>
            ) : null}
            <button
              type="button"
              onClick={onPrint}
              className="rounded-sm bg-stone-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-700"
            >
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm bg-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-700 transition hover:bg-stone-200"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="overflow-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-sm border border-stone-200 bg-stone-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Estado
              </p>
              <p className="mt-2 text-base font-semibold text-stone-900">
                {order.status === 'closed' ? 'Cerrado' : 'Abierto'}
              </p>
            </div>
            <div className="rounded-sm border border-stone-200 bg-stone-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Líneas
              </p>
              <p className="mt-2 text-base font-semibold text-stone-900">
                {order.items.length}
              </p>
            </div>
            <div className="rounded-sm border border-stone-200 bg-stone-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Unidades vendidas
              </p>
              <p className="mt-2 text-base font-semibold text-stone-900">
                {order.status === 'closed'
                  ? order.summary?.totalSoldUnits ?? 0
                  : 0}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-sm border border-stone-200">
            <table className="min-w-full divide-y divide-stone-200 text-left text-sm">
              <thead className="bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-medium">REF</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Restante</th>
                  <th className="px-4 py-3 font-medium">Vendido</th>
                  <th className="px-4 py-3 font-medium">Precio venta</th>
                  <th className="px-4 py-3 font-medium">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {order.items.map((item) => {
                  const remainingQuantity =
                    order.status === 'closed'
                      ? Number(item.remainingQuantity ?? 0)
                      : Number(item.quantityOrdered)
                  const soldQuantity =
                    order.status === 'closed'
                      ? Number(item.soldQuantity ?? 0)
                      : Math.max(Number(item.quantityOrdered) - remainingQuantity, 0)
                  const salesAmount =
                    order.status === 'closed'
                      ? Number(item.salesAmount ?? 0)
                      : soldQuantity * Number(item.salePrice ?? 0)

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-stone-700">{item.ref}</td>
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3">{item.quantityOrdered}</td>
                      <td className="px-4 py-3">{remainingQuantity}</td>
                      <td className="px-4 py-3 font-semibold text-stone-900">
                        {soldQuantity}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(item.salePrice)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {formatCurrency(salesAmount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-sm border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Venta del día
            </p>
            <p className="mt-2 text-xl font-semibold text-emerald-900">
              {formatCurrency(
                order.status === 'closed' ? order.totalSalesAmount ?? 0 : 0,
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderPreviewDialog
