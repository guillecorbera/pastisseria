function getApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim()

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    const isKnownFrontendPort = ['4173', '5173'].includes(port)

    if (isKnownFrontendPort) {
      return `${protocol}//${hostname}:3001`
    }
  }

  return ''
}

function buildApiUrl(path) {
  return `${getApiBaseUrl()}${path}`
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }

  const response = await fetch(buildApiUrl(path), {
    headers,
    ...options,
  })

  if (!response.ok) {
    const responseText = await response.text()
    let message = 'No se pudo completar la solicitud.'

    if (responseText) {
      try {
        const payload = JSON.parse(responseText)
        message = payload.message ?? message
      } catch {
        message = responseText
      }
    }

    throw new Error(message)
  }

  const responseText = await response.text()
  return responseText ? JSON.parse(responseText) : null
}

export function bootstrapApp() {
  return request('/api/bootstrap')
}

export function fetchSummary() {
  return request('/api/summary')
}

export function fetchProducts(search = '') {
  return request(`/api/products?search=${encodeURIComponent(search)}`)
}

export function fetchOrders(filters = {}) {
  const params = new URLSearchParams()

  if (filters.status) {
    params.set('status', filters.status)
  }

  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom)
  }

  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo)
  }

  const query = params.toString()
  return request(`/api/orders${query ? `?${query}` : ''}`)
}

export function fetchOrder(orderId) {
  return request(`/api/orders/${orderId}`)
}

export function createOrder(payload) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateOrder(orderId, payload) {
  return request(`/api/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function regenerateOrderCsv(orderId) {
  return request(`/api/orders/${orderId}/regenerate-csv`, {
    method: 'POST',
  })
}

export function closeOrder(orderId, payload) {
  return request(`/api/orders/${orderId}/close`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProduct(productId, payload) {
  return request(`/api/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function importProducts() {
  return request('/api/products/import', {
    method: 'POST',
  })
}

export function fetchTimeTrackingState() {
  return request('/api/time-tracking')
}

export function fetchSharedTimeTrackingState(deviceId) {
  const params = new URLSearchParams({
    deviceId,
  })

  return request(`/api/time-tracking/shared?${params.toString()}`)
}

export function createEmployeeRecord(payload) {
  return request('/api/time-tracking/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateEmployeeRecord(employeeId, payload) {
  return request(`/api/time-tracking/employees/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteEmployeeRecord(employeeId) {
  return request(`/api/time-tracking/employees/${employeeId}`, {
    method: 'DELETE',
  })
}

export function loginEmployeeMobile(payload) {
  return request('/api/mobile/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function logoutEmployeeMobile(token) {
  return request('/api/mobile/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function fetchEmployeeMobileState(token) {
  return request('/api/mobile/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function toggleEmployeeMobileShift(token) {
  return request('/api/mobile/shifts/toggle', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function updateCompanySettingsRecord(payload) {
  return request('/api/time-tracking/company-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function toggleEmployeeShiftRecord(payload) {
  return request('/api/time-tracking/shifts/toggle', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function submitSharedTimeTrackingCheck(payload) {
  return request('/api/time-tracking/shared/check', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getMonthlyTimeReportPdfUrl(employeeId, month) {
  const params = new URLSearchParams({
    employeeId: `${employeeId}`,
    month,
  })

  return buildApiUrl(`/api/time-tracking/reports/monthly.pdf?${params.toString()}`)
}

export function getMonthlyTimeReportXlsxUrl(employeeId, month) {
  const params = new URLSearchParams({
    employeeId: `${employeeId}`,
    month,
  })

  return buildApiUrl(`/api/time-tracking/reports/monthly.xlsx?${params.toString()}`)
}

export function fetchInvoices() {
  return request('/api/invoices')
}

export function fetchInvoicingState() {
  return request('/api/invoicing')
}

export function fetchClients() {
  return request('/api/clients')
}

export function createClientRecord(payload) {
  return request('/api/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateClientRecord(clientId, payload) {
  return request(`/api/clients/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteClientRecord(clientId) {
  return request(`/api/clients/${clientId}`, {
    method: 'DELETE',
  })
}

export function createInvoiceRecord(payload) {
  return request('/api/invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateInvoiceRecord(invoiceId, payload) {
  return request(`/api/invoices/${invoiceId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function updateInvoiceStatusRecord(invoiceId, status) {
  return request(`/api/invoices/${invoiceId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export function getInvoicePdfUrl(invoiceId) {
  return buildApiUrl(`/api/invoices/${invoiceId}/pdf`)
}

export function deleteInvoiceRecord(invoiceId) {
  return request(`/api/invoices/${invoiceId}`, {
    method: 'DELETE',
  })
}
