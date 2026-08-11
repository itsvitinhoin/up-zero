import Link from "next/link";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import {
  Store,
  GitBranch,
  Users,
  Palette,
  CreditCard,
  Truck,
  Megaphone,
  Globe,
  Receipt,
  Boxes,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tAdmin } from "@/lib/i18n/admin";
import type { SettingsPageKey } from "@/components/admin/settings/settings-types";

type NavItem = {
  label: string;
  anchor: string;
  href?: string;
  page?: SettingsPageKey;
};

type NavGroup = {
  key: SettingsPageKey;
  label: string;
  icon: LucideIcon;
  href: string;
  items: NavItem[];
};

function getSettingsNav(locale?: string): NavGroup[] {
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
        {
          label: tAdmin(locale, "admin.nav.general.permissions"),
          anchor: "store-permissions",
          href: "/settings/permissions",
          page: "permissions",
        },
      ],
    },
    {
      key: "branches",
      label: "Filiais",
      icon: GitBranch,
      href: "/settings/branches",
      items: [],
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
        { label: tAdmin(locale, "admin.appearance.menu.title", "Menu"), anchor: "menu" },
        { label: "Produtos", anchor: "product-custom-fields" },
        { label: tAdmin(locale, "admin.nav.appearance.announcement"), anchor: "announcement-bar" },
        { label: "Popup", anchor: "popup" },
        { label: tAdmin(locale, "admin.nav.appearance.mainBanner"), anchor: "main-banner" },
        { label: tAdmin(locale, "admin.nav.appearance.miniBanners"), anchor: "mini-banners" },
        { label: tAdmin(locale, "admin.nav.appearance.categoryBanners"), anchor: "category-banners" },
        { label: tAdmin(locale, "admin.nav.appearance.infoBanners"), anchor: "info-banners" },
        { label: tAdmin(locale, "admin.nav.appearance.homeCategories"), anchor: "home-categories" },
        { label: tAdmin(locale, "admin.nav.appearance.colors"), anchor: "site-colors" },
        { label: tAdmin(locale, "admin.nav.appearance.storefront"), anchor: "site-storefront" },
        { label: "Login", anchor: "login" },
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
        { label: tAdmin(locale, "admin.nav.stock.mode"), anchor: "stock-mode", href: "/settings/stock", page: "stock" },
        { label: "Armazéns", anchor: "stock-warehouses", href: "/settings/stock-warehouses", page: "stock-warehouses" },
        { label: "Localizações", anchor: "stock-locations", href: "/settings/stock-locations", page: "stock-locations" },
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
      key: "integrations",
      label: tAdmin(locale, "admin.nav.integrations"),
      icon: Webhook,
      href: "/settings/erp",
      items: [
        { label: tAdmin(locale, "admin.nav.integrations.erp"), anchor: "erp", href: "/settings/erp", page: "erp" },
        { label: tAdmin(locale, "admin.nav.integrations.webhooks"), anchor: "webhooks", href: "/settings/integrations", page: "integrations" },
      ],
    },
    {
      key: "fiscal",
      label: tAdmin(locale, "admin.nav.fiscal"),
      icon: Receipt,
      href: "/settings/fiscal",
      items: [
        { label: tAdmin(locale, "admin.nav.fiscal.emitters"), anchor: "emitters" },
        { label: tAdmin(locale, "admin.nav.fiscal.operationNatures"), anchor: "operation-natures" },
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
  ];
}

interface SettingsSidebarNavProps {
  locale?: string;
  currentPage: SettingsPageKey;
  canManageSettingsRoles: boolean;
  canViewInventory: boolean;
  canEditInventory: boolean;
  activeAnchor: string;
  setActiveAnchor: Dispatch<SetStateAction<string>>;
}

export function SettingsSidebarNav({
  locale,
  currentPage,
  canManageSettingsRoles,
  canViewInventory,
  canEditInventory,
  activeAnchor,
  setActiveAnchor,
}: SettingsSidebarNavProps) {
  const settingsNav = useMemo(
    () =>
      getSettingsNav(locale)
        .map((group) => {
          if (group.key === "general") {
            return {
              ...group,
              items: group.items.filter((item) => item.page !== "permissions" || canManageSettingsRoles),
            };
          }
          if (group.key !== "stock") return group;
          if (!canViewInventory) return null;
          return {
            ...group,
            items: group.items.filter((item) => item.page === "stock" || canEditInventory),
          };
        })
        .filter((group): group is NonNullable<typeof group> => Boolean(group)),
    [locale, canManageSettingsRoles, canViewInventory, canEditInventory],
  );

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <Card className="p-2">
        <CardContent className="p-3">
          <nav className="space-y-2">
            {settingsNav.map((group) => {
              const Icon = group.icon;
              const isStockSubPage = currentPage === "stock-warehouses" || currentPage === "stock-locations";
              const isIntegrationsSubPage = currentPage === "erp" || currentPage === "integrations";
              const isActive =
                currentPage === group.key ||
                (group.key === "stock" && isStockSubPage) ||
                (group.key === "integrations" && isIntegrationsSubPage) ||
                (group.key === "general" && currentPage === "permissions");

              if (group.items.length > 0) {
                return (
                  <div
                    key={group.key}
                    className={cn("block rounded-xl px-3 py-1 transition-colors hover:bg-muted/50")}
                  >
                    <Link href={group.href} className="block rounded-md px-1 py-1 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn(isActive ? "text-primary" : "text-foreground")}>{group.label}</span>
                      </div>
                    </Link>
                    <ul className="mt-2 space-y-1">
                      {group.items.map((item) => {
                        const isItemActive = item.page
                          ? currentPage === item.page
                          : isActive && !item.href && activeAnchor === item.anchor;

                        return (
                          <li key={item.href ?? item.anchor}>
                            <Link
                              href={item.href ?? `${group.href}#${item.anchor}`}
                              onClick={(e) => {
                                if (item.href) return;
                                if (currentPage === group.key) {
                                  e.preventDefault();
                                  setActiveAnchor(item.anchor);
                                  document
                                    .getElementById(item.anchor)
                                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }
                              }}
                              className={cn(
                                "block rounded-lg px-2.5 py-1 text-sm transition-colors",
                                isItemActive
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                              )}
                            >
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              }

              return (
                <Link
                  key={group.key}
                  href={group.href}
                  className={cn("block rounded-xl px-3 py-1 transition-colors hover:bg-muted/50")}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn(isActive ? "text-primary" : "text-foreground")}>{group.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </CardContent>
      </Card>
    </aside>
  );
}
