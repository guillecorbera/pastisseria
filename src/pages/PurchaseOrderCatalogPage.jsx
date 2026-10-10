import { useMemo, useState } from 'react'

function PurchaseOrderCatalogPage({ groups, products, isSaving, onSave }) {
  const [selectedGroupId, setSelectedGroupId] = useState('brioxeria')
  const [search, setSearch] = useState('')
  const [draftGroups, setDraftGroups] = useState(() => groups)

  const selectedGroup = draftGroups.find((group) => group.id === selectedGroupId)
  const productsByRef = useMemo(
    () => new Map(products.map((product) => [product.ref, product])),
    [products],
  )
  const normalizedSearch = search.trim().toLocaleLowerCase('es-ES')
  const availableProducts = useMemo(() => {
    const selectedRefs = new Set(selectedGroup?.refs ?? [])

    return products
      .filter((product) => {
        if (selectedRefs.has(product.ref)) return false
        if (!normalizedSearch) return true

        return [product.ref, product.name, product.category]
          .filter(Boolean)
          .some((value) =>
            `${value}`.toLocaleLowerCase('es-ES').includes(normalizedSearch),
          )
      })
      .slice(0, 40)
  }, [normalizedSearch, products, selectedGroup?.refs])

  function updateSelectedRefs(updater) {
    setDraftGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id === selectedGroupId
          ? { ...group, refs: updater(group.refs) }
          : group,
      ),
    )
  }

  function addProduct(ref) {
    updateSelectedRefs((refs) => [...refs, ref])
  }

  function removeProduct(ref) {
    updateSelectedRefs((refs) => refs.filter((currentRef) => currentRef !== ref))
  }

  function moveProduct(index, direction) {
    updateSelectedRefs((refs) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= refs.length) return refs

      const nextRefs = [...refs]
      ;[nextRefs[index], nextRefs[nextIndex]] = [nextRefs[nextIndex], nextRefs[index]]
      return nextRefs
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSave(draftGroups)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Configuración del pedido
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-900">
            Productos de Brioxeria y Panadería
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Los cambios se aplicarán al Pedido diario y a la pantalla móvil.
          </p>
        </div>

        <label className="mt-5 block max-w-sm">
          <span className="mb-2 block text-xs font-medium text-stone-600">
            Grupo de productos
          </span>
          <select
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
          >
            {draftGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label} · {group.refs.length} productos
              </option>
            ))}
          </select>
        </label>
      </article>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
          <h3 className="font-semibold text-stone-900">
            Productos incluidos en {selectedGroup?.label}
          </h3>
          <div className="mt-4 max-h-[34rem] space-y-2 overflow-auto pr-1">
            {selectedGroup?.refs.map((ref, index) => {
              const product = productsByRef.get(ref)

              return (
                <div
                  key={ref}
                  className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {product?.name ?? 'No encontrado en el catálogo'}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {ref}{product?.category ? ` · ${product.category}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveProduct(index, -1)}
                      disabled={index === 0}
                      aria-label={`Subir ${product?.name ?? ref}`}
                      className="rounded-sm bg-white px-2 py-1 text-sm text-stone-700 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveProduct(index, 1)}
                      disabled={index === selectedGroup.refs.length - 1}
                      aria-label={`Bajar ${product?.name ?? ref}`}
                      className="rounded-sm bg-white px-2 py-1 text-sm text-stone-700 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProduct(ref)}
                      className="rounded-sm bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
          <h3 className="font-semibold text-stone-900">Añadir productos</h3>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, código o categoría..."
            className="mt-4 w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
          />
          <div className="mt-4 max-h-[30rem] space-y-2 overflow-auto pr-1">
            {availableProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {product.name}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {product.ref}{product.category ? ` · ${product.category}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addProduct(product.ref)}
                  className="rounded-sm bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                >
                  Añadir
                </button>
              </div>
            ))}
            {availableProducts.length === 0 ? (
              <p className="rounded-md bg-stone-50 p-4 text-sm text-stone-500">
                No hay productos disponibles para esta búsqueda.
              </p>
            ) : null}
          </div>
        </article>
      </div>

      <div className="sticky bottom-3 flex justify-end rounded-md border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-sm bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {isSaving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </form>
  )
}

export default PurchaseOrderCatalogPage
