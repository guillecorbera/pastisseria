import { useState } from 'react'

function AdminLoginScreen({ isLoading, errorMessage, onSubmit }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit({
      email,
      password,
    })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f59e0b_0%,#fff7ed_28%,#fffbeb_55%,#ffffff_100%)] px-4 py-8 text-stone-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-amber-200 bg-white/85 p-7 shadow-[0_30px_90px_rgba(120,53,15,0.14)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Acceso protegido
            </p>
            <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[0.12em] text-stone-950 sm:text-5xl">
              Gestor de Pastisseria
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-stone-600">
              La aplicación principal queda protegida con sesión de administrador y
              puede apuntar a una base PostgreSQL remota para trabajar desde cualquier
              ordenador.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.4rem] border border-stone-200 bg-amber-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Base remota
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Configura `DATABASE_URL` y comparte la misma API para todo el equipo.
                </p>
              </article>
              <article className="rounded-[1.4rem] border border-stone-200 bg-emerald-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Sesión admin
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  La API principal exige autenticación antes de mostrar datos sensibles.
                </p>
              </article>
              <article className="rounded-[1.4rem] border border-stone-200 bg-sky-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Terminal móvil
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  El flujo `/fichar` sigue separado para no romper el fichaje diario.
                </p>
              </article>
            </div>
          </section>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-[0_24px_80px_rgba(28,25,23,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Iniciar sesión
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Accede al panel de gestión
            </h2>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Correo
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Introducir usuario"
                  className="w-full rounded-[1rem] border border-stone-300 bg-stone-50 px-4 py-3.5 outline-none transition focus:border-amber-400 focus:bg-white"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Contraseña
                </span>
                <div className="relative">
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Introduce tu contraseña"
                    className="w-full rounded-[1rem] border border-stone-300 bg-stone-50 px-4 py-3.5 pr-14 outline-none transition focus:border-amber-400 focus:bg-white"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-stone-500 transition hover:text-stone-700"
                    aria-label={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={isPasswordVisible}
                  >
                    {isPasswordVisible ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 3l18 18M10.58 10.58a2 2 0 102.83 2.83M9.88 5.09A9.77 9.77 0 0112 4.8c4.64 0 8.57 3 9.96 7.2a10.87 10.87 0 01-4.12 5.35M6.23 6.23A11.03 11.03 0 002.04 12c.54 1.64 1.56 3.13 2.91 4.31M14.12 14.12A3 3 0 019.88 9.88"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.04 12C3.43 7.8 7.36 4.8 12 4.8s8.57 3 9.96 7.2c-1.39 4.2-5.32 7.2-9.96 7.2S3.43 16.2 2.04 12z"
                        />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              {errorMessage ? (
                <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-[1rem] bg-stone-900 px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}

export default AdminLoginScreen
