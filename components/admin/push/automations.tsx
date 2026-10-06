'use client'

import { useState } from 'react'
import { PackageCheck, ShoppingCart, Heart, Store, Settings2 } from 'lucide-react'
import { AdminPanel } from '@/components/admin/admin-mobile-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { automationLabels, messageSchema, type Automation, type AutomationKind } from '@/lib/push/types'
import { Choice } from './audience-filters'
import { Empty, Field, PushPage, Status, formatDate, usePushView } from './shared'
import { MessageFields, PushPreview } from './message'

const orderLabels = { CONFIRMED: 'pedido confirmado', SHIPPED: 'pedido enviado', DELIVERED: 'pedido entregue' }
function duration(minutes: number) {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? 'dia' : 'dias'}`
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? 'hora' : 'horas'}`
  return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
}
const icons = { BACK_IN_STOCK: PackageCheck, ABANDONED_CART: ShoppingCart, POST_SALE: Heart, B2B2C_ORDER: Store }
const descriptions: Record<AutomationKind, string> = {
  BACK_IN_STOCK: 'Avise quem pediu para ser notificado quando a variação voltar a ficar disponível.',
  ABANDONED_CART: 'Lembre o consumidor de continuar uma compra após um período sem atividade.',
  POST_SALE: 'Envie uma mensagem após o pedido atingir o status escolhido.',
  B2B2C_ORDER: 'Notifique o revendedor assim que o UP Zero direcionar um pedido para ele.',
}
const variables: Record<AutomationKind, string> = {
  BACK_IN_STOCK: '{{nome}}, {{produto}}, {{produto_id}}', ABANDONED_CART: '{{nome}}, {{carrinho_id}}',
  POST_SALE: '{{nome}}, {{pedido}}, {{pedido_id}}', B2B2C_ORDER: '{{nome}}, {{pedido}}, {{pedido_id}}',
}
export function PushAutomations() {
  const data = usePushView(), [editor, setEditor] = useState<Automation | null>(null), [logKind, setLogKind] = useState('ALL'), [logStatus, setLogStatus] = useState('ALL')
  const logs = data.view?.logs.filter(j => j.kind && (logKind === 'ALL' || j.kind === logKind) && (logStatus === 'ALL' || j.status === logStatus)) || []
  async function save(enabled: boolean) {
    if (!editor) return
    if (await data.run('automation.save', { ...editor, enabled }, enabled ? 'Automação ativada.' : 'Configuração salva.')) setEditor(null)
  }
  return <PushPage title="Automações de Push" description="Configure mensagens que acompanham o estoque, as compras e a distribuição de pedidos." data={data}>
    <div className="grid gap-4 xl:grid-cols-2">{data.view?.automations.map(rule => {
      const Icon = icons[rule.kind], recent = data.view?.logs.find(j => j.kind === rule.kind)
      return <AdminPanel key={rule.kind} title={automationLabels[rule.kind]} description={descriptions[rule.kind]} action={<Icon className="h-5 w-5 text-primary" />}><div className="space-y-4"><div className="flex items-center justify-between gap-3"><Badge variant={rule.enabled ? 'default' : 'secondary'}>{rule.enabled ? 'Ativa' : rule.configured ? 'Pausada' : 'Não configurada'}</Badge><Switch aria-label={`Ativar ${automationLabels[rule.kind]}`} checked={rule.enabled} disabled={data.busy || !data.view?.canSend || !rule.configured || (!rule.enabled && (!data.view.settings.enabled || !data.view.readiness.provider || !data.view.readiness.events))} onCheckedChange={enabled => void data.run('automation.save', { ...rule, enabled }, enabled ? 'Automação ativada.' : 'Automação pausada.')} /></div><p className="text-sm text-muted-foreground">{rule.kind === 'B2B2C_ORDER' ? 'Envio imediato ao revendedor responsável.' : rule.kind === 'BACK_IN_STOCK' ? 'Um aviso por solicitação e variação.' : rule.kind === 'ABANDONED_CART' ? `Após ${duration(rule.delayMinutes)} sem atividade.` : `${duration(rule.delayMinutes)} após o ${orderLabels[rule.orderStatus]}.`}</p><p className="text-xs text-muted-foreground">Último registro: {recent ? `${formatDate(recent.finishedAt || recent.dueAt)} · ${recent.reason || 'Registrado'}` : 'Nenhum envio registrado'}</p><Button variant="outline" disabled={!data.view?.canSend} onClick={() => setEditor(structuredClone(rule))}><Settings2 className="h-4 w-4" />Configurar</Button></div></AdminPanel>
    })}</div>
    <AdminPanel title="Histórico de execuções" description="Últimos 100 registros de Push. Envios aceitos, pendências, falhas e avisos ignorados."><div className="mb-4 grid gap-3 sm:grid-cols-2"><Choice label="Filtrar por automação" value={logKind} onChange={setLogKind} options={[["ALL","Todas as automações"], ...Object.entries(automationLabels)]} /><Choice label="Filtrar resultado" value={logStatus} onChange={setLogStatus} options={[["ALL","Todos os resultados"],["PENDING","Pendente"],["SENDING","Enviando"],["ACCEPTED","Aceito pelo serviço"],["FAILED","Falha"],["SKIPPED","Ignorado"]]} /></div><div className="space-y-2">{logs.map(j => <div key={j.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center"><Status value={j.status} /><div className="flex-1"><p className="font-medium">{automationLabels[j.kind!]} · {data.view?.members.find(m => m.id === j.memberId)?.name || j.memberId}</p><p className="text-xs text-muted-foreground">{j.reason || `Referência: ${j.reference || '—'}`}</p></div><span className="text-xs text-muted-foreground">{formatDate(j.finishedAt || j.dueAt, data.view?.settings.timezone)}</span></div>)}{!logs.length ? <Empty>Nenhuma execução corresponde aos filtros.</Empty> : null}</div></AdminPanel>
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !data.busy) setEditor(null) }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{editor ? automationLabels[editor.kind] : 'Configurar automação'}</DialogTitle><DialogDescription>{editor ? descriptions[editor.kind] : ''}</DialogDescription></DialogHeader>{editor ? <><div className="grid items-start gap-5 xl:grid-cols-[1.3fr_1fr]"><div className="space-y-5">
      {editor.kind === 'POST_SALE' ? <Field label="Status que inicia o pós-venda"><Choice label="Status que inicia o pós-venda" value={editor.orderStatus} onChange={v => setEditor({ ...editor, orderStatus: v as Automation['orderStatus'] })} options={[["CONFIRMED","Pedido confirmado"],["SHIPPED","Pedido enviado"],["DELIVERED","Pedido entregue"]]} /></Field> : null}
      {editor.kind !== 'B2B2C_ORDER' ? <Field label={editor.kind === 'ABANDONED_CART' ? 'Tempo sem atividade (minutos)' : 'Intervalo até o envio (minutos)'}><Input aria-label="Intervalo da automação em minutos" type="number" min={editor.kind === 'ABANDONED_CART' ? 1 : 0} max="43200" value={editor.delayMinutes} onChange={e => setEditor({ ...editor, delayMinutes: Number(e.target.value) })} /></Field> : <p className="rounded-xl border bg-muted/30 p-4 text-sm">O aviso é imediato e não segue o horário de silêncio comercial. Um redirecionamento cancela os avisos pendentes do revendedor anterior.</p>}
      <MessageFields value={editor.message} onChange={message => setEditor({ ...editor, message })} variables={variables[editor.kind]} /><MessageFields value={editor.message} onChange={message => setEditor({ ...editor, message })} destination />
      <p className="text-xs text-muted-foreground">{editor.kind === 'ABANDONED_CART' ? 'Um lembrete por período de inatividade. O envio é cancelado se houver retomada ou conversão em pedido.' : editor.kind === 'BACK_IN_STOCK' ? 'A assinatura considera a variação exata solicitada e encerra o aviso após o enfileiramento.' : editor.kind === 'POST_SALE' ? 'O envio pendente é ignorado se o pedido for cancelado ou estornado.' : 'Somente dispositivos do revendedor responsável recebem o aviso.'}</p>
    </div><PushPreview message={editor.message} /></div><div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={data.busy} onClick={() => setEditor(null)}>Cancelar</Button><Button variant="outline" disabled={data.busy || !messageSchema.safeParse(editor.message).success} onClick={() => void save(editor.enabled)}>Salvar</Button><Button disabled={data.busy || !messageSchema.safeParse(editor.message).success || !data.view?.settings.enabled || !data.view?.readiness.provider || !data.view?.readiness.events} onClick={() => void save(true)}>Salvar e ativar</Button></div></> : null}</DialogContent></Dialog>
  </PushPage>
}
