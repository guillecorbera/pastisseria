function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  tone = 'default',
}) {
  if (!open) {
    return null
  }

  const confirmClassName =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500'
      : 'bg-amber-500 hover:bg-amber-400 text-stone-950'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md border border-stone-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          Confirmación
        </p>
        <h3 className="mt-2 text-xl font-semibold text-stone-900">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-stone-600">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-sm px-4 py-2 text-sm font-semibold text-white transition ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
