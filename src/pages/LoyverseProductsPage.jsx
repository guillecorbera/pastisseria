import { useEffect, useMemo, useRef, useState } from 'react'
import LoyverseProductEditor from '../components/LoyverseProductEditor'
import {
  fetchLoyverseCategoriesList,
  fetchLoyverseProducts,
  updateLoyverseProduct,
  uploadLoyverseProductImage,
} from '../lib/api'
import { showErrorToast, showSuccessToast } from '../lib/toast'

function ProductImage({ product }) {
  const [hasError, setHasError] = useState(false)

  if (!product.imageUrl || hasError) {
    return (
      <div className="flex h-full items-center justify-center bg-stone-100 px-4 text-center text-xs font-medium text-stone-400">
        Sin imagen
      </div>
    )
  }

  return (
    <img
      src={product.imageUrl}
      alt={`Imagen de ${product.itemName}`}
      onError={() => setHasError(true)}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      loading="lazy"
    />
  )
}

function LoyverseProductsPage({ formatCurrency }) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const productRequestId = useRef(0)

  async function loadProducts(categoryToLoad, { refresh = false } = {}) {
    const requestId = productRequestId.current + 1
    productRequestId.current = requestId
    setIsLoadingProducts(true)

    try {
      const catalog = await fetchLoyverseProducts(categoryToLoad, { refresh })

      if (requestId === productRequestId.current) {
        setProducts(catalog.products ?? [])
      }
    } catch (error) {
      if (requestId === productRequestId.current) {
        showErrorToast(error.message)
      }
    } finally {
      if (requestId === productRequestId.current) {
        setIsLoadingProducts(false)
      }
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialCategories() {
      try {
        const categoryList = await fetchLoyverseCategoriesList()

        if (cancelled) {
          return
        }

        setCategories(categoryList ?? [])
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error.message)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCategories(false)
        }
      }
    }

    loadInitialCategories()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es')

    return products.filter((product) => {
      const searchableText = [
        product.itemName,
        product.variantName,
        product.sku,
        product.categoryName,
      ]
        .join(' ')
        .toLocaleLowerCase('es')
      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch)

      return matchesSearch
    })
  }, [products, search])

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  )

  function handleCategoryChange(event) {
    const nextCategoryId = event.target.value
    productRequestId.current += 1
    setCategoryId(nextCategoryId)
    setSearch('')
    setProducts([])
    setEditingProduct(null)

    if (nextCategoryId) {
      loadProducts(nextCategoryId)
    } else {
      setIsLoadingProducts(false)
    }
  }

  async function handleReload() {
    if (categoryId) {
      await loadProducts(categoryId, { refresh: true })
      return
    }

    setIsLoadingCategories(true)

    try {
      setCategories(await fetchLoyverseCategoriesList())
    } catch (error) {
      showErrorToast(error.message)
    } finally {
      setIsLoadingCategories(false)
    }
  }

  async function handleSaveProduct(form) {
    if (!editingProduct) {
      return
    }

    setIsSaving(true)

    try {
      let nextImageUrl = editingProduct.imageUrl

      if (form.imageBlob) {
        const imageResult = await uploadLoyverseProductImage(
          editingProduct.itemId,
          form.imageBlob,
        )
        nextImageUrl = imageResult.imageUrl || nextImageUrl
      }

      await updateLoyverseProduct(editingProduct.itemId, {
        variantId: editingProduct.variantId,
        itemName: form.itemName,
        salePrice: form.salePrice,
      })

      setProducts((currentProducts) =>
        currentProducts.map((product) => {
          if (product.itemId !== editingProduct.itemId) {
            return product
          }

          return {
            ...product,
            itemName: form.itemName,
            imageUrl: nextImageUrl,
            salePrice:
              product.variantId === editingProduct.variantId
                ? form.salePrice
                : product.salePrice,
            defaultPrice:
              product.variantId === editingProduct.variantId
                ? form.salePrice
                : product.defaultPrice,
            hasStoreSpecificPrice:
              product.variantId === editingProduct.variantId
                ? false
                : product.hasStoreSpecificPrice,
          }
        }),
      )
      setEditingProduct(null)
      showSuccessToast(`${form.itemName} actualizado en Loyverse.`)
    } catch (error) {
      showErrorToast(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <article className="rounded-2xl border border-violet-200 bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(255,255,255,0.96))] p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
              Catálogo remoto
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-stone-900">
              Productos de Loyverse
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Selecciona primero una categoría y carga únicamente sus productos para trabajar
              de forma más rápida.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReload}
              disabled={isLoadingCategories || isLoadingProducts}
              className="rounded-sm border border-violet-300 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-stone-400"
            >
              {isLoadingCategories || isLoadingProducts
                ? 'Cargando...'
                : categoryId
                  ? 'Recargar categoría'
                  : 'Recargar categorías'}
            </button>
            <button
              type="button"
              disabled
              title="Se habilitará cuando se configure el acceso a la base de datos de la web."
              className="cursor-not-allowed rounded-sm bg-stone-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500"
            >
              Actualizar página web · Próximamente
            </button>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
        <div className={`grid gap-4 ${categoryId ? 'md:grid-cols-[320px_minmax(0,1fr)]' : ''}`}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              1. Selecciona una categoría
            </span>
            <select
              value={categoryId}
              onChange={handleCategoryChange}
              disabled={isLoadingCategories}
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:bg-white"
            >
              <option value="">
                {isLoadingCategories ? 'Cargando categorías...' : 'Elige una categoría'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          {categoryId ? (
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                2. Buscar dentro de {selectedCategory?.name ?? 'la categoría'}
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, variante o SKU..."
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:bg-white"
              />
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
          <span className="rounded-full bg-stone-100 px-3 py-1">
            {categories.length} categorías
          </span>
          {categoryId ? (
            <>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">
                {filteredProducts.length} visibles
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1">
                {products.length} variantes en {selectedCategory?.name}
              </span>
            </>
          ) : null}
        </div>
      </article>

      {isLoadingCategories ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-500">
          Cargando las categorías de Loyverse...
        </div>
      ) : !categoryId ? (
        <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-10 text-center">
          <h3 className="text-lg font-semibold text-stone-900">Selecciona una categoría</h3>
          <p className="mt-2 text-sm text-stone-600">
            Los productos se cargarán después de elegirla, sin descargar el catálogo completo al entrar.
          </p>
        </div>
      ) : isLoadingProducts ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-500">
          Cargando productos de {selectedCategory?.name}...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <h3 className="text-lg font-semibold text-stone-900">
            {search ? 'No hay coincidencias' : 'Esta categoría no tiene productos'}
          </h3>
          <p className="mt-2 text-sm text-stone-500">
            {search
              ? 'Prueba con otro nombre, variante o SKU.'
              : 'Selecciona otra categoría para continuar.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <article
              key={product.id}
              className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_10px_30px_rgba(28,25,23,0.07)] transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_18px_40px_rgba(76,29,149,0.12)]"
            >
              <div className="aspect-[4/3] overflow-hidden border-b border-stone-100">
                <ProductImage key={`${product.id}:${product.imageUrl}`} product={product} />
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">
                  {product.categoryName || selectedCategory?.name || 'Sin categoría'}
                </p>
                <h3 className="mt-2 text-lg font-semibold leading-6 text-stone-900">
                  {product.itemName}
                </h3>
                {product.variantName ? (
                  <p className="mt-1 text-sm text-stone-600">{product.variantName}</p>
                ) : null}
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-stone-400">SKU {product.sku || '—'}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                      Precio POS
                    </p>
                    <p className="mt-1 text-xl font-bold text-emerald-700">
                      {formatCurrency(product.salePrice)}
                    </p>
                    {product.hasStoreSpecificPrice ? (
                      <p className="mt-1 text-xs text-amber-700">
                        General: {formatCurrency(product.defaultPrice)}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(product)}
                    className="rounded-sm bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-500"
                  >
                    Editar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editingProduct ? (
        <LoyverseProductEditor
          key={editingProduct.id}
          product={editingProduct}
          isSaving={isSaving}
          onCancel={() => setEditingProduct(null)}
          onSaved={handleSaveProduct}
        />
      ) : null}
    </div>
  )
}

export default LoyverseProductsPage
