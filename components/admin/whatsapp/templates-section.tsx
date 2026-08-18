'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Braces, Check, Phone, Plus, RefreshCw } from 'lucide-react'

import { AdminPanel } from '@/components/admin/admin-mobile-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type { TemplateButton, TemplateCategory, WhatsAppState, WhatsAppTemplate } from '@/lib/whatsapp/types'
import { cn } from '@/lib/utils'

type Props = {
  state: WhatsAppState
  reload: () => Promise<void>
}

type VariableMapping = { position: number; payloadPath: string }

const CATEGORY_OPTIONS: Array<{ value: TemplateCategory; label: string; price: string }> = [
  { value: 'MARKETING', label: 'Marketing', price: 'R$ 0,35' },
  { value: 'UTILITY', label: 'Utilidade', price: 'R$ 0,05' },
  { value: 'AUTHENTICATION', label: 'Autenticação', price: 'R$ 0,05' },
]

const PAYLOAD_OPTIONS = [
  { value: 'customer.id', label: 'ID do cliente', example: '166194', group: 'Cliente' },
  { value: 'customer.name', label: 'Nome do cliente', example: 'Victor', group: 'Cliente' },
  { value: 'customer.first_name', label: 'Primeiro nome', example: 'Victor', group: 'Cliente' },
  { value: 'customer.phone', label: 'Telefone', example: '5511999999999', group: 'Cliente' },
  { value: 'customer.email', label: 'E-mail', example: 'victor@exemplo.com', group: 'Cliente' },
  { value: 'customer.cpf_cnpj', label: 'CPF ou CNPJ', example: '***.***.***-**', group: 'Cliente' },
  { value: 'customer.address_state', label: 'Estado', example: 'SP', group: 'Cliente' },
  { value: 'order.id', label: 'Número do pedido', example: '1908', group: 'Pedido' },
  { value: 'order.total', label: 'Valor do pedido', example: 'R$ 459,90', group: 'Pedido' },
  { value: 'order.status', label: 'Status do pedido', example: 'CONFIRMED', group: 'Pedido' },
  { value: 'order.payment_status', label: 'Status do pagamento', example: 'PAID', group: 'Pedido' },
  { value: 'order.tracking_code', label: 'Código de rastreio', example: 'BR123456789', group: 'Pedido' },
  { value: 'order.tracking_url', label: 'Link de rastreio', example: 'https://rastreio.exemplo/BR123', group: 'Pedido' },
  { value: 'order.payment_url', label: 'Link de pagamento', example: 'https://pagamento.exemplo/1908', group: 'Pedido' },
  { value: 'cart.id', label: 'ID do carrinho', example: 'CART-1024', group: 'Carrinho' },
  { value: 'cart.total', label: 'Valor do carrinho', example: 'R$ 329,90', group: 'Carrinho' },
  { value: 'cart.checkout_url', label: 'Link para o carrinho', example: 'https://loja.exemplo/carrinho/1024', group: 'Carrinho' },
  { value: 'payment_link.id', label: 'ID do link', example: 'PAY-2048', group: 'Pagamento' },
  { value: 'payment_link.status', label: 'Status do link', example: 'PENDING', group: 'Pagamento' },
  { value: 'payment_link.amount', label: 'Valor do link', example: 'R$ 459,90', group: 'Pagamento' },
  { value: 'payment_link.expires_at', label: 'Vencimento do link', example: '20/08/2026 18:00', group: 'Pagamento' },
  { value: 'store.name', label: 'Nome da loja', example: 'Minha Loja', group: 'Loja e atendimento' },
  { value: 'seller.name', label: 'Nome da vendedora', example: 'Ana', group: 'Loja e atendimento' },
  { value: 'seller_phone', label: 'Telefone da vendedora', example: '5511988888888', group: 'Loja e atendimento' },
] as const

const PAYLOAD_GROUPS = [...new Set(PAYLOAD_OPTIONS.map((option) => option.group))]

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? 'Não foi possível concluir a ação.')
  return payload as T
}

function statusBadge(status: WhatsAppTemplate['status']) {
  const label = status === 'APPROVED' ? 'Aprovado' : status === 'REJECTED' ? 'Recusado' : status === 'PENDING' ? 'Pendente' : status
  return <Badge variant={status === 'APPROVED' ? 'default' : status === 'REJECTED' ? 'destructive' : 'secondary'}>{label}</Badge>
}

