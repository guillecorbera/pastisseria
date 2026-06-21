import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchSharedTimeTrackingState,
  submitSharedTimeTrackingCheck,
} from '../lib/api'
import {
  TIME_TRACKING_DEVICE_ID,
  TIME_TRACKING_RESET_DELAY_MS,
} from '../lib/timeTrackingDevice'

function formatTime(dateValue) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(dateValue)
}

function parseQrPayload(payload) {
  const parsed = JSON.parse(payload)
  const employeeId = Number(parsed?.userId)
  const qrToken = `${parsed?.token ?? ''}`.trim()

  if (!Number.isInteger(employeeId) || employeeId <= 0 || !qrToken) {
    throw new Error('El QR no contiene un identificador valido.')
  }

  return {
    employeeId,
    qrToken,
  }
}

function playFeedbackTone(type) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext

    if (!AudioContextClass) {
      return
    }

    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = type === 'success' ? 880 : 220
    gainNode.gain.value = 0.04

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + (type === 'success' ? 0.12 : 0.22))
  } catch {
    // No bloqueamos el fichaje si el sonido falla.
  }
}

function triggerDeviceFeedback(type) {
  if (navigator.vibrate) {
    navigator.vibrate(type === 'success' ? [60, 40, 60] : [220])
  }

  playFeedbackTone(type)
}

function NumericKeypad({ disabled, onDigit, onDelete, onClear }) {
  const keypadButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '<']

  return (
    <div className="grid grid-cols-3 gap-3">
      {keypadButtons.map((buttonValue) => (
        <button
          key={buttonValue}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (buttonValue === 'C') {
              onClear()
              return
            }

            if (buttonValue === '<') {
              onDelete()
              return
            }

            onDigit(buttonValue)
          }}
          className="rounded-[1.75rem] border border-stone-200 bg-white px-4 py-5 text-2xl font-semibold text-stone-900 shadow-[0_12px_35px_rgba(28,25,23,0.08)] transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
        >
          {buttonValue}
        </button>
      ))}
    </div>
  )
}

