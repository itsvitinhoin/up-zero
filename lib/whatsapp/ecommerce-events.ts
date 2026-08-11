import type { ECommerceEventDefinition } from './types'

export const ECOMMERCE_EVENT_DEFINITIONS: ECommerceEventDefinition[] = [
  { type: 'customer.created', label: 'Cliente cadastrado', group: 'Cadastro', description: 'Disparado quando um cliente e criado no e-commerce.', statusHint: 'success', payloadFields: ['customer.id', 'customer.name', 'customer.phone', 'customer.email'] },
  { type: 'customer.updated', label: 'Cliente atualizado', group: 'Cadastro', description: 'Disparado quando dados cadastrais do cliente mudam.', statusHint: 'info', payloadFields: ['customer.id', 'customer.status', 'customer.address_state'] },
  { type: 'customer.registration_incomplete', label: 'Cadastro incompleto', group: 'Cadastro', description: 'Status calculado quando faltam telefone, documento ou endereco.', statusHint: 'needs_attention', payloadFields: ['customer.phone', 'customer.cpf_cnpj', 'customer.address_state'] },
  { type: 'customer.whatsapp_opt_in_missing', label: 'Sem opt-in WhatsApp', group: 'Cadastro', description: 'Status calculado para bloquear disparos sem consentimento.', statusHint: 'needs_attention', payloadFields: ['customer.phone', 'customer.opt_in_whatsapp'] },
  { type: 'customer.whatsapp_opt_in_confirmed', label: 'Opt-in WhatsApp confirmado', group: 'Cadastro', description: 'Cliente pode receber campanhas e automacoes WhatsApp.', statusHint: 'success', payloadFields: ['customer.phone', 'customer.opt_in_whatsapp'] },
  { type: 'order.created', label: 'Pedido criado', group: 'Pedido', description: 'Disparado na criacao de pedido.', statusHint: 'info', payloadFields: ['order.id', 'order.total', 'order.order_status'] },
  { type: 'order.updated', label: 'Pedido atualizado', group: 'Pedido', description: 'Disparado em mudancas gerais do pedido.', statusHint: 'info', payloadFields: ['order.id', 'order.order_status', 'order.payment_status'] },
  { type: 'order.reserved', label: 'Pedido reservado', group: 'Pedido', description: 'Pedido aberto ou aguardando pagamento/processamento.', statusHint: 'needs_attention', payloadFields: ['order.id', 'order.order_status'] },
  { type: 'order.confirmed', label: 'Pedido confirmado', group: 'Pedido', description: 'Disparado quando o pedido muda para confirmado.', statusHint: 'success', payloadFields: ['order.id', 'order.customer.phone'] },
  { type: 'order.payment_confirmed', label: 'Pagamento confirmado', group: 'Pedido', description: 'Disparado quando o pagamento e confirmado.', statusHint: 'success', payloadFields: ['order.id', 'order.payment_status'] },
  { type: 'order.processing', label: 'Pedido em processamento', group: 'Pedido', description: 'Status calculado para pedido em separacao/processamento.', statusHint: 'info', payloadFields: ['order.id', 'order.order_status'] },
  { type: 'order.invoiced', label: 'Nota emitida', group: 'Pedido', description: 'Status calculado quando invoice/NF-e transiciona para INVOICED.', statusHint: 'success', payloadFields: ['order.id', 'invoice.status', 'invoice.nf_number'] },
  { type: 'order.shipped', label: 'Pedido enviado', group: 'Entrega', description: 'Disparado quando a etiqueta e emitida ou pedido e enviado.', statusHint: 'success', payloadFields: ['order.id', 'label.tracking_code', 'label.carrier'] },
  { type: 'order.delivered', label: 'Pedido entregue', group: 'Entrega', description: 'Disparado quando pedido chega ao cliente.', statusHint: 'success', payloadFields: ['order.id', 'order.order_status'] },
  { type: 'order.cancelled', label: 'Pedido cancelado', group: 'Pedido', description: 'Disparado quando pedido e cancelado.', statusHint: 'failed', payloadFields: ['order.id', 'cancel.reason'] },
]
