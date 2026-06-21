function StatCard({ label, value, accent }) {
  return (
    <article className="rounded-md border border-stone-200 bg-white/85 px-3 py-2.5 shadow-[0_18px_50px_rgba(120,53,15,0.08)] backdrop-blur">
      <p className="text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent}`}>{value}</p>
    </article>
  )
}

export default StatCard
