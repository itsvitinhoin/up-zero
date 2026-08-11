"use client";

import { Save, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ErpIntegrationProvider, ErpSettings, SiteSettings } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

export function getDefaultErpSettings(): ErpSettings {
  return { provider: "NONE" };
}

const ERP_PROVIDER_OPTIONS: Array<{ value: ErpIntegrationProvider; labelKey: string; fallback: string }> = [
  { value: "NONE", labelKey: "admin.integrations.erp.provider.none", fallback: "Sem Integração" },
  { value: "MANSE", labelKey: "admin.integrations.erp.provider.manse", fallback: "Manse" },
  { value: "MIRE", labelKey: "admin.integrations.erp.provider.mire", fallback: "Mire" },
  { value: "BLING", labelKey: "admin.integrations.erp.provider.bling", fallback: "Bling" },
];

interface ErpTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (settings: SiteSettings) => void;
  isSaving: boolean;
  onSave: () => void;
  canEdit: boolean;
}

export function ErpTab({
  locale = "pt-BR",
  settings,
  setSettings,
  isSaving,
  onSave,
  canEdit,
}: ErpTabProps) {
  const erpSettings = settings.erpSettings || getDefaultErpSettings();

  function updateErpSettings(updates: Partial<ErpSettings>) {
    setSettings({
      ...settings,
      erpSettings: {
        ...erpSettings,
        ...updates,
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{tAdmin(locale, "admin.integrations.erp.title", "ERP")}</h2>
        <p className="text-muted-foreground">
          {tAdmin(locale, "admin.integrations.erp.subtitle", "Selecione o ERP integrado com a loja.")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            {tAdmin(locale, "admin.integrations.erp.cardTitle", "Integração ERP")}
          </CardTitle>
          <CardDescription>
            {tAdmin(
              locale,
              "admin.integrations.erp.cardDescription",
              "Define qual ERP está conectado para sincronização de produtos, pedidos e estoque.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="erpProvider">{tAdmin(locale, "admin.integrations.erp.providerLabel", "ERP integrado")}</Label>
            <Select
              value={erpSettings.provider}
              disabled={!canEdit}
              onValueChange={(value: ErpIntegrationProvider) => updateErpSettings({ provider: value })}
            >
              <SelectTrigger id="erpProvider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ERP_PROVIDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {tAdmin(locale, option.labelKey, option.fallback)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="fixed sm:bottom-6 bottom-20 right-6 z-50 h-12 rounded-full px-4 shadow-lg"
          aria-label={tAdmin(locale, "admin.common.save", "Salvar")}
          title={tAdmin(locale, "admin.common.save", "Salvar")}
        >
          <Save className="mr-2 h-5 w-5" />
          {tAdmin(locale, "admin.common.save", "Salvar")}
        </Button>
      ) : null}
    </div>
  );
}
