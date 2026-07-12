import { useEffect, useMemo, useState } from 'react'
import './App.css'
import AdminLoginScreen from './components/AdminLoginScreen'
import ClientEditor from './components/ClientEditor'
import ConfirmDialog from './components/ConfirmDialog'
import EmployeeEditor from './components/EmployeeEditor'
import InvoiceEditor from './components/InvoiceEditor'
import LoadingOverlay from './components/LoadingOverlay'
import OrderPreviewDialog from './components/OrderPreviewDialog'
import ProductEditor from './components/ProductEditor'
import SidebarNavigation from './components/SidebarNavigation'
import {
  getModuleBySection,
  getSectionById,
  navigationHomeItem,
  navigationModules,
} from './constants/navigation'
import {
  bootstrapApp,
  closeOrder,
  createClientRecord,
  createOrder,
  createEmployeeRecord,
  createInvoiceRecord,
  deleteClientRecord,
  deleteEmployeeRecord,
  deleteInvoiceRecord,
  fetchAdminSession,
  fetchInvoicingState,
  fetchOrder,
  fetchOrders,
  fetchProducts,
  fetchSummary,
  fetchTimeTrackingState,
  importProducts,
  getStoredAdminSessionState,
  loginAdminSession,
  logoutAdminSession,
  regenerateOrderCsv,
  setAuthSession,
  toggleEmployeeShiftRecord,
  updateClientRecord,
  updateCompanySettingsRecord,
  updateEmployeeRecord,
  updateInvoiceRecord,
  updateInvoiceStatusRecord,
  updateOrder,
  updateProduct,
} from './lib/api'
import {
  formatCurrency,
  formatDate,
  getPrintDate,
  getToday,
} from './lib/formatters'
import { showErrorToast, showInfoToast, showSuccessToast } from './lib/toast'
import ClosingPage from './pages/ClosingPage'
import DailyOrderPage from './pages/DailyOrderPage'
import EmployeeTimePage from './pages/EmployeeTimePage'
import CompanyMaintenancePage from './pages/CompanyMaintenancePage'
import HomePage from './pages/HomePage'
import InvoicingPage from './pages/InvoicingPage'
import OrdersPage from './pages/OrdersPage'
import ProductsPage from './pages/ProductsPage'

const initialOrderFilters = {
  status: 'all',
  dateFrom: '',
  dateTo: '',
}

const defaultCompanySettings = {
  companyName: 'DOELIA CONCEPCION SANGUINA DUARTE',
  companyTaxId: '55164584F',
  workplace: 'OBRADOR ROIG',
  contributionAccountCode: '08/2366143/48',
  address: 'Av. Catalunya 24',
  postalCode: '08757',
  city: 'Corbera de Llobregat',
  phone: '930 327 905 - 691 966 747' ,
  email: 'obradorcafeteria@gmail.com',
  bankName: '',
  bankIban: '',
}

function getShiftHours(shift) {
  if (!shift?.startedAt) {
    return 0
  }

  const start = new Date(shift.startedAt)
  const end = new Date(shift.endedAt ?? new Date().toISOString())
  const diff = end.getTime() - start.getTime()

  if (Number.isNaN(diff) || diff <= 0) {
    return 0
  }

  return diff / (1000 * 60 * 60)
}

function roundHours(value) {
  return Math.round(value * 100) / 100
}

