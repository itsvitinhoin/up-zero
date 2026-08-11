import { GeneralTab } from "@/components/admin/settings/GeneralTab";
import { CustomizationTab } from "@/components/admin/settings/CustomizationTab";
import { PaymentsTab } from "@/components/admin/settings/PaymentsTab";
import { MarketingTab } from "@/components/admin/settings/MarketingTab";
import { DomainTab } from "@/components/admin/settings/DomainTab";
import { ShippingTab } from "@/components/admin/settings/ShippingTab";
import { BillingTab } from "@/components/admin/settings/BillingTab";
import { StockTab } from "@/components/admin/settings/StockTab";
import { WebhooksTab } from "@/components/admin/settings/WebhooksTab";
import { ErpTab } from "@/components/admin/settings/ErpTab";
import { FiscalTab } from "@/components/admin/settings/FiscalTab";
import { PermissionsCard } from "@/components/admin/settings/PermissionsCard";
import AdminBranchesPageClient from "@/components/admin/admin-branches-page-client";
import AdminWmsWarehousesClient from "@/components/admin/admin-wms-warehouses-client";
import AdminWmsLocationsClient from "@/components/admin/admin-wms-locations-client";
import type { SettingsPageKey, RoleWithPermissions } from "@/components/admin/settings/settings-types";
import type { SiteSettings, Category, User, Branch } from "@/lib/types";
import type { StoreProfileConfig } from "@/lib/actions/settings";
import type { FiscalOperationNature } from "@/lib/actions/fiscal";
import type { AdminUserOption } from "@/lib/actions/branches";
import type { WmsLocation, WmsWarehouse } from "@/lib/actions/wms";
import type { Permission, RoleGroup } from "@/lib/permissions";
import type { Dispatch, SetStateAction } from "react";

const PAGES_WITHOUT_SETTINGS: SettingsPageKey[] = [
  "branches",
  "stock-warehouses",
  "stock-locations",
  "permissions",
  "integrations",
  "fiscal",
];

export function pageRequiresSettings(currentPage: SettingsPageKey): boolean {
  return !PAGES_WITHOUT_SETTINGS.includes(currentPage);
}

interface SettingsSectionContentProps {
  locale: string;
  currentPage: SettingsPageKey;
  settings: SiteSettings | null;
  setSettings: Dispatch<SetStateAction<SiteSettings | null>>;
  storeProfile: StoreProfileConfig | null;
  setStoreProfile: Dispatch<SetStateAction<StoreProfileConfig | null>>;
  sellerUsers: User[];
  categories: Category[];
  isSaving: boolean;
  canEditSettings: boolean;
  canEditInventory: boolean;
  newWholesaleFieldLabel: string;
  setNewWholesaleFieldLabel: Dispatch<SetStateAction<string>>;
  newWholesaleFieldType: "TEXT" | "EMAIL" | "PHONE" | "CNPJ" | "LONG_TEXT" | "ADDRESS" | "URL" | "SELECT" | "UPLOAD";
  setNewWholesaleFieldType: Dispatch<SetStateAction<"TEXT" | "EMAIL" | "PHONE" | "CNPJ" | "LONG_TEXT" | "ADDRESS" | "URL" | "SELECT" | "UPLOAD">>;
  newCnae: string;
  setNewCnae: Dispatch<SetStateAction<string>>;
  handleSaveGeneral: () => Promise<void>;
  handleSaveCustomization: () => Promise<void>;
  handleSavePayment: () => Promise<void>;
  handleManageGetnetWebhookSubscription: (operation: "register" | "consult" | "remove", eventName?: string | null) => Promise<{ success: boolean; error?: string }>;
  handleSaveShipping: () => Promise<void>;
  handleSaveMarketing: () => Promise<void>;
  handleSaveDomain: () => Promise<void>;
  handleSaveErp: () => Promise<void>;
  handleSaveStock: () => Promise<void>;
  initialPermissions: Permission[];
  initialRoleGroups: RoleGroup[];
  initialSelectedRoleDetails: RoleWithPermissions | null;
  initialWmsWarehouses: WmsWarehouse[];
  initialWmsLocations: WmsLocation[];
  initialWmsLoadError?: string | null;
  initialFiscalNatures: FiscalOperationNature[];
  initialBranches: Branch[];
  initialBranchAdmins: AdminUserOption[];
}

