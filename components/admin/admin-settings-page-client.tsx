"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Store,
  Users,
  Palette,
  CreditCard,
  Truck,
  Megaphone,
  Globe,
  Receipt,
  Boxes,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSiteSettingsAction,
  getStoreProfileAction,
  getUsersAction,
  updateStoreProfileAction,
  updateSiteSettingsAction,
  updateStockSettingsAction,
  updateCustomizationAction,
  updatePaymentSettingsAction,
  updateMarketingSettingsAction,
  updateDomainSettingsAction,
  type StoreProfileConfig,
} from "@/lib/actions/settings";
import { getCategoriesAction } from "@/lib/actions/categories";
import type { SiteSettings, Category, User } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { AdminHero, AdminPage, AdminPanel } from "@/components/admin/admin-mobile-ui";
import { cn } from "@/lib/utils";
import { GeneralTab } from "@/components/admin/settings/GeneralTab";
import { CustomizationTab } from "@/components/admin/settings/CustomizationTab";
import { PaymentsTab } from "@/components/admin/settings/PaymentsTab";
import { MarketingTab, getDefaultMarketingSettings } from "@/components/admin/settings/MarketingTab";
import { DomainTab } from "@/components/admin/settings/DomainTab";
import { ShippingTab, getDefaultShippingSettings } from "@/components/admin/settings/ShippingTab";
import { BillingTab } from "./settings/BillingTab";
import { StockTab } from "./settings/StockTab";
import { tAdmin } from "@/lib/i18n/admin";
import { SettingsSecondaryNav, type NavSection } from "@/components/admin/settings/SettingsSecondaryNav";

export type SettingsPageKey =
  | "general"
  | "b2b"
  | "appearance"
  | "payments"
  | "shipping"
  | "marketing"
  | "domain"
  | "billing"
  | "stock";

interface AdminSettingsPageClientProps {
  locale?: string;
  currentPage: SettingsPageKey;
  initialSettings: SiteSettings | null;
  initialCategories: Category[];
  initialStoreProfile: StoreProfileConfig | null;
}

