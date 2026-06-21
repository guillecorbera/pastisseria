import { useState } from 'react'

function ProductEditor({ product, onCancel, onSaved, isSaving }) {
  const [form, setForm] = useState(() => ({
    name: product.name ?? '',
    category: product.category ?? '',
    purchaseCost: Number(product.purchaseCost ?? 0),
    salePrice: Number(product.salePrice ?? 0),
    availableForSale: Boolean(product.availableForSale),
  }))

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSaved(form)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-md border border-stone-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Editar producto
            </p>
            <h3 className="mt-2 text-xl font-semibold text-stone-900">
              {product.ref}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Nombre
              </span>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Categoría
              </span>
              <input
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Disponible para venta
              </span>
              <select
                value={form.availableForSale ? 'yes' : 'no'}
                onChange={(event) =>
                  updateField('availableForSale', event.target.value === 'yes')
                }
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
              >
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Costo de compra
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchaseCost}
                onChange={(event) =>
                  updateField('purchaseCost', Number(event.target.value))
                }
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Precio de venta
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(event) => updateField('salePrice', Number(event.target.value))}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-amber-400 focus:bg-white"
                required
              />
            </label>
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
              className="rounded-sm bg-amber-400 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProductEditor
