import { createHash, randomUUID } from 'node:crypto'
import { BILLING_PRICES } from './catalog'
import { BillingError, type AccountState, type BillingCommand, type BillingView } from './types'
import { cryptToken, environment, gateway, type Gateway } from './provider'
import { repository, type Repository } from './repository'

type RemoteSubscription = { id: string; customer: string; status: string; nextDueDate: string; value: number; deleted?: boolean }
type Dependencies = { repo: Repository; api: Gateway; encrypt: (v: string) => string; decrypt: (v: string) => string }
const price = (plan: 'plan_starter' | 'plan_profissional') => (plan === 'plan_starter' ? BILLING_PRICES.starterMonthly : BILLING_PRICES.proMonthly) / 100
const planName = (plan: string) => plan === 'plan_starter' ? 'Starter B2B' : 'Pro B2B'
function dependency(storeId: number): Dependencies { return { repo: repository(storeId), api: gateway, encrypt: v => cryptToken(v, storeId), decrypt: v => cryptToken(v, storeId, true) } }
export function publicAccount(state: AccountState): Pick<BillingView, 'methods' | 'defaultMethodId' | 'subscription'> {
  return { methods: state.cards.map(({ id, last4, brand, expiryMonth, expiryYear }) => ({ id, last4, brand, expiryMonth, expiryYear })), defaultMethodId: state.defaultMethodId, subscription: state.subscription }
}
export async function billingView(storeId: number, canManage: boolean, deps = dependency(storeId)): Promise<BillingView> {
  const account = await deps.repo.read(), state = structuredClone(account.state)
  const view: BillingView = { configured: true, canManage, pending: Boolean(account.operation_id), ...publicAccount(state), invoices: [] }
  if (state.subscription) {
    const remote = await deps.api<RemoteSubscription>(`/subscriptions/${encodeURIComponent(state.subscription.id)}`)
    if (remote.customer !== state.customerId) throw new BillingError(502, 'Não foi possível validar a assinatura.')
    view.subscription = { ...state.subscription, status: remote.deleted || (remote.status === 'INACTIVE' && state.subscription.status === 'CANCELLED') ? 'CANCELLED' : remote.status, nextDueDate: remote.nextDueDate, value: remote.value }
  }
  if (state.customerId) {
    const payments = await deps.api<{ data: { id: string; description?: string; value: number; status: string; dueDate: string; paymentDate?: string; customer: string }[] }>(`/payments?customer=${encodeURIComponent(state.customerId)}&limit=100`)
    view.invoices = payments.data.filter(p => p.customer === state.customerId).map(p => ({ id: p.id, description: p.description || 'Assinatura UP Zero', amount: Math.round(p.value * 100), status: p.status, dueDate: p.dueDate, paidAt: p.paymentDate })).sort((a,b) => b.dueDate.localeCompare(a.dueDate))
  }
  return view
}
export async function executeBilling(storeId: number, actor: string, command: BillingCommand, remoteIp: string, deps = dependency(storeId)) {
  // This fingerprint deliberately excludes all card/holder fields, including PAN and CVV.
  const fingerprint = createHash('sha256').update(JSON.stringify({ action: command.action, plan: 'plan' in command ? command.plan : null, methodId: 'methodId' in command ? command.methodId : null })).digest('hex')
  const state = await deps.repo.begin(command.requestId, actor, command.action, fingerprint)
  if (!state) return
  let writeUnconfirmed = false
  const checkpoint = async () => { await deps.repo.checkpoint(command.requestId, state); writeUnconfirmed = false }
  const write = async <T>(path: string, method: string, body?: unknown) => {
    writeUnconfirmed = true
    try { return await deps.api<T>(path, method, body) }
    catch (error) { if (error instanceof BillingError && !error.uncertain) writeUnconfirmed = false; throw error }
  }
  try {
    if (state.subscription) {
      const current = await deps.api<RemoteSubscription>(`/subscriptions/${encodeURIComponent(state.subscription.id)}`)
      if (current.customer !== state.customerId) throw new BillingError(409, 'Assinatura inválida para esta loja.')
      state.subscription.status = current.deleted || (current.status === 'INACTIVE' && state.subscription.status === 'CANCELLED') ? 'CANCELLED' : current.status
    }
    if (command.action === 'add-card') {
      if (state.cards.length >= 5) throw new BillingError(422, 'Você pode cadastrar até cinco cartões. Remova um cartão antes de adicionar outro.')
      if (!state.customerId) {
        const reference = `upzero:${environment()}:store:${storeId}`
        const customers = await deps.api<{ data: { id: string; externalReference: string }[] }>(`/customers?externalReference=${encodeURIComponent(reference)}&limit=2`)
        if (customers.data.length > 1) throw new BillingError(409, 'Cadastro de cobrança precisa de revisão pelo suporte.')
        if (customers.data[0]?.externalReference === reference) state.customerId = customers.data[0].id
        else {
          const customer = await write<{ id: string }>('/customers', 'POST', { ...command.holder, externalReference: reference, notificationDisabled: true })
          if (!customer.id) throw new BillingError(502, 'Cadastro aguardando confirmação.', true)
          state.customerId = customer.id
        }
        await checkpoint()
      }
      const token = await write<{ creditCardToken: string; creditCardNumber: string; creditCardBrand: string }>('/creditCard/tokenizeCreditCard', 'POST', { customer: state.customerId, creditCard: command.card, creditCardHolderInfo: command.holder, remoteIp })
      if (!token.creditCardToken || !token.creditCardBrand) throw new BillingError(502, 'Cartão aguardando confirmação.', true)
      // Only token + last four digits leave this request's transient memory.
      const existing = state.cards.find(card => deps.decrypt(card.token) === token.creditCardToken)
      if (!existing) state.cards.push({ id: randomUUID(), last4: command.card.number.slice(-4), brand: token.creditCardBrand, expiryMonth: command.card.expiryMonth, expiryYear: command.card.expiryYear, token: deps.encrypt(token.creditCardToken) })
      state.defaultMethodId ||= existing?.id || state.cards[state.cards.length - 1].id
      await checkpoint()
    } else if (command.action === 'subscribe') {
      if (state.subscription && state.subscription.status !== 'CANCELLED') throw new BillingError(409, 'Esta loja já possui uma assinatura. Utilize a troca de plano.')
      const card = state.cards.find(card => card.id === command.methodId)
      if (!card || !state.customerId) throw new BillingError(422, 'Selecione um cartão cadastrado nesta loja.')
      const externalReference = `upzero:${environment()}:${storeId}:${command.requestId}`
      const remote = await write<RemoteSubscription>('/subscriptions', 'POST', { customer: state.customerId, billingType: 'CREDIT_CARD', cycle: 'MONTHLY', value: price(command.plan), nextDueDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), description: `UP Zero — ${planName(command.plan)}`, externalReference, creditCardToken: deps.decrypt(card.token), remoteIp })
      if (!remote.id || remote.customer !== state.customerId) throw new BillingError(502, 'Assinatura aguardando confirmação.', true)
      state.subscription = { id: remote.id, plan: command.plan, status: remote.status, value: remote.value, nextDueDate: remote.nextDueDate, methodId: card.id }
      state.defaultMethodId = card.id
      await checkpoint()
    } else if (command.action === 'default-card') {
      const card = state.cards.find(card => card.id === command.methodId)
      if (!card) throw new BillingError(404, 'Cartão não encontrado nesta loja.')
      if (state.subscription && state.subscription.status !== 'CANCELLED') {
        await write(`/subscriptions/${encodeURIComponent(state.subscription.id)}/creditCard`, 'PUT', { creditCardToken: deps.decrypt(card.token), remoteIp })
        state.subscription.methodId = card.id
      }
      state.defaultMethodId = card.id
      await checkpoint()
    } else if (command.action === 'remove-card') {
      if (!state.cards.some(card => card.id === command.methodId)) throw new BillingError(404, 'Cartão não encontrado nesta loja.')
      if (state.subscription?.methodId === command.methodId && state.subscription.status !== 'CANCELLED') throw new BillingError(409, 'Troque o cartão da assinatura antes de remover este método.')
      state.cards = state.cards.filter(card => card.id !== command.methodId)
      if (state.defaultMethodId === command.methodId) state.defaultMethodId = state.cards[0]?.id
    } else {
      if (!state.subscription || state.subscription.status === 'CANCELLED') throw new BillingError(409, 'Nenhuma assinatura vigente foi encontrada.')
      const path = `/subscriptions/${encodeURIComponent(state.subscription.id)}`
      if (command.action === 'cancel') {
        const result = await write<RemoteSubscription>(path, 'PUT', { status: 'INACTIVE' })
        if (result.id !== state.subscription.id || result.customer !== state.customerId || result.status !== 'INACTIVE') throw new BillingError(502, 'Cancelamento aguardando confirmação.', true)
        state.subscription.status = 'CANCELLED'
      } else {
        const remote = await write<RemoteSubscription>(path, 'PUT', { value: price(command.plan), description: `UP Zero — ${planName(command.plan)}`, updatePendingPayments: false })
        if (remote.id !== state.subscription.id || remote.customer !== state.customerId) throw new BillingError(502, 'Alteração aguardando confirmação.', true)
        state.subscription = { ...state.subscription, plan: command.plan, value: remote.value, nextDueDate: remote.nextDueDate, status: remote.status }
      }
      await checkpoint()
    }
    await deps.repo.finish(command.requestId, state)
  } catch (error) {
    if (!writeUnconfirmed && error instanceof BillingError && !error.uncertain) await deps.repo.finish(command.requestId, state, error.message)
    // An ambiguous financial write keeps its durable lock. Never retry it automatically.
    throw error
  }
}
