import Toastify from 'toastify-js'
import 'toastify-js/src/toastify.css'

function showToast({ text, backgroundColor }) {
  Toastify({
    text,
    duration: 3200,
    gravity: 'top',
    position: 'right',
    stopOnFocus: true,
    close: true,
    style: {
      background: backgroundColor,
      borderRadius: '6px',
      fontSize: '12px',
      boxShadow: '0 14px 40px rgba(28,25,23,0.18)',
    },
  }).showToast()
}

export function showSuccessToast(message) {
  showToast({
    text: message,
    backgroundColor: 'linear-gradient(135deg, #059669, #047857)',
  })
}

export function showErrorToast(message) {
  showToast({
    text: message,
    backgroundColor: 'linear-gradient(135deg, #dc2626, #b91c1c)',
  })
}

export function showInfoToast(message) {
  showToast({
    text: message,
    backgroundColor: 'linear-gradient(135deg, #1f2937, #111827)',
  })
}