export function SettingsSectionContent({
  locale,
  currentPage,
  settings,
  setSettings,
  storeProfile,
  setStoreProfile,
  sellerUsers,
  categories,
  isSaving,
  canEditSettings,
  canEditInventory,
  newWholesaleFieldLabel,
  setNewWholesaleFieldLabel,
  newWholesaleFieldType,
  setNewWholesaleFieldType,
  newCnae,
  setNewCnae,
  handleSaveGeneral,
  handleSaveCustomization,
  handleSavePayment,
  handleManageGetnetWebhookSubscription,
  handleSaveShipping,
  handleSaveMarketing,
  handleSaveDomain,
  handleSaveErp,
  handleSaveStock,
  initialPermissions,
  initialRoleGroups,
  initialSelectedRoleDetails,
  initialWmsWarehouses,
  initialWmsLocations,
  initialWmsLoadError,
  initialFiscalNatures,
  initialBranches,
  initialBranchAdmins,
}: SettingsSectionContentProps) {
  if (pageRequiresSettings(currentPage) && !settings) {
    return null;
  }

  switch (currentPage) {
    case "general":
      return (
        <GeneralTab
          locale={locale}
          mode="general"
          settings={settings!}
          setSettings={setSettings}
          storeProfile={storeProfile}
          setStoreProfile={setStoreProfile}
          sellerUsers={sellerUsers}
          isSaving={isSaving || !canEditSettings}
          onSave={handleSaveGeneral}
          newWholesaleFieldLabel={newWholesaleFieldLabel}
          setNewWholesaleFieldLabel={setNewWholesaleFieldLabel}
          newWholesaleFieldType={newWholesaleFieldType}
          setNewWholesaleFieldType={setNewWholesaleFieldType}
          newCnae={newCnae}
          setNewCnae={setNewCnae}
        />
      );
    case "permissions":
      return (
        <PermissionsCard
          locale={locale}
          initialPermissions={initialPermissions}
          initialRoleGroups={initialRoleGroups}
          initialSelectedRoleDetails={initialSelectedRoleDetails}
        />
      );
    case "b2b":
      return (
        <GeneralTab
          locale={locale}
          mode="b2b"
          settings={settings!}
          setSettings={setSettings}
          storeProfile={storeProfile}
          setStoreProfile={setStoreProfile}
          sellerUsers={sellerUsers}
          isSaving={isSaving || !canEditSettings}
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
          settings={settings!}
          setSettings={setSettings}
          categories={categories}
          isSaving={isSaving || !canEditSettings}
          onSave={handleSaveCustomization}
        />
      );
    case "payments":
      return (
        <PaymentsTab
          locale={locale}
          settings={settings!}
          setSettings={setSettings}
          isSaving={isSaving || !canEditSettings}
          onSave={handleSavePayment}
          onManageGetnetWebhookSubscription={handleManageGetnetWebhookSubscription}
        />
      );
    case "shipping":
      return (
        <ShippingTab
          locale={locale}
          settings={settings!}
          setSettings={setSettings}
          isSaving={isSaving || !canEditSettings}
          onSave={handleSaveShipping}
        />
      );
    case "marketing":
      return (
        <MarketingTab
          locale={locale}
          settings={settings!}
          setSettings={setSettings}
          isSaving={isSaving || !canEditSettings}
          onSave={handleSaveMarketing}
        />
      );
    case "domain":
      return (
        <DomainTab
          locale={locale}
          settings={settings!}
          setSettings={setSettings}
          isSaving={isSaving || !canEditSettings}
          onSave={handleSaveDomain}
        />
      );
    case "billing":
      return <BillingTab locale={locale} settings={settings!} />;
    case "stock":
      return (
        <StockTab
          locale={locale}
          settings={settings!}
          setSettings={setSettings}
          isSaving={isSaving || !canEditSettings}
          onSave={handleSaveStock}
          canEdit={canEditSettings && canEditInventory}
        />
      );
    case "stock-warehouses":
      return (
        <AdminWmsWarehousesClient
          initialWarehouses={initialWmsWarehouses}
          loadError={initialWmsLoadError}
        />
      );
    case "stock-locations":
      return (
        <AdminWmsLocationsClient
          initialLocations={initialWmsLocations}
          warehouses={initialWmsWarehouses}
          loadError={initialWmsLoadError}
        />
      );
    case "erp":
      return (
        <ErpTab
          locale={locale}
          settings={settings!}
          setSettings={setSettings}
          isSaving={isSaving}
          onSave={handleSaveErp}
          canEdit={canEditSettings}
        />
      );
    case "integrations":
      return <WebhooksTab locale={locale} canEdit={canEditSettings} />;
    case "fiscal":
      return <FiscalTab locale={locale} initialNatures={initialFiscalNatures} />;
    case "branches":
      return (
        <AdminBranchesPageClient
          initialBranches={initialBranches}
          adminUsers={initialBranchAdmins}
        />
      );
    default:
      return null;
  }
}