import cors from 'cors'
import express from 'express'
import path from 'node:path'
import {
  getAdminSessionToken,
  loginAdminUser,
  logoutAdminUser,
  requireAdminAuth,
} from './adminAuth.js'
import { bootstrapDatabase } from './bootstrap.js'
import { fetchLoyverseReceiptDraft } from './loyverse.js'
import {
  buildInvoicePdf,
  buildMonthlyTimeReportWorkbook,
  buildMonthlyTimeReportPdf,
  closeDailyOrder,
  createClient,
  createInvoice,
  createDailyOrder,
  createEmployee,
  deleteClient,
  deleteEmployee,
  deleteInvoice,
  getDashboardSummary,
  getEmployeeMobileAccessState,
  getInvoicingState,
  getOrderById,
  getSharedTimeTrackingState,
  getTimeTrackingState,
  loginEmployeeMobileAccess,
  importProductsFromLoyverse,
  registerSharedDeviceShift,
  listClients,
  listInvoices,
  listOrders,
  listProducts,
  logoutEmployeeMobileAccess,
  regenerateOrderCsv,
  toggleEmployeeMobileShift,
  toggleEmployeeShift,
  updateClient,
  updateEmployee,
  updateInvoice,
  updateInvoiceStatus,
  updateCompanySettings,
  updateDailyOrder,
  updateProduct,
} from './queries.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)
let databaseBootstrapPromise

function initializeDatabase() {
  if (!databaseBootstrapPromise) {
    databaseBootstrapPromise = bootstrapDatabase().catch((error) => {
      databaseBootstrapPromise = undefined
      throw error
    })
  }

  return databaseBootstrapPromise
}

function isPublicRequest(request) {
  if (request.path === '/api/health' || request.path === '/api/admin/auth/login') {
    return true
  }

  if (request.path.startsWith('/api/mobile/')) {
    return true
  }

  return (
    request.path === '/api/time-tracking/shared' ||
    request.path === '/api/time-tracking/shared/check'
  )
}

app.use(cors())
app.use(express.json())
app.use(async (_request, _response, next) => {
  try {
    await initializeDatabase()
    next()
  } catch (error) {
    next(error)
  }
})
app.use((request, response, next) => {
  if (isPublicRequest(request)) {
    next()
    return
  }

  requireAdminAuth(request, response, next)
})
app.use('/generated-orders', express.static(path.resolve(process.cwd(), 'generated-orders')))

app.get('/api/health', async (_request, response) => {
  response.json({ ok: true })
})

