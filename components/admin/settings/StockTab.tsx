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
}

export function StockTab({ locale = "en", settings, setSettings, isSaving, onSave }: StockTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving
            ? tAdmin(locale, "admin.common.saving", "Saving...")
            : tAdmin(locale, "admin.stock.save", "Save Stock Settings")}
        </Button>
      </div>

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
            onValueChange={(value: "FANTASY" | "BINARY" | "REAL" | "INFINITO") =>
              setSettings({ ...settings, stockMode: value })
            }
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
                  {tAdmin(locale, "admin.stock.mode.real.help", "Traditional stock control with real per-variant quantities reduced on each sale.")}
                </p>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