function getSettingsNav(locale?: string) {
  return [
  {
    key: "general",
    label: tAdmin(locale, "admin.nav.general"),
    icon: Store,
    href: "/settings/general",
    items: [
      { label: tAdmin(locale, "admin.nav.general.storeData"), anchor: "store-data" },
      { label: tAdmin(locale, "admin.nav.general.meta"), anchor: "store-meta" },
      { label: tAdmin(locale, "admin.nav.general.social"), anchor: "store-social" },
      { label: tAdmin(locale, "admin.nav.general.permissions"), anchor: "store-permissions" },
    ],
  },
  {
    key: "b2b",
    label: tAdmin(locale, "admin.nav.b2b"),
    icon: Users,
    href: "/settings/b2b",
    items: [
      { label: tAdmin(locale, "admin.nav.b2b.rules"), anchor: "b2b-rules" },
      { label: tAdmin(locale, "admin.nav.b2b.registration"), anchor: "registration-form" },
      { label: tAdmin(locale, "admin.nav.b2b.autoApproval"), anchor: "auto-approval" },
      { label: tAdmin(locale, "admin.nav.b2b.sellerAssignment"), anchor: "seller-assignment" },
      { label: tAdmin(locale, "admin.nav.b2b.priceVisibility"), anchor: "price-visibility" },
    ],
  },
  {
    key: "appearance",
    label: tAdmin(locale, "admin.nav.appearance"),
    icon: Palette,
    href: "/settings/appearance",
    items: [
      { label: tAdmin(locale, "admin.nav.appearance.announcement"), anchor: "announcement-bar" },
      { label: tAdmin(locale, "admin.nav.appearance.mainBanner"), anchor: "main-banner" },
      { label: "Mini Banners", anchor: "mini-banners" },
      { label: tAdmin(locale, "admin.nav.appearance.categoryBanners"), anchor: "category-banners" },
      { label: tAdmin(locale, "admin.nav.appearance.infoBanners"), anchor: "info-banners" },
      { label: "Categorias da Home", anchor: "home-categories" },
      { label: tAdmin(locale, "admin.nav.appearance.colors"), anchor: "site-colors" },
      { label: tAdmin(locale, "admin.nav.appearance.storefront"), anchor: "site-storefront" },
      { label: tAdmin(locale, "admin.nav.appearance.typography"), anchor: "site-typography" },
      { label: tAdmin(locale, "admin.nav.appearance.logo"), anchor: "logo-favicon" },
    ],
  },
  {
    key: "payments",
    label: tAdmin(locale, "admin.nav.payments"),
    icon: CreditCard,
    href: "/settings/payments",
    items: [
      { label: tAdmin(locale, "admin.nav.payments.mode"), anchor: "payment-mode" },
      { label: tAdmin(locale, "admin.nav.payments.methods"), anchor: "payment-methods" },
      { label: tAdmin(locale, "admin.nav.payments.manual"), anchor: "manual-payments" },
      { label: tAdmin(locale, "admin.nav.payments.conditions"), anchor: "payment-conditions" },
    ],
  },
  {
    key: "stock",
    label: tAdmin(locale, "admin.nav.stock"),
    icon: Boxes,
    href: "/settings/stock",
    items: [
      { label: tAdmin(locale, "admin.nav.stock.mode"), anchor: "stock-mode" },
    ],
  },
  {
    key: "shipping",
    label: tAdmin(locale, "admin.nav.shipping"),
    icon: Truck,
    href: "/settings/shipping",
    items: [
      { label: tAdmin(locale, "admin.nav.shipping.summary"), anchor: "shipping-summary" },
      { label: tAdmin(locale, "admin.nav.shipping.packaging"), anchor: "default-packaging" },
      { label: tAdmin(locale, "admin.nav.shipping.general"), anchor: "shipping-general" },
      { label: tAdmin(locale, "admin.nav.shipping.regions"), anchor: "shipping-regions" },
      { label: tAdmin(locale, "admin.nav.shipping.correios"), anchor: "correios-integration" },
      { label: tAdmin(locale, "admin.nav.shipping.custom"), anchor: "custom-shipping" },
    ],
  },
  {
    key: "marketing",
    label: tAdmin(locale, "admin.nav.marketing"),
    icon: Megaphone,
    href: "/settings/marketing",
    items: [
      { label: tAdmin(locale, "admin.nav.marketing.tracking"), anchor: "marketing-tracking" },
      { label: tAdmin(locale, "admin.nav.marketing.analytics"), anchor: "analytics-tools" },
    ],
  },
  {
    key: "domain",
    label: tAdmin(locale, "admin.nav.domain"),
    icon: Globe,
    href: "/settings/domain",
    items: [],
  },
  {
    key: "billing",
    label: tAdmin(locale, "admin.nav.billing"),
    icon: Receipt,
    href: "/settings/billing",
    items: [],
  },
]
}

function getSettingsNavSections(locale?: string): NavSection[] {
  const nav = getSettingsNav(locale);
  const byKey = new Map(nav.map((g) => [g.key, g]));
  const get = (key: string) => byKey.get(key)!;
  return [
    { title: "Loja", groups: ["general", "appearance", "stock"].map(get) },
    { title: "Vendas", groups: ["b2b", "payments", "shipping"].map(get) },
    { title: "Crescimento", groups: ["marketing", "domain"].map(get) },
    { title: "Plano", groups: ["billing"].map(get) },
  ];
}

