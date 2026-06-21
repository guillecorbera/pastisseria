export function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function padDatePart(value) {
  return `${value}`.padStart(2, '0')
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value ?? 0))
}

export function formatDate(date) {
  if (!date) {
    return ''
  }

  const normalizedDate = `${date}`.slice(0, 10)
  const [year, month, day] = normalizedDate.split('-')

  if (!year || !month || !day) {
    const parsedDate = new Date(date)

    if (Number.isNaN(parsedDate.getTime())) {
      return `${date}`
    }

    return `${padDatePart(parsedDate.getDate())}/${padDatePart(
      parsedDate.getMonth() + 1,
    )}/${parsedDate.getFullYear()}`
  }

  return `${padDatePart(day)}/${padDatePart(month)}/${year}`
}

export function getPrintDate(date) {
  return formatDate(date)
}
