'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ComponentType } from 'react'
import {
  LayoutDashboard,
  ContactRound,
  MessageSquare,
  Users,
  Package,
  FileText,
  Tag,
  Link2,
  Boxes,
  Settings,
  UserCog,
  ShoppingCart,
  Store,
  LogOut as LogOutLine,
  Menu,
  Plus,
  ExternalLink,
  ChevronDown,
  CreditCard,
  GitBranch,
  Globe,
  Mail,
  Palette,
  Receipt,
  RotateCcw,
  Truck,
  Send,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import AdminThemeSelector from '@/components/admin/admin-theme-selector'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { SessionUser } from '@/lib/types'
import { logoutAction } from '@/lib/actions/auth'
import { useAdminStore } from '@/contexts/admin-store-context'
import { canAccessNavHref } from '@/lib/admin-navigation-permissions'
import { SiWhatsapp } from 'react-icons/si'

type AdminMobileHeaderProps = {
  session?: SessionUser | null
  storeName?: string
  initialOpenMenus?: string[]
}

const ADMIN_OPEN_MENUS_STORAGE_KEY = 'admin-open-menus'
const ADMIN_OPEN_MENUS_COOKIE_KEY = 'admin-open-menus'

function getStoredOpenMenus(storageKey: string) {
  if (typeof window === 'undefined') return [] as string[]

  try {
    const savedValue = window.localStorage.getItem(storageKey)
    if (!savedValue) return [] as string[]

    const parsedValue = JSON.parse(savedValue)
    if (!Array.isArray(parsedValue)) return [] as string[]

    return parsedValue.filter((value): value is string => typeof value === 'string')
  } catch {
    window.localStorage.removeItem(storageKey)
    return [] as string[]
  }
}

type MobileNavItem = {
  name: string
  href?: string
  icon?: ComponentType<{ className?: string }>
  adminOnly?: boolean
  children?: Array<{
    name: string
    href: string
    icon: ComponentType<{ className?: string }>
    adminOnly?: boolean
  }>
}

import { buildStorefrontUrl } from '@/lib/storefront-url'
const navigation: MobileNavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clientes', href: '/customers', icon: Users },
  {
    name: 'B2C',
    icon: ContactRound,
    children: [
      { name: 'Dashboard', href: '/b2c', icon: LayoutDashboard },
      { name: 'Clientes', href: '/b2c-leads', icon: Users },
      { name: 'Pedidos', href: '/b2c-orders', icon: ShoppingCart },
    ],
  },
  {
    name: 'Vendas',
    icon: ShoppingCart,
    children: [
      { name: 'Pedidos', href: '/orders', icon: ShoppingCart },
      { name: 'Links de Pagamento', href: '/payment-links', icon: Link2 },
      { name: 'Carrinhos Abandonados', href: '/carrinhos-abandonados', icon: RotateCcw },
      { name: 'Notas Fiscais', href: '/orders/invoices', icon: FileText },
      { name: 'Etiquetas', href: '/orders/labels', icon: Package },
    ],
  },
  {
    name: 'Offline',
    icon: Store,
    children: [
      { name: 'Clientes', href: '/offline/customers', icon: Users },
      { name: 'Vendedoras', href: '/offline/sellers', icon: UserCog },
      { name: 'Pedidos', href: '/offline/orders', icon: ShoppingCart },
      { name: 'Atribuição', href: '/offline/attribution', icon: GitBranch },
    ],
  },
  {
    name: 'WhatsApp',
    icon: SiWhatsapp,
    children: [
      { name: 'Dashboard', href: '/whatsapp', icon: LayoutDashboard },
      { name: 'Conexões', href: '/whatsapp/connections', icon: Link2 },
      { name: 'Templates', href: '/whatsapp/templates', icon: FileText },
      { name: 'Conversas', href: '/whatsapp/conversations', icon: MessageSquare },
      { name: 'Automações', href: '/whatsapp/automations', icon: Zap },
    ],
  },
  {
    name: 'Comunicação',
    icon: Send,
    children: [
      { name: 'Smart Lists', href: '/smart-lists', icon: MessageSquare },
      { name: 'Campanhas', href: '/campaigns', icon: MessageSquare },
    ],
  },
  {
    name: 'Catálogo',
    icon: Package,
    children: [
      { name: 'Links Personalizados', href: '/custom-links', icon: Link2 },
      { name: 'Produtos', href: '/products', icon: Package },
      { name: 'Composição de Produtos', href: '/compositions', icon: Package },
      { name: 'Categorias', href: '/categories', icon: Package },
      { name: 'Vitrine', href: '/products/showcase', icon: Package },
    ],
  },
  {
    name: 'Assets',
    icon: Boxes,
    children: [
      { name: 'Imagens', href: '/assets', icon: Boxes },
      { name: 'Categorias', href: '/assets/categories', icon: Boxes },
      { name: 'Vitrine', href: '/assets/showcase', icon: Store },
    ],
  },
  {
    name: 'Preços',
    icon: Tag,
    children: [
      { name: 'Canais de Venda', href: '/sales-channels', icon: Tag },
      { name: 'Regras de Preço', href: '/price-tables', icon: Tag },
      { name: 'Descontos por Qtd', href: '/tier-discounts', icon: Tag },
      { name: 'Cupons', href: '/coupons', icon: Tag },
    ],
  },
  {
    name: 'WMS',
    icon: Boxes,
    children: [
      { name: 'Fulfillment', href: '/wms/fulfillment', icon: Boxes },
      { name: 'Entrada', href: '/wms/receipts', icon: Boxes },
      { name: 'Estoque', href: '/wms/positions', icon: Boxes },
      { name: 'Movimentação', href: '/wms/movements', icon: Boxes },
    ],
  },
  {
    name: 'Páginas',
    icon: FileText,
    children: [
      { name: 'Menu', href: '/pages/menu', icon: FileText },
      { name: 'Páginas', href: '/pages/institutional', icon: FileText },
    ],
  },
  { name: 'Usuários', href: '/users', icon: UserCog },
  {
    name: 'Configurações',
    icon: Settings,
    adminOnly: true,
    children: [
      { name: 'Geral', href: '/settings/general', icon: Store },
      { name: 'Filiais', href: '/settings/branches', icon: GitBranch },
      { name: 'Permissões', href: '/settings/permissions', icon: UserCog },
      { name: 'B2B', href: '/settings/b2b', icon: Users },
      { name: 'B2C', href: '/settings/b2c', icon: ContactRound },
      { name: 'Aparência', href: '/settings/appearance', icon: Palette },
      { name: 'Pagamentos', href: '/settings/payments', icon: CreditCard },
      { name: 'Estoque', href: '/settings/stock', icon: Boxes },
      { name: 'Armazéns', href: '/settings/stock-warehouses', icon: Store },
      { name: 'Localizações', href: '/settings/stock-locations', icon: GitBranch },
      { name: 'Frete', href: '/settings/shipping', icon: Truck },
      { name: 'Marketing', href: '/settings/marketing', icon: MessageSquare },
      { name: 'E-mails', href: '/settings/emails', icon: Mail },
      { name: 'ERP', href: '/settings/erp', icon: Link2 },
      { name: 'Webhooks', href: '/settings/integrations', icon: Link2 },
      { name: 'Fiscal', href: '/settings/fiscal', icon: Receipt },
      { name: 'Domínio', href: '/settings/domain', icon: Globe },
      { name: 'Billing', href: '/settings/billing', icon: Receipt },
    ],
  },
]