function getDefaultSignWholesale() {
  return {
    fields: [
      { id: "name", label: "Nome Completo", type: "TEXT" as const, enabled: true, required: true, order: 1, isDefault: true },
      { id: "email", label: "E-mail", type: "EMAIL" as const, enabled: true, required: true, order: 2, isDefault: true },
      { id: "phone", label: "Telefone / WhatsApp", type: "PHONE" as const, enabled: true, required: true, order: 3, isDefault: true },
      { id: "cnpj", label: "CNPJ", type: "CNPJ" as const, enabled: true, required: true, order: 4, isDefault: true },
      { id: "companyName", label: "Razao Social", type: "TEXT" as const, enabled: true, required: true, order: 5, isDefault: true },
      { id: "tradeName", label: "Nome Fantasia", type: "TEXT" as const, enabled: true, required: false, order: 6, isDefault: true },
      { id: "stateRegistration", label: "Inscricao Estadual", type: "TEXT" as const, enabled: true, required: false, order: 7, isDefault: true },
      { id: "address", label: "Endereco Completo", type: "LONG_TEXT" as const, enabled: true, required: true, order: 8, isDefault: true },
    ],
    autoApproval: {
      enabled: true,
      mode: "CNAE" as const,
      validateCnpjOnReceita: true,
      allowedCnaes: ["4781-4/00", "4782-2/01", "4789-0/99", "4755-5/01", "4755-5/02", "4781-4/01"],
    },
    sellerAssignment: {
      enabled: true,
      mode: "ROUND_ROBIN" as const,
      sellerIds: [],
      fallbackSellerId: null,
    },
  };
}


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

