export const TIME_TRACKING_DEVICE_ID =
  import.meta.env.VITE_TIME_TRACKING_DEVICE_ID?.trim() || 'empresa_movil_01'

export const TIME_TRACKING_RESET_DELAY_MS = 4000

const TERMINAL_KEY_STORAGE_KEY = 'pastisseria_time_tracking_terminal_key'

export function getStoredTerminalKey() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(TERMINAL_KEY_STORAGE_KEY) ?? ''
}

export function storeTerminalKey(terminalKey) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedKey = `${terminalKey ?? ''}`.trim()

  if (normalizedKey) {
    window.localStorage.setItem(TERMINAL_KEY_STORAGE_KEY, normalizedKey)
  } else {
    window.localStorage.removeItem(TERMINAL_KEY_STORAGE_KEY)
  }
}
