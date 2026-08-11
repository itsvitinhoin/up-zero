import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 p-4 pb-24 pt-4 sm:p-6 lg:p-8 lg:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/20 bg-card p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-3 h-1 w-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-xl border border-border/20 bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-8 w-28" />
            </div>

            <div className="hidden md:block">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-b border-border/20 pb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
              <div className="space-y-2 py-3">
                {Array.from({ length: 7 }).map((_, row) => (
                  <div key={row} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3 py-2">
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-18" />
                    <Skeleton className="h-6 w-16 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/20 bg-card p-4">
            <Skeleton className="mb-4 h-5 w-36" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/20 bg-card p-4">
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/20 bg-card p-4">
            <Skeleton className="mb-4 h-5 w-28" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
