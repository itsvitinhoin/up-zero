"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import IntegerInput from "@/components/form/IntegerInput";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inter, Montserrat, Poppins, Zen_Kaku_Gothic_New } from "next/font/google";
import { Save, Megaphone, AlertCircle, ImageIcon, Palette, Check, ChevronDown, ChevronUp, Plus, Smartphone, TicketPercent, Trash2, Menu, Package } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import type { SiteSettings, Category, SiteCustomization, BannerConfig, CategoryBannerConfig, InfoBannerConfig, HomeCategoryConfig, ProductCustomField } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

const inter = Inter({ subsets: ["latin"], weight: ["400", "600"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600"] });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "600"] });
const zenKaku = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: ["400", "700"] });

function getDefaultAnnouncementBar(locale = "en") {
  return {
    enabled: true,
    items: [
      tAdmin(locale, "admin.appearance.defaults.announcement.item1", "Frete gratis para compras acima de R$ 1000"),
      tAdmin(locale, "admin.appearance.defaults.announcement.item2", "Novidades toda semana"),
      tAdmin(locale, "admin.appearance.defaults.announcement.item3", "Atacado exclusivo para lojistas"),
    ],
    separator: "|",
    backgroundColor: "#1a1a1a",
    textColor: "#ffffff",
    isAnimated: true,
    animationSpeed: "NORMAL" as const,
  };
}

function getDefaultInfoBanners(locale = "en") {
  return {
    pedidoMinimo: {
      isActive: true,
      icon: "package" as const,
      title: tAdmin(locale, "admin.appearance.defaults.info.pedidoMinimo.title", "Pedido Minimo"),
      description: tAdmin(locale, "admin.appearance.defaults.info.pedidoMinimo.description", "A partir de 6 pecas"),
    },
    entrega: {
      isActive: true,
      icon: "truck" as const,
      title: tAdmin(locale, "admin.appearance.defaults.info.entrega.title", "Entrega"),
      description: tAdmin(locale, "admin.appearance.defaults.info.entrega.description", "Para todo o Brasil"),
    },
    pagamento: {
      isActive: true,
      icon: "credit-card" as const,
      title: tAdmin(locale, "admin.appearance.defaults.info.pagamento.title", "Pagamento"),
      description: tAdmin(locale, "admin.appearance.defaults.info.pagamento.description", "Ate 6x sem juros"),
    },
    atendimento: {
      isActive: true,
      icon: "users" as const,
      title: tAdmin(locale, "admin.appearance.defaults.info.atendimento.title", "Atendimento"),
      description: tAdmin(locale, "admin.appearance.defaults.info.atendimento.description", "Vendedora exclusiva"),
    },
  };
}

function getDefaultPopupCoupon() {
  return {
    enabled: false,
    imageUrl: null,
    couponCode: "",
    applyButtonText: "Aplicar cupom",
  };
}

interface CustomizationTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  categories: Category[];
  isSaving: boolean;
  onSave: () => void;
}

