'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Layers3, LayoutDashboard, Store, Blocks, CreditCard, ChartNoAxesCombined, Users, History, LogOut, Menu, Moon, Sun, X, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { workspaceSchema, type MasterSession, type Workspace, type Permission } from '../lib/contracts'

const navigation: { href: string; label: string; icon: typeof Store; permission: Permission }[] = [
  { href: '/', label: 'Visão geral', icon: LayoutDashboard, permission: 'stores.read' },
  { href: '/clientes', label: 'Clientes', icon: Users, permission: 'sales.read' },
  { href: '/lojas', label: 'Lojas', icon: Store, permission: 'stores.read' },
  { href: '/modulos', label: 'Planos e módulos', icon: Blocks, permission: 'stores.read' },
  { href: '/financeiro', label: 'Financeiro', icon: CreditCard, permission: 'billing.read' },
  { href: '/relatorios', label: 'Relatórios', icon: ChartNoAxesCombined, permission: 'billing.read' },
  { href: '/equipe', label: 'Equipe e permissões', icon: Users, permission: 'team.read' },
  { href: '/historico', label: 'Histórico de ações', icon: History, permission: 'audit.read' },
]
const WorkspaceContext = createContext<{ session: MasterSession; data: Workspace; refresh: () => Promise<void> } | null>(null)
export function useWorkspace() { const value = useContext(WorkspaceContext); if (!value) throw new Error('Master não carregado'); return value }
export function MasterShell({ session, initialData, children }: { session: MasterSession; initialData: Workspace; children: React.ReactNode }) {
  const pathname = usePathname(), router = useRouter(), { resolvedTheme, setTheme } = useTheme()
  const [mobile, setMobile] = useState(false), [data, setData] = useState<Workspace | null>(initialData), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const request = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/workspace', { cache: 'no-store', signal: controller.signal })
      if (response.status === 401) { router.replace('/login'); return }
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setData(workspaceSchema.parse(result))
    } catch (error) { if (!controller.signal.aborted) { setData(null); setError(error instanceof Error ? error.message : 'Falha ao carregar as lojas.') } }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }, [router])
  useEffect(() => () => request.current?.abort(), [])
  async function signOut() {
    try { const result = await fetch('/api/session', { method: 'DELETE' }); if (!result.ok) throw new Error(); setData(null); router.replace('/login'); router.refresh() }
    catch { toast.error('Não foi possível encerrar a sessão. Tente novamente.') }
  }
  const title = navigation.find(item => item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))?.label ?? 'Master'
  return <div className="flex min-h-screen bg-muted/40 text-sm">
    {mobile && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobile(false)} />}
    <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform lg:translate-x-0', mobile ? 'translate-x-0' : '-translate-x-full')}>
      <Link href="/" onClick={() => setMobile(false)} className="flex h-20 items-center gap-3 border-b px-6"><div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Layers3 className="size-5" /></div><div><span className="text-lg font-bold tracking-tight">UP ZERO</span><p className="text-[10px] font-semibold tracking-[.22em] text-muted-foreground">MASTER</p></div></Link>
      <div className="px-5 pb-3 pt-7 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Gestão da plataforma</div>
      <nav aria-label="Navegação Master" className="flex-1 space-y-1 px-3">{navigation.filter(item => session.permissions.includes(item.permission)).map(item => { const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={() => setMobile(false)} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted', active ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground')}><item.icon className="size-[18px]" />{item.label}{active && <ChevronRight className="ml-auto size-3.5" />}</Link> })}</nav>
      {session.mode === 'demo' && <div className="m-4 rounded-lg border bg-muted/40 p-3"><Badge variant="amber">Demonstração local</Badge><p className="mt-2 text-xs leading-relaxed text-muted-foreground">As lojas, cobranças e chaves deste ambiente são fictícias.</p></div>}
      <div className="border-t p-4"><p className="truncate font-medium">{session.name}</p><p className="mt-1 text-xs text-muted-foreground">{session.role}</p><Button variant="ghost" size="sm" className="mt-3 w-full justify-start text-muted-foreground" onClick={signOut}><LogOut />Sair do Master</Button></div>
    </aside>
    <div className="min-w-0 flex-1 lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur-sm md:px-8"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label={mobile ? 'Fechar navegação' : 'Abrir navegação'} onClick={() => setMobile(!mobile)}>{mobile ? <X /> : <Menu />}</Button><span className="hidden text-muted-foreground sm:inline">Master</span><ChevronRight className="hidden size-3 text-muted-foreground sm:inline" /><span className="font-medium">{title}</span></div><div className="flex items-center gap-2"><Badge variant="outline" className="hidden sm:inline-flex">{session.mode === 'demo' ? 'Dados de demonstração' : 'Equipe UP Zero'}</Badge><Button variant="ghost" size="icon" aria-label="Atualizar dados" disabled={loading} onClick={() => void refresh()}><RefreshCw className={cn(loading && 'animate-spin')} /></Button><Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}><Sun className="hidden dark:block" /><Moon className="dark:hidden" /></Button></div></header>
      <main id="main" className="mx-auto max-w-[1600px] p-4 md:p-8">{error ? <div role="alert" className="rounded-xl border bg-card p-8"><h1 className="text-lg font-semibold">Não foi possível atualizar o Master</h1><p className="my-3 text-muted-foreground">{error}</p><Button onClick={() => void refresh()}>Tentar novamente</Button></div> : data ? <WorkspaceContext.Provider value={{ session, data, refresh }}>{children}</WorkspaceContext.Provider> : <div aria-label="Carregando Master" className="space-y-6"><Skeleton className="h-10 w-60" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-28" />)}</div><Skeleton className="h-96 w-full" /></div>}</main>
    </div>
  </div>
}
