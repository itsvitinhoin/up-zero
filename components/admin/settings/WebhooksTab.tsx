"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Webhook,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  ScrollText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  listWebhooksAction,
  createWebhookAction,
  updateWebhookAction,
  deleteWebhookAction,
  listWebhookLogsAction,
  type WebhookRecord,
  type WebhookLogRecord,
} from "@/lib/actions/settings";

// Eventos disponíveis para seleção
const AVAILABLE_EVENTS = [
  { value: "cart_created", label: "Carrinho criado" },
  { value: "cart_abandoned", label: "Carrinho abandonado" },
  { value: "cart_converted", label: "Carrinho convertido" },
  { value: "order.created", label: "Pedido criado" },
  { value: "order.updated", label: "Pedido atualizado" },
  { value: "order.confirmed", label: "Pedido confirmado" },
  { value: "order.cancelled", label: "Pedido cancelado" },
  { value: "order.shipped", label: "Pedido enviado" },
  { value: "order.delivered", label: "Pedido entregue" },
  { value: "order.payment_confirmed", label: "Pagamento confirmado" },
  { value: "payment_link.created", label: "Link de pagamento criado" },
  { value: "payment_link.updated", label: "Link de pagamento atualizado" },
  { value: "payment_link.cancelled", label: "Link de pagamento cancelado" },
  { value: "payment_link.expired", label: "Link de pagamento expirado" },
  { value: "payment_link.completed", label: "Link de pagamento pago" },
  { value: "payment_link.payment_failed", label: "Falha no pagamento do link" },
  { value: "customer.created", label: "Cliente criado" },
  { value: "customer.updated", label: "Cliente atualizado" },
  { value: "customer.approved", label: "Cliente aprovado" },
  { value: "customer.rejected", label: "Cliente rejeitado" },
];

interface WebhookFormState {
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
}

const emptyForm = (): WebhookFormState => ({
  url: "",
  events: [],
  secret: "",
  is_active: true,
});

function webhookToForm(w: WebhookRecord): WebhookFormState {
  return {
    url: w.url,
    events: w.events,
    secret: w.secret ?? "",
    is_active: w.is_active,
  };
}

interface EventSelectorProps {
  selected: string[];
  onChange: (events: string[]) => void;
}

