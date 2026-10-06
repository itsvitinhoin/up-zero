'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react'
import { toast } from 'sonner'
import { AdminPanel } from '@/components/admin/admin-mobile-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { messageSchema, type Campaign, type PushMessage } from '@/lib/push/types'
import { isoToLocalDateTime, localDateTimeToIso } from '@/lib/push/dates'
import { Choice } from './audience-filters'
import { Field, PushPage, usePushView } from './shared'
import { MessageFields, PushPreview } from './message'

const steps = ['Público', 'Mensagem', 'Destino', 'Agendamento', 'Revisão']
export function PushCampaignEditor({ draft }: { draft?: string }) {
  const data = usePushView()
  if (!data.view) return <PushPage title="Nova campanha de Push" description="Escolha o público, prepare a notificação e revise o disparo." data={data}>{null}</PushPage>
  return <CampaignForm key={draft || 'new'} data={data} draft={draft} />
}
function CampaignForm({ data, draft }: { data: ReturnType<typeof usePushView>; draft?: string }) {
  const router = useRouter(), [step, setStep] = useState(0)
  const initial = data.view?.campaigns.find(c => c.id === draft && c.status === 'DRAFT')
  const [name, setName] = useState(initial?.name || ''), [audienceId, setAudienceId] = useState(initial?.audienceId || ''), [message, setMessage] = useState<PushMessage>(initial?.message || { title: '', body: '', image: '', destination: 'home', destinationId: '' })
  const [sendMode, setSendMode] = useState(initial?.scheduledAt ? 'scheduled' : 'now'), [scheduled, setScheduled] = useState(initial?.scheduledAt ? isoToLocalDateTime(initial.scheduledAt, data.view!.settings.timezone) : ''), [confirm, setConfirm] = useState(false), [testDevice, setTestDevice] = useState('')
  const timezone = data.view?.settings.timezone || 'America/Sao_Paulo', audience = data.view?.audiences.find(a => a.id === audienceId)
  const canNext = step === 0 ? !!name.trim() && !!audience : step === 1 ? !!message.title.trim() && !!message.body.trim() && (!message.image || message.image.startsWith('https://')) : step === 2 ? message.destination === 'home' || !!message.destinationId.trim() : step === 3 ? sendMode === 'now' || !!scheduled : messageSchema.safeParse(message).success
  async function save(send = false) {
    try {
      const scheduledAt = sendMode === 'scheduled' ? localDateTimeToIso(scheduled, timezone) : null
      const result = await data.run<Campaign>('campaign.save', { ...(draft ? { id: draft } : {}), name, audienceId, message, scheduledAt }, 'Rascunho salvo.')
      if (!result) return
      if (send) await data.run('campaign.send', { id: result.id }, scheduledAt ? 'Campanha agendada.' : 'Campanha encaminhada para a fila de envio.')
      router.push('/push/campaigns')
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Revise o agendamento.') }
  }
  const testDevices = data.view?.devices.filter(d => d.memberId.startsWith('admin:') && d.active && d.permission === 'GRANTED') || []
  return <PushPage title={draft ? 'Editar campanha de Push' : 'Nova campanha de Push'} description="Escolha o público, prepare a notificação e revise o disparo." data={data} actions={<Button asChild variant="outline"><Link href="/push/campaigns"><ArrowLeft className="h-4 w-4" />Campanhas</Link></Button>}>
    {draft && !data.view?.campaigns.some(c => c.id === draft && c.status === 'DRAFT') ? <p className="text-destructive">Rascunho não encontrado ou já encaminhado para envio.</p> : <>
    <div className="flex flex-wrap gap-2">{steps.map((label, index) => <div key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${index === step ? 'border-primary/30 bg-primary/10 font-medium text-primary' : 'text-muted-foreground'}`}><span>{index < step ? <Check className="h-4 w-4" /> : index + 1}</span>{label}</div>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]"><AdminPanel title={steps[step]} description={`Etapa ${step + 1} de ${steps.length}`}>
      {step === 0 ? <div className="space-y-4"><Field label="Nome interno da campanha"><Input aria-label="Nome interno da campanha" maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Lançamentos de outubro" /></Field><Field label="Público dinâmico"><Choice label="Público dinâmico" value={audienceId} onChange={setAudienceId} options={data.view?.audiences.map(a => [a.id, `${a.name} · ${a.deviceCount} dispositivos`]) || []} /></Field><p className="text-sm text-muted-foreground">{audience ? `${audience.memberCount} pessoas · ${audience.deviceCount} dispositivos elegíveis agora.` : 'Selecione uma lista criada com seus critérios.'}</p><Button asChild variant="outline"><Link href="/push/audiences">Criar ou editar públicos</Link></Button></div> : null}
      {step === 1 ? <MessageFields value={message} onChange={setMessage} /> : null}
      {step === 2 ? <MessageFields value={message} onChange={setMessage} destination /> : null}
      {step === 3 ? <div className="space-y-4"><Field label="Quando enviar"><Choice label="Quando enviar" value={sendMode} onChange={setSendMode} options={[["now","Enviar agora"],["scheduled","Agendar envio"]]} /></Field>{sendMode === 'scheduled' ? <Field label="Data e horário" hint={`Fuso: ${timezone}`}><Input aria-label="Data e horário do envio" type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} /></Field> : null}<p className="text-sm text-muted-foreground">Mensagens comerciais respeitam o horário permitido e o limite de frequência configurados.</p></div> : null}
      {step === 4 ? <div className="space-y-4 text-sm"><p><strong>Campanha:</strong> {name}</p><p><strong>Público:</strong> {audience?.name}</p><p><strong>Alcance atual:</strong> {audience?.deviceCount || 0} dispositivos</p><p><strong>Envio:</strong> {sendMode === 'now' ? 'Agora' : `${scheduled.replace('T',' às ')} · ${timezone}`}</p><p className="text-muted-foreground">A lista será recalculada antes do envio. Pessoas sem permissão e dispositivos desativados serão excluídos.</p><Field label="Aparelho de teste" hint="Somente aparelhos vinculados ao seu usuário podem receber o teste."><Choice label="Aparelho de teste" value={testDevice} onChange={setTestDevice} options={testDevices.map(d => [d.id, `${d.platform} · ${d.id}`])} /></Field><Button variant="outline" disabled={data.busy || !testDevice || !data.view?.canSend} onClick={() => void data.run('test.send', { deviceId: testDevice, message }, 'Teste aceito pelo serviço de Push.')}>Enviar teste</Button></div> : null}
    </AdminPanel><PushPreview message={message} /></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={data.busy} onClick={() => step ? setStep(step - 1) : router.push('/push/campaigns')}><ArrowLeft className="h-4 w-4" />{step ? 'Anterior' : 'Cancelar'}</Button><div className="flex gap-2">{step === 4 ? <><Button variant="outline" disabled={data.busy || !data.view?.canSend || !canNext} onClick={() => void save()}>Salvar rascunho</Button><Button disabled={data.busy || !data.view?.canSend || !canNext || !audience?.deviceCount || !data.view?.settings.enabled || !data.view?.readiness.provider} onClick={() => setConfirm(true)}><Send className="h-4 w-4" />{sendMode === 'now' ? 'Enviar campanha' : 'Agendar campanha'}</Button></> : <Button disabled={!canNext || data.busy || !data.view?.canSend} onClick={() => setStep(step + 1)}>Próximo<ArrowRight className="h-4 w-4" /></Button>}</div></div>
    </>}
    <AlertDialog open={confirm} onOpenChange={open => { if (!data.busy) setConfirm(open) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{sendMode === 'now' ? 'Confirmar disparo?' : 'Confirmar agendamento?'}</AlertDialogTitle><AlertDialogDescription>A campanha “{name}” usará o público “{audience?.name}”, com {audience?.deviceCount || 0} dispositivos elegíveis na prévia atual.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={data.busy}>Revisar</AlertDialogCancel><AlertDialogAction disabled={data.busy} onClick={e => { e.preventDefault(); void save(true) }}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </PushPage>
}
