"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, AlertCircle, ExternalLink } from "lucide-react";
import type { SiteSettings, MarketingSettings } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

export function getDefaultMarketingSettings(): MarketingSettings {
  return {
    metaPixel: { enabled: false, id: null, accessToken: null, testEventCode: null },
    googleAnalytics: { enabled: false, id: null, measurementId: null },
    googleAds: { enabled: false, id: null, conversionId: null, conversionLabel: null },
    googleMerchant: { enabled: false, id: null, merchantId: null },
    googleTagManager: { enabled: false, id: null },
    pinterestTag: { enabled: false, id: null },
    tiktokPixel: { enabled: false, id: null, accessToken: null },
    snapchatPixel: { enabled: false, id: null },
    hotjar: { enabled: false, id: null },
    microsoftClarity: { enabled: false, id: null },
  };
}

interface MarketingTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function MarketingTab({ locale = "en", settings, setSettings, isSaving, onSave }: MarketingTabProps) {
  const ms = settings.marketingSettings || getDefaultMarketingSettings();

  function updateMarketingSettings(updates: Partial<MarketingSettings>) {
    setSettings({ ...settings, marketingSettings: { ...ms, ...updates } });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{tAdmin(locale, "admin.marketing.title", "Marketing & Tracking")}</h2>
          <p className="text-muted-foreground">{tAdmin(locale, "admin.marketing.subtitle", "Configure pixels and marketing integrations to track conversions")}</p>
        </div>
        <Button onClick={onSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? tAdmin(locale, "admin.common.saving", "Saving...") : tAdmin(locale, "admin.marketing.save", "Save Marketing")}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Meta Pixel */}
        <Card id="marketing-tracking">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">f</span>
                </div>
                <div>
                  <CardTitle>Meta Pixel (Facebook/Instagram)</CardTitle>
                  <CardDescription>{tAdmin(locale, "admin.marketing.metaPixel.description", "Track conversions and build audiences for ads")}</CardDescription>
                </div>
              </div>
              <Switch checked={ms.metaPixel.enabled} onCheckedChange={(checked) => updateMarketingSettings({ metaPixel: { ...ms.metaPixel, enabled: checked } })} />
            </div>
          </CardHeader>
          {ms.metaPixel.enabled && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metaPixelId">Pixel ID</Label>
                  <Input id="metaPixelId" value={ms.metaPixel.id || ""} onChange={(e) => updateMarketingSettings({ metaPixel: { ...ms.metaPixel, id: e.target.value || null } })} placeholder="123456789012345" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metaAccessToken">Access Token (para Conversions API)</Label>
                  <Input id="metaAccessToken" type="password" value={ms.metaPixel.accessToken || ""} onChange={(e) => updateMarketingSettings({ metaPixel: { ...ms.metaPixel, accessToken: e.target.value || null } })} placeholder="EAAxxxxxxxx..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaTestEventCode">Test Event Code (opcional)</Label>
                <Input id="metaTestEventCode" value={ms.metaPixel.testEventCode || ""} onChange={(e) => updateMarketingSettings({ metaPixel: { ...ms.metaPixel, testEventCode: e.target.value || null } })} placeholder="TEST12345" />
                <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.marketing.metaPixel.testHelp", "Use this to validate events in Events Manager before production")}</p>
              </div>
              <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                {tAdmin(locale, "admin.marketing.links.eventsManager", "Open Events Manager")} <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          )}
        </Card>

        {/* Google Analytics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">G</span>
                </div>
                <div>
                  <CardTitle>Google Analytics 4</CardTitle>
                  <CardDescription>{tAdmin(locale, "admin.marketing.ga4.description", "Analyze visitor behavior on your site")}</CardDescription>
                </div>
              </div>
              <Switch checked={ms.googleAnalytics.enabled} onCheckedChange={(checked) => updateMarketingSettings({ googleAnalytics: { ...ms.googleAnalytics, enabled: checked } })} />
            </div>
          </CardHeader>
          {ms.googleAnalytics.enabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ga4MeasurementId">Measurement ID</Label>
                <Input id="ga4MeasurementId" value={ms.googleAnalytics.measurementId || ""} onChange={(e) => updateMarketingSettings({ googleAnalytics: { ...ms.googleAnalytics, measurementId: e.target.value || null, id: e.target.value || null } })} placeholder="G-XXXXXXXXXX" />
              </div>
              <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                {tAdmin(locale, "admin.marketing.links.ga4", "Open Google Analytics")} <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          )}
        </Card>

        {/* Google Ads */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Ads</span>
                </div>
                <div>
                  <CardTitle>Google Ads</CardTitle>
                  <CardDescription>{tAdmin(locale, "admin.marketing.gads.description", "Track conversions from Google Ads campaigns")}</CardDescription>
                </div>
              </div>
              <Switch checked={ms.googleAds.enabled} onCheckedChange={(checked) => updateMarketingSettings({ googleAds: { ...ms.googleAds, enabled: checked } })} />
            </div>
          </CardHeader>
          {ms.googleAds.enabled && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="googleAdsConversionId">Conversion ID</Label>
                  <Input id="googleAdsConversionId" value={ms.googleAds.conversionId || ""} onChange={(e) => updateMarketingSettings({ googleAds: { ...ms.googleAds, conversionId: e.target.value || null, id: e.target.value || null } })} placeholder="AW-123456789" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="googleAdsConversionLabel">Conversion Label</Label>
                  <Input id="googleAdsConversionLabel" value={ms.googleAds.conversionLabel || ""} onChange={(e) => updateMarketingSettings({ googleAds: { ...ms.googleAds, conversionLabel: e.target.value || null } })} placeholder="AbCdEfGhIjKlMnOp" />
                </div>
              </div>
              <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                {tAdmin(locale, "admin.marketing.links.gads", "Open Google Ads")} <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          )}
        </Card>

        {/* Google Merchant Center */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">GMC</span>
                </div>
                <div>
                  <CardTitle>Google Merchant Center</CardTitle>
                  <CardDescription>{tAdmin(locale, "admin.marketing.gmc.description", "Show your products in Google Shopping")}</CardDescription>
                </div>
              </div>
              <Switch checked={ms.googleMerchant.enabled} onCheckedChange={(checked) => updateMarketingSettings({ googleMerchant: { ...ms.googleMerchant, enabled: checked } })} />
            </div>
          </CardHeader>
          {ms.googleMerchant.enabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="merchantId">Merchant ID</Label>
                <Input id="merchantId" value={ms.googleMerchant.merchantId || ""} onChange={(e) => updateMarketingSettings({ googleMerchant: { ...ms.googleMerchant, merchantId: e.target.value || null, id: e.target.value || null } })} placeholder="123456789" />
              </div>
              <a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                {tAdmin(locale, "admin.marketing.links.gmc", "Open Merchant Center")} <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          )}
        </Card>

        {/* Google Tag Manager */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-sky-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">GTM</span>
                </div>
                <div>
                  <CardTitle>Google Tag Manager</CardTitle>
                  <CardDescription>{tAdmin(locale, "admin.marketing.gtm.description", "Manage all your tags in one place")}</CardDescription>
                </div>
              </div>
              <Switch checked={ms.googleTagManager.enabled} onCheckedChange={(checked) => updateMarketingSettings({ googleTagManager: { ...ms.googleTagManager, enabled: checked } })} />
            </div>
          </CardHeader>
          {ms.googleTagManager.enabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gtmId">Container ID</Label>
                <Input id="gtmId" value={ms.googleTagManager.id || ""} onChange={(e) => updateMarketingSettings({ googleTagManager: { ...ms.googleTagManager, id: e.target.value || null } })} placeholder="GTM-XXXXXXX" />
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  {tAdmin(locale, "admin.marketing.gtm.warning", "If you use GTM, configure other pixels there instead of setting IDs here.")}
                </p>
              </div>
              <a href="https://tagmanager.google.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                {tAdmin(locale, "admin.marketing.links.gtm", "Open Tag Manager")} <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          )}
        </Card>

        {/* TikTok Pixel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center">
                  <span className="text-white font-bold text-sm">TT</span>
                </div>
                <div>
                  <CardTitle>TikTok Pixel</CardTitle>
                  <CardDescription>{tAdmin(locale, "admin.marketing.tiktok.description", "Track conversions from TikTok Ads campaigns")}</CardDescription>
                </div>
              </div>
              <Switch checked={ms.tiktokPixel.enabled} onCheckedChange={(checked) => updateMarketingSettings({ tiktokPixel: { ...ms.tiktokPixel, enabled: checked } })} />
            </div>
          </CardHeader>
          {ms.tiktokPixel.enabled && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tiktokPixelId">Pixel ID</Label>
                  <Input id="tiktokPixelId" value={ms.tiktokPixel.id || ""} onChange={(e) => updateMarketingSettings({ tiktokPixel: { ...ms.tiktokPixel, id: e.target.value || null } })} placeholder="CXXXXXXXXXXXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktokAccessToken">Access Token (Events API)</Label>
                  <Input id="tiktokAccessToken" type="password" value={ms.tiktokPixel.accessToken || ""} onChange={(e) => updateMarketingSettings({ tiktokPixel: { ...ms.tiktokPixel, accessToken: e.target.value || null } })} placeholder={tAdmin(locale, "admin.marketing.tiktok.tokenPlaceholder", "Access token...")} />
                </div>
              </div>
              <a href="https://ads.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                {tAdmin(locale, "admin.marketing.links.tiktok", "Open TikTok Ads")} <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          )}
        </Card>

        {/* Pinterest Tag */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <div>
                  <CardTitle>Pinterest Tag</CardTitle>
                  <CardDescription>Rastreie conversoes de campanhas do Pinterest</CardDescription>
                </div>
              </div>
              <Switch checked={ms.pinterestTag.enabled} onCheckedChange={(checked) => updateMarketingSettings({ pinterestTag: { ...ms.pinterestTag, enabled: checked } })} />
            </div>
          </CardHeader>
          {ms.pinterestTag.enabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pinterestTagId">Tag ID</Label>
                <Input id="pinterestTagId" value={ms.pinterestTag.id || ""} onChange={(e) => updateMarketingSettings({ pinterestTag: { ...ms.pinterestTag, id: e.target.value || null } })} placeholder="2612345678901" />
              </div>
              <a href="https://ads.pinterest.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                Acessar Pinterest Ads <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          )}
        </Card>

        {/* Snapchat Pixel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-400 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <CardTitle>Snapchat Pixel</CardTitle>
                  <CardDescription>Rastreie conversoes de campanhas do Snapchat</CardDescription>
                </div>
              </div>
              <Switch checked={ms.snapchatPixel.enabled} onCheckedChange={(checked) => updateMarketingSettings({ snapchatPixel: { ...ms.snapchatPixel, enabled: checked } })} />
            </div>
          </CardHeader>
          {ms.snapchatPixel.enabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="snapchatPixelId">Pixel ID</Label>
                <Input id="snapchatPixelId" value={ms.snapchatPixel.id || ""} onChange={(e) => updateMarketingSettings({ snapchatPixel: { ...ms.snapchatPixel, id: e.target.value || null } })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <a href="https://ads.snapchat.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                Acessar Snapchat Ads <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          )}
        </Card>

        {/* Analytics Tools */}
        <Card id="analytics-tools">
          <CardHeader>
            <CardTitle>Ferramentas de Analise</CardTitle>
            <CardDescription>Entenda como os usuarios interagem com seu site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-orange-500 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">HJ</span>
                </div>
                <div>
                  <Label>Hotjar</Label>
                  <p className="text-sm text-muted-foreground">Mapas de calor e gravacoes de sessao</p>
                </div>
              </div>
              <Switch checked={ms.hotjar.enabled} onCheckedChange={(checked) => updateMarketingSettings({ hotjar: { ...ms.hotjar, enabled: checked } })} />
            </div>
            {ms.hotjar.enabled && (
              <div className="ml-11 space-y-2">
                <Label htmlFor="hotjarId">Site ID</Label>
                <Input id="hotjarId" value={ms.hotjar.id || ""} onChange={(e) => updateMarketingSettings({ hotjar: { ...ms.hotjar, id: e.target.value || null } })} placeholder="1234567" />
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">MC</span>
                </div>
                <div>
                  <Label>Microsoft Clarity</Label>
                  <p className="text-sm text-muted-foreground">Analise comportamental gratuita da Microsoft</p>
                </div>
              </div>
              <Switch checked={ms.microsoftClarity.enabled} onCheckedChange={(checked) => updateMarketingSettings({ microsoftClarity: { ...ms.microsoftClarity, enabled: checked } })} />
            </div>
            {ms.microsoftClarity.enabled && (
              <div className="ml-11 space-y-2">
                <Label htmlFor="clarityId">Project ID</Label>
                <Input id="clarityId" value={ms.microsoftClarity.id || ""} onChange={(e) => updateMarketingSettings({ microsoftClarity: { ...ms.microsoftClarity, id: e.target.value || null } })} placeholder="abcdefghij" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
