import { useState } from 'react'

function EmployeeEditor({ employee, onCancel, onSaved, isSaving }) {
  const [form, setForm] = useState(() => ({
    name: employee.name ?? '',
    role: employee.role ?? '',
    hourlyRate: Number(employee.hourlyRate ?? 0),
    taxId: employee.taxId ?? '',
    socialSecurityNumber: employee.socialSecurityNumber ?? '',
    loginCode: employee.loginCode ?? '',
    mobileAccessEnabled: employee.mobileAccessEnabled ?? true,
    pin: '',
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
              Editar empleado
            </p>
            <h3 className="mt-2 text-xl font-semibold text-stone-900">
              {employee.name}
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
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">Nombre</span>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">Rol</span>
              <input
                value={form.role}
                onChange={(event) => updateField('role', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Coste por hora
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.hourlyRate}
                onChange={(event) => updateField('hourlyRate', Number(event.target.value))}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">NIF</span>
              <input
                value={form.taxId}
                onChange={(event) => updateField('taxId', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Nº afiliación
              </span>
              <input
                value={form.socialSecurityNumber}
                onChange={(event) =>
                  updateField('socialSecurityNumber', event.target.value)
                }
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Código de acceso móvil
              </span>
              <input
                value={form.loginCode}
                onChange={(event) => updateField('loginCode', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                placeholder="ej. laia-font"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-stone-600">
                Nuevo PIN
              </span>
              <input
                type="password"
                value={form.pin}
                onChange={(event) => updateField('pin', event.target.value)}
                className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                placeholder="Dejar vacío para mantener"
              />
            </label>
            <label className="flex items-center gap-3 rounded-sm border border-stone-200 bg-stone-50 px-4 py-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.mobileAccessEnabled}
                onChange={(event) =>
                  updateField('mobileAccessEnabled', event.target.checked)
                }
              />
              <span className="text-sm text-stone-700">
                Permitir acceso móvil individual a este trabajador
              </span>
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
              className="rounded-sm bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EmployeeEditor