function EmployeeMobileAccessPage() {
  const videoRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const resetTimeoutRef = useRef(null)
  const scannerSupported =
    typeof window !== 'undefined' &&
    'BarcodeDetector' in window &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState('pin')
  const [manualQrPayload, setManualQrPayload] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [scannerMessage, setScannerMessage] = useState(() =>
    scannerSupported ? '' : 'Este navegador no permite escanear QR automaticamente.',
  )
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date()))
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  )

  const nextActionLabel = selectedEmployee?.openShift ? 'Registrar salida' : 'Registrar entrada'

  async function loadSharedState() {
    setIsLoading(true)

    try {
      const sharedState = await fetchSharedTimeTrackingState(TIME_TRACKING_DEVICE_ID)
      setEmployees(sharedState.employees ?? [])
    } catch (error) {
      setFeedback({
        tone: 'error',
        title: 'Terminal no disponible',
        detail: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  function clearResetTimer() {
    if (resetTimeoutRef.current) {
      window.clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = null
    }
  }

  function resetTerminal() {
    setPin('')
    setManualQrPayload('')
    setSelectedEmployeeId(null)
    setFeedback(null)
  }

  function scheduleReset() {
    clearResetTimer()
    resetTimeoutRef.current = window.setTimeout(async () => {
      resetTerminal()
      await loadSharedState()
    }, TIME_TRACKING_RESET_DELAY_MS)
  }

  function stopScanner() {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  async function handleQrSubmit(payload = manualQrPayload) {
    setIsSubmitting(true)

    try {
      const { employeeId, qrToken } = parseQrPayload(payload)
      const result = await submitSharedTimeTrackingCheck({
        employeeId,
        qrToken,
        deviceId: TIME_TRACKING_DEVICE_ID,
      })
      const employee = employees.find((item) => item.id === employeeId)

      showResultFeedback({
        type: 'success',
        title: 'Fichaje correcto',
        detail: `${
          result.actionType === 'checkin' ? 'Entrada' : 'Salida'
        } registrada para ${employee?.name ?? 'el empleado'}.`,
      })
    } catch (error) {
      showResultFeedback({
        type: 'error',
        title: 'QR no valido',
        detail: error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function startScanner() {
    stopScanner()

    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
        },
        audio: false,
      })

      mediaStreamRef.current = mediaStream

      if (!videoRef.current) {
        return
      }

      videoRef.current.srcObject = mediaStream
      await videoRef.current.play()
      setScannerMessage('Apunta la camara al QR del empleado.')

      scanIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || isSubmitting) {
          return
        }

        try {
          const results = await detector.detect(videoRef.current)

          if (results.length === 0) {
            return
          }

          const rawValue = results[0]?.rawValue ?? ''

          if (!rawValue) {
            return
          }

          setManualQrPayload(rawValue)
          await handleQrSubmit(rawValue)
        } catch {
          // Seguimos escuchando hasta detectar un QR valido.
        }
      }, 700)
    } catch (error) {
      setScannerMessage(
        error?.message
          ? 'No se pudo abrir la camara. Puedes pegar el contenido del QR manualmente.'
          : 'Escaner no disponible. Usa el modo manual.',
      )
      stopScanner()
    }
  }

  function showResultFeedback({ type, title, detail }) {
    setFeedback({
      tone: type,
      title,
      detail,
    })
    triggerDeviceFeedback(type)
    scheduleReset()
  }

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      loadSharedState()
    }, 0)

    return () => {
      window.clearTimeout(bootstrapTimer)
      stopScanner()
      clearResetTimer()
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(formatTime(new Date()))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (mode !== 'qr') {
      stopScanner()
      return
    }

    if (!scannerSupported) {
      return
    }

    const scannerTimer = window.setTimeout(() => {
      startScanner()
    }, 0)

    return () => {
      window.clearTimeout(scannerTimer)
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scannerSupported, isSubmitting])

  async function handlePinSubmit() {
    if (!selectedEmployee) {
      showResultFeedback({
        type: 'error',
        title: 'Selecciona un empleado',
        detail: 'Elige primero a la persona que va a fichar.',
      })
      return
    }

    if (pin.trim().length < 4) {
      showResultFeedback({
        type: 'error',
        title: 'PIN incompleto',
        detail: 'Introduce al menos 4 digitos para validar el fichaje.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const result = await submitSharedTimeTrackingCheck({
        employeeId: selectedEmployee.id,
        pin,
        deviceId: TIME_TRACKING_DEVICE_ID,
      })

      showResultFeedback({
        type: 'success',
        title: 'Fichaje correcto',
        detail: `${
          result.actionType === 'checkin' ? 'Entrada' : 'Salida'
        } registrada para ${selectedEmployee.name}.`,
      })
    } catch (error) {
      showResultFeedback({
        type: 'error',
        title: 'No se ha podido fichar',
        detail: error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDigit(digit) {
    if (pin.length >= 8) {
      return
    }

    setPin((current) => `${current}${digit}`)
  }

  function handleDelete() {
    setPin((current) => current.slice(0, -1))
  }

  function handleClear() {
    setPin('')
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f59e0b_0%,#fff3dd_24%,#fff 100%)] px-4 py-6 text-stone-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#1c1917,#44403c)] text-white shadow-[0_35px_90px_rgba(120,53,15,0.2)]">
          <div className="flex flex-col gap-5 px-6 py-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                Terminal compartido
              </p>
              <h1 className="mt-3 font-serif text-4xl leading-none">Fichaje de empleados</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-200">
                Un unico movil de empresa para registrar entradas y salidas por PIN o QR.
              </p>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/10 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-300">
                Hora actual
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{currentTime}</p>
              <p className="mt-2 text-xs text-stone-300">Dispositivo: {TIME_TRACKING_DEVICE_ID}</p>
            </div>
          </div>
        </section>

        {feedback ? (
          <section
            className={`rounded-[1.8rem] border px-5 py-4 shadow-[0_16px_40px_rgba(28,25,23,0.08)] ${
              feedback.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-rose-200 bg-rose-50'
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                feedback.tone === 'success' ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {feedback.title}
            </p>
            <p className="mt-2 text-base font-semibold text-stone-900">{feedback.detail}</p>
            <p className="mt-2 text-sm text-stone-600">
              La pantalla se reiniciara automaticamente en unos segundos.
            </p>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2rem] border border-amber-200 bg-white/95 p-5 shadow-[0_22px_60px_rgba(120,53,15,0.12)]">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode('pin')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === 'pin' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'
                }`}
              >
                Fichar con PIN
              </button>
              <button
                type="button"
                onClick={() => setMode('qr')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === 'qr' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'
                }`}
              >
                Fichar con QR
              </button>
            </div>

            {mode === 'pin' ? (
              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    1. Selecciona empleado
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {employees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => setSelectedEmployeeId(employee.id)}
                        disabled={isLoading || isSubmitting}
                        className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                          selectedEmployeeId === employee.id
                            ? 'border-amber-400 bg-amber-50 shadow-[0_12px_35px_rgba(245,158,11,0.16)]'
                            : 'border-stone-200 bg-stone-50 hover:border-amber-200 hover:bg-amber-50/60'
                        }`}
                      >
                        <p className="text-base font-semibold text-stone-900">{employee.name}</p>
                        <p className="mt-1 text-sm text-stone-500">{employee.role}</p>
                        <span
                          className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                            employee.openShift
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {employee.openShift ? 'En turno' : 'Disponible'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    2. Introduce PIN
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-[1.4rem] bg-white px-4 py-4">
                    <div>
                      <p className="text-sm text-stone-500">Empleado seleccionado</p>
                      <p className="text-lg font-semibold text-stone-900">
                        {selectedEmployee?.name ?? 'Ninguno'}
                      </p>
                    </div>
                    <div className="min-w-36 rounded-[1rem] border border-stone-200 bg-stone-50 px-4 py-3 text-center text-2xl font-semibold tracking-[0.5em] text-stone-900">
                      {pin ? '•'.repeat(pin.length) : '----'}
                    </div>
                  </div>

                  <div className="mt-4">
                    <NumericKeypad
                      disabled={isSubmitting}
                      onDigit={handleDigit}
                      onDelete={handleDelete}
                      onClear={handleClear}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePinSubmit}
                    disabled={isSubmitting || isLoading}
                    className={`mt-5 w-full rounded-[1.75rem] px-4 py-5 text-center text-base font-semibold uppercase tracking-[0.14em] text-white transition ${
                      selectedEmployee?.openShift
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    } disabled:cursor-not-allowed disabled:bg-stone-300`}
                  >
                    {isSubmitting ? 'Guardando...' : nextActionLabel}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.6rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    Escaneo rapido
                  </p>
                  <div className="mt-3 overflow-hidden rounded-[1.5rem] bg-stone-950">
                    {scannerSupported ? (
                      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
                    ) : (
                      <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-stone-300">
                        Este navegador no soporta deteccion QR integrada.
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-stone-600">{scannerMessage}</p>
                </div>

                <div className="rounded-[1.6rem] border border-stone-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    Fallback manual
                  </p>
                  <textarea
                    value={manualQrPayload}
                    onChange={(event) => setManualQrPayload(event.target.value)}
                    rows={5}
                    placeholder='Pega aqui el contenido del QR, por ejemplo {"userId":"3","token":"..."}'
                    className="mt-3 w-full rounded-[1.25rem] border border-stone-300 bg-stone-50 px-4 py-4 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleQrSubmit()}
                    disabled={isSubmitting || !manualQrPayload.trim()}
                    className="mt-4 w-full rounded-[1.5rem] bg-stone-900 px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {isSubmitting ? 'Validando...' : 'Validar QR'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <article className="rounded-[2rem] border border-stone-200 bg-white/95 p-5 shadow-[0_18px_50px_rgba(28,25,23,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Estado del equipo
              </p>
              <div className="mt-4 space-y-3">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    className="rounded-[1.4rem] border border-stone-200 bg-stone-50 px-4 py-4"
                  >
                    <p className="font-semibold text-stone-900">{employee.name}</p>
                    <p className="mt-1 text-sm text-stone-500">{employee.role}</p>
                    <p
                      className={`mt-3 text-sm font-semibold ${
                        employee.openShift ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {employee.openShift ? 'Turno abierto' : 'Listo para entrar'}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-stone-700 shadow-[0_18px_50px_rgba(120,53,15,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                Recomendado para produccion
              </p>
              <ul className="mt-3 space-y-2">
                <li>Anade esta PWA a la pantalla de inicio del movil de empresa.</li>
                <li>Usa siempre el mismo `deviceId` en frontend y backend.</li>
                <li>Entrega a cada trabajador su PIN y su QR individual.</li>
              </ul>
            </article>
          </section>
        </div>
      </div>
    </main>
  )
}

export default EmployeeMobileAccessPage
