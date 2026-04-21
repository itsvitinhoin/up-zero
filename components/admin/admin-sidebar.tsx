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
  ChevronDown,
  UserCog,
  ShoppingCart,
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
} from 'lucide-react'
import { AdminBranchSelector } from '@/components/admin/admin-branch-selector'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import { useEffect, useState } from 'react'
import { useAdminStore } from '@/contexts/admin-store-context'
import { useTheme } from 'next-themes'

interface AdminSidebarProps {
  session?: SessionUser | null
  storeName?: string
}

const navigation = [
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
    name: 'Pedidos',
    href: '/orders',
    icon: ShoppingCart,
  },
  {
    name: 'Links Personalizados',
    href: '/custom-links',
    icon: Link2,
  },
  {
    name: 'Automações',
    href: '/mensageria',
    icon: MessageSquare,
  },
  {
    name: 'Smart Lists',
    href: '/smart-lists',
    icon: ListFilter,
  },
  {
    name: 'Campanhas',
    href: '/campaigns',
    icon: Send,
  },
  {
    name: 'Catálogo',
    icon: Package,
    children: [
      { name: 'Produtos', href: '/products', exact: true },
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
    name: 'Páginas',
    icon: FileText,
    children: [
      { name: 'Menu', href: '/pages/menu' },
      { name: 'Páginas', href: '/pages/institutional' },
    ],
  },
  {
    name: 'Filiais',
    href: '/branches',
    icon: GitBranch,
    adminOnly: true,
  },
  {
    name: 'Usuários',
    href: '/users',
    icon: UserCog,
    adminOnly: true,
  },
  {
    name: 'Configurações',
    href: '/settings',
    icon: Settings,
    adminOnly: true,
  },
]

export function AdminSidebar({ session, storeName }: AdminSidebarProps) {
  const adminStore = useAdminStore()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const [openMenus, setOpenMenus] = useState<string[]>(() => {
    const defaults = ['Catálogo', 'Assets', 'Preços', 'Páginas', 'Estoque']
    // Also open any group whose child matches the current path
    const activeGroups = navigation
      .filter(item => item.children?.some(child => pathname === child.href || pathname.startsWith(`${child.href}/`)))
      .map(item => item.name)
    return [...new Set([...defaults, ...activeGroups])]
  })
  const effectiveSession = session ?? adminStore.session
  const effectiveStoreName = storeName ?? adminStore.store?.name
  const userInitial = String(effectiveSession?.name || 'A').trim().charAt(0).toUpperCase()
  const isDark = theme === 'dark'
  const [adminLocale, setAdminLocale] = useState('en')

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

  function handleLocaleChange(nextLocale: string) {
    setAdminLocale(nextLocale)
    if (typeof document !== 'undefined') {
      document.cookie = `ADMIN_LOCALE=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`
      window.location.reload()
    }
  }

  // Don't show sidebar on login page
  if (pathname === '/login') {
    return null
  }

  const toggleMenu = (name: string) => {
    setOpenMenus(prev =>
      prev.includes(name)
        ? prev.filter(m => m !== name)
        : [...prev, name]
    )
  }

  const isActive = (href: string, exact?: boolean) => {
    if (href === '/') return pathname === '/'
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-border/60 bg-card/95 backdrop-blur">
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-border/60 px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
            <Image
              src="/icon.png"
              alt="Logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-contain"
            />
          <span className="block truncate whitespace-nowrap text-lg font-semibold tracking-tight">
            {effectiveStoreName || 'Nome da Marca'}
          </span>
        </Link>
      </div>

      {/* Ver Vitrine Button */}
      <div className="px-4 pt-5">
        <Link
          href={effectiveSession?.storeId ? `/${effectiveSession.storeId}` : "/"}
          target="_blank"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/50 px-4 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/80"
        >
          <Store className="h-4 w-4" />
          Ver Vitrine
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Global branch filter */}
      <AdminBranchSelector />

      {/* Navigation */}
      <nav className="flex-1 overflow-auto p-4">
        <ul className="space-y-1.5">
          {navigation.map((item) => {
            // Filter admin-only items
            if (item.adminOnly && effectiveSession?.role !== 'ADMIN') {
              //return null
            }

            if (item.children) {
              return (
                <li key={item.name}>
                  <Collapsible
                    open={openMenus.includes(item.name)}
                    onOpenChange={() => toggleMenu(item.name)}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          'flex min-h-12 w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-[13px] font-medium transition-colors',
                          'hover:bg-muted/80 hover:text-foreground',
                          item.children.some(child => isActive(child.href, (child as any).exact))
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                        <ChevronDown
                          className={cn(
                            'ml-auto h-4 w-4 transition-transform',
                            openMenus.includes(item.name) && 'rotate-180'
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="mt-1.5 space-y-1.5 pl-9">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={cn(
                                'block rounded-2xl px-3 py-2.5 text-[13px] font-normal transition-colors',
                                'hover:bg-muted/80 hover:text-foreground',
                                isActive(child.href, (child as any).exact)
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              )
            }

            return (
              <li key={item.name}>
                <Link
                  href={item.href!}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-3 text-[13px] font-medium transition-colors',
                    'hover:bg-muted/80 hover:text-foreground',
                    isActive(item.href!)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User info and logout */}
      {effectiveSession && (
        <div className="border-t border-border/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-200 text-violet-700 text-xs font-semibold">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{effectiveSession.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{effectiveSession.email}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-9 shrink-0 p-0"
                  aria-label="Abrir menu da loja"
                >
                  <Store className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
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
                      {localeOptions.map((option) => (
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
          </div>
        </div>
      )}
    </aside>
  )
}
