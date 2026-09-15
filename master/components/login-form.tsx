'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Layers3, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function LoginForm({ demo, configured }: { demo: boolean; configured: boolean }) {
  const router = useRouter(), [pending, setPending] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('')
    const data = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(demo ? { demo: true, role: data.get('role') } : { email: data.get('email'), password: data.get('password') }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      router.replace('/'); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível entrar.') }
    finally { setPending(false) }
  }
  return <main className="grid min-h-screen bg-muted/40 lg:grid-cols-2">
    <div className="hidden flex-col justify-between bg-zinc-950 p-14 text-white lg:flex"><div className="flex items-center gap-3 text-xl font-semibold"><Layers3 className="size-8" /> UP ZERO <span className="ml-2 rounded border border-white/20 px-2 py-1 text-xs tracking-widest">MASTER</span></div><div className="max-w-lg"><p className="mb-5 text-xs tracking-[.2em] text-zinc-400">GESTÃO DA PLATAFORMA</p><h1 className="text-5xl font-semibold leading-tight tracking-tight">Todas as lojas.<br />Uma visão completa.</h1><p className="mt-6 text-lg leading-relaxed text-zinc-400">Acompanhe a operação, gerencie acessos e cuide do crescimento da UP Zero.</p></div><p className="text-sm text-zinc-500">Acesso exclusivo à equipe UP Zero</p></div>
    <div className="flex items-center justify-center p-6"><Card className="w-full max-w-md"><CardContent className="space-y-6 pt-2"><div className="flex size-12 items-center justify-center rounded-xl bg-muted"><LockKeyhole className="size-6" /></div><div><Badge variant="outline">UP ZERO MASTER</Badge><h2 className="mt-4 text-2xl font-semibold">Acessar o Master</h2><p className="mt-2 text-sm text-muted-foreground">{demo ? 'Explore a primeira versão com lojas e chaves fictícias.' : 'Entre com sua conta da equipe UP Zero.'}</p></div>
      {!configured ? <div role="status" className="rounded-lg border bg-muted/50 p-4 text-sm">O acesso global às lojas está aguardando configuração. O login será liberado quando a conexão do Master estiver pronta.</div> : <form onSubmit={submit} className="space-y-4">
        {demo ? <div className="space-y-2"><Label htmlFor="role">Perfil de demonstração</Label><select id="role" name="role" className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="owner">Administrador Master</option><option value="viewer">Consulta — sem acesso a chaves</option></select><p className="text-xs text-muted-foreground">Cada entrada cria um ambiente de demonstração independente.</p></div> : <><div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="username" required /></div><div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div></>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={pending}>{pending ? 'Entrando…' : demo ? 'Entrar na demonstração' : 'Entrar'}<ArrowRight /></Button>
      </form>}
    </CardContent></Card></div>
  </main>
}
