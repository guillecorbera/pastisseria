import { useRef } from 'react'

function DailyOrderPage({
  orderDate,
  onOrderDateChange,
  orderProducts,
  getProductQuantity,
  onUpdateProductQuantity,
  onCreateOrder,
  isSavingOrder,
  draftTotal,
  formatCurrency,
  formatDate,
  editingOrder,
  hiddenInactiveItemsCount,
  onCancelEdit,
}) {
  const quantityInputRefs = useRef([])

  const selectedProductsCount = orderProducts.filter(
    (product) => Number(getProductQuantity(product.id)) > 0,
  ).length

  function handleQuantityKeyDown(event, rowIndex) {
    if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      return
    }

    event.preventDefault()
    const lastIndex = quantityInputRefs.current.length - 1

    if (event.key === 'ArrowUp') {
      const previousInput =
        quantityInputRefs.current[rowIndex - 1] ?? quantityInputRefs.current[lastIndex]

      if (previousInput) {
        previousInput.focus()
        previousInput.select()
      }

      return
    }

    if (event.key === 'ArrowDown') {
      const nextInput =
        quantityInputRefs.current[rowIndex + 1] ?? quantityInputRefs.current[0]

      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      }

      return
    }

    const isShiftPressed = event.shiftKey

    if (isShiftPressed) {
      const previousInput =
        quantityInputRefs.current[rowIndex - 1] ?? quantityInputRefs.current[lastIndex]

      if (previousInput) {
        previousInput.focus()
        previousInput.select()
      }

      return
    }

    const nextInput =
      quantityInputRefs.current[rowIndex + 1] ?? quantityInputRefs.current[0]

    if (nextInput) {
      nextInput.focus()
      nextInput.select()
    }
  }

  return (
    <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          Pedido diario
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-stone-900">
            {editingOrder ? 'Editar pedido abierto' : 'Crear y exportar pedido'}
          </h2>
          {editingOrder ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-sm bg-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-700 transition hover:bg-stone-200"
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </div>

      <form className="mt-6 space-y-6" onSubmit={onCreateOrder}>
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          {editingOrder ? (
            <div className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Fecha del pedido
              </span>
              <div className="rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                {formatDate(orderDate)}
              </div>
              <p className="mt-2 text-[11px] text-stone-500">
                La fecha queda fija porque solo manejamos un pedido por día.
              </p>
            </div>
          ) : (
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Fecha del pedido
              </span>
              <input
                type="date"
                value={orderDate}
                onChange={(event) => onOrderDateChange(event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
                required
              />
            </label>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-stone-700">
            {editingOrder ? (
              <>
                Se muestran los productos <strong>Activos</strong> del catálogo y,
                si el pedido ya tenía líneas con productos inactivos, también se
                mantienen visibles para poder editarlas.
              </>
            ) : (
              <>
                Se muestran solo los productos marcados como <strong>Activos</strong>{' '}
                en catálogo. El pedido diario se completa cargando la cantidad
                pedida de cada uno.
              </>
            )}
          </div>
        </div>

        {editingOrder && hiddenInactiveItemsCount > 0 ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Este pedido incluye {hiddenInactiveItemsCount} producto(s) que ahora
            están inactivos. Los seguimos mostrando para que puedas revisarlos o
            corregir sus cantidades.
          </div>
        ) : null}

        <div className="overflow-hidden rounded-md border border-stone-200">
          <div className="max-h-136 overflow-auto">
            <table className="min-w-full divide-y divide-stone-200 text-left text-[13px]">
              <thead className="sticky top-0 bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-3 py-2.5 font-medium">REF</th>
                  <th className="px-3 py-2.5 font-medium">Producto</th>
                  <th className="px-3 py-2.5 font-medium">Categoría</th>
                  <th className="px-3 py-2.5 font-medium">Compra</th>
                  <th className="px-3 py-2.5 font-medium">Venta</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                  <th className="px-3 py-2.5 font-medium">Cantidad pedida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {orderProducts.map((product, index) => (
                  <tr key={product.id}>
                    <td className="px-3 py-2 font-medium text-stone-700">{product.ref}</td>
                    <td className="px-3 py-2">{product.name}</td>
                    <td className="px-3 py-2 text-stone-500">
                      {product.category || 'Sin categoría'}
                    </td>
                    <td className="px-3 py-2">{formatCurrency(product.purchaseCost)}</td>
                    <td className="px-3 py-2">{formatCurrency(product.salePrice)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-sm px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          product.availableForSale
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {product.availableForSale ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={getProductQuantity(product.id)}
                        ref={(element) => {
                          quantityInputRefs.current[index] = element
                        }}
                        onChange={(event) =>
                          onUpdateProductQuantity(product, Number(event.target.value))
                        }
                        onKeyDown={(event) => handleQuantityKeyDown(event, index)}
                        className="w-24 rounded-sm border border-stone-300 px-2.5 py-1.5 outline-none focus:border-amber-400"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-md bg-stone-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-300">
              Resumen del pedido
            </p>
            <p className="mt-2 text-xl font-semibold">
              {selectedProductsCount} productos · {formatCurrency(draftTotal)}
            </p>
          </div>
          <button
            type="submit"
            disabled={selectedProductsCount === 0 || isSavingOrder}
            className="rounded-sm bg-amber-400 px-6 py-3 text-sm font-semibold text-stone-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-600 disabled:text-stone-300"
          >
            {isSavingOrder
              ? editingOrder
                ? 'Guardando cambios...'
                : 'Generando...'
              : editingOrder
                ? 'Guardar cambios del pedido'
                : 'Generar CSV y guardar pedido'}
          </button>
        </div>
      </form>
    </article>
  )
}

export default DailyOrderPage
