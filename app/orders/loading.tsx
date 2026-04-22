import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/20 bg-card p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-3 h-1 w-full" />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-border/20 bg-card p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr_1fr_minmax(280px,1fr)_auto]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="rounded-xl border border-border/20 bg-card px-3 py-2">
        <Skeleton className="h-5 w-full max-w-96" />
      </div>

      <div className="rounded-xl border border-border/20 bg-card px-3 py-2">
        <Skeleton className="h-4 w-full max-w-130" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/20 bg-card md:hidden">
        <div className="space-y-3 px-3 py-3">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div key={rowIndex} className="rounded-lg border border-border/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border/20 bg-card md:block">
        <div className="border-b border-border/20 px-3 py-3">
          <div className="grid grid-cols-10 gap-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-full" />
            ))}
          </div>
        </div>

        <div className="space-y-1 px-3 py-2">
          {Array.from({ length: 9 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-10 items-center gap-3 py-2">
              <Skeleton className="h-4 w-3 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/20 bg-card p-3">
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