export default function AdminSettingsPageClient({
  locale = "en",
  currentPage,
  initialSettings,
  initialCategories,
  initialStoreProfile,
}: AdminSettingsPageClientProps) {
  const settingsNav = getSettingsNav(locale);
  const settingsNavSections = getSettingsNavSections(locale);
  const [settings, setSettings] = useState<SiteSettings | null>(initialSettings);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [storeProfile, setStoreProfile] = useState<StoreProfileConfig | null>(initialStoreProfile);
  const [isLoading, setIsLoading] = useState(!initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [sellerUsers, setSellerUsers] = useState<User[]>([]);
  const [newWholesaleFieldLabel, setNewWholesaleFieldLabel] = useState("");
  const [newWholesaleFieldType, setNewWholesaleFieldType] = useState<"TEXT" | "EMAIL" | "PHONE" | "CNPJ" | "LONG_TEXT" | "URL" | "SELECT" | "UPLOAD">("TEXT");
  const [newCnae, setNewCnae] = useState("");
  const [activeAnchor, setActiveAnchor] = useState("");

  useEffect(() => {
    if (!initialSettings) {
      void loadData();
    }
  }, [initialSettings]);

  useEffect(() => {
    void loadSellerUsers();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash?.slice(1);
    setActiveAnchor(hash || "");
    if (!hash) return;
    const timeout = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => clearTimeout(timeout);
  }, [currentPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateHash = () => {
      setActiveAnchor(window.location.hash?.slice(1) || "");
    };
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    if (storeProfile) return;
    let cancelled = false;
    const loadStoreProfile = async () => {
      const result = await getStoreProfileAction();
      if (!cancelled && result.success && result.data) {
        setStoreProfile(result.data);
      }
    };
    void loadStoreProfile();
    return () => { cancelled = true; };
  }, [storeProfile]);

  async function loadData() {
    setIsLoading(true);
    const [settingsResult, categoriesResult, storeProfileResult] = await Promise.all([
      getSiteSettingsAction(),
      getCategoriesAction(),
      getStoreProfileAction(),
    ]);

    if (settingsResult.success && settingsResult.data) {
      setSettings({
        ...settingsResult.data,
        sign_wholesale: settingsResult.data.sign_wholesale || getDefaultSignWholesale(),
        shippingSettings: settingsResult.data.shippingSettings || getDefaultShippingSettings(),
        marketingSettings: settingsResult.data.marketingSettings || getDefaultMarketingSettings(),
      });
    }
    if (categoriesResult.success && categoriesResult.data) {
      setCategories(categoriesResult.data);
    }
    if (storeProfileResult.success && storeProfileResult.data) {
      setStoreProfile(storeProfileResult.data);
    }
    setIsLoading(false);
  }

  async function loadSellerUsers() {
    const result = await getUsersAction({ role: "SELLER", isActive: true });
    if (result.success && result.data) {
      setSellerUsers(result.data);
    }
  }

  async function handleSaveGeneral() {
    if (!settings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("requireCnpj", (settings.requireCnpj ?? false).toString());
    formData.append("defaultMinPieces", (settings.defaultMinPieces ?? 0).toString());
    formData.append("minOrderValue", settings.minOrderValue?.toString() || "");
    formData.append("maxInstallmentsText", settings.maxInstallmentsText || "");
    formData.append("stockMode", settings.stockMode || "FANTASY");
    formData.append("variantMaxQty", String(settings.variantMaxQty || 999));
    formData.append("sign_wholesale", JSON.stringify(settings.sign_wholesale || getDefaultSignWholesale()));
    formData.append("priceVisibilityMode", settings.priceVisibilityMode || "ALL");
    formData.append("pendingCustomerMessage", settings.pendingCustomerMessage || "");
    formData.append("sellerCanApproveCustomers", (settings.sellerCanApproveCustomers ?? false).toString());
    formData.append("sellerCanEditPriceTable", (settings.sellerCanEditPriceTable ?? false).toString());
    formData.append("sellerCanCreateOrders", (settings.sellerCanCreateOrders ?? false).toString());

    await updateSiteSettingsAction(formData);

    if (storeProfile) {
      const storeFormData = new FormData();
      storeFormData.append("storeName", storeProfile.name || "");
      storeFormData.append("storeCnpj", storeProfile.cnpj || "");
      storeFormData.append("storeDescription", storeProfile.description || "");
      storeFormData.append("storeEmail", storeProfile.email || "");
      storeFormData.append("storePhone", storeProfile.phone || "");
      storeFormData.append("storeWhatsapp", storeProfile.whatsapp || "");
      storeFormData.append("storeB2bMasterPassword", storeProfile.b2bMasterPassword || "");
      storeFormData.append("storeAddress", JSON.stringify(storeProfile.address || {}));
      storeFormData.append("storeMeta", JSON.stringify(storeProfile.meta || {}));
      const storeResult = await updateStoreProfileAction(storeFormData);
      if (storeResult.success && storeResult.data) {
        setStoreProfile(storeResult.data);
      }
    }

    setIsSaving(false);
  }

  async function handleSaveCustomization() {
    if (!settings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("accentColor", settings.customization.accentColor);
    formData.append("backgroundColor", settings.customization.backgroundColor);
    formData.append("textColor", settings.customization.textColor);
    formData.append("buttonColor", settings.customization.buttonColor);
    formData.append("buttonTextColor", settings.customization.buttonTextColor);
    formData.append("fontFamily", settings.customization.fontFamily || "SYSTEM");
    formData.append("forceUppercaseText", String(settings.customization.forceUppercaseText ?? false));
    formData.append("announcementBar", JSON.stringify(settings.customization.announcementBar || getDefaultAnnouncementBar()));
    formData.append("mainBanners", JSON.stringify(settings.customization.mainBanners || []));
    formData.append("miniBanners", JSON.stringify(settings.customization.miniBanners || []));
    formData.append("mainBanner", JSON.stringify(settings.customization.mainBanners?.[0] || settings.customization.mainBanner || null));
    formData.append("categoryBannerMode", settings.customization.categoryBannerMode || "custom");
    formData.append("categoryBanners", JSON.stringify(settings.customization.categoryBanners));
    formData.append("infoBanners", JSON.stringify(settings.customization.infoBanners || getDefaultInfoBanners()));
    formData.append("homeCategories", JSON.stringify(settings.customization.homeCategories || []));
    formData.append("storefrontDisplayMode", settings.customization.storefrontDisplayMode || "products");
    formData.append("logoUrl", settings.customization.logoUrl || "");
    formData.append("logoLightUrl", settings.customization.logoLightUrl || "");
    formData.append("logoDarkUrl", settings.customization.logoDarkUrl || "");
    formData.append("faviconUrl", settings.customization.faviconUrl || "");

    await updateCustomizationAction(formData);
    setIsSaving(false);
  }

  async function handleSavePayment() {
    if (!settings) return;
    setIsSaving(true);

    const formData = new FormData();
    const ps = settings.paymentSettings;
    formData.append("mode", ps.mode || "MANUAL");
    formData.append("provider", ps.provider || "NONE");
    formData.append("manualInstructions", ps.manualInstructions || "");
    formData.append("apiKey", ps.apiKey || "");
    formData.append("secretKey", ps.secretKey || "");
    formData.append("webhookSecret", ps.webhookSecret || "");
    formData.append("enablePix", String(ps.enablePix ?? true));
    formData.append("enableBoleto", String(ps.enableBoleto ?? true));
    formData.append("enableCreditCard", String(ps.enableCreditCard ?? false));
    formData.append("maxInstallments", String(ps.maxInstallments ?? 12));
    formData.append("enableFaturado", String(ps.enableFaturado ?? true));
    formData.append("faturadoMinOrderValue", ps.faturadoMinOrderValue?.toString() || "");
    formData.append("faturadoMaxDays", String(ps.faturadoMaxDays ?? 30));
    formData.append("pixConditions", JSON.stringify(ps.pixConditions || { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, label: null }));
    formData.append("boletoConditions", JSON.stringify(ps.boletoConditions || { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, label: null }));
    formData.append("creditCardConditions", JSON.stringify(ps.creditCardConditions || { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, label: null }));
    formData.append("faturadoConditions", JSON.stringify(ps.faturadoConditions || { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, label: null }));
    formData.append("customMethods", JSON.stringify(ps.customMethods || []));

    await updatePaymentSettingsAction(formData);
    setIsSaving(false);
  }

  async function handleSaveMarketing() {
    if (!settings) return;
    setIsSaving(true);

    await updateMarketingSettingsAction(settings.marketingSettings || getDefaultMarketingSettings());
    setIsSaving(false);
  }

  async function handleSaveDomain() {
    if (!settings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("customDomain", settings.domainSettings?.customDomain || "");
    formData.append("sslEnabled", settings.domainSettings?.sslEnabled?.toString() || "true");
    formData.append("wwwRedirect", settings.domainSettings?.wwwRedirect?.toString() || "true");

    await updateDomainSettingsAction(formData);
    await loadData();
    setIsSaving(false);
  }

  async function handleSaveShipping() {
    if (!settings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("shippingSettings", JSON.stringify(settings.shippingSettings || getDefaultShippingSettings()));

    await updateSiteSettingsAction(formData);
    setIsSaving(false);
  }

  async function handleSaveStock() {
    if (!settings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("stockMode", settings.stockMode || "FANTASY");
    formData.append("variantMaxQty", String(settings.variantMaxQty || 999));

    await updateStockSettingsAction(formData);
    setIsSaving(false);
  }

  function handleAnchorClick(anchor: string) {
    setActiveAnchor(anchor);
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCurrentPage() {
    if (!settings) return null;

    switch (currentPage) {
      case "general":
        return (
          <GeneralTab
            locale={locale}
            mode="general"
            settings={settings}
            setSettings={setSettings}
            storeProfile={storeProfile}
            setStoreProfile={setStoreProfile}
            sellerUsers={sellerUsers}
            isSaving={isSaving}
            onSave={handleSaveGeneral}
            newWholesaleFieldLabel={newWholesaleFieldLabel}
            setNewWholesaleFieldLabel={setNewWholesaleFieldLabel}
            newWholesaleFieldType={newWholesaleFieldType}
            setNewWholesaleFieldType={setNewWholesaleFieldType}
            newCnae={newCnae}
            setNewCnae={setNewCnae}
          />
        );
      case "b2b":
        return (
          <GeneralTab
            locale={locale}
            mode="b2b"
            settings={settings}
            setSettings={setSettings}
            storeProfile={storeProfile}
            setStoreProfile={setStoreProfile}
            sellerUsers={sellerUsers}
            isSaving={isSaving}
            onSave={handleSaveGeneral}
            newWholesaleFieldLabel={newWholesaleFieldLabel}
            setNewWholesaleFieldLabel={setNewWholesaleFieldLabel}
            newWholesaleFieldType={newWholesaleFieldType}
            setNewWholesaleFieldType={setNewWholesaleFieldType}
            newCnae={newCnae}
            setNewCnae={setNewCnae}
          />
        );
      case "appearance":
        return (
          <CustomizationTab
            locale={locale}
            settings={settings}
            setSettings={setSettings}
            categories={categories}
            isSaving={isSaving}
            onSave={handleSaveCustomization}
          />
        );
      case "payments":
        return (
          <PaymentsTab
            locale={locale}
            settings={settings}
            setSettings={setSettings}
            isSaving={isSaving}
            onSave={handleSavePayment}
          />
        );
      case "shipping":
        return (
          <ShippingTab
            locale={locale}
            settings={settings}
            setSettings={setSettings}
            isSaving={isSaving}
            onSave={handleSaveShipping}
          />
        );
      case "marketing":
        return (
          <MarketingTab
            locale={locale}
            settings={settings}
            setSettings={setSettings}
            isSaving={isSaving}
            onSave={handleSaveMarketing}
          />
        );
      case "domain":
        return (
          <DomainTab
            locale={locale}
            settings={settings}
            setSettings={setSettings}
            isSaving={isSaving}
            onSave={handleSaveDomain}
          />
        );
      case "billing":
        return <BillingTab locale={locale} settings={settings} />;
      case "stock":
        return (
          <StockTab
            locale={locale}
            settings={settings}
            setSettings={setSettings}
            isSaving={isSaving}
            onSave={handleSaveStock}
          />
        );
      default:
        return null;
    }
  }

  const currentSaveHandler: (() => void) | null = (() => {
    if (currentPage === 'billing') return null;
    const map: Record<SettingsPageKey, () => void> = {
      general: handleSaveGeneral,
      b2b: handleSaveGeneral,
      appearance: handleSaveCustomization,
      payments: handleSavePayment,
      shipping: handleSaveShipping,
      marketing: handleSaveMarketing,
      domain: handleSaveDomain,
      billing: () => {},
      stock: handleSaveStock,
    };
    return map[currentPage] ?? null;
  })();

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{tAdmin(locale, "admin.settings.loading")}</p>
      </div>
    );
  }

  return (
    <AdminPage className="pb-40 md:pb-28">
      <AdminHero
        icon={Settings}
        eyebrow="Configuracoes"
        title={tAdmin(locale, "admin.settings.title")}
        description={tAdmin(locale, "admin.settings.subtitle")}
      />

      {/* Mobile horizontal nav — hidden on desktop */}
      <div className="lg:hidden -mx-4 px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {settingsNav.map((group) => {
            const Icon = group.icon;
            const isActive = currentPage === group.key;
            return (
              <Link
                key={group.key}
                href={group.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {group.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden rounded-[24px] border-border/60 p-2 shadow-sm">
            <CardContent className="p-3">
              <SettingsSecondaryNav
                sections={settingsNavSections}
                currentPage={currentPage}
                activeAnchor={activeAnchor}
                onAnchorClick={handleAnchorClick}
              />
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0">
          <AdminPanel className="overflow-hidden rounded-[24px] border-border/60 shadow-sm">
          {renderCurrentPage()}
          </AdminPanel>
        </div>
      </div>

      {/* Floating Save button */}
      {currentSaveHandler && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="fixed bottom-[88px] md:bottom-6 right-4 md:right-6 z-50"
        >
          <Button
            onClick={currentSaveHandler}
            disabled={isSaving}
            className="h-14 px-6 rounded-full bg-primary hover:bg-primary/90 shadow-[0_4px_24px_rgba(0,0,0,0.25)] text-sm font-semibold gap-2"
          >
            <Save className="h-5 w-5" />
            <span>{isSaving ? 'Salvando…' : 'Salvar'}</span>
          </Button>
        </motion.div>
      )}
    </AdminPage>
  );
}
