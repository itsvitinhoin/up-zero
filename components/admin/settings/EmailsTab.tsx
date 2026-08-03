"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  Clock3,
  Eye,
  FilePenLine,
  Laptop,
  Mail,
  MessageSquareText,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  TestTube2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/ui/rich-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmailDeliveryHistory,
  getEmailTemplateDeliverySummary,
} from "@/components/admin/settings/EmailDeliveryHistory";
import { cn } from "@/lib/utils";

type EmailCategory = "ACCOUNT" | "ORDER" | "PAYMENT" | "DELIVERY" | "RECOVERY";
type RecipientType = "CUSTOMER" | "SELLER" | "ADMIN";
type EditorView = "list" | "editor";
type PreviewDevice = "desktop" | "mobile";
type EmailSection = "templates" | "history";

interface TriggerDefinition {
  key: string;
  name: string;
  description: string;
  category: EmailCategory;
  variables: string[];
}

interface TransactionalEmailTemplate {
  id: string;
  name: string;
  description: string;
  triggerKey: string;
  category: EmailCategory;
  recipient: RecipientType;
  active: boolean;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  updatedAt: string;
}

interface EmailIdentity {
  senderName: string;
  replyTo: string;
}

const STORAGE_KEY = "upzero-transactional-email-settings-v1";

