import { Skeleton } from '@/components/ui/skeleton'

export default function ShowcaseLoading() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Título */}
      <div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-1.5 h-4 w-72" />
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:items-end">
        <div className="space-y-1 lg:w-60 lg:shrink-0">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-1 lg:w-55 lg:shrink-0">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-1 lg:min-w-0 lg:flex-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>

      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>

      {/* Grid principal + sidebar */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        {/* Grid de tiles */}
        <div className="rounded-lg border bg-card xl:min-w-0 xl:flex-1">
          <ul className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 20 }).map((_, i) => (
              <li key={i} className="rounded-lg border bg-background p-2">
                {/* Número + grip */}
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-3 w-6" />
                  <Skeleton className="h-4 w-4" />
                </div>
                {/* Imagem (proporção 3/4) */}
                <div className="relative mb-2 w-full overflow-hidden rounded bg-muted" style={{ aspectRatio: '3/4' }}>
                  <Skeleton className="h-full w-full rounded" />
                </div>
                {/* Nome + código */}
                <Skeleton className="mb-1 h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))}
          </ul>
        </div>

        {/* Sidebar */}
        <aside className="xl:w-72 xl:shrink-0">
          <div className="rounded-lg border bg-card p-3">
            {/* Título + badge */}
            <div className="mb-2 flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {/* Descrição */}
            <Skeleton className="mb-3 h-3 w-full" />
            <Skeleton className="mb-3 h-3 w-4/5" />
            {/* Drop zone vazia */}
            <div className="rounded border border-dashed p-3">
              <Skeleton className="mx-auto h-3 w-44" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
