import { useEffect, useState } from 'react'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1200

function convertImageToPng(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      const scale = Math.min(
        1,
        MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
      )
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo preparar la imagen seleccionada.'))
          return
        }

        if (blob.size > MAX_IMAGE_SIZE) {
          reject(new Error('La imagen resultante supera el límite de 5 MB.'))
          return
        }

        resolve(blob)
      }, 'image/png')
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('El archivo seleccionado no es una imagen válida.'))
    }

    image.src = objectUrl
  })
}

function LoyverseProductEditor({ product, isSaving, onCancel, onSaved }) {
  const [itemName, setItemName] = useState(product.itemName)
  const [salePrice, setSalePrice] = useState(Number(product.salePrice ?? 0))
  const [imageBlob, setImageBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(product.imageUrl ?? '')
  const [imageError, setImageError] = useState('')
  const [isPreparingImage, setIsPreparingImage] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  async function handleImageChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setImageError('')
    setIsPreparingImage(true)

    try {
      const pngBlob = await convertImageToPng(file)
      const nextPreviewUrl = URL.createObjectURL(pngBlob)
      setImageBlob(pngBlob)
      setPreviewUrl(nextPreviewUrl)
    } catch (error) {
      setImageError(error.message)
      event.target.value = ''
    } finally {
      setIsPreparingImage(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSaved({ itemName: itemName.trim(), salePrice: Number(salePrice), imageBlob })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
              Producto en Loyverse
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-stone-900">
              {product.variantName || product.itemName}
            </h3>
            <p className="mt-1 text-sm text-stone-500">SKU: {product.sku || 'Sin SKU'}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-sm bg-stone-100 px-4 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-200 disabled:cursor-not-allowed"
          >
            Cerrar
          </button>
        </div>

        <form className="mt-6 grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]" onSubmit={handleSubmit}>
          <div>
            <div className="aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={`Imagen de ${itemName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-stone-500">
                  Sin imagen
                </div>
              )}
            </div>
            <label className="mt-3 block cursor-pointer rounded-sm border border-violet-300 bg-violet-50 px-3 py-2 text-center text-xs font-semibold text-violet-700 transition hover:bg-violet-100">
              {isPreparingImage ? 'Preparando...' : 'Seleccionar imagen'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                disabled={isPreparingImage || isSaving}
                className="sr-only"
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              PNG, JPG o WebP. Se adaptará automáticamente para Loyverse.
            </p>
            {imageError ? (
              <p className="mt-2 text-xs font-medium text-rose-700">{imageError}</p>
            ) : null}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Nombre del producto
              </span>
              <input
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:bg-white"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Precio de venta
              </span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salePrice}
                  onChange={(event) => setSalePrice(event.target.value)}
                  className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 pr-10 outline-none transition focus:border-violet-400 focus:bg-white"
                  required
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-500">
                  €
                </span>
              </div>
            </label>

            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-stone-600">
              Los cambios se guardarán directamente en Loyverse. El precio se aplicará como
              precio general y también como precio de venta de la tienda en esta variante.
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="rounded-sm bg-stone-100 px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-200 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || isPreparingImage}
                className="rounded-sm bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {isSaving ? 'Guardando en Loyverse...' : 'Guardar en Loyverse'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoyverseProductEditor
