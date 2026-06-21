import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import {
  getMonthlyTimeReportPdfUrl,
  getMonthlyTimeReportXlsxUrl,
} from '../lib/api'
import { getToday } from '../lib/formatters'

function formatTime(dateValue) {
  if (!dateValue) {
    return '--:--'
  }

  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateValue))
}

function formatTimeCell(dateValue) {
  if (!dateValue) {
    return ''
  }

  return formatTime(dateValue)
}

function formatMonthLabel(monthValue) {
  if (!monthValue) {
    return ''
  }

  const [year, month] = monthValue.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)

  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getShiftHours(shift) {
  if (!shift?.startedAt) {
    return 0
  }

  const start = new Date(shift.startedAt)
  const end = new Date(shift.endedAt ?? new Date().toISOString())
  const diff = end.getTime() - start.getTime()

  if (Number.isNaN(diff) || diff <= 0) {
    return 0
  }

  return diff / (1000 * 60 * 60)
}

function formatHours(value) {
  return `${value.toFixed(2)} h`
}

function getDaysInMonth(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

function EmployeeTimePage({
  section,
  companySettings,
  employees,
  shifts,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onToggleShift,
  formatCurrency,
}) {
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    role: '',
    hourlyRate: '',
    taxId: '',
    socialSecurityNumber: '',
    loginCode: '',
    pin: '',
  })
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [pinInputs, setPinInputs] = useState({})
  const [reportMonth, setReportMonth] = useState(getToday().slice(0, 7))
  const [reportEmployeeId, setReportEmployeeId] = useState('')

  const openShiftMap = useMemo(
    () =>
      new Map(
        shifts
          .filter((shift) => !shift.endedAt)
          .map((shift) => [shift.employeeId, shift]),
      ),
    [shifts],
  )

  const employeeSnapshots = useMemo(
    () =>
      employees.map((employee) => {
        const employeeShifts = shifts.filter((shift) => shift.employeeId === employee.id)
        const openShift = openShiftMap.get(employee.id)
        const todayHours = employeeShifts.reduce((sum, shift) => {
          if (shift.startedAt?.slice(0, 10) !== selectedDate) {
            return sum
          }

          return sum + getShiftHours(shift)
        }, 0)
        const lastShift = employeeShifts[0]

        return {
          ...employee,
          openShift,
          todayHours,
          lastShift,
          estimatedCost: todayHours * Number(employee.hourlyRate ?? 0),
          totalHours: employeeShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0),
        }
      }),
    [employees, openShiftMap, selectedDate, shifts],
  )

  const totals = useMemo(
    () =>
      employeeSnapshots.reduce(
        (accumulator, employee) => ({
          active: accumulator.active + (employee.openShift ? 1 : 0),
          hours: accumulator.hours + employee.todayHours,
          cost: accumulator.cost + employee.estimatedCost,
        }),
        { active: 0, hours: 0, cost: 0 },
      ),
    [employeeSnapshots],
  )

  const recentShifts = useMemo(() => shifts.slice(0, 10), [shifts])

  const reportRows = useMemo(() => {
    return employees
      .map((employee) => {
        const employeeShifts = shifts.filter((shift) => shift.employeeId === employee.id)
        const hours = employeeShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0)
        const openShifts = employeeShifts.filter((shift) => !shift.endedAt).length
        const totalCost = hours * Number(employee.hourlyRate ?? 0)

        return {
          id: employee.id,
          name: employee.name,
          role: employee.role,
          hours,
          openShifts,
          totalCost,
        }
      })
      .sort((left, right) => right.hours - left.hours)
  }, [employees, shifts])

  const effectiveReportEmployeeId = reportEmployeeId || employees[0]?.id || ''

  const selectedReportEmployee =
    employees.find((employee) => employee.id === effectiveReportEmployeeId) ?? null

  const monthlyReportRows = useMemo(() => {
    const totalDays = getDaysInMonth(reportMonth)
    const monthShifts = shifts
      .filter(
        (shift) =>
          shift.employeeId === effectiveReportEmployeeId &&
          shift.startedAt?.slice(0, 7) === reportMonth,
      )
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))

    const shiftsByDay = new Map()

    monthShifts.forEach((shift) => {
      const day = Number(shift.startedAt.slice(8, 10))
      const dayShifts = shiftsByDay.get(day) ?? []
      dayShifts.push(shift)
      shiftsByDay.set(day, dayShifts)
    })

    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1
      const dayShifts = (shiftsByDay.get(day) ?? []).slice(0, 2)
      const morningShift = dayShifts[0] ?? null
      const afternoonShift = dayShifts[1] ?? null
        const hasVerifiedShift = dayShifts.some(
          (shift) =>
            ['pin', 'mobile'].includes(shift.verificationMethod) &&
            shift.startedVerificationAt &&
            (shift.endedAt ? shift.endedVerificationAt : true),
        )

      return {
        day,
        morningEntry: formatTimeCell(morningShift?.startedAt),
        morningExit: formatTimeCell(morningShift?.endedAt),
        afternoonEntry: formatTimeCell(afternoonShift?.startedAt),
        afternoonExit: formatTimeCell(afternoonShift?.endedAt),
        signature: hasVerifiedShift ? 'APP' : '',
      }
    })
  }, [effectiveReportEmployeeId, reportMonth, shifts])

  async function handleEmployeeSubmit(event) {
    event.preventDefault()

    const created = await onAddEmployee(employeeForm)

    if (created) {
      setEmployeeForm({
        name: '',
        role: '',
        hourlyRate: '',
        taxId: '',
        socialSecurityNumber: '',
        loginCode: '',
        pin: '',
      })
    }
  }

  function handlePinInputChange(employeeId, value) {
    setPinInputs((current) => ({
      ...current,
      [employeeId]: value,
    }))
  }

  async function handleShiftAction(employeeId) {
    const success = await onToggleShift(employeeId, pinInputs[employeeId] ?? '')

    if (success) {
      setPinInputs((current) => ({
        ...current,
        [employeeId]: '',
      }))
    }
  }

  function handlePrintMonthlyReport() {
    if (!selectedReportEmployee) {
      return
    }

    window.open(
      getMonthlyTimeReportPdfUrl(selectedReportEmployee.id, reportMonth),
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            Empleados activos
          </p>
          <p className="mt-2 text-3xl font-semibold text-sky-900">{totals.active}</p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Horas del dia
          </p>
          <p className="mt-2 text-3xl font-semibold text-amber-900">
            {formatHours(totals.hours)}
          </p>
        </article>
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Coste estimado
          </p>
          <p className="mt-2 text-3xl font-semibold text-emerald-900">
            {formatCurrency(totals.cost)}
          </p>
        </article>
      </div>

      {section === 'employee-time-dashboard' ? (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
          <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Fichaje diario
                </p>
                <h2 className="mt-2 text-xl font-semibold text-stone-900">
                  Registro electronico con PIN
                </h2>
              </div>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Fecha visible
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-stone-700">
              Cada fichaje interno requiere PIN del empleado. Además, cada trabajador puede
              usar el terminal compartido desde la ruta <strong> /fichar</strong> con PIN o
              QR seguro validado por dispositivo.
            </div>

            <div className="mt-6 grid gap-3">
              {employeeSnapshots.map((employee) => (
                <div
                  key={employee.id}
                  className="rounded-xl border border-stone-200 bg-stone-50/80 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-stone-900">{employee.name}</p>
                      <p className="text-sm text-stone-500">
                        {employee.role} · {formatCurrency(employee.hourlyRate)}/h · acceso{' '}
                        {employee.loginCode || 'sin configurar'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          employee.openShift
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {employee.openShift ? 'En turno' : 'Fuera'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_0.9fr_0.9fr_1fr_auto]">
                    <div className="rounded-lg bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Horas del dia
                      </p>
                      <p className="mt-1 text-base font-semibold text-stone-900">
                        {formatHours(employee.todayHours)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Ultimo movimiento
                      </p>
                      <p className="mt-1 text-base font-semibold text-stone-900">
                        {employee.lastShift
                          ? `${formatTime(employee.lastShift.startedAt)}${employee.lastShift.endedAt ? ` · ${formatTime(employee.lastShift.endedAt)}` : ''}`
                          : 'Sin registros'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Coste estimado
                      </p>
                      <p className="mt-1 text-base font-semibold text-emerald-700">
                        {formatCurrency(employee.estimatedCost)}
                      </p>
                    </div>
                    <label className="block rounded-lg bg-white px-3 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        PIN empleado
                      </span>
                      <input
                        type="password"
                        value={pinInputs[employee.id] ?? ''}
                        onChange={(event) =>
                          handlePinInputChange(employee.id, event.target.value)
                        }
                        className="mt-2 w-full rounded-sm border border-stone-300 bg-stone-50 px-3 py-2.5 outline-none transition focus:border-sky-400 focus:bg-white"
                        placeholder="Introduce PIN"
                      />
                    </label>
                  <button
                    type="button"
                    onClick={() => handleShiftAction(employee.id)}
                      className={`rounded-sm px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition ${
                        employee.openShift
                          ? 'bg-rose-600 hover:bg-rose-500'
                          : 'bg-sky-600 hover:bg-sky-500'
                      }`}
                    >
                      {employee.openShift ? 'Registrar salida' : 'Registrar entrada'}
                    </button>
                  </div>
                </div>
              ))}

              {employees.length === 0 ? (
                <EmptyState
                  title="No hay empleados cargados"
                  description="Crea la primera ficha para empezar a registrar entradas y salidas."
                />
              ) : null}
            </div>
          </article>

          <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Actividad reciente
            </p>
            <h3 className="mt-2 text-xl font-semibold text-stone-900">Ultimos fichajes</h3>

            <div className="mt-5 space-y-3">
              {recentShifts.length === 0 ? (
                <EmptyState
                  title="Aun no hay movimientos"
                  description="Los ultimos fichajes del equipo apareceran aqui."
                />
              ) : (
                recentShifts.map((shift) => {
                  const employee = employees.find((item) => item.id === shift.employeeId)

                  return (
                    <div
                      key={shift.id}
                      className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3"
                    >
                      <p className="font-semibold text-stone-900">
                        {employee?.name ?? 'Empleado eliminado'}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
                        {formatTime(shift.startedAt)} ·{' '}
                        {shift.endedAt ? formatTime(shift.endedAt) : 'Turno abierto'}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                        Validado por{' '}
                        {shift.endedVerificationMethod === 'qr' || shift.verificationMethod === 'qr'
                          ? 'QR'
                          : shift.verificationMethod === 'mobile'
                            ? 'app móvil'
                            : 'PIN'}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </article>
        </div>
      ) : null}

      {section === 'employee-time-staff' ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="space-y-4">
            <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Alta de personal
              </p>
              <h3 className="mt-2 text-xl font-semibold text-stone-900">Nuevo empleado</h3>

              <form className="mt-5 space-y-4" onSubmit={handleEmployeeSubmit}>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Nombre
                  </span>
                  <input
                    value={employeeForm.name}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="Ej. Laia Font"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Rol
                  </span>
                  <input
                    value={employeeForm.role}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({ ...current, role: event.target.value }))
                    }
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="Ej. Tienda, obrador, reparto"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Coste por hora
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={employeeForm.hourlyRate}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({
                        ...current,
                        hourlyRate: event.target.value,
                      }))
                    }
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="12.50"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    NIF
                  </span>
                  <input
                    value={employeeForm.taxId}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({ ...current, taxId: event.target.value }))
                    }
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="12345678A"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Nº afiliacion
                  </span>
                  <input
                    value={employeeForm.socialSecurityNumber}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({
                        ...current,
                        socialSecurityNumber: event.target.value,
                      }))
                    }
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="08/1234567890"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    PIN de fichaje
                  </span>
                  <input
                    type="password"
                    value={employeeForm.pin}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({ ...current, pin: event.target.value }))
                    }
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="Minimo 4 digitos"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Código acceso móvil
                  </span>
                  <input
                    value={employeeForm.loginCode}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({
                        ...current,
                        loginCode: event.target.value,
                      }))
                    }
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                    placeholder="Ej. laia-font"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-sm bg-stone-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-700"
                >
                  Crear empleado
                </button>
              </form>
            </article>

          </div>

          <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Equipo
            </p>
            <h3 className="mt-2 text-xl font-semibold text-stone-900">Plantilla activa</h3>

            <div className="mt-5 space-y-3">
              {employeeSnapshots.length === 0 ? (
                <EmptyState
                  title="No hay empleados cargados"
                  description="Añade personal para gestionar fichajes y costes."
                />
              ) : (
                employeeSnapshots.map((employee) => (
                  <div
                    key={employee.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/80 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-stone-900">{employee.name}</p>
                        <p className="text-sm text-stone-500">
                          {employee.role} · {formatCurrency(employee.hourlyRate)}/h
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          employee.openShift
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {employee.openShift ? 'En turno' : 'Disponible'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-lg bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                          NIF
                        </p>
                        <p className="mt-1 text-base font-semibold text-stone-900">
                          {employee.taxId}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                          Afiliacion
                        </p>
                        <p className="mt-1 text-base font-semibold text-stone-900">
                          {employee.socialSecurityNumber}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                          Acceso móvil
                        </p>
                        <p className="mt-1 text-base font-semibold text-stone-900">
                          {employee.loginCode || 'Pendiente'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                          Horas acumuladas
                        </p>
                        <p className="mt-1 text-base font-semibold text-stone-900">
                          {formatHours(employee.totalHours)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                          Coste total
                        </p>
                        <p className="mt-1 text-base font-semibold text-emerald-700">
                          {formatCurrency(
                            employee.totalHours * Number(employee.hourlyRate ?? 0),
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Payload QR seguro
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-stone-700">
                        {employee.qrPayload}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onEditEmployee(employee)}
                        className="rounded-sm bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-sky-500"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEmployee(employee)}
                        className="rounded-sm bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-rose-500"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      ) : null}

      {section === 'employee-time-reports' ? (
        <div className="space-y-4">
          <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Registro mensual
                </p>
                <h3 className="mt-2 text-xl font-semibold text-stone-900">
                  Informe adaptado al modelo Excel
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Empleado
                  </span>
                  <select
                    value={effectiveReportEmployeeId}
                    onChange={(event) => setReportEmployeeId(event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                  >
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Mes
                  </span>
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(event) => setReportMonth(event.target.value)}
                    className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
                  />
                </label>
              </div>
            </div>

            {selectedReportEmployee ? (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                    <p>
                      <strong>Empresa:</strong> {companySettings.companyName}
                    </p>
                    <p>
                      <strong>C.I.F./N.I.F.:</strong> {companySettings.companyTaxId}
                    </p>
                    <p>
                      <strong>Centro de Trabajo:</strong> {companySettings.workplace}
                    </p>
                    <p>
                      <strong>C.C.C.:</strong> {companySettings.contributionAccountCode}
                    </p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                    <p>
                      <strong>Trabajador:</strong> {selectedReportEmployee.name}
                    </p>
                    <p>
                      <strong>N.I.F.:</strong> {selectedReportEmployee.taxId}
                    </p>
                    <p>
                      <strong>Nº Afiliacion:</strong>{' '}
                      {selectedReportEmployee.socialSecurityNumber}
                    </p>
                    <p>
                      <strong>Mes y Año:</strong> {formatMonthLabel(reportMonth)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-stone-200">
                  <div className="overflow-auto">
                    <table className="min-w-full divide-y divide-stone-200 text-center text-sm">
                      <thead className="bg-stone-100 text-stone-700">
                        <tr>
                          <th rowSpan="2" className="px-3 py-3 font-medium">
                            DIA
                          </th>
                          <th colSpan="2" className="px-3 py-3 font-medium">
                            MANANAS
                          </th>
                          <th colSpan="2" className="px-3 py-3 font-medium">
                            TARDES
                          </th>
                          <th rowSpan="2" className="px-3 py-3 font-medium">
                            FIRMA DEL TRABAJADOR / A
                          </th>
                        </tr>
                        <tr>
                          <th className="px-3 py-3 font-medium">ENTRADA</th>
                          <th className="px-3 py-3 font-medium">SALIDA</th>
                          <th className="px-3 py-3 font-medium">ENTRADA</th>
                          <th className="px-3 py-3 font-medium">SALIDA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 bg-white">
                        {monthlyReportRows.map((row) => (
                          <tr key={row.day}>
                            <td className="px-3 py-2 font-semibold text-stone-900">
                              {row.day}
                            </td>
                            <td className="px-3 py-2">{row.morningEntry}</td>
                            <td className="px-3 py-2">{row.morningExit}</td>
                            <td className="px-3 py-2">{row.afternoonEntry}</td>
                            <td className="px-3 py-2">{row.afternoonExit}</td>
                            <td className="px-3 py-2 font-semibold text-sky-700">
                              {row.signature}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-stone-700">
                  <span>
                    Registro diario con hora concreta de inicio y finalizacion, firmado por
                    PIN y listo para impresion mensual.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePrintMonthlyReport}
                      className="rounded-sm bg-stone-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-700"
                    >
                      Abrir PDF
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          getMonthlyTimeReportXlsxUrl(
                            selectedReportEmployee.id,
                            reportMonth,
                          ),
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                      className="rounded-sm bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-emerald-500"
                    >
                      Descargar Excel
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="No hay empleados para generar el informe"
                  description="Crea una ficha de empleado para producir el registro mensual."
                />
              </div>
            )}
          </article>

          <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Resumen
            </p>
            <h3 className="mt-2 text-xl font-semibold text-stone-900">Totales por empleado</h3>

            <div className="mt-5 space-y-3">
              {reportRows.length === 0 ? (
                <EmptyState
                  title="Sin datos para informar"
                  description="Los informes apareceran cuando existan empleados y fichajes."
                />
              ) : (
                reportRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/80 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-stone-900">{row.name}</p>
                        <p className="text-sm text-stone-500">{row.role}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                          {formatHours(row.hours)}
                        </span>
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                          {row.openShifts} turno(s) abiertos
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {formatCurrency(row.totalCost)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      ) : null}
    </div>
  )
}

export default EmployeeTimePage
