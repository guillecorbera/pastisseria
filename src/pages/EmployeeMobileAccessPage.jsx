import { useEffect, useRef, useState } from 'react'
import {
  fetchSharedTimeTrackingState,
  lookupSharedTimeTrackingEmployee,
  submitSharedTimeTrackingCheck,
  validateEmployeeAttendanceQr,
} from '../lib/api'
import {
  getStoredTerminalKey,
  storeTerminalKey,
  TIME_TRACKING_DEVICE_ID,
  TIME_TRACKING_RESET_DELAY_MS,
} from '../lib/timeTrackingDevice'

const MADRID_TIME_ZONE = 'Europe/Madrid'

function formatCurrentTime(dateValue) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: MADRID_TIME_ZONE,
  }).format(dateValue)
}

function formatRegisteredMoment(dateValue) {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) return { date: '', time: '' }

  return {
    date: new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'long', timeZone: MADRID_TIME_ZONE,
    }).format(date),
    time: new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: MADRID_TIME_ZONE,
    }).format(date),
  }
}

function playFeedbackTone(type) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

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
    // El fichaje no depende del sonido del dispositivo.
  }
}

function triggerDeviceFeedback(type) {
  if (navigator.vibrate) navigator.vibrate(type === 'success' ? [60, 40, 60] : [220])
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
            if (buttonValue === 'C') onClear()
            else if (buttonValue === '<') onDelete()
            else onDigit(buttonValue)
          }}
          className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-5 text-2xl font-semibold text-stone-900 shadow-[0_10px_28px_rgba(28,25,23,0.07)] transition active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
          aria-label={buttonValue === 'C' ? 'Borrar todo' : buttonValue === '<' ? 'Borrar último dígito' : `Dígito ${buttonValue}`}
        >
          {buttonValue === '<' ? '⌫' : buttonValue}
        </button>
      ))}
    </div>
  )
}

