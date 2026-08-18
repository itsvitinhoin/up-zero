'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, type ElementType } from 'react'
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  ContactRound,
  CreditCard,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Languages,
  LayoutDashboard,
  Link2,
  ListFilter,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Moon,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  Tag,
  Truck,
  UserCog,
  Users,
  Zap,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { SiWhatsapp } from 'react-icons/si'

import { AdminBranchSelector } from '@/components/admin/admin-branch-selector'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAdminStore } from '@/contexts/admin-store-context'
import { logoutAction } from '@/lib/actions/auth'
import { canAccessNavHref } from '@/lib/admin-navigation-permissions'
import { getStorefrontHref } from '@/lib/storefront-url'
import type { SessionUser } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  exact?: boolean
  icon?: ElementType
  children?: Array<{
    name: string
    anchor?: string
    href?: string
  }>
}

interface NavSection {
  id: string
  icon: ElementType
  label: string
  href?: string
  items?: NavItem[]
  adminOnly?: boolean
}

interface NavGroup {
  heading: string
  sectionIds: string[]
}

const navSections: NavSection[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { id: 'clientes', icon: Users, label: 'Clientes', href: '/customers' },
  {
    id: 'b2c',
    icon: ContactRound,
    label: 'B2C',
    items: [
      { name: 'Dashboard', href: '/b2c', exact: true, icon: LayoutDashboard },
      { name: 'Clientes', href: '/b2c-leads', exact: true, icon: Users },
      { name: 'Pedidos', href: '/b2c-orders', exact: true, icon: ShoppingCart },
    ],
  },
  {
    id: 'pedidos',
    icon: ShoppingCart,
    label: 'Pedidos',
    items: [
      { name: 'Lista de pedidos', href: '/orders', exact: true, icon: ShoppingCart },
      { name: 'Links de pagamento', href: '/payment-links', icon: Link2 },
      { name: 'Carrinhos abandonados', href: '/carrinhos-abandonados', icon: RotateCcw },
      { name: 'Notas fiscais', href: '/orders/invoices', icon: Receipt },
      { name: 'Etiquetas', href: '/orders/labels', icon: Tag },
    ],
  },
  {
    id: 'offline',
    icon: Store,
    label: 'Offline',
    items: [
      { name: 'Clientes', href: '/offline/customers', icon: Users },
      { name: 'Vendedoras', href: '/offline/sellers', icon: UserCog },
      { name: 'Pedidos', href: '/offline/orders', icon: ShoppingCart },
      { name: 'Atribuição', href: '/offline/attribution', icon: GitBranch },
    ],
  },
  {
    id: 'comunicacao',
    icon: MessageSquare,
    label: 'Comunicação',
    items: [
      { name: 'Links personalizados', href: '/custom-links', icon: Link2 },
      { name: 'Smart Lists', href: '/smart-lists', icon: ListFilter },
      { name: 'Campanhas', href: '/campaigns', icon: Send },
    ],
  },
  {
    id: 'whatsapp',
    icon: SiWhatsapp,
    label: 'WhatsApp',
    items: [
      { name: 'Dashboard', href: '/whatsapp', exact: true, icon: LayoutDashboard },
      { name: 'Conexões', href: '/whatsapp/connections', icon: Link2 },
      { name: 'Templates', href: '/whatsapp/templates', icon: FileText },
      { name: 'Conversas', href: '/whatsapp/conversations', icon: MessageSquare },
      { name: 'Automações', href: '/whatsapp/automations', icon: Zap },
    ],
  },
  {
    id: 'catalogo',
    icon: Package,
    label: 'Catálogo',
    items: [
      { name: 'Produtos', href: '/products', exact: true, icon: Package },
      { name: 'Composição de produtos', href: '/compositions', icon: Boxes },
      { name: 'Categorias', href: '/categories', icon: Tag },
      { name: 'Vitrine', href: '/products/showcase', icon: Store },
    ],
  },
  {
    id: 'assets',
    icon: Boxes,
    label: 'Assets',
    items: [
      { name: 'Imagens', href: '/assets', exact: true, icon: Boxes },
      { name: 'Categorias', href: '/assets/categories', icon: Tag },
      { name: 'Vitrine', href: '/assets/showcase', icon: Store },
    ],
  },
  {
    id: 'wms',
    icon: Boxes,
    label: 'WMS',
    items: [
      { name: 'Fulfillment', href: '/wms/fulfillment', icon: ShoppingCart },
      { name: 'Entrada', href: '/wms/receipts', icon: Package },
      { name: 'Estoque', href: '/wms/positions', icon: Boxes },
      { name: 'Movimentação', href: '/wms/movements', icon: Truck },
    ],
  },
  {
    id: 'precos',
    icon: Tag,
    label: 'Preços',
    items: [
      { name: 'Canais de venda', href: '/sales-channels', icon: Globe },
      { name: 'Regras de preço', href: '/price-tables', icon: Tag },
      { name: 'Descontos por quantidade', href: '/tier-discounts', icon: Tag },
      { name: 'Cupons', href: '/coupons', icon: Receipt },
    ],
  },
  {
    id: 'paginas',
    icon: FileText,
    label: 'Páginas',
    items: [
      { name: 'Menu', href: '/pages/menu', icon: FileText },
      { name: 'Institucionais', href: '/pages/institutional', icon: FileText },
    ],
  },
  {
    id: 'admin',
    icon: UserCog,
    label: 'Administração',
    adminOnly: true,
    items: [
      { name: 'Filiais', href: '/branches', icon: GitBranch },
      { name: 'Usuários', href: '/users', icon: UserCog },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Configurações',
    items: [
      {
        name: 'Geral',
        href: '/settings/general',
        icon: Store,
        children: [
          { name: 'Dados da Loja', anchor: 'store-data' },
          { name: 'Meta (SEO)', anchor: 'store-meta' },
          { name: 'Redes Sociais', anchor: 'store-social' },
          { name: 'Permissões', href: '/settings/permissions' },
        ],
      },
      { name: 'Filiais', href: '/settings/branches', icon: GitBranch },
      {
        name: 'B2B',
        href: '/settings/b2b',
        icon: Users,
        children: [
          { name: 'Regras B2B', anchor: 'b2b-rules' },
          { name: 'Formulário de Cadastro', anchor: 'registration-form' },
          { name: 'Aprovação Automática', anchor: 'auto-approval' },
          { name: 'Roleta de Vendedoras', anchor: 'seller-assignment' },
          { name: 'Visibilidade de Preços', anchor: 'price-visibility' },
        ],
      },
      {
        name: 'B2C',
        href: '/settings/b2c',
        icon: ContactRound,
        children: [
          { name: 'Distribuição', anchor: 'distribution-mode' },
          { name: 'Listas de Revendedores', anchor: 'reseller-lists' },
          { name: 'Regras da Roleta', anchor: 'wheel-rules' },
        ],
      },
      {
        name: 'Aparência',
        href: '/settings/appearance',
        icon: Palette,
        children: [
          { name: 'Menu', anchor: 'menu' },
          { name: 'Produtos', anchor: 'product-custom-fields' },
          { name: 'Barra de Anúncio', anchor: 'announcement-bar' },
          { name: 'Popup', anchor: 'popup' },
          { name: 'Banner Principal', anchor: 'main-banner' },
          { name: 'Mini Banners', anchor: 'mini-banners' },
          { name: 'Banners de Categoria', anchor: 'category-banners' },
          { name: 'Banners Informativos', anchor: 'info-banners' },
          { name: 'Categorias da Home', anchor: 'home-categories' },
          { name: 'Cores do Site', anchor: 'site-colors' },
          { name: 'Vitrine', anchor: 'site-storefront' },
          { name: 'Login', anchor: 'login' },
          { name: 'Fontes', anchor: 'site-typography' },
          { name: 'Logo e Favicon', anchor: 'logo-favicon' },
        ],
      },
      {
        name: 'Pagamentos',
        href: '/settings/payments',
        icon: CreditCard,
        children: [
          { name: 'Modo de Pagamento', anchor: 'payment-mode' },
          { name: 'Métodos Aceitos', anchor: 'payment-methods' },
          { name: 'Pagamentos Manuais', anchor: 'manual-payments' },
          { name: 'Condições por Método', anchor: 'payment-conditions' },
        ],
      },
      {
        name: 'Estoque',
        href: '/settings/stock',
        icon: Boxes,
        children: [
          { name: 'Modo de Estoque', anchor: 'stock-mode' },
          { name: 'Armazéns', href: '/settings/stock-warehouses' },
          { name: 'Localizações', href: '/settings/stock-locations' },
        ],
      },
      {
        name: 'Frete',
        href: '/settings/shipping',
        icon: Truck,
        children: [
          { name: 'Resumo dos Métodos', anchor: 'shipping-summary' },
          { name: 'Embalagem Padrão', anchor: 'default-packaging' },
          { name: 'Configurações Gerais', anchor: 'shipping-general' },
          { name: 'Ofertas por Região', anchor: 'shipping-regions' },
          { name: 'Integração Correios', anchor: 'correios-integration' },
          { name: 'Métodos Personalizados', anchor: 'custom-shipping' },
        ],
      },
      {
        name: 'Marketing',
        href: '/settings/marketing',
        icon: Megaphone,
        children: [
          { name: 'Marketing e Rastreamento', anchor: 'marketing-tracking' },
          { name: 'Ferramentas de Análise', anchor: 'analytics-tools' },
        ],
      },
      {
        name: 'E-mails',
        href: '/settings/emails',
        icon: Mail,
        children: [
          { name: 'Identidade do remetente', anchor: 'email-identity' },
          { name: 'Modelos transacionais', anchor: 'email-templates' },
        ],
      },
      {
        name: 'Integrações',
        href: '/settings/erp',
        icon: Link2,
        children: [
          { name: 'ERP', href: '/settings/erp' },
          { name: 'Webhooks', href: '/settings/integrations' },
        ],
      },
      {
        name: 'Fiscal',
        href: '/settings/fiscal',
        icon: Receipt,
        children: [
          { name: 'Emissores', anchor: 'emitters' },
          { name: 'Naturezas de operação', anchor: 'operation-natures' },
        ],
      },
      { name: 'Domínio', href: '/settings/domain', icon: Globe },
      { name: 'Billing', href: '/settings/billing', icon: Receipt },
    ],
  },
]

const navGroups: NavGroup[] = [
  { heading: 'Principal', sectionIds: ['dashboard', 'clientes', 'b2c'] },
  { heading: 'Operação', sectionIds: ['pedidos', 'offline', 'comunicacao', 'whatsapp', 'catalogo', 'assets', 'precos', 'wms', 'paginas'] },
  { heading: 'Gestão', sectionIds: ['admin', 'settings'] },
]

const localeOptions = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'es', label: 'Español' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
]

