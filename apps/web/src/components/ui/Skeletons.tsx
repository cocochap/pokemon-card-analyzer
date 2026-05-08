export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array(6).fill(null).map((_, i) => (
          <div key={i} className="glass-card p-4 space-y-3">
            <div className="skeleton h-8 w-8 rounded-lg" />
            <div className="skeleton h-5 w-20" />
            <div className="skeleton h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
      <div className="xl:col-span-2 flex flex-col items-center gap-4">
        <div className="skeleton aspect-[5/7] w-full max-w-xs rounded-2xl" />
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="skeleton h-24 w-full rounded-xl" />
      </div>
      <div className="xl:col-span-3 space-y-4">
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-80 w-full rounded-xl" />
        <div className="skeleton h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 20 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array(count).fill(null).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton aspect-[5/7] w-full rounded-xl" />
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
