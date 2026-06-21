function HomePage({
  orderSummary,
  employeeSummary,
  invoiceSummary,
  formatCurrency,
  onNavigateModule,
}) {
  const modules = [
    {
      id: 'purchase-orders',
      label: 'Ordenes de Compra',
      description:
        'Entra directamente al historial y al circuito ya montado de pedidos, cierres y catalogo.',
      metrics: [
        `${orderSummary.totalOrders} pedidos`,
        `${orderSummary.totalOpenOrders} abiertos`,
      ],
      accent:
        'border-amber-300 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(255,255,255,0.95))] hover:border-amber-400',
    },
    {
      id: 'invoicing',
      label: 'Facturacion',
      description:
        'Crea facturas con IVA, controla estados de cobro y revisa el historico desde la misma pantalla.',
      metrics: [
        `${invoiceSummary.totalInvoices} emitidas`,
        `${formatCurrency(invoiceSummary.pendingAmount)} pendientes`,
      ],
      accent:
        'border-emerald-300 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(255,255,255,0.95))] hover:border-emerald-400',
    },
    {
      id: 'employee-time',
      label: 'Fichajes de Empleados',
      description:
        'Registra entradas y salidas, ve quien esta activo y controla horas del dia con resumen inmediato.',
      metrics: [
        `${employeeSummary.totalEmployees} empleados`,
        `${employeeSummary.activeShifts} fichados ahora`,
      ],
      accent:
        'border-sky-300 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(255,255,255,0.95))] hover:border-sky-400',
    },
    {
      id: 'maintenance',
      label: 'Mantenimiento',
      description:
        'Actualiza los datos del emisor para mantener correctos el PDF de facturas y los informes de la empresa.',
      metrics: ['Datos fiscales', 'Correo y telefono'],
      accent:
        'border-rose-300 bg-[linear-gradient(135deg,rgba(244,63,94,0.12),rgba(255,255,255,0.95))] hover:border-rose-400',
    },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {modules.map((module) => (
        <button
          key={module.id}
          type="button"
          onClick={() => onNavigateModule(module.id)}
          className={`group rounded-2xl border p-6 text-left shadow-[0_10px_30px_rgba(28,25,23,0.08),0_2px_8px_rgba(28,25,23,0.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(28,25,23,0.10),0_4px_12px_rgba(28,25,23,0.08)] ${module.accent}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold text-stone-900">{module.label}</h3>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-lg font-semibold text-stone-700 shadow-sm">
              {module.label.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-stone-600">{module.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {module.metrics.map((metric) => (
              <span
                key={metric}
                className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-stone-700"
              >
                {metric}
              </span>
            ))}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-stone-700 transition group-hover:translate-x-1">
            Abrir modulo
          </p>
        </button>
      ))}
    </div>
  )
}

export default HomePage
