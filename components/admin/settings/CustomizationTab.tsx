"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Save, Megaphone, AlertCircle, ImageIcon, Palette, Check, ChevronDown, ChevronUp, Plus, Smartphone, Trash2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import type { SiteSettings, Category, SiteCustomization, BannerConfig, CategoryBannerConfig, InfoBannerConfig, HomeCategoryConfig } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

const inter = Inter({ subsets: ["latin"], weight: ["400", "600"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600"] });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "600"] });
const zenKaku = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: ["400", "700"] });

function getDefaultAnnouncementBar() {
  return {
    enabled: true,
    items: [
      "Frete gratis para compras acima de R$ 1000",
      "Novidades toda semana",
      "Atacado exclusivo para lojistas",
    ],
    separator: "|",
    backgroundColor: "#1a1a1a",
    textColor: "#ffffff",
    isAnimated: true,
    animationSpeed: "NORMAL" as const,
  };
}

function getDefaultInfoBanners() {
  return {
    pedidoMinimo: { isActive: true, icon: "package" as const, title: "Pedido Minimo", description: "A partir de 6 pecas" },
    entrega: { isActive: true, icon: "truck" as const, title: "Entrega", description: "Para todo o Brasil" },
    pagamento: { isActive: true, icon: "credit-card" as const, title: "Pagamento", description: "Ate 6x sem juros" },
    atendimento: { isActive: true, icon: "users" as const, title: "Atendimento", description: "Vendedora exclusiva" },
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
        ...(settings.customization.announcementBar || getDefaultAnnouncementBar()),
        ...updates,
      },
    });
  }

  const currentAnnouncementBar = settings.customization.announcementBar || getDefaultAnnouncementBar();
  const announcementItems = Array.isArray(currentAnnouncementBar.items)
    ? currentAnnouncementBar.items
    : getDefaultAnnouncementBar().items;
  const announcementSeparator = (currentAnnouncementBar.separator || getDefaultAnnouncementBar().separator).trim() || "|";
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
    const currentInfoBanners = settings.customization.infoBanners || getDefaultInfoBanners();
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

  const ICON_OPTIONS = [
    { value: "package", label: "Pacote" },
    { value: "truck", label: "Caminhao" },
    { value: "credit-card", label: "Cartao" },
    { value: "users", label: "Usuarios" },
    { value: "clock", label: "Relogio" },
    { value: "shield", label: "Escudo" },
    { value: "star", label: "Estrela" },
    { value: "heart", label: "Coracao" },
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? tAdmin(locale, "admin.common.saving", "Saving...") : tAdmin(locale, "admin.appearance.save", "Save Appearance")}
        </Button>
      </div>

      <div className="grid gap-6">
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
                checked={settings.customization.announcementBar?.enabled ?? getDefaultAnnouncementBar().enabled}
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
                      placeholder={`Item ${index + 1} do anuncio`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeAnnouncementItem(index)}
                      disabled={announcementItems.length === 1}
                      aria-label={`Remover item ${index + 1}`}
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
                  <Input type="color" value={settings.customization.announcementBar?.backgroundColor || getDefaultAnnouncementBar().backgroundColor} onChange={(e) => updateAnnouncementBar({ backgroundColor: e.target.value })} className="h-10 w-16 cursor-pointer p-1" />
                  <Input value={settings.customization.announcementBar?.backgroundColor || getDefaultAnnouncementBar().backgroundColor} onChange={(e) => updateAnnouncementBar({ backgroundColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.appearance.announcement.textColor", "Text Color")}</Label>
                <div className="flex gap-2">
                  <Input type="color" value={settings.customization.announcementBar?.textColor || getDefaultAnnouncementBar().textColor} onChange={(e) => updateAnnouncementBar({ textColor: e.target.value })} className="h-10 w-16 cursor-pointer p-1" />
                  <Input value={settings.customization.announcementBar?.textColor || getDefaultAnnouncementBar().textColor} onChange={(e) => updateAnnouncementBar({ textColor: e.target.value })} className="flex-1" />
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
                        <p className="text-sm font-semibold">Banner {index + 1}</p>
                        <p className="text-xs text-muted-foreground">Ordem de exibicao no slider da loja</p>
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
                        <ImageUpload value={banner.mobileImageUrl || null} onChange={(url) => updateMainBanner(index, { mobileImageUrl: url || null, useMobileImage: Boolean(url) || banner.useMobileImage })} imageType="mainBanner" folder="banners/mobile" />
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{tAdmin(locale, "admin.appearance.mainBanners.altText", "Alt text")}</Label>
                        <Input value={banner.altText || ""} onChange={(e) => updateMainBanner(index, { altText: e.target.value })} placeholder={tAdmin(locale, "admin.appearance.mainBanners.altTextPlaceholder", "Banner description")} />
                      </div>
                      <div className="space-y-2">
                        <Label>{tAdmin(locale, "admin.appearance.mainBanners.link", "Banner link (optional)")}</Label>
                        <Input value={banner.linkUrl || ""} onChange={(e) => updateMainBanner(index, { linkUrl: e.target.value || null })} placeholder="/products ou https://..." />
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
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />Mini Banners</CardTitle>
            <CardDescription>Configure mini banners para exibir abaixo do banner principal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label className="text-base">Quantidade de mini banners</Label>
                <p className="text-sm text-muted-foreground">A home pode usar estes banners em blocos menores.</p>
              </div>
              <Button type="button" variant="outline" onClick={addMiniBanner}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar mini banner
              </Button>
            </div>

            {miniBanners.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum mini banner configurado. Adicione o primeiro mini banner.
              </div>
            ) : (
              <div className="space-y-6">
                {miniBanners.map((banner, index) => (
                  <div key={`mini-banner-${index}`} className="space-y-4 rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Mini Banner {index + 1}</p>
                        <p className="text-xs text-muted-foreground">Ordem de exibicao na home</p>
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
                        <Label>Mini banner ativo</Label>
                        <p className="text-sm text-muted-foreground">Exibir este mini banner na home.</p>
                      </div>
                      <Switch checked={banner.isActive} onCheckedChange={(checked) => updateMiniBanner(index, { isActive: checked })} />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Imagem desktop</Label>
                      <ImageUpload value={banner.imageUrl || null} onChange={(url) => updateMiniBanner(index, { imageUrl: url || '' })} imageType="mainBanner" folder="banners/mini" />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Usar versao mobile</Label>
                        <p className="text-sm text-muted-foreground">Ative para subir uma imagem separada para telas pequenas.</p>
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
                        <Label>Imagem mobile</Label>
                        <ImageUpload value={banner.mobileImageUrl || null} onChange={(url) => updateMiniBanner(index, { mobileImageUrl: url || null, useMobileImage: Boolean(url) || banner.useMobileImage })} imageType="mainBanner" folder="banners/mini/mobile" />
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Texto alternativo</Label>
                        <Input value={banner.altText || ""} onChange={(e) => updateMiniBanner(index, { altText: e.target.value })} placeholder="Descricao do mini banner" />
                      </div>
                      <div className="space-y-2">
                        <Label>Link do mini banner (opcional)</Label>
                        <Input value={banner.linkUrl || ""} onChange={(e) => updateMiniBanner(index, { linkUrl: e.target.value || null })} placeholder="/produtos ou https://..." />
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
              <Label className="text-base font-medium">Modo de Exibicao</Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(['auto', 'custom', 'disabled'] as const).map((mode) => {
                  const labels = { auto: 'Automatico', custom: 'Personalizado', disabled: 'Desativado' };
                  const descriptions = {
                    auto: 'Usa a foto mais recente de cada categoria',
                    custom: 'Faca upload de imagens personalizadas',
                    disabled: 'Nao exibir banners de categoria',
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
                  <Label className="text-base font-medium">Categorias Selecionadas</Label>
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
                      <Label className="text-base font-medium">Imagens Personalizadas</Label>
                      {settings.customization.categoryBanners.map((banner, index) => {
                        const category = categories.find((c) => c.id === banner.categoryId);
                        if (!category) return null;
                        return (
                          <div key={banner.categoryId} className="space-y-4 rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{category.name}</span>
                                <Badge variant={banner.imageUrl ? 'default' : 'secondary'}>{banner.imageUrl ? 'Imagem definida' : 'Sem imagem'}</Badge>
                              </div>
                              <Switch checked={banner.isActive} onCheckedChange={(checked) => updateCategoryBanner(index, { isActive: checked })} />
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Imagem</Label>
                                <ImageUpload value={banner.imageUrl || null} onChange={(url) => updateCategoryBanner(index, { imageUrl: url || '' })} imageType="categoryBanner" folder="banners/categories" />
                              </div>
                              <div className="space-y-2">
                                <Label>Texto Alternativo</Label>
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
                      <p className="text-sm text-muted-foreground mb-4"><strong>Modo Automatico:</strong> O sistema usara automaticamente a foto mais recente de cada categoria.</p>
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
              const labels = { pedidoMinimo: "Pedido Minimo", entrega: "Entrega", pagamento: "Pagamento", atendimento: "Atendimento" };
              const banner = settings.customization.infoBanners?.[key] || getDefaultInfoBanners()[key];
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
            <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />Categorias da Home</CardTitle>
            <CardDescription>Selecione categorias para exibir carrosseis de produtos na home da vitrine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-medium">Categorias Selecionadas</Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {categories.map((cat) => {
                  const selectedHomeCategories = Array.isArray(settings.customization.homeCategories)
                    ? settings.customization.homeCategories
                    : [];
                  const selectedIndex = selectedHomeCategories.findIndex((entry) => entry.categoryId === cat.id);
                  const isSelected = selectedIndex >= 0;

                  return (
                    <div
                      key={`home-category-${cat.id}`}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/50'}`}
                      onClick={() => {
                        if (isSelected) {
                          updateCustomization({ homeCategories: selectedHomeCategories.filter((entry) => entry.categoryId !== cat.id) });
                        } else {
                          updateCustomization({
                            homeCategories: [
                              ...selectedHomeCategories,
                              {
                                categoryId: cat.id,
                                title: cat.name,
                                isActive: true,
                              },
                            ],
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

            {(settings.customization.homeCategories || []).length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base font-medium">Configuracao das secoes</Label>
                  {(settings.customization.homeCategories || []).map((entry, index) => {
                    const category = categories.find((cat) => cat.id === entry.categoryId);
                    if (!category) return null;

                    return (
                      <div key={`home-category-config-${entry.categoryId}`} className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">{category.name}</p>
                            <p className="text-xs text-muted-foreground">Ordem de exibicao: {index + 1}</p>
                          </div>
                          <Switch
                            checked={entry.isActive ?? true}
                            onCheckedChange={(checked) => updateHomeCategory(index, { isActive: checked })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Titulo da secao</Label>
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
                              const selectedHomeCategories = [...(settings.customization.homeCategories || [])];
                              if (index >= selectedHomeCategories.length - 1) return;
                              const [moved] = selectedHomeCategories.splice(index, 1);
                              selectedHomeCategories.splice(index + 1, 0, moved);
                              updateCustomization({ homeCategories: selectedHomeCategories });
                            }}
                            disabled={index >= (settings.customization.homeCategories || []).length - 1}
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
    </div>
  );
}
