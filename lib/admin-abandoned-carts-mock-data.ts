export type AbandonedCartRecoveryStatus =
  | 'NOT_SENT'
  | 'SENT'
  | 'RESPONDED'
  | 'RECOVERED'
  | 'FAILED'

export type AbandonedCartItem = {
  id: string
  productName: string
  sku: string
  color: string
  size: string
  quantity: number
  unitPrice: number
}

export type AbandonedCart = {
  id: string
  customerName: string
  companyName: string
  phone: string
  email: string
  sellerName: string
  abandonedAt: string
  lastActivityAt: string
  recoveryStatus: AbandonedCartRecoveryStatus
  lastMessageAt: string | null
  recoveryAttempts: number
  subtotal: number
  discountTotal: number
  shippingEstimate: number
  items: AbandonedCartItem[]
  notes: string
}

export const abandonedCartsMock: AbandonedCart[] = [
  {
    id: 'cart-8f31a2',
    customerName: 'Ana Lima',
    companyName: 'Boutique Elegance',
    phone: '11999887766',
    email: 'compras@elegance.com.br',
    sellerName: 'Maria Silva',
    abandonedAt: '2026-06-22T10:18:00.000Z',
    lastActivityAt: '2026-06-22T10:22:00.000Z',
    recoveryStatus: 'NOT_SENT',
    lastMessageAt: null,
    recoveryAttempts: 0,
    subtotal: 4750,
    discountTotal: 0,
    shippingEstimate: 0,
    notes: 'Cliente montou o carrinho pelo celular e parou na revisão do pedido.',
    items: [
      { id: 'item-1', productName: 'Vestido Midi Serena', sku: 'VES-SER-VM-P', color: 'Vermelho', size: 'P', quantity: 3, unitPrice: 189.9 },
      { id: 'item-2', productName: 'Calça Alfaiataria Aurora', sku: 'CAL-AUR-PT-M', color: 'Preto', size: 'M', quantity: 6, unitPrice: 249.9 },
      { id: 'item-3', productName: 'Blazer Linho Olivia', sku: 'BLA-OLI-BG-G', color: 'Bege', size: 'G', quantity: 4, unitPrice: 429.9 },
    ],
  },
  {
    id: 'cart-51c7b0',
    customerName: 'Carla Santos',
    companyName: 'Moda Feminina SA',
    phone: '11988776655',
    email: 'pedidos@modafeminina.com.br',
    sellerName: 'Ana Santos',
    abandonedAt: '2026-06-22T08:46:00.000Z',
    lastActivityAt: '2026-06-22T09:03:00.000Z',
    recoveryStatus: 'SENT',
    lastMessageAt: '2026-06-22T09:14:00.000Z',
    recoveryAttempts: 1,
    subtotal: 12380,
    discountTotal: 420,
    shippingEstimate: 35,
    notes: 'Mensagem enviada com cupom de fechamento para compras acima de 30 pecas.',
    items: [
      { id: 'item-4', productName: 'Camisa Cetim Luna', sku: 'CAM-LUN-OFF-P', color: 'Off white', size: 'P', quantity: 12, unitPrice: 159.9 },
      { id: 'item-5', productName: 'Saia Plissada Mila', sku: 'SAI-MIL-AZ-M', color: 'Azul', size: 'M', quantity: 8, unitPrice: 179.9 },
      { id: 'item-6', productName: 'Macacão Iris', sku: 'MAC-IRI-VD-G', color: 'Verde', size: 'G', quantity: 5, unitPrice: 299.9 },
    ],
  },
  {
    id: 'cart-a40d19',
    customerName: 'Julia Ferreira',
    companyName: 'Casa da Moda',
    phone: '11977665544',
    email: 'vendas@casadamoda.com.br',
    sellerName: 'Rafaela Costa',
    abandonedAt: '2026-06-21T20:11:00.000Z',
    lastActivityAt: '2026-06-21T20:16:00.000Z',
    recoveryStatus: 'RESPONDED',
    lastMessageAt: '2026-06-21T20:35:00.000Z',
    recoveryAttempts: 2,
    subtotal: 8920,
    discountTotal: 0,
    shippingEstimate: 28,
    notes: 'Cliente respondeu perguntando prazo de reposição do tamanho G.',
    items: [
      { id: 'item-7', productName: 'Conjunto Nina', sku: 'CON-NIN-CR-P', color: 'Creme', size: 'P', quantity: 4, unitPrice: 349.9 },
      { id: 'item-8', productName: 'Top Tricot Eva', sku: 'TOP-EVA-MR-M', color: 'Marrom', size: 'M', quantity: 10, unitPrice: 119.9 },
      { id: 'item-9', productName: 'Pantalona Jade', sku: 'PAN-JAD-PR-G', color: 'Preto', size: 'G', quantity: 6, unitPrice: 239.9 },
    ],
  },
  {
    id: 'cart-e92b64',
    customerName: 'Maria Souza',
    companyName: 'Style & Co',
    phone: '11966554433',
    email: 'compras@styleco.com.br',
    sellerName: 'Julia Costa',
    abandonedAt: '2026-06-21T15:30:00.000Z',
    lastActivityAt: '2026-06-21T15:38:00.000Z',
    recoveryStatus: 'RECOVERED',
    lastMessageAt: '2026-06-21T16:02:00.000Z',
    recoveryAttempts: 1,
    subtotal: 6540,
    discountTotal: 260,
    shippingEstimate: 0,
    notes: 'Pedido recuperado apos contato da vendedora.',
    items: [
      { id: 'item-10', productName: 'Jaqueta Cropped Maia', sku: 'JAQ-MAI-JE-P', color: 'Jeans', size: 'P', quantity: 6, unitPrice: 269.9 },
      { id: 'item-11', productName: 'Shorts Linho Bella', sku: 'SHO-BEL-BR-M', color: 'Branco', size: 'M', quantity: 9, unitPrice: 149.9 },
    ],
  },
  {
    id: 'cart-35d8aa',
    customerName: 'Paula Costa',
    companyName: 'Fashion Plus',
    phone: '11955443322',
    email: 'pedidos@fashionplus.com.br',
    sellerName: 'Maria Silva',
    abandonedAt: '2026-06-20T18:05:00.000Z',
    lastActivityAt: '2026-06-20T18:12:00.000Z',
    recoveryStatus: 'FAILED',
    lastMessageAt: '2026-06-20T18:40:00.000Z',
    recoveryAttempts: 3,
    subtotal: 3200,
    discountTotal: 0,
    shippingEstimate: 24,
    notes: 'WhatsApp sem resposta apos tres tentativas.',
    items: [
      { id: 'item-12', productName: 'Vestido Curto Flora', sku: 'VES-FLO-RS-G', color: 'Rosa', size: 'G', quantity: 5, unitPrice: 219.9 },
      { id: 'item-13', productName: 'Regata Canelada Lia', sku: 'REG-LIA-PT-M', color: 'Preto', size: 'M', quantity: 8, unitPrice: 89.9 },
    ],
  },
]

export function getAbandonedCartById(id: string) {
  return abandonedCartsMock.find((cart) => cart.id === id) ?? null
}

