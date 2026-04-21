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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, createMenuAction, deleteMenuAction, updateMenuAction } from '@/lib/actions/menus'
import { toast } from 'sonner'
import {
  ListTree,
  Store,
  Package,
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
  const router = useRouter()
  const [menus, setMenus] = useState<Menu[]>(initialMenus)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [deletingMenu, setDeletingMenu] = useState<Menu | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'retail' as MenuType,
  })

  const getMenuTypeLabel = (type: MenuType) => {
    if (type === 'retail') return 'Varejo'
    if (type === 'wholesale') return 'Atacado'
    if (type === 'footer_retail') return 'Footer Varejo'
    return 'Footer Atacado'
  }

  const getMenuBadgeVariant = (type: MenuType) => {
    if (type === 'retail' || type === 'footer_retail') return 'default' as const
    return 'secondary' as const
  }

  const handleMenuClick = (menuId: number) => {
    router.push(`/pages/menu/${menuId}`)
  }

  const getMenuIcon = (type: string) => {
    return type === 'retail' ? <Store className="h-4 w-4 text-muted-foreground shrink-0" /> : <Package className="h-4 w-4 text-muted-foreground shrink-0" />
  }

  function openCreateDialog() {
    setEditingMenu(null)
    setFormData({ name: '', type: 'retail' })
    setIsDialogOpen(true)
  }

  function openEditDialog(menu: Menu) {
    setEditingMenu(menu)
    setFormData({ name: menu.name, type: menu.type })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (editingMenu) {
        const result = await updateMenuAction(editingMenu.id, {
          name: formData.name,
          type: formData.type,
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
    const result = await deleteMenuAction(menuId)
    if (result.success) {
      setMenus((prev) => prev.filter((m) => m.id !== menuId))
    } else {
      toast.error(result.error || 'Erro ao excluir menu')
    }
    setDeletingMenu(null)
  }

  async function handleToggleActive(menu: Menu) {
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
          <DialogTrigger asChild>
            <Button onClick={() => openCreateDialog()} className="h-10">
              <Plus className="mr-2 h-4 w-4" />
              Novo Menu
            </Button>
          </DialogTrigger>
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
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, type: v as MenuType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Varejo</SelectItem>
                    <SelectItem value="wholesale">Atacado</SelectItem>
                    <SelectItem value="footer_retail">Footer Varejo</SelectItem>
                    <SelectItem value="footer_wholesale">Footer Atacado</SelectItem>
                  </SelectContent>
                </Select>
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
          <Button onClick={() => openCreateDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Primeiro Menu
          </Button>
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
                {getMenuIcon(menu.type)}

                <div className="flex-1 min-w-0">
                  <span className="font-medium">{menu.name}</span>
                  <Badge variant={getMenuBadgeVariant(menu.type)} className="ml-2 text-xs">
                    {getMenuTypeLabel(menu.type)}
                  </Badge>
                  {!menu.is_active && (
                    <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                      Inativo
                    </Badge>
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
                      <DropdownMenuItem onClick={() => openEditDialog(menu)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
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
                      <DropdownMenuItem
                        onClick={() => setDeletingMenu(menu)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
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
