import { Skeleton } from '@/components/ui/skeleton'

export function AdminRouteSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/20 bg-card p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-7 w-20" />
            <Skeleton className="mt-3 h-1 w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/20 bg-card p-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
      </div>

      <div className="rounded-xl border border-border/20 bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-52" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-full space-y-5 px-4 pb-24 pt-4 sm:px-5 lg:space-y-6 lg:px-8 lg:pb-8 lg:pt-6">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-7 w-28 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/95 shadow-sm">
        <div className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-12 w-55 rounded-2xl" />
            <Skeleton className="h-12 w-42 rounded-2xl" />
            <Skeleton className="h-12 w-38 rounded-2xl" />
            <Skeleton className="h-12 min-w-50 flex-1 rounded-2xl" />
            <Skeleton className="h-12 w-12 rounded-2xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/60 bg-card/95 shadow-sm">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-11 w-11 rounded-2xl" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex-1 overflow-hidden rounded-2xl border border-border/40 bg-card/95 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-5 w-5 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card/95 shadow-sm md:col-span-2">
          <div className="p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/95 shadow-sm">
          <div className="p-4 sm:p-5">
            <div className="mb-5 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/60 bg-card/95 shadow-sm">
            <div className="p-4 sm:p-5">
              <div className="mb-5 space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/95 shadow-sm">
        <div className="p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
