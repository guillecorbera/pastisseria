export const navigationModules = [
  {
    id: 'purchase-orders',
    label: 'Ordenes de Compra',
    eyebrow: 'Compras',
    defaultSection: 'orders',
    sections: [
      { id: 'orders', label: 'Historial de pedidos', eyebrow: 'Seguimiento' },
      { id: 'daily-order', label: 'Pedido diario', eyebrow: 'Entrada' },
      { id: 'closing', label: 'Cierre del dia', eyebrow: 'Resumen' },
      { id: 'products', label: 'Productos', eyebrow: 'Catalogo' },
    ],
  },
  {
    id: 'invoicing',
    label: 'Facturacion',
    eyebrow: 'Cobros',
    defaultSection: 'invoicing-history',
    sections: [
      { id: 'invoicing-history', label: 'Historial', eyebrow: 'Seguimiento' },
      { id: 'invoicing-dashboard', label: 'Nueva factura', eyebrow: 'Emision' },
      { id: 'invoicing-clients', label: 'Clientes', eyebrow: 'Agenda' },
    ],
  },
  {
    id: 'employee-time',
    label: 'Fichajes de Empleados',
    eyebrow: 'Personal',
    defaultSection: 'employee-time-dashboard',
    sections: [
      { id: 'employee-time-dashboard', label: 'Panel diario', eyebrow: 'Fichajes' },
      { id: 'employee-time-staff', label: 'Empleados', eyebrow: 'Equipo' },
      { id: 'employee-time-reports', label: 'Informes', eyebrow: 'Resumen' },
    ],
  },
  {
    id: 'maintenance',
    label: 'Mantenimiento',
    eyebrow: 'Sistema',
    defaultSection: 'company-maintenance',
    sections: [
      { id: 'company-maintenance', label: 'Datos del emisor', eyebrow: 'Emisor' },
    ],
  },
]

export const navigationHomeItem = {
  id: 'home',
  label: 'Portal general',
  eyebrow: 'Inicio',
}

export const navigationSections = navigationModules.flatMap((module) => module.sections)

export function getModuleBySection(sectionId) {
  return (
    navigationModules.find((module) =>
      module.sections.some((section) => section.id === sectionId),
    ) ?? null
  )
}

export function getSectionById(sectionId) {
  if (sectionId === navigationHomeItem.id) {
    return navigationHomeItem
  }

  return (
    navigationSections.find((section) => section.id === sectionId) ?? navigationHomeItem
  )
}