const CATEGORY_CONFIG: Record<EmailCategory, { label: string; className: string }> = {
  ACCOUNT: { label: "Conta", className: "bg-sky-50 text-sky-700 border-sky-200" },
  ORDER: { label: "Pedido", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  PAYMENT: { label: "Pagamento", className: "bg-amber-50 text-amber-700 border-amber-200" },
  DELIVERY: { label: "Entrega", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  RECOVERY: { label: "Recuperação", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

const RECIPIENT_LABELS: Record<RecipientType, string> = {
  CUSTOMER: "Cliente",
  SELLER: "Vendedora",
  ADMIN: "Administrador",
};

const TRIGGERS: TriggerDefinition[] = [
  {
    key: "customer.registration_received",
    name: "Cadastro recebido",
    description: "Quando um novo cliente conclui o cadastro B2B.",
    category: "ACCOUNT",
    variables: ["customer_name", "store_name"],
  },
  {
    key: "customer.registration_approved",
    name: "Cadastro aprovado",
    description: "Quando o cadastro do cliente é aprovado para comprar.",
    category: "ACCOUNT",
    variables: ["customer_name", "store_name", "store_url"],
  },
  {
    key: "order.created",
    name: "Pedido recebido",
    description: "Imediatamente após a criação de um novo pedido.",
    category: "ORDER",
    variables: ["customer_name", "order_number", "order_total", "order_items", "store_name"],
  },
  {
    key: "order.canceled",
    name: "Pedido cancelado",
    description: "Quando o pedido muda para o status cancelado.",
    category: "ORDER",
    variables: ["customer_name", "order_number", "order_total", "store_name"],
  },
  {
    key: "payment.approved",
    name: "Pagamento aprovado",
    description: "Quando o pagamento do pedido é confirmado.",
    category: "PAYMENT",
    variables: ["customer_name", "order_number", "order_total", "payment_method", "store_name"],
  },
  {
    key: "payment.pending",
    name: "Pagamento pendente",
    description: "Quando o pedido aguarda a conclusão do pagamento.",
    category: "PAYMENT",
    variables: ["customer_name", "order_number", "order_total", "payment_link", "store_name"],
  },
  {
    key: "delivery.shipped",
    name: "Pedido enviado",
    description: "Quando o pedido é despachado e recebe rastreio.",
    category: "DELIVERY",
    variables: ["customer_name", "order_number", "tracking_code", "tracking_url", "store_name"],
  },
  {
    key: "cart.abandoned",
    name: "Carrinho abandonado",
    description: "Quando um carrinho entra na régua de recuperação.",
    category: "RECOVERY",
    variables: ["customer_name", "cart_items", "cart_total", "checkout_url", "store_name"],
  },
];

const VARIABLE_LABELS: Record<string, string> = {
  customer_name: "Nome do cliente",
  store_name: "Nome da loja",
  store_url: "Link da loja",
  order_number: "Número do pedido",
  order_total: "Total do pedido",
  order_items: "Produtos do pedido",
  payment_method: "Forma de pagamento",
  payment_link: "Link de pagamento",
  tracking_code: "Código de rastreio",
  tracking_url: "Link de rastreio",
  cart_items: "Produtos do carrinho",
  cart_total: "Total do carrinho",
  checkout_url: "Link para o checkout",
};

const SAMPLE_VALUES: Record<string, string> = {
  customer_name: "Mariana Oliveira",
  store_name: "Nome da Marca",
  store_url: "https://sualoja.com.br",
  order_number: "#10482",
  order_total: "R$ 1.284,90",
  order_items: "12 peças em 4 produtos",
  payment_method: "PIX",
  payment_link: "https://sualoja.com.br/pagar/10482",
  tracking_code: "BR204891735UP",
  tracking_url: "https://sualoja.com.br/rastreio/10482",
  cart_items: "8 peças selecionadas",
  cart_total: "R$ 846,00",
  checkout_url: "https://sualoja.com.br/carrinho/recuperar",
};

const DEFAULT_IDENTITY: EmailIdentity = {
  senderName: "Nome da Marca",
  replyTo: "atendimento@sualoja.com.br",
};

const DEFAULT_TEMPLATES: TransactionalEmailTemplate[] = [
  {
    id: "email-order-created",
    name: "Confirmação de pedido",
    description: "Confirma ao cliente que o pedido foi recebido pela equipe.",
    triggerKey: "order.created",
    category: "ORDER",
    recipient: "CUSTOMER",
    active: true,
    subject: "Recebemos seu pedido {{order_number}}",
    preheader: "Seu pedido já está com a nossa equipe.",
    heading: "Pedido recebido com sucesso",
    body: "<p>Olá, <strong>{{customer_name}}</strong>!</p><p>Recebemos o seu pedido <strong>{{order_number}}</strong>, no valor de <strong>{{order_total}}</strong>. Nossa equipe já começou a conferir todos os detalhes.</p><p>Você receberá uma nova atualização assim que o pedido avançar.</p>",
    ctaLabel: "Acompanhar pedido",
    ctaUrl: "{{store_url}}/meus-pedidos",
    updatedAt: "Hoje, 10:42",
  },
  {
    id: "email-payment-approved",
    name: "Pagamento aprovado",
    description: "Avisa que o pagamento foi confirmado e o pedido seguirá para separação.",
    triggerKey: "payment.approved",
    category: "PAYMENT",
    recipient: "CUSTOMER",
    active: true,
    subject: "Pagamento aprovado para o pedido {{order_number}}",
    preheader: "Tudo certo com o pagamento do seu pedido.",
    heading: "Pagamento confirmado",
    body: "<p>Olá, <strong>{{customer_name}}</strong>!</p><p>O pagamento de <strong>{{order_total}}</strong> foi aprovado via {{payment_method}}.</p><p>Agora vamos preparar o seu pedido para envio.</p>",
    ctaLabel: "Ver detalhes do pedido",
    ctaUrl: "{{store_url}}/meus-pedidos",
    updatedAt: "Ontem, 16:18",
  },
  {
    id: "email-delivery-shipped",
    name: "Pedido enviado",
    description: "Compartilha o rastreio quando o pedido sai para entrega.",
    triggerKey: "delivery.shipped",
    category: "DELIVERY",
    recipient: "CUSTOMER",
    active: true,
    subject: "Seu pedido {{order_number}} está a caminho",
    preheader: "Acompanhe a entrega pelo código de rastreio.",
    heading: "Seu pedido está a caminho",
    body: "<p>Olá, <strong>{{customer_name}}</strong>!</p><p>O pedido <strong>{{order_number}}</strong> foi enviado.</p><p>Código de rastreio: <strong>{{tracking_code}}</strong></p>",
    ctaLabel: "Rastrear entrega",
    ctaUrl: "{{tracking_url}}",
    updatedAt: "28/07/2026",
  },
  {
    id: "email-registration-approved",
    name: "Cadastro aprovado",
    description: "Boas-vindas para clientes aprovados no atacado.",
    triggerKey: "customer.registration_approved",
    category: "ACCOUNT",
    recipient: "CUSTOMER",
    active: true,
    subject: "Seu cadastro na {{store_name}} foi aprovado",
    preheader: "Você já pode acessar preços e fazer pedidos.",
    heading: "Seu acesso está liberado",
    body: "<p>Olá, <strong>{{customer_name}}</strong>!</p><p>Seu cadastro foi aprovado. Agora você pode acessar o catálogo completo, consultar preços e fazer pedidos pela nossa loja.</p>",
    ctaLabel: "Acessar loja",
    ctaUrl: "{{store_url}}",
    updatedAt: "25/07/2026",
  },
  {
    id: "email-payment-pending",
    name: "Pagamento pendente",
    description: "Lembra o cliente de concluir o pagamento do pedido.",
    triggerKey: "payment.pending",
    category: "PAYMENT",
    recipient: "CUSTOMER",
    active: false,
    subject: "Falta pouco para concluir o pedido {{order_number}}",
    preheader: "Finalize o pagamento para confirmarmos seu pedido.",
    heading: "Pagamento pendente",
    body: "<p>Olá, <strong>{{customer_name}}</strong>!</p><p>O pagamento de <strong>{{order_total}}</strong> ainda está pendente. Use o botão abaixo para concluir com segurança.</p>",
    ctaLabel: "Concluir pagamento",
    ctaUrl: "{{payment_link}}",
    updatedAt: "22/07/2026",
  },
  {
    id: "email-cart-abandoned",
    name: "Recuperação de carrinho",
    description: "Relembra os produtos deixados no carrinho.",
    triggerKey: "cart.abandoned",
    category: "RECOVERY",
    recipient: "CUSTOMER",
    active: false,
    subject: "Seus produtos ainda estão te esperando",
    preheader: "Continue de onde parou e finalize seu pedido.",
    heading: "Seu carrinho continua salvo",
    body: "<p>Olá, <strong>{{customer_name}}</strong>!</p><p>Você deixou <strong>{{cart_items}}</strong> no carrinho, no total de <strong>{{cart_total}}</strong>.</p><p>Continue de onde parou enquanto os produtos ainda estão disponíveis.</p>",
    ctaLabel: "Voltar ao carrinho",
    ctaUrl: "{{checkout_url}}",
    updatedAt: "18/07/2026",
  },
];

function triggerByKey(key: string) {
  return TRIGGERS.find((trigger) => trigger.key === key) ?? TRIGGERS[0];
}

function withSamples(value: string) {
  return Object.entries(SAMPLE_VALUES).reduce(
    (result, [key, sample]) => result.replaceAll(`{{${key}}}`, sample),
    value,
  );
}

function TemplateStatus({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      Ativo
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1.5 border-border bg-muted/60 text-muted-foreground">
      <CircleOff className="h-3 w-3" />
      Inativo
    </Badge>
  );
}

function CategoryBadge({ category }: { category: EmailCategory }) {
  const config = CATEGORY_CONFIG[category];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Mail;
  label: string;
  value: number;
  hint: string;
  tone: "primary" | "success" | "muted";
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-100 text-emerald-700",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="border-border/60 shadow-none">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmailPreview({
  template,
  identity,
  device,
}: {
  template: TransactionalEmailTemplate;
  identity: EmailIdentity;
  device: PreviewDevice;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-border/70 bg-muted/40 p-3 sm:p-4">
      <div
        className={cn(
          "mx-auto overflow-hidden rounded-[18px] border border-border/70 bg-background shadow-sm transition-all",
          device === "mobile" ? "max-w-[360px]" : "max-w-[640px]",
        )}
      >
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <p className="truncate"><span className="font-medium text-foreground">Assunto:</span> {withSamples(template.subject)}</p>
          <p className="mt-1 truncate">{withSamples(template.preheader)}</p>
        </div>
        <div className={cn("mx-auto", device === "mobile" ? "p-5" : "p-8")}>
          <div className="mb-7 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Mail className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">{identity.senderName || "Nome da Marca"}</span>
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {CATEGORY_CONFIG[template.category].label}
          </p>
          <h3 className={cn("font-semibold tracking-tight", device === "mobile" ? "text-xl" : "text-2xl")}>
            {withSamples(template.heading)}
          </h3>
          <div
            className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-foreground"
            dangerouslySetInnerHTML={{ __html: withSamples(template.body) }}
          />
          {template.ctaLabel ? (
            <div className="mt-7">
              <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                {withSamples(template.ctaLabel)}
              </span>
            </div>
          ) : null}
          <Separator className="my-7" />
          <p className="text-[11px] leading-5 text-muted-foreground">
            Este é um e-mail automático enviado por {identity.senderName || "Nome da Marca"}. Em caso de dúvida, responda para {identity.replyTo || "o atendimento da loja"}.
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmailsTab() {
  const [templates, setTemplates] = useState<TransactionalEmailTemplate[]>(DEFAULT_TEMPLATES);
  const [identity, setIdentity] = useState<EmailIdentity>(DEFAULT_IDENTITY);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [view, setView] = useState<EditorView>("list");
  const [emailSection, setEmailSection] = useState<EmailSection>("templates");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EmailCategory | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { templates?: TransactionalEmailTemplate[]; identity?: EmailIdentity };
      if (Array.isArray(parsed.templates) && parsed.templates.length > 0) setTemplates(parsed.templates);
      if (parsed.identity) setIdentity(parsed.identity);
    } catch {
      // Keep platform defaults if the locally stored preview cannot be read.
    }
  }, []);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const selectedTrigger = triggerByKey(selectedTemplate.triggerKey);
  const activeCount = templates.filter((template) => template.active).length;
  const inactiveCount = templates.length - activeCount;

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return templates.filter((template) => {
      const trigger = triggerByKey(template.triggerKey);
      const matchesQuery = !normalizedQuery
        || template.name.toLowerCase().includes(normalizedQuery)
        || trigger.name.toLowerCase().includes(normalizedQuery)
        || template.subject.toLowerCase().includes(normalizedQuery);
      const matchesCategory = categoryFilter === "ALL" || template.category === categoryFilter;
      const matchesStatus = statusFilter === "ALL"
        || (statusFilter === "ACTIVE" ? template.active : !template.active);
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, query, statusFilter, templates]);

  function updateTemplate(updates: Partial<TransactionalEmailTemplate>) {
    setTemplates((current) => current.map((template) => (
      template.id === selectedTemplate.id ? { ...template, ...updates } : template
    )));
    setHasChanges(true);
  }

  function updateIdentity(updates: Partial<EmailIdentity>) {
    setIdentity((current) => ({ ...current, ...updates }));
    setHasChanges(true);
  }

  function openTemplate(id: string) {
    setSelectedTemplateId(id);
    setView("editor");
    setPreviewDevice("desktop");
  }

  function toggleTemplate(id: string, active: boolean) {
    setTemplates((current) => current.map((template) => template.id === id ? { ...template, active } : template));
    setHasChanges(true);
  }

  function saveChanges() {
    setIsSaving(true);
    const timestamp = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    const nextTemplates = templates.map((template) => (
      template.id === selectedTemplateId ? { ...template, updatedAt: `Hoje, ${timestamp}` } : template
    ));
    setTemplates(nextTemplates);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ templates: nextTemplates, identity }));
    } catch {
      // The preview still works when browser storage is unavailable.
    }
    window.setTimeout(() => {
      setIsSaving(false);
      setHasChanges(false);
      toast.success("Configurações de e-mail salvas");
    }, 450);
  }

  function restoreSelectedTemplate() {
    const defaultTemplate = DEFAULT_TEMPLATES.find((template) => template.id === selectedTemplate.id);
    if (!defaultTemplate) return;
    setTemplates((current) => current.map((template) => template.id === selectedTemplate.id ? defaultTemplate : template));
    setHasChanges(true);
    toast.success("Modelo padrão restaurado");
  }

  function insertVariable(variable: string) {
    updateTemplate({ body: `${selectedTemplate.body}<p>{{${variable}}}</p>` });
    toast.success(`${VARIABLE_LABELS[variable] ?? variable} inserido no conteúdo`);
  }

  function sendTestEmail() {
    if (!/^\S+@\S+\.\S+$/.test(testEmail)) {
      toast.error("Informe um e-mail válido para o teste");
      return;
    }
    setIsSendingTest(true);
    window.setTimeout(() => {
      setIsSendingTest(false);
      setTestDialogOpen(false);
      toast.success(`Prévia de teste preparada para ${testEmail}`);
    }, 650);
  }

  if (view === "editor") {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setView("list")}
              className="h-11 w-11 shrink-0 rounded-xl"
              aria-label="Voltar para modelos"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold tracking-tight">{selectedTemplate.name}</h2>
                <TemplateStatus active={selectedTemplate.active} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Personalize o disparo e o conteúdo enviado ao cliente.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestDialogOpen(true)}
              className="h-11 flex-1 gap-2 rounded-xl sm:flex-none"
            >
              <TestTube2 className="h-4 w-4" />
              Enviar teste
            </Button>
            <Button
              type="button"
              onClick={saveChanges}
              disabled={isSaving || !hasChanges}
              className="h-11 flex-1 gap-2 rounded-xl sm:flex-none"
            >
              {isSaving ? <Clock3 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)]">
          <div className="min-w-0 space-y-5">
            <Card id="email-trigger" className="border-border/60 shadow-none">
              <CardHeader className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Settings2 className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Disparo</CardTitle>
                      <CardDescription className="mt-1">Defina quando e para quem esta mensagem será enviada.</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={selectedTemplate.active}
                    onCheckedChange={(active) => updateTemplate({ active })}
                    aria-label="Ativar modelo"
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 p-4 pt-0 sm:grid-cols-2 sm:p-5 sm:pt-0">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="email-trigger-select">Trigger</Label>
                  <Select
                    value={selectedTemplate.triggerKey}
                    onValueChange={(triggerKey) => {
                      const trigger = triggerByKey(triggerKey);
                      updateTemplate({ triggerKey, category: trigger.category });
                    }}
                  >
                    <SelectTrigger id="email-trigger-select" className="min-h-12 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((trigger) => (
                        <SelectItem key={trigger.key} value={trigger.key}>{trigger.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-muted-foreground">{selectedTrigger.description}</p>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <div className="flex min-h-12 items-center rounded-xl border bg-muted/30 px-3">
                    <CategoryBadge category={selectedTemplate.category} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-recipient">Destinatário</Label>
                  <Select value={selectedTemplate.recipient} onValueChange={(recipient) => updateTemplate({ recipient: recipient as RecipientType })}>
                    <SelectTrigger id="email-recipient" className="min-h-12 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RECIPIENT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card id="email-message" className="border-border/60 shadow-none">
              <CardHeader className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Conteúdo da mensagem</CardTitle>
                    <CardDescription className="mt-1">Use as variáveis para personalizar cada envio automaticamente.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-4 pt-0 sm:p-5 sm:pt-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="email-subject">Assunto</Label>
                    <span className="text-[11px] text-muted-foreground">{selectedTemplate.subject.length}/120</span>
                  </div>
                  <Input
                    id="email-subject"
                    value={selectedTemplate.subject}
                    onChange={(event) => updateTemplate({ subject: event.target.value.slice(0, 120) })}
                    className="min-h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="email-preheader">Preheader</Label>
                    <span className="text-[11px] text-muted-foreground">{selectedTemplate.preheader.length}/140</span>
                  </div>
                  <Input
                    id="email-preheader"
                    value={selectedTemplate.preheader}
                    onChange={(event) => updateTemplate({ preheader: event.target.value.slice(0, 140) })}
                    className="min-h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-heading">Título principal</Label>
                  <Input
                    id="email-heading"
                    value={selectedTemplate.heading}
                    onChange={(event) => updateTemplate({ heading: event.target.value })}
                    className="min-h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Corpo do e-mail</Label>
                  <RichEditor
                    value={selectedTemplate.body}
                    onChange={(body) => updateTemplate({ body })}
                    placeholder="Escreva a mensagem enviada ao cliente..."
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email-cta-label">Texto do botão</Label>
                    <Input
                      id="email-cta-label"
                      value={selectedTemplate.ctaLabel}
                      onChange={(event) => updateTemplate({ ctaLabel: event.target.value })}
                      className="min-h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-cta-url">Destino do botão</Label>
                    <Input
                      id="email-cta-url"
                      value={selectedTemplate.ctaUrl}
                      onChange={(event) => updateTemplate({ ctaUrl: event.target.value })}
                      className="min-h-12 rounded-xl"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="email-variables" className="border-border/60 shadow-none">
              <CardHeader className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Variáveis disponíveis</CardTitle>
                    <CardDescription className="mt-1">Toque em uma variável para adicioná-la ao corpo da mensagem.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 p-4 pt-0 sm:p-5 sm:pt-0">
                {selectedTrigger.variables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="min-h-10 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="block text-xs font-medium">{VARIABLE_LABELS[variable] ?? variable}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{`{{${variable}}}`}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Button
              type="button"
              variant="ghost"
              onClick={restoreSelectedTemplate}
              className="h-11 gap-2 rounded-xl text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar modelo padrão
            </Button>
          </div>

          <div className="min-w-0 2xl:sticky 2xl:top-6 2xl:self-start">
            <Card className="border-border/60 shadow-none">
              <CardHeader className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4" /> Pré-visualização</CardTitle>
                    <CardDescription className="mt-1">Dados ilustrativos serão substituídos no envio real.</CardDescription>
                  </div>
                  <Tabs value={previewDevice} onValueChange={(value) => setPreviewDevice(value as PreviewDevice)}>
                    <TabsList className="h-10 w-full rounded-xl sm:w-auto">
                      <TabsTrigger value="desktop" className="gap-1.5 rounded-lg px-3"><Laptop className="h-3.5 w-3.5" /> Desktop</TabsTrigger>
                      <TabsTrigger value="mobile" className="gap-1.5 rounded-lg px-3"><Smartphone className="h-3.5 w-3.5" /> Mobile</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
                <EmailPreview template={selectedTemplate} identity={identity} device={previewDevice} />
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="rounded-[22px] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><TestTube2 className="h-5 w-5 text-primary" /> Enviar e-mail de teste</DialogTitle>
              <DialogDescription>
                Confira o modelo com dados ilustrativos antes de ativar o disparo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="test-email">E-mail do destinatário</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="nome@empresa.com.br"
                className="min-h-12 rounded-xl"
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendTestEmail();
                }}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTestDialogOpen(false)} className="h-11 rounded-xl">Cancelar</Button>
              <Button type="button" onClick={sendTestEmail} disabled={isSendingTest} className="h-11 gap-2 rounded-xl">
                <Send className="h-4 w-4" />
                {isSendingTest ? "Preparando..." : "Enviar teste"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div id="email-settings" className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">E-mails transacionais</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Configure os disparos automáticos enviados pela plataforma.</p>
            </div>
          </div>
        </div>
        {emailSection === "templates" ? (
          <Button
            type="button"
            onClick={saveChanges}
            disabled={isSaving || !hasChanges}
            className="h-11 gap-2 rounded-xl"
          >
            <Check className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar configurações"}
          </Button>
        ) : null}
      </div>

      <Tabs value={emailSection} onValueChange={(value) => setEmailSection(value as EmailSection)}>
        <TabsList className="h-12 w-full rounded-xl p-1 sm:w-auto">
          <TabsTrigger value="templates" className="min-h-10 flex-1 gap-2 rounded-lg px-4 sm:flex-none">
            <FilePenLine className="h-4 w-4" />
            Modelos
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-10 flex-1 gap-2 rounded-lg px-4 sm:flex-none">
            <BarChart3 className="h-4 w-4" />
            Histórico de envios
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {emailSection === "history" ? (
        <EmailDeliveryHistory templates={templates} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard icon={Mail} label="Modelos" value={templates.length} hint="Triggers configurados" tone="primary" />
            <StatCard icon={CheckCircle2} label="Ativos" value={activeCount} hint="Enviando automaticamente" tone="success" />
            <StatCard icon={CircleOff} label="Inativos" value={inactiveCount} hint="Disparos pausados" tone="muted" />
          </div>

          <Card id="email-identity" className="border-border/60 shadow-none">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Identidade do remetente</CardTitle>
              <CardDescription className="mt-1">O provedor é gerenciado pela UP Zero. Você controla apenas como a marca aparece.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 sm:grid-cols-2 sm:p-5 sm:pt-0">
          <div className="space-y-2">
            <Label htmlFor="sender-name">Nome do remetente</Label>
            <Input
              id="sender-name"
              value={identity.senderName}
              onChange={(event) => updateIdentity({ senderName: event.target.value })}
              className="min-h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reply-to">E-mail para resposta</Label>
            <Input
              id="reply-to"
              type="email"
              value={identity.replyTo}
              onChange={(event) => updateIdentity({ replyTo: event.target.value })}
              className="min-h-12 rounded-xl"
            />
          </div>
        </CardContent>
          </Card>

          <Card id="email-templates" className="border-border/60 shadow-none">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">Modelos da plataforma</CardTitle>
              <CardDescription className="mt-1">Selecione um modelo para configurar o trigger e personalizar a mensagem.</CardDescription>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto">
              <div className="relative sm:min-w-52">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar modelo..."
                  className="min-h-11 rounded-xl pl-9"
                  aria-label="Buscar modelos"
                />
              </div>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as EmailCategory | "ALL")}>
                <SelectTrigger className="min-h-11 w-full rounded-xl" aria-label="Filtrar categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as categorias</SelectItem>
                  {Object.entries(CATEGORY_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")}>
                <SelectTrigger className="min-h-11 w-full rounded-xl" aria-label="Filtrar status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os status</SelectItem>
                  <SelectItem value="ACTIVE">Ativos</SelectItem>
                  <SelectItem value="INACTIVE">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          {filteredTemplates.length > 0 ? filteredTemplates.map((template) => {
            const trigger = triggerByKey(template.triggerKey);
            const deliverySummary = getEmailTemplateDeliverySummary(template.id);
            return (
              <div
                key={template.id}
                className="group rounded-2xl border border-border/60 p-4 transition-all hover:border-primary/25 hover:bg-muted/20 hover:shadow-sm"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => openTemplate(template.id)}
                    className="flex min-h-12 min-w-0 flex-1 items-start gap-3 text-left sm:gap-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <FilePenLine className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-tight">{template.name}</span>
                        <CategoryBadge category={template.category} />
                        <TemplateStatus active={template.active} />
                      </div>
                      <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{template.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> {trigger.name}</span>
                        <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> {RECIPIENT_LABELS[template.recipient]}</span>
                        <span className="flex items-center gap-1.5"><Clock3 className="h-3 w-3" /> {template.updatedAt}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-lg bg-primary/5 px-2 py-1 font-medium text-primary">
                          {new Intl.NumberFormat("pt-BR").format(deliverySummary.sent)} enviados
                        </span>
                        <span className="rounded-lg bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                          {deliverySummary.sent > 0
                            ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format((deliverySummary.delivered / deliverySummary.sent) * 100)}% entregues`
                            : "Sem envios"}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-xs text-muted-foreground/80">
                        <span className="font-medium text-foreground/70">Assunto:</span> {template.subject}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-3 sm:flex-row sm:items-center">
                    <Switch
                      checked={template.active}
                      onCheckedChange={(active) => toggleTemplate(template.id, active)}
                      aria-label={`${template.active ? "Desativar" : "Ativar"} ${template.name}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openTemplate(template.id)}
                      className="h-11 w-11 rounded-xl"
                      aria-label={`Editar ${template.name}`}
                    >
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 font-medium">Nenhum modelo encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou tente outro termo de busca.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setQuery(""); setCategoryFilter("ALL"); setStatusFilter("ALL"); }}
                className="mt-4 h-11 rounded-xl"
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