app.post('/api/admin/auth/login', async (request, response, next) => {
  try {
    const { email, password } = request.body

    if (!email || !password) {
      response.status(400).json({
        message: 'Debes indicar correo y contraseña.',
      })
      return
    }

    response.json(
      await loginAdminUser({
        email: `${email}`.trim(),
        password: `${password}`,
      }),
    )
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/auth/logout', async (request, response, next) => {
  try {
    const token = getAdminSessionToken(request)

    if (!token) {
      response.status(400).json({ message: 'Falta el token de sesion.' })
      return
    }

    await logoutAdminUser(token)
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/me', async (request, response) => {
  response.json(request.adminSession)
})

app.get('/api/bootstrap', async (_request, response, next) => {
  try {
    const result = await bootstrapDatabase()
    response.json(result)
  } catch (error) {
    next(error)
  }
})

app.get('/api/summary', async (_request, response, next) => {
  try {
    response.json(await getDashboardSummary())
  } catch (error) {
    next(error)
  }
})

app.get('/api/products', async (request, response, next) => {
  try {
    response.json(await listProducts(request.query.search ?? ''))
  } catch (error) {
    next(error)
  }
})

app.post('/api/products/import', async (_request, response, next) => {
  try {
    response.json(await importProductsFromLoyverse())
  } catch (error) {
    next(error)
  }
})

app.get('/api/time-tracking', async (_request, response, next) => {
  try {
    response.json(await getTimeTrackingState())
  } catch (error) {
    next(error)
  }
})

app.get('/api/time-tracking/shared', async (request, response, next) => {
  try {
    response.json(await getSharedTimeTrackingState(request.query.deviceId))
  } catch (error) {
    next(error)
  }
})

app.get('/api/invoicing', async (_request, response, next) => {
  try {
    response.json(await getInvoicingState())
  } catch (error) {
    next(error)
  }
})

app.get('/api/clients', async (_request, response, next) => {
  try {
    response.json(await listClients())
  } catch (error) {
    next(error)
  }
})

app.post('/api/clients', async (request, response, next) => {
  try {
    const { name, taxId, address, postalCode, city, email, phone } = request.body

    if (!name || !taxId) {
      response.status(400).json({
        message: 'Debes indicar al menos nombre y NIF/CIF del cliente.',
      })
      return
    }

    response.status(201).json(
      await createClient({
        name: `${name}`.trim(),
        taxId: `${taxId}`.trim(),
        address: `${address ?? ''}`.trim(),
        postalCode: `${postalCode ?? ''}`.trim(),
        city: `${city ?? ''}`.trim(),
        email: `${email ?? ''}`.trim(),
        phone: `${phone ?? ''}`.trim(),
      }),
    )
  } catch (error) {
    next(error)
  }
})

app.put('/api/clients/:id', async (request, response, next) => {
  try {
    const { name, taxId, address, postalCode, city, email, phone } = request.body

    if (!name || !taxId) {
      response.status(400).json({
        message: 'Debes indicar al menos nombre y NIF/CIF del cliente.',
      })
      return
    }

    const client = await updateClient(Number(request.params.id), {
      name: `${name}`.trim(),
      taxId: `${taxId}`.trim(),
      address: `${address ?? ''}`.trim(),
      postalCode: `${postalCode ?? ''}`.trim(),
      city: `${city ?? ''}`.trim(),
      email: `${email ?? ''}`.trim(),
      phone: `${phone ?? ''}`.trim(),
    })

    if (!client) {
      response.status(404).json({ message: 'Cliente no encontrado.' })
      return
    }

    response.json(client)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/clients/:id', async (request, response, next) => {
  try {
    const deleted = await deleteClient(Number(request.params.id))

    if (!deleted) {
      response.status(404).json({ message: 'Cliente no encontrado.' })
      return
    }

    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

app.post('/api/time-tracking/employees', async (request, response, next) => {
  try {
    const { name, role, hourlyRate, taxId, socialSecurityNumber, pin, loginCode } =
      request.body

    if (
      !name ||
      !role ||
      !Number.isFinite(Number(hourlyRate)) ||
      Number(hourlyRate) <= 0 ||
      !taxId ||
      !socialSecurityNumber ||
      !loginCode ||
      !pin ||
      `${pin}`.trim().length < 4
    ) {
      response.status(400).json({
        message:
          'Debes indicar nombre, rol, coste por hora, NIF, afiliación, código de acceso y un PIN de al menos 4 dígitos.',
      })
      return
    }

    response.status(201).json(
      await createEmployee({
        name: `${name}`.trim(),
        role: `${role}`.trim(),
        hourlyRate: Number(hourlyRate),
        taxId: `${taxId}`.trim(),
        socialSecurityNumber: `${socialSecurityNumber}`.trim(),
        loginCode: `${loginCode}`.trim().toLowerCase(),
        pin: `${pin}`.trim(),
      }),
    )
  } catch (error) {
    next(error)
  }
})

app.put('/api/time-tracking/employees/:id', async (request, response, next) => {
  try {
    const {
      name,
      role,
      hourlyRate,
      taxId,
      socialSecurityNumber,
      pin,
      loginCode,
      mobileAccessEnabled,
    } = request.body

    if (
      !name ||
      !role ||
      !Number.isFinite(Number(hourlyRate)) ||
      Number(hourlyRate) <= 0 ||
      !taxId ||
      !socialSecurityNumber ||
      !loginCode
    ) {
      response.status(400).json({
        message:
          'Debes indicar nombre, rol, coste por hora, NIF, afiliación y código de acceso válidos.',
      })
      return
    }

    const employee = await updateEmployee(Number(request.params.id), {
      name: `${name}`.trim(),
      role: `${role}`.trim(),
      hourlyRate: Number(hourlyRate),
      taxId: `${taxId}`.trim(),
      socialSecurityNumber: `${socialSecurityNumber}`.trim(),
      loginCode: `${loginCode}`.trim().toLowerCase(),
      mobileAccessEnabled: Boolean(mobileAccessEnabled),
      pin: pin ? `${pin}`.trim() : '',
    })

    if (!employee) {
      response.status(404).json({ message: 'Empleado no encontrado.' })
      return
    }

    response.json(employee)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/time-tracking/employees/:id', async (request, response, next) => {
  try {
    const deleted = await deleteEmployee(Number(request.params.id))

    if (!deleted) {
      response.status(404).json({ message: 'Empleado no encontrado.' })
      return
    }

    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

app.put('/api/time-tracking/company-settings', async (request, response, next) => {
  try {
    const {
      companyName,
      companyTaxId,
      workplace,
      contributionAccountCode,
      address,
      postalCode,
      city,
      phone,
      email,
      bankName,
      bankIban,
    } = request.body

    if (!companyName || !companyTaxId || !workplace || !contributionAccountCode) {
      response.status(400).json({
        message: 'Debes indicar todos los datos de empresa para el informe mensual.',
      })
      return
    }

    response.json(
      await updateCompanySettings({
        companyName: `${companyName}`.trim(),
        companyTaxId: `${companyTaxId}`.trim(),
        workplace: `${workplace}`.trim(),
        contributionAccountCode: `${contributionAccountCode}`.trim(),
        address: `${address ?? ''}`.trim(),
        postalCode: `${postalCode ?? ''}`.trim(),
        city: `${city ?? ''}`.trim(),
        phone: `${phone ?? ''}`.trim(),
        email: `${email ?? ''}`.trim(),
        bankName: `${bankName ?? ''}`.trim(),
        bankIban: `${bankIban ?? ''}`.trim(),
      }),
    )
  } catch (error) {
    next(error)
  }
})

app.post('/api/time-tracking/shifts/toggle', async (request, response, next) => {
  try {
    const { employeeId, pin } = request.body

    if (!employeeId || !pin) {
      response.status(400).json({
        message: 'Debes indicar el empleado y su PIN para fichar.',
      })
      return
    }

    response.json(
      await toggleEmployeeShift({
        employeeId: Number(employeeId),
        pin: `${pin}`.trim(),
      }),
    )
  } catch (error) {
    next(error)
  }
})

app.post('/api/time-tracking/shared/check', async (request, response, next) => {
  try {
    const { employeeId, pin, qrToken, deviceId } = request.body

    if (!employeeId) {
      response.status(400).json({
        message: 'Debes indicar el empleado que realiza el fichaje.',
      })
      return
    }

    response.json(
      await registerSharedDeviceShift({
        employeeId,
        pin: `${pin ?? ''}`,
        qrToken: `${qrToken ?? ''}`,
        deviceId: `${deviceId ?? ''}`,
      }),
    )
  } catch (error) {
    next(error)
  }
})

function getBearerToken(request) {
  const authorization = request.headers.authorization ?? ''

  if (!authorization.startsWith('Bearer ')) {
    return ''
  }

  return authorization.slice('Bearer '.length).trim()
}

app.post('/api/mobile/auth/login', async (request, response, next) => {
  try {
    const { loginCode, pin } = request.body

    if (!loginCode || !pin) {
      response.status(400).json({
        message: 'Debes indicar código de acceso y PIN.',
      })
      return
    }

    response.json(
      await loginEmployeeMobileAccess({
        loginCode: `${loginCode}`.trim().toLowerCase(),
        pin: `${pin}`.trim(),
      }),
    )
  } catch (error) {
    next(error)
  }
})

app.post('/api/mobile/auth/logout', async (request, response, next) => {
  try {
    const token = getBearerToken(request)

    if (!token) {
      response.status(400).json({ message: 'Falta el token de sesión móvil.' })
      return
    }

    await logoutEmployeeMobileAccess(token)
    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

app.get('/api/mobile/me', async (request, response, next) => {
  try {
    const token = getBearerToken(request)

    if (!token) {
      response.status(401).json({ message: 'Falta el token de sesión móvil.' })
      return
    }

    response.json(await getEmployeeMobileAccessState(token))
  } catch (error) {
    next(error)
  }
})

app.post('/api/mobile/shifts/toggle', async (request, response, next) => {
  try {
    const token = getBearerToken(request)

    if (!token) {
      response.status(401).json({ message: 'Falta el token de sesión móvil.' })
      return
    }

    response.json(await toggleEmployeeMobileShift(token))
  } catch (error) {
    next(error)
  }
})

app.get('/api/time-tracking/reports/monthly.pdf', async (request, response, next) => {
  try {
    const { employeeId, month } = request.query

    if (!employeeId || !month) {
      response.status(400).json({
        message: 'Debes indicar empleado y mes para generar el PDF.',
      })
      return
    }

    const pdfBuffer = await buildMonthlyTimeReportPdf({
      employeeId: Number(employeeId),
      month: `${month}`.slice(0, 7),
    })

    if (!pdfBuffer) {
      response.status(404).json({ message: 'Empleado no encontrado.' })
      return
    }

    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader(
      'Content-Disposition',
      `inline; filename="registro-jornada-${employeeId}-${month}.pdf"`,
    )
    response.send(pdfBuffer)
  } catch (error) {
    next(error)
  }
})

app.get('/api/time-tracking/reports/monthly.xlsx', async (request, response, next) => {
  try {
    const { employeeId, month } = request.query

    if (!employeeId || !month) {
      response.status(400).json({
        message: 'Debes indicar empleado y mes para generar el Excel.',
      })
      return
    }

    const workbookBuffer = await buildMonthlyTimeReportWorkbook({
      employeeId: Number(employeeId),
      month: `${month}`.slice(0, 7),
    })

    if (!workbookBuffer) {
      response.status(404).json({ message: 'Empleado no encontrado.' })
      return
    }

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="registro-jornada-${employeeId}-${month}.xlsx"`,
    )
    response.send(Buffer.from(workbookBuffer))
  } catch (error) {
    next(error)
  }
})

app.get('/api/invoices', async (_request, response, next) => {
  try {
    response.json(await listInvoices())
  } catch (error) {
    next(error)
  }
})

app.get('/api/invoices/loyverse/:receiptNumber', async (request, response, next) => {
  try {
    response.json(await fetchLoyverseReceiptDraft(request.params.receiptNumber))
  } catch (error) {
    next(error)
  }
})

app.post('/api/invoices', async (request, response, next) => {
  try {
    const {
      issueDate,
      dueDate,
      clientId,
      clientName,
      taxId,
      clientAddress,
      clientPostalCode,
      clientCity,
      clientEmail,
      clientPhone,
      status,
      notes,
      vatRate,
      paymentByTransfer,
      items,
    } = request.body

    if (!issueDate || !dueDate || !clientName || !Array.isArray(items) || items.length === 0) {
      response.status(400).json({
        message: 'Debes indicar fechas, cliente y al menos una línea de factura.',
      })
      return
    }

    response.status(201).json(
      await createInvoice({
        issueDate,
        dueDate,
        clientId: clientId || null,
        clientName: `${clientName}`.trim(),
        taxId: `${taxId ?? ''}`.trim(),
        clientAddress: `${clientAddress ?? ''}`.trim(),
        clientPostalCode: `${clientPostalCode ?? ''}`.trim(),
        clientCity: `${clientCity ?? ''}`.trim(),
        clientEmail: `${clientEmail ?? ''}`.trim(),
        clientPhone: `${clientPhone ?? ''}`.trim(),
        status: `${status ?? 'pendiente'}`.trim(),
        notes: `${notes ?? ''}`.trim(),
        vatRate: Number(vatRate ?? 21),
        paymentByTransfer: Boolean(paymentByTransfer),
        items,
      }),
    )
  } catch (error) {
    next(error)
  }
})

app.put('/api/invoices/:id', async (request, response, next) => {
  try {
    const {
      dueDate,
      clientId,
      clientName,
      taxId,
      clientAddress,
      clientPostalCode,
      clientCity,
      clientEmail,
      clientPhone,
      status,
      notes,
      vatRate,
      paymentByTransfer,
      items,
    } = request.body

    if (!dueDate || !clientName || !Array.isArray(items) || items.length === 0) {
      response.status(400).json({
        message: 'Debes indicar vencimiento, cliente y al menos una línea de factura.',
      })
      return
    }

    const invoice = await updateInvoice(Number(request.params.id), {
      dueDate,
      clientId: clientId || null,
      clientName: `${clientName}`.trim(),
      taxId: `${taxId ?? ''}`.trim(),
      clientAddress: `${clientAddress ?? ''}`.trim(),
      clientPostalCode: `${clientPostalCode ?? ''}`.trim(),
      clientCity: `${clientCity ?? ''}`.trim(),
      clientEmail: `${clientEmail ?? ''}`.trim(),
      clientPhone: `${clientPhone ?? ''}`.trim(),
      status: `${status ?? 'pendiente'}`.trim(),
      notes: `${notes ?? ''}`.trim(),
      vatRate: Number(vatRate ?? 21),
      paymentByTransfer: Boolean(paymentByTransfer),
      items,
    })

    if (!invoice) {
      response.status(404).json({ message: 'Factura no encontrada.' })
      return
    }

    response.json(invoice)
  } catch (error) {
    next(error)
  }
})

app.put('/api/invoices/:id/status', async (request, response, next) => {
  try {
    const { status } = request.body

    if (!status) {
      response.status(400).json({
        message: 'Debes indicar el estado de la factura.',
      })
      return
    }

    const invoice = await updateInvoiceStatus({
      invoiceId: Number(request.params.id),
      status: `${status}`.trim(),
    })

    if (!invoice) {
      response.status(404).json({ message: 'Factura no encontrada.' })
      return
    }

    response.json(invoice)
  } catch (error) {
    next(error)
  }
})

app.get('/api/invoices/:id/pdf', async (request, response, next) => {
  try {
    const pdfBuffer = await buildInvoicePdf(Number(request.params.id))

    if (!pdfBuffer) {
      response.status(404).json({ message: 'Factura no encontrada.' })
      return
    }

    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader(
      'Content-Disposition',
      `inline; filename="factura-${request.params.id}.pdf"`,
    )
    response.send(pdfBuffer)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/invoices/:id', async (request, response, next) => {
  try {
    const deleted = await deleteInvoice(Number(request.params.id))

    if (!deleted) {
      response.status(404).json({ message: 'Factura no encontrada.' })
      return
    }

    response.status(204).send()
  } catch (error) {
    next(error)
  }
})

app.get('/api/orders', async (_request, response, next) => {
  try {
    response.json(
      await listOrders({
        status: _request.query.status ?? 'all',
        dateFrom: _request.query.dateFrom ?? '',
        dateTo: _request.query.dateTo ?? '',
      }),
    )
  } catch (error) {
    next(error)
  }
})

app.put('/api/products/:id', async (request, response, next) => {
  try {
    const { name, category, purchaseCost, salePrice, availableForSale } =
      request.body

    if (
      !name ||
      !Number.isFinite(Number(purchaseCost)) ||
      Number(purchaseCost) < 0 ||
      !Number.isFinite(Number(salePrice)) ||
      Number(salePrice) < 0
    ) {
      response.status(400).json({
        message: 'Debes indicar un nombre y precios válidos para el producto.',
      })
      return
    }

    const product = await updateProduct(request.params.id, {
      name,
      category,
      purchaseCost: Number(purchaseCost),
      salePrice: Number(salePrice),
      availableForSale: Boolean(availableForSale),
    })

    if (!product) {
      response.status(404).json({ message: 'Producto no encontrado.' })
      return
    }

    response.json(product)
  } catch (error) {
    next(error)
  }
})

app.get('/api/orders/:id', async (request, response, next) => {
  try {
    const order = await getOrderById(request.params.id)

    if (!order) {
      response.status(404).json({ message: 'Pedido no encontrado.' })
      return
    }

    response.json(order)
  } catch (error) {
    next(error)
  }
})

app.post('/api/orders', async (request, response, next) => {
  try {
    const { orderDate, items } = request.body

    if (!orderDate || !Array.isArray(items) || items.length === 0) {
      response.status(400).json({
        message: 'Debes indicar una fecha y al menos un producto para el pedido.',
      })
      return
    }

    const hasInvalidItems = items.some(
      (item) =>
        !item.productId ||
        !Number.isFinite(Number(item.quantity)) ||
        Number(item.quantity) <= 0 ||
        !Number.isFinite(Number(item.purchaseCost)) ||
        Number(item.purchaseCost) < 0,
    )

    if (hasInvalidItems) {
      response.status(400).json({
        message:
          'Todos los productos del pedido deben tener cantidad positiva y costo de compra válido.',
      })
      return
    }

    response.status(201).json(await createDailyOrder({ orderDate, items }))
  } catch (error) {
    next(error)
  }
})

app.put('/api/orders/:id', async (request, response, next) => {
  try {
    const { orderDate, items } = request.body

    if (!orderDate || !Array.isArray(items) || items.length === 0) {
      response.status(400).json({
        message: 'Debes indicar una fecha y al menos un producto para el pedido.',
      })
      return
    }

    const hasInvalidItems = items.some(
      (item) =>
        !item.productId ||
        !Number.isFinite(Number(item.quantity)) ||
        Number(item.quantity) <= 0 ||
        !Number.isFinite(Number(item.purchaseCost)) ||
        Number(item.purchaseCost) < 0,
    )

    if (hasInvalidItems) {
      response.status(400).json({
        message:
          'Todos los productos del pedido deben tener cantidad positiva y costo de compra válido.',
      })
      return
    }

    const order = await updateDailyOrder({
      orderId: request.params.id,
      orderDate,
      items,
    })

    if (!order) {
      response.status(404).json({ message: 'Pedido no encontrado.' })
      return
    }

    response.json(order)
  } catch (error) {
    next(error)
  }
})

app.post('/api/orders/:id/regenerate-csv', async (request, response, next) => {
  try {
    const order = await regenerateOrderCsv(request.params.id)

    if (!order) {
      response.status(404).json({ message: 'Pedido no encontrado.' })
      return
    }

    response.json(order)
  } catch (error) {
    next(error)
  }
})

app.post('/api/orders/:id/close', async (request, response, next) => {
  try {
    const { items } = request.body

    if (!Array.isArray(items) || items.length === 0) {
      response.status(400).json({
        message: 'Debes indicar las cantidades restantes para cerrar el pedido.',
      })
      return
    }

    const order = await closeDailyOrder({
      orderId: request.params.id,
      items,
    })

    if (!order) {
      response.status(404).json({ message: 'Pedido no encontrado.' })
      return
    }

    response.json(order)
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  void _next
  const statusCode = error.statusCode ?? 500
  response.status(statusCode).json({
    message:
      error.code === 'ER_DUP_ENTRY'
        ? 'Ya existe un pedido para esa fecha.'
        : error.message ?? 'Se produjo un error inesperado.',
  })
})

if (!process.env.VERCEL) {
  initializeDatabase()
    .then((result) => {
      console.log('Base preparada:', result)
      app.listen(port, () => {
        console.log(`Servidor listo en http://localhost:${port}`)
      })
    })
    .catch((error) => {
      console.error('No fue posible iniciar la aplicación:', error)
      process.exit(1)
    })
}

export default app
