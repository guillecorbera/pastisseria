import StatCard from './StatCard'

function AppHeader({ title, description, cards }) {
  return (
    <header className="rounded-md border border-amber-200/70 bg-white/75 px-4 py-4 shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur sm:px-5 sm:py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Gestor de pastisseria
          </p>
          <h1 className="mt-2 font-serif text-2xl tracking-tight text-stone-900 sm:text-[30px]">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-5 text-stone-600">
            {description}
          </p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-4">
          {cards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              accent={card.accent}
            />
          ))}
        </div>
      </div>
    </header>
  )
}

export default AppHeader
