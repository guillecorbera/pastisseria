function EmptyState({ title, description }) {
  return (
    <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/80 p-6 text-center">
      <p className="text-base font-semibold text-stone-800">{title}</p>
      <p className="mt-2 text-xs text-stone-600">{description}</p>
    </div>
  )
}

export default EmptyState
