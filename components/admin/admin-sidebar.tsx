'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Package,
  Tag,
  Settings,
  UserCog,
  ShoppingCart,
  RotateCcw,
  ExternalLink,
  Store,
  LogOut as LogOutLine,
  Moon,
  Sun,
  FileText,
  Link2,
  Boxes,
  Languages,
  GitBranch,
  ListFilter,
  Send,
  ChevronLeft,
  ChevronRight,
  Palette,
  CreditCard,
  Truck,
  Megaphone,
  Globe,
  Receipt,
} from 'lucide-react'
import { AdminBranchSelector } from '@/components/admin/admin-branch-selector'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logoutAction } from '@/lib/actions/auth'
import type { SessionUser } from '@/lib/types'
import { useEffect, useState, type ElementType } from 'react'
import { useAdminStore } from '@/contexts/admin-store-context'
import { useTheme } from 'next-themes'

const softSpring = 'cubic-bezier(0.25, 1.1, 0.4, 1)'

interface NavItem {
  name: string
  href: string
  exact?: boolean
  icon?: ElementType
}

interface NavSection {
  id: string
  icon: ElementType
  label: string
  href?: string
  items?: NavItem[]
  adminOnly?: boolean
}

const navSections: NavSection[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { id: 'clientes', icon: Users, label: 'Clientes', href: '/customers' },
  {
    id: 'pedidos',
    icon: ShoppingCart,
    label: 'Pedidos',
    items: [
      { name: 'Lista de pedidos', href: '/orders', exact: true, icon: ShoppingCart },
      { name: 'Carrinhos abandonados', href: '/orders/abandoned-carts', icon: RotateCcw },
    ],
  },
  {
    id: 'comunicacao',
    icon: MessageSquare,
    label: 'Comunicação',
    items: [
      { name: 'Links Personalizados', href: '/custom-links', icon: Link2 },
      { name: 'Automações', href: '/mensageria', icon: MessageSquare },
      { name: 'Smart Lists', href: '/smart-lists', icon: ListFilter },
      { name: 'Campanhas', href: '/campaigns', icon: Send },
    ],
  },
  {
    id: 'catalogo',
    icon: Package,
    label: 'Catálogo',
    items: [
      { name: 'Produtos', href: '/products', exact: true },
      { name: 'Categorias', href: '/categories' },
      { name: 'Vitrine', href: '/products/showcase' },
    ],
  },
  {
    id: 'assets',
    icon: Boxes,
    label: 'Assets',
    items: [
      { name: 'Imagens', href: '/assets', exact: true },
      { name: 'Categorias', href: '/assets/categories' },
    ],
  },
  {
    id: 'precos',
    icon: Tag,
    label: 'Preços',
    items: [
      { name: 'Canais de Venda', href: '/sales-channels' },
      { name: 'Regras de Preço', href: '/price-tables' },
      { name: 'Descontos por Qtd', href: '/tier-discounts' },
      { name: 'Cupons', href: '/coupons' },
    ],
  },
  {
    id: 'paginas',
    icon: FileText,
    label: 'Páginas',
    items: [
      { name: 'Menu', href: '/pages/menu' },
      { name: 'Páginas', href: '/pages/institutional' },
    ],
  },
  {
    id: 'admin',
    icon: UserCog,
    label: 'Admin',
    adminOnly: true,
    items: [
      { name: 'Filiais', href: '/branches', icon: GitBranch },
      { name: 'Usuários', href: '/users', icon: UserCog },
    ],
  },
]

const settingsSection: NavSection = {
  id: 'settings',
  icon: Settings,
  label: 'Configurações',
  items: [
    { name: 'Geral', href: '/settings/general', icon: Store },
    { name: 'B2B', href: '/settings/b2b', icon: Users },
    { name: 'Aparência', href: '/settings/appearance', icon: Palette },
    { name: 'Pagamentos', href: '/settings/payments', icon: CreditCard },
    { name: 'Estoque', href: '/settings/stock', icon: Boxes },
    { name: 'Frete', href: '/settings/shipping', icon: Truck },
    { name: 'Marketing', href: '/settings/marketing', icon: Megaphone },
    { name: 'Domínio', href: '/settings/domain', icon: Globe },
    { name: 'Billing', href: '/settings/billing', icon: Receipt },
  ],
}

function getSectionForPathname(pathname: string): string {
  if (pathname === '/') return 'dashboard'
  if (pathname.startsWith('/customers')) return 'clientes'
  if (pathname.startsWith('/orders')) return 'pedidos'
  if (
    pathname.startsWith('/custom-links') ||
    pathname.startsWith('/mensageria') ||
    pathname.startsWith('/smart-lists') ||
    pathname.startsWith('/campaigns')
  ) return 'comunicacao'
  if (pathname.startsWith('/products') || pathname.startsWith('/categories')) return 'catalogo'
  if (pathname.startsWith('/assets')) return 'assets'
  if (
    pathname.startsWith('/sales-channels') ||
    pathname.startsWith('/price-tables') ||
    pathname.startsWith('/tier-discounts') ||
    pathname.startsWith('/coupons')
  ) return 'precos'
  if (pathname.startsWith('/pages')) return 'paginas'
  if (pathname.startsWith('/branches') || pathname.startsWith('/users')) return 'admin'
  if (pathname.startsWith('/settings')) return 'settings'
  return 'dashboard'
}

