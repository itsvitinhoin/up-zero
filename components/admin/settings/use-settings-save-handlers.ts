import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import {
  updateStoreProfileAction,
  updateSiteSettingsAction,
  updateStockSettingsAction,
  updateCustomizationAction,
  updatePaymentSettingsAction,
  manageGetnetWebhookSubscriptionAction,
  updateMarketingSettingsAction,
  updateDomainSettingsAction,
  updateErpSettingsAction,
  type StoreProfileConfig,
} from "@/lib/actions/settings";
import type { SiteSettings } from "@/lib/types";
import { getDefaultMarketingSettings } from "@/components/admin/settings/MarketingTab";
import { getDefaultShippingSettings } from "@/components/admin/settings/ShippingTab";
import { getDefaultErpSettings } from "@/components/admin/settings/ErpTab";
import {
  getDefaultSignWholesale,
  getDefaultAnnouncementBar,
  getDefaultPopupCoupon,
  getDefaultInfoBanners,
} from "@/components/admin/settings/settings-defaults";

interface UseSettingsSaveHandlersProps {
  settings: SiteSettings | null;
  setSettings: Dispatch<SetStateAction<SiteSettings | null>>;
  storeProfile: StoreProfileConfig | null;
  setStoreProfile: Dispatch<SetStateAction<StoreProfileConfig | null>>;
  canEditSettings: boolean;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  router: ReturnType<typeof useRouter>;
}