export function CustomizationTab({ locale = "en", settings, setSettings, categories, isSaving, onSave }: CustomizationTabProps) {
  function getDefaultMainBanner(): BannerConfig {
    return {
      imageUrl: "",
      mobileImageUrl: null,
      altText: "",
      linkUrl: null,
      isActive: true,
      useMobileImage: false,
    };
  }

  function getMainBanners(): BannerConfig[] {
    if (Array.isArray(settings.customization.mainBanners) && settings.customization.mainBanners.length > 0) {
      return settings.customization.mainBanners;
    }

    return settings.customization.mainBanner ? [settings.customization.mainBanner] : [];
  }

  function getMiniBanners(): BannerConfig[] {
    if (Array.isArray(settings.customization.miniBanners) && settings.customization.miniBanners.length > 0) {
      return settings.customization.miniBanners;
    }

    return [];
  }

  function updateCustomization(updates: Partial<SiteCustomization>) {
    setSettings({ ...settings, customization: { ...settings.customization, ...updates } });
  }

  function updateAnnouncementBar(updates: Partial<SiteCustomization["announcementBar"]>) {
    updateCustomization({
      announcementBar: {
        ...(settings.customization.announcementBar || getDefaultAnnouncementBar(locale)),
        ...updates,
      },
    });
  }

  function updatePopupCoupon(updates: Partial<NonNullable<SiteCustomization["popupCoupon"]>>) {
    updateCustomization({
      popupCoupon: {
        ...(settings.customization.popupCoupon || getDefaultPopupCoupon()),
        ...updates,
      },
    });
  }

  const currentAnnouncementBar = settings.customization.announcementBar || getDefaultAnnouncementBar(locale);
  const currentPopupCoupon = settings.customization.popupCoupon || getDefaultPopupCoupon();
  const announcementItems = Array.isArray(currentAnnouncementBar.items)
    ? currentAnnouncementBar.items
    : getDefaultAnnouncementBar(locale).items;
  const announcementSeparator = (currentAnnouncementBar.separator || getDefaultAnnouncementBar(locale).separator).trim() || "|";
  const announcementPreviewText = announcementItems.join(` ${announcementSeparator} `);

  function addAnnouncementItem() {
    updateAnnouncementBar({
      items: [...announcementItems, ""],
    });
  }

  function updateAnnouncementItem(index: number, value: string) {
    const nextItems = [...announcementItems];
    nextItems[index] = value;
    updateAnnouncementBar({
      items: nextItems,
    });
  }

  function removeAnnouncementItem(index: number) {
    const nextItems = announcementItems.filter((_, currentIndex) => currentIndex !== index);
    updateAnnouncementBar({
      items: nextItems.length > 0 ? nextItems : [""],
    });
  }

  function updateInfoBanner(key: "pedidoMinimo" | "entrega" | "pagamento" | "atendimento", updates: Partial<InfoBannerConfig>) {
    const currentInfoBanners = settings.customization.infoBanners || getDefaultInfoBanners(locale);
    updateCustomization({
      infoBanners: { ...currentInfoBanners, [key]: { ...currentInfoBanners[key], ...updates } },
    });
  }

  function syncMainBanners(nextBanners: BannerConfig[]) {
    updateCustomization({
      mainBanners: nextBanners,
      mainBanner: nextBanners[0] || null,
    });
  }

  function updateMainBanner(index: number, updates: Partial<BannerConfig>) {
    const nextBanners = getMainBanners();
    const currentBanner = nextBanners[index] || getDefaultMainBanner();
    nextBanners[index] = { ...currentBanner, ...updates };
    syncMainBanners(nextBanners);
  }

  function addMainBanner() {
    syncMainBanners([...getMainBanners(), getDefaultMainBanner()]);
  }

  function removeMainBanner(index: number) {
    syncMainBanners(getMainBanners().filter((_, currentIndex) => currentIndex !== index));
  }

  function moveMainBanner(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    const nextBanners = [...getMainBanners()];

    if (nextIndex < 0 || nextIndex >= nextBanners.length) return;

    const [banner] = nextBanners.splice(index, 1);
    nextBanners.splice(nextIndex, 0, banner);
    syncMainBanners(nextBanners);
  }

  function syncMiniBanners(nextBanners: BannerConfig[]) {
    updateCustomization({
      miniBanners: nextBanners,
    });
  }

  function updateMiniBanner(index: number, updates: Partial<BannerConfig>) {
    const nextBanners = getMiniBanners();
    const currentBanner = nextBanners[index] || getDefaultMainBanner();
    nextBanners[index] = { ...currentBanner, ...updates };
    syncMiniBanners(nextBanners);
  }

  function addMiniBanner() {
    syncMiniBanners([...getMiniBanners(), getDefaultMainBanner()]);
  }

  function removeMiniBanner(index: number) {
    syncMiniBanners(getMiniBanners().filter((_, currentIndex) => currentIndex !== index));
  }

  function moveMiniBanner(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    const nextBanners = [...getMiniBanners()];

    if (nextIndex < 0 || nextIndex >= nextBanners.length) return;

    const [banner] = nextBanners.splice(index, 1);
    nextBanners.splice(nextIndex, 0, banner);
    syncMiniBanners(nextBanners);
  }

  function updateCategoryBanner(index: number, updates: Partial<CategoryBannerConfig>) {
    const newBanners = [...settings.customization.categoryBanners];
    newBanners[index] = { ...newBanners[index], ...updates };
    updateCustomization({ categoryBanners: newBanners });
  }

  function updateHomeCategory(index: number, updates: Partial<HomeCategoryConfig>) {
    const current = Array.isArray(settings.customization.homeCategories)
      ? settings.customization.homeCategories
      : [];
    const next = [...current];
    next[index] = { ...next[index], ...updates };
    updateCustomization({ homeCategories: next });
  }

  const selectedHomeCategories = Array.isArray(settings.customization.homeCategories)
    ? settings.customization.homeCategories
    : [];

  const selectedHomeCategoryIds = useMemo(
    () => new Set(selectedHomeCategories.map((entry) => entry.categoryId)),
    [selectedHomeCategories],
  );

  const categoryNodes = useMemo(() => {
    const byParent = new Map<string, Category[]>();
    const byId = new Map(categories.map((cat) => [cat.id, cat]));

    for (const category of categories) {
      const parentId = category.parentId && byId.has(category.parentId) ? category.parentId : "__root__";
      const siblings = byParent.get(parentId) || [];
      siblings.push(category);
      byParent.set(parentId, siblings);
    }

    const sortCategories = (items: Category[]) => {
      return [...items].sort((a, b) => {
        const orderDelta = (a.sortOrder || 0) - (b.sortOrder || 0);
        if (orderDelta !== 0) return orderDelta;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      });
    };

    const buildTree = (parentId: string, depth: number): Array<{ category: Category; depth: number; children: Array<{ category: Category; depth: number; children: any[] }> }> => {
      return sortCategories(byParent.get(parentId) || []).map((category) => ({
        category,
        depth,
        children: buildTree(category.id, depth + 1),
      }));
    };

    return buildTree("__root__", 0);
  }, [categories]);

  const categoryNodeColumns = useMemo(() => {
    const left: typeof categoryNodes = [];
    const right: typeof categoryNodes = [];

    categoryNodes.forEach((node, index) => {
      if (index % 2 === 0) {
        left.push(node);
      } else {
        right.push(node);
      }
    });

    return [left, right] as const;
  }, [categoryNodes]);

  function toggleHomeCategory(category: Category) {
    const selectedIndex = selectedHomeCategories.findIndex((entry) => entry.categoryId === category.id);
    if (selectedIndex >= 0) {
      updateCustomization({
        homeCategories: selectedHomeCategories.filter((entry) => entry.categoryId !== category.id),
      });
      return;
    }

    updateCustomization({
      homeCategories: [
        ...selectedHomeCategories,
        {
          categoryId: category.id,
          title: category.name,
          isActive: true,
        },
      ],
    });
  }

  function renderCategoryNode(node: { category: Category; depth: number; children: Array<{ category: Category; depth: number; children: any[] }> }) {
    const { category, depth, children } = node;
    const isSelected = selectedHomeCategoryIds.has(category.id);

    return (
      <div key={`home-category-${category.id}`} className="space-y-2">
        <div style={{ paddingLeft: `${depth * 20}px` }}>
          <div
            role="button"
            tabIndex={0}
            className={`cursor-pointer rounded-lg border p-3 transition-all ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/50'}`}
            onClick={() => toggleHomeCategory(category)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleHomeCategory(category);
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/50'}`}>
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <p className="truncate text-sm font-medium">{category.name}</p>
              {children.length > 0 && <Badge variant="secondary">Pai</Badge>}
            </div>
          </div>
        </div>

        {children.length > 0 && (
          <div className="space-y-2">
            {children.map((child) => renderCategoryNode(child))}
          </div>
        )}
      </div>
    );
  }

  const ICON_OPTIONS = [
    { value: "package", label: tAdmin(locale, "admin.appearance.icon.package", "Pacote") },
    { value: "truck", label: tAdmin(locale, "admin.appearance.icon.truck", "Caminhao") },
    { value: "credit-card", label: tAdmin(locale, "admin.appearance.icon.creditCard", "Cartao") },
    { value: "users", label: tAdmin(locale, "admin.appearance.icon.users", "Usuarios") },
    { value: "clock", label: tAdmin(locale, "admin.appearance.icon.clock", "Relogio") },
    { value: "shield", label: tAdmin(locale, "admin.appearance.icon.shield", "Escudo") },
    { value: "star", label: tAdmin(locale, "admin.appearance.icon.star", "Estrela") },
    { value: "heart", label: tAdmin(locale, "admin.appearance.icon.heart", "Coracao") },
  ];

  const mainBanners = getMainBanners();
  const miniBanners = getMiniBanners();
  const selectedFontFamily = settings.customization.fontFamily || "SYSTEM";
  const selectedFontPreview =
    selectedFontFamily === "INTER"
      ? inter.style.fontFamily
      : selectedFontFamily === "POPPINS"
        ? poppins.style.fontFamily
        : selectedFontFamily === "MONTSERRAT"
          ? montserrat.style.fontFamily
          : selectedFontFamily === "ZEN_KAKU_GOTHIC_NEW"
            ? zenKaku.style.fontFamily
            : "var(--font-sans), sans-serif";

  const productCustomFields = useMemo(
    () => [...(settings.productCustomFields || [])].sort((left, right) => left.order - right.order),
    [settings.productCustomFields],
  );

  function setProductCustomFields(nextFields: ProductCustomField[]) {
    setSettings({
      ...settings,
      productCustomFields: nextFields.map((field, index) => ({ ...field, order: index + 1 })),
    });
  }

  function updateProductCustomField(fieldId: string, updates: Partial<ProductCustomField>) {
    const next = productCustomFields.map((field) =>
      field.id === fieldId
        ? { ...field, ...updates }
        : field,
    );
    setProductCustomFields(next);
  }

  function addProductCustomField() {
    const baseIndex = productCustomFields.length + 1;
    const nextId = `product_field_${baseIndex}_${Date.now()}`;
    const next: ProductCustomField = {
      id: nextId,
      label: `Campo ${baseIndex}`,
      type: 'TEXT',
      enabled: true,
      required: false,
      order: baseIndex,
      placeholder: '',
      helpText: '',
    };
    setProductCustomFields([...productCustomFields, next]);
  }

  function removeProductCustomField(fieldId: string) {
    setProductCustomFields(productCustomFields.filter((field) => field.id !== fieldId));
  }

  function moveProductCustomField(fieldId: string, direction: -1 | 1) {
    const currentIndex = productCustomFields.findIndex((field) => field.id === fieldId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= productCustomFields.length) return;

    const next = [...productCustomFields];
    const [item] = next.splice(currentIndex, 1);
    next.splice(nextIndex, 0, item);
    setProductCustomFields(next);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
          {/* Menu */}
          <Card id="menu">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Menu className="h-5 w-5" />
                {tAdmin(locale, "admin.appearance.menu.title", "Menu")}
              </CardTitle>
              <CardDescription>{tAdmin(locale, "admin.appearance.menu.description", "Configure menu appearance and behavior")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{tAdmin(locale, "admin.appearance.menu.transparent", "Transparent Menu")}</Label>
                  <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.menu.transparentHelp", "Menu is transparent over hero banner with white logo. Becomes fixed with dark logo when scrolling.")}</p>
                </div>
                <Switch
                  checked={settings.customization.menuTransparent ?? false}
                  onCheckedChange={(checked) => updateCustomization({ menuTransparent: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card id="product-custom-fields">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Campos Customizados de Produto
              </CardTitle>
              <CardDescription>
                Configure campos próprios do produto. Esta configuração é independente do cadastro de cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addProductCustomField}>
                  <Plus className="h-4 w-4" />
                  Adicionar Campo
                </Button>
              </div>

              {productCustomFields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum campo configurado. Adicione campos para aparecerem no drawer de produto.
                </p>
              )}

              {productCustomFields.map((field, index) => (
                <div key={field.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Campo {index + 1}</p>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => moveProductCustomField(field.id, -1)} disabled={index === 0}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => moveProductCustomField(field.id, 1)} disabled={index === productCustomFields.length - 1}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeProductCustomField(field.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Rótulo</Label>
                      <Input
                        value={field.label}
                        onChange={(event) => updateProductCustomField(field.id, { label: event.target.value })}
                        placeholder="Ex.: Material principal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ID do Campo</Label>
                      <Input
                        value={field.id}
                        onChange={(event) => updateProductCustomField(field.id, { id: event.target.value })}
                        placeholder="Ex.: material_principal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={field.type} onValueChange={(value) => updateProductCustomField(field.id, { type: value as ProductCustomField['type'] })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TEXT">Texto</SelectItem>
                          <SelectItem value="LONG_TEXT">Texto Longo</SelectItem>
                          <SelectItem value="RICH_TEXT">Rich Text Editor</SelectItem>
                          <SelectItem value="NUMBER">Número</SelectItem>
                          <SelectItem value="URL">URL</SelectItem>
                          <SelectItem value="SELECT">Lista</SelectItem>
                          <SelectItem value="MULTI_UPLOAD">Multi Upload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Placeholder</Label>
                      <Input
                        value={field.placeholder || ''}
                        onChange={(event) => updateProductCustomField(field.id, { placeholder: event.target.value })}
                        placeholder="Texto de ajuda no input"
                      />
                    </div>
                  </div>

                  {field.type === 'SELECT' && (
                    <div className="space-y-2">
                      <Label>Opções da Lista (uma por linha: valor|rótulo)</Label>
                      <textarea
                        className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={(field.options || []).map((option) => `${option.value}|${option.label}`).join('\n')}
                        onChange={(event) => {
                          const nextOptions = event.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line) => {
                              const [rawValue, rawLabel] = line.split('|');
                              const value = String(rawValue || '').trim();
                              const label = String(rawLabel || rawValue || '').trim();
                              return { value, label };
                            })
                            .filter((option) => option.value.length > 0);
                          updateProductCustomField(field.id, { options: nextOptions });
                        }}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={(checked) => updateProductCustomField(field.id, { enabled: checked })}
                      />
                      <Label>Ativo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) => updateProductCustomField(field.id, { required: checked })}
                      />
                      <Label>Obrigatório</Label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

        {/* Announcement Bar */}
        <Card id="announcement-bar">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              {tAdmin(locale, "admin.appearance.announcement.title", "Announcement Bar")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.announcement.description", "Configure the announcement bar shown above the storefront menu")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{tAdmin(locale, "admin.appearance.announcement.enable", "Enable Announcement Bar")}</Label>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.announcement.enableHelp", "Show announcement bar at the top of storefront")}</p>
              </div>
              <Switch
                checked={settings.customization.announcementBar?.enabled ?? getDefaultAnnouncementBar(locale).enabled}
                onCheckedChange={(checked) => updateAnnouncementBar({ enabled: checked })}
              />
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{tAdmin(locale, "admin.appearance.announcement.items", "Announcement Items")}</Label>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addAnnouncementItem}>
                  <Plus className="h-4 w-4" />
                  {tAdmin(locale, "admin.appearance.announcement.addItem", "Add item")}
                </Button>
              </div>
              <div className="space-y-2">
                {announcementItems.map((item, index) => (
                  <div key={`announcement-item-${index}`} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateAnnouncementItem(index, e.target.value)}
                      placeholder={tAdmin(locale, "admin.appearance.announcement.itemPlaceholder", "Item {index} do anuncio").replace("{index}", String(index + 1))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeAnnouncementItem(index)}
                      disabled={announcementItems.length === 1}
                      aria-label={tAdmin(locale, "admin.appearance.announcement.removeItemAria", "Remover item {index}").replace("{index}", String(index + 1))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.appearance.announcement.backgroundColor", "Background Color")}</Label>
                <div className="flex gap-2">
                  <Input type="color" value={settings.customization.announcementBar?.backgroundColor || getDefaultAnnouncementBar(locale).backgroundColor} onChange={(e) => updateAnnouncementBar({ backgroundColor: e.target.value })} className="h-10 w-16 cursor-pointer p-1" />
                  <Input value={settings.customization.announcementBar?.backgroundColor || getDefaultAnnouncementBar(locale).backgroundColor} onChange={(e) => updateAnnouncementBar({ backgroundColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.appearance.announcement.textColor", "Text Color")}</Label>
                <div className="flex gap-2">
                  <Input type="color" value={settings.customization.announcementBar?.textColor || getDefaultAnnouncementBar(locale).textColor} onChange={(e) => updateAnnouncementBar({ textColor: e.target.value })} className="h-10 w-16 cursor-pointer p-1" />
                  <Input value={settings.customization.announcementBar?.textColor || getDefaultAnnouncementBar(locale).textColor} onChange={(e) => updateAnnouncementBar({ textColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.appearance.announcement.separator", "Separator")}</Label>
                <Input
                  value={announcementSeparator}
                  onChange={(e) => updateAnnouncementBar({ separator: e.target.value || "|" })}
                  placeholder="|"
                  className="max-w-40"
                />
                <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.appearance.announcement.separatorHelp", "Examples: |, •, -, //")}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{tAdmin(locale, "admin.appearance.announcement.animate", "Animate Text")}</Label>
                  <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.announcement.animateHelp", "Text scrolls horizontally")}</p>
                </div>
                <Switch checked={settings.customization.announcementBar?.isAnimated ?? true} onCheckedChange={(checked) => updateAnnouncementBar({ isAnimated: checked })} />
              </div>
              {(settings.customization.announcementBar?.isAnimated ?? true) && (
                <div className="space-y-2">
                  <Label>{tAdmin(locale, "admin.appearance.announcement.speed", "Speed")}</Label>
                  <Select value={settings.customization.announcementBar?.animationSpeed || "NORMAL"} onValueChange={(v: "SLOW" | "NORMAL" | "FAST") => updateAnnouncementBar({ animationSpeed: v })}>
                    <SelectTrigger size="sm" className="w-full max-w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SLOW">{tAdmin(locale, "admin.appearance.speed.slow", "Slow")}</SelectItem>
                      <SelectItem value="NORMAL">{tAdmin(locale, "admin.appearance.speed.normal", "Normal")}</SelectItem>
                      <SelectItem value="FAST">{tAdmin(locale, "admin.appearance.speed.fast", "Fast")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{tAdmin(locale, "admin.appearance.preview", "Preview")}</Label>
              <div className="overflow-hidden rounded-xl px-4 py-3 text-center text-sm" style={{ backgroundColor: settings.customization.announcementBar?.backgroundColor || "#1a1a1a", color: settings.customization.announcementBar?.textColor || "#ffffff" }}>
                <p className="truncate">{announcementPreviewText || tAdmin(locale, "admin.appearance.announcement.previewEmpty", "Add items to preview the bar")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="popup">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketPercent className="h-5 w-5" />
              Popup
            </CardTitle>
            <CardDescription>
              Exibe um popup promocional no storefront. O botão de aplicar só aparece quando houver cupom.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar popup</Label>
                <p className="text-sm text-muted-foreground">Quando ativo, o popup aparece para os visitantes da loja.</p>
              </div>
              <Switch
                checked={Boolean(currentPopupCoupon.enabled)}
                onCheckedChange={(checked) => updatePopupCoupon({ enabled: checked })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Imagem do popup</Label>
              <p className="text-sm text-muted-foreground">Recomendado: 1500x1500px para melhor qualidade.</p>
              <ImageUpload
                value={currentPopupCoupon.imageUrl}
                onChange={(url) => updatePopupCoupon({ imageUrl: url })}
                imageType="popupSquare"
                folder="theme/popup"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="popup-coupon-code">Codigo do cupom (opcional)</Label>
              <Input
                id="popup-coupon-code"
                value={currentPopupCoupon.couponCode || ""}
                onChange={(e) => updatePopupCoupon({ couponCode: e.target.value.toUpperCase() })}
                placeholder="EX: BEMVINDO10"
              />
              <p className="text-xs text-muted-foreground">Se vazio, o popup será exibido sem botão de aplicar cupom.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="popup-coupon-button-text">Texto do botao</Label>
              <Input
                id="popup-coupon-button-text"
                value={currentPopupCoupon.applyButtonText || ""}
                onChange={(e) => updatePopupCoupon({ applyButtonText: e.target.value })}
                placeholder="Aplicar cupom"
              />
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card id="site-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />{tAdmin(locale, "admin.appearance.colors.title", "Site Colors")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.colors.description", "Customize your store colors")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              {[
                { id: "accentColor", label: tAdmin(locale, "admin.appearance.colors.accent", "Accent Color"), key: "accentColor" as const },
                { id: "backgroundColor", label: tAdmin(locale, "admin.appearance.colors.background", "Background Color"), key: "backgroundColor" as const },
                { id: "textColor", label: tAdmin(locale, "admin.appearance.colors.text", "Text Color"), key: "textColor" as const },
                { id: "buttonColor", label: tAdmin(locale, "admin.appearance.colors.button", "Button Color"), key: "buttonColor" as const },
                { id: "buttonTextColor", label: tAdmin(locale, "admin.appearance.colors.buttonText", "Button Text Color"), key: "buttonTextColor" as const },
              ].map(({ id, label, key }) => (
                <div key={id} className="space-y-2">
                  <Label htmlFor={id}>{label}</Label>
                  <div className="flex gap-2">
                    <Input id={id} type="color" value={settings.customization[key]} onChange={(e) => updateCustomization({ [key]: e.target.value })} className="w-16 h-10 p-1 cursor-pointer" />
                    <Input value={settings.customization[key]} onChange={(e) => updateCustomization({ [key]: e.target.value })} className="flex-1" />
                  </div>
                </div>
              ))}
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.appearance.buttonPreview", "Button Preview")}</Label>
                <div className="flex h-10 items-center rounded-md border p-2" style={{ backgroundColor: settings.customization.buttonColor, color: settings.customization.buttonTextColor }}>
                  <button type="button" className="text-sm font-medium">
                    {tAdmin(locale, "admin.appearance.example", "Example")}
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Common Storefront */}
        <Card id="site-storefront">
          <CardHeader>
            <CardTitle>{tAdmin(locale, "admin.appearance.storefront.title", "Common Storefront")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.storefront.description", "Configure how your storefront will be displayed")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{tAdmin(locale, "admin.appearance.storefront.displayMode", "Display Mode")}</Label>
              <Select
                value={settings.customization.storefrontDisplayMode || "products"}
                onValueChange={(value) => updateCustomization({ storefrontDisplayMode: value as "products" | "imageLevels" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="products">{tAdmin(locale, "admin.appearance.storefront.displayMode.products", "Products")}</SelectItem>
                  <SelectItem value="imageLevels">{tAdmin(locale, "admin.appearance.storefront.displayMode.imageLevels", "Image Levels")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Modo de navegar</Label>
              <Select
                value={settings.customization.storefrontNavigationMode || "pagination"}
                onValueChange={(value) => updateCustomization({ storefrontNavigationMode: value as "pagination" | "infiniteScroll" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagination">Paginacao</SelectItem>
                  <SelectItem value="infiniteScroll">Infinito Scroll</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tAdmin(locale, "admin.appearance.storefront.defaultSort", "Default Sort Order")}</Label>
              <Select
                value={settings.customization.storefrontDefaultSort || "relevance"}
                onValueChange={(value) => updateCustomization({ storefrontDefaultSort: value as "relevance" | "price_asc" | "price_desc" | "newest" | "sku" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">{tAdmin(locale, "admin.appearance.storefront.defaultSort.relevance", "Relevance")}</SelectItem>
                  <SelectItem value="price_asc">{tAdmin(locale, "admin.appearance.storefront.defaultSort.price_asc", "Lowest Price")}</SelectItem>
                  <SelectItem value="price_desc">{tAdmin(locale, "admin.appearance.storefront.defaultSort.price_desc", "Highest Price")}</SelectItem>
                  <SelectItem value="newest">{tAdmin(locale, "admin.appearance.storefront.defaultSort.newest", "Newest")}</SelectItem>
                  <SelectItem value="sku">{tAdmin(locale, "admin.appearance.storefront.defaultSort.sku", "SKU")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Visualizar desconto do PIX</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe o desconto do PIX no card do produto e na página do produto.
                </p>
              </div>
              <Switch
                checked={settings.customization.showPixDiscount ?? true}
                onCheckedChange={(checked) => updateCustomization({ showPixDiscount: checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Visualizar parcelamento nos produtos</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe o parcelamento no card do produto e na página do produto.
                </p>
              </div>
              <Switch
                checked={settings.customization.showInstallments ?? true}
                onCheckedChange={(checked) => updateCustomization({ showInstallments: checked })}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Proporção de mídia (fotos e vídeos)</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha a proporção (largura x altura) das miniaturas de fotos e vídeos dos produtos. Arquivos com formatos diferentes serão ajustados automaticamente por recorte, preservando a proporcionalidade e sem distorção. Caso não informe um valor, será utilizada a proporção padrão (683 x 1024 px).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <IntegerInput
                    label="Largura de mídia"
                    min={1}
                    placeholder="683"
                    value={settings.customization.mediaAspectWidth ?? null}
                    onChange={(value) => updateCustomization({ mediaAspectWidth: value })}
                  />
                </div>
                <div className="space-y-2">
                  <IntegerInput
                    label="Altura de mídia"
                    min={1}
                    placeholder="1024"
                    value={settings.customization.mediaAspectHeight ?? null}
                    onChange={(value) => updateCustomization({ mediaAspectHeight: value })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="login">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Login
            </CardTitle>
            <CardDescription>
              Configure a imagem lateral exibida nas telas de login e cadastro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Imagem lateral do login</Label>
            <p className="text-sm text-muted-foreground">
              Recomendado: 768 x 885 px. Se não houver imagem, a tela de login mantém o visual atual.
            </p>
            <ImageUpload
              value={settings.customization.loginSideImageUrl || null}
              onChange={(url) => updateCustomization({ loginSideImageUrl: url })}
              imageType="loginSideImage"
              folder="theme/login"
            />
          </CardContent>
        </Card>

        {/* Typography */}
        <Card id="site-typography">
          <CardHeader>
            <CardTitle>{tAdmin(locale, "admin.appearance.typography.title", "Typography")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.typography.description", "Store font stays default and you can control uppercase usage")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{tAdmin(locale, "admin.appearance.typography.storeFont", "Store Font")}</Label>
              <Select
                value={settings.customization.fontFamily || "SYSTEM"}
                onValueChange={(value) => updateCustomization({ fontFamily: value as "SYSTEM" | "INTER" | "POPPINS" | "MONTSERRAT" | "ZEN_KAKU_GOTHIC_NEW" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYSTEM">{tAdmin(locale, "admin.appearance.typography.defaultFont", "Default system font")}</SelectItem>
                  <SelectItem value="INTER">Inter</SelectItem>
                  <SelectItem value="POPPINS">Poppins</SelectItem>
                  <SelectItem value="MONTSERRAT">Montserrat</SelectItem>
                  <SelectItem value="ZEN_KAKU_GOTHIC_NEW">Zen Kaku Gothic New</SelectItem>
                </SelectContent>
              </Select>

              <div className="rounded-md border bg-muted/20 px-3 py-3">
                <p className="mb-2 text-xs text-muted-foreground">{tAdmin(locale, "admin.appearance.preview", "Preview")}</p>
                <p style={{ fontFamily: selectedFontPreview }} className="text-sm leading-relaxed">
                  Aa Bb Cc 123 - {tAdmin(locale, "admin.appearance.example", "Example")}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{tAdmin(locale, "admin.appearance.typography.uppercase", "Force Uppercase Text")}</Label>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.typography.uppercaseHelp", "Applies UPPERCASE to storefront text")}</p>
              </div>
              <Switch
                checked={settings.customization.forceUppercaseText ?? false}
                onCheckedChange={(checked) => updateCustomization({ forceUppercaseText: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Main Banner */}
        <Card id="main-banner">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />{tAdmin(locale, "admin.appearance.mainBanners.title", "Main Banners")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.mainBanners.description", "Configure multiple homepage banners and optional mobile images")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label className="text-base">{tAdmin(locale, "admin.appearance.mainBanners.count", "Number of banners")}</Label>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.mainBanners.countHelp", "Homepage will show these banners in a slider")}</p>
              </div>
              <Button type="button" variant="outline" onClick={addMainBanner}>
                <Plus className="mr-2 h-4 w-4" />
                {tAdmin(locale, "admin.appearance.mainBanners.add", "Add banner")}
              </Button>
            </div>

            {mainBanners.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {tAdmin(locale, "admin.appearance.mainBanners.empty", "No banner configured. Add the first banner to activate the storefront slider.")}
              </div>
            ) : (
              <div className="space-y-6">
                {mainBanners.map((banner, index) => (
                  <div key={`main-banner-${index}`} className="space-y-4 rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{tAdmin(locale, "admin.appearance.mainBanners.bannerLabel", "Banner {index}").replace("{index}", String(index + 1))}</p>
                        <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.appearance.mainBanners.orderHint", "Ordem de exibicao no slider da loja")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" onClick={() => moveMainBanner(index, -1)} disabled={index === 0}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => moveMainBanner(index, 1)} disabled={index === mainBanners.length - 1}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => removeMainBanner(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{tAdmin(locale, "admin.appearance.mainBanners.active", "Active banner")}</Label>
                        <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.mainBanners.activeHelp", "Display this banner in homepage slider")}</p>
                      </div>
                      <Switch checked={banner.isActive} onCheckedChange={(checked) => updateMainBanner(index, { isActive: checked })} />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>{tAdmin(locale, "admin.appearance.mainBanners.imageDesktop", "Desktop image")}</Label>
                      <ImageUpload value={banner.imageUrl || null} onChange={(url) => updateMainBanner(index, { imageUrl: url || '' })} imageType="mainBanner" folder="banners" />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2"><Smartphone className="h-4 w-4" />{tAdmin(locale, "admin.appearance.mainBanners.useMobile", "Use mobile version")}</Label>
                        <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.mainBanners.useMobileHelp", "Enable to upload a separate image for small screens")}</p>
                      </div>
                      <Switch
                        checked={banner.useMobileImage}
                        onCheckedChange={(checked) => updateMainBanner(index, {
                          useMobileImage: checked,
                          mobileImageUrl: checked ? banner.mobileImageUrl : null,
                        })}
                      />
                    </div>

                    {banner.useMobileImage && (
                      <div className="space-y-2">
                        <Label>{tAdmin(locale, "admin.appearance.mainBanners.imageMobile", "Mobile image")}</Label>
                        <ImageUpload value={banner.mobileImageUrl || null} onChange={(url) => updateMainBanner(index, { mobileImageUrl: url || null, useMobileImage: Boolean(url) || banner.useMobileImage })} imageType="mainBannerMobile" folder="banners/mobile" />
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{tAdmin(locale, "admin.appearance.mainBanners.altText", "Alt text")}</Label>
                        <Input value={banner.altText || ""} onChange={(e) => updateMainBanner(index, { altText: e.target.value })} placeholder={tAdmin(locale, "admin.appearance.mainBanners.altTextPlaceholder", "Banner description")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{tAdmin(locale, "admin.appearance.mainBanners.link", "Banner link (optional)")}</Label>
                        <Input value={banner.linkUrl || ""} onChange={(e) => updateMainBanner(index, { linkUrl: e.target.value || null })} placeholder={tAdmin(locale, "admin.appearance.mainBanners.linkPlaceholder", "/products ou https://...")} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mini Banners */}
        <Card id="mini-banners">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />{tAdmin(locale, "admin.appearance.miniBanners.title", "Mini Banners")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.miniBanners.description", "Configure mini banners para exibir abaixo do banner principal.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label className="text-base">{tAdmin(locale, "admin.appearance.miniBanners.count", "Quantidade de mini banners")}</Label>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.miniBanners.countHelp", "A home pode usar estes banners em blocos menores.")}</p>
              </div>
              <Button type="button" variant="outline" onClick={addMiniBanner}>
                <Plus className="mr-2 h-4 w-4" />
                {tAdmin(locale, "admin.appearance.miniBanners.add", "Adicionar mini banner")}
              </Button>
            </div>

            {miniBanners.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {tAdmin(locale, "admin.appearance.miniBanners.empty", "Nenhum mini banner configurado. Adicione o primeiro mini banner.")}
              </div>
            ) : (
              <div className="space-y-6">
                {miniBanners.map((banner, index) => (
                  <div key={`mini-banner-${index}`} className="space-y-4 rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{tAdmin(locale, "admin.appearance.miniBanners.bannerLabel", "Mini Banner {index}").replace("{index}", String(index + 1))}</p>
                        <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.appearance.miniBanners.orderHint", "Ordem de exibicao na home")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="icon" onClick={() => moveMiniBanner(index, -1)} disabled={index === 0}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => moveMiniBanner(index, 1)} disabled={index === miniBanners.length - 1}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => removeMiniBanner(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{tAdmin(locale, "admin.appearance.miniBanners.active", "Mini banner ativo")}</Label>
                        <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.miniBanners.activeHelp", "Exibir este mini banner na home.")}</p>
                      </div>
                      <Switch checked={banner.isActive} onCheckedChange={(checked) => updateMiniBanner(index, { isActive: checked })} />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>{tAdmin(locale, "admin.appearance.miniBanners.imageDesktop", "Imagem desktop")}</Label>
                      <ImageUpload value={banner.imageUrl || null} onChange={(url) => updateMiniBanner(index, { imageUrl: url || '' })} imageType="mainBanner" folder="banners/mini" />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2"><Smartphone className="h-4 w-4" />{tAdmin(locale, "admin.appearance.miniBanners.useMobile", "Usar versao mobile")}</Label>
                        <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.miniBanners.useMobileHelp", "Ative para subir uma imagem separada para telas pequenas.")}</p>
                      </div>
                      <Switch
                        checked={banner.useMobileImage}
                        onCheckedChange={(checked) => updateMiniBanner(index, {
                          useMobileImage: checked,
                          mobileImageUrl: checked ? banner.mobileImageUrl : null,
                        })}
                      />
                    </div>

                    {banner.useMobileImage && (
                      <div className="space-y-2">
                        <Label>{tAdmin(locale, "admin.appearance.miniBanners.imageMobile", "Imagem mobile")}</Label>
                        <ImageUpload value={banner.mobileImageUrl || null} onChange={(url) => updateMiniBanner(index, { mobileImageUrl: url || null, useMobileImage: Boolean(url) || banner.useMobileImage })} imageType="mainBannerMobile" folder="banners/mini/mobile" />
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{tAdmin(locale, "admin.appearance.miniBanners.altText", "Texto alternativo")}</Label>
                        <Input value={banner.altText || ""} onChange={(e) => updateMiniBanner(index, { altText: e.target.value })} placeholder={tAdmin(locale, "admin.appearance.miniBanners.altPlaceholder", "Descricao do mini banner")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{tAdmin(locale, "admin.appearance.miniBanners.link", "Link do mini banner (opcional)")}</Label>
                        <Input value={banner.linkUrl || ""} onChange={(e) => updateMiniBanner(index, { linkUrl: e.target.value || null })} placeholder={tAdmin(locale, "admin.appearance.miniBanners.linkPlaceholder", "/produtos ou https://...")} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Banners */}
        <Card id="category-banners">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />{tAdmin(locale, "admin.appearance.categoryBanners.title", "Category Banners")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.categoryBanners.description", "Select categories to display on homepage")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">{tAdmin(locale, "admin.appearance.categoryBanners.displayMode.title", "Modo de Exibicao")}</Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(['auto', 'custom', 'disabled'] as const).map((mode) => {
                  const labels = {
                    auto: tAdmin(locale, "admin.appearance.categoryBanners.displayMode.auto.label", "Automatico"),
                    custom: tAdmin(locale, "admin.appearance.categoryBanners.displayMode.custom.label", "Personalizado"),
                    disabled: tAdmin(locale, "admin.appearance.categoryBanners.displayMode.disabled.label", "Desativado"),
                  };
                  const descriptions = {
                    auto: tAdmin(locale, "admin.appearance.categoryBanners.displayMode.auto.description", "Usa a foto mais recente de cada categoria"),
                    custom: tAdmin(locale, "admin.appearance.categoryBanners.displayMode.custom.description", "Faca upload de imagens personalizadas"),
                    disabled: tAdmin(locale, "admin.appearance.categoryBanners.displayMode.disabled.description", "Nao exibir banners de categoria"),
                  };
                  const isSelected = (settings.customization.categoryBannerMode || 'custom') === mode;
                  return (
                    <div key={mode} className={`cursor-pointer rounded-lg border p-4 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'}`} onClick={() => updateCustomization({ categoryBannerMode: mode })}>
                      <div className="mb-2 flex items-center gap-2">
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${isSelected ? 'border-primary' : 'border-muted-foreground'}`}>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm font-medium">{labels[mode]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{descriptions[mode]}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {(settings.customization.categoryBannerMode || 'custom') !== 'disabled' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base font-medium">{tAdmin(locale, "admin.appearance.categoryBanners.selectedCategories", "Categorias Selecionadas")}</Label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {categories.map((cat) => {
                      const isSelected = settings.customization.categoryBanners.some((b) => b.categoryId === cat.id);
                      return (
                        <div
                          key={cat.id}
                          className={`cursor-pointer rounded-lg border p-3 transition-all ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/50'}`}
                          onClick={() => {
                            if (isSelected) {
                              updateCustomization({ categoryBanners: settings.customization.categoryBanners.filter((b) => b.categoryId !== cat.id) });
                            } else {
                              updateCustomization({
                                categoryBanners: [...settings.customization.categoryBanners, {
                                  categoryId: cat.id, imageUrl: '', altText: cat.name, isActive: true,
                                  mode: (settings.customization.categoryBannerMode || 'custom') === 'auto' ? 'auto' : 'custom',
                                }],
                              });
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/50'}`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <p className="truncate text-sm font-medium">{cat.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(settings.customization.categoryBannerMode || 'custom') === 'custom' && settings.customization.categoryBanners.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <Label className="text-base font-medium">{tAdmin(locale, "admin.appearance.categoryBanners.customImages", "Imagens Personalizadas")}</Label>
                      {settings.customization.categoryBanners.map((banner, index) => {
                        const category = categories.find((c) => c.id === banner.categoryId);
                        if (!category) return null;
                        return (
                          <div key={banner.categoryId} className="space-y-4 rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{category.name}</span>
                                <Badge variant={banner.imageUrl ? 'default' : 'secondary'}>{banner.imageUrl ? tAdmin(locale, "admin.appearance.categoryBanners.imageSet", "Imagem definida") : tAdmin(locale, "admin.appearance.categoryBanners.noImage", "Sem imagem")}</Badge>
                              </div>
                              <Switch checked={banner.isActive} onCheckedChange={(checked) => updateCategoryBanner(index, { isActive: checked })} />
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>{tAdmin(locale, "admin.appearance.categoryBanners.imageLabel", "Imagem")}</Label>
                                <ImageUpload value={banner.imageUrl || null} onChange={(url) => updateCategoryBanner(index, { imageUrl: url || '' })} imageType="categoryBanner" folder="banners/categories" />
                              </div>
                              <div className="space-y-2">
                                <Label>{tAdmin(locale, "admin.appearance.categoryBanners.altTextLabel", "Texto Alternativo")}</Label>
                                <Input value={banner.altText} onChange={(e) => updateCategoryBanner(index, { altText: e.target.value })} placeholder={tAdmin(locale, "admin.appearance.mainBanners.altTextPlaceholder", "Banner description")} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {(settings.customization.categoryBannerMode || 'custom') === 'auto' && settings.customization.categoryBanners.length > 0 && (
                  <>
                    <Separator />
                    <div className="rounded-lg bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground mb-4">{tAdmin(locale, "admin.appearance.categoryBanners.autoModeInfo", "Modo Automatico: O sistema usara automaticamente a foto mais recente de cada categoria.")}</p>
                      {settings.customization.categoryBanners.map((banner, index) => {
                        const category = categories.find((c) => c.id === banner.categoryId);
                        if (!category) return null;
                        return (
                          <div key={banner.categoryId} className="flex items-center justify-between rounded bg-background p-2">
                            <span className="text-sm">{category.name}</span>
                            <Switch checked={banner.isActive} onCheckedChange={(checked) => updateCategoryBanner(index, { isActive: checked })} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Info Banners */}
        <Card id="info-banners">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />{tAdmin(locale, "admin.appearance.infoBanners.title", "Info Banners")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.infoBanners.description", "Configure information banners shown below the main banner")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(["pedidoMinimo", "entrega", "pagamento", "atendimento"] as const).map((key) => {
              const labels = {
                pedidoMinimo: tAdmin(locale, "admin.appearance.defaults.info.pedidoMinimo.title", "Pedido Minimo"),
                entrega: tAdmin(locale, "admin.appearance.defaults.info.entrega.title", "Entrega"),
                pagamento: tAdmin(locale, "admin.appearance.defaults.info.pagamento.title", "Pagamento"),
                atendimento: tAdmin(locale, "admin.appearance.defaults.info.atendimento.title", "Atendimento"),
              };
              const banner = settings.customization.infoBanners?.[key] || getDefaultInfoBanners(locale)[key];
              return (
                <div key={key} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">{labels[key]}</Label>
                    <Switch checked={banner.isActive ?? true} onCheckedChange={(checked) => updateInfoBanner(key, { isActive: checked })} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{tAdmin(locale, "admin.appearance.infoBanners.icon", "Icon")}</Label>
                      <Select value={banner.icon || 'package'} onValueChange={(v) => updateInfoBanner(key, { icon: v as InfoBannerConfig['icon'] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ICON_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{tAdmin(locale, "admin.appearance.infoBanners.titleField", "Title")}</Label>
                      <Input value={banner.title || ''} onChange={(e) => updateInfoBanner(key, { title: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{tAdmin(locale, "admin.appearance.infoBanners.descriptionField", "Description")}</Label>
                      <Input value={banner.description || ''} onChange={(e) => updateInfoBanner(key, { description: e.target.value })} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Home Categories */}
        <Card id="home-categories">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />{tAdmin(locale, "admin.appearance.homeCategories.title", "Categorias da Home")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.homeCategories.description", "Selecione categorias para exibir carrosseis de produtos na home da vitrine.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">{tAdmin(locale, "admin.appearance.homeCategories.selectedCategories", "Categorias Selecionadas")}</Label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                {categoryNodeColumns.map((columnNodes, columnIndex) => (
                  <div key={`home-categories-column-${columnIndex}`} className="space-y-2">
                    {columnNodes.map((node) => renderCategoryNode(node))}
                  </div>
                ))}
              </div>
            </div>

            {selectedHomeCategories.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base font-medium">{tAdmin(locale, "admin.appearance.homeCategories.sectionsConfig", "Configuracao das secoes")}</Label>
                  {selectedHomeCategories.map((entry, index) => {
                    const category = categories.find((cat) => cat.id === entry.categoryId);
                    if (!category) return null;

                    return (
                      <div key={`home-category-config-${entry.categoryId}`} className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">{category.name}</p>
                            <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.appearance.homeCategories.orderHint", "Ordem de exibicao: {index}").replace("{index}", String(index + 1))}</p>
                          </div>
                          <Switch
                            checked={entry.isActive ?? true}
                            onCheckedChange={(checked) => updateHomeCategory(index, { isActive: checked })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{tAdmin(locale, "admin.appearance.homeCategories.sectionTitle", "Titulo da secao")}</Label>
                          <Input
                            value={entry.title || ''}
                            onChange={(e) => updateHomeCategory(index, { title: e.target.value })}
                            placeholder={category.name}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (index === 0) return;
                              const selectedHomeCategories = [...(settings.customization.homeCategories || [])];
                              const [moved] = selectedHomeCategories.splice(index, 1);
                              selectedHomeCategories.splice(index - 1, 0, moved);
                              updateCustomization({ homeCategories: selectedHomeCategories });
                            }}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const nextHomeCategories = [...selectedHomeCategories];
                              if (index >= nextHomeCategories.length - 1) return;
                              const [moved] = nextHomeCategories.splice(index, 1);
                              nextHomeCategories.splice(index + 1, 0, moved);
                              updateCustomization({ homeCategories: nextHomeCategories });
                            }}
                            disabled={index >= selectedHomeCategories.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Logo & Favicon */}
        <Card id="logo-favicon">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />{tAdmin(locale, "admin.appearance.logo.title", "Logo and Favicon")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.appearance.logo.description", "Configure logos for light/dark theme and site favicon")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.appearance.logo.light", "Light Logo")}</Label>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.logo.lightHelp", "Shown on dark backgrounds.")}</p>
                <ImageUpload value={settings.customization.logoLightUrl} onChange={(url) => updateCustomization({ logoLightUrl: url })} imageType="logo" folder="branding" />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.appearance.logo.dark", "Dark Logo")}</Label>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.logo.darkHelp", "Shown on light backgrounds.")}</p>
                <ImageUpload value={settings.customization.logoDarkUrl} onChange={(url) => updateCustomization({ logoDarkUrl: url })} imageType="logo" folder="branding" />
              </div>
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.appearance.logo.favicon", "Favicon")}</Label>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.appearance.logo.faviconHelp", "Icon shown in browser tab")}</p>
                <ImageUpload value={settings.customization.faviconUrl} onChange={(url) => updateCustomization({ faviconUrl: url })} imageType="favicon" folder="branding" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={onSave}
        disabled={isSaving}
        className="fixed sm:bottom-6 bottom-20 right-6 z-50 h-12 rounded-full px-4 shadow-lg"
        aria-label="Salvar"
        title="Salvar"
      >
        <Save className="mr-2 h-5 w-5" />
        Salvar
      </Button>
    </div>
  );
}
