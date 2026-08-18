'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Bot, Check, CheckCheck, Clock3, Download, FileText, Loader2,
  Paperclip, Search, Send, Target, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { InboxConversation, InboxMessage, WhatsAppState } from '@/lib/whatsapp/types'
import { cn } from '@/lib/utils'

const MAX_MEDIA_BYTES = 4 * 1024 * 1024

async function request(path: string, options: RequestInit) {
  const response = await fetch(path, options)
  const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string | { message?: string } }
  if (!response.ok || payload.ok === false) {
    throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message ?? 'Não foi possível enviar a mensagem.')
  }
  return payload
}

function lastMessage(conversation: InboxConversation) {
  return conversation.messages.at(-1)
}

function contactFor(state: WhatsAppState, conversation: InboxConversation) {
  const digits = conversation.phone.replace(/\D/g, '').slice(-8)
  return state.contacts.find((contact) => contact.phone.replace(/\D/g, '').endsWith(digits))
}

function phoneForConversation(state: WhatsAppState, conversation: InboxConversation) {
  return state.phoneNumbers.find((phone) => phone.id === conversation.phoneNumberId)
}

function remainingWindow(expiresAt?: string) {
  if (!expiresAt) return { open: false, label: 'Janela de atendimento encerrada' }
  const remaining = new Date(expiresAt).getTime() - Date.now()
  if (remaining <= 0) return { open: false, label: 'Janela de atendimento encerrada' }
  const hours = Math.floor(remaining / 3_600_000)
  const minutes = Math.max(1, Math.floor((remaining % 3_600_000) / 60_000))
  return { open: true, label: `Janela aberta · ${hours ? `${hours}h ` : ''}${minutes}min restantes` }
}

