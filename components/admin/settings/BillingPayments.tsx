"use client";
import { useEffect, useState } from 'react'
import { CreditCard, Loader2, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { BILLING_PRICES, formatBRL, type CommercialPlan } from '@/lib/billing/catalog'
import type { BillingView } from '@/lib/billing/types'

async function fetchAccount(signal?: AbortSignal): Promise<BillingView> {
  const response = await fetch('/api/billing', { cache: 'no-store', signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a cobrança.')
  return data
}
export function useBillingAccount() {
  const [view, setView] = useState<BillingView | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    fetchAccount(controller.signal).then(data => {
      if (!controller.signal.aborted) { setView(data); setError('') }
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Não foi possível atualizar a cobrança.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  const reload = async () => {
    setLoading(true)
    try { setView(await fetchAccount()); setError('') }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível atualizar a cobrança.') }
    finally { setLoading(false) }
  }
  return { view, error, loading, reload }
}

type Props = ReturnType<typeof useBillingAccount> & { checkoutPlan: CommercialPlan | null; closeCheckout: () => void }
export function BillingPayments({ view, error: loadError, loading, reload, checkoutPlan, closeCheckout }: Props) {
  const [addCard, setAddCard] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState<{ action: 'default-card' | 'remove-card' | 'cancel'; methodId?: string; label: string } | null>(null)
  const available = Boolean(view?.configured && view.canManage && !view.pending && !loading && !loadError)
  const subscription = view?.subscription
  const subscribed = subscription && subscription.status !== 'CANCELLED'
  const planAmount = checkoutPlan === 'plan_starter' ? BILLING_PRICES.starterMonthly : BILLING_PRICES.proMonthly
  const selectedName = checkoutPlan === 'plan_starter' ? 'Starter B2B' : 'Pro B2B'
  async function mutate(command: Record<string, unknown>, success: string) {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...command, requestId: crypto.randomUUID() }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.')
      setNotice(success); await reload(); return true
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível confirmar. Atualize a página antes de tentar novamente.')
      await reload(); return false
    } finally { setBusy(false) }
  }
  async function submitCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form)
    const field = (name: string) => String(data.get(name) || '').trim()
    const card = { holderName: field('holderName'), number: field('number'), expiryMonth: field('expiryMonth').padStart(2,'0'), expiryYear: field('expiryYear'), ccv: field('ccv') }
    const holder = { name: field('name'), email: field('email'), cpfCnpj: field('cpfCnpj'), postalCode: field('postalCode'), addressNumber: field('addressNumber'), phone: field('phone') }
    try { if (await mutate({ action: 'add-card', card, holder, consent: data.get('consent') === 'on' }, 'Cartão adicionado. Nenhuma mensalidade foi cobrada.')) setAddCard(false) }
    finally { form.reset() }
  }
  async function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const command = subscribed ? { action: 'change-plan', plan: checkoutPlan, consent: data.get('consent') === 'on' } : { action: 'subscribe', plan: checkoutPlan, methodId: String(data.get('methodId')), consent: data.get('consent') === 'on' }
    if (await mutate(command, subscribed ? 'Plano alterado para as próximas cobranças ainda não emitidas.' : 'Assinatura criada. Consulte o histórico para acompanhar a confirmação do pagamento.')) closeCheckout()
  }
  const message = loadError || error
  const feedback = <>{message && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}{view?.pending && <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-sm">Existe uma operação aguardando confirmação. Não refaça a contratação. Atualize a página ou contate o suporte.</p>}</>
  return <>
    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Métodos de pagamento</CardTitle><Button variant="outline" size="sm" onClick={() => void reload()} disabled={busy || loading}><RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button></div></CardHeader>
      <CardContent className="space-y-4">
        {feedback}
        {notice && <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-sm">{notice}</p>}
        {view && !view.configured && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">A contratação online está em preparação. Você já pode consultar os planos; o cadastro de cartões será liberado em breve.</p>}
        {view && !view.canManage && <p className="text-sm text-muted-foreground">Você precisa de permissão para editar configurações para gerenciar a assinatura.</p>}
        {view?.methods.length ? <div className="grid gap-3 sm:grid-cols-2">{view.methods.map(method => <div key={method.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center gap-2"><CreditCard className="size-5" /><strong>{method.brand} •••• {method.last4}</strong>{view.defaultMethodId === method.id && <Badge variant="secondary">Padrão</Badge>}</div><p className="mt-2 text-xs text-muted-foreground">Validade {method.expiryMonth}/{method.expiryYear}</p><div className="mt-4 flex flex-wrap gap-2">{view.defaultMethodId !== method.id && <Button variant="outline" size="sm" disabled={!available || busy} onClick={() => setConfirmation({ action: 'default-card', methodId: method.id, label: `${method.brand} •••• ${method.last4}` })}>Usar como padrão</Button>}<Button variant="ghost" size="sm" disabled={!available || busy || (subscribed && subscription.methodId === method.id)} onClick={() => setConfirmation({ action: 'remove-card', methodId: method.id, label: `${method.brand} •••• ${method.last4}` })}>Remover</Button></div></div>)}</div> : <p className="text-sm text-muted-foreground">{loading ? 'Consultando seus métodos de pagamento…' : 'Nenhum cartão cadastrado.'}</p>}
        <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => { setError(''); setAddCard(true) }} disabled={busy || (view !== null && !view.canManage)}><Plus className="mr-2 size-4" />Adicionar cartão</Button>{subscribed && <Button variant="ghost" disabled={!available || busy} onClick={() => setConfirmation({ action: 'cancel', label: '' })}>Cancelar assinatura</Button>}</div>
        <p className="text-xs text-muted-foreground">O cartão padrão será usado nas cobranças recorrentes. Para trocar a forma de pagamento, adicione outro cartão e defina-o como padrão.</p>
      </CardContent>
    </Card>

    <Dialog open={Boolean(checkoutPlan) && !addCard} onOpenChange={open => { if (!open && !busy) { closeCheckout(); setError('') } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{subscribed ? 'Alterar plano' : 'Assinar plano'} {selectedName}</DialogTitle><DialogDescription>Assinatura mensal da plataforma UP Zero.</DialogDescription></DialogHeader>
        <form onSubmit={subscribe} className="space-y-5">
          <div className="rounded-xl bg-muted p-4"><p className="text-2xl font-semibold">{formatBRL(planAmount)} <span className="text-sm font-normal">/mês</span></p><p className="mt-2 text-sm text-muted-foreground">WhatsApp e gerações de IA são adicionais e não estão incluídos neste valor.</p></div>
          {subscribed ? <p className="text-sm">A alteração vale para as próximas cobranças ainda não emitidas. Faturas existentes permanecem com o valor original. Não haverá cobrança proporcional imediata.</p> : <div className="space-y-2"><Label htmlFor="checkout-card">Cartão para pagamento</Label><select required id="checkout-card" name="methodId" defaultValue={view?.defaultMethodId || ''} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="" disabled>Selecione um cartão</option>{view?.methods.map(method => <option key={method.id} value={method.id}>{method.brand} •••• {method.last4}</option>)}</select><Button type="button" variant="outline" onClick={() => { setError(''); setAddCard(true) }}><Plus className="mr-2 size-4" />Adicionar cartão</Button></div>}
          {feedback}
          {!view?.configured && <p className="text-sm text-muted-foreground">A contratação online ainda não foi liberada. Nenhuma cobrança será realizada.</p>}
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="consent" required className="mt-1" /> <span>Autorizo a {subscribed ? 'alteração da' : ''} assinatura de {formatBRL(planAmount)} por mês, com renovação automática até o cancelamento.{!subscribed && ' A primeira cobrança será solicitada hoje.'}</span></label>
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={closeCheckout}>Voltar</Button><Button type="submit" disabled={busy || !available || (!subscribed && !view?.methods.length) || (subscribed && subscription.plan === checkoutPlan)}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{subscribed ? 'Confirmar alteração' : `Assinar por ${formatBRL(planAmount)}/mês`}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={addCard} onOpenChange={open => { if (!busy) { setAddCard(open); setError('') } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Adicionar cartão</DialogTitle><DialogDescription>Cadastre um cartão para pagar sua assinatura. Adicionar o cartão não contrata um plano.</DialogDescription></DialogHeader>
        <form onSubmit={submitCard} className="space-y-5" autoComplete="off">
          <fieldset disabled={!available || busy} className="space-y-4 disabled:opacity-60"><legend className="mb-3 text-sm font-semibold">Dados do cartão</legend>
            <div className="space-y-2"><Label htmlFor="card-holder">Nome impresso no cartão</Label><Input id="card-holder" name="holderName" required maxLength={100} autoComplete="cc-name" /></div>
            <div className="space-y-2"><Label htmlFor="card-number">Número do cartão</Label><Input id="card-number" name="number" required inputMode="numeric" maxLength={23} autoComplete="cc-number" /></div>
            <div className="grid grid-cols-3 gap-3"><div className="space-y-2"><Label htmlFor="card-month">Mês</Label><Input id="card-month" name="expiryMonth" required inputMode="numeric" placeholder="MM" pattern="0?[1-9]|1[0-2]" maxLength={2} autoComplete="cc-exp-month" /></div><div className="space-y-2"><Label htmlFor="card-year">Ano</Label><Input id="card-year" name="expiryYear" required inputMode="numeric" placeholder="AAAA" pattern="20[0-9]{2}" maxLength={4} autoComplete="cc-exp-year" /></div><div className="space-y-2"><Label htmlFor="card-cvv">CVV</Label><Input id="card-cvv" name="ccv" type="password" required inputMode="numeric" pattern="[0-9]{3,4}" maxLength={4} autoComplete="off" /></div></div>
          </fieldset>
          <fieldset disabled={!available || busy} className="space-y-4 disabled:opacity-60"><legend className="mb-3 text-sm font-semibold">Dados do titular</legend>
            {([{ name: 'name', label: 'Nome completo', type: 'text' }, { name: 'email', label: 'E-mail', type: 'email' }, { name: 'cpfCnpj', label: 'CPF ou CNPJ', type: 'text' }, { name: 'phone', label: 'Telefone com DDD', type: 'tel' }] as const).map(field => <div key={field.name} className="space-y-2"><Label htmlFor={`holder-${field.name}`}>{field.label}</Label><Input id={`holder-${field.name}`} name={field.name} type={field.type} required maxLength={field.name === 'email' ? 200 : 100} /></div>)}
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="holder-cep">CEP</Label><Input id="holder-cep" name="postalCode" required inputMode="numeric" maxLength={9} /></div><div className="space-y-2"><Label htmlFor="holder-number">Número do endereço</Label><Input id="holder-number" name="addressNumber" required maxLength={20} /></div></div>
          </fieldset>
          {feedback}
          {!view?.configured && <p className="text-sm text-muted-foreground">O cadastro de cartões será liberado após a configuração do serviço de cobrança.</p>}
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="consent" required disabled={!available || busy} className="mt-1" /><span>Autorizo salvar este cartão para pagamentos futuros na UP Zero.</span></label>
          <p className="text-xs text-muted-foreground">A UP Zero não armazena o número completo do cartão nem o código de segurança.</p>
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setAddCard(false)}>Voltar</Button><Button type="submit" disabled={!available || busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Salvar cartão</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !busy) setConfirmation(null) }}><DialogContent><DialogHeader><DialogTitle>{confirmation?.action === 'cancel' ? 'Cancelar assinatura?' : confirmation?.action === 'remove-card' ? 'Remover cartão?' : 'Alterar cartão de pagamento?'}</DialogTitle><DialogDescription>{confirmation?.action === 'cancel' ? 'A renovação automática será encerrada. Faturas já emitidas continuam devidas; esta ação não solicita reembolso.' : confirmation?.action === 'remove-card' ? `O cartão ${confirmation.label} será removido dos métodos salvos na UP Zero.` : `O cartão ${confirmation?.label} será utilizado na recorrência e nas cobranças pendentes da assinatura. Esta alteração não realiza cobrança imediata.`}</DialogDescription></DialogHeader>{feedback}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Voltar</Button><Button disabled={busy || !available} onClick={async () => { if (!confirmation) return; const { action, methodId } = confirmation; if (await mutate({ action, ...(methodId ? { methodId } : {}), ...(action === 'remove-card' ? {} : { consent: true }) }, 'Alteração concluída.')) setConfirmation(null) }}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Confirmar</Button></DialogFooter></DialogContent></Dialog>
  </>
}
