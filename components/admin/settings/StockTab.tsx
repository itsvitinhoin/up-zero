"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import IntegerInput from "@/components/form/IntegerInput";
import { Save, Package } from "lucide-react";
import type { SiteSettings } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

interface StockTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  isSaving: boolean;
  onSave: () => void;
  canEdit?: boolean;
}

export function StockTab({ locale = "en", settings, setSettings, isSaving, onSave, canEdit = true }: StockTabProps) {
  return (
    <div className="space-y-6">

      <Card id="stock-mode">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {tAdmin(locale, "admin.stock.mode.title", "Stock Mode")}
          </CardTitle>
          <CardDescription>
            {tAdmin(locale, "admin.stock.mode.description", "Choose how stock will be managed in the platform")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.stockMode || "FANTASY"}
            disabled={!canEdit}
            onValueChange={(value: "FANTASY" | "BINARY" | "REAL" | "INFINITO" | "WMS") => {
              if (!canEdit) return;
              setSettings({ ...settings, stockMode: value })
            }}
            className="space-y-3"
          >
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${(settings.stockMode || "FANTASY") === "FANTASY" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              <RadioGroupItem value="FANTASY" className="mt-1" />
              <div className="space-y-1">
                <p className="font-medium">{tAdmin(locale, "admin.stock.mode.fantasy", "Virtual Stock")}</p>
                <p className="text-sm text-muted-foreground">
                  {tAdmin(locale, "admin.stock.mode.fantasy.help", "Defines a max quantity per variant for orders, without real stock tracking.")}
                </p>
                {(settings.stockMode || "FANTASY") === "FANTASY" && (
                  <div className="max-w-55 pt-1">
                    <IntegerInput
                      label={tAdmin(locale, "admin.stock.mode.fantasy.maxPerVariant", "Max Quantity Per Variant")}
                      value={settings.variantMaxQty || 999}
                      min={1}
                      disabled={!canEdit}
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          variantMaxQty: Number.isFinite(value ?? NaN) ? Number(value) : 999,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${(settings.stockMode || "FANTASY") === "BINARY" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              <RadioGroupItem value="BINARY" className="mt-1" />
              <div className="space-y-1">
                <p className="font-medium">{tAdmin(locale, "admin.stock.mode.binary", "Binary Mode (0 or 1)")}</p>
                <p className="text-sm text-muted-foreground">
                  {tAdmin(locale, "admin.stock.mode.binary.help", "Each variant is enabled or disabled, and allows only 1 unit per purchase.")}
                </p>
              </div>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${(settings.stockMode || "FANTASY") === "INFINITO" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              <RadioGroupItem value="INFINITO" className="mt-1" />
              <div className="space-y-1">
                <p className="font-medium">{tAdmin(locale, "admin.stock.mode.infinite", "Infinite Stock")}</p>
                <p className="text-sm text-muted-foreground">
                  {tAdmin(locale, "admin.stock.mode.infinite.help", "Each variant is enabled or disabled, and customers can buy unlimited quantity.")}
                </p>
              </div>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${(settings.stockMode || "FANTASY") === "REAL" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              <RadioGroupItem value="REAL" className="mt-1" />
              <div className="space-y-1">
                <p className="font-medium">{tAdmin(locale, "admin.stock.mode.real", "Real Stock")}</p>
                <p className="text-sm text-muted-foreground">
                  {tAdmin(locale, "admin.stock.mode.real.help", "Uses variant fixed fields (stock_qty/reserved_qty) for catalog, reserve and shipment flow.")}
                </p>
              </div>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${(settings.stockMode || "FANTASY") === "WMS" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              <RadioGroupItem value="WMS" className="mt-1" />
              <div className="space-y-1">
                <p className="font-medium">WMS</p>
                <p className="text-sm text-muted-foreground">
                  Full warehouse flow with locations, inventory positions, allocation, picking, packing and shipping.
                </p>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Button
        onClick={onSave}
        disabled={isSaving || !canEdit}
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
