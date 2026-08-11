"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import CNPJInput from "@/components/form/CNPJInput";
import IntegerInput from "@/components/form/IntegerInput";
import CurrencyInput from "@/components/form/CurrencyInput";
import AddressInput from "@/components/form/AddressInput";
import CellphoneInput from "@/components/form/CellphoneInput";
import PhoneInput from "@/components/form/PhoneInput";
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
  Settings,
  Users,
  Eye,
  Plus,
  Trash2,
  Check,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Globe,
} from "lucide-react";
import type { SiteSettings, User } from "@/lib/types";
import type { StoreProfileConfig } from "@/lib/actions/settings";
import { tAdmin } from "@/lib/i18n/admin";
import { OfflineSellerPoolAlert } from "@/components/admin/offline-seller-pool-alert";
import { getDefaultSignWholesale } from "@/components/admin/settings/settings-defaults";

function getDefaultStoreSocialLinks() {
  return {
    instagram: { enabled: false, url: '' },
    facebook: { enabled: false, url: '' },
    youtube: { enabled: false, url: '' },
    linkedin: { enabled: false, url: '' },
    tiktok: { enabled: false, url: '' },
  }
}

function getDefaultStoreMeta(): StoreProfileConfig['meta'] {
  return {
    title: '',
    description: '',
    headCode: '',
    maintenanceMode: false,
    socialLinks: getDefaultStoreSocialLinks(),
  }
}

const SOCIAL_LINK_FIELDS: Array<{
  key: keyof StoreProfileConfig['meta']['socialLinks']
  label: string
  placeholder: string
}> = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/sua-loja' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/sua-loja' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@sua-loja' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/sua-loja' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@sua-loja' },
]

const B2B_PANEL_CLASSNAME = "space-y-5 rounded-xl border border-dashed p-5 md:p-6"
const B2B_FIELD_CLASSNAME = "h-10"
const B2B_SELECT_TRIGGER_CLASSNAME = "h-10 w-full"
const B2B_ACTION_BUTTON_CLASSNAME = "h-10"

interface GeneralTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  storeProfile: StoreProfileConfig | null;
  setStoreProfile: (p: StoreProfileConfig | null) => void;
  sellerUsers: User[];
  isSaving: boolean;
  onSave: () => void;
  newWholesaleFieldLabel: string;
  setNewWholesaleFieldLabel: (v: string) => void;
  newWholesaleFieldType: "TEXT" | "EMAIL" | "PHONE" | "CNPJ" | "LONG_TEXT" | "ADDRESS" | "URL" | "SELECT" | "UPLOAD";
  setNewWholesaleFieldType: (v: "TEXT" | "EMAIL" | "PHONE" | "CNPJ" | "LONG_TEXT" | "ADDRESS" | "URL" | "SELECT" | "UPLOAD") => void;
  newCnae: string;
  setNewCnae: (v: string) => void;
  mode?: "all" | "general" | "b2b";
}

