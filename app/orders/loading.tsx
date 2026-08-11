import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full md:hidden" />
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-24" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="hidden rounded-2xl border border-border/40 bg-card p-4 shadow-sm md:block">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(320px,1.5fr)_180px_1fr_1fr_auto]">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-10 flex-1 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card px-4 py-3 shadow-sm">
        <Skeleton className="h-5 w-full max-w-120" />
      </div>

      <div className="space-y-4 md:hidden">
        {Array.from({ length: 4 }).map((_, rowIndex) => (
          <div key={rowIndex} className="rounded-3xl border border-border/20 bg-card px-6 py-6 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-full" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton className="h-7 w-24 rounded-2xl" />
              <Skeleton className="h-7 w-24 rounded-2xl" />
              <Skeleton className="h-7 w-24 rounded-2xl" />
            </div>
            <div className="mt-5 border-t border-border/70 pt-5 flex items-center justify-between">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm md:block">
        <div className="border-b border-border/20 px-3 py-3 bg-muted/60">
          <div className="grid grid-cols-9 gap-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-full" />
            ))}
          </div>
        </div>

        <div className="space-y-1 px-3 py-2">
          {Array.from({ length: 9 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-9 items-center gap-3 py-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24 justify-self-end" />
              <Skeleton className="h-4 w-16 justify-self-end" />
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md justify-self-end" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-card p-3 shadow-sm">
        <Skeleton className="h-5 w-40" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={`mobile-${index}`} className="h-8 w-8 rounded-md md:hidden" />
          ))}
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`desktop-${index}`} className="hidden h-8 w-8 rounded-md md:block" />
          ))}
        </div>
      </div>
    </div>
  )
}
