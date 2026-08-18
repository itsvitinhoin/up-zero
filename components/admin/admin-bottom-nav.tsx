'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  MoreHorizontal,
  MessageSquare,
  Tag,
  Settings,
  UserCog,
  Store,
  ExternalLink,
  LogOut as LogOutIcon,
  LayoutGrid,
  GitBranch,
  ListFilter,
  Send,
  RotateCcw,
  ContactRound,
  CreditCard,
  FileText,
  Link2,
  Boxes,
  Receipt,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import AdminThemeSelector from '@/components/admin/admin-theme-selector'
import type { SessionUser } from '@/lib/types'
import { logoutAction } from '@/lib/actions/auth'
import { useState, useEffect } from 'react'
import { getStorefrontHref } from '@/lib/storefront-url'
import { SiWhatsapp } from 'react-icons/si'

type AdminBottomNavProps = {
  session?: SessionUser | null
  storeName?: string
}

const PRIMARY_NAV = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Pedidos', href: '/orders', icon: ShoppingCart },
  { name: 'Clientes', href: '/customers', icon: Users },
  { name: 'Produtos', href: '/products', icon: Package },
]

const MORE_NAV = [
  { name: 'Dashboard B2C', href: '/b2c', icon: ContactRound },
  { name: 'Clientes B2C', href: '/b2c-leads', icon: Users },
  { name: 'Pedidos B2C', href: '/b2c-orders', icon: ShoppingCart },
  { name: 'Links de pagamento', href: '/payment-links', icon: Link2 },
  { name: 'WhatsApp', href: '/whatsapp', icon: SiWhatsapp },
  { name: 'Carrinhos abandonados', href: '/carrinhos-abandonados', icon: RotateCcw },
  { name: 'Notas fiscais', href: '/orders/invoices', icon: Receipt },
  { name: 'Etiquetas', href: '/orders/labels', icon: Tag },
  { name: 'Clientes offline', href: '/offline/customers', icon: Users },
  { name: 'Vendedoras offline', href: '/offline/sellers', icon: UserCog },
  { name: 'Pedidos offline', href: '/offline/orders', icon: ShoppingCart },
  { name: 'Atribuição offline', href: '/offline/attribution', icon: GitBranch },
  { name: 'Smart Lists', href: '/smart-lists', icon: ListFilter },
  { name: 'Campanhas', href: '/campaigns', icon: Send },
  { name: 'Composição de produtos', href: '/compositions', icon: Boxes },
  { name: 'Categorias', href: '/categories', icon: LayoutGrid },
  { name: 'Vitrine de assets', href: '/assets/showcase', icon: Store },
  { name: 'Cupons', href: '/coupons', icon: Tag },
  { name: 'Regras de Preço', href: '/price-tables', icon: Tag },
  { name: 'Descontos por Qtd', href: '/tier-discounts', icon: Tag },
  { name: 'WMS · Fulfillment', href: '/wms/fulfillment', icon: ShoppingCart },
  { name: 'WMS · Entrada', href: '/wms/receipts', icon: Package },
  { name: 'WMS · Estoque', href: '/wms/positions', icon: Boxes },
  { name: 'WMS · Movimentação', href: '/wms/movements', icon: Truck },
  { name: 'Menu da vitrine', href: '/pages/menu', icon: FileText },
  { name: 'Páginas institucionais', href: '/pages/institutional', icon: FileText },
  { name: 'Filiais', href: '/branches', icon: GitBranch, adminOnly: true },
  { name: 'Usuários', href: '/users', icon: UserCog, adminOnly: true },
  { name: 'Configurações gerais', href: '/settings/general', icon: Settings, adminOnly: true },
  { name: 'Permissões', href: '/settings/permissions', icon: UserCog, adminOnly: true },
  { name: 'Configurações B2B', href: '/settings/b2b', icon: Users, adminOnly: true },
  { name: 'Configurações B2C', href: '/settings/b2c', icon: ContactRound, adminOnly: true },
  { name: 'Aparência', href: '/settings/appearance', icon: Store, adminOnly: true },
  { name: 'Pagamentos', href: '/settings/payments', icon: CreditCard, adminOnly: true },
  { name: 'Estoque', href: '/settings/stock', icon: Boxes, adminOnly: true },
  { name: 'Armazéns', href: '/settings/stock-warehouses', icon: Store, adminOnly: true },
  { name: 'Localizações de estoque', href: '/settings/stock-locations', icon: GitBranch, adminOnly: true },
  { name: 'Frete', href: '/settings/shipping', icon: Truck, adminOnly: true },
  { name: 'Marketing', href: '/settings/marketing', icon: MessageSquare, adminOnly: true },
  { name: 'E-mails', href: '/settings/emails', icon: MessageSquare, adminOnly: true },
  { name: 'ERP', href: '/settings/erp', icon: Link2, adminOnly: true },
  { name: 'Webhooks', href: '/settings/integrations', icon: Link2, adminOnly: true },
  { name: 'Fiscal', href: '/settings/fiscal', icon: Receipt, adminOnly: true },
  { name: 'Domínio', href: '/settings/domain', icon: Store, adminOnly: true },
  { name: 'Billing', href: '/settings/billing', icon: Receipt, adminOnly: true },
]

