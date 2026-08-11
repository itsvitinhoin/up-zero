'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminStore } from '@/contexts/admin-store-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteCustomLinkAction } from '@/lib/actions/custom-links'
import { buildStorefrontUrl } from '@/lib/storefront-url'
import type { CustomLinkSummary } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Eye,
  Copy,
  Edit2,
  Trash2,
  MoreHorizontal,
  LinkIcon,
} from 'lucide-react'

interface CustomLinksListClientProps {
  links: CustomLinkSummary[]
}

function useCustomLinkPermissions() {
  const { session } = useAdminStore()
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null

  return {
    canCreateCustomLinks: permissionCodes === null || permissionCodes.includes('custom_links.create'),
    canEditCustomLinks: permissionCodes === null || permissionCodes.includes('custom_links.edit'),
    canDeleteCustomLinks: permissionCodes === null || permissionCodes.includes('custom_links.delete'),
  }
}

export function CustomLinksCreateButton() {
  const { canCreateCustomLinks } = useCustomLinkPermissions()

  if (!canCreateCustomLinks) return null

  return (
    <Link href="/custom-links/new">
      <Button className="gap-2 w-full sm:w-auto">
        <Plus className="h-4 w-4" />
        Novo Link
      </Button>
    </Link>
  )
}

export function CustomLinksListClient({ links }: CustomLinksListClientProps) {
  const router = useRouter()
  const { storefrontUrl, store } = useAdminStore()
  const { canCreateCustomLinks, canEditCustomLinks, canDeleteCustomLinks } = useCustomLinkPermissions()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState('')

  const getPublicLink = (slug: string, origin?: string) => {
    const path = store?.maintenanceMode ? `/private/c/${slug}` : `/c/${slug}`
    return buildStorefrontUrl(storefrontUrl, path, origin)
  }

  const copyLink = (slug: string) => {
    const url = getPublicLink(slug, window.location.origin)
    navigator.clipboard.writeText(url)
  }

  const removeLink = (id: string) => {
    if (!canDeleteCustomLinks) {
      setErrorDialogMessage('Você não tem permissão para excluir links personalizados')
      setErrorDialogOpen(true)
      return
    }

    if (!window.confirm('Deseja realmente excluir este link personalizado?')) return

    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteCustomLinkAction(id)
      setDeletingId(null)
      if (!result.success) {
        setErrorDialogMessage(result.error || 'Erro ao excluir link')
        setErrorDialogOpen(true)
        return
      }
      router.refresh()
    })
  }

  const productLabel = (link: CustomLinkSummary) => (
    link.applyToAllProducts ? 'Todos' : `${link.productCount} produtos`
  )

  return (
    <>
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Erro</DialogTitle>
            <DialogDescription>{errorDialogMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setErrorDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Links Table - Desktop */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Links Criados</CardTitle>
          <CardDescription>Gerencie seus links personalizados e acompanhe performance</CardDescription>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="text-center py-12">
              <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">Nenhum link personalizado criado</p>
              {canCreateCustomLinks ? (
                <Link href="/custom-links/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Primeiro Link
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Preco</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="w-12.5"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => {
                  const ctr = link.clicks > 0 ? ((link.orders / link.clicks) * 100).toFixed(1) : '0.0'
                  return (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">{link.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{productLabel(link)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={link.showPrice ? 'default' : 'outline'}>
                          {link.showPrice ? 'Com preco' : 'Sem preco'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(link.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right font-medium">{link.clicks}</TableCell>
                      <TableCell className="text-right font-medium">{link.orders}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{ctr}%</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyLink(link.slug)} className="gap-2">
                              <Copy className="h-4 w-4" />
                              Copiar Link
                            </DropdownMenuItem>
                            {canEditCustomLinks ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/custom-links/${link.id}`} className="gap-2">
                                  <Edit2 className="h-4 w-4" />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem asChild>
                              <Link href={getPublicLink(link.slug)} target="_blank" className="gap-2">
                                <Eye className="h-4 w-4" />
                                Visualizar
                              </Link>
                            </DropdownMenuItem>
                            {canDeleteCustomLinks ? (
                              <DropdownMenuItem
                                className="gap-2 text-destructive"
                                disabled={isPending && deletingId === link.id}
                                onClick={() => removeLink(link.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                {isPending && deletingId === link.id ? 'Excluindo...' : 'Deletar'}
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Links Cards - Mobile */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Links Criados</h2>
          <span className="text-sm text-muted-foreground">{links.length} links</span>
        </div>

        {links.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <LinkIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-4">Nenhum link criado</p>
              {canCreateCustomLinks ? (
                <Link href="/custom-links/new">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Link
                  </Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          links.map((link) => {
            const ctr = link.clicks > 0 ? ((link.orders / link.clicks) * 100).toFixed(1) : '0.0'
            return (
              <Card key={link.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{link.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {productLabel(link)} • Criado em {new Date(link.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {link.showPrice ? 'Com preco' : 'Sem preco'}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyLink(link.slug)} className="gap-2">
                          <Copy className="h-4 w-4" />
                          Copiar Link
                        </DropdownMenuItem>
                        {canEditCustomLinks ? (
                          <DropdownMenuItem asChild>
                            <Link href={`/custom-links/${link.id}`} className="gap-2">
                              <Edit2 className="h-4 w-4" />
                              Editar
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem asChild>
                          <Link href={getPublicLink(link.slug)} target="_blank" className="gap-2">
                            <Eye className="h-4 w-4" />
                            Visualizar
                          </Link>
                        </DropdownMenuItem>
                        {canDeleteCustomLinks ? (
                          <DropdownMenuItem
                            className="gap-2 text-destructive"
                            disabled={isPending && deletingId === link.id}
                            onClick={() => removeLink(link.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {isPending && deletingId === link.id ? 'Excluindo...' : 'Deletar'}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                    <div className="text-center">
                      <p className="text-lg font-semibold">{link.clicks}</p>
                      <p className="text-xs text-muted-foreground">Cliques</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">{link.orders}</p>
                      <p className="text-xs text-muted-foreground">Pedidos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">{ctr}%</p>
                      <p className="text-xs text-muted-foreground">CTR</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </>
  )
}
