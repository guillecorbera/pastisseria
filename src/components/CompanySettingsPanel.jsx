import { useState } from 'react'

function CompanySettingsPanel({ companySettings, onUpdateCompanySettings }) {
  const [companyForm, setCompanyForm] = useState(companySettings)

  async function handleCompanySubmit(event) {
    event.preventDefault()
    await onUpdateCompanySettings(companyForm)
  }

  return (
    <article className="rounded-md border border-stone-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(28,25,23,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
        Datos empresa
      </p>
      <h3 className="mt-2 text-xl font-semibold text-stone-900">
        Mantenimiento del emisor
      </h3>

      <form className="mt-5 space-y-4" onSubmit={handleCompanySubmit}>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Empresa
          </span>
          <input
            value={companyForm.companyName ?? ''}
            onChange={(event) =>
              setCompanyForm((current) => ({
                ...current,
                companyName: event.target.value,
              }))
            }
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            CIF / NIF empresa
          </span>
          <input
            value={companyForm.companyTaxId ?? ''}
            onChange={(event) =>
              setCompanyForm((current) => ({
                ...current,
                companyTaxId: event.target.value,
              }))
            }
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Centro de trabajo
          </span>
          <input
            value={companyForm.workplace ?? ''}
            onChange={(event) =>
              setCompanyForm((current) => ({
                ...current,
                workplace: event.target.value,
              }))
            }
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            C.C.C.
          </span>
          <input
            value={companyForm.contributionAccountCode ?? ''}
            onChange={(event) =>
              setCompanyForm((current) => ({
                ...current,
                contributionAccountCode: event.target.value,
              }))
            }
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Direccion
          </span>
          <input
            value={companyForm.address ?? ''}
            onChange={(event) =>
              setCompanyForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              CP
            </span>
            <input
              value={companyForm.postalCode ?? ''}
              onChange={(event) =>
                setCompanyForm((current) => ({
                  ...current,
                  postalCode: event.target.value,
                }))
              }
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Ciudad
            </span>
            <input
              value={companyForm.city ?? ''}
              onChange={(event) =>
                setCompanyForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Telefono
          </span>
          <input
            value={companyForm.phone ?? ''}
            onChange={(event) =>
              setCompanyForm((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Correo electronico
          </span>
          <input
            value={companyForm.email ?? ''}
            onChange={(event) =>
              setCompanyForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Banco
            </span>
            <input
              value={companyForm.bankName ?? ''}
              onChange={(event) =>
                setCompanyForm((current) => ({
                  ...current,
                  bankName: event.target.value,
                }))
              }
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              IBAN
            </span>
            <input
              value={companyForm.bankIban ?? ''}
              onChange={(event) =>
                setCompanyForm((current) => ({
                  ...current,
                  bankIban: event.target.value,
                }))
              }
              className="w-full rounded-sm border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-sky-400 focus:bg-white"
            />
          </label>
        </div>
        <button
          type="submit"
          className="w-full rounded-sm bg-sky-600 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-sky-500"
        >
          Guardar datos del emisor
        </button>
      </form>
    </article>
  )
}

export default CompanySettingsPanel