export function useSettingsSaveHandlers({
  settings,
  setSettings,
  storeProfile,
  setStoreProfile,
  canEditSettings,
  setIsSaving,
  router,
}: UseSettingsSaveHandlersProps) {
  const handleSaveGeneral = async () => {
    if (!settings || !canEditSettings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("requireCnpj", (settings.requireCnpj ?? false).toString());
    formData.append("defaultMinPieces", (settings.defaultMinPieces ?? 0).toString());
    formData.append("minOrderValue", settings.minOrderValue?.toString() || "");
    formData.append("maxInstallmentsText", settings.maxInstallmentsText || "");
    formData.append("stockMode", settings.stockMode || "FANTASY");
    formData.append("variantMaxQty", String(settings.variantMaxQty || 999));
    formData.append("sign_wholesale", JSON.stringify(settings.sign_wholesale || getDefaultSignWholesale()));
    formData.append("priceVisibilityMode", settings.priceVisibilityMode || "LOGIN_REQUIRED");
    formData.append("userLinksPriceVisibilityMode", settings.userLinksPriceVisibilityMode || settings.priceVisibilityMode || "LOGIN_REQUIRED");
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
  };

  const handleSaveCustomization = async () => {
    if (!settings || !canEditSettings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("accentColor", settings.customization.accentColor);
    formData.append("backgroundColor", settings.customization.backgroundColor);
    formData.append("textColor", settings.customization.textColor);
    formData.append("buttonColor", settings.customization.buttonColor);
    formData.append("buttonTextColor", settings.customization.buttonTextColor);
    formData.append("fontFamily", settings.customization.fontFamily || "SYSTEM");
    formData.append("forceUppercaseText", String(settings.customization.forceUppercaseText ?? false));
    formData.append("menuTransparent", String(settings.customization.menuTransparent ?? false));
    formData.append("announcementBar", JSON.stringify(settings.customization.announcementBar || getDefaultAnnouncementBar()));
    formData.append("popupCoupon", JSON.stringify(settings.customization.popupCoupon || getDefaultPopupCoupon()));
    formData.append("mainBanners", JSON.stringify(settings.customization.mainBanners || []));
    formData.append("miniBanners", JSON.stringify(settings.customization.miniBanners || []));
    formData.append("mainBanner", JSON.stringify(settings.customization.mainBanners?.[0] || settings.customization.mainBanner || null));
    formData.append("categoryBannerMode", settings.customization.categoryBannerMode || "custom");
    formData.append("categoryBanners", JSON.stringify(settings.customization.categoryBanners));
    formData.append("infoBanners", JSON.stringify(settings.customization.infoBanners || getDefaultInfoBanners()));
    formData.append("homeCategories", JSON.stringify(settings.customization.homeCategories || []));
    formData.append("storefrontDisplayMode", settings.customization.storefrontDisplayMode || "products");
    formData.append("storefrontNavigationMode", settings.customization.storefrontNavigationMode || "pagination");
    formData.append("storefrontDefaultSort", settings.customization.storefrontDefaultSort || "relevance");
    formData.append("showPixDiscount", String(settings.customization.showPixDiscount ?? true));
    formData.append("showInstallments", String(settings.customization.showInstallments ?? true));
    formData.append("mediaAspectWidth", settings.customization.mediaAspectWidth != null ? String(settings.customization.mediaAspectWidth) : "");
    formData.append("mediaAspectHeight", settings.customization.mediaAspectHeight != null ? String(settings.customization.mediaAspectHeight) : "");
    formData.append("loginSideImageUrl", settings.customization.loginSideImageUrl || "");
    formData.append("logoUrl", settings.customization.logoUrl || "");
    formData.append("logoLightUrl", settings.customization.logoLightUrl || "");
    formData.append("logoDarkUrl", settings.customization.logoDarkUrl || "");
    formData.append("faviconUrl", settings.customization.faviconUrl || "");
    formData.append("productCustomFields", JSON.stringify(settings.productCustomFields || []));

    await updateCustomizationAction(formData);
    setIsSaving(false);
  };

  const handleSavePayment = async () => {
    if (!settings || !canEditSettings) return;
    setIsSaving(true);

    const formData = new FormData();
    const ps = settings.paymentSettings;
    formData.append("mode", ps.mode || "MANUAL");
    formData.append("integratedFlow", ps.integratedFlow || "AUTO_CHARGE");
    formData.append("provider", ps.provider || "NONE");
    formData.append("gatewayEnvironment", ps.gatewayEnvironment || "");
    formData.append("manualInstructions", ps.manualInstructions || "");
    formData.append("apiKey", ps.apiKey || "");
    formData.append("secretKey", ps.secretKey || "");
    formData.append("webhookSecret", ps.webhookSecret || "");
    formData.append("webhookToken", ps.webhookToken || "");
    formData.append("enablePix", String(ps.enablePix ?? true));
    formData.append("enableBoleto", String(ps.enableBoleto ?? true));
    formData.append("enableCreditCard", String(ps.enableCreditCard ?? false));
    formData.append("maxInstallments", String(ps.maxInstallments ?? 12));
    formData.append("enableFaturado", String(ps.enableFaturado ?? true));
    formData.append("faturadoMinOrderValue", ps.faturadoMinOrderValue?.toString() || "");
    formData.append("faturadoMaxDays", String(ps.faturadoMaxDays ?? 30));
    formData.append("pixConditions", JSON.stringify(ps.pixConditions || { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, minInstallmentAmount: null, label: null }));
    formData.append("boletoConditions", JSON.stringify(ps.boletoConditions || { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, minInstallmentAmount: null, label: null }));
    formData.append("creditCardConditions", JSON.stringify(ps.creditCardConditions || { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, minInstallmentAmount: null, label: null }));
    formData.append("faturadoConditions", JSON.stringify(ps.faturadoConditions || { discountPercent: 0, discountFixed: 0, feePercent: 0, minOrderValue: null, maxOrderValue: null, minInstallmentAmount: null, label: null }));
    formData.append("customMethods", JSON.stringify(ps.customMethods || []));

    const result = await updatePaymentSettingsAction(formData);
    if (result.success) {
      router.refresh();
    }
    setIsSaving(false);
  };

  const handleManageGetnetWebhookSubscription = async (
    operation: "register" | "consult" | "remove",
    eventName?: string | null,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!settings) return { success: false, error: "Configurações indisponíveis" };
    if (!canEditSettings) return { success: false, error: "Você não tem permissão para editar configurações" };

    setIsSaving(true);
    const result = await manageGetnetWebhookSubscriptionAction(operation, eventName);
    if (result.success && result.data) {
      setSettings({ ...settings, paymentSettings: result.data });
      router.refresh();
    }
    setIsSaving(false);
    return { success: result.success, error: result.error };
  };

  const handleSaveMarketing = async () => {
    if (!settings || !canEditSettings) return;
    setIsSaving(true);
    await updateMarketingSettingsAction(settings.marketingSettings || getDefaultMarketingSettings());
    setIsSaving(false);
  };

  const handleSaveDomain = async () => {
    if (!settings || !canEditSettings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("customDomain", settings.domainSettings?.customDomain || "");
    formData.append("sslEnabled", settings.domainSettings?.sslEnabled?.toString() || "true");
    formData.append("wwwRedirect", settings.domainSettings?.wwwRedirect?.toString() || "true");

    await updateDomainSettingsAction(formData);
    router.refresh();
    setIsSaving(false);
  };

  const handleSaveShipping = async () => {
    if (!settings || !canEditSettings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("shippingSettings", JSON.stringify(settings.shippingSettings || getDefaultShippingSettings()));
    await updateSiteSettingsAction(formData);
    setIsSaving(false);
  };

  const handleSaveErp = async () => {
    if (!settings || !canEditSettings) return;
    setIsSaving(true);
    await updateErpSettingsAction(settings.erpSettings || getDefaultErpSettings());
    router.refresh();
    setIsSaving(false);
  };

  const handleSaveStock = async () => {
    if (!settings || !canEditSettings) return;
    setIsSaving(true);

    const formData = new FormData();
    formData.append("stockMode", settings.stockMode || "FANTASY");
    formData.append("variantMaxQty", String(settings.variantMaxQty || 999));
    await updateStockSettingsAction(formData);
    setIsSaving(false);
  };

  return {
    handleSaveGeneral,
    handleSaveCustomization,
    handleSavePayment,
    handleManageGetnetWebhookSubscription,
    handleSaveMarketing,
    handleSaveDomain,
    handleSaveErp,
    handleSaveShipping,
    handleSaveStock,
  };
}
