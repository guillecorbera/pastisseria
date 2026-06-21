function SidebarNavigation({ homeItem, modules, activeSection, onNavigateHome, onNavigateModule }) {
  const activeModule =
    modules.find((module) =>
      module.sections.some((section) => section.id === activeSection),
    ) ?? null

  return (
    <aside className="rounded-md border border-stone-200 bg-white/90 p-4 shadow-[0_18px_60px_rgba(28,25,23,0.08)] lg:sticky lg:top-6 lg:h-fit">
      <div className="px-3 pb-4 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
          Navegacion
        </p>
        <h2 className="mt-2 text-xl font-semibold text-stone-900">Pastisseria</h2>
      </div>

      <nav className="grid gap-3">
        <button
          type="button"
          onClick={onNavigateHome}
          className={`rounded-md border px-4 py-3 text-left transition ${
            activeSection === homeItem.id
              ? 'border-sky-950 bg-sky-950 shadow-[0_12px_30px_rgba(8,47,73,0.22)]'
              : 'border-sky-900 bg-sky-900 hover:border-sky-800 hover:bg-sky-800'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-300">
            {homeItem.eyebrow}
          </p>
          <p className="mt-2 text-base font-semibold text-white">{homeItem.label}</p>
        </button>

        {activeModule ? (
          <div className="rounded-xl border border-stone-400 bg-stone-300/85 p-2 transition">
            <div className="w-full rounded-md border border-amber-300 bg-amber-100 px-3 py-3 text-left shadow-[0_6px_18px_rgba(28,25,23,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-800">
                {activeModule.eyebrow}
              </p>
              <p className="mt-2 text-base font-semibold text-stone-900">
                {activeModule.label}
              </p>
            </div>

            <div className="mt-2 grid gap-2">
              {activeModule.sections.map((section) => {
                const isActiveSection = activeSection === section.id

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onNavigateModule(activeModule.id, section.id)}
                    className={`rounded-md border px-3 py-2.5 text-left transition ${
                      isActiveSection
                        ? 'border-sky-300 bg-sky-100 shadow-[0_10px_25px_rgba(14,165,233,0.12)]'
                        : 'border-stone-400 bg-stone-200 hover:border-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      {section.eyebrow}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-stone-900">
                      {section.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </nav>
    </aside>
  )
}

export default SidebarNavigation
