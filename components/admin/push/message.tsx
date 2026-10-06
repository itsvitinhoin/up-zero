'use client'

import Image from 'next/image'
import { Bell } from 'lucide-react'
import { useAdminStore } from '@/contexts/admin-store-context'
import { AdminPanel } from '@/components/admin/admin-mobile-ui'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { PushMessage } from '@/lib/push/types'
import { Choice } from './audience-filters'
import { Field } from './shared'

export const destinations: [string, string][] = [['home', 'Início do aplicativo'], ['product', 'Produto'], ['category', 'Categoria'], ['promotion', 'Promoção'], ['order', 'Pedido'], ['cart', 'Carrinho'], ['review', 'Avaliação do pedido']]
export function MessageFields({ value, onChange, destination = false, variables }: { value: PushMessage; onChange: (value: PushMessage) => void; destination?: boolean; variables?: string }) {
  return <div className="space-y-4">{!destination ? <>
    <Field label="Título"><Input aria-label="Título da notificação" maxLength={100} value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} placeholder="Escreva o título da notificação" /><p className="text-xs text-muted-foreground">{value.title.length}/100</p></Field>
    <Field label="Mensagem" hint={variables ? `Variáveis disponíveis: ${variables}` : 'Use {{nome}} para inserir o nome do destinatário.'}><Textarea aria-label="Mensagem da notificação" rows={4} maxLength={500} value={value.body} onChange={e => onChange({ ...value, body: e.target.value })} /><p className="text-xs text-muted-foreground">{value.body.length}/500</p></Field>
    <Field label="Imagem opcional" hint="URL HTTPS. A exibição depende do aplicativo e do sistema operacional."><Input aria-label="Imagem da notificação" type="url" value={value.image} placeholder="https://..." onChange={e => onChange({ ...value, image: e.target.value })} /></Field>
  </> : <>
    <Field label="Destino ao tocar"><Choice label="Destino ao tocar" value={value.destination} onChange={v => onChange({ ...value, destination: v as PushMessage['destination'], destinationId: '' })} options={destinations} /></Field>
    {value.destination !== 'home' ? <Field label="Identificador do destino" hint="Identificador do produto, categoria, promoção, pedido ou carrinho reconhecido pelo aplicativo."><Input aria-label="Identificador do destino" value={value.destinationId} onChange={e => onChange({ ...value, destinationId: e.target.value })} placeholder="Informe o identificador" /></Field> : null}
  </>}</div>
}
export function PushPreview({ message }: { message: PushMessage }) {
  const { store } = useAdminStore()
  return <AdminPanel title="Prévia da notificação" description="A aparência pode variar entre Android e iOS."><div className="space-y-3 rounded-xl border bg-muted/30 p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Bell className="h-4 w-4 text-primary" /><span>{store?.name || 'Aplicativo da loja'}</span><span className="ml-auto">agora</span></div><p className="break-words text-sm font-semibold">{message.title || 'Título da notificação'}</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{message.body || 'Sua mensagem aparecerá aqui.'}</p>{message.image.startsWith('https://') ? <Image src={message.image} width={360} height={180} alt="Imagem da notificação" className="max-h-44 w-full rounded-lg object-cover" unoptimized /> : null}</div><p className="mt-3 text-xs text-muted-foreground">Ao tocar: {destinations.find(([key]) => key === message.destination)?.[1]}{message.destinationId ? ` · ${message.destinationId}` : ''}</p></AdminPanel>
}
