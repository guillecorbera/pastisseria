import CompanySettingsPanel from '../components/CompanySettingsPanel'

function CompanyMaintenancePage({ companySettings, onUpdateCompanySettings }) {
  return (
    <div className="space-y-6">
      <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          Mantenimiento
        </p>
        <h3 className="mt-2 text-xl font-semibold text-stone-900">
          Datos del emisor
        </h3>
        <p className="mt-2 max-w-3xl text-sm text-stone-600">
          Aqui puedes corregir los datos fiscales y de contacto del emisor para que
          futuras facturas e informes usen siempre la informacion actualizada.
        </p>
      </article>

      <CompanySettingsPanel
        key={JSON.stringify(companySettings)}
        companySettings={companySettings}
        onUpdateCompanySettings={onUpdateCompanySettings}
      />
    </div>
  )
}

export default CompanyMaintenancePage
