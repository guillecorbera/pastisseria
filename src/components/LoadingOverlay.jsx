function LoadingOverlay({ loading }) {
  if (!loading) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 mx-auto flex w-fit items-center gap-3 rounded-sm bg-stone-900 px-4 py-2.5 text-xs text-white shadow-2xl">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300"></span>
      Preparando datos iniciales...
    </div>
  )
}

export default LoadingOverlay