function DetailPanel({
  activeSection,
  isCollapsed,
  onToggleCollapse,
  session,
  storeName,
}: {
  activeSection: string
  isCollapsed: boolean
  onToggleCollapse: () => void
  session?: SessionUser | null
  storeName?: string | null
}) {
  const pathname = usePathname()

  const isItemActive = (href: string, exact?: boolean) => {
    if (href === '/') return pathname === '/'
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const allSections = [...navSections, settingsSection]
  const sectionData = allSections.find(s => s.id === activeSection)

  const navItems: NavItem[] = sectionData
    ? (sectionData.items ?? (sectionData.href
        ? [{ name: sectionData.label, href: sectionData.href, icon: sectionData.icon }]
        : []))
    : []

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border/60 bg-card/95 backdrop-blur h-screen overflow-hidden transition-all',
        isCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-56 opacity-100'
      )}
      style={{ transitionDuration: '400ms', transitionTimingFunction: softSpring }}
    >
      {/* Store name + collapse button */}
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-border/60 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="block truncate whitespace-nowrap text-[13px] font-semibold tracking-tight">
            {storeName || 'Nome da Marca'}
          </span>
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          aria-label="Fechar painel"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Ver Vitrine */}
      <div className="shrink-0 px-3 pt-4">
        <Link
          href={session?.storeId ? `/${session.storeId}` : '/'}
          target="_blank"
          className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/50 px-3 py-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted/80"
        >
          <Store className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">Ver Vitrine</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </Link>
      </div>

      {/* Branch selector */}
      <div className="shrink-0 pt-3">
        <AdminBranchSelector />
      </div>

      {/* Section label */}
      {sectionData && (
        <div className="shrink-0 px-4 pb-1 pt-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {sectionData.label}
          </span>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-1">
          {navItems.map(item => {
            const ItemIcon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex min-h-10 items-center gap-3 rounded-2xl px-3 py-2 text-[13px] font-medium transition-colors',
                    'hover:bg-muted/80 hover:text-foreground',
                    isItemActive(item.href, item.exact)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground'
                  )}
                >
                  {ItemIcon && <ItemIcon className="h-4 w-4 shrink-0" />}
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

interface AdminSidebarProps {
  session?: SessionUser | null
  storeName?: string
}

export function AdminSidebar({ session, storeName }: AdminSidebarProps) {
  const adminStore = useAdminStore()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  const effectiveSession = session ?? adminStore.session
  const effectiveStoreName = storeName ?? adminStore.store?.name

  const [activeSection, setActiveSection] = useState(() => getSectionForPathname(pathname))
  const [detailCollapsed, setDetailCollapsed] = useState(false)
  const [adminLocale, setAdminLocale] = useState('en')

  const localeOptions = [
    { value: 'en', label: 'English' },
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'es', label: 'Español' },
    { value: 'ko', label: '한국어' },
    { value: 'zh', label: '中文' },
  ]

  useEffect(() => {
    setActiveSection(getSectionForPathname(pathname))
  }, [pathname])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const cookieValue = document.cookie
      .split('; ')
      .find(part => part.startsWith('ADMIN_LOCALE='))
      ?.split('=')[1]
    if (!cookieValue) return
    const normalized = decodeURIComponent(cookieValue)
    if (localeOptions.some(option => option.value === normalized)) {
      setAdminLocale(normalized)
    }
  }, [])

  if (pathname === '/login') return null

  const isDark = theme === 'dark'
  const userInitial = String(effectiveSession?.name || 'A').trim().charAt(0).toUpperCase()

  function handleLocaleChange(nextLocale: string) {
    setAdminLocale(nextLocale)
    if (typeof document !== 'undefined') {
      document.cookie = `ADMIN_LOCALE=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`
      window.location.reload()
    }
  }

  const railIconClass = (id: string) =>
    cn(
      'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors',
      activeSection === id
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
    )

  return (
    <div className="sticky top-0 flex h-screen flex-row">
      {/* Icon Rail */}
      <div className="flex h-screen w-14 flex-col items-center border-r border-border/60 bg-card/95 py-3 backdrop-blur">
        {/* Logo */}
        <div className="mb-1 flex h-10 w-10 items-center justify-center">
          <Image
            src="/icon.png"
            alt="Logo"
            width={28}
            height={28}
            className="h-7 w-7 rounded-md object-contain"
          />
        </div>

        {/* Section icons */}
        <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-1">
          {navSections.map(section => {
            const Icon = section.icon

            if (section.href && !section.items) {
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  title={section.label}
                  className={railIconClass(section.id)}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              )
            }

            return (
              <button
                key={section.id}
                type="button"
                title={section.label}
                className={railIconClass(section.id)}
                onClick={() => {
                  setActiveSection(section.id)
                  if (detailCollapsed) setDetailCollapsed(false)
                }}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>

        {/* Bottom: collapse toggle, settings, user */}
        <div className="flex flex-col items-center gap-1 px-2">
          <button
            type="button"
            title={detailCollapsed ? 'Expandir painel' : 'Colapsar painel'}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            onClick={() => setDetailCollapsed(v => !v)}
          >
            {detailCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />}
          </button>

          <button
            type="button"
            title="Configurações"
            className={railIconClass('settings')}
            onClick={() => {
              setActiveSection('settings')
              if (detailCollapsed) setDetailCollapsed(false)
            }}
          >
            <Settings className="h-4 w-4" />
          </button>

          {effectiveSession && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-semibold text-violet-700 transition-all hover:ring-2 hover:ring-primary/20"
                >
                  {userInitial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="w-44">
                <DropdownMenuItem
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className="cursor-pointer"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span>Tema</span>
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
                      <LogOutLine className="h-4 w-4" />
                      <span>Sair</span>
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        activeSection={activeSection}
        isCollapsed={detailCollapsed}
        onToggleCollapse={() => setDetailCollapsed(v => !v)}
        session={effectiveSession}
        storeName={effectiveStoreName}
      />
    </div>
  )
}