function getSectionForPathname(pathname: string): string {
  if (pathname === '/') return 'dashboard'
  if (pathname.startsWith('/customers')) return 'clientes'
  if (pathname === '/b2c' || pathname.startsWith('/b2c-leads') || pathname.startsWith('/b2c-orders')) return 'b2c'
  if (
    pathname.startsWith('/orders') ||
    pathname.startsWith('/payment-links') ||
    pathname.startsWith('/carrinhos-abandonados')
  ) return 'pedidos'
  if (pathname.startsWith('/offline')) return 'offline'
  if (pathname.startsWith('/whatsapp')) return 'whatsapp'
  if (
    pathname.startsWith('/custom-links') ||
    pathname.startsWith('/smart-lists') ||
    pathname.startsWith('/campaigns')
  ) return 'comunicacao'
  if (
    pathname.startsWith('/products') ||
    pathname.startsWith('/categories') ||
    pathname.startsWith('/compositions')
  ) return 'catalogo'
  if (pathname.startsWith('/assets')) return 'assets'
  if (
    pathname.startsWith('/sales-channels') ||
    pathname.startsWith('/price-tables') ||
    pathname.startsWith('/tier-discounts') ||
    pathname.startsWith('/coupons')
  ) return 'precos'
  if (pathname.startsWith('/wms')) return 'wms'
  if (pathname.startsWith('/pages')) return 'paginas'
  if (pathname.startsWith('/branches') || pathname.startsWith('/users')) return 'admin'
  if (pathname.startsWith('/settings')) return 'settings'
  return 'dashboard'
}