function StatusIcon({ message }: { message: InboxMessage }) {
  if (message.direction !== 'outbound') return null
  if (message.status === 'failed') return <AlertCircle className="h-3.5 w-3.5 text-red-600" aria-label="Falhou" />
  if (message.status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-sky-600" aria-label="Lida" />
  if (message.status === 'delivered') return <CheckCheck className="h-3.5 w-3.5" aria-label="Entregue" />
  if (message.status === 'sent') return <Check className="h-3.5 w-3.5" aria-label="Enviada" />
  return <Clock3 className="h-3.5 w-3.5" aria-label="Enviando" />
}

function MessageMedia({ message }: { message: InboxMessage }) {
  const media = message.media
  if (!media) return null
  const src = `/api/mensageria/media/${encodeURIComponent(media.metaMediaId)}`

  if (media.type === 'image' || media.type === 'sticker') {
    return <a href={src} target="_blank" rel="noreferrer" className="mb-2 block overflow-hidden rounded-lg">
      <Image src={src} alt={media.caption || media.filename || 'Imagem recebida no WhatsApp'} width={560} height={420} unoptimized className="max-h-[360px] w-full object-contain" />
    </a>
  }
  if (media.type === 'video') {
    return <video controls preload="metadata" className="mb-2 max-h-[360px] w-full rounded-lg" src={src}>Seu navegador não suporta vídeo.</video>
  }
  if (media.type === 'audio') {
    return <audio controls preload="metadata" className="mb-2 w-full min-w-[240px]" src={src}>Seu navegador não suporta áudio.</audio>
  }
  return <a href={src} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-3 rounded-lg border bg-background/70 p-3 text-foreground">
    <FileText className="h-7 w-7 shrink-0" />
    <span className="min-w-0 flex-1 truncate font-medium">{media.filename || 'Documento recebido'}</span>
    <Download className="h-4 w-4 shrink-0" />
  </a>
}

function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return <div className="mb-3 flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
    {preview ? <Image src={preview} alt="Prévia do anexo" width={52} height={52} unoptimized className="h-13 w-13 rounded-lg object-cover" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>
    <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remover anexo"><X className="h-4 w-4" /></Button>
  </div>
}

export function WhatsAppConversationsSection({ state, reload }: { state: WhatsAppState; reload: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [phoneId, setPhoneId] = useState('all')
  const [selectedId, setSelectedId] = useState(state.conversations[0]?.id ?? '')
  const [reply, setReply] = useState('')
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const conversations = useMemo(() => state.conversations.filter((conversation) => {
    const contact = contactFor(state, conversation)
    const phoneMatches = phoneId === 'all' || conversation.phoneNumberId === phoneId
    const haystack = `${contact?.name ?? ''} ${conversation.maskedPhone} ${lastMessage(conversation)?.text ?? ''}`.toLowerCase()
    return phoneMatches && haystack.includes(query.toLowerCase())
  }), [phoneId, query, state])
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0]
  const windowStatus = remainingWindow(selected?.windowExpiresAt)

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [selected?.id, selected?.messages.length])

  async function sendReply() {
    if (!selected || (!reply.trim() && !file) || !windowStatus.open) return
    setBusy(true)
    try {
      if (file) {
        const form = new FormData()
        form.set('conversationId', selected.id)
        form.set('text', reply.trim())
        form.set('file', file)
        await request('/api/mensageria/inbox', { method: 'POST', body: form })
      } else {
        await request('/api/mensageria/inbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: selected.id, text: reply.trim() }),
        })
      }
      setReply('')
      setFile(undefined)
      if (fileInput.current) fileInput.current.value = ''
      await reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.')
    } finally {
      setBusy(false)
    }
  }

  function selectFile(candidate?: File) {
    if (!candidate) return
    if (candidate.size > MAX_MEDIA_BYTES) {
      toast.error('O anexo deve ter no máximo 4 MB neste ambiente.')
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setFile(candidate)
  }

  return <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
    <div className="grid min-h-[680px] lg:grid-cols-[360px_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b p-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversa" /></div>
          <Select value={phoneId} onValueChange={setPhoneId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os números</SelectItem>{state.phoneNumbers.map((phone) => <SelectItem key={phone.id} value={phone.id}>{phone.verifiedName ?? phone.displayPhoneNumber}</SelectItem>)}</SelectContent></Select>
        </div>
        <ScrollArea className="h-[300px] lg:h-[600px]">
          {conversations.map((conversation) => {
            const contact = contactFor(state, conversation)
            const message = lastMessage(conversation)
            const recurring = (contact?.orderCount ?? 0) > 0
            return <button type="button" key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={cn('w-full border-b p-4 text-left transition-colors hover:bg-muted/40', selected?.id === conversation.id && 'bg-muted/60')}>
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{contact?.name ?? conversation.contactName ?? conversation.maskedPhone}</p><p className="truncate text-sm text-muted-foreground">{message?.media ? `📎 ${message.media.filename || message.media.type}` : message?.text}</p></div><span className="text-[11px] text-muted-foreground">{message ? new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
              <div className="mt-2 flex flex-wrap gap-1"><Badge variant={recurring ? 'default' : 'secondary'}>{recurring ? 'Lead recorrente' : 'Lead novo'}</Badge>{message?.direction === 'inbound' ? <Badge variant="destructive">Sem resposta</Badge> : null}</div>
            </button>
          })}
          {conversations.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa real recebida.</p> : null}
        </ScrollArea>
      </aside>

      <section className="flex min-h-[680px] min-w-0 flex-col">
        {selected ? <>
          <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="font-semibold">{contactFor(state, selected)?.name ?? selected.contactName ?? selected.maskedPhone}</h3><p className="text-sm text-muted-foreground">{selected.maskedPhone}</p><p className="text-xs text-muted-foreground">Atendido por {phoneForConversation(state, selected)?.verifiedName ?? phoneForConversation(state, selected)?.displayPhoneNumber ?? 'conexão não identificada'}</p></div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant={windowStatus.open ? 'secondary' : 'destructive'}><Clock3 className="mr-1 h-3 w-3" />{windowStatus.label}</Badge><Badge><Target className="mr-1 h-3 w-3" />Em atendimento</Badge></div>
          </header>
          <ScrollArea className="flex-1 bg-[#efeae2] p-4 dark:bg-slate-950">
            <div className="mx-auto max-w-3xl space-y-3">
              {selected.messages.map((message) => <div key={message.id} className={cn('max-w-[88%] rounded-xl p-3 text-sm shadow-sm', message.direction === 'outbound' ? 'ml-auto bg-[#d9fdd3] text-slate-900' : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white')}>
                <MessageMedia message={message} />
                {message.text && (!message.media || message.text !== message.media.filename) ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : null}
                {message.error ? <p className="mt-2 text-xs text-red-600">{message.error.message}</p> : null}
                <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-60">{message.templateId ? <span className="inline-flex items-center gap-1"><Bot className="h-3 w-3" />Automação</span> : message.direction === 'outbound' ? <span>Painel</span> : <span>Recebida</span>}<span>{new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><StatusIcon message={message} /></div>
              </div>)}
              <div ref={bottom} />
            </div>
          </ScrollArea>
          <footer className="border-t p-4">
            {!windowStatus.open ? <Alert className="mb-3 border-amber-300 bg-amber-50 dark:bg-amber-950/20"><AlertCircle className="h-4 w-4" /><AlertTitle>Janela de 24 horas encerrada</AlertTitle><AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span>Para retomar a conversa, envie um template aprovado e aguarde a resposta do cliente.</span><Button asChild size="sm" variant="outline"><Link href="/whatsapp/templates">Ver templates</Link></Button></AlertDescription></Alert> : null}
            {file ? <PendingFile file={file} onRemove={() => setFile(undefined)} /> : null}
            <div className="flex items-end gap-2">
              <input ref={fileInput} type="file" className="hidden" accept="image/*,video/mp4,video/3gpp,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(event) => selectFile(event.target.files?.[0])} />
              <Button type="button" variant="outline" size="icon" disabled={busy || !windowStatus.open} onClick={() => fileInput.current?.click()} aria-label="Anexar arquivo"><Paperclip className="h-4 w-4" /></Button>
              <Input value={reply} onChange={(event) => setReply(event.target.value)} disabled={!windowStatus.open} placeholder={file ? 'Adicione uma legenda (opcional)' : 'Digite uma mensagem'} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendReply() } }} />
              <Button size="icon" onClick={() => void sendReply()} disabled={busy || !windowStatus.open || (!reply.trim() && !file)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Imagens, vídeos, áudios, PDF e Office · até 4 MB por envio.</p>
          </footer>
        </> : <div className="flex flex-1 items-center justify-center text-muted-foreground">Selecione uma conversa</div>}
      </section>
    </div>
  </div>
}
