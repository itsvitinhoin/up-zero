"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, ImageIcon, Layers3, Loader2, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { updateMegaMenuPresentationAction } from "@/lib/actions/settings";
import { GROOVY_MEGA_MENU_EDITORIAL } from "@/lib/storefront-templates";
import type {
  MegaMenuAssignments,
  MegaMenuEditorialItem,
  MegaMenuEditorialKey,
  MegaMenuNavigation,
  MegaMenuNavigationColumn,
  MenuItem,
} from "@/lib/types";
import { useAdminStore } from "@/contexts/admin-store-context";
import { Button } from "@/components/ui/button";
import { CloudflareImage } from "@/components/ui/cloudflare-image";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

type MenuItemTree = MenuItem & { children: MenuItemTree[] };

const LAYOUT_LABELS: Record<MegaMenuEditorialKey, string> = {
  newArrivals: "Novidades — lançamentos e destaque",
  clothing: "Categorias — duas colunas e imagem",
  bestSellers: "Mais vendidos — filtros e destaque",
  restocks: "Reposições — links e chamada editorial",
};

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function suggestLayout(item: MenuItemTree): MegaMenuEditorialKey {
  const normalized = normalizeLabel(item.label);
  if (normalized.includes("nov") || normalized.includes("lanc")) return "newArrivals";
  if (normalized.includes("vend") || normalized.includes("best")) return "bestSellers";
  if (normalized.includes("repos")) return "restocks";
  return "clothing";
}

const DEFAULT_COLUMN_TITLES: Record<MegaMenuEditorialKey, [string, string]> = {
  newArrivals: ["Últimos lançamentos", "Em destaque"],
  clothing: ["Categorias", "Compre por"],
  bestSellers: ["Mais vendidos", "Filtre por"],
  restocks: ["Reposições", "Mais procurados"],
};

function createColumns(
  children: MenuItemTree[],
  layoutKey: MegaMenuEditorialKey,
  savedNavigation?: MegaMenuNavigation[string],
): [MegaMenuNavigationColumn, MegaMenuNavigationColumn] {
  const childIds = new Set(children.map((child) => child.id));
  const defaults = DEFAULT_COLUMN_TITLES[layoutKey];
  const columns: [MegaMenuNavigationColumn, MegaMenuNavigationColumn] = [0, 1].map((index) => ({
    title: savedNavigation?.columns[index]?.title || defaults[index],
    itemIds: (savedNavigation?.columns[index]?.itemIds || []).filter((itemId) => childIds.has(itemId)),
  })) as [MegaMenuNavigationColumn, MegaMenuNavigationColumn];

  const assigned = new Set(columns.flatMap((column) => column.itemIds));
  for (const child of children) {
    if (assigned.has(child.id)) continue;
    const targetIndex = columns[0].itemIds.length <= columns[1].itemIds.length ? 0 : 1;
    columns[targetIndex].itemIds.push(child.id);
    assigned.add(child.id);
  }

  return columns;
}

function reconcileColumns(
  current: [MegaMenuNavigationColumn, MegaMenuNavigationColumn],
  children: MenuItemTree[],
  preferredColumn: 0 | 1 | null,
): [MegaMenuNavigationColumn, MegaMenuNavigationColumn] {
  const validIds = new Set(children.map((child) => child.id));
  const next = current.map((column) => ({
    ...column,
    itemIds: column.itemIds.filter((itemId) => validIds.has(itemId)),
  })) as [MegaMenuNavigationColumn, MegaMenuNavigationColumn];
  const assigned = new Set(next.flatMap((column) => column.itemIds));

  for (const child of children) {
    if (assigned.has(child.id)) continue;
    const targetIndex = preferredColumn ?? (next[0].itemIds.length <= next[1].itemIds.length ? 0 : 1);
    next[targetIndex].itemIds.push(child.id);
    assigned.add(child.id);
  }
  return next;
}

interface AdminMegaMenuEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MenuItemTree | null;
  rootItems: MenuItemTree[];
  activeTemplateKey: "classic" | "groovy";
  editorialConfig: Partial<Record<MegaMenuEditorialKey, MegaMenuEditorialItem>>;
  assignments: MegaMenuAssignments;
  navigationConfig: MegaMenuNavigation;
  onSaved: (next: {
    assignments: MegaMenuAssignments;
    editorialConfig: Partial<Record<MegaMenuEditorialKey, MegaMenuEditorialItem>>;
    navigationConfig: MegaMenuNavigation;
  }) => void;
  onEditItem: (item: MenuItem) => void;
  onAddSubItem: (parentId: string, columnIndex: 0 | 1) => void;
}

