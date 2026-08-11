'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, createMenuAction, deleteMenuAction, updateMenuAction } from '@/lib/actions/menus'
import { useAdminStore } from '@/contexts/admin-store-context'
import { toast } from 'sonner'
import {
  ListTree,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import type { MenuType } from '@/lib/actions/menus'

interface AdminMenusListClientProps {
  menus: Menu[]
}

export default function AdminMenusListClient({ menus: initialMenus }: AdminMenusListClientProps) {
  const { session } = useAdminStore()
  const router = useRouter()
  const [menus, setMenus] = useState<Menu[]>(initialMenus)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [deletingMenu, setDeletingMenu] = useState<Menu | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'retail' as MenuType,
  })
  const permissionCodes = Array.isArray(session?.permissionCodes)
    ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
    : null
  const canCreatePages = permissionCodes === null || permissionCodes.includes('pages.create')
  const canEditPages = permissionCodes === null || permissionCodes.includes('pages.edit')
  const canDeletePages = permissionCodes === null || permissionCodes.includes('pages.delete')

  const handleMenuClick = (menuId: number) => {
    router.push(`/pages/menu/${menuId}`)
  }

  function openCreateDialog() {
    if (!canCreatePages) {
      toast.error('Você não tem permissão para criar páginas')
      return
    }

    setEditingMenu(null)
    setFormData({ name: '', code: '', type: 'retail' })
    setIsDialogOpen(true)
  }

  function openEditDialog(menu: Menu) {
    if (!canEditPages) {
      toast.error('Você não tem permissão para editar páginas')
      return
    }

    setEditingMenu(menu)
    setFormData({
      name: menu.name,
      code: menu.code || '',
      type: menu.type,
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingMenu && !canEditPages) {
      toast.error('Você não tem permissão para editar páginas')
      return
    }
    if (!editingMenu && !canCreatePages) {
      toast.error('Você não tem permissão para criar páginas')
      return
    }

    setIsLoading(true)

    try {
      if (editingMenu) {
        const result = await updateMenuAction(editingMenu.id, {
          name: formData.name,
          code: formData.code,
        })
        if (result.success && result.menu) {
          setMenus((prev) =>
            prev.map((m) => (m.id === editingMenu.id ? result.menu! : m))
          )
          setIsDialogOpen(false)
        } else {
          toast.error(result.error || 'Erro ao atualizar menu')
        }
      } else {
        const result = await createMenuAction({
          name: formData.name,
          code: formData.code,
          type: formData.type,
          is_active: true,
        })
        if (result.success && result.menu) {
          setMenus((prev) => [...prev, result.menu!])
          setIsDialogOpen(false)
        } else {
          toast.error(result.error || 'Erro ao criar menu')
        }
      }
    } catch (err) {
      console.error('Erro ao salvar menu:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(menuId: number) {
    if (!canDeletePages) {
      toast.error('Você não tem permissão para excluir páginas')
      return
    }

    const result = await deleteMenuAction(menuId)
    if (result.success) {
      setMenus((prev) => prev.filter((m) => m.id !== menuId))
    } else {
      toast.error(result.error || 'Erro ao excluir menu')
    }
    setDeletingMenu(null)
  }

  async function handleToggleActive(menu: Menu) {
    if (!canEditPages) {
      toast.error('Você não tem permissão para editar páginas')
      return
    }

    const result = await updateMenuAction(menu.id, {
      is_active: !menu.is_active,
    })
    if (result.success && result.menu) {
      setMenus((prev) =>
        prev.map((m) => (m.id === menu.id ? result.menu! : m))
      )
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">Menus</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os menus de navegação da sua loja
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {canCreatePages ? (
            <DialogTrigger asChild>
              <Button onClick={() => openCreateDialog()} className="h-10">
                <Plus className="mr-2 h-4 w-4" />
                Novo Menu
              </Button>
            </DialogTrigger>
          ) : null}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingMenu ? 'Editar Menu' : 'Novo Menu'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Menu Principal"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Codigo</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ex: menu-principal-varejo"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingMenu ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {menus.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ListTree className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum menu encontrado</p>
          {canCreatePages ? (
            <Button onClick={() => openCreateDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Menu
            </Button>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <CardDescription className="mb-3">
              Clique em um menu para gerenciar seus itens de navegação.
            </CardDescription>
            {menus.map((menu) => (
              <div
                key={menu.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-all cursor-pointer"
                onClick={() => handleMenuClick(menu.id)}
              >
                <ListTree className="h-4 w-4 text-muted-foreground shrink-0" />

                <div className="flex-1 min-w-0">
                  <span className="font-medium">{menu.name}</span>
                  {!menu.is_active && (
                    <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                      Inativo
                    </Badge>
                  )}
                  {menu.code && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Codigo: {menu.code}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                  >
                    <ListTree className="h-4 w-4" />
                    <span className="hidden lg:inline">Gerenciar Itens</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEditPages ? (
                        <DropdownMenuItem onClick={() => openEditDialog(menu)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      ) : null}
                      {canEditPages ? (
                        <DropdownMenuItem onClick={() => handleToggleActive(menu)}>
                          {menu.is_active ? (
                            <>
                              <ToggleLeft className="mr-2 h-4 w-4" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <ToggleRight className="mr-2 h-4 w-4" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                      ) : null}
                      {canDeletePages ? (
                        <DropdownMenuItem
                          onClick={() => setDeletingMenu(menu)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deletingMenu} onOpenChange={(open) => { if (!open) setDeletingMenu(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir menu</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o menu <strong>{deletingMenu?.name}</strong>? Esta ação não pode ser desfeita e todos os itens do menu serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMenu && handleDelete(deletingMenu.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
