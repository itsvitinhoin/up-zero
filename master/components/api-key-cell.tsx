'use client'
import { useEffect, useRef, useState } from 'react'
import { Copy, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useWorkspace } from './master-shell'
import type { Mutation, Store } from '../lib/contracts'

export async function storeAction(id: number, input: Mutation) {
  const response = await fetch(`/api/stores/${id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a ação.')
  return result as { key?: string; auditId?: string; success?: boolean }
}
export function ApiKeyCell({ store }: { store: Store }) {
  const { session, refresh } = useWorkspace(), [key, setKey] = useState<string | null>(null), [pending, setPending] = useState(false)
  const generation = useRef(0)
  useEffect(() => {
    const hide = () => { generation.current++; setKey(null) }
    const onVisibility = () => { if (document.hidden) hide() }
    window.addEventListener('blur', hide); document.addEventListener('visibilitychange', onVisibility)
    return () => { hide(); window.removeEventListener('blur', hide); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  useEffect(() => { if (!key) return; const timer = window.setTimeout(() => setKey(null), 60000); return () => window.clearTimeout(timer) }, [key])
  async function access(action: 'key.reveal' | 'key.copy') {
    setPending(true); const current = ++generation.current
    try {
      const result = await storeAction(store.id, { action })
      if (!result.key || current !== generation.current) return
      if (action === 'key.copy') { await navigator.clipboard.writeText(result.key); toast.success('Chave copiada.') }
      else setKey(result.key)
      void refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível acessar a chave.') }
    finally { setPending(false) }
  }
  if (!store.hasApiKey) return <span className="text-xs text-muted-foreground">Não disponível</span>
  if (!session.permissions.includes('keys.read')) return <span className="flex items-center gap-2 text-xs text-muted-foreground"><KeyRound className="size-3" />Acesso restrito</span>
  return <div className="flex max-w-md items-center gap-1"><code className="block max-w-52 select-all break-all rounded bg-muted/70 px-2 py-1.5 text-xs">{key ?? '•••• •••• •••• ••••'}</code><Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`${key ? 'Ocultar' : 'Revelar'} chave de ${store.name}`} onClick={() => key ? setKey(null) : void access('key.reveal')}>{pending ? <Loader2 className="animate-spin" /> : key ? <EyeOff /> : <Eye />}</Button><Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`Copiar chave de ${store.name}`} onClick={() => void access('key.copy')}><Copy /></Button></div>
}
