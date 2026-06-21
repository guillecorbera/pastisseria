import { execute, getConnection, query } from './db.js'
import { writePurchaseOrderCsv } from './csv.js'
import { syncProducts } from './bootstrap.js'
import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'

function formatOrderDate(date) {
  const normalizedDate = normalizeOrderDateValue(date)
  const [year, month, day] = normalizedDate.split('-')
  return `${day}_${month}_${year}`
}

function normalizeOrderDateValue(value) {
  if (!value) {
    return ''
  }

  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = `${value.getMonth() + 1}`.padStart(2, '0')
    const day = `${value.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return `${value}`.slice(0, 10)
}

function formatPdfDate(value) {
  const normalizedDate = normalizeOrderDateValue(value)

  if (!normalizedDate || !normalizedDate.includes('-')) {
    return normalizedDate
  }

  const [year, month, day] = normalizedDate.split('-')
  return `${day}/${month}/${year}`
}

function formatPdfNumber(value, options = {}) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(Number(value ?? 0))
}

function formatPdfCurrency(value) {
  return `${formatPdfNumber(value)} €`
}

function getInvoiceLogoPath() {
  const logoCandidates = [
    path.resolve(process.cwd(), 'public', '512x512.png'),
    path.resolve(process.cwd(), 'public', 'android-chrome-512x512.png'),
    path.resolve(process.cwd(), 'public', 'apple-touch-icon.png'),
  ]

  return logoCandidates.find((logoPath) => existsSync(logoPath)) ?? null
}

function formatInvoiceDisplayNumber(invoiceNumber, issueDate) {
  const normalizedIssueDate = normalizeOrderDateValue(issueDate)
  const year = normalizedIssueDate ? normalizedIssueDate.slice(0, 4) : ''
  const sequenceMatch = `${invoiceNumber ?? ''}`.match(/(\d+)$/)

  if (!sequenceMatch) {
    return `${invoiceNumber ?? ''}`.trim()
  }

  const sequence = `${Number(sequenceMatch[1])}`.padStart(4, '0')
  return `${year}-${sequence}`.replace(/^-/, '').trim()
}

function hashPin(pin) {
  return crypto.createHash('sha256').update(`${pin}`).digest('hex')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(`${token}`).digest('hex')
}

const SHARED_DEVICE_ID = `${process.env.TIME_TRACKING_DEVICE_ID ?? 'empresa_movil_01'}`.trim()
const QR_SECRET = `${process.env.TIME_TRACKING_QR_SECRET ?? 'pastisseria-qr-secret-change-me'}`

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex')
}

function normalizeDeviceId(deviceId) {
  return `${deviceId ?? ''}`.trim()
}

function createSharedDeviceError() {
  const error = new Error('Dispositivo no autorizado para fichaje.')
  error.statusCode = 403
  return error
}

function assertAuthorizedSharedDevice(deviceId) {
  if (normalizeDeviceId(deviceId) !== SHARED_DEVICE_ID) {
    throw createSharedDeviceError()
  }
}

function getEmployeeQrToken(employeeId) {
  return crypto
    .createHmac('sha256', QR_SECRET)
    .update(`employee:${employeeId}`)
    .digest('hex')
}

function enrichEmployeeAccess(employee) {
  if (!employee) {
    return null
  }

  return {
    ...employee,
    qrPayload: JSON.stringify({
      userId: `${employee.id}`,
      token: getEmployeeQrToken(employee.id),
    }),
  }
}

function createEmployeeLoginCode(name) {
  const base = `${name ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)

  return base || `empleado-${crypto.randomBytes(3).toString('hex')}`
}

function getTimestampSql(columnName, alias) {
  return `TO_CHAR(${columnName} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') AS "${alias}"`
}

function parseJsonSettingValue(value, fallback) {
  if (!value) {
    return fallback
  }

  if (typeof value === 'object') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function formatMonthLabel(monthValue) {
  const [year, month] = `${monthValue}`.split('-').map(Number)

  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

function getReportCreationDateLabel(dateValue = new Date()) {
  const day = dateValue.getDate()
  const monthName = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
  }).format(dateValue)
  const year = dateValue.getFullYear()

  return `En Corbera de Llobregat, a ${day} de ${monthName} de ${year}.`
}

function formatTimeCell(dateValue) {
  if (!dateValue) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateValue))
}

function getDaysInMonth(monthValue) {
  const [year, month] = `${monthValue}`.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

const defaultCompanySettings = {
  companyName: 'DOELIA CONCEPCION SANGUINA DUARTE',
  companyTaxId: '55164584F',
  workplace: 'OBRADOR ROIG',
  contributionAccountCode: '08/2366143/48',
  address: 'Av. Catalunya 24',
  postalCode: '08757',
  city: 'Corbera de Llobregat',
  phone: '930 327 905 - 691 966 747',
  email: 'obradorcafeteria@gmail.com',
  bankName: '',
  bankIban: '',
}

function mergeCompanySettings(settings = {}) {
  return {
    ...defaultCompanySettings,
    ...settings,
  }
}

function appendPdfLine(lines, label, value) {
  const normalizedValue = `${value ?? ''}`.trim()

  if (!normalizedValue) {
    return
  }

  lines.push(`${label}: ${normalizedValue}`)
}

async function getNextInvoiceSequence(issueDate) {
  const invoiceYear = new Date(issueDate).getFullYear()
  const invoicePrefix = `FAC-${invoiceYear}-`
  const rows = await query(
    `SELECT invoice_number AS "invoiceNumber"
     FROM invoices
     WHERE invoice_number LIKE :invoicePrefix
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    { invoicePrefix: `${invoicePrefix}%` },
  )

  const lastInvoiceNumber = rows[0]?.invoiceNumber ?? ''
  const sequenceMatch = lastInvoiceNumber.match(/(\d+)$/)
  const lastSequence = sequenceMatch ? Number(sequenceMatch[1]) : 0

  return {
    invoiceYear,
    nextSequence: lastSequence + 1,
  }
}

function calculateInvoiceTotals(items, vatRate) {
  const total = items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0)
  const normalizedVatRate = Number(vatRate ?? 0)

  if (!Number.isFinite(normalizedVatRate) || normalizedVatRate <= 0) {
    return {
      subtotal: total,
      vatAmount: 0,
      total,
    }
  }

  const subtotal = total / (1 + normalizedVatRate / 100)
  const vatAmount = total - subtotal

  return {
    subtotal,
    vatAmount,
    total,
  }
}

async function getEmployeeById(employeeId, { includePinHash = false } = {}) {
  const rows = await query(
    `SELECT
      id,
      name,
      role,
      hourly_rate AS "hourlyRate",
      tax_id AS "taxId",
      social_security_number AS "socialSecurityNumber",
      login_code AS "loginCode",
      mobile_access_enabled AS "mobileAccessEnabled"
      ${includePinHash ? ', pin_hash AS "pinHash"' : ''}
    FROM employees
    WHERE id = :employeeId
    LIMIT 1`,
    { employeeId },
  )

  return enrichEmployeeAccess(rows[0] ?? null)
}

async function getEmployeeByLoginCode(loginCode, { includePinHash = false } = {}) {
  const rows = await query(
    `SELECT
      id,
      name,
      role,
      hourly_rate AS "hourlyRate",
      tax_id AS "taxId",
      social_security_number AS "socialSecurityNumber",
      login_code AS "loginCode",
      mobile_access_enabled AS "mobileAccessEnabled"
      ${includePinHash ? ', pin_hash AS "pinHash"' : ''}
    FROM employees
    WHERE login_code = :loginCode
    LIMIT 1`,
    { loginCode },
  )

  return enrichEmployeeAccess(rows[0] ?? null)
}

async function getInvoiceById(invoiceId) {
  const invoices = await query(
    `SELECT
      id,
      invoice_number AS "invoiceNumber",
      issue_date AS "issueDate",
      due_date AS "dueDate",
      client_id AS "clientId",
      client_name AS "clientName",
      tax_id AS "taxId",
      client_address AS "clientAddress",
      client_postal_code AS "clientPostalCode",
      client_city AS "clientCity",
      client_email AS "clientEmail",
      client_phone AS "clientPhone",
      payment_by_transfer AS "paymentByTransfer",
      status,
      notes,
      vat_rate AS "vatRate",
      subtotal,
      vat_amount AS "vatAmount",
      total
    FROM invoices
    WHERE id = :invoiceId
    LIMIT 1`,
    { invoiceId },
  )

  if (invoices.length === 0) {
    return null
  }

  const items = await query(
    `SELECT
      id,
      description,
      quantity,
      unit_price AS "unitPrice",
      line_total AS "lineTotal"
    FROM invoice_items
    WHERE invoice_id = :invoiceId
    ORDER BY id ASC`,
    { invoiceId },
  )

  const invoice = invoices[0]
  const shouldHydrateClient =
    !invoice.clientAddress ||
    !invoice.clientPostalCode ||
    !invoice.clientCity ||
    !invoice.clientEmail ||
    !invoice.clientPhone

  let client = null

  if (shouldHydrateClient && invoice.clientId) {
    client = await getClientById(invoice.clientId)
  }

  if (shouldHydrateClient && !client) {
    client = await getClientByName(invoice.clientName)
  }

  return {
    ...invoice,
    issueDate: normalizeOrderDateValue(invoices[0].issueDate),
    dueDate: normalizeOrderDateValue(invoices[0].dueDate),
    clientAddress: invoice.clientAddress || client?.address || '',
    clientPostalCode: invoice.clientPostalCode || client?.postalCode || '',
    clientCity: invoice.clientCity || client?.city || '',
    clientEmail: invoice.clientEmail || client?.email || '',
    clientPhone: invoice.clientPhone || client?.phone || '',
    items,
  }
}

async function getClientById(clientId) {
  const rows = await query(
    `SELECT
      id,
      name,
      tax_id AS "taxId",
      address,
      postal_code AS "postalCode",
      city,
      email,
      phone
    FROM clients
    WHERE id = :clientId
    LIMIT 1`,
    { clientId },
  )

  return rows[0] ?? null
}

async function getClientByName(clientName) {
  const normalizedName = `${clientName ?? ''}`.trim()

  if (!normalizedName) {
    return null
  }

  const rows = await query(
    `SELECT
      id,
      name,
      tax_id AS "taxId",
      address,
      postal_code AS "postalCode",
      city,
      email,
      phone
    FROM clients
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(:clientName))
    ORDER BY id ASC
    LIMIT 1`,
    { clientName: normalizedName },
  )

  return rows[0] ?? null
}

export async function getPurchaseOrderHeaders() {
  const rows = await query(
    "SELECT setting_value FROM app_settings WHERE setting_key = 'purchase_order_headers'",
  )

  if (rows.length === 0) {
    return []
  }

  return Array.isArray(rows[0].setting_value)
    ? rows[0].setting_value
    : JSON.parse(rows[0].setting_value)
}

export async function getCompanySettings() {
  const rows = await query(
    "SELECT setting_value FROM app_settings WHERE setting_key = 'company_settings' LIMIT 1",
  )

  return mergeCompanySettings(
    parseJsonSettingValue(rows[0]?.setting_value, defaultCompanySettings),
  )
}

export async function updateCompanySettings(payload) {
  const settings = mergeCompanySettings({
    companyName: payload.companyName ?? '',
    companyTaxId: payload.companyTaxId ?? '',
    workplace: payload.workplace ?? '',
    contributionAccountCode: payload.contributionAccountCode ?? '',
    address: payload.address ?? '',
    postalCode: payload.postalCode ?? '',
    city: payload.city ?? '',
    phone: payload.phone ?? '',
    email: payload.email ?? '',
    bankName: payload.bankName ?? '',
    bankIban: payload.bankIban ?? '',
  })

  await execute(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES ('company_settings', :settings::jsonb)
     ON CONFLICT (setting_key)
     DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP`,
    { settings: JSON.stringify(settings) },
  )

  return getCompanySettings()
}