function isItemActive(pathname: string, href: string, exact?: boolean): boolean {
  if (href === '/') return pathname === '/'
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

interface AdminSidebarProps {
  session?: SessionUser | null
  storeName?: string
  initialOpenMenus?: string[]
  initialCollapsed?: boolean
}

export function AdminSidebar({ session, storeName }: AdminSidebarProps) {
  const adminStore = useAdminStore()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const effectiveSession = session ?? adminStore.session
  const effectiveStoreName = storeName ?? adminStore.store?.name ?? 'Nome da Marca'
  const activeSection = getSectionForPathname(pathname)
  const isDark = theme === 'dark'
  const isSandbox = effectiveSession?.storeId === 1043

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [adminLocale, setAdminLocale] = useState('en')
  const [activeHash, setActiveHash] = useState('')
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set([activeSection]),
  )

  useEffect(() => {
    setOpenSections(current => {
      const next = new Set(current)
      next.add(activeSection)
      return next
    })
  }, [activeSection])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const cookieValue = document.cookie
      .split('; ')
      .find(part => part.startsWith('ADMIN_LOCALE='))
      ?.split('=')[1]
    if (!cookieValue) return
    const normalized = decodeURIComponent(cookieValue)
    if (localeOptions.some(option => option.value === normalized)) setAdminLocale(normalized)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateActiveHash = () => setActiveHash(window.location.hash.slice(1))
    updateActiveHash()
    window.addEventListener('hashchange', updateActiveHash)
    return () => window.removeEventListener('hashchange', updateActiveHash)
  }, [pathname])

  const allowedSections = useMemo(
    () => navSections
      .filter(section => !(section.adminOnly && effectiveSession?.role !== 'ADMIN'))
      .map(section => ({
        ...section,
        items: section.items
          ?.filter(item => canAccessNavHref(
            item.href,
            effectiveSession?.permissionCodes,
            { isSystemRole: effectiveSession?.isSystemRole === true },
          ))
          .map(item => ({
            ...item,
            children: item.children?.filter(child => (
              !child.href || canAccessNavHref(
                child.href,
                effectiveSession?.permissionCodes,
                { isSystemRole: effectiveSession?.isSystemRole === true },
              )
            )),
          })),
      }))
      .filter(section => (
        section.items
          ? section.items.length > 0
          : !section.href || canAccessNavHref(
            section.href,
            effectiveSession?.permissionCodes,
            { isSystemRole: effectiveSession?.isSystemRole === true },
          )
      )),
    [effectiveSession?.isSystemRole, effectiveSession?.permissionCodes, effectiveSession?.role],
  )

  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const visibleGroups = useMemo(() => navGroups.map(group => ({
    ...group,
    sections: group.sectionIds
      .map(id => allowedSections.find(section => section.id === id))
      .filter((section): section is NavSection => Boolean(section))
      .map(section => {
        if (!normalizedSearch) return section
        const sectionMatches = section.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
        const matchingItems = section.items
          ?.map(item => {
            const itemMatches = item.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
            const matchingChildren = item.children?.filter(child =>
              child.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch),
            )
            if (!itemMatches && (!matchingChildren || matchingChildren.length === 0)) return null
            return itemMatches ? item : { ...item, children: matchingChildren }
          })
          .filter((item): item is NavItem => Boolean(item))
        if (!sectionMatches && (!matchingItems || matchingItems.length === 0)) return null
        return sectionMatches ? section : { ...section, items: matchingItems }
      })
      .filter((section): section is NavSection => Boolean(section)),
  })).filter(group => group.sections.length > 0), [allowedSections, normalizedSearch])

  if (pathname === '/login') return null

  const userInitial = String(effectiveSession?.name || 'A').trim().charAt(0).toUpperCase()

  function toggleSection(sectionId: string) {
    if (isCollapsed) setIsCollapsed(false)
    setOpenSections(current => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  function handleLocaleChange(nextLocale: string) {
    setAdminLocale(nextLocale)
    if (typeof document !== 'undefined') {
      document.cookie = `ADMIN_LOCALE=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`
      window.location.reload()
    }
  }

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-border/50 bg-card/95 font-sans backdrop-blur transition-[width] duration-300 ease-in-out',
        isCollapsed ? 'w-[68px]' : 'w-[260px]',
      )}
    >
      <div className="flex h-[72px] shrink-0 items-center gap-2 border-b border-border/40 p-3">
        {isCollapsed ? (
          <Link
            href="/"
            aria-label={effectiveStoreName}
            className="mx-auto flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg shadow-sm"
          >
            <Image
              src="/app-icon.svg"
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-9 w-9 object-cover"
            />
          </Link>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md shadow-sm">
                  <Image
                    src="/app-icon.svg"
                    alt=""
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-none text-foreground">
                    {effectiveStoreName}
                  </span>
                  <span className="mt-1 block truncate text-[11px] leading-none text-muted-foreground">
                    {isSandbox ? 'Ambiente Sandbox' : 'Painel administrativo'}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground/70" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-xs font-medium">{effectiveStoreName}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {isSandbox ? 'Isolada da produção' : 'Loja ativa'}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={getStorefrontHref(effectiveSession?.storeId)} target="_blank">
                  <Store className="h-4 w-4" />
                  <span>Ver Vitrine</span>
                  <ExternalLink className="ml-auto h-3.5 w-3.5" />
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Recolher menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="shrink-0 space-y-3 px-3 pb-2 pt-3">
          <label className="flex h-9 items-center gap-2 rounded-md border border-border/50 bg-background/60 px-2.5 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={1.5} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar no menu..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/50"
            />
          </label>
          <AdminBranchSelector />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-1">
          {visibleGroups.map(group => (
            <div key={group.heading} className="space-y-0.5">
              {group.sections.map(section => {
                const Icon = section.icon
                const sectionActive = activeSection === section.id
                const hasChildren = Boolean(section.items?.length)
                const sectionOpen = normalizedSearch.length > 0 || openSections.has(section.id)
                const commonClassName = cn(
                  'group flex w-full items-center rounded-md transition-colors duration-200',
                  isCollapsed ? 'h-10 justify-center px-0' : 'min-h-9 justify-between px-2.5 py-[7px]',
                  sectionActive
                    ? 'bg-black/5 font-medium text-foreground dark:bg-white/10'
                    : 'text-muted-foreground hover:bg-black/5 hover:text-foreground/90 dark:hover:bg-white/5',
                )

                if (!hasChildren && section.href) {
                  return (
                    <Link
                      key={section.id}
                      href={section.href}
                      title={isCollapsed ? section.label : undefined}
                      className={commonClassName}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        {!isCollapsed && <span className="truncate text-[13px] tracking-wide">{section.label}</span>}
                      </span>
                    </Link>
                  )
                }

                return (
                  <div key={section.id} className="space-y-0.5">
                    <button
                      type="button"
                      title={isCollapsed ? section.label : undefined}
                      aria-expanded={sectionOpen}
                      onClick={() => toggleSection(section.id)}
                      className={commonClassName}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        {!isCollapsed && <span className="truncate text-[13px] tracking-wide">{section.label}</span>}
                      </span>
                      {!isCollapsed && (
                        <ChevronRight
                          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200', sectionOpen && 'rotate-90')}
                          strokeWidth={2}
                        />
                      )}
                    </button>

                    {!isCollapsed && hasChildren && (
                      <div
                        className={cn(
                          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
                          sectionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                        )}
                      >
                        <div className="relative min-h-0 overflow-hidden pl-5">
                          <span className="absolute bottom-1 left-[17px] top-1 border-l border-black/5 dark:border-white/10" />
                          <div className="space-y-0.5">
                            {section.items?.map(item => {
                              const ItemIcon = item.icon
                              const active = isItemActive(pathname, item.href, item.exact)
                                || Boolean(item.children?.some(child => (
                                  child.href ? isItemActive(pathname, child.href) : false
                                )))
                              return (
                                <div key={item.href}>
                                  <Link
                                    href={item.href}
                                    className={cn(
                                      'group/item flex min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors',
                                      active
                                        ? 'bg-primary/10 font-medium text-primary'
                                        : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5',
                                    )}
                                  >
                                    {ItemIcon
                                      ? <ItemIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                      : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />}
                                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                    {item.children && active && (
                                      <ChevronRight className="h-3 w-3 rotate-90 text-current opacity-50" strokeWidth={2} />
                                    )}
                                  </Link>

                                  {item.children && active && (
                                    <div className="relative ml-3.5 mt-0.5 space-y-0.5 border-l border-border/50 pl-2.5">
                                      {item.children.map(child => {
                                        const childHref = child.href ?? `${item.href}#${child.anchor}`
                                        const childActive = child.href
                                          ? isItemActive(pathname, child.href)
                                          : activeHash === child.anchor
                                        return (
                                          <Link
                                            key={childHref}
                                            href={childHref}
                                            onClick={() => {
                                              if (child.anchor) setActiveHash(child.anchor)
                                            }}
                                            className={cn(
                                              'flex min-h-7 items-center gap-2 rounded-md px-2 py-1 text-[11px] leading-4 transition-colors',
                                              childActive
                                                ? 'bg-primary/10 font-medium text-primary'
                                                : 'text-muted-foreground/80 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5',
                                            )}
                                          >
                                            <span className={cn(
                                              'h-1 w-1 shrink-0 rounded-full',
                                              childActive ? 'bg-primary' : 'bg-current opacity-30',
                                            )} />
                                            <span className="truncate">{child.name}</span>
                                          </Link>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {!isCollapsed && visibleGroups.length === 0 && (
            <p className="px-2.5 py-6 text-center text-[12px] text-muted-foreground">
              Nenhum item encontrado.
            </p>
          )}
        </div>
      </nav>

      <div className="shrink-0 border-t border-border/50 p-3">
        {isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            aria-label="Expandir menu"
            className="mb-1 flex h-10 w-full items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        )}

        {effectiveSession && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'group flex w-full items-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5',
                  isCollapsed ? 'h-10 justify-center' : 'gap-2.5 px-2 py-2 text-left',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                  {userInitial}
                </span>
                {!isCollapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-foreground">{effectiveSession.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{effectiveSession.email}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side={isCollapsed ? 'right' : 'top'} className="w-52">
              <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')} className="cursor-pointer">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{isDark ? 'Usar tema claro' : 'Usar tema escuro'}</span>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Languages className="h-4 w-4" />
                  <span>Idioma</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={adminLocale} onValueChange={handleLocaleChange}>
                    {localeOptions.map(option => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full cursor-pointer">
                    <LogOut className="h-4 w-4" />
                    <span>Sair</span>
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  )
}