export function GeneralTab({
  locale = "en",
  settings,
  setSettings,
  storeProfile,
  setStoreProfile,
  sellerUsers,
  isSaving,
  onSave,
  newWholesaleFieldLabel,
  setNewWholesaleFieldLabel,
  newWholesaleFieldType,
  setNewWholesaleFieldType,
  newCnae,
  setNewCnae,
  mode = "all",
}: GeneralTabProps) {
  const showStoreSection = mode === "all" || mode === "general";
  const showB2BSections = mode === "all" || mode === "b2b";

  function isLockedVisibleField(field: { isDefault?: boolean; id: string }) {
    return Boolean(field.isDefault && (field.id === "name" || field.id === "email" || field.id === "cnpj"));
  }

  function updateProfile(patch: Partial<StoreProfileConfig>) {
    setStoreProfile({
      id: storeProfile?.id || '',
      name: storeProfile?.name || '',
      cnpj: storeProfile?.cnpj || '',
      description: storeProfile?.description || '',
      email: storeProfile?.email || '',
      phone: storeProfile?.phone || '',
      whatsapp: storeProfile?.whatsapp || '',
      b2bMasterPassword: storeProfile?.b2bMasterPassword || '',
      address: storeProfile?.address || { zip_code: '', street_name: '', house_number: '', address_complement: '', neighborhood: '', city: '', state: '' },
      meta: storeProfile?.meta || getDefaultStoreMeta(),
      ...patch,
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {/* Store Profile */}
        {showStoreSection && (
        <Card id="store-data">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {tAdmin(locale, "admin.general.storeData.title", "Store Data")}
            </CardTitle>
            <CardDescription>
              {tAdmin(locale, "admin.general.storeData.description", "Configure store name, tax ID, contact, address, and metadata")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">{tAdmin(locale, "admin.general.fields.name", "Name")}</Label>
              <Input
                id="storeName"
                value={storeProfile?.name || ''}
                onChange={(e) => updateProfile({ name: e.target.value })}
                placeholder={tAdmin(locale, "admin.general.fields.name.placeholder", "Store name")}
              />
            </div>

            <div className="space-y-2">
              <Label>CNPJ</Label>
              <CNPJInput
                value={storeProfile?.cnpj || ''}
                onChange={(value) => updateProfile({ cnpj: value })}
                name="storeCnpj"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeDescription">{tAdmin(locale, "admin.general.fields.description", "Description")}</Label>
              <Textarea
                id="storeDescription"
                rows={3}
                value={storeProfile?.description || ''}
                onChange={(e) => updateProfile({ description: e.target.value })}
                placeholder={tAdmin(locale, "admin.general.fields.description.placeholder", "Describe the store for institutional use")}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="storeMaintenanceMode" className="text-sm font-medium">
                  {tAdmin(locale, "admin.general.storeData.maintenanceMode", "Site em manutenção")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {tAdmin(locale, "admin.general.storeData.maintenanceMode.help", "Ativa o modo de manutenção para a vitrine da loja.")}
                </p>
              </div>
              <Switch
                id="storeMaintenanceMode"
                checked={Boolean(storeProfile?.meta?.maintenanceMode)}
                onCheckedChange={(checked) =>
                  updateProfile({
                    meta: {
                      ...(storeProfile?.meta || getDefaultStoreMeta()),
                      maintenanceMode: checked,
                    },
                  })
                }
              />
            </div>

            <Separator />

            <p className="text-sm font-medium flex items-center gap-2"><Phone className="h-4 w-4" /> {tAdmin(locale, "admin.general.contact.title", "Contact")}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="storeEmail" className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {tAdmin(locale, "admin.general.fields.email", "Email")}</Label>
                <Input
                  id="storeEmail"
                  type="email"
                  value={storeProfile?.email || ''}
                  onChange={(e) => updateProfile({ email: e.target.value })}
                  placeholder={tAdmin(locale, "admin.general.fields.email.placeholder", "contact@store.com")}
                />
              </div>
              <PhoneInput
                label={tAdmin(locale, "admin.general.fields.phone", "Phone")}
                value={storeProfile?.phone || ''}
                onChange={(value) => updateProfile({ phone: value })}
                name="storePhone"
              />
              <CellphoneInput
                label={tAdmin(locale, "admin.general.fields.whatsapp", "WhatsApp")}
                value={storeProfile?.whatsapp || ''}
                onChange={(value) => updateProfile({ whatsapp: value })}
                name="storeWhatsapp"
              />
            </div>

            <p className="text-sm font-medium flex items-center gap-2"><MapPin className="h-4 w-4" /> {tAdmin(locale, "admin.general.address.title", "Address")}</p>

            <AddressInput
              locale={locale}
              values={{
                zip_code: storeProfile?.address?.zip_code || '',
                street_name: storeProfile?.address?.street_name || '',
                house_number: storeProfile?.address?.house_number || '',
                address_complement: storeProfile?.address?.address_complement || '',
                neighborhood: storeProfile?.address?.neighborhood || '',
                city: storeProfile?.address?.city || '',
                state: storeProfile?.address?.state || '',
              }}
              onChange={(field, value) =>
                updateProfile({ address: { ...(storeProfile?.address || { zip_code: '', street_name: '', house_number: '', address_complement: '', neighborhood: '', city: '', state: '' }), [field]: value } })
              }
              onBulkChange={(fields) =>
                updateProfile({ address: { ...(storeProfile?.address || { zip_code: '', street_name: '', house_number: '', address_complement: '', neighborhood: '', city: '', state: '' }), ...fields } })
              }
            />

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="storeB2bMasterPassword">{tAdmin(locale, "admin.general.storeData.masterPassword", "B2B Master Password")}</Label>
              <Input
                id="storeB2bMasterPassword"
                type="password"
                value={storeProfile?.b2bMasterPassword || ''}
                onChange={(e) => updateProfile({ b2bMasterPassword: e.target.value })}
                placeholder={tAdmin(locale, "admin.general.storeData.masterPassword.placeholder", "Set the master password for customer login")}
              />
              <p className="text-xs text-muted-foreground">
                {tAdmin(locale, "admin.general.storeData.masterPassword.help", "Allows any store customer to log in with their email and this password.")}
              </p>
            </div>


          </CardContent>
        </Card>
        )}

        {/* Meta (SEO) */}
        {showStoreSection && (
        <Card id="store-meta">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-4" />
              {tAdmin(locale, "admin.nav.general.meta", "Meta (SEO)")}
            </CardTitle>
            <CardDescription>
              {tAdmin(locale, "admin.general.meta.description", "Optimize your store for search engines (SEO)")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="metaTitle">{tAdmin(locale, "admin.general.meta.titleLabel", "Title (meta title)")}</Label>
              <Input
                id="metaTitle"
                value={storeProfile?.meta?.title || ''}
                onChange={(e) => updateProfile({ meta: { ...(storeProfile?.meta || getDefaultStoreMeta()), title: e.target.value } as StoreProfileConfig['meta'] })}
                placeholder={tAdmin(locale, "admin.general.meta.titlePlaceholder", "B2B Store | Wholesale and Resale")}
              />
              <p className="text-xs text-muted-foreground">
                {tAdmin(locale, "admin.general.meta.titleHelp", "Shown in browser tab and search results")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaDescription">{tAdmin(locale, "admin.general.meta.descriptionLabel", "Description (meta description)")}</Label>
              <Textarea
                id="metaDescription"
                rows={3}
                value={storeProfile?.meta?.description || ''}
                onChange={(e) => updateProfile({ meta: { ...(storeProfile?.meta || getDefaultStoreMeta()), description: e.target.value } as StoreProfileConfig['meta'] })}
                placeholder={tAdmin(locale, "admin.general.meta.descriptionPlaceholder", "Short store description for search engines (up to 160 characters)")}
              />
              <p className="text-xs text-muted-foreground">
                {tAdmin(locale, "admin.general.meta.descriptionHelp", "Maximum 160 characters. Appears in search results.")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaHeadCode">Código no head (HTML/script)</Label>
              <Textarea
                id="metaHeadCode"
                rows={8}
                value={storeProfile?.meta?.headCode || ''}
                onChange={(e) => updateProfile({ meta: { ...(storeProfile?.meta || getDefaultStoreMeta()), headCode: e.target.value } as StoreProfileConfig['meta'] })}
                placeholder={'<script async src="https://example.com/widget.js"></script>'}
              />
              <p className="text-xs text-muted-foreground">
                Esse código será injetado no head da vitrine desta loja.
              </p>
              <p className="text-xs text-amber-600">
                Use apenas scripts de fontes confiáveis. Esse código será executado em todas as páginas da vitrine.
              </p>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Social Links */}
        {showStoreSection && (
        <Card id="store-social">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-4" />
              {tAdmin(locale, "admin.nav.general.social", "Social Links")}
            </CardTitle>
            <CardDescription>
              {tAdmin(locale, "admin.general.social.description", "Configure links for store footer")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {tAdmin(locale, "admin.general.social.help", "Enable desired social links and provide URL for this store footer.")}
            </p>

            {SOCIAL_LINK_FIELDS.map(({ key, label, placeholder }) => {
              const socialLinks = storeProfile?.meta?.socialLinks || getDefaultStoreSocialLinks()
              const current = socialLinks[key]

              return (
                <div key={key} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`social-${key}`} className="font-medium">{label}</Label>
                    <Switch
                      checked={Boolean(current?.enabled)}
                      onCheckedChange={(checked) =>
                        updateProfile({
                          meta: {
                            ...(storeProfile?.meta || getDefaultStoreMeta()),
                            socialLinks: {
                              ...socialLinks,
                              [key]: {
                                ...(current || { enabled: false, url: '' }),
                                enabled: checked,
                              },
                            },
                          },
                        })
                      }
                    />
                  </div>

                  <Input
                    id={`social-${key}`}
                    value={current?.url || ''}
                    onChange={(e) =>
                      updateProfile({
                        meta: {
                          ...(storeProfile?.meta || getDefaultStoreMeta()),
                          socialLinks: {
                            ...socialLinks,
                            [key]: {
                              ...(current || { enabled: false, url: '' }),
                              url: e.target.value,
                            },
                          },
                        },
                      })
                    }
                    disabled={!current?.enabled}
                    placeholder={placeholder}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
        )}

        {showB2BSections && (
        <Card id="b2b-rules">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {tAdmin(locale, "admin.nav.b2b.rules", "B2B Rules")}
            </CardTitle>
            <CardDescription>
              {tAdmin(locale, "admin.general.b2b.description", "Configure business rules for the store")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{tAdmin(locale, "admin.general.b2b.requireCnpj", "Require Tax ID on Registration")}</Label>
                <p className="text-sm text-muted-foreground">
                  {tAdmin(locale, "admin.general.b2b.requireCnpjHelp", "Customers must provide a valid tax ID to register")}
                </p>
              </div>
              <Switch
                checked={settings.requireCnpj}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, requireCnpj: checked })
                }
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <IntegerInput
                  label={tAdmin(locale, "admin.general.b2b.minPieces", "Minimum Pieces per Order")}
                  value={settings.defaultMinPieces}
                  min={0}
                  onChange={(value) =>
                    setSettings({
                      ...settings,
                      defaultMinPieces: Number.isFinite(value ?? NaN) ? Number(value) : 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {tAdmin(locale, "admin.general.b2b.minPiecesHelp", "Default minimum quantity (can be overridden per customer)")}
                </p>
              </div>
              <div className="space-y-2">
                <CurrencyInput
                  label={tAdmin(locale, "admin.general.b2b.minOrderValue", "Minimum Order Value")}
                  value={settings.minOrderValue}
                  min={0}
                  onChange={(value) =>
                    setSettings({
                      ...settings,
                      minOrderValue: value,
                    })
                  }
                  placeholder={tAdmin(locale, "admin.common.optional", "Optional")}
                />
              </div>
            </div>

          </CardContent>
        </Card>
        )}

        {showB2BSections && (
        <Card id="registration-form">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {tAdmin(locale, "admin.nav.b2b.registration", "Registration Form")}
            </CardTitle>
            <CardDescription>
              {tAdmin(locale, "admin.general.registration.description", "Customize fields shown in customer registration form")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={B2B_PANEL_CLASSNAME}>
              <div className="space-y-3">
                {(settings.sign_wholesale?.fields || getDefaultSignWholesale().fields)
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((field, index) => {
                    const displayFieldLabel = tAdmin(locale, `admin.general.registration.defaultField.${field.id}`, field.label);

                    return (
                    <div key={field.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{index + 1}</span>
                            <p className="font-medium text-sm">{displayFieldLabel}</p>
                            <Badge variant="outline" className="text-[10px]">{field.type}</Badge>
                            {field.enabled !== false && !isLockedVisibleField(field) ? (
                              <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200">
                                {tAdmin(locale, "admin.general.registration.visible", "Visible")}
                              </Badge>
                            ) : null}
                          </div>
                          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {isLockedVisibleField(field) ? (
                            <span className="text-xs font-medium text-muted-foreground">
                              {tAdmin(locale, "admin.general.registration.alwaysVisible", "Always visible")}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                {tAdmin(locale, "admin.general.registration.showField", "Show")}
                              </span>
                              <Switch
                                checked={field.enabled !== false}
                                onCheckedChange={(checked) =>
                                  setSettings({
                                    ...settings,
                                    sign_wholesale: {
                                      ...(settings.sign_wholesale || getDefaultSignWholesale()),
                                      fields: (settings.sign_wholesale?.fields || getDefaultSignWholesale().fields).map((f) =>
                                        f.id === field.id ? { ...f, enabled: checked } : f
                                      ),
                                    },
                                  })
                                }
                              />
                            </div>
                          )}
                          {!field.isDefault && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setSettings({
                                  ...settings,
                                  sign_wholesale: {
                                    ...(settings.sign_wholesale || getDefaultSignWholesale()),
                                    fields: (settings.sign_wholesale?.fields || getDefaultSignWholesale().fields)
                                      .filter((f) => f.id !== field.id)
                                      .map((f, i) => ({ ...f, order: i + 1 })),
                                  },
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}

                <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-2 pt-2">
                  <Input
                    className={B2B_FIELD_CLASSNAME}
                    placeholder={tAdmin(locale, "admin.general.registration.newFieldPlaceholder", "Ex: Instagram")}
                    value={newWholesaleFieldLabel}
                    onChange={(e) => setNewWholesaleFieldLabel(e.target.value)}
                  />
                  <Select value={newWholesaleFieldType} onValueChange={(value: "TEXT" | "EMAIL" | "PHONE" | "CNPJ" | "LONG_TEXT" | "ADDRESS" | "URL" | "SELECT" | "UPLOAD") => setNewWholesaleFieldType(value)}>
                    <SelectTrigger className={B2B_SELECT_TRIGGER_CLASSNAME}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">{tAdmin(locale, "admin.general.fieldType.text", "Text")}</SelectItem>
                      <SelectItem value="LONG_TEXT">{tAdmin(locale, "admin.general.fieldType.longText", "Long text")}</SelectItem>
                      <SelectItem value="ADDRESS">{tAdmin(locale, "admin.general.fieldType.address", "Address")}</SelectItem>
                      <SelectItem value="EMAIL">{tAdmin(locale, "admin.general.fieldType.email", "Email")}</SelectItem>
                      <SelectItem value="PHONE">{tAdmin(locale, "admin.general.fieldType.phone", "Phone")}</SelectItem>
                      <SelectItem value="URL">URL</SelectItem>
                      <SelectItem value="SELECT">{tAdmin(locale, "admin.general.fieldType.select", "Select")}</SelectItem>
                      <SelectItem value="UPLOAD">{tAdmin(locale, "admin.general.fieldType.upload", "Upload")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className={B2B_ACTION_BUTTON_CLASSNAME}
                    onClick={() => {
                      const label = newWholesaleFieldLabel.trim();
                      if (!label) return;
                      const current = settings.sign_wholesale?.fields || getDefaultSignWholesale().fields;
                      const nextOrder = current.length + 1;
                      setSettings({
                        ...settings,
                        sign_wholesale: {
                          ...(settings.sign_wholesale || getDefaultSignWholesale()),
                          fields: [
                            ...current,
                            {
                              id: `custom_${Date.now()}`,
                              label,
                              type: newWholesaleFieldType,
                              enabled: true,
                              required: false,
                              order: nextOrder,
                              isDefault: false,
                            },
                          ],
                        },
                      });
                      setNewWholesaleFieldLabel("");
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> {tAdmin(locale, "admin.common.add", "Add")}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {showB2BSections && (
        <Card id="auto-approval">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              {tAdmin(locale, "admin.nav.b2b.autoApproval", "Auto Approval")}
            </CardTitle>
            <CardDescription>
              {tAdmin(locale, "admin.general.autoApproval.description", "Configure rules to automatically approve registrations based on business activity")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={B2B_PANEL_CLASSNAME}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{tAdmin(locale, "admin.general.autoApproval.enable", "Enable Auto Approval")}</Label>
                    <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.general.autoApproval.enableHelp", "Automatically approve registrations when tax ID business activity is allowed")}</p>
                  </div>
                  <Switch
                    checked={settings.sign_wholesale?.autoApproval?.enabled ?? true}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        sign_wholesale: {
                          ...(settings.sign_wholesale || getDefaultSignWholesale()),
                          autoApproval: {
                            ...(settings.sign_wholesale?.autoApproval || getDefaultSignWholesale().autoApproval),
                            enabled: checked,
                          },
                        },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{tAdmin(locale, "admin.general.autoApproval.approveCpfAutomatically", "Aprovar CPF automaticamente")}</Label>
                    <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.general.autoApproval.approveCpfAutomaticallyHelp", "Cadastros de pessoa física (CPF) entram como APROVADO. Quando desligado, ficam como PENDENTE e precisam de aprovação manual.")}</p>
                  </div>
                  <Switch
                    checked={settings.sign_wholesale?.autoApproval?.approveCpfAutomatically ?? true}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        sign_wholesale: {
                          ...(settings.sign_wholesale || getDefaultSignWholesale()),
                          autoApproval: {
                            ...(settings.sign_wholesale?.autoApproval || getDefaultSignWholesale().autoApproval),
                            approveCpfAutomatically: checked,
                          },
                        },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{tAdmin(locale, "admin.general.autoApproval.validateTaxId", "Validate Tax ID with government database")}</Label>
                    <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.general.autoApproval.validateTaxIdHelp", "Check if tax ID is valid before approval")}</p>
                  </div>
                  <Switch
                    checked={settings.sign_wholesale?.autoApproval?.validateCnpjOnReceita ?? true}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        sign_wholesale: {
                          ...(settings.sign_wholesale || getDefaultSignWholesale()),
                          autoApproval: {
                            ...(settings.sign_wholesale?.autoApproval || getDefaultSignWholesale().autoApproval),
                            validateCnpjOnReceita: checked,
                          },
                        },
                      })
                    }
                  />
                </div>

                {(settings.sign_wholesale?.autoApproval?.validateCnpjOnReceita ?? true) ? (
                  <div className="space-y-2">
                    <Label>{tAdmin(locale, "admin.general.autoApproval.allowedActivities", "Allowed Business Activities")}</Label>
                    {(settings.sign_wholesale?.autoApproval?.allowedCnaes || []).map((cnae, idx) => (
                      <div key={`${cnae}-${idx}`} className="flex items-center gap-2">
                        <Input
                          className={B2B_FIELD_CLASSNAME}
                          value={cnae}
                          onChange={(e) => {
                            const list = [...(settings.sign_wholesale?.autoApproval?.allowedCnaes || [])];
                            list[idx] = e.target.value;
                            setSettings({
                              ...settings,
                              sign_wholesale: {
                                ...(settings.sign_wholesale || getDefaultSignWholesale()),
                                autoApproval: {
                                  ...(settings.sign_wholesale?.autoApproval || getDefaultSignWholesale().autoApproval),
                                  allowedCnaes: list,
                                },
                              },
                            });
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const list = (settings.sign_wholesale?.autoApproval?.allowedCnaes || []).filter((_, i) => i !== idx);
                            setSettings({
                              ...settings,
                              sign_wholesale: {
                                ...(settings.sign_wholesale || getDefaultSignWholesale()),
                                autoApproval: {
                                  ...(settings.sign_wholesale?.autoApproval || getDefaultSignWholesale().autoApproval),
                                  allowedCnaes: list,
                                },
                              },
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        placeholder={tAdmin(locale, "admin.general.autoApproval.newActivityPlaceholder", "Ex: 4781-4/00")}
                        value={newCnae}
                        onChange={(e) => setNewCnae(e.target.value)}
                        className={`${B2B_FIELD_CLASSNAME} max-w-sm`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className={B2B_ACTION_BUTTON_CLASSNAME}
                        onClick={() => {
                          const value = newCnae.trim();
                          if (!value) return;
                          const current = settings.sign_wholesale?.autoApproval?.allowedCnaes || [];
                          setSettings({
                            ...settings,
                            sign_wholesale: {
                              ...(settings.sign_wholesale || getDefaultSignWholesale()),
                              autoApproval: {
                                ...(settings.sign_wholesale?.autoApproval || getDefaultSignWholesale().autoApproval),
                                allowedCnaes: [...current, value],
                              },
                            },
                          });
                          setNewCnae("");
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> {tAdmin(locale, "admin.general.autoApproval.addActivity", "Add Activity")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {showB2BSections && (
        <Card id="seller-assignment">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {tAdmin(locale, "admin.nav.b2b.sellerAssignment", "Seller Assignment")}
            </CardTitle>
            <CardDescription>
              {tAdmin(locale, "admin.general.sellerAssignment.description", "Configure how sellers are assigned to new registrations")}
              {" "}
              Clientes que já existem no ERP (loja física) são atribuídas automaticamente à vendedora
              mapeada — a roleta só entra quando não há match offline nem link de indicação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OfflineSellerPoolAlert />
            <div className={B2B_PANEL_CLASSNAME}>
              <div className="flex items-center justify-between">
                <div>
                  <Label>{tAdmin(locale, "admin.general.sellerAssignment.enable", "Enable Automatic Assignment")}</Label>
                  <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.general.sellerAssignment.enableHelp", "Assign sellers automatically when a customer registers")}</p>
                </div>
                <Switch
                  checked={settings.sign_wholesale?.sellerAssignment?.enabled ?? true}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      sign_wholesale: {
                        ...(settings.sign_wholesale || getDefaultSignWholesale()),
                        sellerAssignment: {
                          ...(settings.sign_wholesale?.sellerAssignment || getDefaultSignWholesale().sellerAssignment),
                          enabled: checked,
                          mode: checked ? "ROUND_ROBIN" : "MANUAL",
                          fallbackSellerId: checked
                            ? (settings.sign_wholesale?.sellerAssignment?.fallbackSellerId || null)
                            : null,
                        },
                      },
                    })
                  }
                />
              </div>

              <Separator />

              {(settings.sign_wholesale?.sellerAssignment?.enabled ?? true) && (
                <>
                  <div className="space-y-2">
                    <Label>{tAdmin(locale, "admin.general.sellerAssignment.pool", "Sellers in Rotation")}</Label>
                    {sellerUsers.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {sellerUsers.map((seller) => {
                          const selectedSellerIds = settings.sign_wholesale?.sellerAssignment?.sellerIds || [];
                          const isSelected = selectedSellerIds.includes(seller.id);
                          return (
                            <button
                              key={seller.id}
                              type="button"
                              onClick={() => {
                                const nextSellerIds = isSelected
                                  ? selectedSellerIds.filter((sellerId) => sellerId !== seller.id)
                                  : [...selectedSellerIds, seller.id];
                                setSettings({
                                  ...settings,
                                  sign_wholesale: {
                                    ...(settings.sign_wholesale || getDefaultSignWholesale()),
                                    sellerAssignment: {
                                      ...(settings.sign_wholesale?.sellerAssignment || getDefaultSignWholesale().sellerAssignment),
                                      sellerIds: nextSellerIds,
                                    },
                                  },
                                });
                              }}
                              className={`flex items-center gap-2.5 rounded-md border p-2 text-left transition-colors ${
                                isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                              }`}
                            >
                              <div className={`flex h-5 w-5 items-center justify-center rounded-sm border ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                                {isSelected && <Check className="h-3.5 w-3.5" />}
                              </div>
                              <span className="text-sm font-medium">{seller.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.general.sellerAssignment.noSellers", "No active sellers found.")}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Price Visibility */}
        {showB2BSections && (
        <Card id="price-visibility">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {tAdmin(locale, "admin.nav.b2b.priceVisibility", "Price Visibility")}
            </CardTitle>
            <CardDescription>
              {tAdmin(locale, "admin.general.priceVisibility.description", "Configure who can see store prices")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="priceVisibilityMode">{tAdmin(locale, "admin.general.priceVisibility.mode", "Visibility Mode")}</Label>
              <Select
                value={settings.priceVisibilityMode}
                onValueChange={(value: "LOGIN_REQUIRED" | "PUBLIC") =>
                  setSettings({ ...settings, priceVisibilityMode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOGIN_REQUIRED">
                    {tAdmin(locale, "admin.general.priceVisibility.loginRequired", "Prices visible only after login")}
                  </SelectItem>
                  <SelectItem value="PUBLIC">
                    {tAdmin(locale, "admin.general.priceVisibility.public", "Prices visible to everyone")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userLinksPriceVisibilityMode">{tAdmin(locale, "admin.general.priceVisibility.userLinksMode", "Visibilidade para Links de Usuário")}</Label>
              <Select
                value={settings.userLinksPriceVisibilityMode || settings.priceVisibilityMode}
                onValueChange={(value: "LOGIN_REQUIRED" | "PUBLIC") =>
                  setSettings({ ...settings, userLinksPriceVisibilityMode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOGIN_REQUIRED">
                    {tAdmin(locale, "admin.general.priceVisibility.loginRequired", "Prices visible only after login")}
                  </SelectItem>
                  <SelectItem value="PUBLIC">
                    {tAdmin(locale, "admin.general.priceVisibility.public", "Prices visible to everyone")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pendingMessage">{tAdmin(locale, "admin.general.priceVisibility.pendingMessage", "Message for Pending Customers")}</Label>
              <Textarea
                id="pendingMessage"
                value={settings.pendingCustomerMessage || ""}
                onChange={(e) =>
                  setSettings({ ...settings, pendingCustomerMessage: e.target.value })
                }
                placeholder={tAdmin(locale, "admin.general.priceVisibility.pendingPlaceholder", "Please wait for your registration approval...")}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      <Button
        onClick={onSave}
        disabled={isSaving}
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
