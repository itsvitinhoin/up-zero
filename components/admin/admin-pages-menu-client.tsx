"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, FileText, FolderTree, Link as LinkIcon, ArrowLeft, Eye, Loader2, MoreVertical, Pencil, ChevronRight, ChevronDown, GripVertical, Save } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createMenuItemAction, deleteMenuItemAction, updateMenuItemAction, getMenuItemsAction, updateMenuItemsOrderAction } from "@/lib/actions/menus";
import type { MenuItem, Category, InstitutionalPage } from "@/lib/types";

interface MenuItemWithChildren extends MenuItem {
  children: MenuItemWithChildren[];
}

function getMenuScopeLabel(menuType: string) {
  if (menuType === "retail") return "de varejo"
  if (menuType === "wholesale") return "de atacado"
  if (menuType === "footer_retail") return "de footer varejo"
  if (menuType === "footer_wholesale") return "de footer atacado"
  return ""
}

type MenuFormType = MenuItem["type"] | "all-products";

interface AdminMenuPageProps {
  menuId: number;
  storeId: number;
  menuName: string;
  menuType: "retail" | "wholesale";
  initialItems?: MenuItem[];
  initialCategories?: Category[];
  initialInstitutionalPages?: InstitutionalPage[];
}

export default function AdminMenuPage({
  menuId,
  storeId,
  menuName,
  menuType,
  initialItems = [],
  initialCategories = [],
  initialInstitutionalPages = [],
}: AdminMenuPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialItems);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [institutionalPages, setInstitutionalPages] = useState<InstitutionalPage[]>(initialInstitutionalPages);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [hasOrderChanges, setHasOrderChanges] = useState(false);

  const categoryTree = useMemo(() => {
    type CategoryNode = Category & { children: CategoryNode[] };
    const tree: CategoryNode[] = [];
    const map = new Map<string, CategoryNode>();

    categories.forEach(c => map.set(c.id, { ...c, children: [] }));
    categories.forEach(c => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(map.get(c.id)!);
      } else {
        tree.push(map.get(c.id)!);
      }
    });
    return tree;
  }, [categories]);

  const renderCategoryOptions = (nodes: (Category & { children: any[] })[], level = 0) => {
    let options: React.ReactNode[] = [];
    nodes.forEach(node => {
      options.push(
        <SelectItem key={node.id} value={node.id}>
          {'\u00A0'.repeat(level * 4)}{level > 0 ? '└ ' : ''}{node.name}
        </SelectItem>
      );
      if (node.children.length > 0) {
        options = options.concat(renderCategoryOptions(node.children, level + 1));
      }
    });
    return options;
  };

  // Drag state
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formType, setFormType] = useState<MenuFormType>("external");
  const [formHref, setFormHref] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPageId, setFormPageId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formParentId, setFormParentId] = useState<string | null>(null);
    const [formSale, setFormSale] = useState(false);

  async function refreshMenuItems() {
    const menuItemsResult = await getMenuItemsAction(menuId);
    if (menuItemsResult.success) {
      setMenuItems(
        (menuItemsResult.items || []).map((item) => ({
          id: String(item.id),
          parentId: item.parent_id ? String(item.parent_id) : null,
          label: item.label,
          type: item.type,
          href: item.href,
          categoryId: item.category_id ? String(item.category_id) : undefined,
          pageId: item.page_slug || undefined,
          order: item.sort_order,
          isActive: item.is_active,
        }))
      );
      setHasOrderChanges(false);
    }
  }

  const buildMenuTree = useCallback(
    (items: MenuItem[]): MenuItemWithChildren[] => {
      const map = new Map<string, MenuItemWithChildren>();
      const roots: MenuItemWithChildren[] = [];

      items.forEach((item) => {
        map.set(item.id, { ...item, children: [] });
      });

      items.forEach((item) => {
        const node = map.get(item.id)!;
        if (item.parentId && map.has(item.parentId)) {
          map.get(item.parentId)!.children.push(node);
        } else {
          roots.push(node);
        }
      });

      const sortNodes = (nodes: MenuItemWithChildren[]) => {
        nodes.sort((a, b) => a.order - b.order);
        nodes.forEach((n) => sortNodes(n.children));
      };
      sortNodes(roots);

      return roots;
    },
    [],
  );

  const menuTree = buildMenuTree(menuItems);

  function toggleExpanded(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetForm() {
    setFormLabel("");
    setFormType("external");
    setFormHref("");
    setFormCategoryId("");
    setFormPageId("");
    setFormIsActive(true);
    setFormParentId(null);
    setEditingItem(null);
      setFormSale(false);
  }

  function openAddDialog(parentId?: string) {
    resetForm();
    if (parentId) {
      setFormParentId(parentId);
    }
    setDialogOpen(true);
  }

  function openEditDialog(item: MenuItem) {
    setEditingItem(item);
    setFormLabel(item.label);
    setFormType(
      item.type === "external" && (item.href === "/produtos" || item.href === "/produtos?sale=true")
        ? "all-products"
        : item.type
    );
    setFormHref(item.href);
    setFormCategoryId(item.categoryId || "");
    setFormPageId(item.pageId || "");
    setFormIsActive(item.isActive);
    setFormParentId(item.parentId || null);
    setFormSale(item.href.includes("sale=true"));
    setDialogOpen(true);
  }

  function handleTypeChange(type: MenuFormType) {
    setFormType(type);
    if (type === "category" && formCategoryId) {
      const category = categories.find(c => c.id === formCategoryId);
      if (category) {
        const base = `/produtos?category=${category.slug}`;
        setFormHref(formSale ? `${base}&sale=true` : base);
        if (!formLabel) setFormLabel(category.name);
      }
    } else if (type === "all-products") {
      setFormHref(formSale ? "/produtos?sale=true" : "/produtos");
      if (!formLabel) setFormLabel("Todos os produtos");
    } else if (type === "page" && formPageId) {
      const page = institutionalPages.find((p) => p.slug === formPageId);
      if (page) {
        setFormHref(`/p/${page.slug}`);
        if (!formLabel) setFormLabel(page.title);
      }
    }
  }

  function handleCategoryChange(categoryId: string) {
    setFormCategoryId(categoryId);
    const category = categories.find(c => c.id === categoryId);
    if (category) {
        const base = `/produtos?category=${category.slug}`;
        setFormHref(formSale ? `${base}&sale=true` : base);
      if (!formLabel) setFormLabel(category.name);
    }
  }

  function handlePageChange(pageId: string) {
    setFormPageId(pageId);
    const page = institutionalPages.find((p) => p.slug === pageId);
    if (page) {
      setFormHref(`/p/${page.slug}`);
      if (!formLabel) setFormLabel(page.title);
    }
  }

    function applySaleToHref(href: string, sale: boolean): string {
      // Remove qualquer sale=true existente, depois adiciona se necessário
      const clean = href.replace(/([&?])sale=true/g, '$1').replace(/[?&]$/, '').replace(/&&/g, '&');
      if (!sale) return clean;
      return clean.includes('?') ? `${clean}&sale=true` : `${clean}?sale=true`;
    }

    function handleSaleChange(checked: boolean) {
      setFormSale(checked);
      setFormHref((prev) => {
        if (formType === "all-products") {
          return checked ? "/produtos?sale=true" : "/produtos";
        }
        return applySaleToHref(prev, checked);
      });
    }

  async function handleSaveItem() {
    if (!formLabel.trim() || !formHref.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsBusy(true);

    if (editingItem) {
      const result = await updateMenuItemAction(Number(editingItem.id), {
        label: formLabel.trim(),
        type: formType === "all-products" ? "external" : formType,
        href: formHref.trim(),
        category_id: formType === "category" && formCategoryId ? Number(formCategoryId) : undefined,
        page_slug: formType === "page" ? formPageId : undefined,
        is_active: formIsActive,
      });

      if (result.success) {
        toast.success("Item atualizado com sucesso!");
      } else {
        toast.error(result.error || "Erro ao atualizar item");
        setIsBusy(false);
        return;
      }
    } else {
      const siblings = menuItems.filter(i => (i.parentId || null) === (formParentId || null));
      const result = await createMenuItemAction({
        menu_id: menuId,
        parent_id: formParentId ? Number(formParentId) : null,
        label: formLabel.trim(),
        type: formType === "all-products" ? "external" : formType,
        href: formHref.trim(),
        category_id: formType === "category" && formCategoryId ? Number(formCategoryId) : undefined,
        page_slug: formType === "page" ? formPageId : undefined,
        sort_order: siblings.length + 1,
        is_active: formIsActive,
      });

      if (result.success) {
        toast.success("Item adicionado com sucesso!");
        if (formParentId) {
          setExpandedItems(prev => new Set(prev).add(formParentId!));
        }
      } else {
        toast.error(result.error || "Erro ao adicionar item");
        setIsBusy(false);
        return;
      }
    }

    setDialogOpen(false);
    resetForm();
    await refreshMenuItems();
    setIsBusy(false);
  }

  async function handleRemoveItem(id: string) {
    const hasChildren = menuItems.some(item => item.parentId === id);
    if (hasChildren) {
      toast.error("Remova os sub-itens antes de excluir este item.");
      return;
    }

    setIsBusy(true);
    const result = await deleteMenuItemAction(Number(id));
    if (result.success) {
      toast.success("Item removido com sucesso!");
      await refreshMenuItems();
    } else {
      toast.error(result.error || "Erro ao remover item");
    }
    setIsBusy(false);
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    setIsBusy(true);
    const result = await updateMenuItemAction(Number(id), {
      is_active: !currentActive,
    });
    if (result.success) {
      toast.success(!currentActive ? "Item ativado" : "Item desativado");
      await refreshMenuItems();
    } else {
      toast.error(result.error || "Erro ao atualizar item");
    }
    setIsBusy(false);
  }

  // Drag and drop handlers
  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (draggedItem && draggedItem !== id) {
      setDragOverItem(id);
    }
  }

  function handleDragLeave() {
    setDragOverItem(null);
  }

  function handleDrop(e: React.DragEvent, targetId: string, targetParentId: string | null) {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const siblings = menuItems
      .filter((item) => (item.parentId ?? null) === targetParentId)
      .sort((a, b) => a.order - b.order);

    const updates: Array<{ id: string; order: number; parentId: string | null }> = [];
    let newOrder = 1;

    siblings.forEach((item) => {
      if (item.id === draggedItem) return;
      if (item.id === targetId) {
        updates.push({ id: draggedItem, order: newOrder++, parentId: targetParentId });
      }
      updates.push({ id: item.id, order: newOrder++, parentId: item.parentId ?? null });
    });

    if (!updates.find((u) => u.id === draggedItem)) {
      updates.push({ id: draggedItem, order: newOrder, parentId: targetParentId });
    }

    setMenuItems((prev) =>
      prev.map((item) => {
        const update = updates.find((u) => u.id === item.id);
        return update ? { ...item, order: update.order, parentId: update.parentId } : item;
      }),
    );
    setHasOrderChanges(true);
    setDraggedItem(null);
    setDragOverItem(null);
  }

  async function saveOrderChanges() {
    setIsSavingOrder(true);
    const updates = menuItems.map((item) => ({
      id: item.id,
      sortOrder: item.order,
      parentId: item.parentId ?? null,
    }));

    const result = await updateMenuItemsOrderAction(updates);
    if (result.success) {
      toast.success("Ordem salva com sucesso!");
      setHasOrderChanges(false);
      await refreshMenuItems();
    } else {
      toast.error(result.error || "Erro ao salvar ordem");
    }
    setIsSavingOrder(false);
  }

  function getTypeIcon(type: MenuItem["type"]) {
    switch (type) {
      case "category": return <FolderTree className="h-4 w-4" />;
      case "page": return <FileText className="h-4 w-4" />;
      case "external": return <LinkIcon className="h-4 w-4" />;
    }
  }

  function getTypeLabel(type: MenuItem["type"]) {
    switch (type) {
      case "category": return "Categoria";
      case "page": return "Página";
      case "external": return "Link";
    }
  }

  function renderMenuItem(item: MenuItemWithChildren, level = 0) {
    const hasChildren = item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isDragging = draggedItem === item.id;
    const isDragOver = dragOverItem === item.id;

    return (
      <div key={item.id}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item.id, item.parentId ?? null)}
          className={`flex items-center gap-2 p-3 rounded-lg border border-border/50 transition-all cursor-move ${
            isDragging ? "opacity-50 border-dashed" : ""
          } ${isDragOver ? "border-primary/70 bg-primary/5" : ""} ${
            item.isActive ? "bg-card hover:bg-muted/50" : "bg-muted/50 opacity-60"
          }`}
          style={{ marginLeft: level * 24 }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(item.id)}
              className="p-0.5 hover:bg-muted rounded shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.label}</span>
              <Badge variant="secondary" className="text-xs">
                {getTypeIcon(item.type)}
                <span className="ml-1">{getTypeLabel(item.type)}</span>
              </Badge>
              {level > 0 && (
                <Badge variant="outline" className="text-xs">
                  Sub-item
                </Badge>
              )}
              {!item.isActive && (
                <Badge variant="outline" className="text-xs">Inativo</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{item.href}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={item.isActive}
              onCheckedChange={() => handleToggleActive(item.id, item.isActive)}
              disabled={isBusy}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isBusy}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(item)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAddDialog(item.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Sub-item
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-2 space-y-2">
            {item.children.map((child) => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 pb-24 lg:pb-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/pages/menu">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">{menuName}</h1>
            <p className="text-sm text-muted-foreground">
                Itens do menu {getMenuScopeLabel(menuType)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasOrderChanges && (
            <Button onClick={saveOrderChanges} disabled={isSavingOrder} className="h-10">
              {isSavingOrder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Ordem
            </Button>
          )}
          <Link href="/" target="_blank">
            <Button variant="outline" className="h-10">
              <Eye className="mr-2 h-4 w-4" />
              Visualizar
            </Button>
          </Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openAddDialog()} className="h-10" disabled={isBusy}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? "Editar Item" : formParentId ? "Novo Sub-item" : "Novo Item do Menu"}
                </DialogTitle>
                <DialogDescription>
                  {formParentId
                    ? "Adicione um sub-item ao item selecionado."
                    : "Adicione um link para categoria, página institucional ou URL externa."
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formType} onValueChange={(v) => handleTypeChange(v as MenuFormType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-products">Todos os produtos</SelectItem>
                      <SelectItem value="external">Link Externo/URL</SelectItem>
                      <SelectItem value="category">Categoria</SelectItem>
                      <SelectItem value="page">Página Institucional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formType === "category" && (
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={formCategoryId} onValueChange={handleCategoryChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {renderCategoryOptions(categoryTree as any)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formType === "page" && (
                  <div className="space-y-2">
                    <Label>Página</Label>
                    <Select value={formPageId} onValueChange={handlePageChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma página" />
                      </SelectTrigger>
                      <SelectContent>
                        {institutionalPages.length > 0 ? (
                          institutionalPages.map((page) => (
                            <SelectItem key={page.id} value={page.slug}>
                              {page.title}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-3 text-sm text-muted-foreground">
                            Nenhuma página institucional cadastrada.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {institutionalPages.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Crie uma página em <Link href="/pages/institutional" className="underline">Páginas Institucionais</Link> para usar neste menu.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Texto do Menu</Label>
                  <Input
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="Ex: Vestidos, Sobre Nós, Contato"
                  />
                </div>

                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={formHref}
                    onChange={(e) => setFormHref(e.target.value)}
                    placeholder="/produtos ou https://exemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use "/" para links internos ou "https://" para links externos
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                </div>

                  {(formType === "category" || formType === "all-products") && (
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Promoção</Label>
                        <p className="text-xs text-muted-foreground">Adiciona <code>sale=true</code> na URL</p>
                      </div>
                      <Switch checked={formSale} onCheckedChange={handleSaleChange} />
                    </div>
                  )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveItem} disabled={isBusy}>
                  {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingItem ? "Salvar" : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {menuTree.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum item no menu</p>
          <Button onClick={() => openAddDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Primeiro Item
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <CardDescription className="mb-3">
              Arraste para reordenar. Clique na seta para expandir sub-itens.
            </CardDescription>
            {menuTree.map((item) => renderMenuItem(item))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
