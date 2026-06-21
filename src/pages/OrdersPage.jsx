import EmptyState from '../components/EmptyState'

function OrdersPage({
  orders,
  orderFilters,
  onUpdateFilters,
  onSelectOrder,
  onEditOrder,
  onPreviewOrder,
  onRegenerateCsv,
  onStartClosingOrder,
  selectedOrder,
  formatCurrency,
  formatDate,
}) {
  return (
    <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Pedidos
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-900">
            Historial diario
          </h2>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Estado
          </span>
          <select
            value={orderFilters.status}
            onChange={(event) => onUpdateFilters('status', event.target.value)}
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
          >
            <option value="all">Todos</option>
            <option value="open">Abiertos</option>
            <option value="closed">Cerrados</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Desde
          </span>
          <input
            type="date"
            value={orderFilters.dateFrom}
            onChange={(event) => onUpdateFilters('dateFrom', event.target.value)}
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Hasta
          </span>
          <input
            type="date"
            value={orderFilters.dateTo}
            onChange={(event) => onUpdateFilters('dateTo', event.target.value)}
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
          />
        </label>
      </div>

      <div className="mt-6 space-y-2">
        {orders.length === 0 ? (
          <EmptyState
            title="No hay pedidos para ese filtro"
            description="Prueba otro rango de fechas o cambia el estado seleccionado."
          />
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                selectedOrder?.id === order.id
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-stone-200 bg-stone-50 hover:border-amber-300 hover:bg-amber-50/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <button type="button" onClick={() => onSelectOrder(order.id)} className="flex-1 text-left">
                  <p className="text-[13px] font-semibold text-stone-900">
                    {formatDate(order.orderDate)}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                    {order.csvFilename}
                  </p>
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPreviewOrder(order.id)}
                    className="rounded-sm bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:bg-stone-100"
                  >
                    Ver
                  </button>
                  <span
                    className={`rounded-sm px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      order.status === 'closed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {order.status === 'closed' ? 'Cerrado' : 'Abierto'}
                  </span>
                  {order.status === 'open' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onRegenerateCsv(order.id)}
                        className="rounded-sm bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800 transition hover:bg-amber-200"
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditOrder(order.id)}
                        className="rounded-sm bg-stone-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-stone-700"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartClosingOrder(order.id)}
                        className="rounded-sm bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-emerald-500"
                      >
                        Cerrar
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-stone-600">
                <span>{order.productLines} líneas</span>
                <span>{formatCurrency(order.totalSalesAmount)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  )
}

export default OrdersPage
