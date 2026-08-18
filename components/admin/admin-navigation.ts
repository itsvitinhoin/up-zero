import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Package,
  Boxes,
  Tag,
  Settings,
  UserCog,
  ShoppingCart,
  FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AdminNavigationChild = {
  name: string
  href: string
  exact?: boolean
}

export type AdminNavigationItem = {
  name: string
  href?: string
  icon: LucideIcon
  children?: AdminNavigationChild[]
  adminOnly?: boolean
}

export const ADMIN_NAVIGATION: AdminNavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Clientes',
    href: '/customers',
    icon: Users,
  },
  {
    name: 'B2C',
    icon: Users,
    children: [
      { name: 'Cadastros', href: '/b2c-leads' },
      { name: 'Pedidos', href: '/b2c-orders' },
    ],
  },
  {
    name: 'Vendas',
    icon: ShoppingCart,
    children: [
      { name: 'Pedidos', href: '/orders' },
      { name: 'Links de Pagamento', href: '/payment-links' },
      { name: 'Carrinhos Abandonados', href: '/carrinhos-abandonados' },
      { name: 'Notas Fiscais', href: '/orders/invoices' },
      { name: 'Etiquetas', href: '/orders/labels' },
    ],
  },
  {
    name: 'Offline',
    icon: ShoppingCart,
    children: [
      { name: 'Clientes', href: '/offline/customers' },
      { name: 'Vendedoras', href: '/offline/sellers' },
      { name: 'Pedidos', href: '/offline/orders' },
      { name: 'Atribuição', href: '/offline/attribution' },
    ],
  },
  {
    name: 'WhatsApp',
    icon: MessageSquare,
    children: [
      { name: 'Dashboard', href: '/whatsapp', exact: true },
      { name: 'Conexões', href: '/whatsapp/connections', exact: true },
      { name: 'Templates', href: '/whatsapp/templates', exact: true },
      { name: 'Conversas', href: '/whatsapp/conversations', exact: true },
      { name: 'Automações', href: '/whatsapp/automations', exact: true },
    ],
  },
  {
    name: 'Comunicação',
    icon: MessageSquare,
    children: [
      { name: 'Smart Lists', href: '/smart-lists', exact: true },
      { name: 'Campanhas', href: '/campaigns', exact: true },
    ],
  },
  {
    name: 'Catálogo',
    icon: Package,
    children: [
      { name: 'Links Personalizados', href: '/custom-links', exact: true },
      { name: 'Produtos', href: '/products', exact: true },
      { name: 'Composição de Produtos', href: '/compositions', exact: true },
      { name: 'Categorias', href: '/categories' },
      { name: 'Vitrine', href: '/products/showcase' },
    ],
  },
  {
    name: 'Assets',
    icon: Package,
    children: [
      { name: 'Imagens', href: '/assets', exact: true },
      { name: 'Categorias', href: '/assets/categories' },
      { name: 'Vitrine', href: '/assets/showcase' },
    ],
  },
  {
    name: 'Preços',
    icon: Tag,
    children: [
      { name: 'Canais de Venda', href: '/sales-channels' },
      { name: 'Regras de Preço', href: '/price-tables' },
      { name: 'Descontos por Qtd', href: '/tier-discounts' },
      { name: 'Cupons', href: '/coupons' },
    ],
  },
  {
    name: 'WMS',
    icon: Boxes,
    children: [
      { name: 'Fulfillment', href: '/wms/fulfillment', exact: true },
      { name: 'Entrada', href: '/wms/receipts', exact: true },
      { name: 'Estoque', href: '/wms/positions', exact: true },
      { name: 'Movimentação', href: '/wms/movements', exact: true },
    ],
  },
  {
    name: 'Páginas',
    icon: FileText,
    children: [
      { name: 'Menu', href: '/pages/menu' },
      { name: 'Páginas', href: '/pages/institutional' },
    ],
  },
  {
    name: 'Usuários',
    href: '/users',
    icon: UserCog,
  },
  {
    name: 'Configurações',
    href: '/settings',
    icon: Settings,
    adminOnly: true,
  },
]