export default function AdminMobileHeader({ session, storeName, initialOpenMenus = [] }: AdminMobileHeaderProps) {
  const adminStore = useAdminStore()
  const pathname = usePathname()
  const effectiveSession = session ?? adminStore.session
  const effectiveStoreName = storeName?.trim() || 'Nome da loja'
  const storefrontUrl = adminStore.storefrontUrl || (effectiveSession?.storeId ? `/${effectiveSession.storeId}` : '/')
  const [adminLocale, setAdminLocale] = useState('en')
  const [openMenus, setOpenMenus] = useState<string[]>(initialOpenMenus)
  const permissionCodes = effectiveSession?.permissionCodes
  const navAccessOptions = { isSystemRole: effectiveSession?.isSystemRole === true }
  const canCreateOrder = Array.isArray(permissionCodes)
    && permissionCodes
      .map((code) => String(code || '').trim().toLowerCase())
      .includes('orders.create')

  const localeOptions = [
    { value: 'en', label: 'English' },
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'es', label: 'Español' },
    { value: 'ko', label: '한국어' },
    { value: 'zh', label: '中文' },
  ]

  useEffect(() => {
    if (typeof document === 'undefined') return
    const cookieValue = document.cookie
      .split('; ')
      .find((part) => part.startsWith('ADMIN_LOCALE='))
      ?.split('=')[1]

    if (!cookieValue) return

    const normalized = decodeURIComponent(cookieValue)
    if (localeOptions.some((option) => option.value === normalized)) {
      setAdminLocale(normalized)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedOpenMenus = getStoredOpenMenus(ADMIN_OPEN_MENUS_STORAGE_KEY)
    if (storedOpenMenus.length > 0 || initialOpenMenus.length === 0) {
      setOpenMenus(storedOpenMenus)
    }
  }, [initialOpenMenus])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    window.localStorage.setItem(ADMIN_OPEN_MENUS_STORAGE_KEY, JSON.stringify(openMenus))
    document.cookie = `${ADMIN_OPEN_MENUS_COOKIE_KEY}=${encodeURIComponent(JSON.stringify(openMenus))}; path=/; max-age=31536000; samesite=lax`
  }, [openMenus])
  const storefrontEntryUrl = adminStore.store?.maintenanceMode
    ? buildStorefrontUrl(storefrontUrl, '/private')
    : storefrontUrl

  function handleLocaleChange(nextLocale: string) {
    setAdminLocale(nextLocale)
    if (typeof document !== 'undefined') {
      document.cookie = `ADMIN_LOCALE=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`
      window.location.reload()
    }
  }

  const isRouteActive = (href: string) => {
    const isOrdersInvoicesPath =
      pathname === '/orders/invoices' || pathname.startsWith('/orders/invoices/')
    const isOrdersLabelsPath =
      pathname === '/orders/labels' || pathname.startsWith('/orders/labels/')

    if (href === '/orders') {
      return (
        pathname === '/orders' ||
        (pathname.startsWith('/orders/') && !isOrdersInvoicesPath && !isOrdersLabelsPath)
      )
    }

    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const toggleMenu = (name: string) => {
    setOpenMenus((current) => (
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
    ))
  }

  if (pathname === '/login' || pathname === '/orders/new') return null

  return (
    <>
      <div className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/50 bg-card px-3">
        <div className="flex items-center gap-2 min-w-0">
          <Image
            src="/app-icon.svg"
            alt=""
            width={28}
            height={28}
            unoptimized
            className="h-7 w-7 rounded-md object-contain shrink-0"
          />
          <span className="block truncate whitespace-nowrap text-sm font-semibold">
            {effectiveStoreName}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {canCreateOrder ? (
            <Link href="/orders/new" aria-label="Novo pedido">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          ) : null}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          <SheetContent side="left" className="w-[86vw] max-w-80 p-0">
            <SheetHeader className="border-b px-4 py-4">
              <SheetTitle className="text-left truncate">{effectiveStoreName}</SheetTitle>
            </SheetHeader>

            <div className="px-4 pt-4 pb-3">
              <Link
                href={storefrontUrl}
                target="_blank"
                className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-muted/40 px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                <Store className="h-4 w-4" />
                Ver Vitrine
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <nav className="max-h-[calc(100vh-220px)] overflow-y-auto px-2 pb-3">
              <ul className="space-y-1">
                {navigation
                  .filter((item) => !(item.adminOnly && effectiveSession?.role !== 'ADMIN'))
                  .filter((item) => !item.href || canAccessNavHref(item.href, permissionCodes, navAccessOptions))
                  .map((item) => {
                    if (item.children?.length) {
                      const visibleChildren = item.children
                        .filter((child) => !(child.adminOnly && effectiveSession?.role !== 'ADMIN'))
                        .filter((child) => canAccessNavHref(child.href, permissionCodes, navAccessOptions))

                      if (visibleChildren.length === 0) {
                        return null
                      }

                      return (
                        <li key={item.name} className="space-y-1">
                          <Collapsible
                            open={openMenus.includes(item.name)}
                            onOpenChange={() => toggleMenu(item.name)}
                          >
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted/80"
                              >
                                {item.icon ? <item.icon className="h-4 w-4" /> : null}
                                <span>{item.name}</span>
                                <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${openMenus.includes(item.name) ? 'rotate-180' : ''}`} />
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <ul className="space-y-1 pl-2 pt-1">
                                {visibleChildren.map((child) => (
                                    <li key={child.href}>
                                      <SheetClose asChild>
                                        <Link
                                          href={child.href}
                                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                                            isRouteActive(child.href)
                                              ? 'bg-primary/10 text-primary'
                                              : 'text-foreground hover:bg-muted/80'
                                          }`}
                                        >
                                          <child.icon className="h-4 w-4" />
                                          {child.name}
                                        </Link>
                                      </SheetClose>
                                    </li>
                                  ))}
                              </ul>
                            </CollapsibleContent>
                          </Collapsible>
                        </li>
                      )
                    }

                    if (!item.href || !item.icon) return null

                    return (
                      <li key={item.href}>
                        <SheetClose asChild>
                          <Link
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                              isRouteActive(item.href)
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground hover:bg-muted/80'
                            }`}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                          </Link>
                        </SheetClose>
                      </li>
                    )
                  })}
              </ul>
            </nav>

            {effectiveSession && (
              <div className="mt-auto border-t border-border/50 p-4 space-y-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">{effectiveSession.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{effectiveSession.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">Idioma</p>
                  <select
                    value={adminLocale}
                    onChange={(event) => handleLocaleChange(event.target.value)}
                    className="h-9 w-full rounded-md border border-border/60 bg-background px-2 text-[13px]"
                    aria-label="Selecionar idioma"
                  >
                    {localeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <AdminThemeSelector compact />
                <form action={logoutAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    className="w-full justify-start gap-2 text-[13px] font-normal text-muted-foreground"
                  >
                    <LogOutLine className="h-4 w-4" />
                    Sair
                  </Button>
                </form>
              </div>
            )}
          </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  )
}