export async function listEmployees() {
  const employees = await query(
    `SELECT
      id,
      name,
      role,
      hourly_rate AS "hourlyRate",
      tax_id AS "taxId",
      social_security_number AS "socialSecurityNumber",
      login_code AS "loginCode",
      mobile_access_enabled AS "mobileAccessEnabled"
    FROM employees
    ORDER BY name ASC`,
  )

  return employees.map((employee) => enrichEmployeeAccess(employee))
}

export async function listClients() {
  return query(
    `SELECT
      id,
      name,
      tax_id AS "taxId",
      address,
      postal_code AS "postalCode",
      city,
      email,
      phone
    FROM clients
    ORDER BY name ASC`,
  )
}

export async function createClient(payload) {
  const result = await query(
    `INSERT INTO clients (
      name,
      tax_id,
      address,
      postal_code,
      city,
      email,
      phone
    ) VALUES (
      :name,
      :taxId,
      :address,
      :postalCode,
      :city,
      :email,
      :phone
    )
    RETURNING id`,
    {
      name: payload.name,
      taxId: payload.taxId,
      address: payload.address || null,
      postalCode: payload.postalCode || null,
      city: payload.city || null,
      email: payload.email || null,
      phone: payload.phone || null,
    },
  )

  return getClientById(result[0].id)
}

export async function updateClient(clientId, payload) {
  const result = await execute(
    `UPDATE clients
     SET
      name = :name,
      tax_id = :taxId,
      address = :address,
      postal_code = :postalCode,
      city = :city,
      email = :email,
      phone = :phone
     WHERE id = :clientId`,
    {
      clientId,
      name: payload.name,
      taxId: payload.taxId,
      address: payload.address || null,
      postalCode: payload.postalCode || null,
      city: payload.city || null,
      email: payload.email || null,
      phone: payload.phone || null,
    },
  )

  if (result.affectedRows === 0) {
    return null
  }

  return getClientById(clientId)
}

export async function deleteClient(clientId) {
  const [{ totalInvoices }] = await query(
    `SELECT COUNT(*)::int AS "totalInvoices"
     FROM invoices
     WHERE client_id = :clientId`,
    { clientId },
  )

  if (Number(totalInvoices) > 0) {
    const error = new Error(
      'No se puede eliminar un cliente que ya tiene ventas o facturas registradas.',
    )
    error.statusCode = 409
    throw error
  }

  const result = await execute(
    'DELETE FROM clients WHERE id = :clientId',
    { clientId },
  )

  return result.affectedRows > 0
}

export async function createEmployee(payload) {
  const loginCode = payload.loginCode?.trim() || createEmployeeLoginCode(payload.name)
  const result = await query(
    `INSERT INTO employees (
      name,
      role,
      hourly_rate,
      tax_id,
      social_security_number,
      login_code,
      pin_hash
    ) VALUES (
      :name,
      :role,
      :hourlyRate,
      :taxId,
      :socialSecurityNumber,
      :loginCode,
      :pinHash
    )
    RETURNING id`,
    {
      name: payload.name,
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      taxId: payload.taxId,
      socialSecurityNumber: payload.socialSecurityNumber,
      loginCode,
      pinHash: hashPin(payload.pin),
    },
  )

  return getEmployeeById(result[0].id)
}

export async function updateEmployee(employeeId, payload) {
  const employee = await getEmployeeById(employeeId, { includePinHash: true })

  if (!employee) {
    return null
  }

  await execute(
    `UPDATE employees
     SET
       name = :name,
       role = :role,
       hourly_rate = :hourlyRate,
       tax_id = :taxId,
       social_security_number = :socialSecurityNumber,
       login_code = :loginCode,
       mobile_access_enabled = :mobileAccessEnabled,
       pin_hash = :pinHash
     WHERE id = :employeeId`,
    {
      employeeId,
      name: payload.name,
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      taxId: payload.taxId,
      socialSecurityNumber: payload.socialSecurityNumber,
      loginCode: payload.loginCode?.trim() || employee.loginCode || createEmployeeLoginCode(payload.name),
      mobileAccessEnabled: payload.mobileAccessEnabled ?? true,
      pinHash: payload.pin ? hashPin(payload.pin) : employee.pinHash,
    },
  )

  return getEmployeeById(employeeId)
}

export async function deleteEmployee(employeeId) {
  const result = await execute(
    'DELETE FROM employees WHERE id = :employeeId',
    { employeeId },
  )

  return result.affectedRows > 0
}