export function AdminMegaMenuEditor({
  open,
  onOpenChange,
  item,
  rootItems,
  activeTemplateKey,
  editorialConfig,
  assignments,
  navigationConfig = {},
  onSaved,
  onEditItem,
  onAddSubItem,
}: AdminMegaMenuEditorProps) {
  const { storefrontUrl } = useAdminStore();
  const assignedLayout = item ? assignments[item.id] || null : null;
  const initialLayout = item ? assignedLayout || suggestLayout(item) : "clothing";
  const [enabled, setEnabled] = useState(Boolean(assignedLayout));
  const [layoutKey, setLayoutKey] = useState<MegaMenuEditorialKey>(initialLayout);
  const [editorial, setEditorial] = useState<MegaMenuEditorialItem>({
    ...GROOVY_MEGA_MENU_EDITORIAL[initialLayout],
    ...(editorialConfig[initialLayout] || {}),
  });
  const [draftColumns, setDraftColumns] = useState<[MegaMenuNavigationColumn, MegaMenuNavigationColumn]>(() =>
    createColumns(item?.children || [], initialLayout, item ? navigationConfig[item.id] : undefined),
  );
  const [preferredColumnForNewItems, setPreferredColumnForNewItems] = useState<0 | 1 | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const childrenById = useMemo(
    () => new Map((item?.children || []).map((child) => [child.id, child])),
    [item?.children],
  );
  const columns = useMemo(
    () => reconcileColumns(draftColumns, item?.children || [], preferredColumnForNewItems),
    [draftColumns, item?.children, preferredColumnForNewItems],
  );
  const editorialImagePreviewUrl = useMemo(() => {
    const imageUrl = editorial.imageUrl?.trim();
    if (!imageUrl || !imageUrl.startsWith("/")) return imageUrl || null;

    const configuredBase = String(process.env.NEXT_PUBLIC_STORE_URL || storefrontUrl || "").trim();
    if (!/^https?:\/\//i.test(configuredBase)) return imageUrl;

    try {
      return new URL(imageUrl, configuredBase).toString();
    } catch {
      return imageUrl;
    }
  }, [editorial.imageUrl, storefrontUrl]);
  const isGroovy = activeTemplateKey === "groovy";

  function changeLayout(nextLayout: MegaMenuEditorialKey) {
    setLayoutKey(nextLayout);
    setEditorial({
      ...GROOVY_MEGA_MENU_EDITORIAL[nextLayout],
      ...(editorialConfig[nextLayout] || {}),
    });
    setDraftColumns(() => {
      const previousDefaults = DEFAULT_COLUMN_TITLES[layoutKey];
      const nextDefaults = DEFAULT_COLUMN_TITLES[nextLayout];
      return columns.map((column, index) => ({
        ...column,
        title: column.title === previousDefaults[index] ? nextDefaults[index] : column.title,
      })) as [MegaMenuNavigationColumn, MegaMenuNavigationColumn];
    });
  }

  function updateEditorial(updates: Partial<MegaMenuEditorialItem>) {
    setEditorial((current) => ({ ...current, ...updates }));
  }

  function updateColumnTitle(columnIndex: 0 | 1, title: string) {
    setDraftColumns(columns.map((column, index) => (
      index === columnIndex ? { ...column, title } : column
    )) as [MegaMenuNavigationColumn, MegaMenuNavigationColumn]);
  }

  function moveItem(itemId: string, sourceIndex: 0 | 1) {
    const targetIndex = sourceIndex === 0 ? 1 : 0;
    setDraftColumns(columns.map((column, index) => {
      if (index === sourceIndex) return { ...column, itemIds: column.itemIds.filter((id) => id !== itemId) };
      if (index === targetIndex) return { ...column, itemIds: [...column.itemIds, itemId] };
      return column;
    }) as [MegaMenuNavigationColumn, MegaMenuNavigationColumn]);
  }

  function addSubItem(columnIndex: 0 | 1) {
    if (!item) return;
    setPreferredColumnForNewItems(columnIndex);
    onAddSubItem(item.id, columnIndex);
  }

  async function savePresentation() {
    if (!item) return;
    setIsSaving(true);
    const result = await updateMegaMenuPresentationAction({
      menuItemId: item.id,
      layoutKey: enabled ? layoutKey : null,
      editorial: enabled ? editorial : undefined,
      navigation: enabled ? { columns } : undefined,
    });

    if (!result.success) {
      toast.error(result.error || "Não foi possível salvar o mega menu");
      setIsSaving(false);
      return;
    }

    const nextAssignments = { ...assignments };
    delete nextAssignments[item.id];
    if (enabled) {
      for (const [assignedItemId, value] of Object.entries(nextAssignments)) {
        if (value === layoutKey) delete nextAssignments[assignedItemId];
      }
      nextAssignments[item.id] = layoutKey;
    }
    const nextEditorial = enabled
      ? { ...editorialConfig, [layoutKey]: editorial }
      : editorialConfig;
    const nextNavigation = { ...navigationConfig };
    if (enabled) nextNavigation[item.id] = { columns };
    else delete nextNavigation[item.id];

    onSaved({ assignments: nextAssignments, editorialConfig: nextEditorial, navigationConfig: nextNavigation });
    toast.success(enabled ? "Mega menu publicado" : "Mega menu desativado");
    setIsSaving(false);
  }

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-[96vw] xl:max-w-[1500px]">
        <SheetHeader className="border-b px-6 py-5 pr-14">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Layers3 className="h-5 w-5" />
            Personalizar “{item.label}”
          </SheetTitle>
          <SheetDescription>
            Organize os subitens e veja como o menu será apresentado na vitrine.
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.75fr)]">
          <section className="min-h-0 overflow-y-auto bg-muted/40 p-4 sm:p-6 lg:p-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Eye className="h-4 w-4" /> Prévia do mega menu
              </div>
              <span className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                Desktop
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="flex min-h-16 items-end gap-7 overflow-x-auto border-b px-6 text-sm font-medium text-zinc-500">
                {rootItems.map((rootItem) => (
                  <span
                    key={rootItem.id}
                    className={`whitespace-nowrap border-b-2 pb-4 ${rootItem.id === item.id ? "border-zinc-950 text-zinc-950" : "border-transparent"}`}
                  >
                    {rootItem.label}
                  </span>
                ))}
              </div>

              {enabled && isGroovy ? (
                <div className="grid min-h-[390px] gap-8 p-7 xl:grid-cols-[0.9fr_0.9fr_1.25fr] xl:gap-12 xl:p-10">
                  {([0, 1] as const).map((columnIndex) => (
                    <div key={columnIndex}>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-800">{columns[columnIndex].title}</p>
                      <div className="divide-y divide-zinc-200 border-t border-zinc-200">
                        {columns[columnIndex].itemIds.map((itemId) => {
                          const child = childrenById.get(itemId);
                          if (!child) return null;
                          return (
                            <div key={child.id} className="group flex min-h-11 items-center gap-2 py-2 text-sm text-zinc-800">
                              <button type="button" onClick={() => onEditItem(child)} className="min-w-0 flex-1 truncate text-left hover:underline">
                                {child.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(child.id, columnIndex)}
                                className="rounded p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-950 group-hover:opacity-100 focus:opacity-100"
                                aria-label={`Mover ${child.label} para ${columns[columnIndex === 0 ? 1 : 0].title}`}
                              >
                                {columnIndex === 0 ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => addSubItem(columnIndex)}
                          className="flex min-h-11 w-full items-center gap-2 border-b border-dashed py-2 text-left text-sm font-medium text-zinc-500 transition hover:text-zinc-950"
                        >
                          <Plus className="h-4 w-4" /> Adicionar link
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="self-start">
                    <div className="relative aspect-[4/2.6] overflow-hidden bg-zinc-200">
                      {editorialImagePreviewUrl ? (
                        <CloudflareImage
                          src={editorialImagePreviewUrl}
                          alt={editorial.title || "Destaque do mega menu"}
                          fill
                          className="object-cover"
                          cloudflare={{ width: 900, height: 585, fit: "cover", dpr: 2 }}
                          sizes="(min-width: 1280px) 360px, 50vw"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-500">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">{editorial.eyebrow}</p>
                    <p className="mt-1 text-lg font-semibold uppercase text-zinc-950">{editorial.title}</p>
                    {editorial.description ? <p className="mt-1 text-sm text-zinc-600">{editorial.description}</p> : null}
                    <p className="mt-4 inline-flex items-center gap-2 text-sm underline underline-offset-4">
                      {editorial.ctaText || "Ver produtos"} <ArrowRight className="h-4 w-4" />
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[390px] items-center justify-center p-8 text-center">
                  <div className="max-w-sm">
                    <Layers3 className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                    <p className="font-medium">Mega menu desativado neste item</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ative a opção no painel ao lado para transformar “{item.label}” em um menu expandido.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto border-l bg-background p-5 sm:p-6">
            {!isGroovy ? (
              <div className="mb-5 rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                O editor visual de mega menu não está disponível no tema atual. Instale o tema Groovy para usar este formato.
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="mega-menu-enabled" className="text-sm font-semibold">Usar mega menu</Label>
                <p className="mt-1 text-xs text-muted-foreground">Abre uma navegação ampla ao passar o mouse.</p>
              </div>
              <Switch id="mega-menu-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!isGroovy} />
            </div>

            <Separator className="my-6" />

            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select value={layoutKey} onValueChange={(value) => changeLayout(value as MegaMenuEditorialKey)} disabled={!enabled || !isGroovy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LAYOUT_LABELS) as MegaMenuEditorialKey[]).map((key) => (
                      <SelectItem key={key} value={key}>{LAYOUT_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Conteúdo de navegação</p>
                    <p className="mt-1 text-xs text-muted-foreground">Sem limite de links. Adicione em qualquer coluna.</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => onEditItem(item)} aria-label="Editar item principal">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                {([0, 1] as const).map((columnIndex) => (
                  <div key={columnIndex} className="rounded-md bg-muted/45 p-3">
                    <Label htmlFor={`mega-menu-column-${columnIndex}`} className="text-xs">Título da coluna {columnIndex + 1}</Label>
                    <Input
                      id={`mega-menu-column-${columnIndex}`}
                      value={columns[columnIndex].title}
                      onChange={(event) => updateColumnTitle(columnIndex, event.target.value)}
                      className="mt-2 bg-background"
                      disabled={!enabled || !isGroovy}
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{columns[columnIndex].itemIds.length} link(s)</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => addSubItem(columnIndex)} disabled={!enabled || !isGroovy}>
                        <Plus className="mr-1.5 h-4 w-4" /> Adicionar link
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Imagem do destaque</Label>
                <ImageUpload
                  value={editorialImagePreviewUrl}
                  onChange={(imageUrl) => updateEditorial({ imageUrl })}
                  imageType="categoryBanner"
                  folder="banners/mega-menu"
                  disabled={!enabled || !isGroovy}
                  hideRecommendation
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label>Chamada</Label>
                  <Input value={editorial.eyebrow} onChange={(event) => updateEditorial({ eyebrow: event.target.value })} disabled={!enabled || !isGroovy} />
                </div>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={editorial.title} onChange={(event) => updateEditorial({ title: event.target.value })} disabled={!enabled || !isGroovy} />
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  <Label>Descrição opcional</Label>
                  <Input value={editorial.description || ""} onChange={(event) => updateEditorial({ description: event.target.value || null })} disabled={!enabled || !isGroovy} />
                </div>
                <div className="space-y-2">
                  <Label>Texto do CTA</Label>
                  <Input value={editorial.ctaText} onChange={(event) => updateEditorial({ ctaText: event.target.value })} disabled={!enabled || !isGroovy} />
                </div>
                <div className="space-y-2">
                  <Label>Link do CTA</Label>
                  <Input value={editorial.href} onChange={(event) => updateEditorial({ href: event.target.value })} placeholder="/produtos" disabled={!enabled || !isGroovy} />
                </div>
              </div>
            </div>
          </aside>
        </div>

        <SheetFooter className="flex-row items-center justify-between border-t bg-background px-6 py-4">
          <p className="hidden text-xs text-muted-foreground sm:block">As alterações são publicadas na vitrine ao salvar.</p>
          <Button onClick={savePresentation} disabled={isSaving || !isGroovy} className="ml-auto min-w-36">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar e publicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
