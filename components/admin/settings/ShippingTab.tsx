"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Save,
  Box,
  Weight,
  Truck,
  MapPin,
  Package,
  Navigation,
  Timer,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { SiteSettings, ShippingSettings, DefaultPackageConfig, CorreiosConfig, RegionalOfferType, RegionalShippingOffer, CustomShippingMethod, CorreiosService } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

export function getDefaultShippingSettings(): ShippingSettings {
  return {
    defaultPackage: {
      weight: 0.3,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 5,
      largeItemThresholdGrams: 1000,
      largeItemWeight: 1.5,
      largeItemLengthCm: 40,
      largeItemWidthCm: 30,
      largeItemHeightCm: 20,
    },
    defaultOriginCep: "",
    defaultPackageWeight: 0.3,
    showEstimatedDelivery: true,
    freeShippingEnabled: false,
    freeShippingMinValue: 0,
    freeShippingRegions: ["ALL"],
    regionalOffers: [],
    correios: {
      enabled: false,
      contractCode: null,
      contractPassword: null,
      originCep: "",
      enabledServices: ["SEDEX", "PAC"],
      markupPercent: 0,
      markupFixed: 0,
      additionalDays: 0,
      declareValue: true,
    },
    customMethods: [],
  };
}

interface ShippingTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function ShippingTab({ locale = "en", settings, setSettings, isSaving, onSave }: ShippingTabProps) {
  function updateShippingSettings(updates: Partial<ShippingSettings>) {
    setSettings({
      ...settings,
      shippingSettings: {
        ...(settings.shippingSettings || getDefaultShippingSettings()),
        ...updates,
      },
    });
  }

  function updateDefaultPackage(updates: Partial<DefaultPackageConfig>) {
    const current = settings.shippingSettings || getDefaultShippingSettings();
    updateShippingSettings({ defaultPackage: { ...current.defaultPackage, ...updates } });
  }

  function updateCorreiosConfig(updates: Partial<CorreiosConfig>) {
    const current = settings.shippingSettings || getDefaultShippingSettings();
    updateShippingSettings({ correios: { ...current.correios, ...updates } });
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving} className="h-12 lg:h-10 text-base lg:text-sm w-full lg:w-auto">
          <Save className="mr-2 h-5 w-5 lg:h-4 lg:w-4" />
          {isSaving ? tAdmin(locale, "admin.common.saving", "Saving...") : tAdmin(locale, "admin.shipping.save", "Save Shipping Settings")}
        </Button>
      </div>

