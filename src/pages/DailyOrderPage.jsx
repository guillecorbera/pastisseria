import { useEffect, useRef, useState } from 'react'

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
  editingOrder,
  hiddenInactiveItemsCount,
  onCancelEdit,
  mobileEntryOnly = false,
}) {
  const quantityInputRefs = useRef([])
  const [selectedGroup, setSelectedGroup] = useState('brioxeria')
  const visibleOrderProducts = orderProducts.filter(
    (product) => product.orderGroup === selectedGroup,
  )

  useEffect(() => {
    quantityInputRefs.current = []
  }, [selectedGroup])

  const selectedProductsCount = orderProducts.filter(
    (product) => product.id && Number(getProductQuantity(product.id, product.orderGroup)) > 0,
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
      {!mobileEntryOnly ? <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          Pedido diario
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-stone-900">
            {editingOrder
              ? `Editar pedido ${editingOrder.status === 'closed' ? 'cerrado' : 'abierto'}`
              : 'Crear y exportar pedido'}
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
      </div> : null}

      <form className="mt-6 space-y-6" onSubmit={onCreateOrder}>
        <div className={mobileEntryOnly ? 'max-w-sm' : 'grid gap-4 lg:grid-cols-[240px_1fr]'}>
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
          {editingOrder && !mobileEntryOnly ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <span className="font-semibold">Pedido existente recuperado.</span>{' '}
              Puedes añadir productos o corregir sus cantidades.
            </div>
          ) : !mobileEntryOnly ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-stone-700">
              No hay pedido guardado para esta fecha. Introduce las cantidades para crearlo.
            </div>
          ) : null}
        </div>

        {!mobileEntryOnly && editingOrder && hiddenInactiveItemsCount > 0 ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Este pedido incluye {hiddenInactiveItemsCount} producto(s) que ahora
            están inactivos. Los seguimos mostrando para que puedas revisarlos o
            corregir sus cantidades.
          </div>
        ) : null}

        <label className="block max-w-sm">
          <span className="mb-2 block text-xs font-medium text-stone-600">
            Grupo de productos
          </span>
          <select
            value={selectedGroup}
            onChange={(event) => setSelectedGroup(event.target.value)}
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
          >
            <option value="brioxeria">Brioxeria</option>
            <option value="panaderia">Panadería</option>
          </select>
          {!mobileEntryOnly ? (
            <p className="mt-2 text-[11px] text-stone-500">
              Puedes cambiar de grupo sin perder las cantidades ya cargadas.
            </p>
          ) : null}
        </label>

        <div className="overflow-hidden rounded-md border border-stone-200">
          <div className="max-h-136 overflow-auto">
            <table className="min-w-full divide-y divide-stone-200 text-left text-[13px]">
              <thead className="sticky top-0 bg-stone-100 text-stone-600">
                <tr>
                  {!mobileEntryOnly ? <th className="px-3 py-2.5 font-medium">REF</th> : null}
                  {!mobileEntryOnly ? <th className="px-3 py-2.5 font-medium">Grupo</th> : null}
                  <th className="px-3 py-2.5 font-medium">Producto</th>
                  {!mobileEntryOnly ? <th className="px-3 py-2.5 font-medium">Categoría</th> : null}
                  {!mobileEntryOnly ? <th className="px-3 py-2.5 font-medium">Compra</th> : null}
                  {!mobileEntryOnly ? <th className="px-3 py-2.5 font-medium">Venta</th> : null}
                  {!mobileEntryOnly ? <th className="px-3 py-2.5 font-medium">Estado</th> : null}
                  <th className="px-3 py-2.5 font-medium">Cantidad pedida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {visibleOrderProducts.map((product, index) => (
                  <tr key={`${product.orderGroup}-${product.ref}`}>
                    {!mobileEntryOnly ? <td className="px-3 py-2 font-medium text-stone-700">{product.ref}</td> : null}
                    {!mobileEntryOnly ? <td className="px-3 py-2">
                      <span className={`rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        product.orderGroup === 'brioxeria'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}>
                        {product.orderGroupLabel}
                      </span>
                    </td> : null}
                    <td className="px-3 py-2 font-medium text-stone-900">{product.name}</td>
                    {!mobileEntryOnly ? <td className="px-3 py-2 text-stone-500">
                      {product.category || 'Sin categoría'}
                    </td> : null}
                    {!mobileEntryOnly ? <td className="px-3 py-2">{formatCurrency(product.purchaseCost)}</td> : null}
                    {!mobileEntryOnly ? <td className="px-3 py-2">{formatCurrency(product.salePrice)}</td> : null}
                    {!mobileEntryOnly ? <td className="px-3 py-2">
                      <span
                        className={`rounded-sm px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          product.availableForSale
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {product.availableForSale ? 'Activo' : 'Inactivo'}
                      </span>
                    </td> : null}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={getProductQuantity(product.id, product.orderGroup)}
                        disabled={!product.id}
                        ref={(element) => {
                          quantityInputRefs.current[index] = element
                        }}
                        onChange={(event) =>
                          onUpdateProductQuantity(product, Number(event.target.value))
                        }
                        onKeyDown={(event) => handleQuantityKeyDown(event, index)}
                        className={`${mobileEntryOnly ? 'w-20 text-center text-base' : 'w-24'} rounded-sm border border-stone-300 px-2.5 py-1.5 outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:bg-stone-100`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`flex flex-col gap-4 rounded-md bg-stone-900 p-5 text-white ${mobileEntryOnly ? '' : 'sm:flex-row sm:items-center sm:justify-between'}`}>
          {!mobileEntryOnly ? <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-300">
              Resumen del pedido
            </p>
            <p className="mt-2 text-xl font-semibold">
              {selectedProductsCount} productos · {formatCurrency(draftTotal)}
            </p>
          </div> : null}
          <button
            type="submit"
            disabled={selectedProductsCount === 0 || isSavingOrder}
            className={`${mobileEntryOnly ? 'w-full' : ''} rounded-sm bg-amber-400 px-6 py-3 text-sm font-semibold text-stone-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-600 disabled:text-stone-300`}
          >
            {isSavingOrder
              ? editingOrder
                ? 'Guardando cambios...'
                : 'Generando...'
              : editingOrder
                ? 'Guardar cambios del pedido'
                : 'Guardar pedido'}
          </button>
        </div>
      </form>
    </article>
  )
}

export default DailyOrderPage
