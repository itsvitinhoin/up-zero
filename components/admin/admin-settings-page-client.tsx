"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Settings } from "lucide-react";
import type { SiteSettings, Category, User } from "@/lib/types";
import type { StoreProfileConfig } from "@/lib/actions/settings";
import {
  SettingsSectionContent,
  pageRequiresSettings,
} from "@/components/admin/settings/settings-section-content";
import { useSettingsSaveHandlers } from "@/components/admin/settings/use-settings-save-handlers";
import type { AdminSettingsPageClientProps } from "@/components/admin/settings/settings-types";
import { tAdmin } from "@/lib/i18n/admin";
import { useAdminStore } from "@/contexts/admin-store-context";

export default function AdminSettingsPageClient({
  locale = "en",
  currentPage,
  initialSettings,
  initialCategories,
  initialStoreProfile,
  initialSellerUsers,
  initialFiscalNatures,
  initialBranches,
  initialBranchAdmins,
  initialWmsWarehouses,
  initialWmsLocations,
  initialWmsLoadError,
  initialPermissions,
  initialRoleGroups,
  initialSelectedRoleDetails,
}: AdminSettingsPageClientProps) {
  const router = useRouter();
  const { session } = useAdminStore();
  const normalizedPermissionCodes = useMemo(
    () => Array.isArray(session?.permissionCodes)
      ? session.permissionCodes.map((code) => String(code || '').trim().toLowerCase()).filter(Boolean)
      : null,
    [session?.permissionCodes],
  );
  const hasPermission = (code: string) => !normalizedPermissionCodes || normalizedPermissionCodes.includes(code.toLowerCase());
  const canEditSettings = hasPermission('settings.edit');
  const canManageSettingsRoles = hasPermission('settings.manage_roles');
  const canViewInventory = hasPermission('inventory.view');
  const canEditInventory = hasPermission('inventory.edit');

  const [settings, setSettings] = useState<SiteSettings | null>(initialSettings);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [storeProfile, setStoreProfile] = useState<StoreProfileConfig | null>(initialStoreProfile);
  const [isLoading, setIsLoading] = useState(!initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [sellerUsers, setSellerUsers] = useState<User[]>(initialSellerUsers);
  const [newWholesaleFieldLabel, setNewWholesaleFieldLabel] = useState("");
  const [newWholesaleFieldType, setNewWholesaleFieldType] = useState<"TEXT" | "EMAIL" | "PHONE" | "CNPJ" | "LONG_TEXT" | "ADDRESS" | "URL" | "SELECT" | "UPLOAD">("TEXT");
  const [newCnae, setNewCnae] = useState("");
  const [activeAnchor, setActiveAnchor] = useState("");

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
      setIsLoading(false);
    }
  }, [initialSettings]);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    if (initialStoreProfile) {
      setStoreProfile(initialStoreProfile);
    }
  }, [initialStoreProfile]);

  useEffect(() => {
    setSellerUsers(initialSellerUsers);
  }, [initialSellerUsers]);

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

  const {
    handleSaveGeneral,
    handleSaveCustomization,
    handleSavePayment,
    handleManageGetnetWebhookSubscription,
    handleSaveMarketing,
    handleSaveDomain,
    handleSaveErp,
    handleSaveShipping,
    handleSaveStock,
  } = useSettingsSaveHandlers({
    settings,
    setSettings,
    storeProfile,
    setStoreProfile,
    canEditSettings,
    setIsSaving,
    router,
  });

  const currentPageRequiresSettings = pageRequiresSettings(currentPage);
  if (currentPageRequiresSettings && (isLoading || !settings)) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{tAdmin(locale, "admin.settings.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          {tAdmin(locale, "admin.settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.settings.subtitle")}</p>
      </div>

      <div className="min-w-0">
          <SettingsSectionContent
            locale={locale}
            currentPage={currentPage}
            settings={settings}
            setSettings={setSettings}
            storeProfile={storeProfile}
            setStoreProfile={setStoreProfile}
            sellerUsers={sellerUsers}
            categories={categories}
            isSaving={isSaving}
            canEditSettings={canEditSettings}
            canEditInventory={canEditInventory}
            newWholesaleFieldLabel={newWholesaleFieldLabel}
            setNewWholesaleFieldLabel={setNewWholesaleFieldLabel}
            newWholesaleFieldType={newWholesaleFieldType}
            setNewWholesaleFieldType={setNewWholesaleFieldType}
            newCnae={newCnae}
            setNewCnae={setNewCnae}
            handleSaveGeneral={handleSaveGeneral}
            handleSaveCustomization={handleSaveCustomization}
            handleSavePayment={handleSavePayment}
            handleManageGetnetWebhookSubscription={handleManageGetnetWebhookSubscription}
            handleSaveShipping={handleSaveShipping}
            handleSaveMarketing={handleSaveMarketing}
            handleSaveDomain={handleSaveDomain}
            handleSaveErp={handleSaveErp}
            handleSaveStock={handleSaveStock}
            initialPermissions={initialPermissions}
            initialRoleGroups={initialRoleGroups}
            initialSelectedRoleDetails={initialSelectedRoleDetails}
            initialWmsWarehouses={initialWmsWarehouses}
            initialWmsLocations={initialWmsLocations}
            initialWmsLoadError={initialWmsLoadError}
            initialFiscalNatures={initialFiscalNatures}
            initialBranches={initialBranches}
            initialBranchAdmins={initialBranchAdmins}
          />
      </div>
    </div>
  );
}