      <div className="grid gap-4 lg:gap-6">
        {/* Default Package */}
        <Card id="default-packaging">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              {tAdmin(locale, "admin.shipping.packaging.title", "Default Packaging")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.shipping.packaging.description", "Dimensions and weight used for shipping calculation via Correios API and carriers")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">
                {tAdmin(locale, "admin.shipping.packaging.defaultBox", "Default Package")}
                {` (<= ${settings.shippingSettings?.defaultPackage?.largeItemThresholdGrams ?? 1000}g)`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{tAdmin(locale, "admin.shipping.weightKg", "Weight (kg)")}</Label>
                  <Input type="number" step="0.001" min="0" value={settings.shippingSettings?.defaultPackage?.weight ?? 0.3} onChange={(e) => updateDefaultPackage({ weight: Number(e.target.value) || 0 })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tAdmin(locale, "admin.shipping.lengthCm", "Length (cm)")}</Label>
                  <Input type="number" step="0.1" min="0" value={settings.shippingSettings?.defaultPackage?.lengthCm ?? 20} onChange={(e) => updateDefaultPackage({ lengthCm: Number(e.target.value) || 0 })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tAdmin(locale, "admin.shipping.widthCm", "Width (cm)")}</Label>
                  <Input type="number" step="0.1" min="0" value={settings.shippingSettings?.defaultPackage?.widthCm ?? 15} onChange={(e) => updateDefaultPackage({ widthCm: Number(e.target.value) || 0 })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tAdmin(locale, "admin.shipping.heightCm", "Height (cm)")}</Label>
                  <Input type="number" step="0.1" min="0" value={settings.shippingSettings?.defaultPackage?.heightCm ?? 5} onChange={(e) => updateDefaultPackage({ heightCm: Number(e.target.value) || 0 })} className="h-9" />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">{tAdmin(locale, "admin.shipping.packaging.heavyTitle", "Packaging for Heavy Items")}</p>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">{tAdmin(locale, "admin.shipping.above", "Above")}</Label>
                  <Input type="number" min="1" value={settings.shippingSettings?.defaultPackage?.largeItemThresholdGrams ?? 1000} onChange={(e) => updateDefaultPackage({ largeItemThresholdGrams: Number(e.target.value) || 1000 })} className="h-7 w-24 text-xs" />
                  <Label className="text-xs text-muted-foreground">{tAdmin(locale, "admin.shipping.grams", "grams")}</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{tAdmin(locale, "admin.shipping.weightKg", "Weight (kg)")}</Label>
                  <Input type="number" step="0.001" min="0" value={settings.shippingSettings?.defaultPackage?.largeItemWeight ?? 1.5} onChange={(e) => updateDefaultPackage({ largeItemWeight: Number(e.target.value) || 0 })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tAdmin(locale, "admin.shipping.lengthCm", "Length (cm)")}</Label>
                  <Input type="number" step="0.1" min="0" value={settings.shippingSettings?.defaultPackage?.largeItemLengthCm ?? 40} onChange={(e) => updateDefaultPackage({ largeItemLengthCm: Number(e.target.value) || 0 })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tAdmin(locale, "admin.shipping.widthCm", "Width (cm)")}</Label>
                  <Input type="number" step="0.1" min="0" value={settings.shippingSettings?.defaultPackage?.largeItemWidthCm ?? 30} onChange={(e) => updateDefaultPackage({ largeItemWidthCm: Number(e.target.value) || 0 })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{tAdmin(locale, "admin.shipping.heightCm", "Height (cm)")}</Label>
                  <Input type="number" step="0.1" min="0" value={settings.shippingSettings?.defaultPackage?.largeItemHeightCm ?? 20} onChange={(e) => updateDefaultPackage({ largeItemHeightCm: Number(e.target.value) || 0 })} className="h-9" />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 border p-3 flex items-start gap-3">
              <Weight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{tAdmin(locale, "admin.shipping.packaging.note", "These dimensions are sent to carrier APIs when products don't have specific package dimensions configured.")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Global Shipping Settings */}
        <Card id="shipping-general">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {tAdmin(locale, "admin.shipping.general.title", "General Shipping Settings")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.shipping.general.description", "Configure origin ZIP code, free shipping, and global options")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.shipping.general.originZip", "Origin ZIP Code")}</Label>
                <Input value={settings.shippingSettings?.defaultOriginCep || ""} onChange={(e) => updateShippingSettings({ defaultOriginCep: e.target.value })} placeholder="00000-000" maxLength={9} />
                <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.shipping.general.originZip.help", "ZIP code of your warehouse or dispatch location")}</p>
              </div>
              <div className="space-y-2">
                <Label>{tAdmin(locale, "admin.shipping.general.defaultWeight", "Default Product Weight (kg)")}</Label>
                <Input type="number" step="0.01" min="0" value={settings.shippingSettings?.defaultPackageWeight || 0.3} onChange={(e) => updateShippingSettings({ defaultPackageWeight: Number(e.target.value) || 0.3 })} />
                <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.shipping.general.defaultWeight.help", "Used when product weight is not defined")}</p>
              </div>
              <div className="space-y-2 flex items-end">
                <div className="flex items-center gap-3 p-3 border rounded-lg w-full">
                  <Switch checked={settings.shippingSettings?.showEstimatedDelivery ?? true} onCheckedChange={(checked) => updateShippingSettings({ showEstimatedDelivery: checked })} />
                  <div>
                    <Label className="cursor-pointer">{tAdmin(locale, "admin.shipping.general.estimatedDelivery", "Show Estimated Delivery")}</Label>
                    <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.shipping.general.estimatedDelivery.help", "Displays delivery time estimate in checkout")}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={settings.shippingSettings?.freeShippingEnabled ?? false} onCheckedChange={(checked) => updateShippingSettings({ freeShippingEnabled: checked })} />
                <div>
                  <Label className="cursor-pointer font-medium">{tAdmin(locale, "admin.shipping.general.freeShipping", "Global Free Shipping")}</Label>
                  <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.shipping.general.freeShipping.help", "Offer free shipping above a minimum order value")}</p>
                </div>
              </div>

              {settings.shippingSettings?.freeShippingEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
                  <div className="space-y-2">
                    <Label>{tAdmin(locale, "admin.shipping.general.freeShippingMin", "Minimum Value for Free Shipping (R$)")}</Label>
                    <Input type="number" step="0.01" min="0" value={settings.shippingSettings?.freeShippingMinValue || 0} onChange={(e) => updateShippingSettings({ freeShippingMinValue: Number(e.target.value) || 0 })} placeholder="500" />
                  </div>
                  <div className="space-y-2">
                    <Label>{tAdmin(locale, "admin.shipping.general.freeShippingRegions", "Free Shipping Regions")}</Label>
                    <Select value={settings.shippingSettings?.freeShippingRegions?.[0] === "ALL" ? "ALL" : "SELECTED"} onValueChange={(v) => updateShippingSettings({ freeShippingRegions: v === "ALL" ? ["ALL"] : ["SP", "RJ", "MG"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">{tAdmin(locale, "admin.shipping.general.freeShippingRegions.all", "All Brazil")}</SelectItem>
                        <SelectItem value="SELECTED">{tAdmin(locale, "admin.shipping.general.freeShippingRegions.selected", "Selected States")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {settings.shippingSettings?.freeShippingRegions?.[0] !== "ALL" && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(settings.shippingSettings?.freeShippingRegions || []).map((state) => (
                          <Badge key={state} variant="secondary" className="text-xs">
                            {state}
                            <button type="button" className="ml-1 hover:text-destructive" onClick={() => updateShippingSettings({ freeShippingRegions: (settings.shippingSettings?.freeShippingRegions || []).filter((s) => s !== state) })}>x</button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Regional Shipping Offers */}
        <Card id="shipping-regions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {tAdmin(locale, "admin.shipping.regions.title", "Regional Shipping Offers")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.shipping.regions.description", "Create custom shipping rules by state, city, or ZIP range")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(settings.shippingSettings?.regionalOffers ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <MapPin className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{tAdmin(locale, "admin.shipping.regions.empty", "No regional offer configured")}</p>
                <p className="text-xs">{tAdmin(locale, "admin.shipping.regions.emptyHint", "Click Add Offer to create shipping rules by region")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(settings.shippingSettings?.regionalOffers ?? [])
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((offer, idx, arr) => {
                    const offerColors: Record<RegionalOfferType, string> = {
                      FREE: "bg-green-100 text-green-700 border-green-200",
                      FIXED: "bg-blue-100 text-blue-700 border-blue-200",
                      DISCOUNT_PERCENT: "bg-orange-100 text-orange-700 border-orange-200",
                    };
                    const offerLabels: Record<RegionalOfferType, string> = {
                      FREE: tAdmin(locale, "admin.shipping.offer.free", "Free"),
                      FIXED: tAdmin(locale, "admin.shipping.offer.fixed", "Fixed Price"),
                      DISCOUNT_PERCENT: tAdmin(locale, "admin.shipping.offer.discountPercent", "% Discount"),
                    };
                    return (
                      <div key={offer.id} className={`border rounded-lg overflow-hidden ${offer.isActive ? "bg-card" : "bg-muted/40 opacity-70"}`}>
                        <div className="flex items-center gap-3 p-3">
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0}
                              onClick={() => {
                                const sorted = [...(settings.shippingSettings?.regionalOffers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
                                const cur = sorted[idx]; const prev = sorted[idx - 1];
                                updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === cur.id ? { ...o, sortOrder: prev.sortOrder } : o.id === prev.id ? { ...o, sortOrder: cur.sortOrder } : o) });
                              }}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === arr.length - 1}
                              onClick={() => {
                                const sorted = [...(settings.shippingSettings?.regionalOffers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
                                const cur = sorted[idx]; const next = sorted[idx + 1];
                                updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === cur.id ? { ...o, sortOrder: next.sortOrder } : o.id === next.id ? { ...o, sortOrder: cur.sortOrder } : o) });
                              }}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{offer.name || <span className="text-muted-foreground italic">{tAdmin(locale, "admin.common.unnamed", "Unnamed")}</span>}</p>
                              <Badge className={`text-xs border ${offerColors[offer.offerType]}`}>
                                {offerLabels[offer.offerType]}
                                {offer.offerType === "FIXED" && ` R$ ${offer.fixedPrice.toFixed(2)}`}
                                {offer.offerType === "DISCOUNT_PERCENT" && ` ${offer.discountPercent}%`}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {`${offer.deliveryDays ?? 1} ${tAdmin(locale, "admin.shipping.businessDays", "business day(s)")}`}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {offer.scopeType === "STATE" && offer.states.length > 0 ? offer.states.join(", ") : offer.scopeType === "CITY" && offer.cities.length > 0 ? `${offer.cities.length} ${tAdmin(locale, "admin.shipping.cities", "city(ies)")}` : offer.scopeType === "CEP_RANGE" && offer.cepStart ? `CEP ${offer.cepStart} - ${offer.cepEnd}` : tAdmin(locale, "admin.shipping.noRegion", "No region")}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Switch checked={offer.isActive} onCheckedChange={(checked) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, isActive: checked } : o) })} />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).filter((o) => o.id !== offer.id) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="border-t bg-muted/20 p-3 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Nome da Oferta *</Label>
                              <Input value={offer.name} onChange={(e) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, name: e.target.value } : o) })} placeholder={tAdmin(locale, "admin.shipping.offer.namePlaceholder", "Ex: Sao Paulo Capital Shipping")} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Tipo de Oferta</Label>
                              <Select value={offer.offerType} onValueChange={(v: RegionalOfferType) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, offerType: v } : o) })}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="FREE">Frete Gratis</SelectItem>
                                  <SelectItem value="FIXED">{tAdmin(locale, "admin.shipping.offer.fixed", "Fixed Price")}</SelectItem>
                                  <SelectItem value="DISCOUNT_PERCENT">{tAdmin(locale, "admin.shipping.offer.discountPercentLong", "Percent Discount (%)")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {offer.offerType === "FIXED" && (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Valor do Frete (R$)</Label>
                                <Input type="number" step="0.01" min="0" value={offer.fixedPrice} onChange={(e) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, fixedPrice: Number(e.target.value) || 0 } : o) })} className="h-8 text-sm" />
                              </div>
                            )}
                            {offer.offerType === "DISCOUNT_PERCENT" && (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Desconto (%)</Label>
                                <Input type="number" step="1" min="0" max="100" value={offer.discountPercent} onChange={(e) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, discountPercent: Math.min(100, Number(e.target.value) || 0) } : o) })} className="h-8 text-sm" />
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <Label className="text-xs">Pedido Minimo (R$)</Label>
                                <Input type="number" step="0.01" min="0" value={offer.minOrderValue ?? ""} onChange={(e) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, minOrderValue: e.target.value ? Number(e.target.value) : null } : o) })} placeholder={tAdmin(locale, "admin.common.noneMin", "No minimum")} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Prazo (dias úteis)</Label>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                value={offer.deliveryDays ?? 1}
                                onChange={(e) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, deliveryDays: Math.max(0, Number(e.target.value) || 1) } : o) })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Tipo de Regiao</Label>
                              <Select value={offer.scopeType} onValueChange={(v: "STATE" | "CITY" | "CEP_RANGE") => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, scopeType: v, states: [], cities: [], cepStart: null, cepEnd: null } : o) })}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="STATE">Por Estado (UF)</SelectItem>
                                  <SelectItem value="CITY">Por Cidade</SelectItem>
                                  <SelectItem value="CEP_RANGE">Por Faixa de CEP</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {offer.scopeType === "STATE" && (
                              <div className="space-y-2">
                                <Label className="text-xs">Estados</Label>
                                <div className="flex flex-wrap gap-1.5">
                                  {(["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"] as const).map((uf) => {
                                    const selected = offer.states.includes(uf);
                                    return (
                                      <button key={uf} type="button" onClick={() => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, states: selected ? o.states.filter((s) => s !== uf) : [...o.states, uf].sort() } : o) })} className={`h-7 px-2 rounded text-xs font-medium border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}>
                                        {uf}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {offer.scopeType === "CITY" && (
                              <div className="space-y-2">
                                <Label className="text-xs">Cidades (uma por linha)</Label>
                                <Textarea value={offer.cities.join("\n")} onChange={(e) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, cities: e.target.value.split("\n").map((c) => c.trim()).filter(Boolean) } : o) })} placeholder={"Sao Paulo\nCampinas\nSantos"} rows={4} className="text-sm resize-none font-mono" />
                                <p className="text-xs text-muted-foreground">{offer.cities.length} cidade(s) cadastrada(s)</p>
                              </div>
                            )}

                            {offer.scopeType === "CEP_RANGE" && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-xs">CEP Inicial</Label>
                                  <Input value={offer.cepStart ?? ""} onChange={(e) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, cepStart: e.target.value || null } : o) })} placeholder="01000-000" maxLength={9} className="h-8 text-sm font-mono" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs">CEP Final</Label>
                                  <Input value={offer.cepEnd ?? ""} onChange={(e) => updateShippingSettings({ regionalOffers: (settings.shippingSettings?.regionalOffers ?? []).map((o) => o.id === offer.id ? { ...o, cepEnd: e.target.value || null } : o) })} placeholder="05999-999" maxLength={9} className="h-8 text-sm font-mono" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <Button variant="outline" className="w-full"
              onClick={() => {
                const maxOrder = Math.max(0, ...(settings.shippingSettings?.regionalOffers ?? []).map((o) => o.sortOrder));
                const newOffer: RegionalShippingOffer = { id: `offer_${Date.now()}`, name: "", isActive: true, deliveryDays: 1, offerType: "FREE", fixedPrice: 0, discountPercent: 0, minOrderValue: null, scopeType: "STATE", states: [], cities: [], cepStart: null, cepEnd: null, applyToMethodIds: null, sortOrder: maxOrder + 1 };
                updateShippingSettings({ regionalOffers: [...(settings.shippingSettings?.regionalOffers ?? []), newOffer] });
              }}>
              <Plus className="mr-2 h-4 w-4" />
              {tAdmin(locale, "admin.shipping.regions.addOffer", "Add Regional Offer")}
            </Button>
          </CardContent>
        </Card>

        {/* Correios Integration */}
        <Card id="correios-integration">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-yellow-600" />
              {tAdmin(locale, "admin.shipping.correios.title", "Correios Integration")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.shipping.correios.description", "Configure Correios API for automatic shipping calculation")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${settings.shippingSettings?.correios?.enabled ? "bg-green-100" : "bg-muted"}`}>
                  <Package className={`h-5 w-5 ${settings.shippingSettings?.correios?.enabled ? "text-green-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="font-medium">{tAdmin(locale, "admin.shipping.correios.api", "Correios API")}</p>
                  <p className="text-sm text-muted-foreground">{settings.shippingSettings?.correios?.enabled ? tAdmin(locale, "admin.shipping.correios.active", "Integration enabled") : tAdmin(locale, "admin.shipping.correios.inactive", "Integration disabled")}</p>
                </div>
              </div>
              <Switch checked={settings.shippingSettings?.correios?.enabled ?? false} onCheckedChange={(checked) => updateCorreiosConfig({ enabled: checked })} />
            </div>

            {settings.shippingSettings?.correios?.enabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Codigo do Contrato (opcional)</Label>
                    <Input value={settings.shippingSettings?.correios?.contractCode || ""} onChange={(e) => updateCorreiosConfig({ contractCode: e.target.value || null })} placeholder="Codigo administrativo" />
                    <p className="text-xs text-muted-foreground">Deixe vazio para usar tabela publica</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Senha do Contrato</Label>
                    <Input type="password" value={settings.shippingSettings?.correios?.contractPassword || ""} onChange={(e) => updateCorreiosConfig({ contractPassword: e.target.value || null })} placeholder="Senha do contrato" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>CEP de Origem (Remetente)</Label>
                  <Input value={settings.shippingSettings?.correios?.originCep || ""} onChange={(e) => updateCorreiosConfig({ originCep: e.target.value })} placeholder="00000-000" maxLength={9} />
                </div>

                <div className="space-y-3">
                  <Label>Servicos Habilitados</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(["SEDEX", "SEDEX_10", "SEDEX_12", "SEDEX_HOJE", "PAC", "PAC_MINI"] as CorreiosService[]).map((service) => (
                      <div key={service} className="flex items-center gap-2 p-2 border rounded-lg">
                        <Switch
                          checked={(settings.shippingSettings?.correios?.enabledServices || []).includes(service)}
                          onCheckedChange={(checked) => {
                            const current = settings.shippingSettings?.correios?.enabledServices || [];
                            updateCorreiosConfig({ enabledServices: checked ? [...current, service] : current.filter((s) => s !== service) });
                          }}
                        />
                        <Label className="text-sm cursor-pointer">{service.replace("_", " ")}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Margem sobre Frete (%)</Label>
                    <Input type="number" step="0.1" min="0" value={settings.shippingSettings?.correios?.markupPercent || 0} onChange={(e) => updateCorreiosConfig({ markupPercent: Number(e.target.value) || 0 })} placeholder="0" />
                    <p className="text-xs text-muted-foreground">Adicional % sobre o frete</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Fixo Adicional (R$)</Label>
                    <Input type="number" step="0.01" min="0" value={settings.shippingSettings?.correios?.markupFixed || 0} onChange={(e) => updateCorreiosConfig({ markupFixed: Number(e.target.value) || 0 })} placeholder="0" />
                    <p className="text-xs text-muted-foreground">Custo de manuseio</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Dias Adicionais ao Prazo</Label>
                    <Input type="number" min="0" value={settings.shippingSettings?.correios?.additionalDays || 0} onChange={(e) => updateCorreiosConfig({ additionalDays: Number(e.target.value) || 0 })} placeholder="1" />
                    <p className="text-xs text-muted-foreground">Tempo de preparo</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Switch checked={settings.shippingSettings?.correios?.declareValue ?? true} onCheckedChange={(checked) => updateCorreiosConfig({ declareValue: checked })} />
                  <div>
                    <Label className="cursor-pointer">Declarar Valor</Label>
                    <p className="text-xs text-muted-foreground">Inclui seguro baseado no valor do pedido</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Custom Shipping Methods */}
        <Card id="custom-shipping">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              {tAdmin(locale, "admin.shipping.custom.title", "Custom Shipping Methods")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.shipping.custom.description", "Create your own delivery methods like local courier, pickup, carrier, etc.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(settings.shippingSettings?.customMethods ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Truck className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{tAdmin(locale, "admin.shipping.custom.empty", "No custom method configured")}</p>
                <p className="text-xs">{tAdmin(locale, "admin.shipping.custom.emptyHint", "Click Add Method to create one")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(settings.shippingSettings?.customMethods ?? [])
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((method, idx, arr) => (
                    <div key={method.id} className={`border rounded-lg overflow-hidden transition-colors ${method.isActive ? "bg-card" : "bg-muted/40 opacity-70"}`}>
                      <div className="flex items-center gap-3 p-3">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0}
                            onClick={() => {
                              const methods = [...(settings.shippingSettings?.customMethods ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
                              const cur = methods[idx]; const prev = methods[idx - 1];
                              updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === cur.id ? { ...m, sortOrder: prev.sortOrder } : m.id === prev.id ? { ...m, sortOrder: cur.sortOrder } : m) });
                            }}>
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === arr.length - 1}
                            onClick={() => {
                              const methods = [...(settings.shippingSettings?.customMethods ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
                              const cur = methods[idx]; const next = methods[idx + 1];
                              updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === cur.id ? { ...m, sortOrder: next.sortOrder } : m.id === next.id ? { ...m, sortOrder: cur.sortOrder } : m) });
                            }}>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{method.name || <span className="text-muted-foreground italic">Sem nome</span>}</p>
                            <Badge variant="outline" className="text-xs">
                              {method.pricingType === "FREE" ? tAdmin(locale, "admin.shipping.offer.free", "Free") : method.pricingType === "FIXED" ? `R$ ${method.fixedPrice?.toFixed(2)}` : method.pricingType}
                            </Badge>
                          </div>
                          {method.description && <p className="text-xs text-muted-foreground truncate">{method.description}</p>}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Timer className="h-3 w-3" />
                            <span>{method.minDays === method.maxDays ? `${method.minDays} dia(s)` : `${method.minDays}-${method.maxDays} dias`}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Switch checked={method.isActive} onCheckedChange={(checked) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, isActive: checked } : m) })} />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).filter((m) => m.id !== method.id) })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="border-t bg-muted/20 p-3 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nome do Metodo *</Label>
                            <Input value={method.name} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, name: e.target.value } : m) })} placeholder="Ex: Motoboy, Retirada" className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Tipo de Preco</Label>
                            <Select value={method.pricingType} onValueChange={(v: "FIXED" | "BY_WEIGHT" | "BY_VALUE" | "BY_REGION" | "FREE") => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, pricingType: v } : m) })}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="FREE">Gratis</SelectItem>
                                <SelectItem value="FIXED">Valor Fixo</SelectItem>
                                <SelectItem value="BY_WEIGHT">Por Peso</SelectItem>
                                <SelectItem value="BY_VALUE">Por Valor do Pedido</SelectItem>
                                <SelectItem value="BY_REGION">Por Regiao</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {method.pricingType === "FIXED" && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Valor do Frete (R$)</Label>
                              <Input type="number" step="0.01" min="0" value={method.fixedPrice || 0} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, fixedPrice: Number(e.target.value) || 0 } : m) })} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Gratis Acima de (R$)</Label>
                              <Input type="number" step="0.01" min="0" value={method.freeAboveValue || ""} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, freeAboveValue: e.target.value ? Number(e.target.value) : null } : m) })} placeholder="Opcional" className="h-8 text-sm" />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className="text-xs">Descricao / Instrucoes</Label>
                          <Textarea value={method.description || ""} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, description: e.target.value || null } : m) })} placeholder="Detalhes sobre este metodo de envio..." rows={2} className="text-sm resize-none" />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Prazo Min (dias)</Label>
                            <Input type="number" min="0" value={method.minDays} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, minDays: Number(e.target.value) || 0 } : m) })} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Prazo Max (dias)</Label>
                            <Input type="number" min="0" value={method.maxDays} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, maxDays: Number(e.target.value) || 0 } : m) })} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Valor Min Pedido</Label>
                            <Input type="number" step="0.01" min="0" value={method.minOrderValue || ""} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, minOrderValue: e.target.value ? Number(e.target.value) : null } : m) })} placeholder={tAdmin(locale, "admin.common.noneMin", "No minimum")} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Peso Max (kg)</Label>
                            <Input type="number" step="0.1" min="0" value={method.maxWeight || ""} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, maxWeight: e.target.value ? Number(e.target.value) : null } : m) })} placeholder={tAdmin(locale, "admin.common.noLimit", "No limit")} className="h-8 text-sm" />
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={method.isPickup ?? false}
                              onCheckedChange={(checked) =>
                                updateShippingSettings({
                                  customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) =>
                                    m.id === method.id
                                      ? {
                                          ...m,
                                          isPickup: checked,
                                          pickupSchedule: checked
                                            ? (m.pickupSchedule ?? { enabled: true, prepMinHours: 4, slotDurationMinutes: 60, maxDaysAhead: 14, availableDays: [1, 2, 3, 4, 5], openTime: "09:00", closeTime: "18:00", lunchBreakStart: null, lunchBreakEnd: null, maxSimultaneous: null })
                                            : null,
                                        }
                                      : m
                                  ),
                                })
                              }
                            />
                            <div>
                              <Label className="cursor-pointer font-medium text-sm">Retirada no Local</Label>
                              <p className="text-xs text-muted-foreground">Permite ao cliente agendar uma data e horario para retirar o pedido</p>
                            </div>
                          </div>

                          {method.isPickup && (
                            <div className="space-y-4 pl-11">
                              <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1.5">
                                  <MapPin className="h-3 w-3" />
                                  Endereco de Retirada
                                </Label>
                                <Input value={method.pickupAddress || ""} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id ? { ...m, pickupAddress: e.target.value || null } : m) })} placeholder="Rua, numero, bairro, cidade, CEP" className="text-sm" />
                              </div>

                              <div className="rounded-lg border bg-card p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Timer className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Agendamento de Retirada</span>
                                  </div>
                                  <Switch
                                    checked={method.pickupSchedule?.enabled ?? false}
                                    onCheckedChange={(checked) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, enabled: checked } } : m) })}
                                  />
                                </div>

                                {method.pickupSchedule?.enabled && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Preparo Minimo (horas)</Label>
                                        <Input type="number" min="0" value={method.pickupSchedule?.prepMinHours ?? 4} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, prepMinHours: Number(e.target.value) || 0 } } : m) })} className="h-8 text-sm" />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Duracao do Slot (min)</Label>
                                        <Select value={String(method.pickupSchedule?.slotDurationMinutes ?? 60)} onValueChange={(v) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, slotDurationMinutes: Number(v) } } : m) })}>
                                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="15">15 minutos</SelectItem>
                                            <SelectItem value="30">30 minutos</SelectItem>
                                            <SelectItem value="60">1 hora</SelectItem>
                                            <SelectItem value="120">2 horas</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Maximo de dias a frente</Label>
                                        <Input type="number" min="1" value={method.pickupSchedule?.maxDaysAhead ?? 14} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, maxDaysAhead: Number(e.target.value) || 14 } } : m) })} className="h-8 text-sm" />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Abertura</Label>
                                        <Input type="time" value={method.pickupSchedule?.openTime ?? "09:00"} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, openTime: e.target.value } } : m) })} className="h-8 text-sm" />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Fechamento</Label>
                                        <Input type="time" value={method.pickupSchedule?.closeTime ?? "18:00"} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, closeTime: e.target.value } } : m) })} className="h-8 text-sm" />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Inicio do Almoco</Label>
                                        <Input type="time" value={method.pickupSchedule?.lunchBreakStart ?? ""} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, lunchBreakStart: e.target.value || null } } : m) })} placeholder={tAdmin(locale, "admin.common.noBreak", "No break")} className="h-8 text-sm" />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Fim do Almoco</Label>
                                        <Input type="time" value={method.pickupSchedule?.lunchBreakEnd ?? ""} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, lunchBreakEnd: e.target.value || null } } : m) })} placeholder={tAdmin(locale, "admin.common.noBreak", "No break")} className="h-8 text-sm" />
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs">Dias de Atendimento</Label>
                                      <div className="flex flex-wrap gap-2">
                                        {[{ value: 0, label: "Dom" }, { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" }, { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sab" }].map((day) => {
                                          const isSelected = (method.pickupSchedule?.availableDays ?? []).includes(day.value);
                                          return (
                                            <button key={day.value} type="button"
                                              onClick={() => {
                                                const current = method.pickupSchedule?.availableDays ?? [];
                                                const next = isSelected ? current.filter((d) => d !== day.value) : [...current, day.value].sort();
                                                updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, availableDays: next } } : m) });
                                              }}
                                              className={`h-8 w-10 rounded-md text-xs font-medium border transition-colors ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"}`}
                                            >
                                              {day.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs">Limite de Pedidos por Slot</Label>
                                      <Input type="number" min="1" value={method.pickupSchedule?.maxSimultaneous ?? ""} onChange={(e) => updateShippingSettings({ customMethods: (settings.shippingSettings?.customMethods ?? []).map((m) => m.id === method.id && m.pickupSchedule ? { ...m, pickupSchedule: { ...m.pickupSchedule, maxSimultaneous: e.target.value ? Number(e.target.value) : null } } : m) })} placeholder="Ilimitado" className="h-8 text-sm max-w-40" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <Button variant="outline" className="w-full"
              onClick={() => {
                const maxOrder = Math.max(0, ...(settings.shippingSettings?.customMethods ?? []).map((m) => m.sortOrder));
                const newMethod: CustomShippingMethod = { id: `ship_${Date.now()}`, name: "", description: null, isActive: true, sortOrder: maxOrder + 1, isPickup: false, pickupAddress: null, pickupSchedule: null, pricingType: "FIXED", fixedPrice: 0, freeAboveValue: null, minDays: 1, maxDays: 3, minOrderValue: null, maxOrderValue: null, maxWeight: null, regions: [] };
                updateShippingSettings({ customMethods: [...(settings.shippingSettings?.customMethods ?? []), newMethod] });
              }}>
              <Plus className="mr-2 h-4 w-4" />
              {tAdmin(locale, "admin.shipping.custom.add", "Add Shipping Method")}
            </Button>
          </CardContent>
        </Card>

        {/* Shipping Table Summary */}
        <Card id="shipping-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              {tAdmin(locale, "admin.shipping.summary.title", "Shipping Methods Summary")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.shipping.summary.description", "Overview of all available delivery methods")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Metodo</th>
                    <th className="text-left p-3 font-medium">Tipo</th>
                    <th className="text-left p-3 font-medium">Valor</th>
                    <th className="text-left p-3 font-medium">Prazo</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {settings.shippingSettings?.correios?.enabled
                    && (settings.shippingSettings?.correios?.enabledServices || []).map((service) => (
                      <tr key={service} className="hover:bg-muted/30">
                        <td className="p-3"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-yellow-600" />Correios - {service.replace("_", " ")}</div></td>
                        <td className="p-3 text-muted-foreground">API</td>
                        <td className="p-3 text-muted-foreground">Calculado</td>
                        <td className="p-3 text-muted-foreground">Calculado</td>
                        <td className="p-3 text-center"><Badge className="bg-green-100 text-green-700">Ativo</Badge></td>
                      </tr>
                    ))}
                  {(settings.shippingSettings?.customMethods ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map((method) => (
                    <tr key={method.id} className={`hover:bg-muted/30 ${!method.isActive ? "opacity-50" : ""}`}>
                      <td className="p-3"><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-blue-600" />{method.name || tAdmin(locale, "admin.common.unnamed", "Unnamed")}</div></td>
                      <td className="p-3 text-muted-foreground">Personalizado</td>
                      <td className="p-3">
                        {method.pricingType === "FREE" ? <span className="text-green-600 font-medium">Gratis</span> : method.pricingType === "FIXED" ? `R$ ${method.fixedPrice?.toFixed(2)}` : <span className="text-muted-foreground">{method.pricingType}</span>}
                      </td>
                      <td className="p-3">{method.minDays === method.maxDays ? `${method.minDays} dia(s)` : `${method.minDays}-${method.maxDays} dias`}</td>
                      <td className="p-3 text-center">{method.isActive ? <Badge className="bg-green-100 text-green-700">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                    </tr>
                  ))}
                  {!settings.shippingSettings?.correios?.enabled && (settings.shippingSettings?.customMethods ?? []).length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum metodo de envio configurado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
