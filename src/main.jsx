import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import EmployeeMobileAccessPage from './pages/EmployeeMobileAccessPage.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
      return
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => {})
      })
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {window.location.pathname.startsWith('/fichar') ? (
      <EmployeeMobileAccessPage />
    ) : (
      <App />
    )}
  </StrictMode>,
)
