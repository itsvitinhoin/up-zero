'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FilterX, Search, ShoppingBag, UserCog, Users } from 'lucide-react'
import AdminPaginationControls from '@/components/admin/admin-pagination-controls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { parseOfflinePageLimit } from '@/lib/offline-page-utils'

const OFFLINE_ICONS = {
  customers: Users,
  sellers: UserCog,
  orders: ShoppingBag,
} as const

export type OfflineEntityIcon = keyof typeof OFFLINE_ICONS

export interface OfflineEntityListClientProps {
  title: string
  eyebrow: string
  description: string
  icon: OfflineEntityIcon
  searchPlaceholder: string
  emptyMessage: string
  headers: string[]
  rows: ReactNode[][]
  total: number
  currentPage: number
  pageSize: number
  initialSearch: string
  error?: string | null
}

export function OfflineEntityListClient({
  title,
  eyebrow,
  description,
  icon,
  searchPlaceholder,
  emptyMessage,
  headers,
  rows,
  total,
  currentPage,
  pageSize,
  initialSearch,
  error,
}: OfflineEntityListClientProps) {
  const Icon = OFFLINE_ICONS[icon]
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(initialSearch)
  const [selectedLimit, setSelectedLimit] = useState(parseOfflinePageLimit(pageSize))

  const totalPages = Math.max(1, Math.ceil(total / Math.max(selectedLimit, 1)))
  const showingStart = total === 0 ? 0 : (currentPage - 1) * selectedLimit + 1
  const showingEnd = Math.min(currentPage * selectedLimit, total)

  useEffect(() => {
    setSearch(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setSelectedLimit(parseOfflinePageLimit(pageSize))
  }, [pageSize])

  function navigateWithParams(nextPage: number, nextSearch: string, nextLimit = selectedLimit) {
    const params = new URLSearchParams()
    const trimmedSearch = nextSearch.trim()
    if (trimmedSearch) params.set('q', trimmedSearch)
    if (nextLimit !== 20) params.set('limit', String(nextLimit))
    if (nextPage > 1) params.set('page', String(nextPage))

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
    router.refresh()
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigateWithParams(1, search)
  }

  function applyPageLimit(nextLimit: number) {
    setSelectedLimit(nextLimit)
    navigateWithParams(1, search, nextLimit)
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer [&_[role='button']:not([aria-disabled='true'])]:cursor-pointer">
      <div className="rounded-2xl border border-border/40 bg-linear-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <Icon className="h-6 w-6 text-primary" />
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form
        className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm"
        onSubmit={handleSearchSubmit}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 rounded-full pl-10"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-10 shrink-0 rounded-full px-5">
              Buscar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={String(selectedLimit)}
              onValueChange={(value) => {
                const nextLimit = Number.parseInt(value, 10)
                if (!Number.isFinite(nextLimit)) return
                applyPageLimit(nextLimit)
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full sm:w-auto xl:w-40">
                <SelectValue placeholder="Itens/página" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 por página</SelectItem>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              title="Limpar filtros"
              aria-label="Limpar filtros"
              onClick={() => {
                setSearch('')
                navigateWithParams(1, '', selectedLimit)
              }}
            >
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={`${title}-${index}`} className="hover:bg-muted/40">
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${index}-${cellIndex}`}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => navigateWithParams(page, search)}
        showing={{
          start: showingStart,
          end: showingEnd,
          total,
        }}
      />
    </div>
  )
}
