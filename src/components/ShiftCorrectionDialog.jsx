import { useState } from 'react'

function toLocalInputValue(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function ShiftCorrectionDialog({ shift, employeeName, isSaving, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    startedAt: toLocalInputValue(shift.startedAt),
    endedAt: toLocalInputValue(shift.endedAt),
    reason: '',
  }))

  function handleSubmit(event) {
    event.preventDefault()
    onSave({
      startedAt: new Date(form.startedAt).toISOString(),
      endedAt: new Date(form.endedAt).toISOString(),
      reason: form.reason.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Corrección trazable
        </p>
        <h3 className="mt-2 text-xl font-semibold text-stone-900">{employeeName}</h3>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          El fichaje original se conservará. La corrección quedará añadida al historial con
          fecha, administrador y motivo.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-stone-600">Entrada corregida</span>
            <input
              type="datetime-local"
              value={form.startedAt}
              onChange={(event) => setForm((current) => ({ ...current, startedAt: event.target.value }))}
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-stone-600">Salida corregida</span>
            <input
              type="datetime-local"
              value={form.endedAt}
              onChange={(event) => setForm((current) => ({ ...current, endedAt: event.target.value }))}
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-stone-600">Motivo obligatorio</span>
            <textarea
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              minLength="10"
              rows="3"
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3"
              placeholder="Ej. El empleado olvidó registrar la salida."
              required
            />
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="rounded-sm bg-stone-100 px-4 py-3 text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-sm bg-amber-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
            >
              {isSaving ? 'Guardando…' : 'Registrar corrección'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ShiftCorrectionDialog