function EmployeeMobileAccessPage() {
  const resetTimeoutRef = useRef(null)
  const videoRef = useRef(null)
  const scannerControlsRef = useRef(null)
  const scanLockedRef = useRef(false)
  const [terminalKey, setTerminalKey] = useState(getStoredTerminalKey)
  const [activationKey, setActivationKey] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [employee, setEmployee] = useState(null)
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState('pin')
  const [scannerStatus, setScannerStatus] = useState('idle')
  const [scannerRestartKey, setScannerRestartKey] = useState(0)
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentTime, setCurrentTime] = useState(() => formatCurrentTime(new Date()))
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function clearResetTimer() {
    if (resetTimeoutRef.current) {
      window.clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = null
    }
  }

  function resetEmployeeFlow() {
    clearResetTimer()
    setEmployeeCode('')
    setEmployee(null)
    setPin('')
    setResult(null)
    setErrorMessage('')
    scanLockedRef.current = false
  }

  function stopScanner() {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
  }

  function handleInvalidTerminal(error) {
    if (
      error.statusCode !== 403 ||
      error.message !== 'Dispositivo no autorizado para fichaje.'
    ) return false

    storeTerminalKey('')
    setTerminalKey('')
    setEmployee(null)
    setResult(null)
    stopScanner()
    return true
  }

  async function validateTerminal(key = terminalKey) {
    if (!key) {
      setIsLoading(false)
      return false
    }

    setIsLoading(true)
    try {
      await fetchSharedTimeTrackingState(TIME_TRACKING_DEVICE_ID, key)
      return true
    } catch (error) {
      handleInvalidTerminal(error)
      setErrorMessage(error.message)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => validateTerminal(), 0)
    return () => {
      window.clearTimeout(bootstrapTimer)
      clearResetTimer()
    }
    // La validación inicial usa la credencial guardada al activar este terminal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(formatCurrentTime(new Date())), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function handleTerminalActivation(event) {
    event.preventDefault()
    const normalizedKey = activationKey.trim()
    if (normalizedKey.length < 32) {
      setErrorMessage('Introduce la clave privada completa configurada en Vercel.')
      return
    }

    setErrorMessage('')
    const activated = await validateTerminal(normalizedKey)
    if (activated) {
      storeTerminalKey(normalizedKey)
      setTerminalKey(normalizedKey)
      setActivationKey('')
    }
  }

  async function handleEmployeeLookup(event) {
    event.preventDefault()
    const normalizedCode = employeeCode.trim()
    if (!normalizedCode) {
      setErrorMessage('Introduce tu código de empleado.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const foundEmployee = await lookupSharedTimeTrackingEmployee(
        TIME_TRACKING_DEVICE_ID, normalizedCode, terminalKey,
      )
      setEmployeeCode(normalizedCode)
      setEmployee(foundEmployee)
      setPin('')
    } catch (error) {
      handleInvalidTerminal(error)
      setErrorMessage(error.message)
      triggerDeviceFeedback('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePinSubmit() {
    if (!employee || pin.trim().length < 4) {
      setErrorMessage('Introduce al menos 4 dígitos de tu PIN.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const response = await submitSharedTimeTrackingCheck({
        loginCode: employeeCode,
        pin,
        deviceId: TIME_TRACKING_DEVICE_ID,
      }, terminalKey)

      setResult({
        actionType: response.actionType,
        employeeName: response.employee?.name ?? employee.name,
        registeredAt: response.registeredAt,
      })
      setPin('')
      triggerDeviceFeedback('success')
      resetTimeoutRef.current = window.setTimeout(resetEmployeeFlow, TIME_TRACKING_RESET_DELAY_MS)
    } catch (error) {
      handleInvalidTerminal(error)
      setPin('')
      setErrorMessage(error.message)
      triggerDeviceFeedback('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleQrToken(qrToken) {
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await validateEmployeeAttendanceQr(
        qrToken,
        TIME_TRACKING_DEVICE_ID,
        terminalKey,
      )
      setResult({
        actionType: response.actionType,
        employeeName: response.employee.name,
        registeredAt: response.registeredAt,
      })
      triggerDeviceFeedback('success')
      resetTimeoutRef.current = window.setTimeout(resetEmployeeFlow, TIME_TRACKING_RESET_DELAY_MS)
    } catch (error) {
      handleInvalidTerminal(error)
      setScannerStatus('error')
      setErrorMessage(error.message)
      triggerDeviceFeedback('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  function changeMode(nextMode) {
    stopScanner()
    resetEmployeeFlow()
    setMode(nextMode)
    setScannerStatus('idle')
  }

  function restartScanner() {
    stopScanner()
    scanLockedRef.current = false
    setErrorMessage('')
    setScannerStatus('idle')
    setScannerRestartKey((current) => current + 1)
  }

  useEffect(() => {
    if (mode !== 'qr' || result || !terminalKey) {
      stopScanner()
      return undefined
    }

    let active = true
    scanLockedRef.current = false

    const startTimer = window.setTimeout(async () => {
      setScannerStatus('starting')
      setErrorMessage('')

      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current,
          (scanResult, _scanError, scannerControls) => {
            if (!active || !scanResult || scanLockedRef.current) return
            scanLockedRef.current = true
            scannerControls.stop()
            void handleQrToken(scanResult.getText())
          },
        )

        if (!active) {
          controls.stop()
          return
        }

        scannerControlsRef.current = controls
        setScannerStatus('scanning')
      } catch {
        if (active) {
          setScannerStatus('error')
          setErrorMessage('No se pudo abrir la cámara. Revisa sus permisos y vuelve a intentarlo.')
        }
      }
    }, 0)

    return () => {
      active = false
      window.clearTimeout(startTimer)
      stopScanner()
    }
    // La clave de reinicio permite reabrir la cámara tras un error de lectura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, result, scannerRestartKey, terminalKey])

  function handleDigit(digit) {
    setPin((currentPin) => currentPin.length >= 8 ? currentPin : `${currentPin}${digit}`)
    setErrorMessage('')
  }

  if (!terminalKey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#f59e0b_0%,#fff3dd_24%,#fff_100%)] px-4 py-8 text-stone-900">
        <section className="w-full max-w-lg rounded-[2rem] border border-amber-200 bg-white p-6 shadow-[0_28px_80px_rgba(120,53,15,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Activación segura</p>
          <h1 className="mt-3 font-serif text-3xl">Terminal de fichaje</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Introduce una sola vez la clave privada configurada como{' '}
            <code>TIME_TRACKING_TERMINAL_KEY</code> en Vercel.
          </p>
          {errorMessage ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
          <form className="mt-5 space-y-4" onSubmit={handleTerminalActivation}>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Clave privada</span>
              <input type="password" value={activationKey} onChange={(event) => setActivationKey(event.target.value)} autoComplete="off" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-4 outline-none transition focus:border-amber-400 focus:bg-white" required />
            </label>
            <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-stone-900 px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-stone-700 disabled:bg-stone-300">
              {isLoading ? 'Verificando…' : 'Activar este móvil'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  const registeredMoment = formatRegisteredMoment(result?.registeredAt)

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f59e0b_0%,#fff3dd_24%,#fff_100%)] px-4 py-5 text-stone-900">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="rounded-[2rem] bg-[linear-gradient(160deg,#1c1917,#44403c)] px-6 py-6 text-white shadow-[0_28px_70px_rgba(120,53,15,0.2)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Terminal de empresa</p>
              <h1 className="mt-2 font-serif text-3xl">Fichaje</h1>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.16em] text-stone-300">Hora actual</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{currentTime}</p>
            </div>
          </div>
        </header>

        {!result ? (
          <nav className="grid grid-cols-2 gap-2 rounded-[1.4rem] border border-stone-200 bg-white p-2 shadow-[0_12px_35px_rgba(28,25,23,0.07)]" aria-label="Método de fichaje">
            <button type="button" onClick={() => changeMode('pin')} className={`rounded-xl px-3 py-3 text-sm font-semibold ${mode === 'pin' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}>Código + PIN</button>
            <button type="button" onClick={() => changeMode('qr')} className={`rounded-xl px-3 py-3 text-sm font-semibold ${mode === 'qr' ? 'bg-sky-600 text-white' : 'text-stone-600'}`}>Escanear QR</button>
          </nav>
        ) : null}

        {result ? (
          <section className="rounded-[2rem] border border-emerald-200 bg-white p-6 text-center shadow-[0_24px_70px_rgba(5,150,105,0.15)]" aria-live="assertive">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</div>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Fichaje registrado</p>
            <h2 className="mt-2 font-serif text-3xl text-stone-900">{result.employeeName}</h2>
            <p className="mt-5 text-lg font-semibold text-stone-700">{result.actionType === 'checkin' ? 'Entrada registrada' : 'Salida registrada'}</p>
            <p className="mt-2 text-5xl font-bold tabular-nums text-stone-950">{registeredMoment.time}</p>
            <p className="mt-3 text-sm capitalize text-stone-500">{registeredMoment.date}</p>
            <p className="mt-6 text-xs text-stone-400">La pantalla se limpiará automáticamente.</p>
          </section>
        ) : mode === 'qr' ? (
          <section className="rounded-[2rem] border border-sky-200 bg-white p-5 text-center shadow-[0_22px_60px_rgba(3,105,161,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Fichaje con QR temporal</p>
            <h2 className="mt-2 font-serif text-3xl">Escanea el móvil del empleado</h2>
            <div className="relative mt-5 overflow-hidden rounded-[1.5rem] bg-stone-950">
              <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
              {scannerStatus === 'starting' ? <div className="absolute inset-0 flex items-center justify-center bg-stone-950/80 text-sm text-white">Abriendo cámara…</div> : null}
              <div className="pointer-events-none absolute inset-[15%] rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.22)]" />
            </div>
            <p className="mt-4 text-sm text-stone-600">El QR debe generarse desde <strong>/empleado</strong> y dura 45 segundos.</p>
            {isSubmitting ? <p className="mt-4 font-semibold text-sky-700">Validando y registrando…</p> : null}
            {errorMessage ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{errorMessage}</div>
            ) : null}
            {scannerStatus === 'error' ? <button type="button" onClick={restartScanner} className="mt-4 w-full rounded-xl bg-stone-900 px-4 py-4 font-semibold text-white">Reintentar cámara</button> : null}
          </section>
        ) : !employee ? (
          <section className="rounded-[2rem] border border-amber-200 bg-white p-6 shadow-[0_22px_60px_rgba(120,53,15,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Paso 1 de 2</p>
            <h2 className="mt-2 font-serif text-3xl">Introduce tu código</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Tu nombre aparecerá antes de pedirte el PIN.</p>
            {errorMessage ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{errorMessage}</div> : null}
            <form className="mt-5 space-y-4" onSubmit={handleEmployeeLookup}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-stone-700">Código de empleado</span>
                <input type="text" value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck="false" inputMode="text" autoFocus className="w-full rounded-[1.25rem] border border-stone-300 bg-stone-50 px-4 py-5 text-center text-2xl font-semibold tracking-[0.12em] outline-none transition focus:border-amber-400 focus:bg-white" />
              </label>
              <button type="submit" disabled={isSubmitting || !employeeCode.trim()} className="w-full rounded-[1.4rem] bg-stone-900 px-4 py-5 text-base font-semibold uppercase tracking-[0.14em] text-white transition active:scale-[0.99] disabled:bg-stone-300">
                {isSubmitting ? 'Comprobando…' : 'Continuar'}
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-amber-200 bg-white p-5 shadow-[0_22px_60px_rgba(120,53,15,0.12)]">
            <div className="rounded-[1.5rem] bg-amber-50 px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Empleado identificado</p>
              <h2 className="mt-2 font-serif text-3xl text-stone-900">{employee.name}</h2>
              <p className="mt-2 font-semibold text-stone-600">{employee.nextAction === 'checkout' ? 'Vas a registrar la salida' : 'Vas a registrar la entrada'}</p>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Paso 2 de 2</p>
                <p className="mt-1 text-sm text-stone-600">Introduce tu PIN</p>
              </div>
              <div className="min-w-36 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center text-2xl font-semibold tracking-[0.45em] text-stone-900" aria-label={`${pin.length} dígitos introducidos`}>
                {pin ? '•'.repeat(pin.length) : '----'}
              </div>
            </div>
            {errorMessage ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{errorMessage}</div> : null}
            <div className="mt-4">
              <NumericKeypad disabled={isSubmitting} onDigit={handleDigit} onDelete={() => setPin((currentPin) => currentPin.slice(0, -1))} onClear={() => setPin('')} />
            </div>
            <button type="button" onClick={handlePinSubmit} disabled={isSubmitting || pin.length < 4} className={`mt-5 w-full rounded-[1.5rem] px-4 py-5 text-base font-semibold uppercase tracking-[0.14em] text-white transition active:scale-[0.99] disabled:bg-stone-300 ${employee.nextAction === 'checkout' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
              {isSubmitting ? 'Registrando…' : employee.nextAction === 'checkout' ? 'Registrar salida' : 'Registrar entrada'}
            </button>
            <button type="button" onClick={resetEmployeeFlow} disabled={isSubmitting} className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-stone-500 transition hover:bg-stone-100">
              No soy {employee.name}
            </button>
          </section>
        )}
      </div>
    </main>
  )
}

export default EmployeeMobileAccessPage