const localeOptions = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'es', label: 'Español' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
]

export default function AdminBottomNav({ session, storeName }: AdminBottomNavProps) {
  const pathname = usePathname()
  const [adminLocale, setAdminLocale] = useState('en')

  useEffect(() => {
    if (typeof document === 'undefined') return
    const cookieValue = document.cookie
      .split('; ')
      .find((part) => part.startsWith('ADMIN_LOCALE='))
      ?.split('=')[1]
    if (!cookieValue) return
    const normalized = decodeURIComponent(cookieValue)
    if (localeOptions.some((o) => o.value === normalized)) setAdminLocale(normalized)
  }, [])

  function handleLocaleChange(nextLocale: string) {
    setAdminLocale(nextLocale)
    if (typeof document !== 'undefined') {
      document.cookie = `ADMIN_LOCALE=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`
      window.location.reload()
    }
  }

  if (pathname === '/login') return null

  const isAnyMoreActive = MORE_NAV.some((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  )

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-20">
        {PRIMARY_NAV.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl transition-colors', isActive && 'bg-primary/10')}>
                <Icon className="h-6 w-6" />
              </div>
              <span className={cn('text-[11px] font-medium leading-none', isActive ? 'text-primary' : 'text-muted-foreground/80')}>
                {item.name}
              </span>
            </Link>
          )
        })}

        {/* Mais — opens drawer */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors',
                isAnyMoreActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl transition-colors', isAnyMoreActive && 'bg-primary/10')}>
                <MoreHorizontal className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-medium leading-none text-muted-foreground/80">
                Mais
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[28px] px-0 pb-0 max-h-[85vh]">
            <SheetHeader className="px-5 pb-3 pt-5">
              <SheetTitle className="text-left text-base">{storeName || 'Menu'}</SheetTitle>
            </SheetHeader>

            {/* Ver Vitrine */}
            <div className="px-4 pb-3">
              <Link
                href={getStorefrontHref(session?.storeId)}
                target="_blank"
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/50 px-4 py-3 text-[13px] font-medium transition-colors hover:bg-muted/80"
              >
                <Store className="h-4 w-4" />
                Ver Vitrine
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {/* Nav items */}
            <div className="max-h-[calc(85vh-260px)] overflow-y-auto px-3">
              <ul className="space-y-1 pb-2">
                {MORE_NAV.filter((item) => !(item.adminOnly && session?.role !== 'ADMIN')).map((item) => {
                  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                  return (
                    <li key={item.href}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-3 text-[13px] font-medium transition-colors',
                            isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/80'
                          )}
                        >
                          <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                          {item.name}
                          {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
                        </Link>
                      </SheetClose>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* User & utilities */}
            {session && (
              <div className="border-t border-border/50 px-5 py-4 space-y-3">
                <div>
                  <p className="text-[13px] font-medium truncate">{session.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{session.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={adminLocale}
                    onChange={(e) => handleLocaleChange(e.target.value)}
                    className="h-9 flex-1 rounded-xl border border-border/60 bg-background px-2 text-[13px]"
                    aria-label="Selecionar idioma"
                  >
                    {localeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <AdminThemeSelector compact />
                  <form action={logoutAction}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-[13px] text-muted-foreground"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      Sair
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