function EventSelector({ selected, onChange }: EventSelectorProps) {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((e) => e !== value)
        : [...selected, value]
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {AVAILABLE_EVENTS.map(({ value, label }) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/60"
            }`}
          >
            {active && <Check className="inline-block w-3 h-3 mr-1" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface WebhookFormProps {
  form: WebhookFormState;
  setForm: (f: WebhookFormState) => void;
  showSecretClear?: boolean;
}

function WebhookFormFields({ form, setForm, showSecretClear }: WebhookFormProps) {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>URL do Webhook</Label>
        <Input
          placeholder="https://seu-sistema.com/webhook?token=..."
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Eventos</Label>
        <EventSelector
          selected={form.events}
          onChange={(events) => setForm({ ...form, events })}
        />
        <p className="text-xs text-muted-foreground">
          Use "Cliente aprovado" e "Cliente rejeitado" para eventos especificos de aprovacao/reprovacao.
        </p>
        {form.events.length === 0 && (
          <p className="text-xs text-destructive">Selecione ao menos 1 evento.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>
          Secret{" "}
          <span className="text-muted-foreground font-normal">
            {showSecretClear ? "(deixe vazio para manter o atual)" : "(opcional — usado para HMAC)"}
          </span>
        </Label>
        <div className="relative">
          <Input
            type={showSecret ? "text" : "password"}
            placeholder={showSecretClear ? "••••••••" : "ex.: s3cr3t-key"}
            value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.target.value })}
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowSecret((v) => !v)}
          >
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="is_active"
          checked={form.is_active}
          onCheckedChange={(v) => setForm({ ...form, is_active: v })}
        />
        <Label htmlFor="is_active" className="cursor-pointer">
          Webhook ativo
        </Label>
      </div>
    </div>
  );
}

// ─── Painel de criação ────────────────────────────────────────────────────────

interface CreatePanelProps {
  onCreated: (w: WebhookRecord) => void;
  canEdit: boolean;
}

function CreatePanel({ onCreated, canEdit }: CreatePanelProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<WebhookFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!canEdit) return;
    if (!form.url.trim() || form.events.length === 0) return;
    setSaving(true);
    setError(null);
    const res = await createWebhookAction(
      form.url.trim(),
      form.events,
      form.secret.trim() || undefined
    );
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? "Erro desconhecido");
      return;
    }
    onCreated(res.data!);
    setForm(emptyForm());
    setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!canEdit}>
        <Plus className="mr-2 h-4 w-4" />
        Novo Webhook
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Webhook</DialogTitle>
            <DialogDescription>
              Configure a URL e os eventos que disparam este webhook.
            </DialogDescription>
          </DialogHeader>

          <WebhookFormFields form={form} setForm={setForm} />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!canEdit || saving || !form.url.trim() || form.events.length === 0}
            >
              {saving ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Diálogo de edição ────────────────────────────────────────────────────────

interface EditDialogProps {
  webhook: WebhookRecord;
  onSaved: (w: WebhookRecord) => void;
  onClose: () => void;
  canEdit: boolean;
}

function EditDialog({ webhook, onSaved, onClose, canEdit }: EditDialogProps) {
  const [form, setForm] = useState<WebhookFormState>(webhookToForm(webhook));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!canEdit) return;
    if (!form.url.trim() || form.events.length === 0) return;
    setSaving(true);
    setError(null);
    const res = await updateWebhookAction(webhook.id, {
      url: form.url.trim(),
      events: form.events,
      secret: form.secret.trim() || undefined,
      is_active: form.is_active,
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? "Erro desconhecido");
      return;
    }
    onSaved(res.data!);
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Webhook</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs break-all">{webhook.url}</span>
          </DialogDescription>
        </DialogHeader>

        <WebhookFormFields form={form} setForm={setForm} showSecretClear />

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canEdit || saving || !form.url.trim() || form.events.length === 0}
          >
            {saving ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item de webhook na lista ─────────────────────────────────────────────────

interface WebhookRowProps {
  webhook: WebhookRecord;
  onEdit: (w: WebhookRecord) => void;
  onDeleted: (id: string) => void;
  onToggleActive: (id: string, is_active: boolean) => void;
  canEdit: boolean;
}

function WebhookRow({ webhook, onEdit, onDeleted, onToggleActive, canEdit }: WebhookRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function handleDelete() {
    if (!canEdit) return;
    setDeleting(true);
    const res = await deleteWebhookAction(webhook.id);
    setDeleting(false);
    if (res.success) {
      setDeleteDialogOpen(false);
      onDeleted(webhook.id);
    }
  }

  async function handleToggle(value: boolean) {
    if (!canEdit) return;
    setToggling(true);
    const res = await updateWebhookAction(webhook.id, { is_active: value });
    setToggling(false);
    if (res.success) onToggleActive(webhook.id, value);
  }

  function copyUrl() {
    navigator.clipboard.writeText(webhook.url).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/20 bg-muted/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm break-all">{webhook.url}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={copyUrl}
              title="Copiar URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Criado em {new Date(webhook.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={webhook.is_active}
            onCheckedChange={handleToggle}
            disabled={!canEdit || toggling}
            title={webhook.is_active ? "Desativar" : "Ativar"}
          />
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(webhook)}
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          ) : null}
          {canEdit ? (
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={deleting}
                title="Remover"
              >
                {deleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover webhook</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O webhook será removido permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Removendo..." : "Remover"}
                </AlertDialogAction>
              </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {!webhook.is_active && (
          <Badge variant="secondary" className="text-xs">Inativo</Badge>
        )}
        {webhook.events.map((event) => (
          <Badge key={event} variant="outline" className="text-xs font-mono">
            {event}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ─── Painel de logs de envio ──────────────────────────────────────────────────

function statusColor(log: WebhookLogRecord) {
  if (!log.success) return "text-destructive";
  if (log.response_status && log.response_status >= 200 && log.response_status < 300)
    return "text-emerald-600";
  return "text-amber-600";
}

interface WebhookLogRowProps {
  log: WebhookLogRecord;
}

function WebhookLogRow({ log }: WebhookLogRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/20 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span
          className={`shrink-0 text-xs font-semibold w-10 ${statusColor(log)}`}
        >
          {log.response_status ?? (log.success ? "OK" : "ERR")}
        </span>
        <Badge variant="outline" className="text-xs font-mono shrink-0">
          {log.event}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground truncate flex-1">
          {log.url}
        </span>
        {log.duration_ms != null && (
          <span className="text-xs text-muted-foreground shrink-0">
            {log.duration_ms}ms
          </span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">
          {new Date(log.created_at).toLocaleString("pt-BR")}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-border/20 bg-muted/20 space-y-3 text-xs">
          {log.error_message && (
            <div>
              <p className="font-semibold text-destructive mb-1">Erro:</p>
              <pre className="text-destructive/80 whitespace-pre-wrap break-all">{log.error_message}</pre>
            </div>
          )}
          {log.response_body && (
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Resposta:</p>
              <pre className="text-foreground/70 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {log.response_body}
              </pre>
            </div>
          )}
          <p className="text-muted-foreground">
            Webhook ID: <span className="font-mono">{log.webhook_id}</span> · Log ID:{" "}
            <span className="font-mono">{log.id}</span>
          </p>
        </div>
      )}
    </div>
  );
}

interface WebhookLogsPanelProps {
  webhookId?: string;
}

function WebhookLogsPanel({ webhookId }: WebhookLogsPanelProps) {
  const [logs, setLogs] = useState<WebhookLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const selectedEvent = eventFilter === "all" ? undefined : eventFilter;
    const res = await listWebhookLogsAction(webhookId, 100, selectedEvent);
    setLoading(false);
    if (!res.success) {
      setError(res.error ?? "Erro ao carregar logs");
      return;
    }
    setLogs(res.data ?? []);
  }, [eventFilter, webhookId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card id="webhook-logs">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Logs de Envio
            </CardTitle>
            <CardDescription>
              Histórico das últimas 100 chamadas realizadas para os webhooks cadastrados.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <div className="mt-4 w-full sm:w-64">
          <Label htmlFor="webhook-event-filter" className="text-xs text-muted-foreground">
            Filtrar por evento
          </Label>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger id="webhook-event-filter" className="mt-1">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {AVAILABLE_EVENTS.map((evt) => (
                <SelectItem key={evt.value} value={evt.value}>
                  {evt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        ) : error ? (
          <div className="flex flex-col gap-2 items-center py-8">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <ScrollText className="h-10 w-10 opacity-30" />
            <p className="text-sm">Nenhum log registrado ainda.</p>
            <p className="text-xs text-center max-w-xs">
              Os logs aparecerão aqui quando eventos forem disparados (criação de pedido, mudança de status, etc.).
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <WebhookLogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab principal ────────────────────────────────────────────────────────────

interface WebhooksTabProps {
  locale?: string;
  canEdit?: boolean;
}

export function WebhooksTab({ locale: _locale, canEdit = true }: WebhooksTabProps = {}) {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<WebhookRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listWebhooksAction();
    setLoading(false);
    if (!res.success) {
      setError(res.error ?? "Erro ao carregar webhooks");
      return;
    }
    setWebhooks(res.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleCreated(w: WebhookRecord) {
    setWebhooks((prev) =>
      prev.some((p) => p.id === w.id)
        ? prev.map((p) => (p.id === w.id ? w : p))
        : [w, ...prev]
    );
  }

  function handleSaved(w: WebhookRecord) {
    setWebhooks((prev) => prev.map((p) => (p.id === w.id ? w : p)));
  }

  function handleDeleted(id: string) {
    setWebhooks((prev) => prev.filter((p) => p.id !== id));
  }

  function handleToggleActive(id: string, is_active: boolean) {
    setWebhooks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active } : p))
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Webhooks</h2>
          <p className="text-muted-foreground">
            Receba notificações automáticas em URLs externas quando eventos ocorrerem na loja.
          </p>
        </div>
        <CreatePanel onCreated={handleCreated} canEdit={canEdit} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks cadastrados
          </CardTitle>
          <CardDescription>
            Cada webhook receberá um POST com o payload do evento na URL configurada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Carregando...
            </div>
          ) : error ? (
            <div className="flex flex-col gap-2 items-center py-8">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Webhook className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum webhook cadastrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((w) => (
                <WebhookRow
                  key={w.id}
                  webhook={w}
                  onEdit={setEditingWebhook}
                  onDeleted={handleDeleted}
                  onToggleActive={handleToggleActive}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingWebhook && (
        <EditDialog
          webhook={editingWebhook}
          onSaved={handleSaved}
          onClose={() => setEditingWebhook(null)}
          canEdit={canEdit}
        />
      )}

      <WebhookLogsPanel />
    </div>
  );
}
