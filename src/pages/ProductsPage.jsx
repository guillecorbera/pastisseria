function ProductsPage({
  products,
  productSearch,
  onProductSearchChange,
  onImportProducts,
  onEditProduct,
  onToggleProductStatus,
  formatCurrency,
  sortConfig,
  onSort,
  isImportingProducts,
}) {
  function getSortIndicator(column) {
    if (sortConfig.column !== column) {
      return '↕'
    }

    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  return (
    <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Productos
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-900">
            Catálogo importado
          </h2>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <button
            type="button"
            onClick={onImportProducts}
            disabled={isImportingProducts}
            className="rounded-sm bg-amber-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {isImportingProducts ? 'Importando...' : 'Importar desde Loyverse'}
          </button>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-stone-600">
              Buscar por nombre, ref o categoría
            </span>
            <input
              value={productSearch}
              onChange={(event) => onProductSearchChange(event.target.value)}
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white sm:w-80"
              placeholder="Ej. croissant, 10205, pa"
            />
          </label>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-stone-200">
        <div className="max-h-112 overflow-auto">
          <table className="min-w-full divide-y divide-stone-200 text-left text-sm">
            <thead className="sticky top-0 bg-stone-100 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => onSort('ref')}
                    className="flex items-center gap-2"
                  >
                    REF
                    <span className="text-[11px]">{getSortIndicator('ref')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => onSort('name')}
                    className="flex items-center gap-2"
                  >
                    Producto
                    <span className="text-[11px]">{getSortIndicator('name')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => onSort('category')}
                    className="flex items-center gap-2"
                  >
                    Categoría
                    <span className="text-[11px]">{getSortIndicator('category')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => onSort('purchaseCost')}
                    className="flex items-center gap-2"
                  >
                    Compra
                    <span className="text-[11px]">{getSortIndicator('purchaseCost')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => onSort('salePrice')}
                    className="flex items-center gap-2"
                  >
                    Venta
                    <span className="text-[11px]">{getSortIndicator('salePrice')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => onSort('availableForSale')}
                    className="flex items-center gap-2"
                  >
                    Estado
                    <span className="text-[11px]">{getSortIndicator('availableForSale')}</span>
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-amber-50/70">
                  <td className="px-4 py-3 font-medium text-stone-700">{product.ref}</td>
                  <td className="px-4 py-3">{product.name}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {product.category || 'Sin categoría'}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(product.purchaseCost)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">
                    {formatCurrency(product.salePrice)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onToggleProductStatus(product)}
                      className={`flex items-center gap-3 rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                        product.availableForSale
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-stone-300 bg-stone-100 text-stone-600'
                      }`}
                    >
                      <span
                        className={`relative h-4 w-8 rounded-full transition ${
                          product.availableForSale ? 'bg-emerald-500' : 'bg-stone-400'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${
                            product.availableForSale ? 'left-4' : 'left-0.5'
                          }`}
                        ></span>
                      </span>
                      {product.availableForSale ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onEditProduct(product)}
                      className="rounded-sm bg-stone-900 px-4 py-2 text-xs text-white transition hover:bg-stone-700"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  )
}

export default ProductsPage