export function WhatsAppTemplatesSection({ state, reload }: Props) {
  const [selectedPhone, setSelectedPhone] = useState('')
  const [templates, setTemplates] = useState(state.templates)
  const [form, setForm] = useState({
    name: '', body: '', footer: '', language: 'pt_BR',
    category: 'MARKETING' as TemplateCategory, buttonText: '', buttonUrl: '',
  })
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedPhoneData = state.phoneNumbers.find((phone) => phone.id === selectedPhone)
  const phoneTemplates = useMemo(() => templates.filter((template) => (
    !selectedPhoneData?.wabaId || template.wabaId === selectedPhoneData.wabaId
  )), [selectedPhoneData?.wabaId, templates])
  const buttonIncomplete = Boolean(form.buttonText.trim()) !== Boolean(form.buttonUrl.trim())
  useEffect(() => setTemplates(state.templates), [state.templates])

  function countsForPhone(phoneId: string) {
    const phone = state.phoneNumbers.find((item) => item.id === phoneId)
    const scoped = templates.filter((template) => !phone?.wabaId || template.wabaId === phone.wabaId)
    return {
      approved: scoped.filter((item) => item.status === 'APPROVED').length,
      pending: scoped.filter((item) => item.status === 'PENDING').length,
      rejected: scoped.filter((item) => item.status === 'REJECTED').length,
    }
  }

  function insertVariable() {
    const position = variableMappings.length + 1
    setVariableMappings((current) => [...current, { position, payloadPath: '' }])
    setForm((current) => ({ ...current, body: `${current.body}${current.body && !current.body.endsWith(' ') ? ' ' : ''}{{${position}}}` }))
  }

  function mapVariable(position: number, payloadPath: string) {
    setVariableMappings((current) => current.map((item) => item.position === position ? { ...item, payloadPath } : item))
  }

  function resetForm() {
    setForm((current) => ({ ...current, name: '', body: '', footer: '', buttonText: '', buttonUrl: '' }))
    setVariableMappings([])
  }

  async function create(submitToMeta: boolean) {
    setBusy(true)
    setError('')
    try {
      const buttons: TemplateButton[] = form.buttonText && form.buttonUrl
        ? [{ type: 'URL', text: form.buttonText, url: form.buttonUrl }]
        : []
      const variableMapping = Object.fromEntries(variableMappings.map((item) => [String(item.position), item.payloadPath]))
      await request('/api/mensageria/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, footer: form.footer || undefined, buttons, variableMapping, submitToMeta, phoneNumberId: selectedPhone }),
      })
      await reload()
      resetForm()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o template.')
    } finally {
      setBusy(false)
    }
  }

  async function sync() {
    setBusy(true)
    setError('')
    try {
      const synced = await request<WhatsAppTemplate[]>(`/api/mensageria/templates?sync=1&phoneNumberId=${encodeURIComponent(selectedPhone)}`)
      setTemplates(synced)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível sincronizar os templates.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => void sync()} disabled={busy || !selectedPhone}>
          <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />Sincronizar com a Meta
        </Button>
      </div>

      <AdminPanel
        title="Dados disponíveis nos webhooks"
        description="Referência simplificada para montar as variáveis dos templates. À esquerda está o nome do dado; à direita, um exemplo de como ele chega."
      >
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {PAYLOAD_GROUPS.map((group) => (
            <section key={group} className="overflow-hidden rounded-xl border bg-muted/10">
              <h3 className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</h3>
              <div className="divide-y">
                {PAYLOAD_OPTIONS.filter((option) => option.group === group).map((option) => (
                  <div key={option.value} className="grid grid-cols-[minmax(0,1fr)_minmax(90px,0.7fr)] items-center gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <code className="block truncate font-semibold text-foreground">{option.value}</code>
                      <span className="text-xs text-muted-foreground">{option.label}</span>
                    </div>
                    <code className="truncate text-right text-xs text-muted-foreground" title={option.example}>{option.example}</code>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </AdminPanel>

      <div>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Escolha um número</h2>
          <p className="text-sm text-muted-foreground">A criação e a lista de modelos aparecem depois que você selecionar a conexão.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.phoneNumbers.map((phone) => (
            (() => {
              const phoneCounts = countsForPhone(phone.id)
              return (
            <button
              key={phone.id}
              type="button"
              onClick={() => setSelectedPhone(phone.id)}
              className={cn('rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md', selectedPhone === phone.id && 'border-primary ring-2 ring-primary/15')}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Phone className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">{phone.verifiedName ?? 'WhatsApp'}</strong>
                  <p className="text-sm text-muted-foreground">{phone.displayPhoneNumber}</p>
                </div>
                {selectedPhone === phone.id ? <Check className="h-5 w-5 text-primary" /> : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div><strong className="block text-emerald-600">{phoneCounts.approved}</strong>Aprovados</div>
                <div><strong className="block text-amber-600">{phoneCounts.pending}</strong>Pendentes</div>
                <div><strong className="block text-rose-600">{phoneCounts.rejected}</strong>Recusados</div>
              </div>
            </button>
              )
            })()
          ))}
        </div>
      </div>

      {!selectedPhone ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
          <Phone className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Selecione um número para gerenciar os templates</p>
          <p className="mt-1 text-sm text-muted-foreground">Isso mantém cada conta organizada e evita criar um modelo no número errado.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gerenciando templates de</p>
              <p className="font-semibold">{selectedPhoneData?.verifiedName} · {selectedPhoneData?.displayPhoneNumber}</p>
            </div>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedPhone('')}><ArrowLeft className="h-4 w-4" />Trocar número</Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
            <AdminPanel title="Criar template" description="Campos de botão e rodapé são opcionais. As variáveis seguem a ordem exigida pela Meta.">
              <div className="space-y-4">
                <div className="space-y-2"><Label htmlFor="template-name">Nome do template</Label><Input id="template-name" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} placeholder="pedido_confirmado" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category} onValueChange={(category) => setForm((value) => ({ ...value, category: category as TemplateCategory }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORY_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label} · {item.price}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Valor estimado por mensagem no Brasil; a cobrança final é definida pela Meta.</p>
                  </div>
                  <div className="space-y-2"><Label>Idioma</Label><Select value={form.language} onValueChange={(language) => setForm((value) => ({ ...value, language }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pt_BR">Português (Brasil)</SelectItem><SelectItem value="en_US">Inglês (EUA)</SelectItem><SelectItem value="es">Espanhol</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label htmlFor="template-body">Texto do corpo</Label><Textarea id="template-body" rows={7} value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))} placeholder="Olá! Seu pedido foi confirmado." /></div>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><Label>Variáveis do payload</Label><p className="mt-1 text-xs text-muted-foreground">Cada clique insere o próximo código numérico no texto.</p></div>
                    <Button type="button" size="sm" variant="outline" className="gap-2" onClick={insertVariable}><Plus className="h-4 w-4" />Inserir variável</Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {variableMappings.map((mapping) => (
                      <div key={mapping.position} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[90px_1fr] sm:items-center">
                        <code className="inline-flex h-9 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary">{`{{${mapping.position}}}`}</code>
                        <Select value={mapping.payloadPath} onValueChange={(payloadPath) => mapVariable(mapping.position, payloadPath)}>
                          <SelectTrigger><SelectValue placeholder="Selecione o dado enviado no payload" /></SelectTrigger>
                          <SelectContent>{PAYLOAD_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label} · {option.value} · Ex.: {option.example}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ))}
                    {variableMappings.length === 0 ? <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"><Braces className="h-4 w-4" />Nenhuma variável inserida.</p> : null}
                  </div>
                </div>

                <div className="space-y-2"><Label htmlFor="template-footer">Rodapé <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="template-footer" value={form.footer} onChange={(event) => setForm((value) => ({ ...value, footer: event.target.value }))} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="template-button-text">Texto do botão <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="template-button-text" value={form.buttonText} onChange={(event) => setForm((value) => ({ ...value, buttonText: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="template-button-url">URL do botão <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="template-button-url" value={form.buttonUrl} onChange={(event) => setForm((value) => ({ ...value, buttonUrl: event.target.value }))} /></div>
                </div>
                {buttonIncomplete ? <p className="text-xs text-amber-700 dark:text-amber-400">Para usar o botão de URL, preencha texto e URL. Se não quiser botão, deixe os dois campos vazios.</p> : null}
                {error ? <Alert variant="destructive"><AlertTitle>Não foi possível concluir</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
                <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void create(false)} disabled={busy || !form.name || !form.body}>Salvar rascunho</Button><Button onClick={() => void create(true)} disabled={busy || !form.name || !form.body || buttonIncomplete || variableMappings.some((item) => !item.payloadPath)}>Enviar para aprovação</Button></div>
              </div>
            </AdminPanel>

            <AdminPanel title="Prévia no WhatsApp" description="Visualização aproximada do modelo.">
              <div className="rounded-xl bg-[#e7f3ed] p-4 dark:bg-emerald-950/20">
                <div className="ml-auto max-w-[90%] rounded-lg bg-white p-3 text-sm text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white">
                  <p className="whitespace-pre-wrap">{form.body || 'Digite o texto do template para visualizar.'}</p>
                  {form.footer ? <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">{form.footer}</p> : null}
                  {form.buttonText ? <div className="mt-3 border-t pt-2 text-center font-medium text-sky-600">{form.buttonText}</div> : null}
                </div>
              </div>
            </AdminPanel>
          </div>

          <AdminPanel title="Modelos cadastrados" description="Status, mapeamento e sincronização do número selecionado.">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Idioma</TableHead><TableHead>Status</TableHead><TableHead>Variáveis e payload</TableHead><TableHead>Atualizado em</TableHead></TableRow></TableHeader>
                <TableBody>
                  {phoneTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{template.category}</TableCell>
                      <TableCell>{template.language}</TableCell>
                      <TableCell>{statusBadge(template.status)}</TableCell>
                      <TableCell>{template.variables.length ? template.variables.map((variable) => `{{${variable}}} → ${template.variableMapping?.[variable] ?? 'não mapeado'}`).join(', ') : '—'}</TableCell>
                      <TableCell>{new Date(template.updatedAt).toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AdminPanel>
        </>
      )}
    </div>
  )
}
