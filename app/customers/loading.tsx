import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-52" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/20 bg-card p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="mt-3 h-7 w-12" />
            <Skeleton className="mt-3 h-1 w-full" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border/20 bg-card p-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/20 bg-card">
        <div className="border-b border-border/20 px-3 py-3">
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-full" />
            ))}
          </div>
        </div>

        <div className="space-y-1 px-3 py-2">
          {Array.from({ length: 2 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-7 items-center gap-4 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-18 rounded-md" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border/20 px-4 py-3">
          <Skeleton className="h-5 w-36" />
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-8 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
