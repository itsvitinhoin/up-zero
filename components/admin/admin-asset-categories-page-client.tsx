"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Plus, MoreHorizontal, Pencil, Trash2, Folder, Search } from "lucide-react"
import {
  createAssetCategoryAction,
  updateAssetCategoryAction,
  deleteAssetCategoryAction,
} from "@/lib/actions/asset-categories"
import type { Category } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface AdminAssetCategoriesPageClientProps {
  initialCategories: Category[]
  storeId: number | null
}

export default function AdminAssetCategoriesPageClient({
  initialCategories,
  storeId,
}: AdminAssetCategoriesPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [search, setSearch] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    isActive: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)

  useEffect(() => {
    setCategories(initialCategories)
  }, [initialCategories])

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase()) ||
    category.slug.toLowerCase().includes(search.toLowerCase()),
  )

  function slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  function openCreateDialog() {
    setEditingCategory(null)
    setFormData({
      name: "",
      slug: "",
      isActive: true,
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      isActive: category.isActive ?? true,
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({
        description: "Nome é obrigatório",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      const fd = new FormData()
      fd.append("name", formData.name)
      fd.append("slug", formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"))
      fd.append("isActive", String(formData.isActive))
      if (storeId) {
        fd.append("storeId", String(storeId))
      }

      if (editingCategory) {
        const result = await updateAssetCategoryAction(editingCategory.id, fd)
        if (!result.success) {
          toast({
            description: result.error || "Erro ao atualizar categoria de asset",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
        toast({
          description: "Categoria de asset atualizada com sucesso",
        })

        if (result.data) {
          setCategories((prev) =>
            prev.map((category) =>
              category.id === editingCategory.id ? result.data! : category,
            ),
          )
        }
      } else {
        const result = await createAssetCategoryAction(fd)
        if (!result.success) {
          toast({
            description: result.error || "Erro ao criar categoria de asset",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
        toast({
          description: "Categoria de asset criada com sucesso",
        })

        if (result.data) {
          setCategories((prev) => [result.data!, ...prev])
        }
      }

      setIsDialogOpen(false)
      router.refresh()
    } catch {
      toast({
        description: "Erro ao salvar categoria de asset",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleDelete(id: string) {
    setCategoryToDelete(id)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!categoryToDelete) return

    try {
      const result = await deleteAssetCategoryAction(categoryToDelete)
      if (!result.success) {
        toast({
          description: result.error || "Erro ao deletar categoria de asset",
          variant: "destructive",
        })
        setDeleteDialogOpen(false)
        setCategoryToDelete(null)
        return
      }

      toast({
        description: "Categoria de asset deletada com sucesso",
      })
      setCategories((prev) => prev.filter((category) => category.id !== categoryToDelete))
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
      router.refresh()
    } catch {
      toast({
        description: "Erro ao deletar categoria de asset",
        variant: "destructive",
      })
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    }
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            Categorias de Assets
          </h1>
          <p className="text-sm text-muted-foreground">Organize seus assets em categorias próprias</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Nova Categoria de Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Editar Categoria de Asset" : "Nova Categoria de Asset"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    const nextName = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      name: nextName,
                      slug: editingCategory ? prev.slug : slugify(nextName),
                    }))
                  }}
                  placeholder="Ex: Quadros Premium"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="gerado-automaticamente"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.isActive ? "Categoria ativa" : "Categoria inativa"}
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSaving}
                  className="cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="cursor-pointer">
                  {isSaving ? "Salvando..." : editingCategory ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/20 bg-card p-3">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar categorias de assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/20 bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Folder className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {categories.length === 0
                      ? "Nenhuma categoria de asset encontrada"
                      : "Nenhuma categoria corresponde à busca"}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {category.slug}
                  </TableCell>
                  <TableCell>
                    {(category.isActive ?? true) ? (
                      <Badge variant="emerald">Ativa</Badge>
                    ) : (
                      <Badge variant="slate">Inativa</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEditDialog(category)}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(category.id)}
                          className="cursor-pointer text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar categoria de asset?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso removerá a categoria de asset permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