export async function listEmployeeShifts() {
  return query(
    `SELECT
      id,
      employee_id AS "employeeId",
      ${getTimestampSql('started_at', 'startedAt')},
      ${getTimestampSql('ended_at', 'endedAt')},
      ${getTimestampSql('started_verification_at', 'startedVerificationAt')},
      ${getTimestampSql('ended_verification_at', 'endedVerificationAt')},
      verification_method AS "verificationMethod",
      ended_verification_method AS "endedVerificationMethod",
      device_id AS "deviceId"
    FROM employee_shifts
    ORDER BY started_at DESC, id DESC`,
  )
}

async function toggleEmployeeShiftEntry({ employeeId, verificationMethod, deviceId = null }) {
  const openShifts = await query(
    `SELECT id
     FROM employee_shifts
     WHERE employee_id = :employeeId AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    { employeeId },
  )

  const now = new Date()
  const nowValue = now.toISOString()

  if (openShifts.length > 0) {
    await execute(
      `UPDATE employee_shifts
       SET
         ended_at = :endedAt,
         ended_verification_at = :endedAt,
         ended_verification_method = :verificationMethod,
         device_id = COALESCE(device_id, :deviceId)
       WHERE id = :shiftId`,
      {
        shiftId: openShifts[0].id,
        endedAt: nowValue,
        verificationMethod,
        deviceId,
      },
    )

    return {
      status: 'closed',
      employee: await getEmployeeById(employeeId),
      shifts: await listEmployeeShifts(),
    }
  }

  await execute(
    `INSERT INTO employee_shifts (
      employee_id,
      started_at,
      ended_at,
      started_verification_at,
      ended_verification_at,
      verification_method,
      ended_verification_method,
      device_id
    ) VALUES (
      :employeeId,
      :startedAt,
      NULL,
      :startedAt,
      NULL,
      :verificationMethod,
      NULL,
      :deviceId
    )`,
    {
      employeeId,
      startedAt: nowValue,
      verificationMethod,
      deviceId,
    },
  )

  return {
    status: 'opened',
    employee: await getEmployeeById(employeeId),
    shifts: await listEmployeeShifts(),
  }
}

export async function toggleEmployeeShift({ employeeId, pin }) {
  const employee = await getEmployeeById(employeeId, { includePinHash: true })

  if (!employee) {
    const error = new Error('No se encontró el empleado seleccionado.')
    error.statusCode = 404
    throw error
  }

  if (hashPin(pin) !== employee.pinHash) {
    const error = new Error('PIN incorrecto. El fichaje electrónico no se ha registrado.')
    error.statusCode = 401
    throw error
  }

  return toggleEmployeeShiftEntry({
    employeeId,
    verificationMethod: 'pin',
  })
}

export async function getSharedTimeTrackingState(deviceId) {
  assertAuthorizedSharedDevice(deviceId)

  const [employees, shifts] = await Promise.all([listEmployees(), listEmployeeShifts()])
  const openShiftEmployeeIds = new Set(
    shifts.filter((shift) => !shift.endedAt).map((shift) => shift.employeeId),
  )

  return {
    deviceId: SHARED_DEVICE_ID,
    employees: employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      openShift: openShiftEmployeeIds.has(employee.id),
    })),
  }
}

export async function registerSharedDeviceShift({
  employeeId,
  pin = '',
  qrToken = '',
  deviceId,
}) {
  assertAuthorizedSharedDevice(deviceId)

  const normalizedEmployeeId = Number(employeeId)

  if (!Number.isInteger(normalizedEmployeeId) || normalizedEmployeeId <= 0) {
    const error = new Error('Debes indicar un empleado valido para fichar.')
    error.statusCode = 400
    throw error
  }

  const employee = await getEmployeeById(normalizedEmployeeId, { includePinHash: true })

  if (!employee) {
    const error = new Error('No se encontro el empleado seleccionado.')
    error.statusCode = 404
    throw error
  }

  const normalizedPin = `${pin}`.trim()
  const normalizedQrToken = `${qrToken}`.trim()

  if (normalizedQrToken) {
    if (normalizedQrToken !== getEmployeeQrToken(employee.id)) {
      const error = new Error('QR invalido o caducado.')
      error.statusCode = 401
      throw error
    }
  } else if (normalizedPin) {
    if (hashPin(normalizedPin) !== employee.pinHash) {
      const error = new Error('PIN incorrecto. El fichaje no se ha registrado.')
      error.statusCode = 401
      throw error
    }
  } else {
    const error = new Error('Debes identificar al trabajador con PIN o QR.')
    error.statusCode = 400
    throw error
  }

  const verificationMethod = normalizedQrToken ? 'qr' : 'pin'

  const result = await toggleEmployeeShiftEntry({
    employeeId: employee.id,
    verificationMethod,
    deviceId: SHARED_DEVICE_ID,
  })

  return {
    ...result,
    actionType: result.status === 'opened' ? 'checkin' : 'checkout',
  }
}

export async function getTimeTrackingState() {
  const [companySettings, employees, shifts] = await Promise.all([
    getCompanySettings(),
    listEmployees(),
    listEmployeeShifts(),
  ])

  return {
    companySettings,
    employees,
    shifts,
  }
}

export async function getInvoicingState() {
  const [clients, invoices] = await Promise.all([listClients(), listInvoices()])

  return {
    clients,
    invoices,
  }
}

async function deleteExpiredEmployeeSessions() {
  await execute(
    'DELETE FROM employee_mobile_sessions WHERE expires_at <= CURRENT_TIMESTAMP',
  )
}

async function getEmployeeSessionByToken(token) {
  await deleteExpiredEmployeeSessions()

  const rows = await query(
    `SELECT
      s.id,
      s.employee_id AS "employeeId",
      s.expires_at AS "expiresAt",
      e.name,
      e.role,
      e.login_code AS "loginCode",
      e.mobile_access_enabled AS "mobileAccessEnabled"
    FROM employee_mobile_sessions s
    INNER JOIN employees e ON e.id = s.employee_id
    WHERE s.token_hash = :tokenHash
    LIMIT 1`,
    { tokenHash: hashToken(token) },
  )

  return rows[0] ?? null
}

export async function loginEmployeeMobileAccess({ loginCode, pin }) {
  const employee = await getEmployeeByLoginCode(loginCode, { includePinHash: true })

  if (!employee || !employee.mobileAccessEnabled) {
    const error = new Error('Acceso móvil no disponible para este trabajador.')
    error.statusCode = 404
    throw error
  }

  if (hashPin(pin) !== employee.pinHash) {
    const error = new Error('Código o PIN incorrectos.')
    error.statusCode = 401
    throw error
  }

  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()

  await execute(
    'DELETE FROM employee_mobile_sessions WHERE employee_id = :employeeId',
    { employeeId: employee.id },
  )

  await execute(
    `INSERT INTO employee_mobile_sessions (
      employee_id,
      token_hash,
      expires_at
    ) VALUES (
      :employeeId,
      :tokenHash,
      :expiresAt
    )`,
    {
      employeeId: employee.id,
      tokenHash: hashToken(token),
      expiresAt,
    },
  )

  return {
    token,
    employee: await getEmployeeById(employee.id),
  }
}

export async function logoutEmployeeMobileAccess(token) {
  const result = await execute(
    'DELETE FROM employee_mobile_sessions WHERE token_hash = :tokenHash',
    { tokenHash: hashToken(token) },
  )

  return result.affectedRows > 0
}

export async function getEmployeeMobileAccessState(token) {
  const session = await getEmployeeSessionByToken(token)

  if (!session) {
    const error = new Error('La sesión móvil ha caducado o no es válida.')
    error.statusCode = 401
    throw error
  }

  const employee = await getEmployeeById(session.employeeId)
  const shifts = await query(
    `SELECT
      id,
      ${getTimestampSql('started_at', 'startedAt')},
      ${getTimestampSql('ended_at', 'endedAt')},
      verification_method AS "verificationMethod"
    FROM employee_shifts
    WHERE employee_id = :employeeId
      AND DATE(started_at AT TIME ZONE 'UTC') = :today
    ORDER BY started_at DESC`,
    {
      employeeId: session.employeeId,
      today: normalizeOrderDateValue(new Date()),
    },
  )

  return {
    employee,
    shifts,
    openShift: shifts.find((shift) => !shift.endedAt) ?? null,
  }
}

export async function toggleEmployeeMobileShift(token) {
  const session = await getEmployeeSessionByToken(token)

  if (!session) {
    const error = new Error('La sesión móvil ha caducado o no es válida.')
    error.statusCode = 401
    throw error
  }

  const result = await toggleEmployeeShiftEntry({
    employeeId: session.employeeId,
    verificationMethod: 'mobile',
  })

  return {
    ...result,
    mobileState: await getEmployeeMobileAccessState(token),
  }
}

export async function getMonthlyTimeReport({ employeeId, month }) {
  const employee = await getEmployeeById(employeeId)

  if (!employee) {
    return null
  }

  const companySettings = await getCompanySettings()
  const totalDays = getDaysInMonth(month)
  const monthShifts = await query(
    `SELECT
      id,
      ${getTimestampSql('started_at', 'startedAt')},
      ${getTimestampSql('ended_at', 'endedAt')},
      ${getTimestampSql('started_verification_at', 'startedVerificationAt')},
      ${getTimestampSql('ended_verification_at', 'endedVerificationAt')},
      verification_method AS "verificationMethod"
    FROM employee_shifts
    WHERE employee_id = :employeeId
      AND TO_CHAR(started_at AT TIME ZONE 'UTC', 'YYYY-MM') = :month
    ORDER BY started_at ASC, id ASC`,
    {
      employeeId,
      month,
    },
  )

  const shiftsByDay = new Map()

  monthShifts.forEach((shift) => {
    const day = Number(`${shift.startedAt}`.slice(8, 10))
    const dayShifts = shiftsByDay.get(day) ?? []
    dayShifts.push(shift)
    shiftsByDay.set(day, dayShifts)
  })

  const rows = Array.from({ length: totalDays }, (_, index) => {
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

  return {
    companySettings,
    employee,
    month,
    monthLabel: formatMonthLabel(month),
    rows,
  }
}

export async function buildMonthlyTimeReportPdf({ employeeId, month }) {
  const report = await getMonthlyTimeReport({ employeeId, month })

  if (!report) {
    return null
  }

  const doc = new PDFDocument({
    size: 'A4',
    margin: 28,
  })
  const chunks = []

  doc.on('data', (chunk) => chunks.push(chunk))

  const pdfReady = new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  doc.fontSize(12).text(
    'Listado Resumen mensual del registro de jornada (detalle horario)',
    { align: 'center' },
  )
  doc.moveDown(0.8)

  doc.fontSize(8)
  doc.text(`Empresa: ${report.companySettings.companyName}`, 56)
  doc.text(`C.I.F./N.I.F.: ${report.companySettings.companyTaxId}`, 56)
  doc.text(`Centro de Trabajo: ${report.companySettings.workplace}`, 56)
  doc.text(`C.C.C.: ${report.companySettings.contributionAccountCode}`, 56)
  doc.moveUp(4)
  doc.text(`Trabajador: ${report.employee.name}`, 322)
  doc.text(`N.I.F.: ${report.employee.taxId}`, 322)
  doc.text(`Nº Afiliación: ${report.employee.socialSecurityNumber}`, 322)
  doc.text(`Mes y Año: ${report.monthLabel}`, 322)
  doc.moveDown(1)

  const tableTop = 120
  const headerHeight = 16
  const subHeaderHeight = 14
  const rowHeight = 14
  const columns = [
    { label: 'DIA', x: 40, width: 40 },
    { label: 'ENTRADA', x: 80, width: 80 },
    { label: 'SALIDA', x: 160, width: 80 },
    { label: 'ENTRADA', x: 240, width: 80 },
    { label: 'SALIDA', x: 320, width: 80 },
    { label: 'FIRMA DEL TRABAJADOR / A', x: 400, width: 155 },
  ]

  doc.rect(40, tableTop, 515, headerHeight).stroke()
  doc.fontSize(7)
  doc.text('DIA', 52, tableTop + 4)
  doc.text('MAÑANAS', 120, tableTop + 4)
  doc.text('TARDES', 283, tableTop + 4)
  doc.text('FIRMA DEL TRABAJADOR / A', 420, tableTop + 4, {
    width: 120,
    align: 'center',
  })

  const subHeaderTop = tableTop + headerHeight
  columns.forEach((column) => {
    doc.rect(column.x, subHeaderTop, column.width, subHeaderHeight).stroke()
  })
  doc.text('ENTRADA', 93, subHeaderTop + 4)
  doc.text('SALIDA', 177, subHeaderTop + 4)
  doc.text('ENTRADA', 253, subHeaderTop + 4)
  doc.text('SALIDA', 337, subHeaderTop + 4)

  let rowTop = subHeaderTop + subHeaderHeight
  report.rows.forEach((row) => {
    columns.forEach((column) => {
      doc.rect(column.x, rowTop, column.width, rowHeight).stroke()
    })

    doc.text(`${row.day}`, 53, rowTop + 3)
    doc.text(row.morningEntry, 94, rowTop + 3)
    doc.text(row.morningExit, 178, rowTop + 3)
    doc.text(row.afternoonEntry, 254, rowTop + 3)
    doc.text(row.afternoonExit, 338, rowTop + 3)
    doc.text(row.signature, 453, rowTop + 3)
    rowTop += rowHeight
  })

  const pageBottom = doc.page.height - doc.page.margins.bottom
  const legalBlockTop = pageBottom - 46
  const footerTop = rowTop + 12
  const signatureLineY = legalBlockTop - 45
  const dateLineY = signatureLineY + 8
  const signatureLabelY = footerTop + 28
  doc.fontSize(8).fillColor('#1c1917')
  doc.text('Firma de la persona trabajadora:', 40, signatureLabelY)
  doc.moveTo(40, signatureLineY).lineTo(260, signatureLineY).stroke()
  doc.text('Firma de la empresa:', 320, signatureLabelY)
  doc.moveTo(320, signatureLineY).lineTo(520, signatureLineY).stroke()
  doc.text(
    getReportCreationDateLabel(),
    40,
    dateLineY,
  )

  doc.fontSize(6).fillColor('#44403c')
  doc.text(
    'Registro realizado en cumplimiento del Art. 34.9 del texto refundido de la Ley del Estatuto de los Trabajadores.',
    40,
    legalBlockTop,
    {
      width: 515,
      align: 'justify',
    },
  )
  doc.text(
    'La empresa conservará los registros durante cuatro años y permanecerán a disposición de las personas trabajadoras, sus representantes legales y de la Inspección de Trabajo y Seguridad Social.',
    40,
    legalBlockTop + 18,
    {
      width: 515,
      align: 'justify',
    },
  )

  doc.end()
  return pdfReady
}

export async function buildMonthlyTimeReportWorkbook({ employeeId, month }) {
  const report = await getMonthlyTimeReport({ employeeId, month })

  if (!report) {
    return null
  }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Registro Jornada')

  sheet.mergeCells('A1:F1')
  sheet.getCell('A1').value =
    'Listado Resumen mensual del registro de jornada (detalle horario)'
  sheet.getCell('A1').font = { bold: true, size: 14 }

  sheet.getCell('A3').value = `Empresa: ${report.companySettings.companyName}`
  sheet.getCell('A4').value = `C.I.F./N.I.F.: ${report.companySettings.companyTaxId}`
  sheet.getCell('A5').value = `Centro de Trabajo: ${report.companySettings.workplace}`
  sheet.getCell('A6').value = `C.C.C.: ${report.companySettings.contributionAccountCode}`
  sheet.getCell('E3').value = `Trabajador: ${report.employee.name}`
  sheet.getCell('E4').value = `N.I.F.: ${report.employee.taxId}`
  sheet.getCell('E5').value = `Nº Afiliación: ${report.employee.socialSecurityNumber}`
  sheet.getCell('E6').value = `Mes y Año: ${report.monthLabel}`

  sheet.mergeCells('B8:C8')
  sheet.mergeCells('D8:E8')
  sheet.getCell('A8').value = 'DIA'
  sheet.getCell('B8').value = 'MAÑANAS'
  sheet.getCell('D8').value = 'TARDES'
  sheet.getCell('F8').value = 'FIRMA DEL TRABAJADOR / A'
  sheet.getCell('B9').value = 'ENTRADA'
  sheet.getCell('C9').value = 'SALIDA'
  sheet.getCell('D9').value = 'ENTRADA'
  sheet.getCell('E9').value = 'SALIDA'

  report.rows.forEach((row, index) => {
    const rowNumber = 10 + index
    sheet.getCell(`A${rowNumber}`).value = row.day
    sheet.getCell(`B${rowNumber}`).value = row.morningEntry
    sheet.getCell(`C${rowNumber}`).value = row.morningExit
    sheet.getCell(`D${rowNumber}`).value = row.afternoonEntry
    sheet.getCell(`E${rowNumber}`).value = row.afternoonExit
    sheet.getCell(`F${rowNumber}`).value = row.signature
  })

  sheet.columns = [
    { key: 'day', width: 10 },
    { key: 'morningEntry', width: 14 },
    { key: 'morningExit', width: 14 },
    { key: 'afternoonEntry', width: 14 },
    { key: 'afternoonExit', width: 14 },
    { key: 'signature', width: 28 },
  ]

  for (let rowNumber = 8; rowNumber <= 9 + report.rows.length; rowNumber += 1) {
    for (let column = 1; column <= 6; column += 1) {
      const cell = sheet.getRow(rowNumber).getCell(column)
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      if (rowNumber <= 9) {
        cell.font = { bold: true }
      }
    }
  }

  return workbook.xlsx.writeBuffer()
}

export async function listInvoices() {
  const invoices = await query(
    `SELECT
      id,
      invoice_number AS "invoiceNumber",
      issue_date AS "issueDate",
      due_date AS "dueDate",
      client_id AS "clientId",
      client_name AS "clientName",
      tax_id AS "taxId",
      client_address AS "clientAddress",
      client_postal_code AS "clientPostalCode",
      client_city AS "clientCity",
      client_email AS "clientEmail",
      client_phone AS "clientPhone",
      payment_by_transfer AS "paymentByTransfer",
      status,
      notes,
      vat_rate AS "vatRate",
      subtotal,
      vat_amount AS "vatAmount",
      total
    FROM invoices
    ORDER BY issue_date DESC, id DESC`,
  )

  if (invoices.length === 0) {
    return []
  }

  const items = await query(
    `SELECT
      id,
      invoice_id AS "invoiceId",
      description,
      quantity,
      unit_price AS "unitPrice",
      line_total AS "lineTotal"
    FROM invoice_items
    ORDER BY invoice_id ASC, id ASC`,
  )

  const itemsByInvoiceId = new Map()
  items.forEach((item) => {
    const currentItems = itemsByInvoiceId.get(item.invoiceId) ?? []
    currentItems.push({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })
    itemsByInvoiceId.set(item.invoiceId, currentItems)
  })

  const hydratedInvoices = await Promise.all(
    invoices.map(async (invoice) => {
      const shouldHydrateClient =
        !invoice.clientAddress ||
        !invoice.clientPostalCode ||
        !invoice.clientCity ||
        !invoice.clientEmail ||
        !invoice.clientPhone

      let client = null

      if (shouldHydrateClient && invoice.clientId) {
        client = await getClientById(invoice.clientId)
      }

      if (shouldHydrateClient && !client) {
        client = await getClientByName(invoice.clientName)
      }

      return {
        ...invoice,
        issueDate: normalizeOrderDateValue(invoice.issueDate),
        dueDate: normalizeOrderDateValue(invoice.dueDate),
        clientAddress: invoice.clientAddress || client?.address || '',
        clientPostalCode: invoice.clientPostalCode || client?.postalCode || '',
        clientCity: invoice.clientCity || client?.city || '',
        clientEmail: invoice.clientEmail || client?.email || '',
        clientPhone: invoice.clientPhone || client?.phone || '',
        items: itemsByInvoiceId.get(invoice.id) ?? [],
      }
    }),
  )

  return hydratedInvoices
}

export async function createInvoice(payload) {
  const filteredItems = payload.items
    .filter((item) => item.description?.trim() && Number(item.quantity) > 0)
    .map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.quantity) * Number(item.unitPrice),
    }))

  if (filteredItems.length === 0) {
    const error = new Error('La factura necesita al menos una línea válida.')
    error.statusCode = 400
    throw error
  }

  const client =
    payload.clientId ? await getClientById(Number(payload.clientId)) : null
  const issueDate = normalizeOrderDateValue(payload.issueDate)
  const { invoiceYear, nextSequence } = await getNextInvoiceSequence(issueDate)
  const invoiceNumber = `FAC-${invoiceYear}-${`${nextSequence}`.padStart(4, '0')}`
  const vatRate = Number(payload.vatRate ?? 21)
  const { subtotal, vatAmount, total } = calculateInvoiceTotals(
    filteredItems,
    vatRate,
  )
  const connection = await getConnection()

  try {
    await connection.beginTransaction()

    const invoiceResult = await connection.execute(
      `INSERT INTO invoices (
        invoice_number,
        issue_date,
        due_date,
        client_id,
        client_name,
        tax_id,
        client_address,
        client_postal_code,
        client_city,
        client_email,
        client_phone,
        payment_by_transfer,
        status,
        notes,
        vat_rate,
        subtotal,
        vat_amount,
        total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
      [
        invoiceNumber,
        issueDate,
        normalizeOrderDateValue(payload.dueDate),
        client?.id ?? null,
        client?.name ?? payload.clientName,
        client?.taxId ?? payload.taxId ?? null,
        client?.address ?? payload.clientAddress ?? null,
        client?.postalCode ?? payload.clientPostalCode ?? null,
        client?.city ?? payload.clientCity ?? null,
        client?.email ?? payload.clientEmail ?? null,
        client?.phone ?? payload.clientPhone ?? null,
        Boolean(payload.paymentByTransfer),
        payload.status,
        payload.notes || '',
        vatRate,
        subtotal,
        vatAmount,
        total,
      ],
    )

    for (const item of filteredItems) {
      await connection.execute(
        `INSERT INTO invoice_items (
          invoice_id,
          description,
          quantity,
          unit_price,
          line_total
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          invoiceResult.insertId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ],
      )
    }

    await connection.commit()
    return getInvoiceById(invoiceResult.insertId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function updateInvoice(invoiceId, payload) {
  const invoice = await getInvoiceById(invoiceId)

  if (!invoice) {
    return null
  }

  const filteredItems = payload.items
    .filter((item) => item.description?.trim() && Number(item.quantity) > 0)
    .map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.quantity) * Number(item.unitPrice),
    }))

  if (filteredItems.length === 0) {
    const error = new Error('La factura necesita al menos una línea válida.')
    error.statusCode = 400
    throw error
  }

  const vatRate = Number(payload.vatRate ?? 21)
  const { subtotal, vatAmount, total } = calculateInvoiceTotals(
    filteredItems,
    vatRate,
  )
  const client =
    payload.clientId ? await getClientById(Number(payload.clientId)) : null
  const connection = await getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE invoices
       SET
         due_date = ?,
         client_id = ?,
         client_name = ?,
         tax_id = ?,
         client_address = ?,
         client_postal_code = ?,
         client_city = ?,
         client_email = ?,
         client_phone = ?,
         payment_by_transfer = ?,
         status = ?,
         notes = ?,
         vat_rate = ?,
         subtotal = ?,
         vat_amount = ?,
         total = ?
       WHERE id = ?`,
      [
        normalizeOrderDateValue(payload.dueDate),
        client?.id ?? null,
        client?.name ?? payload.clientName,
        client?.taxId ?? payload.taxId ?? null,
        client?.address ?? payload.clientAddress ?? null,
        client?.postalCode ?? payload.clientPostalCode ?? null,
        client?.city ?? payload.clientCity ?? null,
        client?.email ?? payload.clientEmail ?? null,
        client?.phone ?? payload.clientPhone ?? null,
        Boolean(payload.paymentByTransfer),
        payload.status,
        payload.notes || '',
        vatRate,
        subtotal,
        vatAmount,
        total,
        invoiceId,
      ],
    )

    await connection.execute(
      'DELETE FROM invoice_items WHERE invoice_id = ?',
      [invoiceId],
    )

    for (const item of filteredItems) {
      await connection.execute(
        `INSERT INTO invoice_items (
          invoice_id,
          description,
          quantity,
          unit_price,
          line_total
        ) VALUES (?, ?, ?, ?, ?)`,
        [invoiceId, item.description, item.quantity, item.unitPrice, item.lineTotal],
      )
    }

    await connection.commit()
    return getInvoiceById(invoiceId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function updateInvoiceStatus({ invoiceId, status }) {
  const result = await execute(
    `UPDATE invoices
     SET status = :status
     WHERE id = :invoiceId`,
    { invoiceId, status },
  )

  if (result.affectedRows === 0) {
    return null
  }

  return getInvoiceById(invoiceId)
}

export async function deleteInvoice(invoiceId) {
  const result = await execute(
    'DELETE FROM invoices WHERE id = :invoiceId',
    { invoiceId },
  )

  return result.affectedRows > 0
}

export async function buildInvoicePdf(invoiceId) {
  const invoice = await getInvoiceById(invoiceId)

  if (!invoice) {
    return null
  }

  const companySettings = await getCompanySettings()
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
  })
  const chunks = []

  doc.on('data', (chunk) => chunks.push(chunk))

  const pdfReady = new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  const pageWidth = doc.page.width
  const { left, right, top } = doc.page.margins
  const contentWidth = pageWidth - left - right
  const headerTop = top
  const headerHeight = 150
  const logoPath = getInvoiceLogoPath()
  const companyBlockX = left + 18
  const companyTextX = logoPath ? companyBlockX + 78 : companyBlockX
  const metaBlockWidth = 175
  const metaBlockX = left + contentWidth - metaBlockWidth - 18
  const companyNameWidth = metaBlockX - companyTextX - 18
  const invoiceDisplayNumber = formatInvoiceDisplayNumber(
    invoice.invoiceNumber,
    invoice.issueDate,
  )

  doc.roundedRect(left, headerTop, contentWidth, headerHeight, 16).fill('#f7efe7')
  doc
    .roundedRect(left + 12, headerTop + 12, contentWidth - 24, headerHeight - 24, 12)
    .fill('#fffdfa')

  if (logoPath) {
    doc
      .save()
      .circle(companyBlockX + 29, headerTop + 51, 29)
      .clip()
      .image(logoPath, companyBlockX, headerTop + 22, {
        fit: [58, 58],
        align: 'center',
        valign: 'center',
      })
      .restore()
    doc.circle(companyBlockX + 29, headerTop + 51, 29).lineWidth(0.5).stroke('#e7d7c9')
  }

  doc.fillColor('#1c1917').fontSize(13)
  const companyNameHeight = doc.heightOfString(companySettings.companyName || 'Empresa', {
    width: companyNameWidth,
  })
  doc.text(companySettings.companyName || 'Empresa', companyTextX, headerTop + 24, {
    width: companyNameWidth,
  })

  const companyInfoTop = headerTop + 24 + companyNameHeight + 8
  const companyLines = []
  appendPdfLine(companyLines, 'NIF', companySettings.companyTaxId)
  appendPdfLine(companyLines, 'Direccion', companySettings.address)
  appendPdfLine(
    companyLines,
    'CP / Ciudad',
    `${companySettings.postalCode ?? ''} ${companySettings.city ?? ''}`,
  )
  appendPdfLine(companyLines, 'Telefono', companySettings.phone)
  appendPdfLine(companyLines, 'Correo', companySettings.email)

  doc.fillColor('#57534e').fontSize(10)
  companyLines.forEach((line, index) => {
    doc.text(line, companyTextX, companyInfoTop + index * 14, {
      width: companyNameWidth,
    })
  })

  doc.roundedRect(metaBlockX, headerTop + 16, metaBlockWidth, 86, 14).fill('#fff1e6')
  doc.fillColor('#9a3412').fontSize(11).text('Factura', metaBlockX + 16, headerTop + 28)
  doc.fillColor('#1c1917').fontSize(10)
  doc.text(`Numero: ${invoiceDisplayNumber}`, metaBlockX + 16, headerTop + 48)
  doc.text(`Fecha: ${formatPdfDate(invoice.issueDate)}`, metaBlockX + 16, headerTop + 63)

  const clientTop = headerTop + headerHeight + 26
  doc.fillColor('#9a3412').fontSize(10).text('Cliente', left, clientTop)
  doc.fillColor('#1c1917').fontSize(14)
  const clientNameHeight = doc.heightOfString(invoice.clientName || '', {
    width: 260,
  })
  doc.text(invoice.clientName || '', left, clientTop + 16, { width: 260 })
  doc.fillColor('#57534e').fontSize(10)
  const clientInfoTop = clientTop + 16 + clientNameHeight + 8
  const clientLines = []
  appendPdfLine(clientLines, 'NIF/CIF', invoice.taxId)
  appendPdfLine(clientLines, 'Direccion', invoice.clientAddress)
  appendPdfLine(
    clientLines,
    'CP/Ciudad',
    `${invoice.clientPostalCode ?? ''} ${invoice.clientCity ?? ''}`,
  )
  appendPdfLine(clientLines, 'Correo', invoice.clientEmail)
  appendPdfLine(clientLines, 'Telefono', invoice.clientPhone)

  clientLines.forEach((line, index) => {
    doc.text(line, left, clientInfoTop + index * 14, {
      width: 260,
    })
  })

  const tableTop = clientInfoTop + clientLines.length * 14 + 28
  const columns = [
    { label: 'CONCEPTO', x: 40, width: 265 },
    { label: 'CANT.', x: 305, width: 60 },
    { label: 'PRECIO', x: 365, width: 90 },
    { label: 'TOTAL', x: 455, width: 100 },
  ]

  doc.fillColor('#1c1917').fontSize(10)
  columns.forEach((column) => {
    doc.rect(column.x, tableTop, column.width, 22).fillAndStroke('#fff1e6', '#d6d3d1')
    doc.fillColor('#9a3412')
    doc.text(column.label, column.x + 5, tableTop + 7, {
      width: column.width - 10,
      align: column.label === 'CONCEPTO' ? 'left' : 'center',
    })
  })

  let rowTop = tableTop + 22
  invoice.items.forEach((item) => {
    columns.forEach((column) => {
      doc.rect(column.x, rowTop, column.width, 22).stroke('#d6d3d1')
    })
    doc.fillColor('#1c1917')
    doc.text(item.description, 45, rowTop + 7, { width: 255 })
    doc.text(formatPdfNumber(item.quantity), 310, rowTop + 7, {
      width: 50,
      align: 'center',
    })
    doc.text(formatPdfCurrency(item.unitPrice), 370, rowTop + 7, {
      width: 80,
      align: 'right',
    })
    doc.text(formatPdfCurrency(item.lineTotal), 460, rowTop + 7, {
      width: 90,
      align: 'right',
    })
    rowTop += 22
  })

  rowTop += 20
  const totalsBoxX = 335
  const totalsBoxWidth = 220
  const totalsTopPadding = 10
  const totalsBottomPadding = 10
  const totalsTextOffsetY = 3
  const totalsTextOffsetByRow = [0, 0, 4]
  const totalsRowHeights = [18, 18, 24]
  const totalsRowGaps = [4, 12]
  const totals = [
    {
      label: 'Base imponible',
      value: formatPdfCurrency(invoice.subtotal),
      textColor: '#44403c',
      fontSize: 10,
    },
    {
      label: `IVA ${formatPdfNumber(invoice.vatRate)}%`,
      value: formatPdfCurrency(invoice.vatAmount),
      textColor: '#44403c',
      fontSize: 10,
    },
    {
      label: 'TOTAL',
      value: formatPdfCurrency(invoice.total),
      textColor: '#9a3412',
      fontSize: 12,
    },
  ]
  const totalsBoxHeight =
    totalsTopPadding +
    totalsBottomPadding +
    totalsRowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0) +
    totalsRowGaps.reduce((sum, rowGap) => sum + rowGap, 0)

  doc.roundedRect(totalsBoxX, rowTop, totalsBoxWidth, totalsBoxHeight, 6).fill('#fff7ed')
  doc
    .roundedRect(totalsBoxX, rowTop, totalsBoxWidth, totalsBoxHeight, 6)
    .lineWidth(1)
    .stroke('#fdba74')

  let currentTop = rowTop + totalsTopPadding
  totals.forEach((totalRow, index) => {
    const currentTextOffsetY = totalsTextOffsetY + (totalsTextOffsetByRow[index] ?? 0)
    doc.fillColor(totalRow.textColor).fontSize(totalRow.fontSize)
    doc.text(totalRow.label, totalsBoxX + 12, currentTop + currentTextOffsetY, {
      width: 96,
    })
    doc.text(totalRow.value, totalsBoxX + 110, currentTop + currentTextOffsetY, {
      width: totalsBoxWidth - 122,
      align: 'right',
    })

    if (index === totals.length - 2) {
      const separatorY = currentTop + totalsRowHeights[index] + totalsRowGaps[index] / 2
      doc
        .moveTo(totalsBoxX, separatorY)
        .lineTo(totalsBoxX + totalsBoxWidth, separatorY)
        .lineWidth(0.5)
        .stroke('#fdba74')
    }

    currentTop += totalsRowHeights[index] + (totalsRowGaps[index] ?? 0)
  })
  doc.fillColor('#1c1917').fontSize(10)

  if (invoice.notes) {
    const notesTop = rowTop + totalsBoxHeight + 10
    const notesLabelHeight = 14
    const notesTextWidth = contentWidth - 32
    const notesTextHeight = doc.heightOfString(invoice.notes, {
      width: notesTextWidth,
    })
    const notesBoxHeight = Math.max(72, notesTextHeight + 36)

    doc.roundedRect(left, notesTop, contentWidth, notesBoxHeight, 12).fill('#fff7ed')
    doc.roundedRect(left, notesTop, contentWidth, notesBoxHeight, 12).lineWidth(1).stroke('#fdba74')
    doc.fillColor('#9a3412').fontSize(10).text('Notas', left + 16, notesTop + 14)
    doc.fillColor('#1c1917').fontSize(10).text(invoice.notes, left + 16, notesTop + 14 + notesLabelHeight, {
      width: notesTextWidth,
    })
  }

  const bankName = companySettings.bankName?.trim() || 'banco indicado'
  const bankIban = companySettings.bankIban?.trim() || 'IBAN indicado'
  const paymentLabel = invoice.paymentByTransfer
    ? `Forma de pago: Transferencia bancaria al ${bankName} - IBAN: ${bankIban}`
    : 'Forma de pago: al Contado'

  doc
    .fillColor('#78716c')
    .fontSize(10)
    .text(paymentLabel, left, doc.page.height - 72, {
      width: contentWidth,
      align: 'center',
    })
    .fillColor('#78716c')
    .fontSize(10)
    .text('Muchas gracias por su preferencia', left, doc.page.height - 55, {
      width: contentWidth,
      align: 'center',
    })

  doc.end()
  return pdfReady
}

export async function listProducts(search = '') {
  const normalizedSearch = `%${search.trim()}%`

  return query(
    `SELECT
      id,
      handle,
      ref,
      name,
      category,
      description,
      sold_by_weight AS "soldByWeight",
      purchase_cost AS "purchaseCost",
      sale_price AS "salePrice",
      available_for_sale AS "availableForSale"
    FROM products
    WHERE name ILIKE :search OR ref ILIKE :search OR category ILIKE :search
    ORDER BY name ASC
    LIMIT 250`,
    { search: normalizedSearch },
  )
}

export async function updateProduct(productId, payload) {
  const result = await execute(
    `UPDATE products
     SET
      name = :name,
      category = :category,
      purchase_cost = :purchaseCost,
      sale_price = :salePrice,
      available_for_sale = :availableForSale
     WHERE id = :productId`,
    {
      productId,
      name: payload.name,
      category: payload.category || null,
      purchaseCost: payload.purchaseCost,
      salePrice: payload.salePrice,
      availableForSale: Boolean(payload.availableForSale),
    },
  )

  if (result.affectedRows === 0) {
    return null
  }

  const rows = await query(
    `SELECT
      id,
      handle,
      ref,
      name,
      category,
      description,
      sold_by_weight AS "soldByWeight",
      purchase_cost AS "purchaseCost",
      sale_price AS "salePrice",
      available_for_sale AS "availableForSale"
    FROM products
    WHERE id = :productId`,
    { productId },
  )

  return rows[0] ?? null
}

export async function listOrders(filters = {}) {
  const conditions = []
  const params = {}

  if (filters.status && filters.status !== 'all') {
    conditions.push('o.status = :status')
    params.status = filters.status
  }

  if (filters.dateFrom) {
    conditions.push('o.order_date >= :dateFrom')
    params.dateFrom = filters.dateFrom
  }

  if (filters.dateTo) {
    conditions.push('o.order_date <= :dateTo')
    params.dateTo = filters.dateTo
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const orders = await query(
    `SELECT
      o.id,
      o.order_date AS "orderDate",
      o.status,
      o.csv_filename AS "csvFilename",
      o.total_items AS "totalItems",
      COALESCE(c.total_units_sold, 0) AS "totalUnitsSold",
      COALESCE(c.total_sales_amount, 0) AS "totalSalesAmount",
      o.created_at AS "createdAt",
      COUNT(oi.id) AS "productLines"
    FROM daily_orders o
    LEFT JOIN daily_order_items oi ON oi.daily_order_id = o.id
    LEFT JOIN daily_closings c ON c.daily_order_id = o.id
    ${whereClause}
    GROUP BY
      o.id,
      o.order_date,
      o.status,
      o.csv_filename,
      o.total_items,
      c.total_units_sold,
      c.total_sales_amount,
      o.created_at
    ORDER BY o.order_date DESC`,
    params,
  )

  return orders.map((order) => ({
    ...order,
    orderDate: normalizeOrderDateValue(order.orderDate),
    csvUrl: `/generated-orders/${order.csvFilename}`,
  }))
}

export async function getOrderById(orderId) {
  const orders = await query(
    `SELECT
      o.id,
      o.order_date AS "orderDate",
      o.status,
      o.csv_filename AS "csvFilename",
      o.csv_path AS "csvPath",
      o.total_items AS "totalItems",
      c.id AS "closingId",
      COALESCE(c.total_units_sold, 0) AS "totalUnitsSold",
      COALESCE(c.total_sales_amount, 0) AS "totalSalesAmount",
      c.closed_at AS "closedAt"
    FROM daily_orders o
    LEFT JOIN daily_closings c ON c.daily_order_id = o.id
    WHERE o.id = :orderId`,
    { orderId },
  )

  if (orders.length === 0) {
    return null
  }

  const items = await query(
    `SELECT
      oi.id,
      oi.quantity_ordered AS "quantityOrdered",
      oi.purchase_cost AS "purchaseCost",
      oi.variant_name AS "variantName",
      p.id AS "productId",
      p.ref,
      p.name,
      p.category,
      p.sale_price AS "salePrice",
      ci.remaining_quantity AS "remainingQuantity",
      ci.sold_quantity AS "soldQuantity",
      ci.sales_amount AS "salesAmount"
    FROM daily_order_items oi
    INNER JOIN products p ON p.id = oi.product_id
    LEFT JOIN daily_closing_items ci ON ci.daily_order_item_id = oi.id
    LEFT JOIN daily_closings c ON c.id = ci.daily_closing_id
    WHERE oi.daily_order_id = :orderId
    ORDER BY p.name ASC`,
    { orderId },
  )

  return {
    ...orders[0],
    orderDate: normalizeOrderDateValue(orders[0].orderDate),
    csvUrl: `/generated-orders/${orders[0].csvFilename}`,
    items,
    summary: {
      totalOrderedUnits: items.reduce(
        (sum, item) => sum + Number(item.quantityOrdered ?? 0),
        0,
      ),
      totalRemainingUnits: items.reduce(
        (sum, item) => sum + Number(item.remainingQuantity ?? 0),
        0,
      ),
      totalSoldUnits: items.reduce(
        (sum, item) => sum + Number(item.soldQuantity ?? 0),
        0,
      ),
      estimatedOpenSalesAmount: items.reduce((sum, item) => {
        const remainingQuantity = Number(item.remainingQuantity ?? item.quantityOrdered)
        const soldQuantity = Math.max(Number(item.quantityOrdered) - remainingQuantity, 0)
        return sum + soldQuantity * Number(item.salePrice ?? 0)
      }, 0),
    },
  }
}

export async function createDailyOrder({ orderDate, items }) {
  const normalizedOrderDate = normalizeOrderDateValue(orderDate)
  const existingOrders = await query(
    'SELECT id FROM daily_orders WHERE order_date = :orderDate LIMIT 1',
    { orderDate: normalizedOrderDate },
  )

  if (existingOrders.length > 0) {
    const error = new Error('Ya existe un pedido para esa fecha.')
    error.statusCode = 409
    throw error
  }

  const headers = await getPurchaseOrderHeaders()
  const csvFilename = `import_purchase_order_${formatOrderDate(normalizedOrderDate)}.csv`

  const csvRows = items.map((item) => ({
    REF: item.ref,
    'Nombre del articulo': item.name,
    'Nombre de la variante': item.variantName ?? '',
    Cantidad: item.quantity,
    'Purchase cost': item.purchaseCost,
  }))

  const csvPath = await writePurchaseOrderCsv({
    filename: csvFilename,
    headers,
    rows: csvRows,
  })

  const connection = await getConnection()

  try {
    await connection.beginTransaction()

    const orderResult = await connection.execute(
      `INSERT INTO daily_orders (order_date, status, csv_filename, csv_path, total_items)
       VALUES (?, 'open', ?, ?, ?)
       RETURNING id`,
      [normalizedOrderDate, csvFilename, csvPath, items.length],
    )

    for (const item of items) {
      await connection.execute(
        `INSERT INTO daily_order_items (
          daily_order_id,
          product_id,
          variant_name,
          quantity_ordered,
          purchase_cost
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          item.productId,
          item.variantName ?? '',
          item.quantity,
          item.purchaseCost,
        ],
      )
    }

    await connection.commit()
    return getOrderById(orderResult.insertId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function updateDailyOrder({ orderId, orderDate, items }) {
  const normalizedOrderDate = normalizeOrderDateValue(orderDate)
  const order = await getOrderById(orderId)

  if (!order) {
    return null
  }

  if (order.status !== 'open') {
    const error = new Error('Solo se pueden editar pedidos abiertos.')
    error.statusCode = 409
    throw error
  }

  const existingOrders = await query(
    `SELECT id
     FROM daily_orders
     WHERE order_date = :orderDate AND id <> :orderId
     LIMIT 1`,
    { orderDate: normalizedOrderDate, orderId },
  )

  if (existingOrders.length > 0) {
    const error = new Error('Ya existe otro pedido para esa fecha.')
    error.statusCode = 409
    throw error
  }

  const headers = await getPurchaseOrderHeaders()
  const csvFilename = `import_purchase_order_${formatOrderDate(normalizedOrderDate)}.csv`
  const csvRows = items.map((item) => ({
    REF: item.ref,
    'Nombre del articulo': item.name,
    'Nombre de la variante': item.variantName ?? '',
    Cantidad: item.quantity,
    'Purchase cost': item.purchaseCost,
  }))

  const csvPath = await writePurchaseOrderCsv({
    filename: csvFilename,
    headers,
    rows: csvRows,
  })

  const connection = await getConnection()

  try {
    await connection.beginTransaction()

    await connection.execute(
      `UPDATE daily_orders
       SET order_date = ?, csv_filename = ?, csv_path = ?, total_items = ?
       WHERE id = ?`,
      [normalizedOrderDate, csvFilename, csvPath, items.length, orderId],
    )

    await connection.execute(
      'DELETE FROM daily_order_items WHERE daily_order_id = ?',
      [orderId],
    )

    for (const item of items) {
      await connection.execute(
        `INSERT INTO daily_order_items (
          daily_order_id,
          product_id,
          variant_name,
          quantity_ordered,
          purchase_cost
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          item.productId,
          item.variantName ?? '',
          item.quantity,
          item.purchaseCost,
        ],
      )
    }

    await connection.commit()
    return getOrderById(orderId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function regenerateOrderCsv(orderId) {
  const order = await getOrderById(orderId)

  if (!order) {
    return null
  }

  const headers = await getPurchaseOrderHeaders()
  const csvFilename = `import_purchase_order_${formatOrderDate(order.orderDate)}.csv`
  const csvRows = order.items.map((item) => ({
    REF: item.ref,
    'Nombre del articulo': item.name,
    'Nombre de la variante': item.variantName ?? '',
    Cantidad: item.quantityOrdered,
    'Purchase cost': item.purchaseCost,
  }))

  const csvPath = await writePurchaseOrderCsv({
    filename: csvFilename,
    headers,
    rows: csvRows,
  })

  await execute(
    `UPDATE daily_orders
     SET csv_filename = :csvFilename, csv_path = :csvPath
     WHERE id = :orderId`,
    {
      orderId,
      csvFilename,
      csvPath,
    },
  )

  return getOrderById(orderId)
}

export async function closeDailyOrder({ orderId, items }) {
  const order = await getOrderById(orderId)

  if (!order) {
    return null
  }

  if (order.status === 'closed') {
    const error = new Error('El pedido ya fue cerrado.')
    error.statusCode = 409
    throw error
  }

  const orderItemsById = new Map(order.items.map((item) => [item.id, item]))
  const closingItems = items.map((item) => {
    const orderItem = orderItemsById.get(item.orderItemId)

    if (!orderItem) {
      const error = new Error('Hay productos de cierre que no pertenecen al pedido.')
      error.statusCode = 400
      throw error
    }

    const remainingQuantity = Number(item.remainingQuantity)

    if (!Number.isFinite(remainingQuantity) || remainingQuantity < 0) {
      const error = new Error('Las cantidades restantes deben ser números positivos.')
      error.statusCode = 400
      throw error
    }

    if (remainingQuantity > orderItem.quantityOrdered) {
      const error = new Error(
        `La cantidad restante de ${orderItem.name} no puede ser mayor que la pedida.`,
      )
      error.statusCode = 400
      throw error
    }

    const soldQuantity = Math.max(orderItem.quantityOrdered - remainingQuantity, 0)
    const salesAmount = soldQuantity * Number(orderItem.salePrice)

    return {
      orderItemId: orderItem.id,
      remainingQuantity,
      soldQuantity,
      unitSalePrice: Number(orderItem.salePrice),
      salesAmount,
    }
  })

  const totalUnitsSold = closingItems.reduce(
    (sum, item) => sum + item.soldQuantity,
    0,
  )
  const totalSalesAmount = closingItems.reduce(
    (sum, item) => sum + item.salesAmount,
    0,
  )

  const connection = await getConnection()

  try {
    await connection.beginTransaction()

    const closingResult = await connection.execute(
      `INSERT INTO daily_closings (daily_order_id, total_units_sold, total_sales_amount)
       VALUES (?, ?, ?)
       RETURNING id`,
      [orderId, totalUnitsSold, totalSalesAmount],
    )

    for (const item of closingItems) {
      await connection.execute(
        `INSERT INTO daily_closing_items (
          daily_closing_id,
          daily_order_item_id,
          remaining_quantity,
          sold_quantity,
          unit_sale_price,
          sales_amount
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          closingResult.insertId,
          item.orderItemId,
          item.remainingQuantity,
          item.soldQuantity,
          item.unitSalePrice,
          item.salesAmount,
        ],
      )
    }

    await connection.execute(
      `UPDATE daily_orders
       SET status = 'closed'
       WHERE id = ?`,
      [orderId],
    )

    await connection.commit()
    return getOrderById(orderId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getDashboardSummary() {
  const [products] = await query('SELECT COUNT(*)::int AS "totalProducts" FROM products')
  const [orders] = await query('SELECT COUNT(*)::int AS "totalOrders" FROM daily_orders')
  const [openOrders] = await query(
    `SELECT COUNT(*)::int AS "totalOpenOrders"
     FROM daily_orders
     WHERE status = 'open'`,
  )
  const [sales] = await query(
    `SELECT COALESCE(SUM(total_sales_amount), 0) AS "totalSales"
     FROM daily_closings`,
  )

  return {
    totalProducts: products.totalProducts,
    totalOrders: orders.totalOrders,
    totalOpenOrders: openOrders.totalOpenOrders,
    totalSales: sales.totalSales,
  }
}

export async function importProductsFromCsv() {
  return syncProducts(false, false)
}
