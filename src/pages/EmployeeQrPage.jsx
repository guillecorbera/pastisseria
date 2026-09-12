import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import {
  createEmployeeAttendanceQr,
  fetchEmployeeMobileState,
  loginEmployeeMobile,
  logoutEmployeeMobile,
} from '../lib/api'

const EMPLOYEE_SESSION_KEY = 'pastisseria_employee_mobile_session'

function getStoredSessionToken() {
  return window.localStorage.getItem(EMPLOYEE_SESSION_KEY) ?? ''
}

function storeSessionToken(token) {
  if (token) window.localStorage.setItem(EMPLOYEE_SESSION_KEY, token)
  else window.localStorage.removeItem(EMPLOYEE_SESSION_KEY)
}

function EmployeeQrPage() {
  const [sessionToken, setSessionToken] = useState(getStoredSessionToken)
  const [employee, setEmployee] = useState(null)
  const [loginCode, setLoginCode] = useState('')
  const [pin, setPin] = useState('')
  const [qrData, setQrData] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [status, setStatus] = useState('IDLE')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(sessionToken))

  function clearSession() {
    storeSessionToken('')
    setSessionToken('')
    setEmployee(null)
    setQrData(null)
    setStatus('IDLE')
  }

  useEffect(() => {
    if (!sessionToken) return undefined

    let active = true
    fetchEmployeeMobileState(sessionToken)
      .then((state) => {
        if (active) setEmployee(state.employee)
      })
      .catch((error) => {
        if (active) {
          clearSession()
          setMessage(error.message)
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => { active = false }
  }, [sessionToken])

  useEffect(() => {
    if (status !== 'ACTIVE' || remainingSeconds <= 0) return undefined

    const timer = window.setTimeout(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setStatus('EXPIRED')
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [remainingSeconds, status])

  async function handleLogin(event) {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      const response = await loginEmployeeMobile({ loginCode, pin })
      storeSessionToken(response.token)
      setSessionToken(response.token)
      setEmployee(response.employee)
      setPin('')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGenerateQr() {
    setStatus('GENERATING')
    setMessage('')

    try {
      const response = await createEmployeeAttendanceQr(sessionToken)
      setQrData(response)
      setRemainingSeconds(Number(response.expiresInSeconds ?? 45))
      setStatus('ACTIVE')
    } catch (error) {
      if (error.statusCode === 401) clearSession()
      setStatus('ERROR')
      setMessage(error.message)
    }
  }

  async function handleLogout() {
    try {
      await logoutEmployeeMobile(sessionToken)
    } finally {
      clearSession()
    }
  }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-amber-50 text-stone-600">Comprobando sesión…</main>
  }

  if (!sessionToken || !employee) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#38bdf8_0%,#e0f2fe_28%,#fff_100%)] px-4 py-8 text-stone-900">
        <section className="w-full max-w-md rounded-[2rem] border border-sky-200 bg-white p-6 shadow-[0_28px_80px_rgba(3,105,161,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Acceso del trabajador</p>
          <h1 className="mt-3 font-serif text-3xl">Tu código QR de fichaje</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">Identifícate con tu código de empleado y tu PIN.</p>
          {message ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{message}</div> : null}
          <form className="mt-5 space-y-4" onSubmit={handleLogin}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-stone-700">Código de empleado</span>
              <input value={loginCode} onChange={(event) => setLoginCode(event.target.value)} autoCapitalize="none" autoComplete="username" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-4 outline-none focus:border-sky-400 focus:bg-white" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-stone-700">PIN</span>
              <input type="password" inputMode="numeric" minLength="4" maxLength="8" value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-4 text-center text-xl tracking-[0.3em] outline-none focus:border-sky-400 focus:bg-white" required />
            </label>
            <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-sky-600 px-4 py-4 font-semibold uppercase tracking-[0.14em] text-white disabled:bg-stone-300">Entrar</button>
          </form>
        </section>
      </main>
    )
  }

  const qrIsVisible = status === 'ACTIVE' && qrData?.token

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#38bdf8_0%,#e0f2fe_28%,#fff_100%)] px-4 py-6 text-stone-900">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="rounded-[2rem] bg-stone-900 p-6 text-white shadow-[0_25px_70px_rgba(3,105,161,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Área del trabajador</p>
          <h1 className="mt-2 font-serif text-3xl">Hola, {employee.name}</h1>
          <p className="mt-2 text-sm text-stone-300">Genera un código temporal y enséñalo al móvil de fichaje.</p>
        </header>

        <section className="rounded-[2rem] border border-sky-200 bg-white p-6 text-center shadow-[0_22px_60px_rgba(3,105,161,0.12)]">
          {qrIsVisible ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Código listo para escanear</p>
              <div className="mx-auto mt-5 w-fit rounded-2xl border-8 border-white bg-white p-2 shadow-[0_15px_40px_rgba(28,25,23,0.12)]">
                <QRCode value={qrData.token} size={230} level="M" />
              </div>
              <p className="mt-5 text-sm text-stone-500">Caduca en</p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-sky-700">00:{`${remainingSeconds}`.padStart(2, '0')}</p>
              <p className="mt-4 text-sm text-stone-600">Acerca esta pantalla a la cámara del terminal.</p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-4xl">▦</div>
              <h2 className="mt-5 font-serif text-2xl">{status === 'EXPIRED' ? 'El QR ha caducado' : 'Genera tu QR temporal'}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">Cada código dura 45 segundos, invalida el anterior y solo puede utilizarse una vez.</p>
              {message ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{message}</div> : null}
              <button type="button" onClick={handleGenerateQr} disabled={status === 'GENERATING'} className="mt-6 w-full rounded-[1.4rem] bg-sky-600 px-4 py-5 font-semibold uppercase tracking-[0.14em] text-white disabled:bg-stone-300">
                {status === 'GENERATING' ? 'Generando…' : status === 'EXPIRED' ? 'Generar nuevo QR' : 'Generar QR para fichar'}
              </button>
            </>
          )}
        </section>

        <button type="button" onClick={handleLogout} className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-stone-500">Cerrar sesión</button>
      </div>
    </main>
  )
}

export default EmployeeQrPage
