function MonthlyOrdersPage({ month, onMonthChange, report, isLoading }) {
  return (
    <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Reporte mensual
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-900">
            Entradas, salidas y saldos
          </h2>
        </div>
        <label className="block sm:w-56">
          <span className="mb-2 block text-xs font-medium text-stone-600">Mes</span>
          <input
            type="month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
          />
        </label>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-stone-500">Cargando reporte...</p>
      ) : (
        <div className="mt-6 space-y-8">
          {(report?.groups ?? []).map((group) => (
            <section key={group.id}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                    {group.label} · Entradas
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-stone-900">{group.totalEntries}</p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                    Salidas
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-700">{group.totalSales}</p>
                </div>
                <div className="rounded-md border border-stone-200 bg-stone-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Saldo
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-stone-900">{group.totalBalance}</p>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto rounded-md border border-stone-200">
                <table className="min-w-full divide-y divide-stone-200 text-left text-[13px]">
                  <thead className="bg-stone-100 text-stone-600">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Código</th>
                      <th className="px-3 py-2.5 font-medium">Producto</th>
                      <th className="px-3 py-2.5 text-right font-medium">Entradas</th>
                      <th className="px-3 py-2.5 text-right font-medium">Salidas</th>
                      <th className="px-3 py-2.5 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {group.items.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-3 py-6 text-center text-stone-500">
                          No hay movimientos registrados en este mes.
                        </td>
                      </tr>
                    ) : group.items.map((item) => (
                      <tr key={`${group.id}-${item.ref}`}>
                        <td className="px-3 py-2 font-medium text-stone-700">{item.ref}</td>
                        <td className="px-3 py-2 text-stone-900">{item.name}</td>
                        <td className="px-3 py-2 text-right">{Number(item.totalEntries)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{Number(item.totalSales)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{Number(item.totalBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </article>
  )
}

export default MonthlyOrdersPage