function App() {
  const storedAdminSession = getStoredAdminSessionState()
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalOpenOrders: 0,
    totalSales: 0,
  })
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [productSearch, setProductSearch] = useState('')
  const [productSort, setProductSort] = useState({
    column: 'name',
    direction: 'asc',
  })
  const [orderDate, setOrderDate] = useState(getToday())
  const [activeSection, setActiveSection] = useState('home')
  const [draftItems, setDraftItems] = useState([])
  const [editingOrder, setEditingOrder] = useState(null)
  const [closingDraft, setClosingDraft] = useState({})
  const [loading, setLoading] = useState(
    storedAdminSession.hasToken && !storedAdminSession.isExpired,
  )
  const [authStatus, setAuthStatus] = useState(
    storedAdminSession.hasToken && !storedAdminSession.isExpired
      ? 'checking'
      : 'anonymous',
  )
  const [adminSession, setAdminSession] = useState(null)
  const [authError, setAuthError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [isClosingOrder, setIsClosingOrder] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [isSavingClient, setIsSavingClient] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [isSavingInvoice, setIsSavingInvoice] = useState(false)
  const [isImportingProducts, setIsImportingProducts] = useState(false)
  const [orderFilters, setOrderFilters] = useState(initialOrderFilters)
  const [previewOrder, setPreviewOrder] = useState(null)
  const [employees, setEmployees] = useState([])
  const [employeeShifts, setEmployeeShifts] = useState([])
  const [clients, setClients] = useState([])
  const [invoices, setInvoices] = useState([])
  const [companySettings, setCompanySettings] = useState(defaultCompanySettings)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Aceptar',
    tone: 'default',
    action: null,
  })

  useEffect(() => {
    let cancelled = false

    if (authStatus !== 'checking') {
      return () => {
        cancelled = true
      }
    }

    async function restoreSession() {
      try {
        const session = await fetchAdminSession()

        if (cancelled) {
          return
        }

        setAdminSession(session)
        setAuthStatus('authenticated')
      } catch {
        if (cancelled) {
          return
        }

        setAuthSession('', '')
        setAdminSession(null)
        setAuthStatus('anonymous')
        setLoading(false)
      }
    }

    restoreSession()

    return () => {
      cancelled = true
    }
  }, [authStatus, storedAdminSession.hasToken, storedAdminSession.isExpired])

  useEffect(() => {
    function handleUnauthorized() {
      setAuthSession('', '')
      setAdminSession(null)
      setAuthStatus('anonymous')
      setAuthError('Tu sesión ha caducado. Vuelve a iniciar sesión.')
      setLoading(false)
    }

    window.addEventListener('app:unauthorized', handleUnauthorized)

    return () => {
      window.removeEventListener('app:unauthorized', handleUnauthorized)
    }
  }, [])

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return
    }

    async function initialize() {
      try {
        setLoading(true)
        await bootstrapApp()
        const [summaryData, ordersData, initialProducts, timeTrackingData, invoicingData] = await Promise.all([
          fetchSummary(),
          fetchOrders(initialOrderFilters),
          fetchProducts(''),
          fetchTimeTrackingState(),
          fetchInvoicingState(),
        ])
        setSummary(summaryData)
        setOrders(ordersData)
        setProducts(initialProducts)
        setEmployees(timeTrackingData.employees ?? [])
        setEmployeeShifts(timeTrackingData.shifts ?? [])
        setCompanySettings(timeTrackingData.companySettings ?? defaultCompanySettings)
        setClients(invoicingData.clients ?? [])
        setInvoices(invoicingData.invoices ?? [])
      } catch (loadError) {
        showErrorToast(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [authStatus])

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      return
    }

    async function loadOrdersByFilters() {
      try {
        const [summaryData, ordersData] = await Promise.all([
          fetchSummary(),
          fetchOrders(orderFilters),
        ])
        setSummary(summaryData)
        setOrders(ordersData)
      } catch (loadError) {
        showErrorToast(loadError.message)
      }
    }

    if (!loading) {
      loadOrdersByFilters()
    }
  }, [authStatus, orderFilters, loading])

  async function handleAdminLogin(credentials) {
    setIsAuthenticating(true)
    setAuthError('')
    setLoading(true)

    try {
      const session = await loginAdminSession(credentials)
      setAuthSession(session.token, session.expiresAt)
      setAdminSession(session)
      setAuthStatus('authenticated')
    } catch (error) {
      setAuthError(error.message)
      setLoading(false)
    } finally {
      setIsAuthenticating(false)
    }
  }

  async function handleAdminLogout() {
    try {
      await logoutAdminSession()
    } catch {
      // Si el backend ya invalido la sesion, limpiamos el estado local igualmente.
    } finally {
      setAuthSession('', '')
      setAdminSession(null)
      setAuthStatus('anonymous')
      setActiveSection('home')
      setLoading(false)
    }
  }

  function updateOrderProductQuantity(product, quantity) {
    const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0

    setDraftItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.productId === product.id)

      if (normalizedQuantity <= 0) {
        return currentItems.filter((item) => item.productId !== product.id)
      }

      if (existingItem) {
        return currentItems.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: normalizedQuantity,
              }
            : item,
        )
      }

      return [
        ...currentItems,
        {
          productId: product.id,
          ref: product.ref,
          name: product.name,
          category: product.category,
          quantity: normalizedQuantity,
          purchaseCost: Number(product.purchaseCost ?? 0),
          salePrice: Number(product.salePrice ?? 0),
          variantName: '',
        },
      ]
    })
  }

  function resetOrderEditor() {
    setEditingOrder(null)
    setDraftItems([])
    setOrderDate(getToday())
  }

  function updateOrderFilters(field, value) {
    setOrderFilters((current) => ({ ...current, [field]: value }))
  }

  function updateClosingDraft(orderItemId, value) {
    setClosingDraft((currentDraft) => ({
      ...currentDraft,
      [orderItemId]: value,
    }))
  }

  async function submitCreateOrder() {
    setIsSavingOrder(true)

    try {
      const activeProductIds = new Set(
        products
          .filter((product) => product.availableForSale)
          .map((product) => product.id),
      )
      const visibleDraftItems = editingOrder
        ? draftItems
        : draftItems.filter((item) => activeProductIds.has(item.productId))
      const payload = {
        orderDate,
        items: visibleDraftItems.map((item) => ({
          productId: item.productId,
          ref: item.ref,
          name: item.name,
          quantity: Number(item.quantity),
          purchaseCost: Number(item.purchaseCost),
          variantName: item.variantName,
        })),
      }
      const order = editingOrder
        ? await updateOrder(editingOrder.id, payload)
        : await createOrder(payload)

      const [summaryData, ordersData] = await Promise.all([
        fetchSummary(),
        fetchOrders(orderFilters),
      ])
      setSummary(summaryData)
      setOrders(ordersData)
      setSelectedOrder(order)
      setActiveSection('orders')
      setClosingDraft({})
      resetOrderEditor()
      showSuccessToast(
        editingOrder
          ? `Pedido actualizado para ${formatDate(order.orderDate)}.`
          : `Pedido generado para ${formatDate(order.orderDate)} y CSV ${order.csvFilename}.`,
      )
    } catch (saveError) {
      showErrorToast(saveError.message)
    } finally {
      setIsSavingOrder(false)
    }
  }

  function handleCreateOrder(event) {
    event.preventDefault()

    setConfirmDialog({
      open: true,
      title: editingOrder ? 'Guardar cambios del pedido' : 'Generar pedido diario',
      description: editingOrder
        ? 'Se actualizará el pedido abierto y se regenerará su CSV con los cambios realizados.'
        : 'Se guardará el pedido en la base de datos y se generará el CSV correspondiente para esta fecha.',
      confirmLabel: editingOrder ? 'Guardar cambios' : 'Generar pedido',
      tone: 'default',
      action: submitCreateOrder,
    })
  }

  async function handleEditOrder(orderId) {
    try {
      const order = await fetchOrder(orderId)

      if (order.status !== 'open') {
        showErrorToast('Solo se pueden editar pedidos abiertos.')
        return
      }

      const inactiveItemsCount = order.items.filter(
        (item) =>
          !products.some(
            (product) =>
              product.id === item.productId && product.availableForSale,
          ),
      ).length

      setEditingOrder({
        id: order.id,
        csvFilename: order.csvFilename,
        inactiveItemsCount,
      })
      setOrderDate(order.orderDate)

      setDraftItems(
        order.items.map((item) => ({
          productId: item.productId,
          ref: item.ref,
          name: item.name,
          category: item.category,
          quantity: Number(item.quantityOrdered),
          purchaseCost: Number(item.purchaseCost ?? 0),
          salePrice: Number(item.salePrice ?? 0),
          variantName: item.variantName ?? '',
        })),
      )
      setActiveSection('daily-order')
      if (inactiveItemsCount > 0) {
        showInfoToast(
          `Editando pedido del ${formatDate(order.orderDate)}. ${inactiveItemsCount} producto(s) del pedido están inactivos, pero siguen visibles para editar.`,
        )
      } else {
        showInfoToast(`Editando pedido del ${formatDate(order.orderDate)}.`)
      }
    } catch (loadError) {
      showErrorToast(loadError.message)
    }
  }

  async function handleSelectOrder(orderId) {
    try {
      const order = await fetchOrder(orderId)
      setSelectedOrder(order)
      setActiveSection(order.status === 'closed' ? 'closing' : 'orders')

      const initialClosingDraft = {}
      order.items.forEach((item) => {
        initialClosingDraft[item.id] = item.remainingQuantity ?? item.quantityOrdered
      })

      setClosingDraft(initialClosingDraft)
    } catch (loadError) {
      showErrorToast(loadError.message)
    }
  }

  async function handlePreviewOrder(orderId) {
    try {
      const order = await fetchOrder(orderId)
      setPreviewOrder(order)
    } catch (loadError) {
      showErrorToast(loadError.message)
    }
  }

  async function handleRegenerateOrderCsv(orderId) {
    try {
      const order = await regenerateOrderCsv(orderId)

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id
            ? {
                ...currentOrder,
                csvFilename: order.csvFilename,
                csvUrl: order.csvUrl,
              }
            : currentOrder,
        ),
      )
      setSelectedOrder((currentOrder) =>
        currentOrder?.id === order.id ? order : currentOrder,
      )
      setPreviewOrder((currentOrder) =>
        currentOrder?.id === order.id ? order : currentOrder,
      )
      showSuccessToast(`CSV regenerado para ${formatDate(order.orderDate)}.`)
    } catch (loadError) {
      showErrorToast(loadError.message)
    }
  }

  async function handleStartClosingOrder(orderId) {
    try {
      const order = await fetchOrder(orderId)

      if (order.status !== 'open') {
        showErrorToast('Solo se pueden cerrar pedidos abiertos.')
        return
      }

      setSelectedOrder(order)
      setClosingDraft(
        order.items.reduce((draft, item) => {
          draft[item.id] = item.remainingQuantity ?? item.quantityOrdered
          return draft
        }, {}),
      )
      setActiveSection('closing')
      showInfoToast(`Preparado cierre para ${formatDate(order.orderDate)}.`)
    } catch (loadError) {
      showErrorToast(loadError.message)
    }
  }

  async function submitCloseOrder() {
    if (!selectedOrder) {
      return
    }

    setIsClosingOrder(true)

    try {
      const order = await closeOrder(selectedOrder.id, {
        items: selectedOrder.items.map((item) => ({
          orderItemId: item.id,
          remainingQuantity: Number(closingDraft[item.id] ?? item.quantityOrdered),
        })),
      })

      setSelectedOrder(order)
      const [summaryData, ordersData] = await Promise.all([
        fetchSummary(),
        fetchOrders(orderFilters),
      ])
      setSummary(summaryData)
      setOrders(ordersData)
      setActiveSection('closing')
      showSuccessToast(`Cierre registrado para ${formatDate(order.orderDate)}.`)
    } catch (closeError) {
      showErrorToast(closeError.message)
    } finally {
      setIsClosingOrder(false)
    }
  }

  function handleCloseOrder(event) {
    event.preventDefault()

    if (!selectedOrder) {
      return
    }

    setConfirmDialog({
      open: true,
      title: 'Cerrar el día',
      description:
        'Se guardarán las cantidades restantes y se calcularán las ventas del pedido seleccionado.',
      confirmLabel: 'Cerrar día',
      tone: 'danger',
      action: submitCloseOrder,
    })
  }

  async function handleSaveProduct(form) {
    if (!editingProduct) {
      return
    }

    setIsSavingProduct(true)

    try {
      const updatedProduct = await updateProduct(editingProduct.id, form)

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === updatedProduct.id ? updatedProduct : product,
        ),
      )
      setDraftItems((currentItems) =>
        currentItems
          .map((item) =>
            item.productId === updatedProduct.id
              ? {
                  ...item,
                  name: updatedProduct.name,
                  category: updatedProduct.category,
                  purchaseCost: Number(updatedProduct.purchaseCost ?? 0),
                  salePrice: Number(updatedProduct.salePrice ?? 0),
                }
              : item,
          )
          .filter(
            (item) =>
              item.productId !== updatedProduct.id ||
              updatedProduct.availableForSale ||
              Number(item.quantity) > 0,
          ),
      )
      setSelectedOrder((currentOrder) => {
        if (!currentOrder) {
          return currentOrder
        }

        return {
          ...currentOrder,
          items: currentOrder.items.map((item) =>
            item.productId === updatedProduct.id
              ? {
                  ...item,
                  name: updatedProduct.name,
                  category: updatedProduct.category,
                  salePrice: Number(updatedProduct.salePrice ?? 0),
                }
              : item,
          ),
        }
      })
      setEditingProduct(null)
      showSuccessToast(`Producto ${updatedProduct.ref} actualizado.`)
    } catch (saveError) {
      showErrorToast(saveError.message)
    } finally {
      setIsSavingProduct(false)
    }
  }

  async function handleToggleProductStatus(product) {
    try {
      const updatedProduct = await updateProduct(product.id, {
        name: product.name,
        category: product.category,
        purchaseCost: Number(product.purchaseCost ?? 0),
        salePrice: Number(product.salePrice ?? 0),
        availableForSale: !product.availableForSale,
      })

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) =>
          currentProduct.id === updatedProduct.id ? updatedProduct : currentProduct,
        ),
      )
      setDraftItems((currentItems) =>
        currentItems
          .map((item) =>
            item.productId === updatedProduct.id
              ? {
                  ...item,
                  name: updatedProduct.name,
                  category: updatedProduct.category,
                  purchaseCost: Number(updatedProduct.purchaseCost ?? 0),
                  salePrice: Number(updatedProduct.salePrice ?? 0),
                }
              : item,
          )
          .filter(
            (item) =>
              item.productId !== updatedProduct.id ||
              updatedProduct.availableForSale ||
              Number(item.quantity) > 0,
          ),
      )
      showSuccessToast(
        `${updatedProduct.name} ahora está ${
          updatedProduct.availableForSale ? 'activo' : 'inactivo'
        }.`,
      )
    } catch (saveError) {
      showErrorToast(saveError.message)
    }
  }

  async function submitImportProducts() {
    setIsImportingProducts(true)

    try {
      const result = await importProducts()
      const [summaryData, productsData] = await Promise.all([
        fetchSummary(),
        fetchProducts(''),
      ])
      setSummary(summaryData)
      setProducts(productsData)
      const productsById = new Map(productsData.map((product) => [product.id, product]))
      setDraftItems((currentItems) =>
        currentItems
          .map((item) => {
            const product = productsById.get(item.productId)

            if (!product) {
              return null
            }

            if (!product.availableForSale && Number(item.quantity) <= 0) {
              return null
            }

            return {
              ...item,
              ref: product.ref,
              name: product.name,
              category: product.category,
              purchaseCost: Number(product.purchaseCost ?? 0),
              salePrice: Number(product.salePrice ?? 0),
            }
          })
          .filter(Boolean),
      )
      showSuccessToast(
        `Catálogo actualizado desde Loyverse. ${result.inserted ?? 0} producto(s) nuevos y ${result.updated ?? 0} actualizado(s).`,
      )
    } catch (importError) {
      showErrorToast(importError.message)
    } finally {
      setIsImportingProducts(false)
    }
  }

  function handleImportProducts() {
    setConfirmDialog({
      open: true,
      title: 'Importar catálogo desde Loyverse',
      description:
        'Se actualizarán productos y precios directamente desde Loyverse. Los productos actuales conservarán su estado activo o inactivo, y los nuevos quedarán activos por defecto.',
      confirmLabel: 'Importar catálogo',
      tone: 'default',
      action: submitImportProducts,
    })
  }

  async function handleAddEmployee(form) {
    const normalizedName = form.name.trim()
    const normalizedRole = form.role.trim()
    const normalizedRate = Number(form.hourlyRate)
    const normalizedTaxId = form.taxId.trim()
    const normalizedSocialSecurityNumber = form.socialSecurityNumber.trim()
    const normalizedLoginCode = form.loginCode.trim().toLowerCase()
    const normalizedPin = form.pin.trim()

    if (
      !normalizedName ||
      !normalizedRole ||
      normalizedRate <= 0 ||
      !normalizedTaxId ||
      !normalizedSocialSecurityNumber ||
      !normalizedLoginCode ||
      normalizedPin.length < 4
    ) {
      showErrorToast(
        'Completa nombre, rol, coste por hora, NIF, afiliación, código de acceso y un PIN de al menos 4 dígitos.',
      )
      return false
    }

    const employee = {
      name: normalizedName,
      role: normalizedRole,
      hourlyRate: normalizedRate,
      taxId: normalizedTaxId,
      socialSecurityNumber: normalizedSocialSecurityNumber,
      loginCode: normalizedLoginCode,
      pin: normalizedPin,
    }

    try {
      const createdEmployee = await createEmployeeRecord(employee)
      setEmployees((current) =>
        [...current, createdEmployee].sort((left, right) =>
          left.name.localeCompare(right.name, 'es-ES'),
        ),
      )
      showSuccessToast(`Empleado ${createdEmployee.name} creado.`)
      return true
    } catch (error) {
      showErrorToast(error.message)
      return false
    }
  }

  async function handleUpdateCompanySettings(form) {
    try {
      const settings = await updateCompanySettingsRecord({
        companyName: form.companyName.trim(),
        companyTaxId: form.companyTaxId.trim(),
        workplace: form.workplace.trim(),
        contributionAccountCode: form.contributionAccountCode.trim(),
        address: form.address.trim(),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        bankName: form.bankName.trim(),
        bankIban: form.bankIban.trim(),
      })
      setCompanySettings(settings)
      showSuccessToast('Datos de empresa actualizados para el informe mensual.')
      return true
    } catch (error) {
      showErrorToast(error.message)
      return false
    }
  }

  async function handleCreateClient(form) {
    const name = form.name.trim()
    const taxId = form.taxId.trim()

    if (!name || !taxId) {
      showErrorToast('El cliente necesita al menos nombre y NIF/CIF.')
      return false
    }

    try {
      const createdClient = await createClientRecord({
        name,
        taxId,
        address: form.address.trim(),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      })
      setClients((currentClients) =>
        [...currentClients, createdClient].sort((left, right) =>
          left.name.localeCompare(right.name, 'es-ES'),
        ),
      )
      showSuccessToast(`Cliente ${createdClient.name} creado.`)
      return true
    } catch (error) {
      showErrorToast(error.message)
      return false
    }
  }

  async function handleSaveClient(form) {
    if (!editingClient) {
      return
    }

    setIsSavingClient(true)

    try {
      const updatedClient = await updateClientRecord(editingClient.id, {
        name: form.name.trim(),
        taxId: form.taxId.trim(),
        address: form.address.trim(),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      })

      setClients((currentClients) =>
        currentClients
          .map((client) =>
            client.id === updatedClient.id ? updatedClient : client,
          )
          .sort((left, right) => left.name.localeCompare(right.name, 'es-ES')),
      )
      setEditingClient(null)
      showSuccessToast(`Cliente ${updatedClient.name} actualizado.`)
    } catch (error) {
      showErrorToast(error.message)
    } finally {
      setIsSavingClient(false)
    }
  }

  function handleDeleteClient(client) {
    setConfirmDialog({
      open: true,
      title: 'Eliminar cliente',
      description:
        'Se eliminará el cliente del catálogo. Las facturas existentes conservarán sus datos históricos.',
      confirmLabel: 'Eliminar cliente',
      tone: 'danger',
      action: async () => {
        try {
          await deleteClientRecord(client.id)
          setClients((current) =>
            current.filter((currentClient) => currentClient.id !== client.id),
          )
          setEditingClient((current) =>
            current?.id === client.id ? null : current,
          )
          showSuccessToast(`Cliente ${client.name} eliminado.`)
        } catch (error) {
          showErrorToast(error.message)
        }
      },
    })
  }

  async function handleSaveEmployee(form) {
    if (!editingEmployee) {
      return
    }

    setIsSavingEmployee(true)

    try {
      const updatedEmployee = await updateEmployeeRecord(editingEmployee.id, {
        name: form.name.trim(),
        role: form.role.trim(),
        hourlyRate: Number(form.hourlyRate),
        taxId: form.taxId.trim(),
        socialSecurityNumber: form.socialSecurityNumber.trim(),
        loginCode: form.loginCode.trim().toLowerCase(),
        mobileAccessEnabled: form.mobileAccessEnabled,
        pin: form.pin.trim(),
      })

      setEmployees((currentEmployees) =>
        currentEmployees
          .map((employee) =>
            employee.id === updatedEmployee.id ? updatedEmployee : employee,
          )
          .sort((left, right) => left.name.localeCompare(right.name, 'es-ES')),
      )
      setEditingEmployee(null)
      showSuccessToast(`Empleado ${updatedEmployee.name} actualizado.`)
    } catch (error) {
      showErrorToast(error.message)
    } finally {
      setIsSavingEmployee(false)
    }
  }

  function handleDeleteEmployee(employee) {
    setConfirmDialog({
      open: true,
      title: 'Eliminar empleado',
      description:
        'Se eliminará el empleado y sus fichajes asociados de forma permanente.',
      confirmLabel: 'Eliminar empleado',
      tone: 'danger',
      action: async () => {
        try {
          await deleteEmployeeRecord(employee.id)
          setEmployees((current) =>
            current.filter((currentEmployee) => currentEmployee.id !== employee.id),
          )
          setEmployeeShifts((current) =>
            current.filter((shift) => shift.employeeId !== employee.id),
          )
          setEditingEmployee((current) =>
            current?.id === employee.id ? null : current,
          )
          showSuccessToast(`Empleado ${employee.name} eliminado.`)
        } catch (error) {
          showErrorToast(error.message)
        }
      },
    })
  }

  async function handleToggleEmployeeShift(employeeId, pin) {
    const employee = employees.find((item) => item.id === employeeId)

    if (!employee) {
      showErrorToast('No se encontró el empleado seleccionado.')
      return false
    }

    try {
      const result = await toggleEmployeeShiftRecord({
        employeeId,
        pin,
      })
      setEmployeeShifts(result.shifts ?? [])
      showSuccessToast(
        result.status === 'closed'
          ? `Salida registrada para ${employee.name}.`
          : `Entrada registrada para ${employee.name}.`,
      )
      return true
    } catch (error) {
      showErrorToast(error.message)
      return false
    }
  }

  async function handleCreateInvoice(invoiceDraft) {
    const clientName = invoiceDraft.clientName.trim()
    const items = invoiceDraft.items.filter(
      (item) => item.description.trim() && Number(item.quantity) > 0,
    )

    if (!clientName || items.length === 0) {
      showErrorToast('La factura necesita cliente y al menos una línea válida.')
      return false
    }

    try {
      const invoice = await createInvoiceRecord({
        issueDate: invoiceDraft.issueDate || getToday(),
        dueDate: invoiceDraft.dueDate || getToday(),
        clientId: invoiceDraft.clientId || null,
        clientName,
        taxId: invoiceDraft.taxId.trim(),
        clientAddress: invoiceDraft.clientAddress?.trim() ?? '',
        clientPostalCode: invoiceDraft.clientPostalCode?.trim() ?? '',
        clientCity: invoiceDraft.clientCity?.trim() ?? '',
        clientEmail: invoiceDraft.clientEmail?.trim() ?? '',
        clientPhone: invoiceDraft.clientPhone?.trim() ?? '',
        paymentByTransfer: Boolean(invoiceDraft.paymentByTransfer),
        status: invoiceDraft.status,
        notes: invoiceDraft.notes.trim(),
        vatRate: Number(invoiceDraft.vatRate ?? 10),
        items: invoiceDraft.items,
      })
      setInvoices((current) => [invoice, ...current])
      showSuccessToast(`Factura ${invoice.invoiceNumber} creada.`)
      return true
    } catch (error) {
      showErrorToast(error.message)
      return false
    }
  }

  async function handleUpdateInvoiceStatus(invoiceId, status) {
    try {
      const updatedInvoice = await updateInvoiceStatusRecord(invoiceId, status)
      setInvoices((currentInvoices) =>
        currentInvoices.map((invoice) =>
          invoice.id === invoiceId ? updatedInvoice : invoice,
        ),
      )
      showSuccessToast(`Estado de factura actualizado a ${status}.`)
    } catch (error) {
      showErrorToast(error.message)
    }
  }

  async function handleSaveInvoice(form) {
    if (!editingInvoice) {
      return
    }

    setIsSavingInvoice(true)

    try {
      const updatedInvoice = await updateInvoiceRecord(editingInvoice.id, {
        dueDate: form.dueDate,
        clientId: form.clientId || null,
        clientName: form.clientName.trim(),
        taxId: form.taxId.trim(),
        clientAddress: form.clientAddress?.trim() ?? '',
        clientPostalCode: form.clientPostalCode?.trim() ?? '',
        clientCity: form.clientCity?.trim() ?? '',
        clientEmail: form.clientEmail?.trim() ?? '',
        clientPhone: form.clientPhone?.trim() ?? '',
        paymentByTransfer: Boolean(form.paymentByTransfer),
        status: form.status,
        notes: form.notes.trim(),
        vatRate: Number(form.vatRate ?? 10),
        items: form.items,
      })

      setInvoices((currentInvoices) =>
        currentInvoices.map((invoice) =>
          invoice.id === updatedInvoice.id ? updatedInvoice : invoice,
        ),
      )
      setEditingInvoice(null)
      showSuccessToast(`Factura ${updatedInvoice.invoiceNumber} actualizada.`)
    } catch (error) {
      showErrorToast(error.message)
    } finally {
      setIsSavingInvoice(false)
    }
  }

  function handleDeleteInvoice(invoice) {
    setConfirmDialog({
      open: true,
      title: 'Eliminar factura',
      description:
        'Se eliminará la factura y todas sus líneas de forma permanente.',
      confirmLabel: 'Eliminar factura',
      tone: 'danger',
      action: async () => {
        try {
          await deleteInvoiceRecord(invoice.id)
          setInvoices((current) =>
            current.filter((currentInvoice) => currentInvoice.id !== invoice.id),
          )
          setEditingInvoice((current) =>
            current?.id === invoice.id ? null : current,
          )
          showSuccessToast(`Factura ${invoice.invoiceNumber} eliminada.`)
        } catch (error) {
          showErrorToast(error.message)
        }
      },
    })
  }

  const draftTotal = draftItems.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.purchaseCost),
    0,
  )

  const sortedProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLocaleLowerCase('es-ES')
    const sorted = products.filter((product) => {
      if (!normalizedSearch) {
        return true
      }

      return [product.ref, product.name, product.category]
        .filter(Boolean)
        .some((value) =>
          `${value}`.toLocaleLowerCase('es-ES').includes(normalizedSearch),
        )
    })

    sorted.sort((left, right) => {
      const leftValue = left[productSort.column]
      const rightValue = right[productSort.column]

      if (typeof leftValue === 'number' || typeof rightValue === 'number') {
        const numericLeft = Number(leftValue ?? 0)
        const numericRight = Number(rightValue ?? 0)
        return productSort.direction === 'asc'
          ? numericLeft - numericRight
          : numericRight - numericLeft
      }

      if (typeof leftValue === 'boolean' || typeof rightValue === 'boolean') {
        const booleanLeft = leftValue ? 1 : 0
        const booleanRight = rightValue ? 1 : 0
        return productSort.direction === 'asc'
          ? booleanLeft - booleanRight
          : booleanRight - booleanLeft
      }

      const normalizedLeft = `${leftValue ?? ''}`.toLocaleLowerCase('es-ES')
      const normalizedRight = `${rightValue ?? ''}`.toLocaleLowerCase('es-ES')
      const comparison = normalizedLeft.localeCompare(normalizedRight, 'es-ES')

      return productSort.direction === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [productSearch, productSort, products])

  const orderProducts = useMemo(() => {
    const visibleProducts = new Map()

    products
      .filter((product) => product.availableForSale)
      .forEach((product) => {
        visibleProducts.set(product.id, product)
      })

    if (editingOrder) {
      draftItems.forEach((item) => {
        if (visibleProducts.has(item.productId)) {
          return
        }

        visibleProducts.set(item.productId, {
          id: item.productId,
          ref: item.ref,
          name: item.name,
          category: item.category,
          purchaseCost: Number(item.purchaseCost ?? 0),
          salePrice: Number(item.salePrice ?? 0),
          availableForSale: false,
        })
      })
    }

    return Array.from(visibleProducts.values()).sort((left, right) =>
      left.name.localeCompare(right.name, 'es-ES'),
    )
  }, [draftItems, editingOrder, products])

  const liveOrderSummary = useMemo(() => {
    if (!selectedOrder) {
      return {
        totalRemainingUnits: 0,
        totalSoldUnits: 0,
        totalSalesAmount: 0,
      }
    }

    return selectedOrder.items.reduce(
      (accumulator, item) => {
        const remainingQuantity = Number(
          closingDraft[item.id] ?? item.remainingQuantity ?? item.quantityOrdered,
        )
        const soldQuantity = Math.max(Number(item.quantityOrdered) - remainingQuantity, 0)
        const salesAmount = soldQuantity * Number(item.salePrice)

        return {
          totalRemainingUnits: accumulator.totalRemainingUnits + remainingQuantity,
          totalSoldUnits: accumulator.totalSoldUnits + soldQuantity,
          totalSalesAmount: accumulator.totalSalesAmount + salesAmount,
        }
      },
      {
        totalRemainingUnits: 0,
        totalSoldUnits: 0,
        totalSalesAmount: 0,
      },
    )
  }, [closingDraft, selectedOrder])

  const employeeSummary = useMemo(() => {
    const openShiftIds = new Set(
      employeeShifts.filter((shift) => !shift.endedAt).map((shift) => shift.employeeId),
    )
    const totalHoursToday = roundHours(
      employeeShifts.reduce((sum, shift) => {
        const shiftDate = shift.startedAt?.slice(0, 10)

        if (shiftDate !== getToday()) {
          return sum
        }

        return sum + getShiftHours(shift)
      }, 0),
    )
    const estimatedPayrollToday = roundHours(
      employeeShifts.reduce((sum, shift) => {
        const shiftDate = shift.startedAt?.slice(0, 10)

        if (shiftDate !== getToday()) {
          return sum
        }

        const employee = employees.find((item) => item.id === shift.employeeId)
        return sum + getShiftHours(shift) * Number(employee?.hourlyRate ?? 0)
      }, 0),
    )

    return {
      totalEmployees: employees.length,
      activeShifts: openShiftIds.size,
      totalHoursToday,
      estimatedPayrollToday,
    }
  }, [employeeShifts, employees])

  const invoiceSummary = useMemo(() => {
    return invoices.reduce(
      (accumulator, invoice) => {
        const normalizedStatus = invoice.status ?? 'pendiente'
        const total = Number(invoice.total ?? 0)

        return {
          totalInvoices: accumulator.totalInvoices + 1,
          paidAmount:
            accumulator.paidAmount + (normalizedStatus === 'pagada' ? total : 0),
          pendingAmount:
            accumulator.pendingAmount + (normalizedStatus !== 'pagada' ? total : 0),
        }
      },
      {
        totalInvoices: 0,
        paidAmount: 0,
        pendingAmount: 0,
      },
    )
  }, [invoices])

  const currentSection = getSectionById(activeSection)
  const currentModule = getModuleBySection(activeSection)
  const isHomeView = activeSection === 'home'

  if (authStatus === 'checking') {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fde68a_0%,#fffaf0_32%,#ffffff_100%)] px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
          <div className="rounded-[2rem] border border-amber-200 bg-white/90 px-8 py-10 text-center shadow-[0_24px_80px_rgba(120,53,15,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Verificando sesión
            </p>
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-[0.14em] text-stone-950">
              Gestor de Pastisseria
            </h1>
            <p className="mt-4 text-stone-600">
              Comprobando el acceso al panel antes de cargar los datos.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (authStatus !== 'authenticated') {
    return (
      <AdminLoginScreen
        isLoading={isAuthenticating}
        errorMessage={authError}
        onSubmit={handleAdminLogin}
      />
    )
  }

  function handleNavigateHome() {
    setActiveSection('home')
  }

  function handleNavigateModule(moduleId, sectionId) {
    const module = navigationModules.find((item) => item.id === moduleId)

    if (!module) {
      return
    }

    setActiveSection(sectionId ?? module.defaultSection)
  }

  function getDraftQuantity(productId) {
    const item = draftItems.find((draftItem) => draftItem.productId === productId)
    return item ? item.quantity : 0
  }

  function handleProductSort(column) {
    setProductSort((currentSort) => ({
      column,
      direction:
        currentSort.column === column && currentSort.direction === 'asc'
          ? 'desc'
          : 'asc',
    }))
  }

  function handleConfirmDialogClose() {
    setConfirmDialog((current) => ({
      ...current,
      open: false,
      action: null,
    }))
  }

  async function handleConfirmDialogAccept() {
    const action = confirmDialog.action
    handleConfirmDialogClose()

    if (action) {
      await action()
    }
  }

  function handlePrintOrder(order) {
    if (!order) {
      return
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700')

    if (!printWindow) {
      showErrorToast('No se pudo abrir la ventana de impresión.')
      return
    }

    const rows = order.items
      .map(
        (item) => `
          ${
            (() => {
              const remainingQuantity =
                order.status === 'closed'
                  ? Number(item.remainingQuantity ?? 0)
                  : Number(item.quantityOrdered)
              const soldQuantity =
                order.status === 'closed'
                  ? Number(item.soldQuantity ?? 0)
                  : Math.max(Number(item.quantityOrdered) - remainingQuantity, 0)
              const salesAmount =
                order.status === 'closed'
                  ? Number(item.salesAmount ?? 0)
                  : soldQuantity * Number(item.salePrice ?? 0)

              return `
          <tr>
            <td>${item.ref}</td>
            <td>${item.name}</td>
            <td>${item.quantityOrdered}</td>
            <td>${remainingQuantity}</td>
            <td>${soldQuantity}</td>
            <td>${formatCurrency(item.salePrice)}</td>
            <td>${formatCurrency(salesAmount)}</td>
          </tr>`
            })()
          }`,
      )
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Pedido ${order.csvFilename}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1c1917; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #d6d3d1; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f5f5f4; }
          </style>
        </head>
        <body>
          <h1>Pedido del ${formatDate(order.orderDate)}</h1>
          <p><strong>Archivo:</strong> ${order.csvFilename}</p>
          <p><strong>Estado:</strong> ${order.status === 'closed' ? 'Cerrado' : 'Abierto'}</p>
          <p><strong>Unidades pedidas:</strong> ${order.summary?.totalOrderedUnits ?? 0}</p>
          <p><strong>Venta del día:</strong> ${formatCurrency(
            order.status === 'closed' ? order.totalSalesAmount ?? 0 : 0,
          )}</p>
          <table>
            <thead>
              <tr>
                <th>REF</th>
                <th>Producto</th>
                <th>Pedido</th>
                <th>Restante</th>
                <th>Vendido</th>
                <th>Precio venta</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fde68a_0%,#fffaf0_30%,#fff_100%)] text-stone-800">
      <div className="mx-auto flex min-h-screen w-full max-w-450 flex-col px-4 py-5 sm:px-5 lg:px-6">
        {isHomeView ? (
          <header className="px-1 py-2 text-center">
            <div className="flex flex-wrap items-center justify-between gap-3 text-left">
              <div className="rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-xs text-stone-600 shadow-sm">
                Sesión: <strong className="text-stone-900">{adminSession?.user?.email}</strong>
              </div>
              <button
                type="button"
                onClick={handleAdminLogout}
                className="rounded-full border border-rose-800 bg-rose-700 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-[0_8px_20px_rgba(190,18,60,0.24)] transition hover:border-rose-900 hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
              >
                Cerrar sesión
              </button>
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-[0.14em] text-stone-900 sm:text-4xl">
              GESTOR DE PASTISSERIA
            </h1>
            <div className="mt-5 flex justify-center">
              <div className="h-[130px] w-[130px] overflow-hidden rounded-full border border-stone-300 bg-white shadow-[0_10px_30px_rgba(28,25,23,0.08)]">
                <img
                  src="/512x512.png"
                  alt="Logo de la empresa"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </header>
        ) : null}

        {isHomeView ? (
          <main className="flex flex-1 items-start justify-center pt-6 pb-10">
            <section className="w-full max-w-6xl">
              <HomePage
                orderSummary={summary}
                employeeSummary={employeeSummary}
                invoiceSummary={invoiceSummary}
                formatCurrency={formatCurrency}
                onNavigateModule={handleNavigateModule}
              />
            </section>
          </main>
        ) : (
          <main className="mt-3 grid flex-1 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <SidebarNavigation
              homeItem={navigationHomeItem}
              modules={navigationModules}
              activeSection={activeSection}
              onNavigateHome={handleNavigateHome}
              onNavigateModule={handleNavigateModule}
            />

            <section className="space-y-6">
              <article className="rounded-md border border-stone-200 bg-white/90 p-4 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      {currentModule ? currentModule.label : 'Vista activa'}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-stone-900">
                      {currentSection.label}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {currentModule?.id === 'invoicing' && activeSection !== 'invoicing-clients' ? (
                      <button
                        type="button"
                        onClick={() => setActiveSection('invoicing-clients')}
                        className="rounded-sm bg-emerald-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-emerald-500"
                      >
                        Nuevo cliente
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>

              {activeSection === 'products' ? (
                <ProductsPage
                  products={sortedProducts}
                  productSearch={productSearch}
                  onProductSearchChange={setProductSearch}
                  onImportProducts={handleImportProducts}
                  onEditProduct={setEditingProduct}
                  onToggleProductStatus={handleToggleProductStatus}
                  formatCurrency={formatCurrency}
                  sortConfig={productSort}
                  onSort={handleProductSort}
                  isImportingProducts={isImportingProducts}
                />
              ) : null}

              {activeSection === 'daily-order' ? (
                <DailyOrderPage
                  orderDate={orderDate}
                  onOrderDateChange={setOrderDate}
                  orderProducts={orderProducts}
                  getProductQuantity={getDraftQuantity}
                  onUpdateProductQuantity={updateOrderProductQuantity}
                  onCreateOrder={handleCreateOrder}
                  isSavingOrder={isSavingOrder}
                  draftTotal={draftTotal}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  editingOrder={editingOrder}
                  hiddenInactiveItemsCount={editingOrder?.inactiveItemsCount ?? 0}
                  onCancelEdit={resetOrderEditor}
                />
              ) : null}

              {activeSection === 'orders' ? (
                <OrdersPage
                  orders={orders}
                  orderFilters={orderFilters}
                  onUpdateFilters={updateOrderFilters}
                  onSelectOrder={handleSelectOrder}
                  onEditOrder={handleEditOrder}
                  onPreviewOrder={handlePreviewOrder}
                  onRegenerateCsv={handleRegenerateOrderCsv}
                  onStartClosingOrder={handleStartClosingOrder}
                  selectedOrder={selectedOrder}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                />
              ) : null}

              {activeSection === 'closing' ? (
                <ClosingPage
                  selectedOrder={selectedOrder}
                  closingDraft={closingDraft}
                  onUpdateClosingDraft={updateClosingDraft}
                  onCloseOrder={handleCloseOrder}
                  isClosingOrder={isClosingOrder}
                  liveOrderSummary={liveOrderSummary}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  getPrintDate={getPrintDate}
                />
              ) : null}

              {['employee-time-dashboard', 'employee-time-staff', 'employee-time-reports'].includes(activeSection) ? (
                <EmployeeTimePage
                  section={activeSection}
                  companySettings={companySettings}
                  employees={employees}
                  shifts={employeeShifts}
                  onAddEmployee={handleAddEmployee}
                  onEditEmployee={setEditingEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  onToggleShift={handleToggleEmployeeShift}
                  formatCurrency={formatCurrency}
                />
              ) : null}

              {activeSection === 'company-maintenance' ? (
                <CompanyMaintenancePage
                  companySettings={companySettings}
                  onUpdateCompanySettings={handleUpdateCompanySettings}
                />
              ) : null}

              {['invoicing-dashboard', 'invoicing-history', 'invoicing-clients'].includes(activeSection) ? (
                <InvoicingPage
                  section={activeSection}
                  clients={clients}
                  invoices={invoices}
                  onNavigateSection={setActiveSection}
                  onCreateClient={handleCreateClient}
                  onCreateInvoice={handleCreateInvoice}
                  onEditClient={setEditingClient}
                  onEditInvoice={setEditingInvoice}
                  onDeleteClient={handleDeleteClient}
                  onDeleteInvoice={handleDeleteInvoice}
                  onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                />
              ) : null}
            </section>
          </main>
        )}

        <LoadingOverlay loading={loading} />
      </div>

      {editingProduct ? (
        <ProductEditor
          product={editingProduct}
          isSaving={isSavingProduct}
          onCancel={() => setEditingProduct(null)}
          onSaved={handleSaveProduct}
        />
      ) : null}

      {editingEmployee ? (
        <EmployeeEditor
          employee={editingEmployee}
          isSaving={isSavingEmployee}
          onCancel={() => setEditingEmployee(null)}
          onSaved={handleSaveEmployee}
        />
      ) : null}

      {editingClient ? (
        <ClientEditor
          client={editingClient}
          isSaving={isSavingClient}
          onCancel={() => setEditingClient(null)}
          onSaved={handleSaveClient}
        />
      ) : null}

      {editingInvoice ? (
        <InvoiceEditor
          key={editingInvoice.id}
          invoice={editingInvoice}
          clients={clients}
          isSaving={isSavingInvoice}
          onCancel={() => setEditingInvoice(null)}
          onSaved={handleSaveInvoice}
          formatCurrency={formatCurrency}
        />
      ) : null}

      <OrderPreviewDialog
        open={Boolean(previewOrder)}
        order={previewOrder}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        onClose={() => setPreviewOrder(null)}
        onPrint={() => handlePrintOrder(previewOrder)}
        onRegenerateCsv={() => handleRegenerateOrderCsv(previewOrder.id)}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
        onCancel={handleConfirmDialogClose}
        onConfirm={handleConfirmDialogAccept}
      />
    </div>
  )
}

export default App
