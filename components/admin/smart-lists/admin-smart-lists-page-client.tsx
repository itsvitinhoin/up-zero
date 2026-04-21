'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ListFilter,
  Plus,
  Search,
  Star,
  MoreHorizontal,
  Archive,
  Copy,
  Trash2,
  Edit,
  Users,
  RefreshCw,
  ChevronRight,
  Zap,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  archiveSmartListAction,
  deleteSmartListAction,
  toggleSmartListFavoriteAction,
} from '@/lib/actions/smart-lists'
import type { SmartList } from '@/lib/campaigns/types'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Props {
  initialLists: SmartList[]
}

type FilterTab = 'all' | 'dynamic' | 'static' | 'favorites' | 'archived'

const FILTER_LABELS: Record<FilterTab, string> = {
  all: 'Todas',
  dynamic: 'Dinâmicas',
  static: 'Estáticas',
  favorites: 'Favoritas',
  archived: 'Arquivadas',
}

function StatusBadge({ status }: { status: SmartList['status'] }) {
  if (status === 'ARCHIVED') return <Badge variant="secondary">Arquivada</Badge>
  return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Ativa</Badge>
}

function TypeBadge({ type }: { type: SmartList['type'] }) {
  if (type === 'DYNAMIC') {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Zap className="h-3 w-3" />
        Dinâmica
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <Clock className="h-3 w-3" />
      Estática
    </Badge>
  )
}

function ListCard({
  list,
  onToggleFavorite,
  onArchive,
  onDelete,
}: {
  list: SmartList
  onToggleFavorite: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}) {
  const router = useRouter()
  const ruleCount =
    list.rules.rules.length +
    list.rules.groups.reduce((sum, g) => sum + g.rules.length, 0)

  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
      onClick={() => router.push(`/smart-lists/${list.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-sm font-semibold truncate">{list.name}</CardTitle>
              {list.isFavorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
            </div>
            <CardDescription className="text-xs line-clamp-1">{list.description || 'Sem descrição'}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); router.push(`/smart-lists/${list.id}`) }}
              >
                <Edit className="h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(list.id) }}>
                <Star className="h-4 w-4" /> {list.isFavorite ? 'Remover favorito' : 'Favoritar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(list.id) }}>
                <Archive className="h-4 w-4" /> {list.status === 'ARCHIVED' ? 'Reativar' : 'Arquivar'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(list.id) }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={list.type} />
          <StatusBadge status={list.status} />
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{list.resultCount.toLocaleString('pt-BR')}</span>
            <span>clientes</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ListFilter className="h-3.5 w-3.5" />
            <span>{ruleCount} {ruleCount === 1 ? 'regra' : 'regras'}</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {list.lastCalculatedAt
            ? `Atualizado ${formatDistanceToNow(new Date(list.lastCalculatedAt), { locale: ptBR, addSuffix: true })}`
            : `Criado ${formatDistanceToNow(new Date(list.createdAt), { locale: ptBR, addSuffix: true })}`}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminSmartListsPageClient({ initialLists }: Props) {
  const router = useRouter()
  const [lists, setLists] = useState<SmartList[]>(initialLists)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    let result = lists

    if (activeTab === 'dynamic') result = result.filter((l) => l.type === 'DYNAMIC')
    else if (activeTab === 'static') result = result.filter((l) => l.type === 'STATIC')
    else if (activeTab === 'favorites') result = result.filter((l) => l.isFavorite)
    else if (activeTab === 'archived') result = result.filter((l) => l.status === 'ARCHIVED')
    else result = result.filter((l) => l.status !== 'ARCHIVED')

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q),
      )
    }

    return result
  }, [lists, activeTab, search])

  const stats = useMemo(() => ({
    total: lists.filter((l) => l.status === 'ACTIVE').length,
    dynamic: lists.filter((l) => l.type === 'DYNAMIC' && l.status === 'ACTIVE').length,
    favorites: lists.filter((l) => l.isFavorite).length,
    totalCustomers: lists.filter((l) => l.status === 'ACTIVE').reduce((sum, l) => sum + l.resultCount, 0),
  }), [lists])

  const handleToggleFavorite = (id: string) => {
    startTransition(async () => {
      const result = await toggleSmartListFavoriteAction(id)
      if (result.success && result.data) {
        setLists((prev) => prev.map((l) => (l.id === id ? result.data! : l)))
      } else {
        toast.error(result.error ?? 'Erro ao favoritar')
      }
    })
  }

  const handleArchive = (id: string) => {
    startTransition(async () => {
      const result = await archiveSmartListAction(id)
      if (result.success && result.data) {
        setLists((prev) => prev.map((l) => (l.id === id ? result.data! : l)))
        toast.success(result.data.status === 'ARCHIVED' ? 'Lista arquivada' : 'Lista reativada')
      } else {
        toast.error(result.error ?? 'Erro ao arquivar')
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta lista? Esta ação não pode ser desfeita.')) return
    startTransition(async () => {
      const result = await deleteSmartListAction(id)
      if (result.success) {
        setLists((prev) => prev.filter((l) => l.id !== id))
        toast.success('Lista excluída')
      } else {
        toast.error(result.error ?? 'Erro ao excluir')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListFilter className="h-6 w-6" />
            Smart Lists
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Segmentos de clientes com regras dinâmicas e combinadas
          </p>
        </div>
        <Button onClick={() => router.push('/smart-lists/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Lista
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Listas Ativas', value: stats.total },
          { label: 'Dinâmicas', value: stats.dynamic },
          { label: 'Favoritas', value: stats.favorites },
          { label: 'Total Clientes', value: stats.totalCustomers.toLocaleString('pt-BR') },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)} className="w-full md:w-auto">
          <TabsList className="h-9">
            {(Object.keys(FILTER_LABELS) as FilterTab[]).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs px-3">
                {FILTER_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar listas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* List grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <ListFilter className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? 'Nenhuma lista encontrada' : 'Nenhuma lista criada ainda'}
          </p>
          {!search && (
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => router.push('/smart-lists/new')}
            >
              <Plus className="h-4 w-4" />
              Criar primeira lista
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onToggleFavorite={handleToggleFavorite}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
