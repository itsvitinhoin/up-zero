"use client"

import React, { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { AdminHero, AdminPage, AdminPanel } from "@/components/admin/admin-mobile-ui"
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Folder,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Save,
  Loader2,
} from "lucide-react"
import {
  getCategoriesAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  updateCategoriesOrderAction,
} from "@/lib/actions/categories"
import type { Category } from "@/lib/types"

interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[]
  isExpanded?: boolean
}

interface AdminCategoriesPageClientProps {
  initialCategories: Category[]
}

export default function AdminCategoriesPageClient({
  initialCategories,
}: AdminCategoriesPageClientProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [hasOrderChanges, setHasOrderChanges] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [isDeletingCategory, setIsDeletingCategory] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    isFeatured: false,
    sortOrder: "0",
    parentId: "",
  })

  async function loadData() {
    setIsLoading(true)
    const result = await getCategoriesAction()
    if (result.success && result.data) {
      setCategories(result.data)
    }
    setIsLoading(false)
  }

  const buildCategoryTree = useCallback(
    (cats: Category[]): CategoryWithChildren[] => {
      const map = new Map<string, CategoryWithChildren>()
      const roots: CategoryWithChildren[] = []

      cats.forEach((cat) => {
        map.set(cat.id, { ...cat, children: [], isExpanded: expandedCategories.has(cat.id) })
      })

      cats.forEach((cat) => {
        const node = map.get(cat.id)!
        if (cat.parentId && map.has(cat.parentId)) {
          map.get(cat.parentId)!.children.push(node)
        } else {
          roots.push(node)
        }
      })

      const sortNodes = (nodes: CategoryWithChildren[]) => {
        nodes.sort((a, b) => a.sortOrder - b.sortOrder)
        nodes.forEach((n) => sortNodes(n.children))
      }
      sortNodes(roots)

      return roots
    },
    [expandedCategories],
  )

  const categoryTree = buildCategoryTree(categories)
  const rootCategories = categories.filter((c) => !c.parentId)

  function toggleExpanded(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function openCreateDialog(parentId?: string) {
    setEditingCategory(null)
    const maxOrder = Math.max(
      0,
      ...categories.filter((c) => c.parentId === (parentId || null)).map((c) => c.sortOrder),
    )
    setFormData({
      name: "",
      slug: "",
      isFeatured: false,
      sortOrder: (maxOrder + 1).toString(),
      parentId: parentId || "",
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      isFeatured: category.isFeatured,
      sortOrder: category.sortOrder.toString(),
      parentId: category.parentId || "",
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const fd = new FormData()
    fd.append("name", formData.name)
    fd.append(
      "slug",
      formData.slug ||
        formData.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
    )
    fd.append("isFeatured", formData.isFeatured.toString())
    fd.append("sortOrder", formData.sortOrder)
    fd.append("parentId", formData.parentId || "")

    if (editingCategory) {
      await updateCategoryAction(editingCategory.id, fd)
    } else {
      await createCategoryAction(fd)
    }

    setIsDialogOpen(false)
    loadData()
  }

  async function handleDelete(id: string) {
    const hasChildren = categories.some((c) => c.parentId === id)
    if (hasChildren) {
      alert("Remova as subcategorias antes de excluir esta categoria.")
      return
    }

    const target = categories.find((c) => c.id === id) || null
    setCategoryToDelete(target)
    setDeleteDialogOpen(true)
  }

  async function confirmDeleteCategory() {
    if (!categoryToDelete) return

    setIsDeletingCategory(true)
    await deleteCategoryAction(categoryToDelete.id)
    setDeleteDialogOpen(false)
    setCategoryToDelete(null)
    setIsDeletingCategory(false)
    loadData()
  }

  function handleCategoryDragStart(e: React.DragEvent, id: string) {
    setDraggedItem(id)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleCategoryDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (draggedItem && draggedItem !== id) {
      setDragOverItem(id)
    }
  }

  function handleCategoryDragLeave() {
    setDragOverItem(null)
  }

  function handleCategoryDrop(
    e: React.DragEvent,
    targetId: string,
    targetParentId: string | null,
  ) {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetId) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    const siblings = categories
      .filter((c) => c.parentId === targetParentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    const updates: Array<{ id: string; sortOrder: number; parentId: string | null }> = []
    let newOrder = 1

    siblings.forEach((cat) => {
      if (cat.id === draggedItem) return
      if (cat.id === targetId) {
        updates.push({ id: draggedItem, sortOrder: newOrder++, parentId: targetParentId })
      }
      updates.push({ id: cat.id, sortOrder: newOrder++, parentId: cat.parentId ?? null })
    })

    if (!updates.find((u) => u.id === draggedItem)) {
      updates.push({ id: draggedItem, sortOrder: newOrder, parentId: targetParentId })
    }

    setCategories((prev) =>
      prev.map((c) => {
        const update = updates.find((u) => u.id === c.id)
        return update ? { ...c, sortOrder: update.sortOrder, parentId: update.parentId } : c
      }),
    )
    setHasOrderChanges(true)
    setDraggedItem(null)
    setDragOverItem(null)
  }

  async function saveOrderChanges() {
    setIsSaving(true)
    const updates = categories.map((c) => ({
      id: c.id,
      sortOrder: c.sortOrder,
      parentId: c.parentId ?? null,
    }))
    await updateCategoriesOrderAction(updates)
    setHasOrderChanges(false)
    setIsSaving(false)
  }

  function renderCategoryItem(cat: CategoryWithChildren, level = 0) {
    const hasChildren = cat.children.length > 0
    const isExpanded = expandedCategories.has(cat.id)
    const isDragging = draggedItem === cat.id
    const isDragOver = dragOverItem === cat.id

    return (
      <div key={cat.id}>
        <div
          draggable
          onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
          onDragOver={(e) => handleCategoryDragOver(e, cat.id)}
          onDragLeave={handleCategoryDragLeave}
          onDrop={(e) => handleCategoryDrop(e, cat.id, cat.parentId ?? null)}
          className={`flex items-center gap-2 p-3 rounded-lg border border-border/50 transition-all cursor-move ${
            isDragging ? "opacity-50 border-dashed" : ""
          } ${isDragOver ? "border-primary/70 bg-primary/5" : "bg-card hover:bg-muted/50"}`}
          style={{ marginLeft: level * 24 }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(cat.id)}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />

          <div className="flex-1 min-w-0">
            <span className="font-medium">{cat.name}</span>
            {level > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                Subcategoria
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {cat.isFeatured && (
              <Badge variant="secondary" className="text-xs">
                Destaque
              </Badge>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">#{cat.sortOrder}</span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(cat)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreateDialog(cat.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Subcategoria
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(cat.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 space-y-2">
            {cat.children.map((child) => renderCategoryItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <AdminPage>
      <AdminHero
        icon={Folder}
        eyebrow="Catalogo"
        title="Categorias"
        description="Organize suas categorias em arvore hierarquica com melhor leitura no mobile."
        actions={
          <div className="flex items-center gap-2">
          {hasOrderChanges && (
            <Button onClick={saveOrderChanges} disabled={isSaving} className="min-h-12 rounded-2xl">
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Ordem
            </Button>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openCreateDialog()} className="min-h-12 rounded-2xl">
                <Plus className="mr-2 h-4 w-4" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

                <div className="space-y-2">
                  <Label htmlFor="parentId">Categoria Pai (opcional)</Label>
                  <Select
                    value={formData.parentId || "none"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, parentId: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma (categoria raiz)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (categoria raiz)</SelectItem>
                      {rootCategories
                        .filter((c) => c.id !== editingCategory?.id)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="isFeatured"
                    checked={formData.isFeatured}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isFeatured: checked })
                    }
                  />
                  <Label htmlFor="isFeatured">Destaque na vitrine</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">{editingCategory ? "Salvar" : "Criar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {isLoading ? (
        <AdminPanel><div className="text-center py-12">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Carregando...</p>
        </div></AdminPanel>
      ) : categoryTree.length === 0 ? (
        <AdminPanel className="border-dashed"><div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhuma categoria encontrada</p>
          <Button onClick={() => openCreateDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Primeira Categoria
          </Button>
        </div></AdminPanel>
      ) : (
        <Card className="rounded-[24px] border-border/60 shadow-sm">
          <CardContent className="pt-4 space-y-2">
            <CardDescription className="mb-3">
              Arraste para reordenar. Clique na seta para expandir subcategorias.
            </CardDescription>
            {categoryTree.map((cat) => renderCategoryItem(cat))}
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setCategoryToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria
              {categoryToDelete ? ` "${categoryToDelete.name}"` : ""}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCategory}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              disabled={isDeletingCategory}
            >
              {isDeletingCategory ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}
