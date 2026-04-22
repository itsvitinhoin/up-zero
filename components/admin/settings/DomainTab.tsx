"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Globe,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Copy,
  ExternalLink,
} from "lucide-react";
import type { SiteSettings, DomainSettings } from "@/lib/types";
import { tAdmin } from "@/lib/i18n/admin";

interface DomainTabProps {
  locale?: string;
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function DomainTab({ locale = "en", settings, setSettings, isSaving, onSave }: DomainTabProps) {
  function updateDomainSettings(updates: Partial<DomainSettings>) {
    setSettings({ ...settings, domainSettings: { ...settings.domainSettings, ...updates } });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{tAdmin(locale, "admin.domain.title", "Custom Domain")}</h2>
          <p className="text-muted-foreground">{tAdmin(locale, "admin.domain.subtitle", "Configure your store custom domain")}</p>
        </div>
        <Button onClick={onSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? tAdmin(locale, "admin.common.saving", "Saving...") : tAdmin(locale, "admin.domain.save", "Save Domain")}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Domain Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {tAdmin(locale, "admin.domain.status.title", "Domain Status")}
            </CardTitle>
            <CardDescription>{tAdmin(locale, "admin.domain.status.description", "See your current domain status")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/20 bg-muted/40">
              <div className="flex items-center gap-3">
                {settings.domainSettings?.domainStatus === "ACTIVE" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : settings.domainSettings?.domainStatus === "VERIFYING" ? (
                  <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />
                ) : settings.domainSettings?.domainStatus === "ERROR" ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">{settings.domainSettings?.customDomain || tAdmin(locale, "admin.domain.status.none", "No domain configured")}</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.domainSettings?.domainStatus === "ACTIVE" && tAdmin(locale, "admin.domain.status.active", "Domain is active and working")}
                    {settings.domainSettings?.domainStatus === "VERIFYING" && tAdmin(locale, "admin.domain.status.verifying", "Waiting for DNS verification")}
                    {settings.domainSettings?.domainStatus === "ERROR" && tAdmin(locale, "admin.domain.status.error", "Configuration error - check DNS records")}
                    {settings.domainSettings?.domainStatus === "PENDING" && tAdmin(locale, "admin.domain.status.pending", "Configure your domain below")}
                  </p>
                </div>
              </div>
              {settings.domainSettings?.sslEnabled && settings.domainSettings?.domainStatus === "ACTIVE" && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <Shield className="h-4 w-4" />
                  {tAdmin(locale, "admin.domain.sslActive", "SSL Active")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Domain Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{tAdmin(locale, "admin.domain.configure.title", "Configure Domain")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.domain.configure.description", "Enter the domain you want to use for your store")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customDomain">{tAdmin(locale, "admin.domain.customDomain", "Custom Domain")}</Label>
              <Input id="customDomain" value={settings.domainSettings?.customDomain || ""} onChange={(e) => updateDomainSettings({ customDomain: e.target.value || null })} placeholder="www.sualoja.com.br" />
              <p className="text-xs text-muted-foreground">{tAdmin(locale, "admin.domain.customDomain.help", "Use the full domain, including www if needed (example: www.store.com or shop.yourdomain.com)")}</p>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch id="sslEnabled" checked={settings.domainSettings?.sslEnabled ?? true} onCheckedChange={(checked) => updateDomainSettings({ sslEnabled: checked })} />
                <Label htmlFor="sslEnabled">{tAdmin(locale, "admin.domain.ssl.recommended", "SSL/HTTPS (Recommended)")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="wwwRedirect" checked={settings.domainSettings?.wwwRedirect ?? true} onCheckedChange={(checked) => updateDomainSettings({ wwwRedirect: checked })} />
                <Label htmlFor="wwwRedirect">{tAdmin(locale, "admin.domain.wwwRedirect", "Redirect www")}</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DNS Instructions */}
        {settings.domainSettings?.customDomain && (
          <Card>
            <CardHeader>
              <CardTitle>{tAdmin(locale, "admin.domain.dns.title", "DNS Configuration")}</CardTitle>
              <CardDescription>{tAdmin(locale, "admin.domain.dns.description", "Add the following DNS records in your domain provider panel")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{tAdmin(locale, "admin.domain.dns.propagation", "After adding DNS records, propagation can take up to 48 hours. Usually less than 1 hour.")}</span>
                </p>
              </div>

              {/* CNAME Record */}
              <div className="space-y-3">
                <h4 className="font-medium">{tAdmin(locale, "admin.domain.dns.cnameTitle", "CNAME Record (Recommended)")}</h4>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.domain.dns.cnameDescription", "Use this record if your domain starts with www or is a subdomain")}</p>
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/40 border border-border/20 rounded-xl font-mono text-sm">
                  <div><p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.type", "Type")}</p><p className="font-medium">CNAME</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.host", "Name/Host")}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{settings.domainSettings.customDomain?.startsWith("www.") ? "www" : settings.domainSettings.customDomain?.split(".")[0] || "@"}</p>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(settings.domainSettings?.customDomain?.startsWith("www.") ? "www" : settings.domainSettings?.customDomain?.split(".")[0] || "@")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.valueTarget", "Value/Target")}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">cname.vercel-dns.com</p>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard("cname.vercel-dns.com")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* A Record */}
              <div className="space-y-3">
                <h4 className="font-medium">{tAdmin(locale, "admin.domain.dns.aTitle", "A Record (Root domain)")}</h4>
                <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.domain.dns.aDescription", "Use this record if you want to use root domain (without www)")}</p>
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/40 border border-border/20 rounded-xl font-mono text-sm">
                  <div><p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.type", "Type")}</p><p className="font-medium">A</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.host", "Name/Host")}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">@</p>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard("@")}><Copy className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.valueIp", "Value/IP")}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">76.76.21.21</p>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard("76.76.21.21")}><Copy className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* TXT Verification */}
              {settings.domainSettings?.domainVerificationToken && (
                <div className="space-y-3">
                  <h4 className="font-medium">{tAdmin(locale, "admin.domain.dns.txtTitle", "TXT Record (Verification)")}</h4>
                  <p className="text-sm text-muted-foreground">{tAdmin(locale, "admin.domain.dns.txtDescription", "Add this record to verify domain ownership")}</p>
                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/40 border border-border/20 rounded-xl font-mono text-sm">
                    <div><p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.type", "Type")}</p><p className="font-medium">TXT</p></div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.host", "Name/Host")}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">_vercel</p>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard("_vercel")}><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{tAdmin(locale, "admin.domain.dns.value", "Value")}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate max-w-50">{settings.domainSettings.domainVerificationToken}</p>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(settings.domainSettings?.domainVerificationToken || "")}><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>{tAdmin(locale, "admin.domain.help.title", "Need Help?")}</CardTitle>
            <CardDescription>{tAdmin(locale, "admin.domain.help.description", "Tutorials for major domain providers")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Registro.br", href: "https://registro.br/ajuda/dominio-direto/" },
                { label: "GoDaddy", href: "https://www.godaddy.com/help/change-my-ip-address-20134" },
                { label: "HostGator", href: "https://www.hostgator.com.br/ajuda/como-alterar-o-dns" },
                { label: "Cloudflare", href: "https://support.cloudflare.com/hc/articles/360019093151" },
              ].map(({ label, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl border border-border/20 hover:bg-muted/40 transition-colors">
                  <span className="font-medium text-sm">{label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="p-4 bg-muted/40 border border-border/20 rounded-xl">
              <h4 className="font-medium mb-2">{tAdmin(locale, "admin.domain.help.stepsTitle", "General Step-by-Step")}</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>{tAdmin(locale, "admin.domain.help.step1", "Open your domain provider control panel")}</li>
                <li>{tAdmin(locale, "admin.domain.help.step2", "Find DNS management or DNS zone section")}</li>
                <li>{tAdmin(locale, "admin.domain.help.step3", "Add CNAME or A records as shown above")}</li>
                <li>{tAdmin(locale, "admin.domain.help.step4", "If required, add TXT record for verification")}</li>
                <li>{tAdmin(locale, "admin.domain.help.step5", "Save changes and wait for propagation (up to 48h)")}</li>
                <li>{tAdmin(locale, "admin.domain.help.step6", "Return here and click Save Domain to verify")}</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
